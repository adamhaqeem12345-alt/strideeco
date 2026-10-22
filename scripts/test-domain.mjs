import { spawnSync } from 'node:child_process';
const commands = [['node_modules/esbuild/bin/esbuild', 'lib/geo.ts', '--bundle', '--platform=node', '--format=cjs', '--outfile=work/geo.cjs'], ['--test', 'tests/domain.cjs']];
for (const args of commands) { const result = spawnSync(process.execPath, args, { stdio: 'inherit' }); if (result.status !== 0) process.exit(result.status ?? 1); }
