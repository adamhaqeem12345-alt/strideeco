import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { requireIsolatedVerification, testSession } from './test-session.mjs';
import { createClient } from '@libsql/client';

requireIsolatedVerification();
const require = createRequire(import.meta.url);
const geo = require('../work/geo.cjs');
const base = process.env.STRIDEECO_TEST_URL || 'http://localhost:5187';
const cookie = testSession('user_api_runner');
const other = testSession('user_api_other');
const request = async (path, options = {}) => {
  try {
    return await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
  } catch (error) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${options.headers?.Authorization ? 'signed session' : 'anonymous'} request).`, { cause: error });
  }
};
const get = (path = '/api/pilot', identity = cookie) => request(path, { headers: identity ? { Authorization: `Bearer ${identity}` } : {} });
const post = (data, identity = cookie, origin = base) => request('/api/pilot', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(identity ? { Authorization: `Bearer ${identity}` } : {}) }, body: JSON.stringify(data) });
const state = async identity => { const r = await get('/api/pilot', identity); assert.equal(r.status, 200); return r.json(); };
const ok = async data => { const r = await post(data); const body = await r.json(); assert.equal(r.status, 200, JSON.stringify(body)); return body; };
const checks = [];
const reportPath = 'outputs/vercel-api-report.json';
const startedAt = new Date().toISOString();
const limits = ['Ephemeral locally signed tokens verified by Clerk SDK, not a live Clerk sign-up or OAuth round trip', 'Local libSQL file, not a remote production database', 'No physical GPS or live vending hardware'];
const report = extra => writeFile(reportPath, JSON.stringify({ startedAt, target: base, checks, limits, ...extra }, null, 2));
await mkdir('outputs', { recursive: true });
await report({ passed: false, status: 'running' });

try {
console.log('Checking Clerk API session verification...');
assert.equal((await get('/api/pilot', '')).status, 401);
assert.equal((await post({ action: 'consent', value: true }, '')).status, 401);
assert.equal((await request('/api/pilot', { headers: { 'oai-authenticated-user-id': 'spoofed', 'oai-authenticated-user-email': 'test@example.invalid' } })).status, 401);
assert.equal((await request('/api/pilot', { headers: { 'x-clerk-auth-status': 'signed-in', 'x-clerk-auth-token': cookie, 'x-clerk-auth-signature': 'forged' } })).status, 401);
assert.equal((await get('/api/pilot', cookie.slice(0, -8) + 'invalid!')).status, 401);
assert.equal((await get('/api/pilot', testSession('user_api_runner', { exp: Math.floor(Date.now()/1000) - 600 }))).status, 401);
assert.equal((await get('/api/pilot', testSession('user_api_runner', { nbf: Math.floor(Date.now()/1000) + 600 }))).status, 401);
assert.equal((await post({ action: 'consent', value: true }, cookie, 'https://other.invalid')).status, 403);
checks.push('Clerk SDK verifies ephemeral RSA sessions; anonymous, forged, expired and future tokens rejected; spoofed identity/auth headers and cross-origin writes rejected');

const settings = { distance: 3, date: '2026-10-22', time: '17:30', origin: geo.places[0].coordinate, scenario: false, height: 6, preference: 'balanced', mode: 'loop' };
const route = geo.makeRoutes(settings).sort((a,b) => b.distance - a.distance)[0];
const saved = await ok({ action: 'save-route', name: 'API test route', nodeIds: route.nodeIds, settings, userId: 'clerk:user_api_other' });
assert.equal(saved.routes.length, 1);
assert.equal((await state(cookie)).routes[0].id, saved.savedId);
assert.equal((await state(other)).routes.length, 0);
await post({ action: 'delete-route', id: saved.savedId }, other);
assert.equal((await state(cookie)).routes.length, 1);
assert.equal((await post({ action: 'share-route', id: saved.savedId }, other)).status, 404);
await ok({ action: 'share-route', id: saved.savedId });
const shared = await get('/api/pilot?shared=' + saved.savedId, ''); assert.equal(shared.status, 200);
assert.equal((await shared.json()).route.name, 'API test route');
checks.push('route persistence, account isolation and explicitly public route sharing');

const activity = { action: 'activity', source: 'demo', key: 'api-test-activity-0001', nodeIds: route.nodeIds };
const credited = await ok(activity); assert.ok(credited.wallet.points >= 60);
assert.equal(credited.activities[0].source, 'demo');
assert.equal((await ok(activity)).wallet.points, credited.wallet.points);
checks.push('labelled demo activity credits once through the libSQL adapter');

const held = await ok({ action: 'reserve-water', key: 'api-water-failure-0001' });
assert.equal(held.wallet.reserved, 60);
assert.equal((await post({ action: 'resolve-water', id: held.redemptions[0].id, token: held.redemptions[0].token, result: 'dispensed' }, other)).status, 404);
assert.equal((await state(cookie)).wallet.reserved, 60);
assert.equal((await state(other)).wallet.points, 0);
assert.equal((await ok({ action: 'reserve-water', key: 'api-water-failure-0001' })).redemptions[0].token, held.redemptions[0].token);
assert.equal((await post({ action: 'reserve-water', key: 'api-water-overspend-0001' })).status, 409);
const released = await ok({ action: 'resolve-water', id: held.redemptions[0].id, token: held.redemptions[0].token, result: 'failed' });
assert.equal(released.wallet.reserved, 0); assert.equal(released.wallet.points, credited.wallet.points);
const second = await ok({ action: 'reserve-water', key: 'api-water-success-0001' });
const code = second.redemptions.find(r => r.id === 'api-water-success-0001');
const confirmation = { action: 'resolve-water', id: code.id, token: code.token, result: 'dispensed' };
const confirmed = await ok(confirmation);
assert.equal(confirmed.wallet.points, credited.wallet.points - 60); assert.equal(confirmed.wallet.reserved, 0);
assert.equal((await ok(confirmation)).wallet.points, confirmed.wallet.points);
checks.push('reservation idempotency, overspend protection, failed dispense release and single confirmation deduction');

await ok({ ...activity, key: 'api-test-activity-0002' });
await ok({ action: 'reserve-water', key: 'api-water-expiry-0001' });
const db = createClient({ url: process.env.TURSO_DATABASE_URL });
await db.execute("UPDATE redemptions SET expires_at='2000-01-01T00:00:00Z' WHERE id='api-water-expiry-0001'");
db.close();
assert.equal((await state(cookie)).wallet.reserved, 0);
const before = (await state(cookie)).wallet.points;
const now = Date.now();
const invalid = await post({ action: 'activity', source: 'gps', key: 'api-invalid-gps-0001', positions: [{ lon:101.513, lat:3.179, time:now-10000, accuracy:5 }, { lon:102.5, lat:4.1, time:now-9000, accuracy:5 }] });
assert.equal(invalid.status, 400); assert.equal((await state(cookie)).wallet.points, before);
checks.push('expired reservation release and implausible GPS rejection without credit');
await report({ passed: true, status: 'passed', completedAt: new Date().toISOString() });
console.log('PASS: Next.js production API, Clerk session verification and libSQL accounting');
} catch (error) {
  await report({ passed: false, status: 'failed', completedAt: new Date().toISOString(), error: error.message });
  throw error;
}
