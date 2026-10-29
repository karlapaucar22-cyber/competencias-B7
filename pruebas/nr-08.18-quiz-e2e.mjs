import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3138;
const puertoChrome = 9258;
const perfil = path.join(raiz, `.tmp-nr0818-${Date.now()}`);
const colecciones = ['sesiones.json', 'quiz-sesiones.json', 'logros.json', 'intentos.json', 'notificaciones.json', 'bitacora.jsonl'];
const respaldo = new Map();
for (const nombre of colecciones) {
  const ruta = path.join(raiz, 'datos', nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}
const banco = JSON.parse(await readFile(path.join(raiz, 'datos', 'preguntas.json'), 'utf8'));
const porId = new Map(banco.map((pregunta) => [pregunta.id, pregunta]));
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

async function api(ruta, token, metodo = 'GET', cuerpo) {
  const respuesta = await fetch(`http://127.0.0.1:${puerto}${ruta}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(`${metodo} ${ruta}: ${respuesta.status} ${datos.error || ''}`);
  return datos;
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
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const acceso = await api('/api/auth/login', '', 'POST', { correo: 'estudiante6@demo.ec', clave: 'Demo12345' });
  if (acceso.usuario?.rol !== 'estudiante') throw new Error('La cuenta de prueba no es estudiante.');
  const token = acceso.token;
  const inicial = await api('/api/quiz/estado?temaId=tem_000014', token);
  const nombres = inicial.niveles.map((nivel) => nivel.nombre);
  const esperados = ['Atención y funciones ejecutivas', 'Memoria y aprendizaje musical', 'Autorregulación emocional y diseño de microactividades musicales'];
  if (JSON.stringify(nombres) !== JSON.stringify(esperados) || inicial.niveles.length !== 3) {
    throw new Error(`Niveles incorrectos: ${JSON.stringify(inicial)}`);
  }

  const resultados = [];
  for (let nivel = 1; nivel <= 3; nivel += 1) {
    const partida = await api('/api/quiz/iniciar', token, 'POST', { temaId: 'tem_000014', nivel });
    if (partida.preguntas.length !== 10 || partida.preguntas.some((p) => p.opciones.length !== 4 || p.pistas.length !== 3 || 'correcta' in p || 'retroalimentacion' in p)) {
      throw new Error(`Exposición o banco incorrecto en nivel ${nivel}.`);
    }
    let falloComprobado = false;
    for (let indice = 0; indice < partida.preguntas.length; indice += 1) {
      const visible = partida.preguntas[indice];
      const original = porId.get(visible.id);
      const respuesta = indice === 0 ? (original.correcta + 1) % 4 : original.correcta;
      const evaluacion = await api('/api/quiz/responder', token, 'POST', {
        sesionId: partida.sesionId, preguntaId: visible.id, respuesta
      });
      if (indice === 0) falloComprobado = evaluacion.correcto === false && Boolean(evaluacion.retroalimentacion) && Boolean(evaluacion.correcta);
      else if (!evaluacion.correcto) throw new Error(`Una respuesta correcta fue rechazada: ${visible.id}`);
    }
    const cierre = await api('/api/quiz/finalizar', token, 'POST', { sesionId: partida.sesionId });
    if (!falloComprobado || !cierre.aprobado || cierre.aciertos !== 9 || cierre.total !== 10 || cierre.porcentaje !== 90) {
      throw new Error(`Evaluación incorrecta en nivel ${nivel}: ${JSON.stringify(cierre)}`);
    }
    resultados.push({ nivel, preguntas: partida.preguntas.length, porcentaje: cierre.porcentaje, aprobado: cierre.aprobado });
  }

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
    for (let intento = 0; intento < 200; intento += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/index.html` });
  await hasta("document.readyState === 'complete'", 'No cargó Inicio.');
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(acceso.usuario))}); true`);
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/paginas/quiz.html` });
  await hasta("document.querySelectorAll('#listaNiveles > li').length === 3", 'No cargaron los tres niveles.');
  const vista = await evaluar(`({
    titulo: document.querySelector('h1').textContent.trim(),
    tema: document.querySelector('#insigniaTema').textContent.trim(),
    niveles: [...document.querySelectorAll('.quiz-nivel__nombre')].map((n) => n.textContent.trim()),
    neuri: document.querySelectorAll('.ayuda-neuri [data-modo="pista"]').length,
    desborde: document.documentElement.scrollWidth > innerWidth
  })`);
  if (!vista.titulo.includes('Misión NeuroRitmo') || !vista.tema.includes('Neuroeducación, música y desarrollo cognitivo')
    || JSON.stringify(vista.niveles) !== JSON.stringify(esperados) || vista.neuri !== 1 || vista.desborde) throw new Error(`Vista incorrecta: ${JSON.stringify(vista)}`);

  await evaluar("document.querySelector('#btnCambiarTema').click(); true");
  await hasta("document.querySelector('#selModalTema')?.value === 'tem_000014'", 'No cargaron los filtros NeuroRitmo.');
  const filtros = await evaluar(`({
    asignaturas: [...document.querySelectorAll('#selModalAsignatura option')].filter((n) => n.value).map((n) => n.textContent.trim()),
    unidades: [...document.querySelectorAll('#selModalUnidad option')].filter((n) => n.value).map((n) => n.textContent.trim()),
    temas: [...document.querySelectorAll('#selModalTema option')].filter((n) => n.value).map((n) => n.textContent.trim())
  })`);
  if (filtros.asignaturas.length !== 1 || filtros.unidades.length !== 1 || filtros.temas.length !== 1
    || !filtros.temas[0].includes('Misión NeuroRitmo')) throw new Error(`Filtros incorrectos: ${JSON.stringify(filtros)}`);

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  const movil = await evaluar("({ ancho: innerWidth, contenido: document.documentElement.scrollWidth })");
  if (movil.contenido > movil.ancho) throw new Error(`Desborde móvil: ${JSON.stringify(movil)}`);
  if (errores.length) throw new Error(`Errores de navegador: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ estudiante: acceso.usuario.id, banco: { total: 30, porNivel: [10, 10, 10] }, resultados, vista, filtros, movil, errores }, null, 2)}\n`);
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
