const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

// Run as a child of the existing isolated RSA/file-database server fixture.
// This mounts the actual application component; only Next's navigation and
// dynamic-loader adapters are replaced. Unused account controls throw if rendered.
// Application API requests still pass
// through the real Clerk SDK signature verification and local SQL handlers.
const repo = path.resolve(__dirname, '..');
const base = (process.env.STRIDEECO_TEST_URL || '').replace(/\/$/, '');
const reportFile = path.join(repo, 'outputs/browser-prototype-report.json');
const report = {
  passed: false, startedAt: new Date().toISOString(), checks: [], browserErrors: [],
  limits: [
    'The actual StrideApp component runs in a scratch browser fixture; Next navigation/dynamic loading use test adapters. Unused account controls are a throw-if-rendered adapter because authAvailable=false; auth UI is not tested here.',
    'Signed-in is an explicit component prop, while actual local API requests use an ephemeral RSA token verified by Clerk SDK. This does not verify the Clerk browser sign-in flow.',
    'Only a fresh file database and the pre-mapped local user_api_runner identity are used. No real account is created and no production data is accessed.',
    'Progress boundary examples directly render the actual PointsProgress component; they do not seed or change any wallet.',
    'Demo activity, water locations, dispensing and sample township insights remain illustrative.'
  ]
};
const save = () => { fs.mkdirSync(path.dirname(reportFile), { recursive: true }); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); };
const check = text => report.checks.push(text);

