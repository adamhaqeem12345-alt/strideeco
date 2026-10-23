const { chromium } = require(process.env.STRIDEECO_PLAYWRIGHT || 'playwright');
const { clerk, clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const jsQR = require('jsqr');

const base = (process.env.STRIDEECO_TEST_URL || 'http://localhost:5175').replace(/\/$/, '');
const startedAt = new Date().toISOString();
const checks = [], contrasts = [], focusSamples = [], viewports = [], assets = [], browserErrors = [];
const limits = ['One temporary Clerk development fixture uses the official sign-in helper; signup, password and OAuth flows are not repeated',
  'Machine locations, demo activity, dispensing and the local wallet are prototype fixtures',
  'Contrast samples cover key rendered text and gradient endpoints; this is not an exhaustive accessibility audit',
  'Favicons are fetched and decoded at their declared sizes; browser tab chrome is not inspected'];
fs.mkdirSync('outputs', { recursive: true });
const report = update => fs.writeFileSync('outputs/branding-browser-report.json', JSON.stringify({ passed: false, status: 'running', startedAt, checks, contrasts, focusSamples, viewports, assets, browserErrors, limits, ...update }, null, 2));
report({});
let stage = 'isolated fixture validation', activePage;
const rgb = value => {
  const parts = value.match(/[\d.]+/g)?.map(Number);
  assert.ok(parts?.length >= 3, 'A computed sRGB color must be available.');
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
};
const blend = (front, back) => [0, 1, 2].map(i => front[i] * front[3] + back[i] * (1 - front[3])).concat(1);
const luminance = color => color.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0);
const contrastRatio = (first, second) => { const values = [luminance(first), luminance(second)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); };
async function readable(locator, label) {
  await locator.waitFor({ state: 'visible' });
  const sample = await locator.evaluate(element => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      layers.unshift({ color: style.backgroundColor, gradient: style.backgroundImage === 'none' ? [] : style.backgroundImage.match(/rgba?\([^)]+\)/g) || [] });
    }
    return { foreground: getComputedStyle(element).color, layers };
  });
  let backgrounds = [[255, 255, 255, 1]];
  for (const layer of sample.layers) {
    backgrounds = backgrounds.map(background => blend(rgb(layer.color), background));
    if (layer.gradient.length) backgrounds = backgrounds.flatMap(background => layer.gradient.map(stop => blend(rgb(stop), background)));
  }
  const ratio = Math.min(...backgrounds.map(background => contrastRatio(blend(rgb(sample.foreground), background), background)));
  contrasts.push({ label, ratio: Number(ratio.toFixed(2)) });
  assert.ok(ratio >= 4.5, `${label} must have at least 4.5:1 text contrast (actual ${ratio.toFixed(2)}).`);
}
async function noOverflow(page, label) {
  const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    ...(document.documentElement.scrollWidth <= innerWidth ? {} : { offenders: Array.from(document.body.querySelectorAll('*')).filter(element => element instanceof HTMLElement && element.getBoundingClientRect().width > 0 && (element.getBoundingClientRect().right > innerWidth + .5 || element.getBoundingClientRect().left < -.5)).map(element => { const box = element.getBoundingClientRect(); return { tag: element.tagName, className: element.className, left: box.left, right: box.right }; }).slice(0, 12) }) }));
  viewports.push({ label, ...geometry });
  assert.ok(geometry.scrollWidth <= geometry.width, `${label} must fit the viewport.`);
}
async function logoLoaded(page, label) {
  const logos = page.locator('img[src*="strideeco-wordmark.png"]');
  assert.ok(await logos.count() > 0, `${label} must include the supplied logo.`);
  let visible = 0;
  for (const logo of await logos.all()) {
    if (!await logo.isVisible()) continue;
    visible++;
    const dimensions = await logo.evaluate(async image => { await image.decode(); const box = image.getBoundingClientRect(), owner = image.closest('button,a')?.getBoundingClientRect(); return { width: box.width, height: box.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, insideViewport: box.left >= -1 && box.right <= innerWidth + 1, insideOwner: !owner || (box.left >= owner.left - 1 && box.right <= owner.right + 1) }; });
    assert.ok(dimensions.width >= 72 && dimensions.height >= 18, `${label} logo must remain visible at its rendered size.`);
    assert.ok(dimensions.naturalWidth > 0 && dimensions.naturalHeight > 0);
    assert.ok(dimensions.insideViewport && dimensions.insideOwner, `${label} logo must fit its visible navigation area.`);
    const distortion = dimensions.width / dimensions.height / (dimensions.naturalWidth / dimensions.naturalHeight);
    assert.ok(Math.abs(1 - distortion) < .08, `${label} logo must preserve its aspect ratio.`);
  }
  assert.ok(visible > 0, `${label} must show a loaded logo.`);
}
async function focusVisible(locator, label) {
  await locator.focus();
  await locator.page().keyboard.press('Tab');
  await locator.page().keyboard.press('Shift+Tab');
  assert.equal(await locator.evaluate(element => element === document.activeElement), true, `${label} must keep a reachable keyboard target.`);
  const style = await locator.evaluate(element => { const style = getComputedStyle(element); const box = element.getBoundingClientRect(); return { outline: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor, shadow: style.boxShadow, targetWidth: box.width, targetHeight: box.height }; });
  focusSamples.push({ label, ...style });
  const outline = style.outline !== 'none' && style.width >= 2 && rgb(style.color)[3] > 0;
  const ring = /0px 0px 0px (?:[2-9]|[1-9]\d)(?:\.\d+)?px/.test(style.shadow) && (style.shadow.match(/rgba?\([^)]+\)/g) || []).some(color => rgb(color)[3] > 0);
  assert.ok(outline || ring, `${label} needs a visible keyboard outline or ring.`);
  assert.ok(style.targetWidth >= 24 && style.targetHeight >= 24, `${label} needs a usable target size.`);
}
async function decodedQr(page) {
  const qr = page.getByRole('img', { name: 'One-time water voucher QR code', exact: true });
  await qr.waitFor(); await qr.evaluate(image => image.decode());
  const png = await qr.screenshot();
  const raster = await page.evaluate(async source => {
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  }, `data:image/png;base64,${png.toString('base64')}`);
  const decoded = jsQR(new Uint8ClampedArray(raster.pixels), raster.width, raster.height, { inversionAttempts: 'dontInvert' });
  assert.ok(decoded, 'The recolored rendered QR must be independently scannable.');
  return decoded.data;
}
async function responseFor(page, action, activate) {
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/pilot' && response.request().method() === 'POST' && response.request().postDataJSON()?.action === action);
  await activate(); return response;
}

