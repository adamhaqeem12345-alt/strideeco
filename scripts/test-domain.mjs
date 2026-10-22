import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
await build({ entryPoints: ['lib/geo.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'work/geo.cjs' });
const result = spawnSync(process.execPath, ['--test', 'tests/domain.cjs'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
