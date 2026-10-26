const { chromium } = require(process.env.STRIDEECO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.STRIDEECO_TEST_URL || 'http://localhost:5187';
const reportPath = 'outputs/browser-public-report.json';
const startedAt = new Date().toISOString();
const checks = [];
const browserErrors = [];
const limits = ['Clerk keys are deliberately absent: no live sign-in or sign-up is asserted', 'Signed-out responsive browser checks use desktop and mobile viewports, not physical devices', 'Authenticated persistence and simulated water accounting are covered by separate suites'];
const report = extra => fs.writeFileSync(reportPath, JSON.stringify({ startedAt, target: base, checks, browserErrors, limits, ...extra }, null, 2));

(async () => {
  if (base !== 'http://localhost:5187' || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_SECRET_KEY || !process.env.TURSO_DATABASE_URL?.startsWith('file:')) {
    throw new Error('Run through scripts/verify-local.mjs --public-only with absent Clerk keys and an isolated local database.');
  }
  fs.mkdirSync('outputs', { recursive: true });
  report({ passed: false, status: 'running' });
  const browser = await chromium.launch({ headless: true, ...(process.env.STRIDEECO_BROWSER_EXECUTABLE ? { executablePath: process.env.STRIDEECO_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const [name, options] of [
      ['desktop', { viewport: { width: 1440, height: 1000 } }],
      ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
    ]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      const writes = [];
      page.on('pageerror', error => browserErrors.push(`${name}: ${error.message}`));
      page.on('request', request => { if (new URL(request.url()).pathname === '/api/pilot' && request.method() === 'POST') writes.push(request.url()); });
      assert.equal((await context.request.get(base + '/api/pilot')).status(), 401);
      assert.equal((await context.request.get(base + '/api/pilot', { headers: { 'oai-authenticated-user-id': 'spoofed', 'oai-authenticated-user-email': 'test@example.invalid' } })).status(), 401);
      assert.equal((await context.request.post(base + '/api/pilot', { data: { action: 'consent', value: true } })).status(), 401);

      await page.goto(base, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Your next little escape.', exact: true }).waitFor();
      assert.ok(await page.locator('.route-option').count() > 0);
      assert.ok((await page.locator('.route-shade').first().innerText()).includes('unavailable'));
      await page.locator('summary').filter({ hasText: 'Shade & sun settings' }).click();
      await page.getByRole('checkbox', { name: 'Enable assumed-height shade scenario' }).check();
      await page.getByLabel('Assumed building height').selectOption('9');
      assert.ok((await page.locator('.route-shade').first().innerText()).includes('scenario'));
      await page.getByRole('button', { name: 'To a place', exact: true }).click();
      await page.getByLabel('DESTINATION', { exact: true }).selectOption('1309457596');
      assert.ok(await page.locator('.route-option').count() > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `outputs/public-${name}-planner.png`, fullPage: true });
      checks.push(`${name}: public route planning, destination routing, explicit shade scenario and no horizontal overflow`);

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForURL('**/sign-in');
      await page.getByRole('status').filter({ hasText: 'Account sign-in is being connected.' }).waitFor();
      await page.getByRole('link', { name: 'Back to route planning' }).click();
      await page.getByRole('heading', { name: 'Your next little escape.', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Save and share route', exact: true }).click();
      await page.waitForURL('**/sign-in');
      await page.goto(base + '/sign-up', { waitUntil: 'networkidle' });
      await page.getByRole('status').filter({ hasText: 'Account sign-in is being connected.' }).waitFor();
      checks.push(`${name}: save/share require sign-in; absent-key sign-in and sign-up pages stay usable`);

      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator(name === 'mobile' ? '.mobile-nav' : '.desktop-nav').getByRole('button', { name: name === 'mobile' ? 'Rewards' : 'Water rewards', exact: true }).click();
      await page.getByRole('heading', { name: 'Your points wallet', exact: true }).waitFor();
      assert.ok((await page.locator('.wallet-footnote').innerText()).includes('No live machine or operator'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `outputs/public-${name}-rewards.png`, fullPage: true });
      await page.getByRole('button', { name: 'Sign in to collect points', exact: true }).click();
      await page.waitForURL('**/sign-in');
      assert.deepEqual(writes, []);
      checks.push(`${name}: anonymous API protection, water-only simulator labels and signed-out reward gating`);
      await context.close();
    }
    assert.deepEqual(browserErrors, []);
    report({ passed: true, status: 'passed', completedAt: new Date().toISOString() });
    console.log('PASS: signed-out desktop/mobile planner and absent-key account fallback');
  } finally { await browser.close(); }
})().catch(error => {
  fs.mkdirSync('outputs', { recursive: true });
  report({ passed: false, status: 'failed', completedAt: new Date().toISOString(), error: error.message });
  console.error(error);
  process.exitCode = 1;
});
