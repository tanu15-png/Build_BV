import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { busyServices } from './dev-ports.mjs';
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Start the development services with npm run dev.');
let backendEnv = {};
try { backendEnv = parseEnv(readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const port = Number(process.env.PORT ?? backendEnv.PORT ?? 4000);
const busy = await busyServices([
  { name: 'Student', port: 5173 }, { name: 'Canteen', port: 5174 },
  { name: 'Admin', port: 5175 }, { name: 'API', port },
]);
if (busy.length) {
  console.error(`Development services were not started. These ports are already in use:\n${busy.map(service => `  ${service.name}: ${service.port}`).join('\n')}\nUse the existing websites, or press Ctrl+C in the terminal running them before starting again.\nOn Linux/WSL, inspect port owners with: ss -ltnp`);
  process.exit(1);
}
try {
  await import('rolldown');
  const backendRequire = createRequire(new URL('../backend/package.json', import.meta.url));
  backendRequire('esbuild').transformSync('const ready = true;');
} catch {
  console.error(`Development dependencies are missing or incompatible with ${process.platform}/${process.arch}.\nRun npm run setup in this terminal, then npm run dev.\nInstall and run in the same environment; Windows and WSL cannot share native dependencies.`);
  process.exit(1);
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') {
      if (child.exitCode === null && child.signalCode === null) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    }
    else {
      try { process.kill(-child.pid, 'SIGTERM'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
  process.exitCode = code;
  // npm can exit before its descendants. Keep the launcher alive long enough
  // to clean up any group that ignores graceful shutdown.
  if (process.platform !== 'win32') {
    setTimeout(() => {
      for (const child of children) {
        if (!child.pid) continue;
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') console.error(error.message); }
      }
    }, 5000);
  }
}
for (const [cwd, script] of [['apps/student', 'dev'], ['apps/canteen', 'dev'], ['apps/admin', 'dev'], ['backend', 'dev'], ['backend', 'worker:dev']]) {
  const child = spawn(process.execPath, [npmCli, 'run', script], { cwd, stdio: 'inherit', detached: process.platform !== 'win32', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(`${cwd} (${script}): ${error.message}`); stop(1); });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${cwd} (${script}) exited with ${signal || `code ${code}`}. Stopping the other services.`);
      stop(code || 1);
    }
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
if (process.platform !== 'win32') {
  process.on('SIGHUP', () => stop());
  // The services run in separate process groups. Suspending just this
  // launcher would leave them running and prevent the next startup.
  process.on('SIGTSTP', () => stop());
}
