import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['lib/geo.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/geo.cjs' });
await build({ entryPoints: ['lib/account-identity.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/account-identity.cjs' });
await build({ entryPoints: ['lib/machines.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/machines.cjs' });
await build({ entryPoints: ['lib/vouchers.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/vouchers.cjs' });
// Exercise the actual API handler/SQL with request-scoped fixture identities.
// This alias exists only in an ignored test bundle; application auth is intact.
await build({
  stdin: { contents: "export { GET, POST } from './app/api/pilot/route'; export { databaseClient } from './lib/database'; export { machines } from './lib/machines'; export { userContext } from 'strideeco-test-auth';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: 'work/pilot-voucher-api.cjs',
  plugins: [{ name: 'isolated-test-identity', setup(builder) {
    builder.onResolve({ filter: /^(?:\.\.\/\.\.\/\.\.\/auth|strideeco-test-auth)$/ }, () => ({ path: 'fixture', namespace: 'isolated-test-identity' }));
    builder.onLoad({ filter: /.*/, namespace: 'isolated-test-identity' }, () => ({ contents: "import { AsyncLocalStorage } from 'node:async_hooks'; export const userContext = new AsyncLocalStorage(); export async function getUser() { const userId = userContext.getStore(); return userId ? { userId } : null; }", loader: 'js' }));
  } }],
});
const result = spawnSync(process.execPath, ['--test', 'tests/domain.cjs', 'tests/account-identity.cjs', 'tests/machines.cjs', 'tests/vouchers.cjs', 'tests/migration-runner.cjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
