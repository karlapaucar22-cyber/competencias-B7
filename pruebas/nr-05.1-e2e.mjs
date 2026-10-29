const puertoCdp = process.env.CDP_PORT || '9227';
const base = process.env.NR_BASE_URL || 'http://localhost:3105';
const token = process.env.NR_TOKEN;
const usuario = JSON.parse(process.env.NR_USUARIO || 'null');
if (!token || !usuario) throw new Error('Faltan NR_TOKEN o NR_USUARIO.');

const datos = await fetch(`${base}/api/neuroritmo`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
datos.progreso.misiones.m1 = { mejor: 100, intentos: 1, aprobada: true, estado: 'aprobada', intentosBajo: false };
datos.progreso.misiones.m2 = { mejor: 100, intentos: 1, aprobada: true, estado: 'aprobada', intentosBajo: false };
datos.progreso.misiones.m3 = { mejor: 0, intentos: 0, aprobada: false, estado: 'abierta', intentosBajo: false };
datos.progreso.enCurso = { m3: { id: 'prueba-movil-m3', mision: 'm3', numero: 1, respuestas: {}, pistas: {} } };

const destinos = await fetch(`http://127.0.0.1:${puertoCdp}/json/list`).then((r) => r.json());
const destino = destinos.find((item) => item.type === 'page' && !item.url.startsWith('chrome'));
if (!destino) throw new Error('Chrome no expuso una pestaña web.');
const socket = new WebSocket(destino.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const limiteGlobal = setTimeout(() => {
  console.error('Tiempo global agotado en la prueba móvil NR-05.1.');
  socket.close();
  process.exit(2);
}, 60000);

let secuencia = 0;
const pendientes = new Map();
const excepciones = [];
function enviar(method, params = {}) {
  const id = ++secuencia;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
}
socket.addEventListener('message', ({ data }) => {
  const mensaje = JSON.parse(data);
  if (mensaje.id && pendientes.has(mensaje.id)) {
    const promesa = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    mensaje.error ? promesa.reject(new Error(mensaje.error.message)) : promesa.resolve(mensaje.result);
  }
  if (mensaje.method === 'Runtime.exceptionThrown') excepciones.push(mensaje.params.exceptionDetails.text);
});

async function evaluar(expression) {
  const respuesta = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (respuesta.exceptionDetails) throw new Error(respuesta.exceptionDetails.text);
  return respuesta.result.value;
}
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function hasta(expression, mensaje, limite = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (await evaluar(expression)) return;
    await esperar(100);
  }
  throw new Error(`Tiempo agotado: ${mensaje}`);
}
const comprobar = (condicion, mensaje) => { if (!condicion) throw new Error(mensaje); };

await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const original = window.fetch.bind(window);
  const simulados = ${JSON.stringify(datos)};
  window.fetch = (entrada, opciones) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada.url, location.href);
    if (url.pathname === '/api/neuroritmo' && (!opciones?.method || opciones.method === 'GET')) {
      return Promise.resolve(new Response(JSON.stringify(simulados), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return original(entrada, opciones);
  };
})();` });
await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
await enviar('Page.navigate', { url: `${base}/index.html` });
await hasta("document.readyState === 'complete'", 'carga inicial');
console.error('NR-05.1 E2E: carga inicial lista');
await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
await enviar('Page.reload', { ignoreCache: true });
await hasta("document.querySelector('.encabezado-app__usuario-nombre')", 'sesión estudiante');
console.error('NR-05.1 E2E: sesión lista');
await enviar('Page.navigate', { url: `${base}/index.html#mision-m3` });
await hasta("document.querySelector('#form-diseno')", 'diseñador M3');
console.error('NR-05.1 E2E: diseñador visible');

const estructura = await evaluar(`(() => ({
  bloques: ['diseno-bloque-1','diseno-bloque-2','diseno-bloque-3','diseno-bloque-4'].every((id) => document.getElementById(id)),
  navegacion: document.querySelectorAll('[data-ir-bloque]').length,
  desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  ancho: innerWidth,
  requeridos: [...document.querySelectorAll('#form-diseno textarea, #form-diseno select, #form-diseno input')].filter((e) => !e.disabled).every((e) => e.required)
}))()`);
comprobar(estructura.bloques && estructura.navegacion === 5, 'Faltan los cuatro bloques o la navegación móvil.');
comprobar(estructura.ancho === 360 && !estructura.desborde, 'El diseñador produce desbordamiento horizontal a 360 px.');
comprobar(estructura.requeridos, 'Hay campos editables sin validación requerida.');

await evaluar(`(() => {
  const f = document.getElementById('form-diseno');
  const poner = (nombre, valor) => { f.elements[nombre].value = valor; f.elements[nombre].dispatchEvent(new Event('input', { bubbles: true })); };
  poner('objetivo', 'Al finalizar cada estudiante explicará tres conceptos mediante ejemplos propios claros');
  f.elements.tipo.value = 'silencio'; f.elements.tipo.dispatchEvent(new Event('change', { bubbles: true }));
  ['b1','b2','b3','b4','b5'].forEach((id) => document.querySelector('[data-agregar="' + id + '"]').click());
  poner('instrucciones', 'Primero revisen los conceptos, practiquen y luego explíquenlos sin mirar sus apuntes.');
  poner('comprobacion', 'Cada estudiante explica los tres conceptos mediante una tarjeta de salida individual.');
  poner('indicador', 'Valora tu concentración de uno a cinco al terminar.');
  poner('justificacion', 'La atención se protege al limitar distractores durante la explicación. La recuperación ocurre cuando cada estudiante responde sin mirar. La emoción y la autorregulación se observan con una valoración final, de modo que el recurso se ajuste al cansancio sin asumir una respuesta igual para todas las personas.');
  poner('diferencias', 'Cada estudiante puede elegir silencio y comunicar incomodidad, cansancio o necesidad de ajustar el ritmo de trabajo.');
  return true;
})()`);
await hasta("document.querySelector('#minutos-total').textContent.includes('9 min')", 'cálculo de tiempo');
const cotejo = await evaluar(`({ total: document.querySelectorAll('#lista-cotejo li').length, completos: document.querySelectorAll('#lista-cotejo .neuro-cotejo__item--ok').length })`);
comprobar(cotejo.total >= 10 && cotejo.completos === cotejo.total, 'La lista de cotejo no valida el diseño completo.');

await evaluar(`document.querySelector('[data-ir-bloque="diseno-bloque-4"]').click(); true`);
await hasta("document.activeElement?.id === 'd-comprobacion'", 'navegación al bloque 4');
comprobar(excepciones.length === 0, `Excepciones de navegador: ${excepciones.join('; ')}`);

console.log(JSON.stringify({ ancho: estructura.ancho, bloques: 4, navegacionMovil: true, duracion: 9, cotejo: cotejo.completos, camposRequeridos: true, desbordeHorizontal: false, excepciones: 0 }, null, 2));
clearTimeout(limiteGlobal);
socket.close();
