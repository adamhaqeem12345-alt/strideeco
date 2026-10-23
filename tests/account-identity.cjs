const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createClient } = require('@libsql/client');
const { resolveAccountIdentity, AccountIdentityConflict } = require('../work/account-identity.cjs');

async function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'strideeco-identity-'));
  const client = createClient({ url: `file:${path.join(directory, 'test.db')}` });
  t.after(() => client.close());
  for (const file of ['0000_condemned_firestar.sql', '0001_wallet_accounting.sql', '0002_clerk_identities.sql']) {
    await client.executeMultiple(readFileSync(path.join(__dirname, '..', 'drizzle', file), 'utf8'));
  }
  return client;
}
const identity = (id, accounts = []) => async () => ({ id, externalAccounts: accounts });
const github = (id, status = 'verified') => ({ provider: 'github', providerUserId: id, verification: { status } });
const seedLegacy = async (db, id) => {
  await db.execute({ sql: 'INSERT INTO profiles(user_id,created_at) VALUES(?,?)', args: [`github:${id}`, new Date().toISOString()] });
  await db.execute({ sql: 'INSERT INTO wallets(user_id,points,reserved) VALUES(?,120,0)', args: [`github:${id}`] });
};

test('verified GitHub identity preserves existing wallet, route and accounting ownership', async t => {
  const db = await fixture(t); await seedLegacy(db, '123');
  await db.execute("INSERT INTO saved_routes VALUES('saved','github:123','My route','[]','{}',3000,0,'2026-10-22')");
  await db.execute("INSERT INTO activities VALUES('activity','github:123','demo',3000,2000,60,'legacy-key','2026-10-22')");
  const before = await db.execute("SELECT * FROM wallets WHERE user_id='github:123'");
  const id = await resolveAccountIdentity(db, 'user_123', identity('user_123', [github('123')]));
  assert.equal(id, 'github:123');
  assert.deepEqual((await db.execute({ sql: 'SELECT * FROM wallets WHERE user_id=?', args: [id] })).rows, before.rows);
  assert.equal((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM saved_routes WHERE user_id=?', args: [id] })).rows[0].n, 1);
  assert.equal((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM point_events WHERE user_id=?', args: [id] })).rows[0].n, 1);
  assert.equal(await resolveAccountIdentity(db, 'user_123', async () => { throw Error('Should not need another Clerk lookup'); }), id);
});

test('unverified providers and editable identifiers cannot claim a legacy wallet', async t => {
  const db = await fixture(t); await seedLegacy(db, '123');
  for (const status of ['unverified', 'failed', null]) {
    const user = 'user_' + String(status);
    assert.equal(await resolveAccountIdentity(db, user, identity(user, [github('123', status)])), `clerk:${user}`);
  }
  const user = { id: 'user_metadata', externalId: 'github:123', unsafeMetadata: { userId: 'github:123' }, externalAccounts: [{ provider: 'google', providerUserId: '123', verification: { status: 'verified' } }] };
  assert.equal(await resolveAccountIdentity(db, user.id, async () => user), 'clerk:user_metadata');
  assert.equal((await db.execute("SELECT points FROM wallets WHERE user_id='github:123'")).rows[0].points, 120);
});

test('only canonical numeric GitHub provider IDs match legacy ownership', async t => {
  const db = await fixture(t); await seedLegacy(db, '123');
  for (const [index, providerUserId] of ['', '0', '0123', '-123', '123.0', '1.23e2', '123 ', 'github:123'].entries()) {
    const user = `user_invalid_${index}`;
    assert.equal(await resolveAccountIdentity(db, user, identity(user, [github(providerUserId)])), `clerk:${user}`);
  }
  const user = 'user_oauth_github';
  assert.equal(await resolveAccountIdentity(db, user, identity(user, [{ ...github('123'), provider: 'oauth_github' }])), 'github:123');
  assert.equal((await db.execute("SELECT points FROM wallets WHERE user_id='github:123'")).rows[0].points, 120);
});

test('a mapped application identity stays stable when external accounts change', async t => {
  const db = await fixture(t); await seedLegacy(db, '123');
  const user = 'user_stable';
  assert.equal(await resolveAccountIdentity(db, user, identity(user)), `clerk:${user}`);
  assert.equal(await resolveAccountIdentity(db, user, identity(user, [github('123')])), `clerk:${user}`);
  assert.equal((await db.execute("SELECT COUNT(*) AS n FROM auth_identities WHERE app_user_id='github:123'")).rows[0].n, 0);
  assert.equal((await db.execute("SELECT points FROM wallets WHERE user_id='github:123'")).rows[0].points, 120);
});

test('repeated concurrent requests map one Clerk user only once', async t => {
  const db = await fixture(t);
  const results = await Promise.all(Array.from({ length: 5 }, () => resolveAccountIdentity(db, 'user_race', identity('user_race'))));
  assert.deepEqual([...new Set(results)], ['clerk:user_race']);
  assert.equal((await db.execute('SELECT COUNT(*) AS n FROM auth_identities')).rows[0].n, 1);
});

test('another Clerk account cannot claim an already linked legacy wallet', async t => {
  const db = await fixture(t); await seedLegacy(db, '123');
  await resolveAccountIdentity(db, 'user_owner', identity('user_owner', [github('123')]));
  await assert.rejects(resolveAccountIdentity(db, 'user_other', identity('user_other', [github('123')])), AccountIdentityConflict);
  assert.equal((await db.execute('SELECT COUNT(*) AS n FROM auth_identities')).rows[0].n, 1);
});

test('concurrent competing claims preserve one legacy owner without moving records', async t => {
  const db = await fixture(t); await seedLegacy(db, '123');
  const results = await Promise.allSettled(['user_first', 'user_second'].map(user =>
    resolveAccountIdentity(db, user, identity(user, [github('123')]))));
  const resolved = results.filter(result => result.status === 'fulfilled');
  const rejected = results.filter(result => result.status === 'rejected');
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].value, 'github:123');
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof AccountIdentityConflict);
  assert.equal((await db.execute('SELECT COUNT(*) AS n FROM auth_identities')).rows[0].n, 1);
  assert.equal((await db.execute("SELECT points FROM wallets WHERE user_id='github:123'")).rows[0].points, 120);
});

test('ambiguous legacy accounts fail without combining points or moving records', async t => {
  const db = await fixture(t); await seedLegacy(db, '123'); await seedLegacy(db, '456');
  await assert.rejects(resolveAccountIdentity(db, 'user_ambiguous', identity('user_ambiguous', [github('123'), github('456')])), AccountIdentityConflict);
  assert.equal((await db.execute('SELECT COUNT(*) AS n FROM auth_identities')).rows[0].n, 0);
  assert.equal((await db.execute('SELECT SUM(points) AS n FROM wallets')).rows[0].n, 240);
});

test('a mismatched server identity is rejected before ownership is recorded', async t => {
  const db = await fixture(t);
  await assert.rejects(resolveAccountIdentity(db, 'user_expected', identity('user_different')), /could not be verified/);
  assert.equal((await db.execute('SELECT COUNT(*) AS n FROM auth_identities')).rows[0].n, 0);
});
