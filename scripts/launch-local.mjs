import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (!existsSync(path.join(root, 'node_modules/next'))) {
  console.error('Run the fresh-download setup commands in README.md before starting.');
  process.exit(1);
}
const url = 'http://localhost:5173/';
const openBrowser = () => {
  console.log(`StrideEco is ready: ${url}`);
  if (process.platform === 'win32') spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}'`], { windowsHide: true, stdio: 'ignore' });
};
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
  if (response.ok && (await response.text()).includes('StrideEco')) { openBrowser(); process.exit(0); }
} catch {}
const server = spawn(process.execPath, ['scripts/run-framework.mjs', 'dev'], { cwd: root, stdio: 'inherit' });
let stopped = false;
server.on('exit', code => { stopped = true; process.exitCode = code ?? 1; });
process.on('SIGINT', () => server.kill());
process.on('SIGTERM', () => server.kill());
for (let attempt = 0; attempt < 90 && !stopped; attempt++) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.ok) { openBrowser(); break; } } catch {}
  await new Promise(resolve => setTimeout(resolve, 1000));
}
