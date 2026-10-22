const { chromium } = require(process.env.STRIDEECO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const base = (process.env.STRIDEECO_TEST_URL || 'http://localhost:5175').replace(/\/$/, '');
fs.mkdirSync('outputs', { recursive: true });
const report = { passed: false, status: 'running', startedAt: new Date().toISOString() };
const writeReport = update => fs.writeFileSync('outputs/clerk-browser-auth-report.json', JSON.stringify({ ...report, ...update }, null, 2));
writeReport({});
let stage = 'development fixture validation';

(async () => {
  const target = /^http:\/\/localhost:(\d+)$/.exec(base);
  if (!target || Number(target[1]) < 1 || Number(target[1]) > 65535) throw new Error('Browser verification only permits an explicit http://localhost port.');
  const email = process.env.STRIDEECO_TEST_EMAIL;
  if (!email?.startsWith('strideeco-e2e+clerk_test_') || !email.endsWith('@example.com') ||
      !process.env.STRIDEECO_TEST_PASSWORD || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
      !process.env.TURSO_DATABASE_URL?.startsWith('file:')) throw new Error('Run through scripts/verify-clerk.mjs with its isolated development fixture.');
  await clerkSetup();
  const browser = await chromium.launch({ headless: true, ...(process.env.STRIDEECO_BROWSER_EXECUTABLE ? { executablePath: process.env.STRIDEECO_BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  fs.mkdirSync('outputs', { recursive: true });
  try {
    stage = 'anonymous planner and sign-up form';
    await setupClerkTestingToken({ page });
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal((await context.request.get(base + '/api/pilot')).status(), 401);
    await page.getByRole('link', { name: 'Sign up', exact: true }).click();
    await page.locator('.cl-signUp-root').waitFor();
    await page.getByText('Development mode', { exact: true }).waitFor();
    const primaryBackground = await page.locator('.cl-formButtonPrimary').evaluate(element => getComputedStyle(element).backgroundColor);
    assert.ok(!['transparent', 'rgba(0, 0, 0, 0)'].includes(primaryBackground), 'The Clerk primary button needs a visible background.');
    const inputOutline = await page.locator('input[name="emailAddress"]').evaluate(element => ({ width: getComputedStyle(element).borderTopWidth, style: getComputedStyle(element).borderTopStyle, shadow: getComputedStyle(element).boxShadow }));
    assert.ok((parseFloat(inputOutline.width) > 0 && inputOutline.style !== 'none') || inputOutline.shadow !== 'none', 'The Clerk email input needs a visible border or shadow outline.');
    await page.screenshot({ path: 'outputs/clerk-sign-up.png', fullPage: true });
    for (const [name, value] of [['firstName', 'StrideEco'], ['lastName', 'Test'], ['username', `strideecotest${Date.now()}`], ['emailAddress', email], ['password', process.env.STRIDEECO_TEST_PASSWORD]]) {
      const field = page.locator(`input[name="${name}"]`);
      if (await field.isVisible()) await field.fill(value);
    }
    const legal = page.locator('input[name="legalAccepted"]');
    if (await legal.isVisible()) throw new Error('The Clerk signup requires legal acceptance; the browser test cannot accept a new agreement.');
    stage = 'UI sign-up and email verification';
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('textbox', { name: 'Enter verification code' }).pressSequentially('424242');
    await page.waitForURL(url => url.pathname === '/' || url.pathname.includes('/tasks/'), { timeout: 45000 });
    if (new URL(page.url()).pathname.includes('/tasks/')) throw new Error('The existing Clerk development instance requires an account setup task before sign-in can finish.');
    await page.locator('.avatar').waitFor();
    assert.equal((await context.request.get(base + '/api/pilot')).status(), 200);
    console.log('Verified Clerk UI sign-up and email verification.');

    stage = 'account controls and UI sign-out';
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Route saved' }).waitFor();
    assert.ok(Number(await page.locator('.saved-button .count').innerText()) > 0);
    await page.locator('.avatar button').click();
    await page.getByRole('button', { name: 'Manage account', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.desktop-nav').getByRole('button', { name: 'My profile' }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
    // Clerk updates the UI before its cookie cleanup and redirect complete.
    let signedOutStatus;
    for (let i = 0; i < 20; i++) {
      signedOutStatus = (await context.request.get(base + '/api/pilot')).status();
      if (signedOutStatus === 401) break;
      await page.waitForTimeout(250);
    }
    assert.equal(signedOutStatus, 401, 'API access must stop when UI sign-out completes.');
    assert.equal(await page.locator('.saved-button .count').innerText(), '0');
    console.log('Verified account controls and UI sign-out clear private routes.');

    stage = 'UI sign-in and persistent saved routes';
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.locator('.cl-signIn-root').waitFor();
    await page.getByText('Development mode', { exact: true }).waitFor();
    await page.getByRole('button', { name: /github/i }).waitFor();
    await page.screenshot({ path: 'outputs/clerk-sign-in.png', fullPage: true });
    await page.locator('input[name="identifier"]').fill(email);
    let strategy = 'email-code';
    const password = page.locator('input[name="password"]');
    let submittedPassword = false;
    if (await password.isVisible()) { await password.fill(process.env.STRIDEECO_TEST_PASSWORD); strategy = 'password'; submittedPassword = true; }
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    if (!submittedPassword) {
      await Promise.race([
        page.locator('.avatar').waitFor(), password.waitFor({ state: 'visible' }),
        page.getByRole('textbox', { name: 'Enter verification code' }).waitFor(),
      ]);
      if (new URL(page.url()).pathname.startsWith('/sign-in') && await password.isVisible()) {
        await password.fill(process.env.STRIDEECO_TEST_PASSWORD);
        await page.getByRole('button', { name: 'Continue', exact: true }).click(); strategy = 'password';
      }
    }
    const code = page.getByRole('textbox', { name: 'Enter verification code' });
    await Promise.race([page.waitForURL(url => url.pathname === '/'), code.waitFor()]);
    if (await code.isVisible()) await code.pressSequentially('424242');
    await page.waitForURL(url => url.pathname === '/', { timeout: 45000 });
    await page.locator('.avatar').waitFor();
    const persisted = await context.request.get(base + '/api/pilot');
    assert.equal(persisted.status(), 200);
    assert.ok((await persisted.json()).routes.length > 0);
    await page.screenshot({ path: 'outputs/clerk-signed-in.png', fullPage: true });
    assert.deepEqual(errors, []);
    writeReport({ passed: true, status: 'passed', completedAt: new Date().toISOString(), verified: ['real development Clerk UI sign-up', 'visible primary button and input outline', 'visible Development mode notice on signup and signin', 'development test email OTP verification', 'UserButton account menu', 'profile SignOutButton and anonymous API rejection', 'private saved routes cleared after sign-out', `real development Clerk UI sign-in (${strategy})`, 'saved routes persist after signing in again'], fixture: 'Temporary +clerk_test account; cleanup managed by runner', limits: ['Clerk development instance with official bot-bypass testing token', 'Test email OTP, no real email delivery or GitHub OAuth', 'Isolated local database, no remote production persistence'], browserErrors: errors });
    console.log('PASS: real Clerk development UI sign-up, sign-in, account controls and sign-out.');
  } catch (error) {
    await page.screenshot({ path: 'outputs/clerk-auth-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { const sourceFrame = error.stack?.match(/tests[\\/]browser-auth\.cjs:\d+:\d+/)?.[0]; writeReport({ status: 'failed', completedAt: new Date().toISOString(), failedCheck: stage, errorType: error.name, sourceFrame }); console.error(`FAIL: ${stage} (${error.name}) ${sourceFrame || ''}. See the failure screenshot.`); process.exitCode = 1; });
