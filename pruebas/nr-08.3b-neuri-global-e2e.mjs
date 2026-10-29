import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3131;
const puertoChrome = 9251;
const perfil = path.join(raiz, `.tmp-nr083b-${Date.now()}`);
const mutables = ['sesiones.json', 'bitacora.jsonl'];
const respaldo = new Map();
for (const nombre of mutables) {
  const ruta = path.join(raiz, 'datos', nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let servidor;
let chrome;
let socket;

async function esperarUrl(url) {
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondió ${url}`);
}

async function borrarPerfil() {
  for (let i = 0; i < 10; i += 1) {
    try { await rm(perfil, { recursive: true, force: true }); return; } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code) || i === 9) throw error;
      await esperar(300);
    }
  }
}

try {
  servidor = spawn(process.execPath, ['servidor/server.js'], {
    cwd: raiz, env: { ...process.env, PUERTO: String(puerto), TZ: 'America/Guayaquil' }, stdio: 'ignore'
  });
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const acceso = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  }).then((respuesta) => respuesta.json());
  if (!acceso.token) throw new Error('No se pudo iniciar la sesión estudiantil.');

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
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.method === 'Runtime.exceptionThrown') errores.push(mensaje.params.exceptionDetails.text);
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const pendiente = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    mensaje.error ? pendiente.reject(new Error(mensaje.error.message)) : pendiente.resolve(mensaje.result);
  });
  const enviar = (method, params = {}) => {
    const id = ++secuencia;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
  };
  async function evaluar(expression) {
    const resultado = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text);
    return resultado.result.value;
  }
  async function hasta(expression, mensaje) {
    for (let i = 0; i < 180; i += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function navegar(ruta) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta("document.readyState === 'complete' && document.querySelector('.avatar-guia')", `Neuri no apareció en ${ruta}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__vozNeuri = { lecturas: 0, pausas: 0, reanudaciones: 0, cancelaciones: 0 };
    class Frase { constructor(texto) { this.text = texto; } }
    const voz = {
      speaking: false, getVoices: () => [],
      speak() { this.speaking = true; window.__vozNeuri.lecturas += 1; },
      cancel() { this.speaking = false; window.__vozNeuri.cancelaciones += 1; },
      pause() { this.speaking = false; window.__vozNeuri.pausas += 1; },
      resume() { this.speaking = true; window.__vozNeuri.reanudaciones += 1; }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: voz });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Frase });
  })();` });

  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await navegar('/index.html');
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(acceso.token)});
    sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(acceso.usuario))});
    localStorage.removeItem('avatar.voz'); localStorage.removeItem('avatar.vista'); localStorage.removeItem('avatar.oculto');
    sessionStorage.removeItem('avatar.texto'); true`);
  await navegar('/index.html');

  const inicio = await evaluar(`({
    cantidad: document.querySelectorAll('.avatar-guia').length,
    vista: document.querySelector('.avatar-guia').dataset.vista,
    voz: document.querySelector('.avatar-guia__voz').getAttribute('aria-pressed'),
    minimizadoVisible: !document.querySelector('.avatar-guia__minimizado').hidden
  })`);
  if (inicio.cantidad !== 1 || inicio.vista !== 'minimizado' || inicio.voz !== 'false' || !inicio.minimizadoVisible) {
    throw new Error(`Estado inicial incorrecto: ${JSON.stringify(inicio)}`);
  }

  await evaluar("document.querySelector('.avatar-guia__minimizado').click()");
  await hasta("document.querySelector('.avatar-guia').dataset.vista === 'abierto'", 'No se abrió el panel.');
  const escritorio = await evaluar(`(() => {
    const panel = document.querySelector('.avatar-guia__panel').getBoundingClientRect();
    const contenido = document.querySelector('#contenido').getBoundingClientRect();
    return { panelIzquierda: panel.left, contenidoDerecha: contenido.right, transcripcion: document.querySelector('.avatar-guia__texto').textContent };
  })()`);
  if (escritorio.contenidoDerecha > escritorio.panelIzquierda + 1 || !escritorio.transcripcion.includes('Centro de Estudio Sonoro')) {
    throw new Error(`El panel cubre contenido en computador: ${JSON.stringify(escritorio)}`);
  }
  await evaluar("document.querySelector('.avatar-guia__voz').click(); document.querySelector('.avatar-guia__minimizar').click()");

  await navegar('/paginas/explorar.html');
  const persistencia = await evaluar(`({
    cantidad: document.querySelectorAll('.avatar-guia').length,
    vista: document.querySelector('.avatar-guia').dataset.vista,
    voz: document.querySelector('.avatar-guia__voz').getAttribute('aria-pressed'),
    texto: sessionStorage.getItem('avatar.texto')
  })`);
  if (persistencia.cantidad !== 1 || persistencia.vista !== 'minimizado' || persistencia.voz !== 'true' || !persistencia.texto?.includes('Centro de Estudio Sonoro')) {
    throw new Error(`No se conservaron estado, voz o transcripción: ${JSON.stringify(persistencia)}`);
  }

  await evaluar("document.querySelector('.avatar-guia__minimizado').click(); document.querySelector('.avatar-guia__minimizar').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await hasta("document.querySelector('.avatar-guia').dataset.vista === 'minimizado'", 'Escape no minimizó el panel.');
  await evaluar("document.querySelector('.avatar-guia__minimizado').click(); document.querySelector('.avatar-guia__ocultar').click()");
  await navegar('/paginas/canciones.html');
  if (!await evaluar("document.querySelector('.avatar-guia').dataset.vista === 'oculto' && !document.querySelector('.avatar-guia__mostrar').hidden")) {
    throw new Error('El estado oculto no persistió al cambiar de sección.');
  }
  await evaluar("document.querySelector('.avatar-guia__mostrar').click(); document.querySelector('.avatar-guia__minimizar').click()");

  await navegar('/index.html');
  const rutasMenu = await evaluar(`[...new Set([...document.querySelectorAll('#menu-lateral a[href]')]
    .map((a) => new URL(a.href).pathname).filter((ruta) => ruta.endsWith('.html')))]`);
  const rutas = [...new Set([...rutasMenu, '/paginas/autodiagnostico-musical.html'])];
  for (const ruta of rutas) {
    await navegar(ruta);
    const cantidad = await evaluar("document.querySelectorAll('.avatar-guia').length");
    if (cantidad !== 1) throw new Error(`Se encontraron ${cantidad} asistentes en ${ruta}.`);
  }

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await navegar('/paginas/autodiagnostico-musical.html');
  await evaluar("localStorage.setItem('avatar.vista', 'abierto'); location.reload()");
  await hasta("document.querySelector('.avatar-guia')?.dataset.vista === 'abierto'", 'No se recuperó el panel abierto en móvil.');
  await evaluar("scrollTo(0, document.documentElement.scrollHeight)");
  const movil = await evaluar(`(() => {
    const panel = document.querySelector('.avatar-guia__panel').getBoundingClientRect();
    const avatar = document.querySelector('.avatar-guia');
    const interactivos = [...document.querySelectorAll('#contenido a, #contenido button, #contenido input, #contenido select, #contenido textarea')]
      .filter((n) => !avatar.contains(n) && n.getClientRects().length && !n.disabled);
    const cruza = interactivos.some((n) => {
      const r = n.getBoundingClientRect();
      return r.bottom > panel.top && r.top < panel.bottom && r.right > panel.left && r.left < panel.right;
    });
    return {
      vista: avatar.dataset.vista,
      dentro: panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cruza,
      controles: [...avatar.querySelectorAll('button:not([hidden])')].map((b) => b.getBoundingClientRect().height)
    };
  })()`);
  if (movil.vista !== 'abierto' || !movil.dentro || movil.desborde || movil.cruza || movil.controles.some((alto) => alto < 40)) {
    throw new Error(`El panel móvil interfiere con la actividad: ${JSON.stringify(movil)}`);
  }
  if (errores.length) throw new Error(`Errores de navegador: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ inicio, escritorio, persistencia, paginasVerificadas: rutas.length, movil, erroresConsola: errores }, null, 2)}\n`);
} finally {
  try { socket?.close(); } catch { /* sin conexión */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(400);
  for (const [ruta, contenido] of respaldo) {
    if (contenido === null) await rm(ruta, { force: true });
    else await writeFile(ruta, contenido);
  }
  await borrarPerfil();
}
