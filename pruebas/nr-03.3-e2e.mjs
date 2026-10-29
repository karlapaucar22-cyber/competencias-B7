const puerto = process.env.CDP_PORT || '9225';
const token = process.env.NR_TOKEN;
const usuario = JSON.parse(process.env.NR_USUARIO || 'null');
if (!token || !usuario) throw new Error('Faltan NR_TOKEN o NR_USUARIO.');

const destinos = await fetch(`http://127.0.0.1:${puerto}/json/list`).then((r) => r.json());
const destino = destinos.find((item) => item.type === 'page' && !item.url.startsWith('chrome'));
if (!destino) throw new Error('Chrome no expuso una pestaña web.');
const socket = new WebSocket(destino.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let secuencia = 0;
const pendientes = new Map();
const excepciones = [];
socket.addEventListener('message', ({ data }) => {
  const mensaje = JSON.parse(data);
  if (mensaje.id && pendientes.has(mensaje.id)) {
    const { resolve, reject } = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    mensaje.error ? reject(new Error(mensaje.error.message)) : resolve(mensaje.result);
  }
  if (mensaje.method === 'Runtime.exceptionThrown') excepciones.push(mensaje.params.exceptionDetails.text);
});

function enviar(method, params = {}) {
  const id = ++secuencia;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
}

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
  const contexto = await evaluar(`({ url: location.href, texto: document.body?.innerText?.slice(0, 800) || '' })`);
  throw new Error(`Tiempo agotado: ${mensaje}. ${JSON.stringify(contexto)}`);
}

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Page.navigate', { url: 'http://localhost:3000/index.html' });
await hasta("document.readyState === 'complete'", 'Inicio');
await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
await enviar('Page.reload', { ignoreCache: true });
await hasta("document.querySelector('.encabezado-app__usuario-nombre')?.textContent.trim() === 'Prueba'", 'recarga con sesión');
await enviar('Page.navigate', { url: 'http://localhost:3000/index.html#mision-m1' });
await hasta("document.querySelector('.neuro-item--opcion h2')?.textContent.includes('Quiz situacional')", 'quiz situacional');

const quiz = await evaluar(`(async () => ({
  totalItems: document.querySelectorAll('.neuro-items__item').length - 1,
  opciones: [...document.querySelectorAll('.neuro-item--opcion input[type="radio"]')].map((n) => n.parentElement.innerText.trim()),
  marcasCorrectas: document.querySelectorAll('[data-correcta], [data-puntos], input[checked]').length,
  publico: await fetch('/api/neuroritmo', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
    .then((r) => r.json()).then((d) => d.experiencia.misiones.find((m) => m.id === 'm1').items[3].opciones)
}))()`);
comprobar(quiz.totalItems === 4, 'M1 no conserva exactamente cuatro ítems.');
comprobar(JSON.stringify(quiz.opciones) === JSON.stringify(['Atención selectiva', 'Memoria de trabajo', 'Control inhibitorio', 'Regulación de la activación']), 'Las alternativas del quiz no son las requeridas.');
comprobar(quiz.marcasCorrectas === 0, 'La interfaz revela una respuesta antes de responder.');
quiz.publico.forEach((opcion) => comprobar(Object.keys(opcion).sort().join(',') === 'id,texto', 'La API pública expone campos de corrección.'));

await evaluar(`(() => {
  const tarjeta = document.querySelector('.neuro-item--opcion');
  [...tarjeta.querySelectorAll('label')].find((n) => n.innerText.includes('Memoria de trabajo')).querySelector('input').click();
  tarjeta.querySelector('.neuro-item__acciones button').click();
  return true;
})()`);
await hasta("document.querySelector('.retro__titulo')?.textContent.includes('15/15')", 'corrección del quiz');
const retroQuiz = await evaluar(`document.querySelector('.retro').innerText`);
comprobar(retroQuiz.includes('mantiene y manipula información'), 'La explicación docente del quiz no identifica memoria de trabajo.');
await evaluar(`document.querySelector('.neuro-item__acciones button').click(); true`);
await hasta("document.querySelector('#titulo-justificacion')", 'justificación de M1');

const rechazos = await evaluar(`(async () => {
  const llamar = async (cuerpo) => {
    const r = await fetch('/api/neuroritmo/m1/finalizar', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('token') }, body: JSON.stringify(cuerpo)
    });
    return { estado: r.status, cuerpo: await r.json() };
  };
  return {
    unaTarjeta: await llamar({ tarjetas: ['t1'], texto: 'La demanda verbal cambia el efecto y cada persona necesita comprobar su propia respuesta observable.' }),
    sinRazonamiento: await llamar({ tarjetas: ['t1', 't2'], texto: 'Muy buena opción' })
  };
})()`);
comprobar(rechazos.unaTarjeta.estado === 400 && rechazos.unaTarjeta.cuerpo.error.includes('exactamente dos'), 'El servidor aceptó una sola tarjeta.');
comprobar(rechazos.sinRazonamiento.estado === 400 && rechazos.sinRazonamiento.cuerpo.error.includes('al menos 10'), 'El servidor aceptó texto sin razonamiento suficiente.');

const razonamiento = 'La lectura demanda procesamiento verbal y la música puede afectar de modo distinto a cada persona; compararía condiciones y registraría ideas recordadas.';
await evaluar(`(() => {
  const tarjeta = document.querySelector('#titulo-justificacion').closest('.neuro-item');
  tarjeta.querySelector('input[value="t1"]').click();
  tarjeta.querySelector('input[value="t2"]').click();
  const area = tarjeta.querySelector('textarea');
  area.value = ${JSON.stringify(razonamiento)};
  area.dispatchEvent(new Event('input', { bubbles: true }));
  tarjeta.querySelector('[data-enviar]').click();
  return true;
})()`);
await hasta("location.hash === '#retroalimentacion' && document.querySelector('.neuro-cierre__puntaje')", 'cierre de M1');
const cierre = await evaluar(`({ texto: document.querySelector('#vista').innerText, sesion: JSON.parse(sessionStorage.getItem('neuroritmo.cierre') || 'null') })`);
comprobar(cierre.texto.includes('100/100'), 'El cierre no muestra el puntaje esperado.');
comprobar(cierre.sesion?.mision === 'm1' && cierre.sesion.justificacion?.total === 40, 'El cierre no conserva la justificación.');
comprobar(excepciones.length === 0, `Excepciones: ${excepciones.join('; ')}`);

console.log(JSON.stringify({
  itemsM1: quiz.totalItems,
  alternativas: quiz.opciones,
  respuestaCorrectaProtegida: true,
  rechazoUnaTarjeta: rechazos.unaTarjeta.estado,
  rechazoTextoInsuficiente: rechazos.sinRazonamiento.estado,
  puntaje: 100,
  evidenciaIndividual: true,
  excepciones: excepciones.length
}, null, 2));
socket.close();