async function run() {
  const session = await import(pathToFileURL(path.join(repo, 'tests/test-session.mjs')).href);
  session.requireIsolatedVerification();
  assert.equal(base, 'http://localhost:5187');
  const token = session.testSession('user_api_runner');
  const { build } = require(path.join(repo, 'node_modules/esbuild'));
  const { chromium } = require(process.env.STRIDEECO_PLAYWRIGHT || 'playwright');
  const htmlResponse = await fetch(base, { redirect: 'manual' });
  assert.equal(htmlResponse.status, 200, 'The already-started local server must be ready.');
  const html = await htmlResponse.text();
  const cssHrefs = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0])
    .filter(tag => /rel=["']stylesheet["']/.test(tag))
    .map(tag => /href=["']([^"']+)/.exec(tag)?.[1]).filter(Boolean)
    .map(href => new URL(href, base)).filter(url => url.origin === base);
  assert.ok(cssHrefs.length, 'Use the real production-build stylesheet.');
  let appCss = '';
  for (const url of cssHrefs) {
    const response = await fetch(url); assert.equal(response.status, 200);
    appCss += await response.text();
  }
  const built = await build({
    absWorkingDir: repo, bundle: true, write: false, platform: 'browser',
    format: 'iife', target: 'es2022', jsx: 'automatic', outdir: '__scratch_fixture__',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    loader: { '.css': 'local-css' },
    stdin: {
      resolveDir: repo, loader: 'tsx', sourcefile: 'prototype-fixture.tsx',
      contents: `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { flushSync } from 'react-dom';
        import StrideApp from './components/stride-app';
        import PointsProgress from './components/points-progress';
        const root = createRoot(document.getElementById('fixture'));
        let revision = 0;
        window.__renderPrototype = signedIn => flushSync(() => root.render(<StrideApp key={++revision} signedIn={signedIn} authAvailable={false} signInPath="/sign-in" signOutPath="/signout"/>));
        window.__renderProgress = props => flushSync(() => root.render(<PointsProgress key={++revision} {...props}/>));
        window.__renderPrototype(false);`
    },
    plugins: [{ name: 'scratch-next-adapters', setup(builder) {
      builder.onResolve({ filter: /account-controls$/ }, args => args.importer.replace(/\\/g, '/').endsWith('/components/stride-app.tsx')
        ? { path: 'unused-account-controls', namespace: 'scratch-account-controls' } : null);
      builder.onLoad({ filter: /.*/, namespace: 'scratch-account-controls' }, () => ({ loader: 'js',
        contents: 'export function AccountControls(){throw new Error("The scratch fixture must not render Clerk account controls")} export const ProfileControls=AccountControls;'
      }));
      builder.onResolve({ filter: /^next\/(navigation|dynamic)$/ }, args => ({ path: args.path, namespace: 'scratch-next-adapters' }));
      builder.onLoad({ filter: /.*/, namespace: 'scratch-next-adapters' }, args => ({
        resolveDir: repo, loader: 'js', contents: args.path.endsWith('/navigation')
          ? 'export function useRouter(){return {push:url=>window.location.assign(url),replace:url=>window.location.replace(url),refresh:()=>window.location.reload()}}'
          : 'import React from "react"; export default function dynamic(load){const Component=React.lazy(load);return function Dynamic(props){return React.createElement(React.Suspense,{fallback:null},React.createElement(Component,props))}}'
      }));
    } }]
  });
  const javascript = built.outputFiles.find(file => file.path.endsWith('.js'))?.text;
  const fixtureCss = built.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
  assert.ok(javascript, 'The actual component must bundle successfully.');
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.STRIDEECO_BROWSER_EXECUTABLE ? { executablePath: process.env.STRIDEECO_BROWSER_EXECUTABLE } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => report.browserErrors.push(error.message));
    await context.route(base + '/api/pilot**', route => route.continue({ headers: { ...route.request().headers(), authorization: `Bearer ${token}` } }));
    await context.route(base + '/__prototype-fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: javascript }));
    await context.route(base + '/__prototype-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + appCss + '\n' + fixtureCss + '</style></head><body><div id="fixture"></div><script src="/__prototype-fixture.js"></script></body></html>' }));
    await page.goto(base + '/__prototype-fixture', { waitUntil: 'domcontentloaded' });
    const pace = () => page.getByRole('navigation', { name: 'PACE journey', exact: true });
    const activeStep = async name => {
      await pace().getByRole('button', { name, exact: true }).waitFor();
      await page.waitForFunction(({ name }) => [...document.querySelectorAll('nav[aria-label="PACE journey"] button')].some(button => button.getAttribute('aria-label') === name && button.getAttribute('aria-current') === 'step'), { name });
      assert.equal(await pace().locator('[aria-current="step"]').count(), 1);
    };
    const fit = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label + ' has no horizontal overflow');
    const renderApp = async signedIn => {
      await page.evaluate(value => window.__renderPrototype(value), signedIn);
      await activeStep('Plan');
      if (signedIn) await page.waitForFunction(() => !document.querySelector('[data-account-status]'));
    };
    const state = async () => page.evaluate(async () => {
      const response = await fetch('/api/pilot');
      if (!response.ok) throw Error('Local fixture API state must return 200.');
      return response.json();
    });
    const mutation = async (action, activate) => {
      const waiting = page.waitForResponse(response => new URL(response.url()).origin === base && new URL(response.url()).pathname === '/api/pilot' && response.request().method() === 'POST' && response.request().postDataJSON()?.action === action);
      await activate(); const response = await waiting;
      assert.equal(response.status(), 200, `The real local ${action} action must succeed.`);
      return response.json();
    };

    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await renderApp(false);
      assert.deepEqual(await pace().getByRole('button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), ['Plan', 'Act', 'Collect', 'Exchange']);
      const summary = page.locator('summary').filter({ hasText: 'Shade & sun settings' });
      const details = summary.locator('..');
      assert.equal(await details.evaluate(element => element.open), false, 'Advanced settings start collapsed.');
      await summary.click();
      await page.getByRole('checkbox', { name: 'Enable assumed-height shade scenario' }).check();
      await page.getByLabel('Assumed building height', { exact: true }).selectOption('9');
      assert.match(await page.locator('.route-shade').first().innerText(), /scenario/);
      await summary.click(); assert.equal(await details.evaluate(element => element.open), false);
      await summary.click(); assert.equal(await page.getByLabel('Assumed building height', { exact: true }).inputValue(), '9');
      await summary.click();
      await pace().getByRole('button', { name: 'Collect', exact: true }).click(); await activeStep('Collect');
      await page.getByRole('heading', { name: 'Every step adds up.', exact: true }).first().waitFor();
      assert.equal(await page.getByRole('progressbar', { name: 'Points toward a water reward' }).count(), 0, 'Signed-out visitors do not receive fabricated account progress.');
      await pace().getByRole('button', { name: 'Exchange', exact: true }).click(); await activeStep('Exchange');
      const directory = page.getByRole('region', { name: 'Mock township water machines', exact: true });
      await directory.waitFor();
      assert.equal(await directory.locator('.machine-map-pin').count(), 6);
      for (const value of ['bottled-ambient', 'bottled-chilled', 'refill']) {
        await page.getByLabel('Water machine type', { exact: true }).selectOption(value);
        const pins = directory.locator('.machine-map-pin'); assert.equal(await pins.count(), 2);
        assert.equal(await pins.first().getAttribute('role'), 'button');
        assert.match(await pins.first().getAttribute('aria-label'), /Mock location/i);
        const pin = pins.last(); await pin.focus(); await pin.press('Enter');
        assert.equal(await pin.getAttribute('aria-pressed'), 'true');
        await pins.first().focus(); await pins.first().press('Space');
        assert.equal(await pins.first().getAttribute('aria-pressed'), 'true');
        const geometry = await pin.evaluate(element => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height }; });
        assert.ok(geometry.width >= 43 && geometry.height >= 43, 'Machine markers retain approximately44px targets.');
      }
      await page.getByRole('button', { name: 'View sample township insights', exact: true }).first().click();
      await page.getByText('Sample data', { exact: true }).first().waitFor();
      assert.match(await page.locator('main').innerText(), /sample|illustrative/i);
      await fit(`${width}px sample insights`);
      check(`${width}px: accessible PACE navigation, collapsed shade settings retaining values, all machine filters/keyboard selections/targets, explicitly labelled sample insights and viewport fit`);
    }

    await page.setViewportSize({ width: 1440, height: 1000 }); await renderApp(true);
    const before = await state();
    assert.deepEqual(before.wallet, { points: 0, reserved: 0 }, 'Run this journey against a fresh local database before API accounting tests.');
    assert.equal(before.routes.length, 0); assert.equal(before.activities.length, 0); assert.equal(before.redemptions.length, 0);
    await page.getByRole('button', { name: /The scenic alternative/ }).click();
    await mutation('save-route', () => page.getByRole('button', { name: 'Save', exact: true }).click());
    await page.getByRole('button', { name: 'Continue to activity', exact: true }).first().click(); await activeStep('Act');
    const credited = await mutation('activity', () => page.getByRole('button', { name: 'Try a demo walk', exact: true }).click());
    await activeStep('Collect');
    await page.getByRole('heading', { name: 'Every step adds up.', exact: true }).first().waitFor();
    assert.equal(credited.activities.length, 1); assert.equal(credited.activities[0].source, 'demo');
    assert.equal(credited.wallet.points, 71); assert.equal(credited.wallet.reserved, 0);
    await page.getByRole('button', { name: 'Choose a water stop', exact: true }).first().click(); await activeStep('Exchange');
    await page.getByLabel('Water machine type', { exact: true }).selectOption('bottled-chilled');
    await page.locator('.machine-map-pin[data-machine-id="mock-central-chilled"]').click();
    const reserved = await mutation('reserve-water', () => page.getByRole('button', { name: 'Redeem drinking water', exact: true }).click());
    assert.equal(reserved.wallet.reserved, 60);
    await page.getByRole('img', { name: 'One-time water voucher QR code', exact: true }).waitFor();
    const used = await mutation('consume-voucher', () => page.getByRole('button', { name: 'Simulate QR scan', exact: true }).click());
    await page.getByRole('heading', { name: 'A fresh finish.', exact: true }).waitFor();
    assert.equal(used.wallet.points, 11); assert.equal(used.wallet.reserved, 0);
    assert.equal(used.redemptions.filter(item => item.status === 'confirmed').length, 1);
    await page.getByRole('button', { name: 'Close redemption', exact: true }).click();
    await page.locator('.redemption-row').filter({ hasText: 'Used once' }).waitFor();
    check('Actual StrideApp Plan→Act→automatic Collect→Exchange controls save a route, credit one labelled demo, reserve60 and scan one voucher through the real SDK-verified local API; wallet71→11');
    await page.setViewportSize({ width: 390, height: 844 }); await renderApp(true);
    await pace().getByRole('button', { name: 'Collect', exact: true }).click(); await activeStep('Collect');
    const progress = page.getByRole('progressbar', { name: 'Points toward a water reward', exact: true });
    await progress.waitFor(); assert.equal(await progress.getAttribute('aria-valuenow'), '11');
    assert.match(await page.getByText(/Walk another 2\.45 km/).first().innerText(), /49 points/);
    await fit('390px persisted Collect view');
    check('Fresh mobile component mount reloads the real local saved route/wallet and displays the remaining2.45km/49points after redemption');

    // Navigation must not silently reset a live or paused recording. No fake
    // location sample is finished/submitted as an activity.
    const gpsSubmissions = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/pilot' && request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body?.action === 'activity' && body.source === 'gps') gpsSubmissions.push(true);
      }
    });
    await page.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition(success) {
        setTimeout(() => success({ coords: { latitude: 3.1784, longitude: 101.516, accuracy: 5 }, timestamp: Date.now() }), 0);
        return 1;
      },
      clearWatch() {}
    } }));
    await renderApp(true);
    await pace().getByRole('button', { name: 'Act', exact: true }).click();
    await page.getByRole('button', { name: 'Start with location', exact: true }).click();
    await page.locator('.gps-status').filter({ hasText: 'Recording' }).waitFor();
    await pace().getByRole('button', { name: 'Plan', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s get moving', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Start with location', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await pace().getByRole('button', { name: 'Plan', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s get moving', exact: true }).click();
    await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Pause', exact: true }).count(), 0);
    const afterNavigation = await state();
    assert.deepEqual(afterNavigation.wallet, { points: 11, reserved: 0 });
    assert.equal(afterNavigation.activities.length, 1);
    assert.deepEqual(gpsSubmissions, []);
    check('A local fake location starts recording; Plan→planner CTA preserves both recording/Pause and paused/Resume states without submitting or crediting GPS activity');

    const progressCases = [
      { available: 0, text: 'Walk another 3 km', now: '0' },
      { available: 40, text: 'Walk another 1 km', now: '40' },
      { available: 59, text: 'Walk another 50 m', now: '59' },
      { available: 60, text: 'Your next water reward is ready.', now: '60' },
      { available: 71, text: 'Your next water reward is ready.', now: '60' },
      { available: 11, text: 'Walk another 2.45 km', now: '11' }
    ];
    for (const item of progressCases) {
      await page.evaluate(value => window.__renderProgress({ available: value, signedIn: true, status: 'ready', hasAccountData: true }), item.available);
      await page.getByText(item.text, { exact: item.text.endsWith('.') }).first().waitFor();
      assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), item.now);
    }
    for (const props of [
      { available: 40, signedIn: false, status: 'ready', hasAccountData: false },
      { available: 40, signedIn: true, status: 'loading', hasAccountData: false },
      { available: 40, signedIn: true, status: 'unavailable', hasAccountData: true }
    ]) {
      await page.evaluate(value => window.__renderProgress(value), props);
      await page.waitForTimeout(80);
      assert.equal(await page.getByRole('progressbar').count(), 0);
      assert.doesNotMatch(await page.locator('#fixture').innerText(), /40 \/ 60 points|Walk another/);
    }
    check('Actual PointsProgress renders threshold/boundary distances0/40/59/60/71/11 correctly and suppresses invented progress for signed-out/loading/unavailable states');
    assert.deepEqual(report.browserErrors, []);
    report.passed = true;
  } finally { await browser?.close(); }
}

run().catch(error => {
  report.error = { name: error.name, message: error.message.slice(0, 600) };
  process.exitCode = 1;
}).finally(() => {
  report.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, browserErrors: report.browserErrors.length, report: reportFile }));
});
