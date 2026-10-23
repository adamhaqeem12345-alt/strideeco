const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const names = ['0000_condemned_firestar.sql', '0001_wallet_accounting.sql', '0002_clerk_identities.sql', '0003_machine_water_vouchers.sql'];
const hash = value => createHash('sha256').update(value).digest('hex');

function fixture() {
  // The copied runner resolves installed packages from this checkout, while
  // every SQL file, ledger and database belongs to this ignored test folder.
  mkdirSync('work', { recursive: true });
  const root = mkdtempSync(path.resolve('work', 'migration-runner-'));
  mkdirSync(path.join(root, 'scripts')); mkdirSync(path.join(root, 'drizzle'));
  copyFileSync('scripts/migrate.mjs', path.join(root, 'scripts/migrate.mjs'));
  const sources = names.map(name => readFileSync(path.join('drizzle', name), 'utf8').replace(/\r\n/g, '\n'));
  const database = path.join(root, 'test.db');
  const setEndings = crlf => names.forEach((name, i) => writeFileSync(path.join(root, 'drizzle', name), crlf ? sources[i].replace(/\n/g, '\r\n') : sources[i]));
  const run = () => spawnSync(process.execPath, ['scripts/migrate.mjs'], { cwd: root, env: { ...process.env, VERCEL: '', TURSO_DATABASE_URL: `file:${database}`, TURSO_AUTH_TOKEN: '' }, encoding: 'utf8', timeout: 30000 });
  const ledger = () => { const db = new DatabaseSync(database, { readOnly: true }); try { return db.prepare('SELECT name,checksum,applied_at FROM strideeco_migrations ORDER BY name').all(); } finally { db.close(); } };
  return { root, sources, database, setEndings, run, ledger };
}

test('migration runner writes canonical LF checksums and safely reruns after LF/CRLF checkout changes', () => {
  const fixtureState = fixture();
  fixtureState.setEndings(true);
  const initial = fixtureState.run();
  assert.equal(initial.status, 0, initial.stderr);
  const before = fixtureState.ledger();
  assert.deepEqual(before.map(row => row.checksum), fixtureState.sources.map(hash));
  fixtureState.setEndings(false);
  const repeated = fixtureState.run();
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal((repeated.stdout.match(/Already applied:/g) || []).length, names.length);
  assert.deepEqual(fixtureState.ledger(), before);
});

test('historical raw CRLF ledger entries remain unchanged; substantive SQL edits are refused before execution', () => {
  const fixtureState = fixture(); fixtureState.setEndings(false);
  assert.equal(fixtureState.run().status, 0);
  const historical = new DatabaseSync(fixtureState.database);
  try {
    for (let i = 0; i < 2; i++) historical.prepare('UPDATE strideeco_migrations SET checksum=? WHERE name=?').run(hash(fixtureState.sources[i].replace(/\n/g, '\r\n')), names[i]);
  } finally { historical.close(); }
  const before = fixtureState.ledger();
  fixtureState.setEndings(true);
  const compatible = fixtureState.run();
  assert.equal(compatible.status, 0, compatible.stderr);
  assert.deepEqual(fixtureState.ledger(), before);
  writeFileSync(path.join(fixtureState.root, 'drizzle', names[2]), fixtureState.sources[2] + '\nCREATE TABLE forbidden_migration_edit(id TEXT);\n');
  const changed = fixtureState.run();
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /Applied migration changed: 0002_clerk_identities\.sql/);
  assert.deepEqual(fixtureState.ledger(), before);
  const db = new DatabaseSync(fixtureState.database, { readOnly: true });
  try { assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='forbidden_migration_edit'").get().n, 0); }
  finally { db.close(); }
});
