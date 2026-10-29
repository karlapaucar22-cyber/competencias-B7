import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3132;
const puertoChrome = 9252;
const perfil = path.join(raiz, `.tmp-nr083c-${Date.now()}`);
const mutables = ['sesiones.json', 'bitacora.jsonl', 'intentos.json', 'consumo-ia.jsonl'];
const respaldo = new Map();
for (const nombre of mutables) {
  const ruta = path.join(raiz, 'datos', nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}
const intentosAntes = respaldo.get(path.join(raiz, 'datos', 'intentos.json'));

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
  const [estudiante, otro] = await Promise.all([login('estudiante6@demo.ec'), login('estudiante5@demo.ec')]);

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
  const solicitudes = [];
  const respuestas = [
    'Observa primero qué exige la lectura y qué información compite por tu atención. ¿Qué diferencia notas entre una canción con letra y el silencio?',
    'Vas avanzando: piensa en cómo una pista ayuda a recuperar sin sustituir la comprensión. ¿Qué podrías comprobar después sin apoyo?',
    'Relaciona el objetivo, el recurso sonoro y una evidencia observable del aprendizaje. ¿Cómo sabrá el docente que el grupo recordó y explicó los conceptos?'
  ];

  const enviar = (method, params = {}) => {
    const id = ++secuencia;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
  };
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.method === 'Runtime.exceptionThrown') errores.push(mensaje.params.exceptionDetails.text);
    if (mensaje.method === 'Fetch.requestPaused') {
      const cuerpo = JSON.parse(mensaje.params.request.postData || '{}');
      solicitudes.push(cuerpo);
      const respuesta = respuestas[Math.min(solicitudes.length - 1, respuestas.length - 1)];
      enviar('Fetch.fulfillRequest', {
        requestId: mensaje.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
        body: Buffer.from(JSON.stringify({ respuesta })).toString('base64')
      }).catch((error) => errores.push(error.message));
    }
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const pendiente = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    mensaje.error ? pendiente.reject(new Error(mensaje.error.message)) : pendiente.resolve(mensaje.result);
  });

  async function evaluar(expression) {
    const resultado = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text);
    return resultado.result.value;
  }
  async function hasta(expression, mensaje) {
    for (let i = 0; i < 200; i += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function navegar(ruta, contextoEsperado) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    try {
      await hasta(`document.readyState === 'complete' && document.querySelector('.avatar-tutor__contexto')?.textContent.includes(${JSON.stringify(contextoEsperado)})`, `No se detectó ${contextoEsperado} en ${ruta}`);
    } catch (error) {
      const diagnostico = await evaluar(`({
        url: location.href,
        contexto: document.querySelector('.avatar-tutor__contexto')?.textContent || '',
        tutor: !!document.querySelector('.avatar-tutor'),
        usuario: sessionStorage.getItem('usuario'),
        errores: ${JSON.stringify(errores)}
      })`);
      throw new Error(`${error.message}: ${JSON.stringify(diagnostico)}`);
    }
  }
  async function preguntar(texto, totalGuardados) {
    await evaluar(`(() => {
      const entrada = document.querySelector('#avatar-tutor-entrada');
      entrada.value = ${JSON.stringify(texto)};
      entrada.form.requestSubmit();
      return true;
    })()`);
    await hasta(`JSON.parse(sessionStorage.getItem('neuri.tutor:${estudiante.usuario.id}') || '[]').length >= ${totalGuardados}`, `Neuri no completó la conversación hasta ${totalGuardados} mensajes`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Fetch.enable', { patterns: [{ urlPattern: `http://127.0.0.1:${puerto}/api/ia/tutor`, requestStage: 'Request' }] });
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}/index.html` });
  await hasta("document.readyState === 'complete'", 'No cargó Inicio.');
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(estudiante.token)});
    sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(estudiante.usuario))});
    sessionStorage.removeItem('neuri.tutor:${estudiante.usuario.id}');
    localStorage.setItem('avatar.vista', 'abierto'); true`);
  await enviar('Page.reload');
  await hasta("document.readyState === 'complete' && document.querySelector('.avatar-tutor')", 'No se montó el tutor después de iniciar sesión.');

  await navegar('/index.html#mision-m1', 'Misión 1');
  await preguntar('No entiendo por qué la letra puede distraer durante una lectura científica.', 2);

  await navegar('/paginas/pareja.html?temaId=tem_000004', 'Misión 2');
  await evaluar("document.querySelector('.tutor__sugerencia:nth-child(2)').click()");
  await hasta(`JSON.parse(sessionStorage.getItem('neuri.tutor:${estudiante.usuario.id}') || '[]').length >= 4`, 'No respondió la pista progresiva de M2.');

  await navegar('/paginas/hilo.html?id=for_000001', 'Misión 3');
  await preguntar('Quiero comprobar si mi microactividad realmente ayudó a recordar.', 6);

  if (solicitudes.length !== 3) throw new Error(`Se esperaban tres consultas y hubo ${solicitudes.length}.`);
  const contextos = solicitudes.map((s) => ({ temaId: s.temaId, ...s.contexto, mensajes: s.historial?.length }));
  if (contextos.map((c) => c.misionId).join(',') !== 'm1,m2,m3') throw new Error(`Contextos incorrectos: ${JSON.stringify(contextos)}`);
  if (contextos.map((c) => c.temaId).join(',') !== 'tem_000003,tem_000004,tem_000005') throw new Error(`Temas incorrectos: ${JSON.stringify(contextos)}`);
  if (!(contextos[0].mensajes === 1 && contextos[1].mensajes === 3 && contextos[2].mensajes === 5)) {
    throw new Error(`El historial no continuó entre misiones: ${JSON.stringify(contextos)}`);
  }

  const conversacion = await evaluar(`({
    mensajes: document.querySelectorAll('.avatar-tutor__mensajes .tutor__mensaje').length,
    respuestas: [...document.querySelectorAll('.avatar-tutor__mensajes .tutor__mensaje--tutor')].slice(1).map((n) => n.textContent),
    guardados: JSON.parse(sessionStorage.getItem('neuri.tutor:${estudiante.usuario.id}') || '[]').length,
    instancias: document.querySelectorAll('.avatar-guia').length
  })`);
  if (conversacion.guardados !== 6 || conversacion.instancias !== 1 || conversacion.respuestas.some((r) => (r.match(/\?/g) || []).length !== 1)) {
    throw new Error(`Conversación inválida: ${JSON.stringify(conversacion)}`);
  }

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await navegar('/paginas/explorar.html', 'Misión 1');
  const movil = await evaluar(`(() => {
    const panel = document.querySelector('.avatar-guia__panel').getBoundingClientRect();
    return {
      historial: document.querySelectorAll('.avatar-tutor__mensajes .tutor__mensaje').length,
      dentro: panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      entrada: document.querySelector('#avatar-tutor-entrada').getBoundingClientRect().height
    };
  })()`);
  if (movil.historial < 6 || !movil.dentro || movil.desborde || movil.entrada < 40) throw new Error(`Chat móvil inválido: ${JSON.stringify(movil)}`);

  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(otro.token)});
    sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(otro.usuario))}); location.reload()`);
  await hasta("document.querySelector('.avatar-tutor__mensajes')", 'No cargó el tutor para la segunda cuenta.');
  const privado = await evaluar(`({
    propios: JSON.parse(sessionStorage.getItem('neuri.tutor:${otro.usuario.id}') || '[]').length,
    visibles: document.querySelectorAll('.avatar-tutor__mensajes .tutor__mensaje--usuario').length
  })`);
  if (privado.propios !== 0 || privado.visibles !== 0) throw new Error(`Otra cuenta vio la conversación: ${JSON.stringify(privado)}`);

  const intentosDespues = await readFile(path.join(raiz, 'datos', 'intentos.json'));
  if (!intentosAntes.equals(intentosDespues)) throw new Error('El tutor modificó intentos o calificaciones.');
  if (errores.length) throw new Error(`Errores de navegador: ${errores.join('; ')}`);

  process.stdout.write(`${JSON.stringify({ contextos, conversacion, movil, privacidadEntreCuentas: true, calificacionesSinCambios: true, erroresConsola: errores }, null, 2)}\n`);
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
