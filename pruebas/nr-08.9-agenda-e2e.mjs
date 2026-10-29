import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3129;
const puertoChrome = 9249;
const perfil = path.join(raiz, `.tmp-nr089-${Date.now()}`);
const mutables = ['agenda.json', 'sesiones.json', 'bitacora.jsonl'];
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
  for (let i = 0; i < 100; i += 1) {
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
  if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión con ${correo} (${respuesta.status}).`);
  return respuesta.json();
}

async function borrarPerfil() {
  for (let intento = 0; intento < 10; intento += 1) {
    try { await rm(perfil, { recursive: true, force: true }); return; } catch (err) {
      if (!['EBUSY', 'EPERM'].includes(err.code) || intento === 9) throw err;
      await esperar(300);
    }
  }
}

try {
  servidor = spawn(process.execPath, ['servidor/server.js'], {
    cwd: raiz, env: { ...process.env, PUERTO: String(puerto), TZ: 'UTC' }, stdio: 'ignore'
  });
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);
  const [estudiante, docente] = await Promise.all([
    login('estudiante6@demo.ec'), login('docente1@demo.ec')
  ]);

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
    for (let i = 0; i < 180; i += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function sesion(sesionActual, ancho, alto) {
    await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 640 });
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/index.html` });
    await hasta("document.readyState === 'complete'", 'No cargó Inicio.');
    await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(sesionActual.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(sesionActual.usuario))}); true`);
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/paginas/agenda.html` });
    try {
      await hasta("(document.querySelector('.fc') && document.querySelectorAll('.fc-event').length >= 2) || document.querySelectorAll('.agenda-calendario-alterno .agenda-item').length === 6", 'No se renderizó la agenda académica.');
    } catch (err) {
      const diagnostico = await evaluar(`({
        fullCalendar: Boolean(window.FullCalendar),
        eventos: document.querySelectorAll('.fc-event').length,
        estado: document.querySelector('#agendaEstado')?.textContent,
        calendario: document.querySelector('#calendario')?.textContent,
        cuerpo: document.body.innerText.slice(0, 500)
      })`);
      throw new Error(`${err.message} ${JSON.stringify(diagnostico)} Consola: ${errores.join('; ')}`);
    }
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Madrid' });

  await sesion(estudiante, 360, 800);
  const usaFullCalendar = await evaluar("Boolean(document.querySelector('.fc'))");
  const listaMovil = await evaluar("Boolean(document.querySelector('.fc-list') || document.querySelector('.agenda-calendario-alterno'))");
  if (usaFullCalendar) {
    await evaluar("document.querySelector('.fc-dayGridMonth-button').click(); true");
    await hasta("document.querySelectorAll('.fc-event').length === 6", 'No aparecieron los seis hitos en la vista mensual.');
  }
  const vistaEstudiante = await evaluar(`({
    tituloMes: document.querySelector('.fc-toolbar-title, #agendaMesAlterno')?.textContent,
    eventos: document.querySelectorAll('.fc-event').length || document.querySelectorAll('.agenda-calendario-alterno .agenda-item').length,
    inicio: document.querySelector('.agenda-contexto')?.innerText,
    desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`);
  if (!listaMovil || !/noviembre de 2026/i.test(vistaEstudiante.tituloMes) || vistaEstudiante.eventos !== 6) throw new Error('El calendario no abrió en noviembre de 2026 con vista móvil adaptada.');
  if (!vistaEstudiante.inicio.includes('America/Guayaquil') || vistaEstudiante.desborda) throw new Error('Falla de zona horaria o adaptación móvil.');
  await evaluar(`(usa = [...document.querySelectorAll('.fc-event')].find((e) => e.getAttribute('aria-label')?.includes('Misión 1')) || [...document.querySelectorAll('.agenda-calendario-alterno .agenda-item__titulo')].find((e) => e.textContent.includes('Misión 1')), usa.click(), true)`);
  await hasta("document.querySelector('.agenda-detalle')", 'No abrió el detalle estudiantil.');
  const detalle = await evaluar(`({
    texto: document.querySelector('.agenda-detalle').innerText,
    href: document.querySelector('.agenda-detalle a')?.getAttribute('href')
  })`);
  if (!detalle.texto.includes('9 de noviembre de 2026, 16:00') || !detalle.texto.includes('Propuesta editable') || !detalle.texto.includes('Karla Paucar')) {
    throw new Error(`El detalle no muestra fecha, hora, estado y atribución esperados en Ecuador: ${JSON.stringify(detalle)}`);
  }
  if (detalle.href !== '/index.html#mision-m1') throw new Error('El enlace de Misión 1 es incorrecto.');

  const intentoEstudiante = await fetch(`http://127.0.0.1:${puerto}/api/agenda/age_000003`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${estudiante.token}` },
    body: JSON.stringify({ inicio: '2026-11-09T17:00:00-05:00' })
  });
  if (intentoEstudiante.status !== 403) throw new Error(`El estudiante pudo editar la propuesta (${intentoEstudiante.status}).`);

  await sesion(docente, 1366, 900);
  await evaluar(`(usa = [...document.querySelectorAll('.fc-event')].find((e) => e.getAttribute('aria-label')?.includes('Misión 1')) || [...document.querySelectorAll('.agenda-calendario-alterno .agenda-item__titulo')].find((e) => e.textContent.includes('Misión 1')), usa.click(), true)`);
  await hasta("document.querySelector('#evInicio')", 'No abrió el editor docente.');
  const editor = await evaluar(`({
    inicio: document.querySelector('#evInicio').value,
    estado: document.querySelector('#evEstadoPlanificacion').value,
    responsable: document.querySelector('#evResponsable').value,
    enlace: document.querySelector('#evEnlace').value
  })`);
  if (editor.inicio !== '2026-11-09T16:00' || editor.estado !== 'propuesta' || editor.responsable !== 'Karla Paucar') {
    throw new Error('El editor docente no conserva la hora de Ecuador o los metadatos del hito.');
  }
  await evaluar(`document.querySelector('#evInicio').value = '2026-11-09T17:00'; [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Guardar cambios').click(); true`);
  await hasta("!document.querySelector('#evInicio')", 'El docente no pudo guardar la reprogramación.');
  const agendaEditada = await fetch(`http://127.0.0.1:${puerto}/api/agenda`, { headers: { Authorization: `Bearer ${docente.token}` } }).then((r) => r.json());
  if (agendaEditada.find((e) => e.id === 'age_000003')?.inicio !== '2026-11-09T17:00:00-05:00') throw new Error('La fecha propuesta no quedó editable por el docente.');

  for (const enlace of ['/index.html#instrucciones', '/paginas/explorar.html#ruta-academica', '/index.html#mision-m1', '/index.html#mision-m2', '/index.html#mision-m3', '/index.html#resultados']) {
    const respuesta = await fetch(`http://127.0.0.1:${puerto}${enlace}`);
    if (!respuesta.ok) throw new Error(`Enlace roto: ${enlace}`);
  }
  if (errores.length) throw new Error(`Errores de consola: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ vistaEstudiante, detalle, editor, estudianteNoEdita: true, docenteEdita: true, enlacesVerificados: 6, erroresConsola: errores }, null, 2)}\n`);
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
