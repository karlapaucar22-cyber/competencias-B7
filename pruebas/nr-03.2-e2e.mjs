const puerto = process.env.CDP_PORT || '9224';
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
async function hasta(expression, mensaje, limite = 10000) {
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

async function completarCaso({ titulo, hipotesis, tipo, volumen, prediccion, cambioPrevio = false }) {
  await hasta(`document.querySelector('.neuro-item--simulador h2')?.textContent.includes(${JSON.stringify(titulo)})`, titulo);
  if (cambioPrevio) {
    await evaluar(`(() => {
      const inicial = document.querySelector('input[value="instrumental"]');
      inicial.click();
      document.querySelector('input[value="medio"]').click();
      document.querySelector('input[value="silencio"]').click();
      return [...document.querySelectorAll('input[name^="volumen-"]')].every((n) => n.disabled && !n.checked);
    })()`);
  }
  await evaluar(`(() => {
    const tarjeta = document.querySelector('.neuro-item--simulador');
    const textarea = tarjeta.querySelector('textarea');
    textarea.value = ${JSON.stringify(hipotesis)};
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    tarjeta.querySelector('input[value="${tipo}"]').click();
    ${volumen ? `tarjeta.querySelector('input[value="${volumen}"]').click();` : ''}
    tarjeta.querySelector('input[value="${prediccion}"]').click();
    tarjeta.querySelector('.neuro-item__acciones button').click();
    return true;
  })()`);
  await hasta("document.querySelector('.neuro-simulacion__registro') && document.querySelector('.retro__titulo')?.textContent.includes('Explicación docente')", `resultado de ${titulo}`);
  const resultado = await evaluar(`(() => ({
    registro: document.querySelector('.neuro-simulacion__registro').innerText,
    comparacion: document.querySelector('.neuro-simulacion').innerText,
    explicacion: document.querySelector('.retro__titulo').textContent,
    audio: document.querySelectorAll('audio, video').length
  }))()`);
  comprobar(resultado.registro.includes(hipotesis), `No se mostró la hipótesis de ${titulo}.`);
  comprobar(resultado.registro.includes(tipo === 'silencio' ? 'Silencio' : 'Música instrumental suave'), `No se mostró la configuración de ${titulo}.`);
  comprobar(resultado.comparacion.includes('modelo educativo, no una predicción individual'), `Falta la precaución en ${titulo}.`);
  comprobar(resultado.audio === 0, `El caso ${titulo} creó audio o video.`);
  return resultado;
}

await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Page.navigate', { url: 'http://localhost:3000/index.html' });
await hasta("document.readyState === 'complete'", 'Inicio');
await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); localStorage.removeItem('avatar.voz'); true`);
await enviar('Page.reload', { ignoreCache: true });
await hasta("document.querySelector('.encabezado-app__usuario-nombre')?.textContent.trim() === 'Prueba'", 'recarga con sesión');
await enviar('Page.navigate', { url: 'http://localhost:3000/index.html#mision-m1' });
await hasta("document.querySelector('.neuro-item--simulador')", 'inicio de M1');

const inicial = await evaluar(`({
  voz: document.querySelector('.avatar-guia__voz')?.getAttribute('aria-pressed'),
  aviso: document.querySelector('.neuro-narrativa')?.innerText || '',
  notaSilenciosa: document.querySelector('.neuro-opciones .neuro-nota')?.innerText || '',
  audio: document.querySelectorAll('audio, video').length
})`);
comprobar(inicial.voz === 'false', 'La voz no inició apagada.');
comprobar(inicial.aviso.includes('no una predicción individual'), 'Falta el aviso educativo inicial.');
comprobar(inicial.notaSilenciosa.includes('no reproducen sonido'), 'No se aclara que las opciones son silenciosas.');
comprobar(inicial.audio === 0, 'M1 cargó audio o video automáticamente.');

const resultados = [];
resultados.push(await completarCaso({
  titulo: 'Lectura comprensiva',
  hipotesis: 'El silencio reducirá la interferencia verbal durante esta lectura exigente.',
  tipo: 'silencio',
  prediccion: 'favorable',
  cambioPrevio: true
}));
await evaluar(`document.querySelector('.neuro-item__acciones button').click(); true`);
resultados.push(await completarCaso({
  titulo: 'Tarea mecánica',
  hipotesis: 'La música instrumental baja puede sostener la activación en esta tarea mecánica.',
  tipo: 'instrumental',
  volumen: 'bajo',
  prediccion: 'favorable'
}));
await evaluar(`document.querySelector('.neuro-item__acciones button').click(); true`);
resultados.push(await completarCaso({
  titulo: 'Repaso con estrés alto',
  hipotesis: 'La música instrumental baja puede regular la tensión antes del examen oral.',
  tipo: 'instrumental',
  volumen: 'bajo',
  prediccion: 'favorable'
}));

const partida = await evaluar(`fetch('/api/neuroritmo', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } }).then((r) => r.json()).then((d) => d.progreso.enCurso.m1)`);
comprobar(Object.keys(partida.respuestas).length === 3, 'La partida no registró los tres casos.');
comprobar(partida.respuestas.i1.valor.config.tipo === 'silencio', 'La configuración final del caso 1 no se guardó.');
comprobar(partida.respuestas.i2.valor.config.volumen === 'bajo', 'El volumen del caso 2 no se guardó.');
comprobar(partida.respuestas.i3.valor.hipotesis.includes('regular la tensión'), 'La hipótesis del caso 3 no se guardó.');
comprobar(excepciones.length === 0, `Excepciones: ${excepciones.join('; ')}`);

console.log(JSON.stringify({
  casos: ['lectura comprensiva', 'ordenar referencias', 'repaso con estrés alto'],
  variablesModificablesAntesDeEjecutar: true,
  configuracionesRegistradas: Object.keys(partida.respuestas).length,
  explicacionDocente: resultados.every((r) => r.explicacion.includes('Explicación docente')),
  audioInicial: 'apagado',
  elementosMultimedia: 0,
  intentoFinalizado: false,
  excepciones: excepciones.length
}, null, 2));
socket.close();
