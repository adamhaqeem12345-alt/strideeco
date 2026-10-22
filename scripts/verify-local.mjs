import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createClient } from '@libsql/client';

// Isolated database and ephemeral RSA-signed sessions verified by Clerk's SDK.
// No real Clerk app is created and no production authentication bypass exists.
const directory = await mkdtemp(path.join(tmpdir(), 'strideeco-verification-'));
const port = 5187;
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const env = { ...process.env,
  // Synthetic live-shaped keys disable development-browser handshakes. They
  // are not credentials for a real instance; only the ephemeral RSA key works.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_' + Buffer.from('strideeco-test.invalid$').toString('base64'),
  CLERK_SECRET_KEY: 'sk_live_local_verification_only', CLERK_JWT_KEY: publicKey,
  STRIDEECO_TEST_PRIVATE_KEY: privateKey,
  STRIDEECO_TEST_URL: `http://127.0.0.1:${port}`,
  TURSO_DATABASE_URL: `file:${path.join(directory, 'pilot.db')}`, TURSO_AUTH_TOKEN: '',
};
delete env.VERCEL;
for (let i = 0; i < 2; i++) {
  const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], { env, stdio: 'inherit' });
  if (migration.status !== 0) process.exit(migration.status ?? 1);
}
const db = createClient({ url: env.TURSO_DATABASE_URL });
for (const [clerkId, appId] of [['user_api_runner', 'github:strideeco-api-test'], ['user_api_other', 'clerk:user_api_other'], ['user_browser_runner', 'clerk:user_browser_runner']]) {
  await db.execute({ sql: 'INSERT INTO auth_identities VALUES(?,?,?)', args: [clerkId, appId, new Date().toISOString()] });
}
db.close();
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { env, stdio: 'inherit' });
let exited = false;
server.on('exit', () => { exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 20 && !exited; i++) {
    try { const r = await fetch(`${env.STRIDEECO_TEST_URL}/favicon.svg`, { signal: AbortSignal.timeout(2000), redirect: 'manual' }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Local production server did not become ready.');
  const test = process.argv.includes('--public-only') ? 'tests/browser-public.cjs' : 'tests/vercel-api.mjs';
  const result = spawnSync(process.execPath, [test], { env, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { server.kill('SIGTERM'); }
