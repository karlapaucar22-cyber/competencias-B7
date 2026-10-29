const puerto = process.env.CDP_PORT || '9223';
const token = process.env.NR_TOKEN;
const usuario = JSON.parse(process.env.NR_USUARIO || 'null');

if (!token || !usuario) throw new Error('Faltan NR_TOKEN o NR_USUARIO para la cuenta nueva.');

const pestanas = await fetch(`http://127.0.0.1:${puerto}/json/list`).then((r) => r.json());
const pestana = pestanas.find((item) => item.type === 'page' && !item.url.startsWith('chrome'));
if (!pestana) throw new Error('Chrome no expuso una pestaña web para la prueba.');
const socket = new WebSocket(pestana.webSocketDebuggerUrl);
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
    if (mensaje.error) reject(new Error(mensaje.error.message));
    else resolve(mensaje.result);
  }
  if (mensaje.method === 'Runtime.exceptionThrown') {
    excepciones.push(mensaje.params.exceptionDetails.text);
  }
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
  throw new Error(`Tiempo agotado: ${mensaje}`);
}

async function navegar(url, condicion = "document.readyState === 'complete'") {
  await enviar('Page.navigate', { url });
  await hasta(condicion, `carga de ${url}`);
}

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

await enviar('Page.enable');
await enviar('Runtime.enable');
await navegar('http://localhost:3000/index.html');
await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
await navegar('http://localhost:3000/index.html', "document.querySelector('#vista h1') && !document.querySelector('.neuro__cargando')");

const inicio = await evaluar(`(() => ({
  url: location.href,
  texto: document.querySelector('#vista').innerText,
  usuario: document.querySelector('.encabezado-app__usuario-nombre')?.textContent?.trim(),
  explora: document.querySelector('a[href="/paginas/explorar.html"]')?.textContent?.trim(),
  sinGrupo: document.body.innerText.includes('Pide a la administración que te matricule')
}))()`);
comprobar(inicio.texto.includes('Neuri'), 'Inicio no presenta a Neuri.');
comprobar(inicio.texto.includes('Tu objetivo:'), 'Inicio no muestra el objetivo de aprendizaje.');
comprobar(inicio.usuario === 'Prueba', 'La sesión nueva no se refleja en el encabezado.');
comprobar(inicio.explora?.includes('Explora y aprende'), 'El menú no ofrece Explora y aprende.');
comprobar(!inicio.sinGrupo, 'La cuenta nueva no quedó matriculada.');

await evaluar(`document.querySelector('a[href="/paginas/explorar.html"]').click(); true`);
await hasta("location.pathname === '/paginas/explorar.html' && document.querySelectorAll('.explorar-subtema').length === 2", 'Explora y aprende');
await evaluar(`document.querySelectorAll('.explorar-subtema__detalle').forEach((d) => { d.open = true; }); true`);

const explora = await evaluar(`(() => {
  const zona = document.querySelector('#ruta-academica').innerText + ' ' + document.querySelector('#seccion-recursos-neuroritmo').innerText;
  return {
    url: location.href,
    zona,
    unidad: document.querySelector('#titulo-ruta-academica')?.textContent?.trim(),
    tema: [...document.querySelectorAll('.explorar-jerarquia dd')].map((n) => n.textContent.trim()),
    subtemas: [...document.querySelectorAll('.explorar-subtema')].map((n) => ({
      titulo: n.querySelector('h3')?.textContent.trim(),
      explicacion: n.querySelector('details')?.innerText.trim(),
      abierto: n.querySelector('details')?.open,
      estado: n.querySelector('.insignia--acento:last-of-type')?.textContent.trim()
    })),
    recursos: [...document.querySelectorAll('.explorar-recurso')].map((n) => ({
      titulo: n.querySelector('h3')?.textContent.trim(),
      utilidad: n.querySelector('p')?.textContent.trim(),
      href: n.querySelector('a')?.href || null,
      estado: n.innerText.includes('Recurso pendiente de publicación') ? 'pendiente' : 'disponible'
    })),
    hrefVacios: document.querySelectorAll('#ruta-academica a[href=""], #seccion-recursos-neuroritmo a[href=""]').length,
    mapa: document.querySelector('a[href="/index.html#mapa"]')?.href
  };
})()`);
comprobar(explora.unidad === 'La Música en la Educación', 'La unidad académica no aparece.');
comprobar(explora.tema.includes('Fundamentos de Neuroeducación y Desarrollo Cognitivo Musical'), 'Falta el tema general.');
comprobar(explora.subtemas.length === 2 && explora.subtemas.every((s) => s.abierto && s.explicacion.length > 250), 'Los dos subtemas no abren explicaciones suficientes.');
comprobar(explora.subtemas.every((s) => s.explicacion.includes('requiere aprobación docente')), 'No se conserva el aviso de revisión docente.');
comprobar(explora.recursos.length === 3, 'La colección no contiene las tres tarjetas inventariadas.');
comprobar(explora.recursos.filter((r) => r.href).length === 3, 'Los tres recursos verificables no tienen enlace.');
comprobar(explora.recursos.every((r) => r.estado === 'disponible'), 'Algún recurso de la colección sigue marcado como pendiente.');
comprobar(explora.hrefVacios === 0, 'Hay enlaces vacíos en la ruta académica.');
comprobar(!/(lorem|texto genérico|texto de ejemplo|próximamente|sin explicar)/i.test(explora.zona), 'La ruta contiene texto genérico de relleno.');

