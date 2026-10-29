import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3139;
const puertoChrome = 9259;
const perfil = path.join(raiz, `.tmp-nr0819-${Date.now()}`);
const respaldo = new Map();
for (const nombre of ['sesiones.json', 'bitacora.jsonl']) {
  const ruta = path.join(raiz, 'datos', nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let servidor;
let chrome;
let socket;

async function esperarUrl(url) {
  for (let intento = 0; intento < 100; intento += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondió ${url}`);
}

async function borrarPerfil() {
  for (let intento = 0; intento < 10; intento += 1) {
    try { await rm(perfil, { recursive: true, force: true }); return; }
    catch (err) {
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

  const rutas = ['funciones-ejecutivas', 'musica-cerebro'];
  const http = [];
  for (const id of rutas) {
    const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/recursos-didacticos/${id}`, { headers: { Range: 'bytes=0-1023' } });
    http.push({ id, estado: respuesta.status, tipo: respuesta.headers.get('content-type'), bytes: (await respuesta.arrayBuffer()).byteLength });
  }
  if (http.some((item) => item.estado !== 206 || item.bytes !== 1024 || !/^(video|audio)\/mp4/.test(item.tipo))) {
    throw new Error(`Rutas multimedia incorrectas: ${JSON.stringify(http)}`);
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
    for (let intento = 0; intento < 220; intento += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function reproducir(selector) {
    return evaluar(`(async () => {
      const elemento = document.querySelector(${JSON.stringify(selector)});
      elemento.muted = true;
      await elemento.play();
      for (let intento = 0; intento < 50 && elemento.currentTime <= 0; intento += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      const resultado = { tiempo: elemento.currentTime, pausado: elemento.paused, listo: elemento.readyState, error: elemento.error?.code || null };
      elemento.pause();
      return resultado;
    })()`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Network.enable');
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/index.html` });
  await hasta("document.readyState === 'complete'", 'No cargó Inicio.');
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/paginas/explorar.html` });
  await hasta("document.querySelector('[data-id=" + '"tem_000001"' + "] .btn-ver-tema')", 'No cargó el catálogo.');

  await evaluar("document.querySelector('[data-id=\"tem_000001\"] .btn-ver-tema').click(); true");
  await hasta("document.querySelector('[data-multimedia-tema=\"tem_000001\"] video')?.readyState >= 1", 'El video no apareció en Ver contenido.');
  const tema1 = await evaluar(`(() => {
    const medio = document.querySelector('[data-multimedia-tema="tem_000001"] video');
    const cuerpo = document.querySelector('.modal-cuerpo');
    return {
      titulo: document.querySelector('.modal-titulo').textContent.trim(),
      controles: medio.controls, autoplay: medio.autoplay, pausado: medio.paused,
      duracion: medio.duration, anchoNatural: medio.videoWidth, altoNatural: medio.videoHeight, error: medio.error?.code || null,
      fuente: medio.querySelector('source').getAttribute('src'),
      desplazamiento: getComputedStyle(cuerpo).overflowY,
      contenidoCompleto: /Objetivos de Aprendizaje/i.test(cuerpo.innerText) && /Fuentes y Referencias/i.test(cuerpo.innerText),
      desbordeHorizontal: cuerpo.scrollWidth > cuerpo.clientWidth
    };
  })()`);
  const reproduceVideo = await reproducir('[data-multimedia-tema="tem_000001"] video');
  if (!tema1.controles || tema1.autoplay || !tema1.pausado || !Number.isFinite(tema1.duracion) || tema1.anchoNatural <= 0
    || tema1.altoNatural <= 0 || tema1.error || tema1.desplazamiento !== 'auto' || !tema1.contenidoCompleto
    || tema1.desbordeHorizontal || reproduceVideo.tiempo <= 0 || reproduceVideo.pausado || reproduceVideo.error) {
    throw new Error(`Video inválido: ${JSON.stringify({ tema1, reproduceVideo })}`);
  }
  await evaluar("document.querySelector('.modal-cerrar').click(); true");
  await hasta("!document.querySelector('.modal-fondo')", 'No cerró la primera ventana.');

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await evaluar("document.querySelector('[data-id=\"tem_000002\"] .btn-ver-tema').click(); true");
  await hasta("document.querySelector('[data-multimedia-tema=\"tem_000002\"] audio')?.readyState >= 1", 'El audio no apareció en Ver contenido.');
  const tema2 = await evaluar(`(() => {
    const medio = document.querySelector('[data-multimedia-tema="tem_000002"] audio');
    const cuerpo = document.querySelector('.modal-cuerpo');
    const dialogo = document.querySelector('.modal-dialogo');
    return {
      titulo: document.querySelector('.modal-titulo').textContent.trim(),
      controles: medio.controls, autoplay: medio.autoplay, pausado: medio.paused,
      duracion: medio.duration, error: medio.error?.code || null,
      fuente: medio.querySelector('source').getAttribute('src'),
      desplazamiento: getComputedStyle(cuerpo).overflowY,
      contenidoCompleto: /Objetivos de Aprendizaje/i.test(cuerpo.innerText) && /Fuentes y Referencias/i.test(cuerpo.innerText),
      ancho: innerWidth, contenido: document.documentElement.scrollWidth,
      dialogoDentro: dialogo.getBoundingClientRect().right <= innerWidth && dialogo.getBoundingClientRect().left >= 0
    };
  })()`);
  const reproduceAudio = await reproducir('[data-multimedia-tema="tem_000002"] audio');
  if (!tema2.controles || tema2.autoplay || !tema2.pausado || !Number.isFinite(tema2.duracion) || tema2.error
    || tema2.desplazamiento !== 'auto' || !tema2.contenidoCompleto || tema2.contenido > tema2.ancho || !tema2.dialogoDentro
    || reproduceAudio.tiempo <= 0 || reproduceAudio.pausado || reproduceAudio.error) {
    throw new Error(`Audio inválido: ${JSON.stringify({ tema2, reproduceAudio })}`);
  }
  if (errores.length) throw new Error(`Errores de navegador: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ estudiante: usuario.id, archivos: http, tema1, reproduceVideo, tema2, reproduceAudio, errores }, null, 2)}\n`);
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