(async () => {
  const target = /^http:\/\/localhost:(\d+)$/.exec(base);
  if (!target || Number(target[1]) < 1 || Number(target[1]) > 65535 || !process.env.STRIDEECO_TEST_EMAIL ||
      !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_') || !process.env.TURSO_DATABASE_URL?.startsWith('file:')) throw new Error('Use verify-clerk --branding-only with its isolated local fixture.');
  await clerkSetup();
  const browser = await chromium.launch({ headless: true, ...(process.env.STRIDEECO_BROWSER_EXECUTABLE ? { executablePath: process.env.STRIDEECO_BROWSER_EXECUTABLE } : {}) });
  try {
    const surfaces = [];
    for (const [name, options] of [['desktop', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
      const context = await browser.newContext({ ...options, reducedMotion: 'reduce' }), page = await context.newPage(); activePage = page;
      page.on('pageerror', error => browserErrors.push({ surface: name, name: error.name }));
      await setupClerkTestingToken({ page });
      surfaces.push({ name, context, page });
      stage = `${name} public planner branding`;
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Your next little escape.', exact: true }).waitFor();
      await logoLoaded(page, name);
      for (const selector of ['.page-heading h1', '.page-subtitle', '.planner-panel .panel-title p', '.field-label', '.selected-route-summary h2', '.route-option.selected .route-option-top strong', '.location-input select']) await readable(page.locator(selector).first(), `${name} planner ${selector}`);
      await readable(page.getByRole('button', { name: 'Let’s get moving', exact: true }), `${name} primary action`);
      await focusVisible(page.getByRole('button', { name: 'Zoom in', exact: true }).first(), `${name} map zoom`);
      await noOverflow(page, `${name} planner`);
      await page.screenshot({ path: `outputs/branding-${name}-planner.png`, fullPage: true });
      const navigation = page.locator(name === 'mobile' ? '.mobile-nav' : '.desktop-nav');
      await navigation.getByRole('button', { name: name === 'mobile' ? 'Rewards' : 'Water rewards', exact: true }).click();
      await page.getByRole('heading', { name: 'Your points wallet', exact: true }).waitFor();
      for (const selector of ['.page-heading h1', '.reward-feature h2', '.reward-feature p', '.wallet-number', '.wallet-footnote', '.machine-disclosure', '.machine-reference', '.machine-card strong', '.machine-tools select']) await readable(page.locator(selector).first(), `${name} rewards ${selector}`);
      assert.equal(await page.locator('.machine-map-pin').count(), 6);
      const pin = page.locator('.machine-map-pin').first(); await pin.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      const halo = await pin.locator('.machine-pin-halo').evaluate(element => ({ stroke: getComputedStyle(element).stroke, width: parseFloat(getComputedStyle(element).strokeWidth), target: element.getBoundingClientRect().width }));
      assert.ok(halo.stroke !== 'transparent' && halo.stroke !== 'none' && rgb(halo.stroke)[3] > 0 && halo.width >= 3 && halo.target >= 43, `${name} marker needs a visible focus ring and 44px hit target.`);
      await noOverflow(page, `${name} water map`);
      await page.screenshot({ path: `outputs/branding-${name}-rewards.png`, fullPage: true });
      for (const route of ['sign-in', 'sign-up']) {
        stage = `${name} ${route} branding`;
        await page.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.cl-card').waitFor();
        await logoLoaded(page, `${name} ${route}`);
        await readable(page.locator('.cl-formButtonPrimary').first(), `${name} ${route} primary action`);
        await readable(page.locator('.cl-formFieldInput').first(), `${name} ${route} input`);
        await readable(page.locator('.cl-headerTitle').first(), `${name} ${route} heading`);
        await focusVisible(page.locator('.cl-formFieldInput').first(), `${name} ${route} input`);
        await noOverflow(page, `${name} ${route}`);
        await page.screenshot({ path: `outputs/branding-${name}-${route}.png`, fullPage: true });
      }
      checks.push(`${name}: public logo, planner, mock machine map, auth forms, text contrast, focus and viewport fit`);
    }
    for (const width of [320, 768, 1024]) {
      stage = `${width}px responsive navigation and logo`;
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(width === 320 ? { isMobile: true, hasTouch: true } : {}) });
      const page = await context.newPage(); activePage = page;
      page.on('pageerror', error => browserErrors.push({ surface: `${width}px`, name: error.name }));
      await setupClerkTestingToken({ page });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Your next little escape.', exact: true }).waitFor();
      await logoLoaded(page, `${width}px planner`); await noOverflow(page, `${width}px planner`);
      await page.screenshot({ path: `outputs/branding-${width}-planner.png`, fullPage: true });
      await page.locator(width === 320 ? '.mobile-nav' : '.desktop-nav').getByRole('button', { name: width === 320 ? 'Rewards' : 'Water rewards', exact: true }).click();
      await page.getByRole('heading', { name: 'Your points wallet', exact: true }).waitFor();
      await logoLoaded(page, `${width}px rewards`); await noOverflow(page, `${width}px rewards`);
      await page.screenshot({ path: `outputs/branding-${width}-rewards.png`, fullPage: true });
      checks.push(`${width}px: public planner/rewards logo fits navigation and no horizontal overflow`);
      await context.close();
    }
    const { page, context } = surfaces[0]; activePage = page;
    stage = 'favicon metadata and actual asset loading';
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    for (const [filename, type, size] of [['strideeco-wordmark.png', 'image/png', null], ['strideeco-monogram.png', 'image/png', 512], ['favicon.png', 'image/png', 32], ['apple-touch-icon.png', 'image/png', 180]]) {
      let source = `${base}/${filename}`;
      if (filename !== 'strideeco-wordmark.png') {
        const declared = page.locator(`link[href^="/${filename}"]`);
        assert.ok(await declared.count() > 0, `${filename} must be declared in metadata.`);
        source = new URL(await declared.first().getAttribute('href'), base).href;
        assert.equal(new URL(source).origin, base);
        if (size) assert.ok(await page.locator(`link[href^="/${filename}"][sizes="${size}x${size}"]`).count() > 0);
      }
      const response = await context.request.get(source);
      assert.equal(response.status(), 200); assert.ok(response.headers()['content-type']?.includes(type));
      const image = await page.evaluate(async source => { const image = new Image(); image.src = source; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }, source);
      assert.ok(image.width > 0 && image.height > 0);
      if (size) assert.deepEqual(image, { width: size, height: size });
      assets.push({ filename, requestPath: new URL(source).pathname + new URL(source).search, type, ...image });
    }
    checks.push('Selected wordmark and SE 512px/32px PNG/180px Apple icons fetch, decode and match metadata');
    stage = 'authenticated voucher appearance';
    await clerk.signIn({ page, emailAddress: process.env.STRIDEECO_TEST_EMAIL });
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.avatar').waitFor();
    await page.getByRole('button', { name: /The scenic alternative/ }).click();
    await page.locator('.desktop-nav').getByRole('button', { name: 'My activity', exact: true }).click();
    const activity = await responseFor(page, 'activity', () => page.getByRole('button', { name: 'Try a demo walk', exact: true }).click());
    assert.equal(activity.status(), 200); await page.getByRole('heading', { name: 'Look at you go.', exact: true }).waitFor();
    await page.locator('.desktop-nav').getByRole('button', { name: 'Water rewards', exact: true }).click();
    const reserved = await responseFor(page, 'reserve-water', () => page.getByRole('button', { name: 'Redeem drinking water', exact: true }).click());
    assert.equal(reserved.status(), 200);
    const state = await reserved.json(), voucher = state.redemptions.find(voucher => voucher.id === state.redemptionId);
    assert.ok(voucher);
    const expected = `strideeco:water:v1:${voucher.id}:${voucher.token}`;
    for (const surface of surfaces) {
      activePage = surface.page;
      if (surface.name === 'mobile') {
        await surface.page.goto(base, { waitUntil: 'domcontentloaded' });
        await clerk.signIn({ page: surface.page, emailAddress: process.env.STRIDEECO_TEST_EMAIL });
        await surface.page.reload({ waitUntil: 'domcontentloaded' }); await surface.page.locator('.avatar').waitFor();
        await surface.page.locator('.mobile-nav').getByRole('button', { name: 'Rewards', exact: true }).click();
        await surface.page.locator('.redemption-row').filter({ hasText: 'Open voucher' }).click();
      }
      await surface.page.getByRole('heading', { name: 'Your water voucher is ready.', exact: true }).waitFor();
      assert.equal(await decodedQr(surface.page), expected);
      for (const selector of ['.voucher-modal h2', '.voucher-modal > p', '.voucher-code', '.voucher-field select', '.simulator-actions .button.primary']) await readable(surface.page.locator(selector).first(), `${surface.name} voucher ${selector}`);
      await noOverflow(surface.page, `${surface.name} voucher`);
      await surface.page.screenshot({ path: `outputs/branding-${surface.name}-voucher.png`, fullPage: false });
      const close = surface.page.getByRole('button', { name: 'Close redemption', exact: true });
      await focusVisible(close, `${surface.name} voucher close`);
      await surface.page.keyboard.press('Tab');
      assert.equal(await surface.page.evaluate(() => Boolean(document.activeElement?.closest('.voucher-modal'))), true);
      checks.push(`${surface.name}: recolored rendered QR independently decoded, voucher contrast, focus and viewport fit`);
    }
    activePage = page;
    const released = await responseFor(page, 'resolve-water', () => page.getByRole('button', { name: 'Simulate machine failure', exact: true }).click());
    assert.equal(released.status(), 200); assert.equal((await released.json()).wallet.reserved, 0);
    assert.deepEqual(browserErrors, []);
    report({ passed: true, status: 'passed', completedAt: new Date().toISOString() });
    console.log('PASS: desktop/mobile brand assets, key text contrast, focus, responsive layouts and independently decoded QR.');
  } catch (error) {
    await activePage?.screenshot({ path: 'outputs/branding-browser-failure.png', fullPage: true }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => {
  const sourceFrame = error.stack?.match(/tests[\\/]browser-branding\.cjs:\d+:\d+/)?.[0];
  report({ passed: false, status: 'failed', completedAt: new Date().toISOString(), failedCheck: stage, errorType: error.name, sourceFrame });
  console.error(`FAIL: ${stage} (${error.name}) ${sourceFrame || ''}. See branding report and screenshot.`);
  process.exitCode = 1;
});
