import { generateKeyPairSync } from 'node:crypto';
import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createClient } from '@libsql/client';
import { build } from 'esbuild';
import { testPublishableKey, testSecretKey } from '../tests/test-session.mjs';

// Isolated database and ephemeral RSA-signed sessions verified by Clerk's SDK.
// No real Clerk app is created and no production authentication bypass exists.
const port = 5187;
const publicOnly = process.argv.includes('--public-only');
await access(path.join(process.env.STRIDEECO_BUILD_DIR || '.next', 'BUILD_ID')).catch(() => {
  throw new Error('Build the application first, and set STRIDEECO_BUILD_DIR to that production build directory.');
});
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', () => reject(new Error(`Port ${port} must be free for the isolated verification server.`)));
  probe.listen(port, 'localhost', () => probe.close(resolve));
});
const directory = await mkdtemp(path.join(tmpdir(), 'strideeco-verification-'));
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const env = { ...process.env,
  // Synthetic live-shaped keys disable development-browser handshakes. They
  // are not credentials for a real instance; only the ephemeral RSA key works.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicOnly ? '' : testPublishableKey,
  CLERK_SECRET_KEY: publicOnly ? '' : testSecretKey,
  CLERK_JWT_KEY: publicOnly ? '' : publicKey,
  CLERK_TESTING_TOKEN: '', NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED: 'true',
  STRIDEECO_TEST_PRIVATE_KEY: publicOnly ? '' : privateKey,
  STRIDEECO_TEST_URL: `http://localhost:${port}`,
  TURSO_DATABASE_URL: `file:${path.join(directory, 'pilot.db')}`, TURSO_AUTH_TOKEN: '',
};
delete env.VERCEL;
for (let i = 0; i < 2; i++) {
  const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], { env, stdio: 'inherit', timeout: 60000 });
  if (migration.status !== 0) process.exit(migration.status ?? 1);
}
const db = createClient({ url: env.TURSO_DATABASE_URL });
for (const [clerkId, appId] of publicOnly ? [] : [['user_api_runner', 'github:strideeco-api-test'], ['user_api_other', 'clerk:user_api_other']]) {
  await db.execute({ sql: 'INSERT INTO auth_identities VALUES(?,?,?)', args: [clerkId, appId, new Date().toISOString()] });
}
db.close();
if (!publicOnly) await build({ entryPoints: ['lib/geo.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/geo.cjs' });
// Next normalizes loopback middleware URLs to localhost. Using 127.0.0.1
// here makes Clerk's same-origin rewrite look external and re-enter proxy.
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', 'localhost', '--port', String(port)], { env, stdio: 'inherit' });
let exited = false;
server.on('exit', () => { exited = true; });
server.on('error', error => { console.error('Verification server failed:', error.message); exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 20 && !exited; i++) {
    try { const r = await fetch(`${env.STRIDEECO_TEST_URL}/favicon.svg`, { signal: AbortSignal.timeout(2000), redirect: 'manual' }); await r.arrayBuffer(); if (r.ok && !exited) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Local production server did not become ready.');
  const test = publicOnly ? 'tests/browser-public.cjs' : 'tests/vercel-api.mjs';
  process.exitCode = await new Promise((resolve, reject) => {
    const testProcess = spawn(process.execPath, [test], { env, stdio: 'inherit' });
    testProcess.once('error', reject);
    testProcess.once('exit', code => resolve(code ?? 1));
  });
} finally {
  if (!exited) await new Promise(resolve => {
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
    server.kill('SIGTERM');
  });
}
