import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const salida = path.join(raiz, 'docs', 'evidencias', 'nr-07.6');
const datosDir = path.join(raiz, 'datos');
const puerto = 3119;
const puertoChrome = 9239;
const perfil = path.join(raiz, `.tmp-nr076-${Date.now()}`);
const mutables = ['sesiones.json', 'bitacora.jsonl', 'neuroritmo-partidas.json'];
const respaldo = new Map();
for (const nombre of mutables) {
  const ruta = path.join(datosDir, nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}

let servidor;
let chrome;
let socket;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperarUrl(url) {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* proceso iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondió ${url}`);
}

try {
  await mkdir(salida, { recursive: true });
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

  const login = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  });
  if (!login.ok) throw new Error(`No se pudo iniciar sesión (${login.status}).`);
  const { token, usuario } = await login.json();
  if (usuario?.rol !== 'estudiante') throw new Error('La cuenta de evidencia no tiene rol estudiante.');

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
  async function hasta(expression, mensaje, limite = 15000) {
    const inicio = Date.now();
    while (Date.now() - inicio < limite) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function navegar(ruta, condicion) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
    await esperar(500);
  }
  async function viewport(ancho, alto) {
    await enviar('Emulation.setDeviceMetricsOverride', {
      width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho <= 480
    });
  }
  async function capturar(nombre) {
    const imagen = await enviar('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(path.join(salida, nombre), Buffer.from(imagen.data, 'base64'));
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await viewport(1366, 900);
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);

  await navegar('/index.html', "document.querySelector('#vista h1') && !document.querySelector('.neuro__cargando')");
  await capturar('01-ecosistema-inicio-local.png');

  await navegar('/paginas/explorar.html', "document.querySelectorAll('.explorar-subtema').length === 2 && document.querySelectorAll('.explorar-recurso').length >= 3");
  await evaluar("document.querySelectorAll('.explorar-subtema__detalle').forEach((d) => { d.open = true; }); document.querySelector('.explorar-recursos')?.scrollIntoView({block:'start'}); true");
  await esperar(400);
  await capturar('02-multimedia-recursos-local.png');

  await navegar('/index.html#mision-m1', "document.querySelector('.neuro-mision-cabecera--m1') && !document.querySelector('.neuro__cargando')");
  await capturar('03-mision-1-local.png');

  await navegar('/paginas/tutor.html?temaId=tem_000003', "document.querySelector('#tutorApp:not([hidden])') && document.querySelectorAll('.tutor__sugerencia').length > 0");
  await evaluar("document.activeElement?.blur(); window.scrollTo(0, 0); true");
  await esperar(300);
  await capturar('04-ia-tutor-local.png');

  await viewport(360, 800);
  await navegar('/index.html#mapa', "document.querySelectorAll('.neuro-mision').length === 3 && !document.querySelector('.neuro__cargando')");
  await capturar('05-movil-mapa-local-360px.png');

  process.stdout.write('Capturas reales creadas: 5\n');
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
