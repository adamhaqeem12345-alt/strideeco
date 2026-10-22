import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// Isolated test database and signed test sessions. No authentication bypass route.
const directory = await mkdtemp(path.join(tmpdir(), 'strideeco-verification-'));
const env = { ...process.env, AUTH_SECRET: randomBytes(32).toString('hex'), AUTH_GITHUB_ID: 'test-only', AUTH_GITHUB_SECRET: 'test-only', TURSO_DATABASE_URL: `file:${path.join(directory, 'pilot.db')}`, TURSO_AUTH_TOKEN: '', AUTH_URL: 'http://127.0.0.1:5173', AUTH_TRUST_HOST: 'true' };
delete env.VERCEL;
for (let i = 0; i < 2; i++) {
  const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], { env, stdio: 'inherit' });
  if (migration.status !== 0) process.exit(migration.status ?? 1);
}
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '5173'], { env, stdio: 'inherit' });
let exited = false;
server.on('exit', () => { exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 90 && !exited; i++) {
    try { const r = await fetch('http://127.0.0.1:5173', { signal: AbortSignal.timeout(2000) }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Local production server did not become ready.');
  const test = process.argv.includes('--api-only') ? 'tests/vercel-api.mjs' : 'tests/browser-flow.cjs';
  const result = spawnSync(process.execPath, [test], { env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { server.kill('SIGTERM'); }
