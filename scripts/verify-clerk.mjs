import nextEnv from '@next/env';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { createClerkClient } from '@clerk/backend';

// This runner alone creates and removes one labelled development test user.
// All application records go to a fresh local database, never a remote wallet.
nextEnv.loadEnvConfig(process.cwd());
await mkdir('outputs', { recursive: true });
const paceOnly = process.argv.includes('--pace-only');
const vouchersOnly = process.argv.includes('--vouchers-only');
if (paceOnly && vouchersOnly) throw new Error('Choose one isolated browser verification mode.');
const suites = vouchersOnly ? ['browser-vouchers'] : paceOnly ? ['browser-flow'] : ['browser-auth', 'browser-flow', 'browser-vouchers'];
const reportNames = { 'browser-auth': 'clerk-browser-auth-report.json', 'browser-flow': 'e2e-report.json', 'browser-vouchers': 'voucher-browser-report.json' };
const childReports = suites.map(suite => reportNames[suite]);
for (const name of [...childReports, 'clerk-browser-run-report.json']) {
  await writeFile(path.join('outputs', name), JSON.stringify({ passed: false, status: 'pending', startedAt: new Date().toISOString() }, null, 2));
}
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') ||
    !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('Real Clerk development-instance keys are required. Production keys are refused.');
}
const buildDir = process.env.STRIDEECO_BUILD_DIR || 'work/next-clerk-verification';
await access(path.join(buildDir, 'BUILD_ID')).catch(() => { throw new Error('Build the app with the development Clerk keys before running browser verification.'); });
const port = Number(process.env.STRIDEECO_CLERK_TEST_PORT || 5175);
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', () => reject(new Error(`Port ${port} must be free for isolated Clerk verification.`)));
  probe.listen(port, 'localhost', () => probe.close(resolve));
});
const directory = await mkdtemp(path.join(tmpdir(), 'strideeco-clerk-browser-'));
const email = `strideeco-e2e+clerk_test_${Date.now()}@example.com`;
const env = { ...process.env, STRIDEECO_BUILD_DIR: buildDir,
  CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  CLERK_JWT_KEY: '', CLERK_TESTING_TOKEN: '', STRIDEECO_TEST_PRIVATE_KEY: '',
  CLERK_TELEMETRY_DISABLED: 'true', NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED: 'true',
  DOTENV_CONFIG_QUIET: 'true',
  STRIDEECO_TEST_EMAIL: email, STRIDEECO_TEST_PASSWORD: `StrideEco!${randomBytes(24).toString('base64url')}`,
  STRIDEECO_TEST_URL: `http://localhost:${port}`,
  TURSO_DATABASE_URL: `file:${path.join(directory, 'pilot.db')}`, TURSO_AUTH_TOKEN: '',
};
delete env.VERCEL;
const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], { env, stdio: 'inherit', timeout: 60000 });
if (migration.status !== 0) process.exit(migration.status ?? 1);
const forward = child => {
  const redact = text => text.split(env.STRIDEECO_TEST_PASSWORD).join('[redacted fixture password]')
    .replace(/https?:\/\/[^\s)]+\.clerk\.[^\s)]+/g, '[Clerk request]')
    .replace(/([?&])(?:__clerk_[\w]+|__dev_session|token)=[^&\s)'\"]+/g, '$1[redacted]')
    .replace(/\b(?:pk|sk)_(?:test|live)_[A-Za-z0-9_-]+/g, '[redacted key]')
    .replace(/\bdvb_[A-Za-z0-9_-]+/g, '[redacted development token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]');
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.on('data', chunk => {
      pending += chunk.toString();
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        if (/^(\[dotenv@|Attention: Clerk collects telemetry|The data collected is used to inform Clerk|To learn more, including how to opt-out)/.test(line)) continue;
        console.log(redact(line));
      }
    });
    stream.on('end', () => { if (pending) console.log(redact(pending)); });
  }
};
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', 'localhost', '--port', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
forward(server);
let exited = false;
let testsPassed = false;
server.once('exit', () => { exited = true; });
server.once('error', () => { exited = true; });
try {
  let ready = false;
  for (let i = 0; i < 30 && !exited; i++) {
    try {
      const r = await fetch(`${env.STRIDEECO_TEST_URL}/favicon.svg`, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
      await r.arrayBuffer();
      if (r.ok && !exited) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('The isolated Clerk production server did not become ready.');
  if (paceOnly || vouchersOnly) {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    await clerk.users.createUser({ emailAddress: [email], password: env.STRIDEECO_TEST_PASSWORD, username: `strideecotest${Date.now()}` });
  }
  let completed = 0;
  const tests = suites.map(suite => `tests/${suite}.cjs`);
  for (const file of tests) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      forward(child);
      child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
    });
    if (code) { process.exitCode = code; break; }
    completed++;
  }
  testsPassed = completed === tests.length;
} finally {
  let cleanupConfirmed = false;
  try {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const users = await clerk.users.getUserList({ emailAddress: [email], limit: 2 });
    if (users.data.length > 1) throw new Error('Unexpected duplicate test identity; cleanup stopped.');
    const user = users.data[0];
    if (user && user.emailAddresses.some(address => address.emailAddress === email)) await clerk.users.deleteUser(user.id);
    const remaining = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    if (remaining.data.length) throw new Error('The exact temporary fixture still exists.');
    cleanupConfirmed = true;
    console.log('Temporary Clerk development fixture cleaned up.');
  } catch {
    console.error('Temporary Clerk fixture cleanup could not be confirmed.');
    process.exitCode = 1;
  }
  for (const name of childReports) {
    const filename = path.join('outputs', name);
    const report = JSON.parse(await readFile(filename, 'utf8'));
    const final = { ...report, cleanupConfirmed, buildDirectory: buildDir };
    if (!cleanupConfirmed) Object.assign(final, { passed: false, status: 'failed', failedCheck: 'temporary Clerk fixture cleanup' });
    else if (report.status === 'pending') Object.assign(final, { passed: false, status: 'skipped' });
    await writeFile(filename, JSON.stringify(final, null, 2));
  }
  await writeFile('outputs/clerk-browser-run-report.json', JSON.stringify({ passed: testsPassed && cleanupConfirmed, status: testsPassed && cleanupConfirmed ? 'passed' : 'failed', mode: vouchersOnly ? 'vouchers-only' : paceOnly ? 'pace-only' : 'ui-auth-pace-and-vouchers', suites, completedAt: new Date().toISOString(), cleanupConfirmed, buildDirectory: buildDir, limits: ['Development Clerk authentication and isolated local persistence only', 'All water machine locations and dispensing are mock demonstrations'] }, null, 2));
  if (!exited) await new Promise(resolve => {
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
    server.kill('SIGTERM');
  });
}
