import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['lib/geo.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/geo.cjs' });
await build({ entryPoints: ['lib/account-identity.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/account-identity.cjs' });
const result = spawnSync(process.execPath, ['--test', 'tests/domain.cjs', 'tests/account-identity.cjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
