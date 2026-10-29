import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3121;
const puertoChrome = 9241;
const perfil = path.join(raiz, `.tmp-nr081-${Date.now()}`);
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let servidor;
let chrome;
let socket;

async function esperarUrl(url) {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondiÃ³ ${url}`);
}

try {
  servidor = spawn(process.execPath, ['servidor/server.js'], {
    cwd: raiz, env: { ...process.env, PUERTO: String(puerto) }, stdio: 'ignore'
  });
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/api/neuroritmo/presentacion`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const destinos = await fetch(`http://127.0.0.1:${puertoChrome}/json/list`).then((r) => r.json());
  const destino = destinos.find((p) => p.type === 'page' && !p.url.startsWith('chrome'));
  socket = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let secuencia = 0;
  const pendientes = new Map();
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const p = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    mensaje.error ? p.reject(new Error(mensaje.error.message)) : p.resolve(mensaje.result);
  });
  function enviar(method, params = {}) {
    const id = ++secuencia;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
  }
  async function evaluar(expression) {
    const r = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async function hasta(expression) {
    for (let i = 0; i < 120; i += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error('Inicio no terminÃ³ de cargar.');
  }
  async function comprobar(ancho, alto) {
    await enviar('Emulation.setDeviceMetricsOverride', {
      width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho <= 480
    });
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/index.html` });
    await hasta("document.querySelector('#neuro-recursos') && !document.querySelector('.neuro__cargando')");
    const estado = await evaluar(`(() => {
      const seccion = document.querySelector('#neuro-recursos').closest('section');
      return {
        titulo: document.querySelector('#neuro-recursos').textContent.trim(),
        texto: seccion.innerText,
        recursos: seccion.querySelectorAll('li').length,
        enlaces: seccion.querySelectorAll('a[href]').length,
        ancho: innerWidth,
        contenido: document.documentElement.scrollWidth
      };
    })()`);
    if (estado.titulo !== 'Recursos del curso') throw new Error(`TÃ­tulo inesperado: ${estado.titulo}`);
    if (/Tarea\s*2/i.test(estado.texto)) throw new Error('Inicio todavÃ­a expone â€œTarea 2â€.');
    if (estado.recursos !== 4 || estado.enlaces !== 5) throw new Error(`Recursos/enlaces inesperados: ${estado.recursos}/${estado.enlaces}.`);
    if (estado.contenido > estado.ancho) throw new Error(`Desbordamiento horizontal a ${ancho}px.`);
    return estado;
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  const escritorio = await comprobar(1366, 900);
  const movil = await comprobar(360, 800);
  process.stdout.write(`${JSON.stringify({ escritorio, movil }, null, 2)}\n`);
} finally {
  try { socket?.close(); } catch { /* sin conexiÃ³n */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(300);
  await rm(perfil, { recursive: true, force: true });
}
