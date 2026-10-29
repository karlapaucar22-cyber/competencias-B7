import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3122;
const puertoChrome = 9242;
const perfil = path.join(raiz, `.tmp-nr082-${Date.now()}`);
const mutables = ['sesiones.json', 'bitacora.jsonl'];
const respaldo = new Map();
for (const nombre of mutables) {
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
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/api/neuroritmo/presentacion`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const presentacion = await fetch(`http://127.0.0.1:${puerto}/api/neuroritmo/presentacion`).then((r) => r.json());
  const principal = presentacion.experiencia.cancionPrincipal;
  if (principal?.id !== 'can_000001') throw new Error('La presentación no resolvió el registro principal esperado.');
  const login = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  });
  if (!login.ok) throw new Error(`No se pudo iniciar sesión (${login.status}).`);
  const { token, usuario } = await login.json();
  if (usuario?.rol !== 'estudiante') throw new Error('La cuenta de prueba no tiene rol estudiante.');

  const destinos = await fetch(`http://127.0.0.1:${puertoChrome}/json/list`).then((r) => r.json());
  const destino = destinos.find((pagina) => pagina.type === 'page' && !pagina.url.startsWith('chrome'));
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
  async function estadoAudio(selector) {
    return evaluar(`(() => {
      const audio = document.querySelector(${JSON.stringify(selector)});
      return {
        src: new URL(audio.currentSrc || audio.src).pathname,
        controles: audio.controls,
        silenciado: audio.muted,
        duracion: audio.duration,
        transcripcion: Boolean(audio.closest('[data-cancion-principal]')?.querySelector('details')),
        ancho: innerWidth,
        contenido: document.documentElement.scrollWidth
      };
    })()`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await navegar('/index.html', "document.querySelector('[data-cancion-principal] audio')");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
  const opciones = await evaluar(`fetch('/api/neuroritmo', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
    .then((r) => r.json()).then((d) => d.experiencia.misiones.find((m) => m.id === 'm3').recursosSonoros)`);
  const canciones = opciones.filter((item) => /canci[oó]n/i.test(`${item.id} ${item.texto}`));
  if (canciones.length !== 1 || canciones[0].cancionId !== principal.id) {
    throw new Error('La matriz no conserva únicamente la canción principal.');
  }
  await hasta("document.querySelector('[data-cancion-principal] audio').readyState >= 1", 'El audio de Inicio no cargó metadatos.');
  const inicio = await estadoAudio('[data-cancion-principal] audio');

  await navegar('/paginas/explorar.html', "document.querySelector('[data-cancion-principal] audio')");
  await hasta("document.querySelector('[data-cancion-principal] audio').readyState >= 1", 'El audio de Explora no cargó metadatos.');
  const explora = await estadoAudio('[data-cancion-principal] audio');

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await navegar(`/paginas/canciones.html?cancionId=${principal.id}`, "document.querySelector('#reproductorActivo')?.style.display === 'block'");
  await hasta("document.querySelector('#audioNativo').readyState >= 1", 'El catálogo no cargó el MP3 principal.');
  const catalogo = await evaluar(`(() => {
    const audio = document.querySelector('#audioNativo');
    return {
      src: new URL(audio.currentSrc || audio.src).pathname,
      titulo: document.querySelector('#cancionTitulo').textContent.trim(),
      silenciado: audio.muted,
      duracion: audio.duration,
      lineas: document.querySelectorAll('#cajaLetra .linea-lrc').length,
      principal: [...document.querySelectorAll('.insignia')].some((el) => el.textContent.trim() === 'Canción principal'),
      ancho: innerWidth,
      contenido: document.documentElement.scrollWidth
    };
  })()`);
  await evaluar("document.querySelector('#audioNativo').play().then(() => true)");
  await hasta("document.querySelector('#audioNativo').currentTime > 0", 'El reproductor no avanzó.');
  const reproduccion = await evaluar(`(() => {
    const audio = document.querySelector('#audioNativo');
    const avanzó = audio.currentTime > 0 && !audio.paused;
    document.querySelector('#btnPlayPause').click();
    return { avanzó, pausado: audio.paused };
  })()`);

  const estados = { inicio, explora, catalogo };
  for (const [vista, estado] of Object.entries(estados)) {
    if (estado.src !== principal.audio) throw new Error(`${vista} usa otro archivo: ${estado.src}`);
    if (!(estado.duracion > 30)) throw new Error(`${vista} no reconoce un audio reproducible.`);
    if (!estado.silenciado) throw new Error(`${vista} no inicia silenciado.`);
    if (estado.contenido > estado.ancho) throw new Error(`${vista} desborda horizontalmente.`);
  }
  if (!inicio.controles || !explora.controles || !inicio.transcripcion || !explora.transcripcion) {
    throw new Error('Faltan controles o transcripción en un acceso integrado.');
  }
  if (catalogo.titulo !== principal.titulo || catalogo.lineas < 8 || !catalogo.principal) {
    throw new Error('El catálogo no muestra el registro principal con su letra sincronizada.');
  }
  if (!reproduccion.avanzó || !reproduccion.pausado) throw new Error('Falla reproducir o pausar en el catálogo.');

  process.stdout.write(`${JSON.stringify({ registro: principal, vistas: estados, reproduccion }, null, 2)}\n`);
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
