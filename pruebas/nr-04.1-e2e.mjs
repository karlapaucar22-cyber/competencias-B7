const puertoCdp = process.env.CDP_PORT || '9226';
const base = process.env.NR_BASE_URL || 'http://localhost:3104';
const token = process.env.NR_TOKEN;
const usuario = JSON.parse(process.env.NR_USUARIO || 'null');
if (!token || !usuario) throw new Error('Faltan NR_TOKEN o NR_USUARIO.');

const destinos = await fetch(`http://127.0.0.1:${puertoCdp}/json/list`).then((r) => r.json());
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
  const contexto = await evaluar(`({ url: location.href, texto: document.body?.innerText?.slice(0, 900) || '' })`);
  throw new Error(`Tiempo agotado: ${mensaje}. ${JSON.stringify(contexto)}`);
}

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

const buscarCarta = (texto) => `(() => [...document.querySelectorAll('.neuro-carta')].find((b) => b.querySelector('.neuro-carta__texto').textContent.includes(${JSON.stringify(texto)})))()`;

async function pulsarTeclado(texto) {
  await evaluar(`${buscarCarta(texto)}.focus(); true`);
  await enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
}

async function tocar(texto) {
  await evaluar(`(() => {
    const b = ${buscarCarta(texto)};
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', isPrimary: true }));
    b.click();
    return true;
  })()`);
}

async function clicPareja(concepto, inicioDefinicion) {
  await evaluar(`${buscarCarta(concepto)}.click(); ${buscarCarta(inicioDefinicion)}.click(); true`);
}

await enviar('Page.enable');
await enviar('Runtime.enable');
await enviar('Page.navigate', { url: `${base}/index.html` });
await hasta("document.readyState === 'complete'", 'Inicio');
await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); Object.keys(localStorage).filter((k) => k.startsWith('neuroritmo.parejas.')).forEach((k) => localStorage.removeItem(k)); true`);
await enviar('Page.reload', { ignoreCache: true });
await hasta("document.querySelector('.encabezado-app__usuario-nombre')?.textContent.trim() === 'Prueba'", 'recarga con sesión');
await evaluar(`fetch('/api/neuroritmo/m2/iniciar', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sessionStorage.getItem('token') }, body: JSON.stringify({ nueva: true })
}).then((r) => { if (!r.ok) throw new Error('No se pudo iniciar M2'); return r.json(); })`);
await enviar('Page.reload', { ignoreCache: true });
await hasta("document.querySelector('.encabezado-app__usuario-nombre')?.textContent.trim() === 'Prueba'", 'datos del intento nuevo');
await enviar('Page.navigate', { url: `${base}/index.html#mision-m2` });
await hasta("document.querySelector('.neuro-item--parejas')", 'juego de parejas');

const estructura = await evaluar(`(() => ({
  cartas: document.querySelectorAll('.neuro-carta').length,
  botonesNativos: [...document.querySelectorAll('.neuro-carta')].every((b) => b.tagName === 'BUTTON' && b.type === 'button' && b.tabIndex >= 0),
  alturaMinima: Math.min(...[...document.querySelectorAll('.neuro-carta')].map((b) => b.getBoundingClientRect().height)),
  otrosJuegos: /ahorcado|sopa de letras|crucigrama/i.test(document.querySelector('.neuro-item').innerText)
}))()`);
comprobar(estructura.cartas === 12, 'No hay exactamente doce tarjetas para seis parejas.');
comprobar(estructura.botonesNativos && estructura.alturaMinima >= 44, 'Las tarjetas no son controles accesibles de tamaño táctil.');
comprobar(!estructura.otrosJuegos, 'M2 fue sustituida por otro tipo de juego.');

await clicPareja('Codificación', 'Proceso por el que lo aprendido');
await hasta("document.querySelector('#parejas-estado').innerText.includes('Intentos fallidos: 1')", 'registro del fallo');
await esperar(1500);
await pulsarTeclado('Codificación');
await pulsarTeclado('Procesar la información nueva');
await hasta("document.querySelector('#parejas-estado').innerText.includes('Parejas formadas: 1')", 'pareja con teclado');
comprobar(await evaluar("document.querySelector('.neuro-parejas__explicaciones').innerText.includes('Codificación:')"), 'No apareció la explicación tras la pareja.');
comprobar(await evaluar("Object.keys(localStorage).some((k) => k.startsWith('neuroritmo.parejas.'))"), 'No se guardó progreso local.');

await enviar('Page.reload', { ignoreCache: true });
await hasta("document.querySelector('#parejas-estado')?.innerText.includes('Parejas formadas: 1')", 'progreso después de recargar');
const restaurado = await evaluar(`({
  estado: document.querySelector('#parejas-estado').innerText,
  explicacion: document.querySelector('.neuro-parejas__explicaciones').innerText,
  hechas: document.querySelectorAll('.neuro-carta--hecha').length
})`);
comprobar(restaurado.estado.includes('Intentos fallidos: 1') && restaurado.estado.includes('Codificación (1)') && restaurado.estado.includes('Consolidación (1)'), 'No se restauraron fallos y confusiones.');
comprobar(restaurado.explicacion.includes('Codificación:') && restaurado.hechas === 2, 'No se restauró la pareja formada.');

await tocar('Consolidación');
await tocar('Proceso por el que lo aprendido');
await hasta("document.querySelector('#parejas-estado').innerText.includes('Parejas formadas: 2')", 'pareja con pantalla táctil');

await clicPareja('Recuperación', 'Evocar la información');
await clicPareja('Repetición espaciada', 'Repartir el repaso');
await clicPareja('Memoria de trabajo', 'Mantener y manipular');
await clicPareja('Pista de recuperación', 'Estímulo asociado');
await hasta("document.querySelector('[data-registrar-parejas]')", 'seis parejas completas');
await evaluar(`document.querySelector('[data-registrar-parejas]').click(); true`);
await hasta("document.querySelector('.neuro-item--parejas .retro__titulo')", 'retroalimentación del juego');
const registro = await evaluar(`fetch('/api/neuroritmo', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } }).then((r) => r.json()).then((d) => d.progreso.enCurso.m2.respuestas.i1)`);
comprobar(registro.valor.errores === 1, 'El servidor no guardó el fallo.');
comprobar(registro.valor.confusiones.p1 === 1 && registro.valor.confusiones.p2 === 1, 'El servidor no guardó las confusiones por concepto.');
comprobar(registro.puntos === 15, 'Un único fallo fue penalizado en exceso.');
await evaluar(`document.querySelector('.neuro-item__acciones button').click(); true`);
await hasta("document.querySelector('.neuro-item--cancion')", 'siguiente ítem después de la retroalimentación');
comprobar(excepciones.length === 0, `Excepciones: ${excepciones.join('; ')}`);

console.log(JSON.stringify({
  conceptos: 6,
  tarjetas: estructura.cartas,
  mouse: true,
  teclado: true,
  tactil: true,
  progresoTrasRecarga: true,
  explicacionPorPareja: true,
  confusiones: registro.valor.confusiones,
  errores: registro.valor.errores,
  puntos: registro.puntos,
  excepciones: excepciones.length
}, null, 2));
socket.close();
