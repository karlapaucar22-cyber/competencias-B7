import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3130;
const puertoChrome = 9250;
const perfil = path.join(raiz, `.tmp-nr083a-${Date.now()}`);
const mutables = ['autodiagnosticos-musicales.json', 'sesiones.json', 'bitacora.jsonl', 'intentos.json', 'logros.json'];
const respaldo = new Map();
for (const nombre of mutables) {
  const ruta = path.join(datosDir, nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}
const intentosAntes = respaldo.get(path.join(datosDir, 'intentos.json'));

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
  if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión con ${correo}.`);
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
  const [estudiante, otroEstudiante] = await Promise.all([
    login('estudiante6@demo.ec'), login('estudiante5@demo.ec')
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
  async function navegar(ruta, condicion) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(estudiante.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(estudiante.usuario))}); true`);

  await navegar('/paginas/explorar.html#seccion-recursos-neuroritmo', "document.querySelectorAll('.explorar-recurso').length >= 3");
  const enlaceMatriz = await evaluar(`[...document.querySelectorAll('.explorar-recurso')].find((n) => n.querySelector('h3')?.textContent.includes('Matriz'))?.querySelector('a')?.getAttribute('href')`);
  if (enlaceMatriz) throw new Error('Explora y aprende todavía enlaza la matriz retirada.');
  const recursosEscritorio = await evaluar(`({
    tarjetas: [...document.querySelectorAll('.explorar-recurso')].map((n) => ({ titulo: n.querySelector('h3')?.textContent.trim(), href: n.querySelector('a')?.href || '' })),
    columnas: new Set([...document.querySelectorAll('.explorar-recurso')].map((n) => Math.round(n.getBoundingClientRect().left))).size,
    desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`);
  if (recursosEscritorio.tarjetas.length !== 3 || recursosEscritorio.columnas !== 3 || recursosEscritorio.desborda) {
    throw new Error(`Las tarjetas restantes no se reorganizaron en escritorio: ${JSON.stringify(recursosEscritorio)}`);
  }
  for (const recurso of recursosEscritorio.tarjetas) {
    if (!recurso.titulo || !recurso.href) throw new Error('Un recurso restante carece de título o enlace.');
    const url = new URL(recurso.href);
    if (url.origin === `http://127.0.0.1:${puerto}` && !(await fetch(url)).ok) throw new Error(`Enlace interno roto: ${recurso.href}`);
    if (url.origin !== `http://127.0.0.1:${puerto}` && url.protocol !== 'https:') throw new Error(`Enlace externo inseguro: ${recurso.href}`);
  }

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await navegar('/paginas/explorar.html#seccion-recursos-neuroritmo', "document.querySelectorAll('.explorar-recurso').length === 3");
  const recursosMovil = await evaluar(`({
    tarjetas: document.querySelectorAll('.explorar-recurso').length,
    columnas: new Set([...document.querySelectorAll('.explorar-recurso')].map((n) => Math.round(n.getBoundingClientRect().left))).size,
    desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`);
  if (recursosMovil.tarjetas !== 3 || recursosMovil.columnas !== 1 || recursosMovil.desborda) {
    throw new Error(`Las tarjetas restantes no se presentan correctamente en móvil: ${JSON.stringify(recursosMovil)}`);
  }

  await navegar('/paginas/autodiagnostico-musical.html', "document.querySelectorAll('#listaPreguntas fieldset').length === 8 && document.querySelector('#cancionPrincipal audio')");
  await hasta("document.querySelector('#cancionPrincipal audio').readyState >= 1", 'No cargaron los metadatos de la canción principal.');
  const vistaInicial = await evaluar(`({
    preguntas: document.querySelectorAll('#listaPreguntas fieldset').length,
    audios: document.querySelectorAll('audio').length,
    audio: document.querySelector('audio').getAttribute('src'),
    silenciado: document.querySelector('audio').muted,
    filasOriginales: document.querySelectorAll('.autodiagnostico__tabla tbody tr').length,
    misiones: [...document.querySelectorAll('a[href*="mision-m"]')].map((a) => a.getAttribute('href')),
    desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    anchos: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    fuera: [...document.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map((n) => ({ etiqueta: n.tagName, clase: n.className, derecha: n.getBoundingClientRect().right, ancho: n.scrollWidth }))
  })`);
  if (vistaInicial.preguntas !== 8 || vistaInicial.audios !== 1 || !vistaInicial.audio.includes('d62f8072f4ff3ae1d593aa33239b09f5.mp3') || !vistaInicial.silenciado) {
    throw new Error('La matriz no usa exclusivamente la canción principal silenciada.');
  }
  if (vistaInicial.filasOriginales !== 8 || vistaInicial.desborda) throw new Error(`La matriz original o la vista móvil no se presenta correctamente: ${JSON.stringify(vistaInicial)}`);
  if (JSON.stringify(vistaInicial.misiones) !== JSON.stringify(['/index.html#mision-m1', '/index.html#mision-m2', '/index.html#mision-m3'])) {
    throw new Error('Faltan enlaces a las tres misiones.');
  }

  await evaluar(`(() => {
    document.querySelector('input[name="contexto"][value="lectura"]').checked = true;
    document.querySelector('input[name="condicion"][value="cancion-principal"]').checked = true;
    [...document.querySelectorAll('#listaPreguntas fieldset')].forEach((fieldset, indice) => {
      fieldset.querySelectorAll('input')[indice % 4].checked = true;
    });
    document.querySelector('#observacion').value = 'Compararé interrupciones e ideas explicadas sin mirar durante dos sesiones equivalentes.';
    document.querySelector('#formAutodiagnostico').requestSubmit();
    return true;
  })()`);
  await hasta("!document.querySelector('#resultadoAutodiagnostico').hidden && document.querySelector('#estadoGuardado').textContent.includes('Guardado')", 'No se guardó o mostró la orientación.');

  const respuestaGuardada = await fetch(`http://127.0.0.1:${puerto}/api/autodiagnostico-musical`, { headers: { Authorization: `Bearer ${estudiante.token}` } });
  const datosGuardados = await respuestaGuardada.json();
  if (!respuestaGuardada.ok || datosGuardados.registro?.cancionId !== 'can_000001' || Object.keys(datosGuardados.registro?.respuestas || {}).length !== 8) {
    throw new Error('El servidor no conservó las respuestas o la canción principal.');
  }

  await navegar('/paginas/autodiagnostico-musical.html', "document.querySelectorAll('#listaPreguntas input:checked').length === 8 && !document.querySelector('#resultadoAutodiagnostico').hidden");
  const recuperado = await evaluar(`({
    contexto: document.querySelector('input[name="contexto"]:checked')?.value,
    condicion: document.querySelector('input[name="condicion"]:checked')?.value,
    respuestas: [...document.querySelectorAll('#listaPreguntas input:checked')].map((n) => Number(n.value)),
    observacion: document.querySelector('#observacion').value,
    estado: document.querySelector('#estadoGuardado').textContent
  })`);
  if (recuperado.contexto !== 'lectura' || recuperado.condicion !== 'cancion-principal' || recuperado.respuestas.length !== 8 || !recuperado.estado.includes('recuperó')) {
    throw new Error('La interfaz no recuperó el autodiagnóstico guardado.');
  }

  const consultaAjena = await fetch(`http://127.0.0.1:${puerto}/api/autodiagnostico-musical`, { headers: { Authorization: `Bearer ${otroEstudiante.token}` } }).then((r) => r.json());
  if (consultaAjena.registro !== null) throw new Error('Otro estudiante pudo ver el autodiagnóstico privado.');
  const consultaColeccion = await fetch(`http://127.0.0.1:${puerto}/api/autodiagnosticos-musicales`, { headers: { Authorization: `Bearer ${estudiante.token}` } });
  if (consultaColeccion.status !== 403) throw new Error('La colección privada quedó expuesta por la API genérica.');

  const intentosDespues = await readFile(path.join(datosDir, 'intentos.json'));
  if (!intentosAntes.equals(intentosDespues)) throw new Error('El autodiagnóstico modificó puntuaciones o intentos.');
  if (errores.length) throw new Error(`Errores de consola: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ recursosEscritorio, recursosMovil, vistaInicial, guardado: { id: datosGuardados.registro.id, cancionId: datosGuardados.registro.cancionId, respuestas: 8 }, recuperado, privacidad: true, puntuacionesSinCambios: true, erroresConsola: errores }, null, 2)}\n`);
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
