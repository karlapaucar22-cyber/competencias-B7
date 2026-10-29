const puertoCdp = process.env.CDP_PORT || '9233';
const base = process.env.NR_BASE_URL || 'http://localhost:3113';

const destinos = await fetch(`http://127.0.0.1:${puertoCdp}/json/list`).then((r) => r.json());
const destino = destinos.find((item) => item.type === 'page' && !item.url.startsWith('chrome'));
if (!destino) throw new Error('Chrome no expuso una pestaña web.');
const socket = new WebSocket(destino.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const limiteGlobal = setTimeout(() => {
  console.error('Tiempo global agotado en la prueba NR-06.3.');
  socket.close();
  process.exit(2);
}, 45000);

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
  localStorage.setItem('avatar.voz', 'silencio');
  localStorage.setItem('avatar.vista', 'abierto');
  window.__vozPrueba = { lecturas: 0, pausas: 0, reanudaciones: 0, cancelaciones: 0 };
  class FrasePrueba { constructor(texto) { this.text = texto; } }
  const sintesis = {
    speaking: false, paused: false,
    getVoices: () => [],
    speak(frase) { this.speaking = true; this.paused = false; window.__vozPrueba.lecturas += 1; this.frase = frase; },
    cancel() { this.speaking = false; this.paused = false; window.__vozPrueba.cancelaciones += 1; },
    pause() { this.speaking = false; this.paused = true; window.__vozPrueba.pausas += 1; },
    resume() { this.speaking = true; this.paused = false; window.__vozPrueba.reanudaciones += 1; }
  };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: sintesis });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FrasePrueba });
})();` });
await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
await enviar('Page.navigate', { url: `${base}/index.html` });
await hasta("document.querySelector('.avatar-guia__texto')?.textContent.includes('Centro de Estudio Sonoro')", 'presentación de Neuri');

const inicio = await evaluar(`(() => ({
  neuri: !!document.querySelector('.avatar-guia .figura-neuri'),
  voz: document.querySelector('.avatar-guia__voz').getAttribute('aria-pressed'),
  pausaDesactivada: document.querySelector('.avatar-guia__pausa').disabled,
  transcripcion: document.querySelector('.avatar-guia__globo').innerText,
  lecturas: window.__vozPrueba.lecturas,
  ancho: innerWidth,
  desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  altoControl: document.querySelector('.avatar-guia__voz').getBoundingClientRect().height
}))()`);
comprobar(inicio.neuri, 'No se montó el avatar Neuri con audífonos.');
comprobar(inicio.voz === 'false' && inicio.lecturas === 0, 'La voz no inició silenciada.');
comprobar(inicio.pausaDesactivada && inicio.transcripcion.includes('Transcripción de Neuri'), 'Falta la transcripción o el control de pausa inicial.');
comprobar(inicio.ancho === 360 && !inicio.desborde && inicio.altoControl >= 36, 'La guía no es operable a 360 px.');

await evaluar("location.hash = 'instrucciones'");
await hasta("document.querySelector('.avatar-guia__texto')?.textContent.includes('toda decisión')", 'recordatorio de reglas');
await evaluar("document.querySelector('.avatar-guia__voz').click()");
await hasta("window.__vozPrueba.lecturas === 1 && !document.querySelector('.avatar-guia__pausa').disabled", 'activación optativa de voz');
await evaluar("document.querySelector('.avatar-guia__pausa').click()");
await hasta("document.querySelector('.avatar-guia__pausa').textContent.includes('Reanudar')", 'pausa de voz');
await evaluar("document.querySelector('.avatar-guia__pausa').click()");
await hasta("window.__vozPrueba.reanudaciones === 1", 'reanudación de voz');

await evaluar("location.hash = 'mapa'");
await hasta("document.querySelector('.avatar-guia__texto')?.textContent.includes('Elige una estación')", 'acompañamiento de transición');
await evaluar("document.querySelector('.avatar-guia__ocultar').click()");
const final = await evaluar(`({
  oculto: document.querySelector('.avatar-guia').classList.contains('avatar-guia--oculto'),
  cancelaciones: window.__vozPrueba.cancelaciones,
  excepciones: ${JSON.stringify(excepciones)}
})`);
comprobar(final.oculto && final.cancelaciones > 0, 'Ocultar la guía no detuvo la voz.');
comprobar(excepciones.length === 0, `Excepciones de navegador: ${excepciones.join('; ')}`);

console.log(JSON.stringify({ movil: '360x800', audioInicial: 'silenciado', transcripcion: true, pausaReanudacion: true, reglas: true, transicionMapa: true, desbordeHorizontal: false, excepciones: 0 }, null, 2));
clearTimeout(limiteGlobal);
socket.close();
