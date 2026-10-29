import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const perfil = fileURLToPath(new URL(`../.tmp-nr063-${Date.now()}/`, import.meta.url));
const chromeRuta = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const servidor = spawn(process.execPath, ['servidor/server.js'], {
  cwd: raiz,
  env: { ...process.env, PUERTO: '3113' },
  stdio: 'ignore'
});
const chrome = spawn(chromeRuta, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
  '--disable-background-networking', '--remote-debugging-port=9233',
  `--user-data-dir=${perfil}`, 'about:blank'
], { cwd: raiz, stdio: 'ignore' });

async function esperar(url) {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* todavía inicia */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No respondió ${url}`);
}

try {
  await Promise.all([
    esperar('http://127.0.0.1:3113/api/neuroritmo/presentacion'),
    esperar('http://127.0.0.1:9233/json/list')
  ]);
  process.env.NR_BASE_URL = 'http://127.0.0.1:3113';
  process.env.CDP_PORT = '9233';
  await import('./nr-06.3-e2e.mjs');
} finally {
  chrome.kill();
  servidor.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await rm(perfil, { recursive: true, force: true }).catch(() => {});
}
