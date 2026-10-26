const { chromium } = require(process.env.STRIDEECO_PLAYWRIGHT || 'playwright');
const { clerk, clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = (process.env.STRIDEECO_TEST_URL || 'http://localhost:5175').replace(/\/$/, '');
const startedAt = new Date().toISOString(), checks = [], browserErrors = [];
const limits = ['One temporary Clerk development user and the runner’s isolated local database',
  'API200 responses and saved data are real; only explicit503 outages and transport delays are simulated',
  'Authentication forms are inspected without repeating signup, password submission or GitHub OAuth',
  'Desktop/mobile viewports are browser simulations, not physical-device tests'];
fs.mkdirSync('outputs', { recursive: true });
const report = update => fs.writeFileSync('outputs/account-loading-browser-report.json', JSON.stringify({ passed: false, status: 'running', startedAt, checks, browserErrors, limits, ...update }, null, 2));
report({});
let stage = 'isolated fixture validation', activePage;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const safeError = error => {
  let message = String(error.message).split('\n')[0];
  for (const secret of [process.env.STRIDEECO_TEST_PASSWORD, process.env.CLERK_SECRET_KEY, process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, process.env.CLERK_TESTING_TOKEN].filter(Boolean)) message = message.split(secret).join('[redacted]');
  return { name: error.name, message: message.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted JWT]').replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, '$1?[redacted query]').slice(0, 500) };
};
async function bounded(promise, label, timeout = 15000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), timeout); })]); }
  finally { clearTimeout(timer); }
}
const isAccountGet = request => request.method() === 'GET' && new URL(request.url()).origin === base && new URL(request.url()).pathname === '/api/pilot' && !new URL(request.url()).searchParams.has('shared');
async function state(context) {
  const response = await context.request.get(base + '/api/pilot');
  assert.equal(response.status(), 200, 'The isolated server must return real authenticated account data.');
  return response.json();
}
async function noOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label} must fit horizontally.`);
}
async function formReady(page, path, label) {
  await page.waitForURL(url => url.pathname === path);
  await page.locator(path === '/sign-up' ? '.cl-signUp-root' : '.cl-signIn-root').waitFor();
  await page.locator('.cl-formButtonPrimary').waitFor();
  await page.locator('.cl-cardBox').evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
  await noOverflow(page, label);
}
async function mutationResponse(page, action, activate) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/pilot' && response.request().method() === 'POST' && response.request().postDataJSON()?.action === action);
  await activate(); const response = await pending;
  assert.equal(response.status(), 200, `${action} should succeed after real account data becomes available.`);
  return response.json();
}
function captureErrors(page, surface) {
  page.on('pageerror', error => browserErrors.push({ surface, ...safeError(error) }));
}

async function signedInAvailability(browser, surface, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(surface === 'mobile' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage(); activePage = page; captureErrors(page, surface);
  const hold = deferred(), held = deferred();
  let mode = 'hold';
  const writes = [];
  page.on('request', request => {
    if (new URL(request.url()).origin === base && new URL(request.url()).pathname === '/api/pilot' && request.method() === 'POST') writes.push(request.postDataJSON()?.action);
  });
  await page.route('**/api/pilot', async route => {
    if (!isAccountGet(route.request())) return route.continue();
    if (mode === 'hold') { held.resolve(); await hold.promise; }
    if (mode === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'ACCOUNT_DATA_UNAVAILABLE', error: 'Account data is temporarily unavailable.' }) });
    if (mode === 'not-configured') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'ACCOUNT_STORAGE_NOT_CONFIGURED', error: 'Saved progress and rewards are not available yet. You can still plan a walk.' }) });
    return route.continue();
  });
  try {
    stage = `${surface}: delayed signed-in account data`;
    await setupClerkTestingToken({ page });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await clerk.signIn({ page, emailAddress: process.env.STRIDEECO_TEST_EMAIL });
    await bounded(held.promise, 'The signed-in page did not request account data.');
    await page.locator('[data-account-status="loading"]').waitFor();
    assert.doesNotMatch((await page.locator('.wallet-chip strong').innerText()).trim(), /^\d+$/, 'An unknown balance must not appear as a numeric wallet.');
    assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Save and share route', exact: true }).isDisabled(), true);
    assert.deepEqual(writes, []);
    await noOverflow(page, `${surface} account loading`);
    await page.screenshot({ path: `outputs/account-${surface}-loading.png`, fullPage: true });
    checks.push(`${surface}: delayed signed-in GET shows loading, unknown balance and blocked storage writes`);

    if (surface === 'mobile') {
      stage = 'mobile: initial storage failure and retry';
      mode = 'not-configured'; hold.resolve();
      await page.locator('[data-account-status="unavailable"]').waitFor();
      assert.doesNotMatch((await page.locator('.wallet-chip strong').innerText()).trim(), /^\d+$/);
      await page.locator('.mobile-nav').getByRole('button', { name: 'Rewards', exact: true }).click();
      await page.getByRole('heading', { name: 'Your points wallet', exact: true }).waitFor();
      assert.ok((await page.locator('.wallet-number').innerText()).includes('—'));
      assert.equal(await page.getByRole('button', { name: 'Rewards unavailable', exact: true }).isDisabled(), true);
      await page.screenshot({ path: 'outputs/account-mobile-unavailable.png', fullPage: true });
      mode = 'pass'; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    } else { mode = 'pass'; hold.resolve(); }
    await page.locator('[data-account-status]').waitFor({ state: 'hidden' });
    const before = await state(context);
    assert.equal((await page.locator('.wallet-chip strong').innerText()).trim(), String(before.wallet.points - before.wallet.reserved));
    checks.push(`${surface}: a real authenticated200 replaces unknown state with persisted account values`);

    if (surface === 'desktop') {
      stage = 'desktop: ready account saves a route and credits a real demo';
      const saved = await mutationResponse(page, 'save-route', () => page.getByRole('button', { name: 'Save', exact: true }).click());
      assert.equal(saved.routes.length, before.routes.length + 1);
      await page.getByRole('button', { name: /The scenic alternative/ }).click();
      await page.locator('.desktop-nav').getByRole('button', { name: 'My activity', exact: true }).click();
      const credited = await mutationResponse(page, 'activity', () => page.getByRole('button', { name: 'Try a demo walk', exact: true }).click());
      await page.getByRole('heading', { name: 'Every step adds up.', exact: true }).waitFor();
      assert.ok(credited.wallet.points > before.wallet.points);
      assert.equal(credited.activities[0].source, 'demo');
      checks.push('ready desktop account saves a real route and credits a labelled demo through the isolated server');

      stage = 'desktop: outage preserves verified data and blocks further writes';
      await page.locator('.desktop-nav').getByRole('button', { name: 'Water rewards', exact: true }).click();
      await page.getByRole('heading', { name: 'Your points wallet', exact: true }).waitFor();
      mode = 'fail';
      await page.getByRole('button', { name: 'Refresh wallet', exact: true }).click();
      const notice = page.locator('[data-account-status="unavailable"]'); await notice.waitFor();
      assert.match(await notice.innerText(), /last loaded data/i);
      assert.equal((await page.locator('.wallet-chip strong').innerText()).trim(), String(credited.wallet.points - credited.wallet.reserved));
      assert.equal(await page.getByRole('button', { name: 'Rewards unavailable', exact: true }).isDisabled(), true);
      const beforeBlockedActions = writes.length;
      await page.locator('.desktop-nav').getByRole('button', { name: 'Plan a route', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Save and share route', exact: true }).isDisabled(), true);
      await page.locator('.desktop-nav').getByRole('button', { name: 'My profile', exact: true }).click();
      assert.equal(await page.getByRole('checkbox', { name: 'Consent to aggregated planning insights' }).isDisabled(), true);
      assert.equal(await page.locator('.profile-saved .saved-row').count(), credited.routes.length);
      assert.equal(writes.length, beforeBlockedActions);
      await page.screenshot({ path: 'outputs/account-desktop-unavailable.png', fullPage: true });
      mode = 'pass'; await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await notice.waitFor({ state: 'hidden' });
      const recovered = await state(context);
      assert.equal(recovered.wallet.points, credited.wallet.points);
      assert.deepEqual(recovered.routes.map(route => route.id), credited.routes.map(route => route.id));
      assert.equal(await page.locator('.profile-saved .saved-row').count(), credited.routes.length);
      assert.equal(await page.getByRole('checkbox', { name: 'Consent to aggregated planning insights' }).isDisabled(), false);
      checks.push('forced503 keeps last loaded routes/points, disables mutations, and real retry restores readiness without clearing data');
    } else {
      assert.ok(before.routes.length > 0 && before.wallet.points > 0, 'Mobile retry must load the persisted desktop fixture, not a new empty wallet.');
      checks.push('mobile initial503 shows no fabricated zero balance; retry loads the same saved route and points as desktop');
    }
    await noOverflow(page, `${surface} recovered account`);
  } finally { hold.resolve(); await context.close(); }
}

async function publicNavigation(browser, surface, viewport) {
  const cases = [
    { name: 'header sign-in', path: '/sign-in', trigger: page => page.locator('.topbar-actions').getByRole('link', { name: 'Sign in', exact: true }) },
    { name: 'header sign-up', path: '/sign-up', trigger: page => page.locator('.topbar-actions').getByRole('link', { name: 'Sign up', exact: true }) },
    { name: 'profile sign-in', path: '/sign-in', profile: true, trigger: page => page.locator('.account-profile-actions').getByRole('link', { name: 'Sign in', exact: true }) },
    { name: 'profile create account', path: '/sign-up', profile: true, trigger: page => page.getByRole('link', { name: 'Create account', exact: true }) },
    { name: 'saved routes sign-in', path: '/sign-in', trigger: page => page.getByRole('button', { name: /^Saved routes/ }) },
  ];
  for (const item of cases) {
    stage = `${surface}: delayed ${item.name} navigation`;
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(surface === 'mobile' ? { isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage(); activePage = page; captureErrors(page, surface);
    const hold = deferred(), held = deferred();
    await page.route(url => url.origin === base && url.pathname === item.path && url.searchParams.has('_rsc'), async route => { held.resolve(); await hold.promise; await route.continue().catch(() => {}); });
    try {
      await setupClerkTestingToken({ page });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
      if (item.profile) await page.locator(surface === 'mobile' ? '.mobile-nav' : '.desktop-nav').getByRole('button', { name: surface === 'mobile' ? 'Profile' : 'My profile', exact: true }).click();
      await item.trigger(page).click({ noWaitAfter: true });
      await bounded(held.promise, `${item.name} did not request an auth RSC route.`);
      await page.locator('[data-auth-pending="true"], [data-auth-navigation-status], [data-auth-loading]').first().waitFor({ state: 'visible' });
      await noOverflow(page, `${surface} ${item.name} pending`);
      hold.resolve();
      await formReady(page, item.path, `${surface} ${item.name} form`);
      checks.push(`${surface}: ${item.name} exposes pending navigation before a delayed real auth route becomes ready`);
    } finally { hold.resolve(); await context.close(); }
  }
}

async function delayedClerkForm(browser, surface, viewport) {
  stage = `${surface}: delayed Clerk SDK fallback`;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(surface === 'mobile' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage(); activePage = page; captureErrors(page, surface);
  const hold = deferred(), held = deferred();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === 'script' && /clerk(?:\.headless)?\.browser/.test(url.pathname)) { held.resolve(); await hold.promise; }
    return route.continue().catch(() => {});
  });
  try {
    await setupClerkTestingToken({ page });
    await page.goto(base + '/sign-in', { waitUntil: 'domcontentloaded' });
    await bounded(held.promise, 'The Clerk runtime script was not requested.');
    await page.locator('[data-auth-loading]').waitFor({ state: 'visible' });
    await noOverflow(page, `${surface} Clerk fallback`);
    await page.screenshot({ path: `outputs/auth-${surface}-sdk-loading.png`, fullPage: true });
    hold.resolve();
    await formReady(page, '/sign-in', `${surface} released SDK sign-in`);
    await page.locator('[data-auth-loading]').waitFor({ state: 'hidden' });
    await page.screenshot({ path: `outputs/auth-${surface}-ready.png`, fullPage: true });
    checks.push(`${surface}: a delayed external Clerk runtime shows the SDK fallback then a usable sign-in form`);
  } finally { hold.resolve(); await context.close(); }
}

(async () => {
  const target = /^http:\/\/localhost:(\d+)$/.exec(base);
  if (!target || Number(target[1]) < 1 || Number(target[1]) > 65535 || !process.env.STRIDEECO_TEST_EMAIL?.startsWith('strideeco-e2e+clerk_test_') ||
      !process.env.STRIDEECO_TEST_EMAIL.endsWith('@example.com') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') || !process.env.TURSO_DATABASE_URL?.startsWith('file:')) throw new Error('Use verify-clerk --account-loading-only with its isolated development fixture.');
  await clerkSetup();
  const browser = await chromium.launch({ headless: true, ...(process.env.STRIDEECO_BROWSER_EXECUTABLE ? { executablePath: process.env.STRIDEECO_BROWSER_EXECUTABLE } : {}) });
  try {
    await bounded((async () => {
      for (const [surface, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
        await signedInAvailability(browser, surface, viewport);
        await publicNavigation(browser, surface, viewport);
        await delayedClerkForm(browser, surface, viewport);
      }
    })(), 'The account and navigation suite exceeded its six-minute deadline.', 360000);
    assert.deepEqual(browserErrors, []);
    report({ passed: true, status: 'passed', completedAt: new Date().toISOString() });
    console.log('PASS: account loading, real persistence recovery and responsive authentication navigation/fallbacks.');
  } catch (error) {
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: 'outputs/account-loading-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { report({ status: 'failed', completedAt: new Date().toISOString(), failedCheck: stage, error: safeError(error) }); console.error(safeError(error)); process.exitCode = 1; });
