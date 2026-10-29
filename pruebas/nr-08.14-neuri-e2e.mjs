import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const puerto = 3140;
const puertoChrome = 9260;
const perfil = path.join(raiz, `.tmp-nr0814-${Date.now()}`);
const mutables = ['sesiones.json', 'bitacora.jsonl', 'quiz-sesiones.json'];
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

try {
  servidor = spawn(process.execPath, ['servidor/server.js'], {
    cwd: raiz,
    env: { ...process.env, PUERTO: String(puerto), GEMINI_API_KEY: '', IA_MODELO: 'gemini-2.5-flash-lite', TZ: 'America/Guayaquil' },
    stdio: 'ignore'
  });
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl(`http://127.0.0.1:${puerto}/index.html`),
    esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`)
  ]);

  const login = await fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante1@demo.ec', clave: 'Demo12345' })
  });
  if (!login.ok) throw new Error('No se pudo iniciar la sesión estudiante.');
  const sesion = await login.json();

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
    for (let i = 0; i < 200; i += 1) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    throw new Error(mensaje);
  }
  async function navegar(ruta, condicion) {
    await enviar('Page.navigate', { url: `http://127.0.0.1:${puerto}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
  }
  async function comprobarRespaldo(nombre) {
    await evaluar("document.querySelector('.ayuda-neuri [data-modo=\"pista\"]').click(); true");
    await hasta("document.querySelector('.ayuda-neuri__respuesta--predefinida')", `${nombre} no mostró respaldo.`);
    const resultado = await evaluar(`({
      origen: document.querySelector('.ayuda-neuri__respuesta--predefinida')?.dataset.origen,
      texto: document.querySelector('.ayuda-neuri__respuesta--predefinida')?.textContent,
      tareaAusente: document.body.textContent.includes('La tarea de IA')
    })`);
    if (resultado.origen !== 'predefinida' || !resultado.texto.includes('no generada por IA') || resultado.tareaAusente) {
      throw new Error(`${nombre} no respondió con un respaldo claro: ${JSON.stringify(resultado)}`);
    }
    return resultado;
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(sesion.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(sesion.usuario))}); true`);

  const resultados = {};
  await navegar('/paginas/ahorcado.html?temaId=tem_000001', "document.querySelector('.ayuda-neuri') && getComputedStyle(document.querySelector('#ahorcadoTablero')).display !== 'none'");
  resultados.ahorcado = await comprobarRespaldo('Ahorcado');

  await navegar('/paginas/pareja.html?temaId=tem_000001', "document.querySelector('.ayuda-neuri') && !document.querySelector('#parejaJuego').hidden");
  resultados.parejas = await comprobarRespaldo('Parejas');

  await navegar('/paginas/quiz.html?temaId=tem_000001', "document.querySelector('#listaNiveles button:not([disabled])')");
  await evaluar("document.querySelector('#listaNiveles button:not([disabled])').click(); true");
  await hasta("!document.querySelector('#vistaPregunta').hidden && document.querySelector('.ayuda-neuri')", 'El cuestionario no inició.');
  resultados.cuestionario = await comprobarRespaldo('Cuestionario');

  await navegar('/paginas/simulador.html?id=sim_000001', "document.querySelector('.ayuda-neuri') && !document.querySelector('#simulador').hidden");
  resultados.simulador = await comprobarRespaldo('Simulador');

  if (errores.length) throw new Error(`Errores de navegador: ${errores.join('; ')}`);
  process.stdout.write(`${JSON.stringify({ resultados: Object.keys(resultados), respaldo: true, tareaAusente: false, erroresConsola: errores }, null, 2)}\n`);
} finally {
  try { socket?.close(); } catch { /* sin conexión */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(500);
  for (const [ruta, contenido] of respaldo) {
    if (contenido === null) await rm(ruta, { force: true });
    else await writeFile(ruta, contenido);
  }
  for (let i = 0; i < 10; i += 1) {
    try { await rm(perfil, { recursive: true, force: true }); break; } catch { await esperar(200); }
  }
}
