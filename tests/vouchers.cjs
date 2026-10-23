const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, mkdtempSync } = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { voucherQrPayload, parseVoucherPayload, normalizeVoucherCode, formatVoucherCode } = require('../work/vouchers.cjs');
const migrations = ['0000_condemned_firestar.sql', '0001_wallet_accounting.sql', '0002_clerk_identities.sql', '0003_machine_water_vouchers.sql'];
const machineId = 'mock-central-ambient';
const alternateMachineId = 'mock-central-chilled';
const token = '0123456789ABCDEF0123456789ABCDEF';
const sql = name => readFileSync(path.join(__dirname, '..', 'drizzle', name), 'utf8');

async function fixture(t, points = 180) {
  const directory = mkdtempSync(path.join(tmpdir(), 'strideeco-voucher-handler-'));
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  process.env.TURSO_DATABASE_URL = `file:${path.join(directory, 'test.db')}`;
  process.env.TURSO_AUTH_TOKEN = '';
  const modulePath = require.resolve('../work/pilot-voucher-api.cjs');
  delete require.cache[modulePath];
  const api = require(modulePath);
  const db = api.databaseClient();
  for (const name of migrations) await db.executeMultiple(sql(name));
  await db.execute({ sql: 'INSERT INTO wallets(user_id,points) VALUES(?,?)', args: ['owner', points] });
  const post = (body, user = 'owner') => api.userContext.run(user, () => api.POST(new Request('http://localhost:5187/api/pilot', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5187' }, body: JSON.stringify(body) })));
  const state = async (user = 'owner') => {
    const result = await api.userContext.run(user, () => api.GET(new Request('http://localhost:5187/api/pilot')));
    assert.equal(result.status, 200); return result.json();
  };
  const reserve = async (key = 'voucher-request-one', station = machineId) => {
    const result = await post({ action: 'reserve-water', key, machineId: station });
    assert.equal(result.status, 200, await result.clone().text());
    const body = await result.json(); return body.redemptions.find(row => row.id === key);
  };
  t.after(() => {
    db.close();
    if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL; else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.TURSO_AUTH_TOKEN; else process.env.TURSO_AUTH_TOKEN = previousToken;
  });
  return { api, db, post, state, reserve };
}
const manual = voucher => ({ action: 'resolve-water', id: voucher.id, token: formatVoucherCode(voucher.token), machineId, result: 'dispensed' });
const scanned = voucher => ({ action: 'consume-voucher', payload: voucherQrPayload(voucher), machineId, result: 'dispensed' });

test('manual formatting and QR carry exactly the same128bit credential; malformed payloads fail closed', () => {
  const voucher = { id: 'voucher-request-one', token };
  assert.equal(formatVoucherCode(token), '0123-4567-89AB-CDEF-0123-4567-89AB-CDEF');
  assert.equal(normalizeVoucherCode('0123 4567 89ab cdef 0123 4567 89ab cdef'), token);
  assert.deepEqual(parseVoucherPayload(voucherQrPayload(voucher)), voucher);
  for (const value of [null, '', 'https://example.invalid/' + token, voucherQrPayload(voucher) + ':extra', voucherQrPayload(voucher).replace(':v1:', ':v2:'), `strideeco:water:v1:${voucher.id}:short`, `strideeco:water:v1:${voucher.id}:${token.toLowerCase()}`]) assert.equal(parseVoucherPayload(value), null);
  for (const value of ['', 'F'.repeat(31), 'G'.repeat(32), token + '%00', {}, ' '.repeat(81) + token]) assert.equal(normalizeVoucherCode(value), null);
});

test('additive voucher migration preserves legacy wallets and history with unassigned nullable machine fields', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of migrations.slice(0, -1)) db.exec(sql(name));
    db.exec("INSERT INTO wallets(user_id,points) VALUES('legacy',120); INSERT INTO redemptions VALUES('legacy-voucher','legacy',60,'ABCDEF1234','pending','2099-01-01T00:00:00Z','2026-10-22T00:00:00Z')");
    const before = db.prepare("SELECT points,reserved FROM wallets WHERE user_id='legacy'").get();
    db.exec(sql(migrations.at(-1)));
    assert.deepEqual(db.prepare("SELECT points,reserved FROM wallets WHERE user_id='legacy'").get(), before);
    const historical = db.prepare("SELECT * FROM redemptions WHERE id='legacy-voucher'").get();
    assert.equal(historical.token, 'ABCDEF1234'); assert.equal(historical.machine_id, null); assert.equal(historical.redeemed_at, null);
    assert.throws(() => db.prepare("UPDATE redemptions SET status='confirmed',redeemed_at=? WHERE id='legacy-voucher'").run(new Date().toISOString()), /INVALID_VOUCHER_CONFIRMATION/);
    db.exec("UPDATE redemptions SET status='expired' WHERE id='legacy-voucher'");
    assert.equal(db.prepare("SELECT reserved FROM wallets WHERE user_id='legacy'").get().reserved, 0);
    assert.equal(db.prepare("SELECT points FROM wallets WHERE user_id='legacy'").get().points, 120);
  } finally { db.close(); }
});

