import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3131;
const puertoChrome = 9251;
const perfil = path.join(raiz, `.tmp-nr0811-${Date.now()}`);
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

async function login() {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  });
  if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión (${respuesta.status}).`);
  return respuesta.json();
}

async function borrarPerfil() {
  for (let intento = 0; intento < 10; intento += 1) {
    try { await rm(perfil, { recursive: true, force: true }); return; }
    catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code) || intento === 9) throw error;
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
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const sesion = await login();
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
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.method === 'Runtime.exceptionThrown') errores.push(mensaje.params.exceptionDetails.text);
    if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') errores.push('console.error');
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
  async function navegar(ruta, condicion = "document.querySelector('#menu-lateral')") {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(sesion.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(sesion.usuario))}); localStorage.removeItem('menu.vista:${sesion.usuario.id}'); true`);
  await navegar('/index.html', "document.body.classList.contains('menu-contraido')");

  const inicial = await evaluar(`(() => {
    const menu = document.querySelector('#menu-lateral').getBoundingClientRect();
    const contenido = document.querySelector('#contenido').getBoundingClientRect();
    const enlaces = [...document.querySelectorAll('.menu-lateral__enlace')];
    return {
      vista: document.querySelector('#menu-lateral').dataset.vista,
      menuAncho: menu.width,
      separado: menu.right <= contenido.left,
      etiquetas: enlaces.every((enlace) => enlace.getAttribute('aria-label') && enlace.title),
      textosOcultos: enlaces.every((enlace) => getComputedStyle(enlace.querySelector('.menu-lateral__texto')).position === 'absolute'),
      accion: document.querySelector('#btn-menu-movil').getAttribute('aria-label')
    };
  })()`);
  if (inicial.vista !== 'contraido' || !inicial.separado || !inicial.etiquetas || !inicial.textosOcultos) throw new Error('El estado contraído inicial no es accesible o invade el contenido.');

  await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 90, y: 240 });
  await hasta("document.body.classList.contains('menu-temporal-expandido') && document.querySelector('#menu-lateral').getBoundingClientRect().width > 200", 'El menú no se expandió al acercar el cursor.');
  const expansionAutomatica = await evaluar(`(() => {
    const menu = document.querySelector('#menu-lateral').getBoundingClientRect();
    const contenido = document.querySelector('#contenido').getBoundingClientRect();
    const textos = [...document.querySelectorAll('.menu-lateral__texto')];
    const nombres = textos.map((n) => n.textContent.trim());
    const esperados = ['Inicio', 'Explora y aprende', 'Mis asignaturas', 'Actividades', 'Foros', 'Participantes'];
    return {
      temporal: document.querySelector('#menu-lateral').dataset.expandidoTemporal,
      nombres: esperados.every((nombre) => nombres.includes(nombre)),
      completos: textos.every((n) => n.getBoundingClientRect().width > 1 && n.scrollWidth <= n.clientWidth + 1),
      noCubre: menu.right <= contenido.left,
      fijarVisible: document.querySelector('#btn-menu-fijar').getBoundingClientRect().width > 0
    };
  })()`);
  if (expansionAutomatica.temporal !== 'true' || !expansionAutomatica.nombres || !expansionAutomatica.completos || !expansionAutomatica.noCubre || !expansionAutomatica.fijarVisible) {
    throw new Error(`La expansión automática no muestra el menú completo: ${JSON.stringify(expansionAutomatica)}`);
  }

  await evaluar("document.querySelector('#btn-menu-fijar').click(); true");
  await hasta("document.querySelector('#menu-lateral').dataset.vista === 'expandido' && document.querySelector('#btn-menu-fijar').getAttribute('aria-pressed') === 'true'", 'El botón no fijó el menú expandido.');
  const fijacion = await evaluar("localStorage.getItem('menu.vista:' + JSON.parse(sessionStorage.getItem('usuario')).id) === 'expandido'");
  if (!fijacion) throw new Error('La fijación del menú no se guardó para el estudiante.');
  await evaluar("document.querySelector('#btn-menu-fijar').click(); document.activeElement.blur(); true");
  await enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 240 });
  await hasta("document.body.classList.contains('menu-contraido') && !document.body.classList.contains('menu-temporal-expandido') && document.querySelector('#menu-lateral').getBoundingClientRect().width < 100", 'El menú no volvió a contraerse al retirar el cursor.');

  await evaluar("document.querySelector('#btn-menu-movil').click(); true");
  await hasta("document.body.classList.contains('menu-oculto')", 'No se ocultó el menú.');
  await evaluar("document.querySelector('#btn-menu-movil').click(); true");
  await hasta("document.querySelector('#menu-lateral').dataset.vista === 'expandido'", 'No volvió a mostrarse expandido.');
  await navegar('/paginas/explorar.html', "document.querySelector('#menu-lateral')?.dataset.vista === 'expandido'");
  const persistenciaExpandido = await evaluar("localStorage.getItem('menu.vista:' + JSON.parse(sessionStorage.getItem('usuario')).id) === 'expandido'");
  if (!persistenciaExpandido) throw new Error('No persistió el estado expandido entre secciones.');

  await evaluar("document.querySelector('#btn-menu-movil').click(); true");
  await hasta("document.body.classList.contains('menu-contraido')", 'No se contrajo el menú expandido.');
  await navegar('/paginas/foros.html', "document.body.classList.contains('menu-contraido')");
  await evaluar("document.querySelector('.avatar-guia__minimizado:not([hidden]), .avatar-guia__mostrar:not([hidden])')?.click(); true");
  await hasta("document.body.classList.contains('avatar-guia-abierta')", 'Neuri no abrió en escritorio.');
  const escritorio = await evaluar(`(() => {
    const menu = document.querySelector('#menu-lateral').getBoundingClientRect();
    const contenido = document.querySelector('#contenido').getBoundingClientRect();
    const neuri = document.querySelector('.avatar-guia').getBoundingClientRect();
    return { menuContenido: menu.right <= contenido.left, menuNeuri: menu.right <= neuri.left, desborde: document.documentElement.scrollWidth > innerWidth };
  })()`);
  if (!escritorio.menuContenido || !escritorio.menuNeuri || escritorio.desborde) throw new Error('El menú interfiere con el contenido o Neuri en escritorio.');

  await enviar('Emulation.setDeviceMetricsOverride', { width: 800, height: 900, deviceScaleFactor: 1, mobile: false });
  await hasta("innerWidth === 800 && document.body.classList.contains('menu-contraido')", 'No se adaptó a tableta.');
  const tableta = await evaluar(`(() => {
    const menu = document.querySelector('#menu-lateral').getBoundingClientRect();
    const neuri = document.querySelector('.avatar-guia').getBoundingClientRect();
    return { anchoMenu: menu.width, separados: menu.right <= neuri.left, desborde: document.documentElement.scrollWidth > innerWidth };
  })()`);
  if (!tableta.separados || tableta.desborde) throw new Error('El menú produce interferencia o desborde en tableta.');

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await hasta("innerWidth === 360 && !document.querySelector('#menu-lateral').classList.contains('abierto')", 'El cajón móvil no inició cerrado.');
  await evaluar("document.querySelector('#btn-menu-movil').click(); true");
  await hasta("document.body.classList.contains('menu-movil-abierto') && document.querySelector('#menu-lateral').getBoundingClientRect().left >= -1", 'El cajón móvil no abrió.');
  const movilAbierto = await evaluar(`(() => {
    const menu = document.querySelector('#menu-lateral').getBoundingClientRect();
    const cerrar = document.querySelector('#btn-menu-cerrar').getBoundingClientRect();
    return {
      dentro: menu.left >= -1 && menu.right <= innerWidth + 1,
      menu: { left: menu.left, right: menu.right, ancho: menu.width, viewport: innerWidth },
      cerrar: cerrar.width >= 44 && cerrar.height >= 44,
      neuriOculto: getComputedStyle(document.querySelector('.avatar-guia')).visibility === 'hidden',
      expandido: document.querySelector('#btn-menu-movil').getAttribute('aria-expanded'),
      desborde: document.documentElement.scrollWidth > innerWidth
    };
  })()`);
  if (!movilAbierto.dentro || !movilAbierto.cerrar || !movilAbierto.neuriOculto || movilAbierto.expandido !== 'true' || movilAbierto.desborde) throw new Error(`El cajón móvil no es seguro o accesible: ${JSON.stringify(movilAbierto)}`);
  await evaluar("document.querySelector('#btn-menu-cerrar').click(); true");
  await hasta("!document.body.classList.contains('menu-movil-abierto')", 'El botón interno no cerró el cajón.');
  const movilCerrado = await evaluar("!document.querySelector('#menu-lateral').classList.contains('abierto') && getComputedStyle(document.querySelector('.avatar-guia')).visibility !== 'hidden'");
  if (!movilCerrado) throw new Error('Neuri no volvió a estar disponible al cerrar el menú.');
  await evaluar("document.querySelector('#btn-menu-movil').click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
  await hasta("!document.querySelector('#menu-lateral').classList.contains('abierto')", 'Escape no cerró el cajón móvil.');

  if (errores.length) throw new Error(`Errores de consola: ${errores.join('; ')}`);
  process.stdout.write(`${JSON.stringify({ inicial, expansionAutomatica, fijacion, persistenciaExpandido, escritorio, tableta, movilAbierto, movilCerrado, erroresConsola: errores }, null, 2)}\n`);
} finally {
  try { socket?.close(); } catch { /* sin conexión */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(300);
  for (const [ruta, contenido] of respaldo) {
    if (contenido === null) await rm(ruta, { force: true });
    else await writeFile(ruta, contenido);
  }
  await borrarPerfil();
}
