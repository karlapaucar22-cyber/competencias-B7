import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3137;
const puertoChrome = 9257;
const perfil = path.join(raiz, `.tmp-nr0817-${Date.now()}`);
const rutasDatos = ['sesiones.json', 'bitacora.jsonl'].map((nombre) => path.join(raiz, 'datos', nombre));
const respaldo = new Map();
for (const ruta of rutasDatos) {
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let servidor;
let chrome;
let socket;

async function esperarUrl(url) {
  for (let intento = 0; intento < 80; intento += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondió ${url}`);
}

async function borrarPerfil() {
  for (let intento = 0; intento < 10; intento += 1) {
    try {
      await rm(perfil, { recursive: true, force: true });
      return;
    } catch (err) {
      if (!['EBUSY', 'EPERM'].includes(err.code) || intento === 9) throw err;
      await esperar(300);
    }
  }
}

try {
  servidor = spawn(process.execPath, ['servidor/server.js'], {
    cwd: raiz, env: { ...process.env, PUERTO: String(puerto) }, stdio: 'ignore'
  });
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${puertoChrome}`,
    `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const ids = ['funciones-ejecutivas', 'musica-cerebro'];
  const http = [];
  for (const id of ids) {
    const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/recursos-didacticos/${id}`, {
      headers: { Range: 'bytes=0-1023' }
    });
    http.push({ id, estado: respuesta.status, tipo: respuesta.headers.get('content-type'), bytes: (await respuesta.arrayBuffer()).byteLength });
  }
  if (http.some((item) => item.estado !== 206 || item.bytes !== 1024 || !/^(video|audio)\/mp4/.test(item.tipo))) {
    throw new Error(`Las rutas multimedia no admiten rangos: ${JSON.stringify(http)}`);
  }

  const login = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  });
  if (!login.ok) throw new Error(`No se pudo iniciar sesión (${login.status}).`);
  const { token, usuario } = await login.json();
  if (usuario?.rol !== 'estudiante') throw new Error('La cuenta no tiene rol estudiante.');

  const destinos = await fetch(`http://127.0.0.1:${puertoChrome}/json/list`).then((respuesta) => respuesta.json());
  const destino = destinos.find((pagina) => pagina.type === 'page' && !pagina.url.startsWith('chrome'));
  socket = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let secuencia = 0;
  const pendientes = new Map();
  const errores = [];
  const solicitudes = new Map();
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.method === 'Runtime.exceptionThrown') errores.push(mensaje.params.exceptionDetails.text);
    if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') errores.push('console.error');
    if (mensaje.method === 'Network.requestWillBeSent') solicitudes.set(mensaje.params.requestId, mensaje.params.request.url);
    if (mensaje.method === 'Network.loadingFailed' && !mensaje.params.canceled) {
      const url = solicitudes.get(mensaje.params.requestId) || 'URL desconocida';
      if (url.startsWith(`http://127.0.0.1:${puerto}`)) errores.push(`${url}: ${mensaje.params.errorText}`);
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
    for (let intento = 0; intento < 200; intento += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Network.enable');
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/index.html` });
  await hasta("document.readyState === 'complete'", 'No cargó Inicio.');
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/paginas/explorar.html` });
  await hasta("document.querySelectorAll('[data-subtema]').length === 2", 'No cargaron los subtemas.');
  await evaluar("document.querySelectorAll('[data-subtema] details').forEach((n) => { n.open = true; }); true");
  await hasta("[...document.querySelectorAll('.explorar-multimedia video, .explorar-multimedia audio')].every((n) => n.readyState >= 1)", 'No cargaron los metadatos multimedia.');

  const inicial = await evaluar(`(() => {
    const video = document.querySelector('[data-subtema="1.1"] video');
    const audio = document.querySelector('[data-subtema="1.2"] audio');
    return {
      video: { controles: video.controls, autoplay: video.autoplay, pausado: video.paused, duracion: video.duration, ancho: video.videoWidth, alto: video.videoHeight, error: video.error?.code || null },
      audio: { controles: audio.controls, autoplay: audio.autoplay, pausado: audio.paused, duracion: audio.duration, error: audio.error?.code || null },
      fuentes: [...document.querySelectorAll('.explorar-multimedia source')].map((n) => n.getAttribute('src')),
      desborde: document.documentElement.scrollWidth > innerWidth
    };
  })()`);
  if (!inicial.video.controles || inicial.video.autoplay || !inicial.video.pausado || inicial.video.ancho <= 0 || inicial.video.alto <= 0
    || !Number.isFinite(inicial.video.duracion) || inicial.video.error || !inicial.audio.controles || inicial.audio.autoplay
    || !inicial.audio.pausado || !Number.isFinite(inicial.audio.duracion) || inicial.audio.error || inicial.desborde) {
    throw new Error(`Estado multimedia inválido: ${JSON.stringify(inicial)}`);
  }

  const reproduccion = await evaluar(`(async () => {
    const elementos = [...document.querySelectorAll('.explorar-multimedia video, .explorar-multimedia audio')];
    const resultado = [];
    for (const elemento of elementos) {
      elemento.muted = true;
      await elemento.play();
      for (let intento = 0; intento < 50 && elemento.currentTime <= 0; intento += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      resultado.push({ tiempo: elemento.currentTime, pausadoDurantePrueba: elemento.paused, listo: elemento.readyState });
      elemento.pause();
    }
    return resultado;
  })()`);
  if (reproduccion.some((item) => item.tiempo <= 0 || item.pausadoDurantePrueba)) {
    throw new Error(`No avanzó la reproducción: ${JSON.stringify(reproduccion)}`);
  }

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  const movil = await evaluar(`({
    ancho: innerWidth,
    contenido: document.documentElement.scrollWidth,
    reproductores: [...document.querySelectorAll('.explorar-multimedia video, .explorar-multimedia audio')].map((n) => n.getBoundingClientRect().width)
  })`);
  if (movil.contenido > movil.ancho || movil.reproductores.some((ancho) => ancho > movil.ancho)) {
    throw new Error(`Desborde móvil: ${JSON.stringify(movil)}`);
  }
  if (errores.length) throw new Error(`Errores de navegador: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ estudiante: usuario.id, http, inicial, reproduccion, movil, errores }, null, 2)}\n`);
} finally {
  try { socket?.close(); } catch { /* cerrando */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(400);
  for (const [ruta, contenido] of respaldo) {
    if (contenido === null) await rm(ruta, { force: true });
    else await writeFile(ruta, contenido);
  }
  await borrarPerfil();
}
