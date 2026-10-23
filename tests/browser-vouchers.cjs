const { chromium } = require(process.env.STRIDEECO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const jsQR = require('jsqr');
const { clerk, clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');

const base = (process.env.STRIDEECO_TEST_URL || 'http://localhost:5175').replace(/\/$/, '');
fs.mkdirSync('outputs', { recursive: true });
const report = { passed: false, status: 'running', startedAt: new Date().toISOString() };
const writeReport = update => fs.writeFileSync('outputs/voucher-browser-report.json', JSON.stringify({ ...report, ...update }, null, 2));
writeReport({});
let stage = 'isolated development fixture validation';
const markerHits = [];

// Decode a screenshot of rendered pixels, independently of the application's
// encoder and scan handler. The browser supplies PNG -> RGBA, Node/jsQR reads it.
async function decodePng(page, buffer) {
  const raster = await page.evaluate(async source => {
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  }, `data:image/png;base64,${buffer.toString('base64')}`);
  const decoded = jsQR(new Uint8ClampedArray(raster.pixels), raster.width, raster.height, { inversionAttempts: 'dontInvert' });
  assert.ok(decoded, 'The rendered water voucher QR must be independently scannable.');
  return decoded.data;
}
const apiState = async context => {
  const response = await context.request.get(base + '/api/pilot');
  assert.equal(response.status(), 200, 'The isolated account state must be available.');
  return response.json();
};
async function actionResponse(page, action, activate) {
  const response = page.waitForResponse(response => {
    const request = response.request();
    return new URL(response.url()).pathname === '/api/pilot' && request.method() === 'POST' && request.postDataJSON()?.action === action;
  });
  await activate();
  return response;
}
const walletEqual = (actual, expected) => assert.deepEqual(actual.wallet, expected.wallet);
async function usedVoucherKeepsFocus(page) {
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close redemption');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close redemption');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close redemption');
}
async function markerCentersHitTheirOwnPin(directory, surface) {
  await directory.locator('.map-canvas').scrollIntoViewIfNeeded();
  const hits = await directory.locator('.machine-map-pin').evaluateAll(pins => pins.map(pin => {
    const bounds = pin.querySelector('.machine-pin-halo').getBoundingClientRect();
    const element = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return { id: pin.getAttribute('data-machine-id'), hit: element?.closest('.machine-map-pin')?.getAttribute('data-machine-id') ?? null };
  }));
  markerHits.push({ surface, hits });
  assert.ok(hits.length > 0);
  assert.ok(hits.every(pin => pin.hit === pin.id), 'Each visible mock marker center must select its own machine.');
}

(async () => {
  const target = /^http:\/\/localhost:(\d+)$/.exec(base);
  if (!target || Number(target[1]) < 1 || Number(target[1]) > 65535 ||
      !process.env.STRIDEECO_TEST_EMAIL || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
      !process.env.TURSO_DATABASE_URL?.startsWith('file:')) {
    throw new Error('Use the isolated local verify-clerk runner with its selected temporary development user.');
  }
  await clerkSetup();
  const browser = await chromium.launch({ headless: true, ...(process.env.STRIDEECO_BROWSER_EXECUTABLE ? { executablePath: process.env.STRIDEECO_BROWSER_EXECUTABLE } : {}) });
  let activePage;
  const browserErrors = [];
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2,
      permissions: ['geolocation'], geolocation: { longitude: 101.516, latitude: 3.1784, accuracy: 5 }, acceptDownloads: true });
    const page = await desktop.newPage(); activePage = page;
    page.on('pageerror', error => browserErrors.push(error.name));
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async value => { window.__copiedWaterVoucher = value; },
    } }));
    await setupClerkTestingToken({ page });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal((await desktop.request.get(base + '/api/pilot')).status(), 401);
    await clerk.signIn({ page, emailAddress: process.env.STRIDEECO_TEST_EMAIL });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.avatar').waitFor();
    const initial = await apiState(desktop);

    stage = 'earning labelled demonstration points';
    let funded = initial;
    for (let i = 0; funded.wallet.points - funded.wallet.reserved < 2 * funded.rules.waterPoints && i < 4; i++) {
      await page.locator('.desktop-nav').getByRole('button', { name: 'Plan a route', exact: true }).click();
      await page.getByRole('button', { name: /The scenic alternative/ }).click();
      await page.locator('.desktop-nav').getByRole('button', { name: 'My activity', exact: true }).click();
      const another = page.getByRole('button', { name: 'Another walk', exact: true });
      if (await another.isVisible()) await another.click();
      const credited = await actionResponse(page, 'activity', () => page.getByRole('button', { name: 'Try a demo walk', exact: true }).click());
      assert.equal(credited.status(), 200);
      await page.getByRole('heading', { name: 'Look at you go.', exact: true }).waitFor();
      const after = await apiState(desktop);
      assert.ok(after.wallet.points > funded.wallet.points);
      assert.equal(after.activities[0].source, 'demo');
      funded = after;
    }
    assert.ok(funded.wallet.points - funded.wallet.reserved >= 2 * funded.rules.waterPoints);
    await page.locator('.desktop-nav').getByRole('button', { name: 'Water rewards', exact: true }).click();

    stage = 'mock machine map, type filter and nearest fixture';
    const directory = page.getByRole('region', { name: 'Mock township water machines', exact: true });
    await directory.waitFor();
    assert.ok((await directory.locator('.machine-disclosure').innerText()).includes('not confirmed installed machines'));
    assert.equal(await directory.locator('.machine-map-pin').count(), 6);
    assert.ok((await directory.locator('.map-machine-note').innerText()).includes('6 mock water stops'));
    assert.equal(await directory.locator('.machine-map-pin[aria-label*="Mock location."]').count(), 6);
    await markerCentersHitTheirOwnPin(directory, 'desktop-all-types');
    await page.getByLabel('Water machine type', { exact: true }).selectOption('bottled-chilled');
    assert.equal(await directory.locator('.machine-map-pin').count(), 2);
    assert.equal(await directory.locator('.machine-map-pin[data-machine-type="bottled-chilled"]').count(), 2);
    await page.getByRole('button', { name: 'Use my location', exact: true }).click();
    await page.getByRole('button', { name: 'Use route reference', exact: true }).waitFor();
    const first = directory.locator('.machine-card').first();
    assert.ok((await first.innerText()).includes('Central Park east mock stop'));
    assert.ok((await first.innerText()).includes('0 m straight line'));
    assert.equal(await first.getAttribute('aria-pressed'), 'true');
    const alternate = directory.locator('.machine-map-pin[data-machine-id="mock-urban-chilled"]');
    await alternate.focus(); await alternate.press('Enter');
    assert.equal(await alternate.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.chosen-machine strong').innerText(), 'Urban Park north mock stop');
    const centralPin = directory.locator('.machine-map-pin[data-machine-id="mock-central-chilled"]');
    await centralPin.click();
    assert.equal(await centralPin.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.chosen-machine strong').innerText(), 'Central Park east mock stop');
    await page.getByRole('button', { name: 'Use my location', exact: true }).click();
    await directory.locator('.machine-map-pin[data-machine-id="mock-central-chilled"][aria-pressed="true"]').waitFor();
    await page.screenshot({ path: 'outputs/voucher-desktop-machines.png', fullPage: true });

    const reserve = async () => {
      const before = await apiState(desktop);
      const response = await actionResponse(page, 'reserve-water', () => page.getByRole('button', { name: 'Redeem drinking water', exact: true }).click());
      assert.equal(response.status(), 200);
      const after = await response.json();
      await page.getByRole('heading', { name: 'Your water voucher is ready.', exact: true }).waitFor();
      const voucher = after.redemptions.find(voucher => voucher.id === after.redemptionId);
      assert.ok(voucher);
      assert.equal(after.wallet.points, before.wallet.points);
      assert.equal(after.wallet.reserved, before.wallet.reserved + voucher.cost);
      return { before, after, voucher };
    };
    const verifyQrAndCode = async (currentPage, voucher, filename) => {
      const qr = currentPage.getByRole('img', { name: 'One-time water voucher QR code', exact: true });
      await qr.waitFor();
      await qr.evaluate(image => image.decode());
      const screenshot = await qr.screenshot({ path: `outputs/${filename}` });
      const payload = await decodePng(currentPage, screenshot);
      assert.equal(payload, `strideeco:water:v1:${voucher.id}:${voucher.token}`);
      assert.equal((await currentPage.locator('.voucher-code').innerText()).replace(/[\s-]/g, ''), voucher.token);
      return payload;
    };

    stage = 'code and independently decoded QR represent one reserved voucher';
    const releasedVoucher = await reserve();
    assert.equal(releasedVoucher.voucher.machine_id, 'mock-central-chilled');
    assert.equal(releasedVoucher.voucher.machine_type, 'bottled-chilled');
    const releasePayload = await verifyQrAndCode(page, releasedVoucher.voucher, 'voucher-rendered-qr.png');
    await page.getByRole('button', { name: 'Copy code', exact: true }).click();
    assert.equal((await page.evaluate(() => window.__copiedWaterVoucher)).replace(/[\s-]/g, ''), releasedVoucher.voucher.token);
    const downloading = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download QR', exact: true }).click();
    const download = await downloading;
    await download.saveAs('outputs/voucher-download.png');
    assert.equal(await decodePng(page, fs.readFileSync('outputs/voucher-download.png')), releasePayload);

    stage = 'wrong machine cannot consume or release a voucher';
    await page.getByLabel('Simulator machine', { exact: true }).selectOption('mock-urban-chilled');
    await page.getByLabel('Voucher code', { exact: true }).fill(releasedVoucher.voucher.token);
    const wrongMachine = await actionResponse(page, 'resolve-water', () => page.getByRole('button', { name: 'Redeem entered code', exact: true }).click());
    assert.equal(wrongMachine.status(), 409);
    const unchanged = await apiState(desktop); walletEqual(unchanged, releasedVoucher.after);
    assert.equal(unchanged.redemptions.find(voucher => voucher.id === releasedVoucher.voucher.id).status, 'pending');
    const wrongQr = await desktop.request.post(base + '/api/pilot', { data: { action: 'consume-voucher', payload: releasePayload, machineId: 'mock-urban-chilled', result: 'dispensed' } });
    assert.equal(wrongQr.status(), 409); walletEqual(await apiState(desktop), releasedVoucher.after);
    const wrongRelease = await desktop.request.post(base + '/api/pilot', { data: { action: 'resolve-water', id: releasedVoucher.voucher.id, token: releasedVoucher.voucher.token, machineId: 'mock-urban-chilled', result: 'failed' } });
    assert.equal(wrongRelease.status(), 409); walletEqual(await apiState(desktop), releasedVoucher.after);
    await page.getByLabel('Simulator machine', { exact: true }).selectOption('mock-central-chilled');
    const failed = await actionResponse(page, 'resolve-water', () => page.getByRole('button', { name: 'Simulate machine failure', exact: true }).click());
    assert.equal(failed.status(), 200);
    await page.getByRole('heading', { name: 'Your points are available again.', exact: true }).waitFor();
    const released = await apiState(desktop); walletEqual(released, releasedVoucher.before);
    assert.equal(released.redemptions.find(voucher => voucher.id === releasedVoucher.voucher.id).status, 'failed');
    await page.getByRole('button', { name: 'Close redemption', exact: true }).click();

    stage = 'same pending voucher and QR across desktop and mobile';
    await page.getByLabel('Water machine type', { exact: true }).selectOption('refill');
    assert.equal(await directory.locator('.machine-map-pin[data-machine-type="refill"]').count(), 2);
    assert.ok((await directory.locator('.machine-card').first().innerText()).includes('Central Park lake mock stop'));
    const qrVoucher = await reserve();
    assert.equal(qrVoucher.voucher.machine_id, 'mock-central-refill');
    const qrPayload = await verifyQrAndCode(page, qrVoucher.voucher, 'voucher-refill-qr.png');
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      permissions: ['geolocation'], geolocation: { longitude: 101.516, latitude: 3.1784, accuracy: 5 } });
    const phone = await mobile.newPage(); activePage = phone;
    phone.on('pageerror', error => browserErrors.push(error.name));
    await setupClerkTestingToken({ page: phone });
    await phone.goto(base, { waitUntil: 'domcontentloaded' });
    await clerk.signIn({ page: phone, emailAddress: process.env.STRIDEECO_TEST_EMAIL });
    await phone.reload({ waitUntil: 'domcontentloaded' });
    await phone.locator('.avatar').waitFor();
    await phone.locator('.mobile-nav').getByRole('button', { name: 'Rewards', exact: true }).click();
    const phoneDirectory = phone.getByRole('region', { name: 'Mock township water machines', exact: true });
    await phoneDirectory.waitFor();
    assert.equal(await phoneDirectory.locator('.machine-map-pin').count(), 6);
    await markerCentersHitTheirOwnPin(phoneDirectory, 'mobile-all-types');
    const touchPin = phoneDirectory.locator('.machine-map-pin[data-machine-id="mock-urban-refill"]');
    await touchPin.tap();
    assert.equal(await touchPin.getAttribute('aria-pressed'), 'true');
    assert.equal(await phone.locator('.chosen-machine strong').innerText(), 'Urban Park garden mock stop');
    await phone.getByLabel('Water machine type', { exact: true }).selectOption('bottled-chilled');
    await phone.getByRole('button', { name: 'Use my location', exact: true }).click();
    await phone.getByRole('button', { name: 'Use route reference', exact: true }).waitFor();
    assert.equal(await phoneDirectory.locator('.machine-map-pin[data-machine-type="bottled-chilled"]').count(), 2);
    assert.ok((await phoneDirectory.locator('.machine-card').first().innerText()).includes('Central Park east mock stop'));
    await phone.screenshot({ path: 'outputs/voucher-mobile-machines.png', fullPage: true });
    await phone.locator('.redemption-row').filter({ hasText: 'Open voucher' }).click();
    await phone.getByRole('heading', { name: 'Your water voucher is ready.', exact: true }).waitFor();
    assert.equal(await phone.getByLabel('Simulator machine', { exact: true }).inputValue(), qrVoucher.voucher.machine_id);
    assert.equal(await verifyQrAndCode(phone, qrVoucher.voucher, 'voucher-mobile-qr.png'), qrPayload);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await phone.screenshot({ path: 'outputs/voucher-mobile-ready.png', fullPage: false });

    stage = 'QR scan consumes once and code replay conflicts';
    const scanned = await actionResponse(phone, 'consume-voucher', () => phone.getByRole('button', { name: 'Simulate QR scan', exact: true }).click());
    assert.equal(scanned.status(), 200);
    assert.equal(scanned.request().postDataJSON().payload, qrPayload);
    await phone.getByRole('heading', { name: 'A fresh finish.', exact: true }).waitFor();
    await usedVoucherKeepsFocus(phone);
    const consumed = await apiState(mobile);
    assert.equal(consumed.wallet.points, qrVoucher.before.wallet.points - qrVoucher.voucher.cost);
    assert.equal(consumed.wallet.reserved, qrVoucher.before.wallet.reserved);
    assert.equal(consumed.redemptions.find(voucher => voucher.id === qrVoucher.voucher.id).status, 'confirmed');
    assert.equal(consumed.events.length, qrVoucher.before.events.length + 1);
    const replay = await mobile.request.post(base + '/api/pilot', { data: { action: 'resolve-water', id: qrVoucher.voucher.id, token: qrVoucher.voucher.token, machineId: qrVoucher.voucher.machine_id, result: 'dispensed' } });
    assert.equal(replay.status(), 409); walletEqual(await apiState(mobile), consumed);
    await phone.getByRole('button', { name: 'Close redemption', exact: true }).click();
    await phone.screenshot({ path: 'outputs/voucher-mobile-used.png', fullPage: true });
    await mobile.close();

    stage = 'manual code consumes once and QR replay conflicts';
    activePage = page;
    await page.getByRole('button', { name: 'Close redemption', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh wallet', exact: true }).click();
    await page.locator('.reserved-note').waitFor({ state: 'hidden' });
    await page.getByLabel('Water machine type', { exact: true }).selectOption('bottled-ambient');
    const manual = await reserve();
    const manualPayload = await verifyQrAndCode(page, manual.voucher, 'voucher-manual-qr.png');
    const formatted = await page.locator('.voucher-code').innerText();
    await page.getByLabel('Voucher code', { exact: true }).fill(formatted.toLowerCase());
    const entered = await actionResponse(page, 'resolve-water', () => page.getByRole('button', { name: 'Redeem entered code', exact: true }).click());
    assert.equal(entered.status(), 200);
    await page.getByRole('heading', { name: 'A fresh finish.', exact: true }).waitFor();
    await usedVoucherKeepsFocus(page);
    const manualDone = await apiState(desktop);
    assert.equal(manualDone.wallet.points, manual.before.wallet.points - manual.voucher.cost);
    assert.equal(manualDone.wallet.reserved, manual.before.wallet.reserved);
    assert.equal(manualDone.events.length, manual.before.events.length + 1);
    const qrReplay = await desktop.request.post(base + '/api/pilot', { data: { action: 'consume-voucher', payload: manualPayload, machineId: manual.voucher.machine_id, result: 'dispensed' } });
    assert.equal(qrReplay.status(), 409); walletEqual(await apiState(desktop), manualDone);
    const anonymous = await browser.newContext();
    const anonymousConsume = await anonymous.request.post(base + '/api/pilot', { data: { action: 'consume-voucher', payload: manualPayload, machineId: manual.voucher.machine_id, result: 'dispensed' } });
    assert.equal(anonymousConsume.status(), 401);
    await anonymous.close();
    await page.screenshot({ path: 'outputs/voucher-desktop-used.png', fullPage: true });

    stage = 'fresh GPS reference clears completed-demo classification';
    await page.getByRole('button', { name: 'Close redemption', exact: true }).click();
    await page.locator('.desktop-nav').getByRole('button', { name: 'My activity', exact: true }).click();
    await page.getByRole('heading', { name: 'Look at you go.', exact: true }).waitFor();
    await page.locator('.desktop-nav').getByRole('button', { name: 'Plan a route', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s get moving', exact: true }).click();
    await page.getByRole('button', { name: 'Start with location', exact: true }).click();
    await page.locator('.gps-status').filter({ hasText: 'Recording · accuracy' }).waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.locator('.desktop-nav').getByRole('button', { name: 'Water rewards', exact: true }).click();
    const reference = await page.locator('.machine-reference').innerText();
    assert.ok(reference.includes('your last recorded position'));
    assert.ok(!reference.includes('demo position'));
    const afterGpsReference = await apiState(desktop);
    walletEqual(afterGpsReference, manualDone);
    assert.equal(afterGpsReference.activities.length, manualDone.activities.length, 'A paused stationary GPS fixture must not submit an activity.');
    assert.deepEqual(browserErrors, []);
    writeReport({ passed: true, status: 'passed', completedAt: new Date().toISOString(), browserErrors, markerHits,
      verified: ['labelled demo activity funds prototype points', 'six mock map pins with three water-only types', 'type filter and known-position nearest match',
        'keyboard, desktop click and mobile touch map selection', 'each marker center targets its own machine', 'rendered QR screenshot independently decoded with jsQR', 'displayed code and downloaded QR bind to the same voucher',
        'wrong machine rejects both QR and code without consuming', 'failed machine releases reserved points', 'same voucher and QR across desktop/mobile sessions',
        'UI QR scan consumes once', 'manual formatted code consumes once', 'used voucher retains keyboard focus inside its dialog', 'opposite-form replay returns409 without another debit', 'anonymous consumption rejected', 'no mobile horizontal overflow', 'fresh mocked GPS session clears prior demo reference classification without submitting an activity'],
      limits: ['Existing Clerk development user via official sign-in helper and isolated local database', 'Machine locations, geolocation fixture and dispensing are mock',
        'Copy callback intercepted to preserve the system clipboard', 'Authenticated other-owner and concurrent-consumption coverage is in the separate API suite', 'No live machine, stock, operator, remote persistence or physical GPS verified'] });
    console.log('PASS: mock machine selection, independently decoded QR, desktop/mobile water vouchers and single use.');
  } catch (error) {
    await activePage?.screenshot({ path: 'outputs/voucher-browser-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => {
  const sourceFrame = error.stack?.match(/tests[\\/]browser-vouchers\.cjs:\d+:\d+/)?.[0];
  writeReport({ status: 'failed', completedAt: new Date().toISOString(), failedCheck: stage, errorType: error.name, sourceFrame, markerHits });
  console.error(`FAIL: ${stage} (${error.name}) ${sourceFrame || ''}. See the failure screenshot.`);
  process.exitCode = 1;
});