await evaluar(`document.querySelector('a[href="/index.html#mapa"]').click(); true`);
await hasta("location.pathname === '/index.html' && location.hash === '#mapa' && document.querySelectorAll('.neuro-mision').length === 3", 'mapa de misiones');
const mapa = await evaluar(`(() => ({
  titulo: document.querySelector('#vista h1')?.textContent.trim(),
  misiones: [...document.querySelectorAll('.neuro-mision__titulo')].map((n) => n.textContent.trim()),
  regreso: document.querySelector('a[href="#instrucciones"]')?.textContent.trim()
}))()`);
comprobar(mapa.titulo === 'Mapa de misiones', 'No abrió el mapa de misiones.');
comprobar(mapa.misiones.join('|').includes('Detectives de la atención') && mapa.misiones.join('|').includes('Crea tu misión musical'), 'El mapa no muestra títulos reales.');

await enviar('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true });
const movilMapa = await evaluar(`(() => {
  const boton = document.querySelector('#btn-menu-movil');
  boton.click();
  return {
    ancho: innerWidth,
    contenido: document.documentElement.scrollWidth,
    expandido: boton.getAttribute('aria-expanded'),
    abierto: document.querySelector('#menu-lateral').classList.contains('abierto'),
    opciones: [...document.querySelectorAll('#menu-lateral a')].map((n) => n.textContent.trim())
  };
})()`);
comprobar(movilMapa.ancho === 360 && movilMapa.contenido <= 360, 'El mapa produce desbordamiento horizontal a 360 px.');
comprobar(movilMapa.expandido === 'true' && movilMapa.abierto, 'El menú móvil no abre o no anuncia su estado.');
comprobar(movilMapa.opciones.some((t) => t.includes('Explora y aprende')), 'El menú móvil perdió la ruta académica.');

await navegar('http://localhost:3000/paginas/explorar.html#ruta-academica', "document.querySelectorAll('.explorar-subtema').length === 2");
const movilExplora = await evaluar(`({ ancho: innerWidth, contenido: document.documentElement.scrollWidth, sesion: document.querySelector('.encabezado-app__usuario-nombre')?.textContent.trim() })`);
comprobar(movilExplora.contenido <= 360, 'Explora y aprende produce desbordamiento horizontal a 360 px.');
comprobar(movilExplora.sesion === 'Prueba', 'La sesión no persistió entre páginas.');

await navegar('http://localhost:3000/index.html#retroalimentacion', "document.querySelector('#vista h1, #vista h2') !== null");
const regreso = await evaluar(`document.querySelector('a[href="/paginas/explorar.html#ruta-academica"]')?.textContent.trim() || ''`);
comprobar(regreso === 'Volver a contenidos', 'La retroalimentación no ofrece regreso a contenidos.');
comprobar(excepciones.length === 0, `Excepciones de navegador: ${excepciones.join('; ')}`);

console.log(JSON.stringify({
  cuenta: { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
  inicio: { neuri: true, objetivo: true, sesion: true },
  explora: { unidad: explora.unidad, subtemas: explora.subtemas.length, recursosDisponibles: 2, recursosPendientes: 1 },
  mapa: { misiones: mapa.misiones.length },
  navegacion: { regresoAContenidos: true, menuMovil: true },
  movil: { ancho: 360, sinDesbordamiento: true },
  excepciones: excepciones.length
}, null, 2));

socket.close();
