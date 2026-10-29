// Recorrido de humo contra la URL publicada. No modifica contenidos ni calificaciones.

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const base = String(process.env.NR_URL || '').replace(/\/+$/, '');
const correo = process.env.NR_CORREO;
const clave = process.env.NR_CLAVE;
if (!base || !correo || !clave) throw new Error('Define NR_URL, NR_CORREO y NR_CLAVE.');

const puertoChrome = 9261;
const perfil = path.resolve(`.tmp-nr091-chrome-${Date.now()}`);
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let chrome;
let socket;

async function esperarUrl(url) {
  for (let intento = 0; intento < 120; intento += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(250);
  }
  throw new Error(`No respondió ${url}`);
}

try {
  const acceso = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, clave })
  });
  if (!acceso.ok) throw new Error(`No se pudo iniciar sesión (${acceso.status}).`);
  const sesion = await acceso.json();
  if (sesion.usuario?.rol !== 'estudiante') throw new Error('La cuenta no tiene rol estudiante.');

  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    `--remote-debugging-port=${puertoChrome}`, `--user-data-dir=${perfil}`, 'about:blank'
  ], { stdio: 'ignore' });
  await esperarUrl(`http://127.0.0.1:${puertoChrome}/json/list`);
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
    const pendiente = pendientes.get(mensaje.id);
    if (!pendiente) return;
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
  async function navegar(ruta, condicion) {
    await enviar('Page.navigate', { url: `${base}${ruta}` });
    await hasta(condicion, `No cargó ${ruta}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await enviar('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await navegar('/index.html', "document.readyState === 'complete'");
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(sesion.token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(sesion.usuario))}); true`);

  await navegar('/paginas/asignaturas.html', "document.querySelectorAll('.tarjeta-asignatura-est').length === 2");
  const asignaturas = await evaluar(`({ total: document.querySelectorAll('.tarjeta-asignatura-est').length, texto: document.querySelector('#lista-asignaturas-est').innerText })`);
  if (!/FUNDAMENTOS DE NEUROEDUCACIÓN/i.test(asignaturas.texto)) throw new Error('No aparece la asignatura NeuroRitmo.');

  await navegar('/paginas/participantes.html', "document.querySelectorAll('#listaEstudiantes > li').length === 8");
  const participantes = await evaluar(`({ total: document.querySelectorAll('#listaEstudiantes > li').length, texto: document.querySelector('#contenido').innerText })`);
  if (!/Karla Paucar|Felipe Arévalo|Prueba NR028/i.test(participantes.texto)) throw new Error('Faltan participantes esperados.');

  await navegar('/paginas/explorar.html', "document.querySelectorAll('.tema-tarjeta').length >= 12");
  const explorar = await evaluar(`({ temas: document.querySelectorAll('.tema-tarjeta').length, subtemas: document.querySelectorAll('.explorar-subtema').length })`);

  await navegar('/paginas/foros.html', "document.querySelectorAll('#listaHilos > li').length === 2");
  const foros = await evaluar(`({ total: document.querySelectorAll('#listaHilos > li').length, texto: document.querySelector('#listaHilos').innerText })`);
  if (!/Galería NeuroRitmo|Foro general/i.test(foros.texto)) throw new Error('No aparecen los foros NeuroRitmo.');

  await navegar('/index.html#mapa', "document.querySelectorAll('.neuro-mision').length === 3");
  const mapa = await evaluar(`({ total: document.querySelectorAll('.neuro-mision').length, titulo: document.querySelector('.neuro-titulo')?.textContent.trim() })`);

  await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await navegar('/paginas/participantes.html', "document.querySelectorAll('#listaEstudiantes > li').length === 8");
  const movil = await evaluar(`({ ancho: innerWidth, desborde: document.documentElement.scrollWidth > innerWidth })`);
  if (movil.desborde) throw new Error('Participantes presenta desborde horizontal en móvil.');
  if (errores.length) throw new Error(`Errores de consola: ${errores.join('; ')}`);

  console.log(JSON.stringify({ usuario: sesion.usuario.id, asignaturas, participantes, explorar, foros, mapa, movil, errores }, null, 2));
} finally {
  try { socket?.close(); } catch { /* cerrando */ }
  chrome?.kill();
  await esperar(300);
  await rm(perfil, { recursive: true, force: true });
}
