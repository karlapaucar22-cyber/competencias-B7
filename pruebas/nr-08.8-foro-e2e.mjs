import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const puerto = 3128;
const puertoChrome = 9248;
const perfil = path.join(raiz, `.tmp-nr088-${Date.now()}`);
const mutables = ['sesiones.json', 'bitacora.jsonl', 'foros-respuestas.json', 'foros-hilos.json', 'intentos.json', 'logros.json', 'notificaciones.json'];
const respaldo = new Map();
for (const nombre of mutables) {
  const ruta = path.join(datosDir, nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}
const privados = ['neuroritmo-borradores.json', 'neuroritmo-entregas.json'];
const privadosAntes = new Map();
for (const nombre of privados) {
  const ruta = path.join(datosDir, nombre);
  try { privadosAntes.set(ruta, await readFile(ruta)); } catch { privadosAntes.set(ruta, null); }
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

async function login(puertoActual, correo) {
  const respuesta = await fetch(`http://127.0.0.1:${puertoActual}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, clave: 'Demo12345' })
  });
  if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión con ${correo} (${respuesta.status}).`);
  return respuesta.json();
}

async function crearRespuesta(puertoActual, token, cuerpo) {
  const respuesta = await fetch(`http://127.0.0.1:${puertoActual}/api/foros-respuestas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo)
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || `No se publicó (${respuesta.status}).`);
  return datos;
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

async function tieneEco(puertoActual, token) {
  const respuesta = await fetch(`http://127.0.0.1:${puertoActual}/api/logros`, { headers: { Authorization: `Bearer ${token}` } });
  const logros = await respuesta.json();
  return (logros[0]?.insignias || []).some((insignia) => insignia.id === 'eco-colaborativo');
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

  const [personaA, personaB] = await Promise.all([
    login(puerto, 'estudiante5@demo.ec'),
    login(puerto, 'estudiante6@demo.ec')
  ]);
  const hiloId = 'for_000001';
  const foroGeneralId = 'for_000002';
  const propuestaA = await crearRespuesta(puerto, personaA.token, {
    hiloId,
    texto: 'Propongo una actividad de siete minutos con ritmo corporal: explicamos tres conceptos, practicamos la secuencia y comprobamos al final que cada estudiante pueda explicarlos sin apoyo.'
  });
  const participacionGeneralA = await crearRespuesta(puerto, personaA.token, {
    hiloId: foroGeneralId,
    texto: 'En una lectura compleja elegiría silencio porque la letra puede competir con el procesamiento verbal. Después compararía la comprensión con una sesión breve de música instrumental suave.'
  });

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
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(personaB.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(personaB.usuario))}); true`);
  await navegar('/paginas/foros.html?asignaturaId=asi_000001', "document.querySelectorAll('.foros-hilo').length > 0");
  const listado = await evaluar(`({
    titulos: [...document.querySelectorAll('.foros-hilo__titulo')].map((el) => el.textContent.trim()),
    generales: [...document.querySelectorAll('.foros-hilo__titulo')].filter((el) => el.textContent.trim() === 'Foro general: Neuroeducación, música y aprendizaje').length,
    galerias: [...document.querySelectorAll('.foros-hilo__titulo')].filter((el) => el.textContent.trim() === 'Galería NeuroRitmo').length,
    generalHref: [...document.querySelectorAll('.foros-hilo__titulo a')].find((el) => el.textContent.trim().startsWith('Foro general:'))?.getAttribute('href'),
    galeriaHref: [...document.querySelectorAll('.foros-hilo__titulo a')].find((el) => el.textContent.trim() === 'Galería NeuroRitmo')?.getAttribute('href')
  })`);
  if (listado.generales !== 1 || !listado.generalHref?.includes(foroGeneralId) || listado.titulos[0] !== 'Foro general: Neuroeducación, música y aprendizaje') {
    throw new Error('El foro general no aparece automáticamente, está ausente o duplicado.');
  }
  if (listado.galerias !== 1 || !listado.galeriaHref?.includes(hiloId)) throw new Error('La Galería está ausente o duplicada.');

  await evaluar(`document.querySelector('#selectorTema').value = document.querySelector('#selectorTema option:not([value=""])')?.value || ''; document.querySelector('#selectorTema').dispatchEvent(new Event('change')); true`);
  await hasta("[...document.querySelectorAll('.foros-hilo__titulo')].some((el) => el.textContent.trim().startsWith('Foro general:'))", 'El foro general desapareció al filtrar por tema.');

  await navegar(`/paginas/hilo.html?id=${foroGeneralId}`, "document.querySelector('#hiloPrincipal:not([hidden])') && document.querySelectorAll('#listaRespuestas > li').length === 1");
  const preguntaGeneral = await evaluar("document.querySelector('#hiloPrincipal').innerText");
  if (!preguntaGeneral.includes('¿De qué manera influye la música en la atención, la memoria y la autorregulación emocional durante el aprendizaje?')) {
    throw new Error('No se mostró la pregunta inicial del foro general.');
  }
  const aporteGeneral = 'En una tarea mecánica probaría música instrumental a volumen bajo, pero en lectura compararía primero con silencio y registraría comprensión y concentración para decidir.';
  await evaluar(`document.querySelector('#textoRespuesta').value = ${JSON.stringify(aporteGeneral)}; document.querySelector('#formResponder').requestSubmit(); true`);
  await hasta("document.querySelectorAll('#listaRespuestas > li').length === 2", 'El estudiante no pudo publicar en el foro general.');
  await evaluar(`(() => {
    const item = document.querySelector('#respuesta-${participacionGeneralA.id}');
    item.querySelector('.hilo-opciones > button').click();
    [...item.querySelectorAll('.hilo-opciones__menu button')].find((b) => b.textContent.includes('Responder a esta participación')).click();
    return true;
  })()`);
  await hasta("!document.querySelector('#respuestaObjetivo').hidden", 'No se activó la respuesta dirigida del foro general.');
  const replicaGeneral = 'Coincido con comparar condiciones. También registraría el estrés percibido antes y después para distinguir concentración de autorregulación emocional.';
  await evaluar(`document.querySelector('#textoRespuesta').value = ${JSON.stringify(replicaGeneral)}; document.querySelector('#formResponder').requestSubmit(); true`);
  await hasta("document.querySelectorAll('#listaRespuestas > li').length === 3 && document.querySelector('.hilo-publicacion__referencia')", 'No se publicó la respuesta dirigida del foro general.');

  await navegar(`/paginas/hilo.html?id=${hiloId}`, "document.querySelector('#hiloPrincipal:not([hidden])') && document.querySelectorAll('#listaRespuestas > li').length === 1");
  const consigna = await evaluar("document.querySelector('#hiloPrincipal').innerText");
  for (const patron of ['5 a 10 minutos', 'opcional', 'no se copian ni se publican automáticamente']) {
    if (!consigna.includes(patron)) throw new Error(`Falta en la consigna: ${patron}`);
  }

  const propuestaBTexto = 'Diseñaría una pausa de seis minutos: objetivo observable, silencio inicial, ritmo breve sin letra y una explicación final para comprobar atención y autorregulación del grupo.';
  await evaluar(`document.querySelector('#textoRespuesta').value = ${JSON.stringify(propuestaBTexto)}; document.querySelector('#formResponder').requestSubmit(); true`);
  await hasta("document.querySelectorAll('#listaRespuestas > li').length === 2", 'La propuesta del estudiante no se publicó.');
  if (await tieneEco(puerto, personaB.token)) throw new Error('La insignia se concedió sin comentar otra propuesta.');

  await evaluar(`(() => {
    const item = document.querySelector('#respuesta-${propuestaA.id}');
    item.querySelector('.hilo-opciones > button').click();
    [...item.querySelectorAll('.hilo-opciones__menu button')].find((b) => b.textContent.includes('Comentar esta propuesta')).click();
    return true;
  })()`);
  await hasta("!document.querySelector('#respuestaObjetivo').hidden", 'No se activó el comentario dirigido.');
  const comentario = 'La secuencia tiene una meta clara y una comprobación pertinente. Sugiero ofrecer silencio como alternativa y registrar la concentración de uno a cinco antes y después.';
  await evaluar(`document.querySelector('#textoRespuesta').value = ${JSON.stringify(comentario)}; document.querySelector('#formResponder').requestSubmit(); true`);
  await hasta("document.querySelectorAll('#listaRespuestas > li').length === 3 && document.querySelector('.hilo-publicacion__referencia')", 'El comentario dirigido no se publicó.');
  if (!(await tieneEco(puerto, personaB.token))) throw new Error('No se concedió Eco colaborativo tras cumplir ambas condiciones.');

  const respuestas = JSON.parse(await readFile(path.join(datosDir, 'foros-respuestas.json'), 'utf8'));
  const respuestasGenerales = respuestas.filter((respuesta) => respuesta.hiloId === foroGeneralId && respuesta.autorId === personaB.usuario.id);
  if (respuestasGenerales.length !== 2 || !respuestasGenerales.some((respuesta) => respuesta.respuestaAId === participacionGeneralA.id)) {
    throw new Error('Las publicaciones del estudiante en el foro general no se registraron correctamente.');
  }
  const comentarioGuardado = respuestas.find((respuesta) => respuesta.autorId === personaB.usuario.id && respuesta.respuestaAId === propuestaA.id);
  if (!comentarioGuardado) throw new Error('No se guardó el vínculo con la propuesta comentada.');
  const intentos = JSON.parse(await readFile(path.join(datosDir, 'intentos.json'), 'utf8'));
  const aportes = intentos.filter((intento) => intento.usuarioId === personaB.usuario.id && intento.actividad === 'foro' && intento.detalle?.temaId === 'tem_000005');
  if (!aportes.some((i) => i.detalle.tipoAporte === 'propuesta') || !aportes.some((i) => i.detalle.tipoAporte === 'comentario' && i.detalle.respuestaAjena)) {
    throw new Error('La evidencia de participación no distingue propuesta y comentario ajeno.');
  }
  for (const [ruta, contenidoAntes] of privadosAntes) {
    let contenidoDespues = null;
    try { contenidoDespues = await readFile(ruta); } catch { /* sigue ausente */ }
    if (!((contenidoAntes === null && contenidoDespues === null) || (contenidoAntes && contenidoDespues && contenidoAntes.equals(contenidoDespues)))) {
      throw new Error(`El foro modificó datos privados de Misión 3: ${path.basename(ruta)}`);
    }
  }
  if (errores.length) throw new Error(`Errores de consola: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ listado, respuestas: respuestas.length, respuestasGenerales: respuestasGenerales.length, comentarioA: propuestaA.id, ecoColaborativo: true, aportes: aportes.map((i) => i.detalle.tipoAporte), erroresConsola: errores }, null, 2)}\n`);
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