test('parallel API issuance at exactly60points creates one reservation; racing manual/QR consumption has one winner', async t => {
  const { post, state, db } = await fixture(t, 60);
  const request = { action: 'reserve-water', key: 'voucher-parallel-key', machineId };
  const issued = await Promise.all(Array.from({ length: 6 }, () => post(request)));
  assert.deepEqual(issued.map(result => result.status), Array(6).fill(200));
  const bodies = await Promise.all(issued.map(result => result.json()));
  const vouchers = bodies.map(body => body.redemptions.find(row => row.id === request.key));
  assert.equal(new Set(vouchers.map(voucher => voucher.token)).size, 1);
  assert.match(vouchers[0].token, /^[A-F0-9]{32}$/);
  assert.equal((await state()).wallet.reserved, 60);
  const claims = await Promise.all(Array.from({ length: 10 }, (_, index) => post(index % 2 ? manual(vouchers[0]) : scanned(vouchers[0]))));
  assert.equal(claims.filter(result => result.status === 200).length, 1);
  assert.equal(claims.filter(result => result.status === 409).length, 9);
  const final = await state();
  assert.deepEqual(final.wallet, { points: 0, reserved: 0 });
  assert.equal(final.redemptions[0].status, 'confirmed'); assert.ok(final.redemptions[0].redeemed_at);
  assert.equal((await db.execute("SELECT COUNT(*) AS n FROM point_events WHERE kind='water_redemption'")).rows[0].n, 1);
});

test('API credentials are owner/machine/type bound and invalid attempts never consume or release points', async t => {
  const { post, state, reserve, api, db } = await fixture(t);
  const voucher = await reserve();
  assert.equal(voucher.machine_id, machineId); assert.equal(voucher.machine_type, 'bottled-ambient');
  assert.equal(voucher.reward_label, api.machines.find(machine => machine.id === machineId).rewardLabel);
  assert.equal((await post(manual(voucher), null)).status, 401);
  assert.equal((await post(scanned(voucher), 'someone-else')).status, 404);
  assert.equal((await post({ ...manual(voucher), machineId: alternateMachineId })).status, 409);
  assert.equal((await post({ ...manual(voucher), token: 'F'.repeat(32) })).status, 404);
  assert.equal((await post({ ...manual(voucher), result: 'anything-else' })).status, 400);
  assert.equal((await post({ ...manual(voucher), machineId: 'invented' })).status, 400);
  const station = api.machines.find(machine => machine.id === machineId);
  station.type = 'refill';
  assert.equal((await post(scanned(voucher))).status, 409);
  station.type = 'bottled-ambient';
  assert.deepEqual((await state()).wallet, { points: 180, reserved: 60 });
  assert.equal((await state()).redemptions[0].status, 'pending');
  await assert.rejects(db.execute({ sql: "UPDATE redemptions SET machine_id=? WHERE id=?", args: [alternateMachineId, voucher.id] }), /IMMUTABLE_WATER_VOUCHER/);
  await assert.rejects(db.execute({ sql: "UPDATE redemptions SET user_id='someone-else' WHERE id=?", args: [voucher.id] }), /IMMUTABLE_WATER_VOUCHER/);
});

test('failed mock dispensing releases once; expired codes return410 and cannot spend; closed vouchers cannot reset', async t => {
  const { post, state, reserve, db } = await fixture(t, 120);
  const failed = await reserve('voucher-failed-key');
  assert.equal((await post({ ...scanned(failed), result: 'failed' })).status, 200);
  assert.equal((await post(manual(failed))).status, 409);
  assert.deepEqual((await state()).wallet, { points: 120, reserved: 0 });
  await assert.rejects(db.execute({ sql: "UPDATE redemptions SET status='pending' WHERE id=?", args: [failed.id] }), /INVALID_VOUCHER_TRANSITION/);
  const expired = await reserve('voucher-expired-key');
  await db.execute({ sql: "UPDATE redemptions SET expires_at='2000-01-01T00:00:00Z' WHERE id=?", args: [expired.id] });
  assert.equal((await post(scanned(expired))).status, 410);
  const final = await state();
  assert.deepEqual(final.wallet, { points: 120, reserved: 0 });
  assert.equal(final.redemptions.find(row => row.id === expired.id).status, 'expired');
  assert.equal(final.events.length, 0);
});

test('missing account storage returns explicit503 without a fabricated wallet or signed-out authentication bypass', async t => {
  const { api, post, db } = await fixture(t);
  delete process.env.TURSO_DATABASE_URL;
  assert.throws(() => api.databaseClient(), error => error.name === 'DatabaseConfigurationError');
  const result = await api.userContext.run('owner', () => api.GET(new Request('http://localhost:5187/api/pilot')));
  assert.equal(result.status, 503);
  const body = await result.json();
  assert.equal(body.code, 'ACCOUNT_STORAGE_NOT_CONFIGURED');
  assert.equal('wallet' in body, false);
  const mutation = await post({ action: 'consent', value: true });
  assert.equal(mutation.status, 503);
  assert.equal((await mutation.json()).code, 'ACCOUNT_STORAGE_NOT_CONFIGURED');
  assert.equal((await post({ action: 'consent', value: true }, null)).status, 401);
  assert.equal((await api.userContext.run(null, () => api.GET(new Request('http://localhost:5187/api/pilot')))).status, 401);
  assert.deepEqual((await db.execute("SELECT points,reserved FROM wallets WHERE user_id='owner'")).rows[0], { points: 180, reserved: 0 });
});

test('hosted file storage is refused before any account mutation with the same safe503 code', async t => {
  const { api, post, db } = await fixture(t);
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    assert.throws(() => api.databaseClient(), error => error.name === 'DatabaseConfigurationError');
    const result = await api.userContext.run('owner', () => api.GET(new Request('http://localhost:5187/api/pilot')));
    assert.equal(result.status, 503);
    assert.equal((await result.json()).code, 'ACCOUNT_STORAGE_NOT_CONFIGURED');
    const mutation = await post({ action: 'consent', value: true });
    assert.equal(mutation.status, 503);
    assert.equal((await mutation.json()).code, 'ACCOUNT_STORAGE_NOT_CONFIGURED');
    assert.deepEqual((await db.execute("SELECT points,reserved FROM wallets WHERE user_id='owner'")).rows[0], { points: 180, reserved: 0 });
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
  }
});
