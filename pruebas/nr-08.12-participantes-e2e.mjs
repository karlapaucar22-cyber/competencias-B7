import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3132;
const puertoChrome = 9252;
const perfil = path.join(raiz, `.tmp-nr0812-${Date.now()}`);
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

async function login(correo) {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, clave: 'Demo12345' })
  });
  if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión con ${correo}.`);
  return respuesta.json();
}

async function participantes(token) {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}/api/participantes/asi_000001`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const datos = await respuesta.json();
  return { estado: respuesta.status, datos };
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

  const [estudiante, ajeno] = await Promise.all([
    login('estudiante6@demo.ec'),
    login('admin@demo.ec')
  ]);
  const [permitido, bloqueado] = await Promise.all([
    participantes(estudiante.token),
    participantes(ajeno.token)
  ]);
  if (permitido.estado !== 200 || permitido.datos.docente?.nombre !== 'Karla Paucar' || permitido.datos.totalEstudiantes !== 8) {
    throw new Error(`El API no devolvió el distributivo real: ${JSON.stringify(permitido)}`);
  }
  if (bloqueado.estado !== 403) throw new Error(`Una cuenta ajena obtuvo estado ${bloqueado.estado}.`);
  const textoApi = JSON.stringify(permitido.datos);
  if (/correo|telefono|clave|consentimiento|@demo\.ec/i.test(textoApi)) throw new Error('La respuesta expuso datos personales.');

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
  async function navegar(ruta, condicion) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(estudiante.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(estudiante.usuario))}); true`);
  await navegar('/paginas/participantes.html', "document.querySelectorAll('#listaEstudiantes > li').length === 8");
  const escritorio = await evaluar(`(() => ({
    menu: document.querySelector('a[href="/paginas/participantes.html"]')?.getAttribute('aria-label'),
    actual: document.querySelector('a[href="/paginas/participantes.html"]')?.getAttribute('aria-current'),
    docente: document.querySelector('#docenteResponsable').innerText.trim(),
    total: document.querySelector('#contadorEstudiantes').textContent.trim(),
    tarjetas: document.querySelectorAll('#listaEstudiantes > li').length,
    avatares: document.querySelectorAll('.participante__avatar').length,
    roles: [...document.querySelectorAll('.participante__rol')].map((n) => n.textContent.trim()),
    nombres: [...document.querySelectorAll('.participante__nombre')].map((n) => n.textContent.trim()),
    privado: !/@demo\.ec|correo|teléfono/i.test(document.querySelector('#contenido').innerText),
    desborde: document.documentElement.scrollWidth > innerWidth
  }))()`);
  if (escritorio.menu !== 'Participantes' || escritorio.actual !== 'page' || !escritorio.docente.includes('Karla Paucar')
    || escritorio.tarjetas !== 8 || escritorio.avatares !== 9 || escritorio.roles.filter((rol) => rol === 'Estudiante').length !== 8
    || escritorio.roles.filter((rol) => rol === 'Docente').length !== 1 || !escritorio.nombres.includes('Prueba NR028')
    || !escritorio.nombres.includes('Felipe Arévalo') || !escritorio.privado || escritorio.desborde) {
    throw new Error(`Vista de escritorio incorrecta: ${JSON.stringify(escritorio)}`);
  }

  await evaluar("document.querySelector('#buscarParticipante').value = 'michelle'; document.querySelector('#buscarParticipante').dispatchEvent(new Event('input', { bubbles: true })); true");
  const busqueda = await evaluar(`({
    visibles: document.querySelectorAll('#listaEstudiantes > li').length,
    nombre: document.querySelector('#listaEstudiantes').innerText.trim(),
    contador: document.querySelector('#contadorEstudiantes').textContent.trim()
  })`);
  if (busqueda.visibles !== 1 || !/Michelle Cruzatti/i.test(busqueda.nombre) || busqueda.contador !== '1 de 8 estudiantes') {
    throw new Error(`El buscador no filtró correctamente: ${JSON.stringify(busqueda)}`);
  }

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await evaluar("document.querySelector('#buscarParticipante').value = ''; document.querySelector('#buscarParticipante').dispatchEvent(new Event('input', { bubbles: true })); true");
  await hasta("innerWidth === 360 && document.querySelectorAll('#listaEstudiantes > li').length === 8", 'No se adaptó a móvil.');
  const movil = await evaluar(`({
    ancho: innerWidth,
    desborde: document.documentElement.scrollWidth > innerWidth,
    unaColumna: getComputedStyle(document.querySelector('#listaEstudiantes')).gridTemplateColumns.split(' ').length === 1,
    buscador: document.querySelector('#buscarParticipante').getBoundingClientRect().right <= innerWidth
  })`);
  if (movil.desborde || !movil.unaColumna || !movil.buscador) throw new Error(`Vista móvil incorrecta: ${JSON.stringify(movil)}`);
  if (errores.length) throw new Error(`Errores de consola: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ api: { docente: permitido.datos.docente.nombre, total: permitido.datos.totalEstudiantes, ajeno: bloqueado.estado, datosSensibles: false }, escritorio, busqueda, movil, erroresConsola: errores }, null, 2)}\n`);
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
