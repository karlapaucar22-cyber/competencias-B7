import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3123;
const puertoChrome = 9243;
const perfil = path.join(raiz, `.tmp-nr083-${Date.now()}`);
const respaldo = new Map();
for (const nombre of ['sesiones.json', 'bitacora.jsonl']) {
  const ruta = path.join(datosDir, nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let servidor;
let chrome;
let socket;

async function esperarUrl(url) {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondió ${url}`);
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
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const login = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  });
  if (!login.ok) throw new Error(`No se pudo iniciar sesión (${login.status}).`);
  const { token, usuario } = await login.json();
  if (usuario?.rol !== 'estudiante') throw new Error('La cuenta no tiene rol estudiante.');

  const destinos = await fetch(`http://127.0.0.1:${puertoChrome}/json/list`).then((r) => r.json());
  const destino = destinos.find((pagina) => pagina.type === 'page' && !pagina.url.startsWith('chrome'));
  socket = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let secuencia = 0;
  const pendientes = new Map();
  const errores = [];
  const fallosRed = [];
  const solicitudes = new Map();
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.method === 'Runtime.exceptionThrown') errores.push(mensaje.params.exceptionDetails.text);
    if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') errores.push('console.error');
    if (mensaje.method === 'Network.requestWillBeSent') solicitudes.set(mensaje.params.requestId, mensaje.params.request.url);
    if (mensaje.method === 'Network.loadingFailed' && !mensaje.params.canceled) {
      const url = solicitudes.get(mensaje.params.requestId) || 'URL desconocida';
      if (url.startsWith(`http://127.0.0.1:${puerto}`)) fallosRed.push(`${url}: ${mensaje.params.errorText}`);
    }
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const pendiente = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    mensaje.error ? pendiente.reject(new Error(mensaje.error.message)) : pendiente.resolve(mensaje.result);
  });
  function enviar(method, params = {}) {
    const id = ++secuencia;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
  }
  async function evaluar(expression) {
    const resultado = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text);
    return resultado.result.value;
  }
  async function hasta(expression, mensaje) {
    for (let i = 0; i < 150; i += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function navegar(ruta, condicion) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Network.enable');
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);

  await navegar('/paginas/tema.html?id=tem_000001', "document.querySelector('#tema-contenido-estudio')?.style.display === 'block'");
  const tema1 = await evaluar(`(() => ({
    titulo: document.querySelector('#tema-titulo-principal').textContent.trim(),
    genially: Boolean(document.querySelector('a[href="https://view.genially.com/6aca29b16ddf6a28c8dadcaf"]')),
    interactivo: Boolean(document.querySelector('a[href="/paginas/recurso-neurociencia.html"]')),
    pendientes: document.querySelectorAll('.recurso-pendiente').length,
    iframes: document.querySelectorAll('iframe').length,
    audios: document.querySelectorAll('audio').length,
    regreso: Boolean(document.querySelector('a[href="/index.html#mapa"]'))
  }))()`);
  if (!tema1.genially || !tema1.interactivo || tema1.pendientes !== 1 || tema1.iframes || tema1.audios || !tema1.regreso) {
    throw new Error(`Integración inesperada en tem_000001: ${JSON.stringify(tema1)}`);
  }

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await navegar('/paginas/recurso-neurociencia.html', "document.querySelectorAll('[data-caso]').length === 3 && document.querySelector('#resultado-caso h3')");
  const antes = await evaluar("document.querySelector('#resultado-caso h3').textContent");
  await evaluar("document.querySelector('[data-caso=\"estres\"]').click(); true");
  const alternativo = await evaluar(`({
    antes: ${JSON.stringify(antes)},
    despues: document.querySelector('#resultado-caso h3').textContent,
    nodos: document.querySelectorAll('.recurso-neuro__ruta article').length,
    misiones: Boolean(document.querySelector('a[href="/index.html#mapa"]')),
    m1: Boolean(document.querySelector('a[href="/index.html#mision-m1"]')),
    explora: Boolean(document.querySelector('a[href="/paginas/explorar.html"]')),
    ancho: innerWidth,
    contenido: document.documentElement.scrollWidth
  })`);
  if (alternativo.antes === alternativo.despues || alternativo.nodos !== 4 || !alternativo.misiones || !alternativo.m1 || !alternativo.explora) {
    throw new Error('El recurso alternativo no responde o no permite regresar.');
  }
  if (alternativo.contenido > alternativo.ancho) throw new Error('El recurso alternativo desborda a 360 px.');

  await navegar('/paginas/tema.html?id=tem_000002', "document.querySelector('#tema-contenido-estudio')?.style.display === 'block'");
  const tema2 = await evaluar(`({
    pendiente: document.querySelector('.recurso-pendiente')?.innerText || '',
    audios: document.querySelectorAll('audio').length,
    rutaRota: document.body.innerHTML.includes('paisaje-sonoro.mp3'),
    regreso: Boolean(document.querySelector('a[href="/index.html#mapa"]')),
    ancho: innerWidth,
    contenido: document.documentElement.scrollWidth
  })`);
  if (!/audio autorizado y su transcripción/i.test(tema2.pendiente) || tema2.audios || tema2.rutaRota || !tema2.regreso) {
    throw new Error(`Estado inesperado en tem_000002: ${JSON.stringify(tema2)}`);
  }
  if (tema2.contenido > tema2.ancho) throw new Error('tem_000002 desborda a 360 px.');
  if (errores.length || fallosRed.length) throw new Error(`Errores de navegador: ${[...errores, ...fallosRed].join('; ')}`);

  process.stdout.write(`${JSON.stringify({ estudiante: usuario.id, tema1, alternativo, tema2, erroresConsola: errores, fallosRed }, null, 2)}\n`);
} finally {
  try { socket?.close(); } catch { /* sin conexión */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(300);
  for (const [ruta, contenido] of respaldo) {
    if (contenido === null) await rm(ruta, { force: true });
    else await writeFile(ruta, contenido);
  }
  await rm(perfil, { recursive: true, force: true });
}
