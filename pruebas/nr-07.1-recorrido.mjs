import { spawn } from 'node:child_process';
import { readFile, writeFile, access, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const datosDir = path.join(raiz, 'datos');
const usuarioId = 'usu_000009';
const archivosMutables = [
  'intentos.json', 'neuroritmo-partidas.json', 'neuroritmo-borradores.json', 'neuroritmo-entregas.json', 'logros.json',
  'sesiones.json', 'bitacora.jsonl', 'notificaciones.json', 'certificados.json', 'alertas.json'
];
const respaldo = new Map();
for (const nombre of archivosMutables) {
  const ruta = path.join(datosDir, nombre);
  try { respaldo.set(ruta, await readFile(ruta)); } catch { respaldo.set(ruta, null); }
}

async function filtrarUsuario(nombre) {
  const ruta = path.join(datosDir, nombre);
  let lista;
  try { lista = JSON.parse(await readFile(ruta, 'utf8')); } catch { return; }
  await writeFile(ruta, `${JSON.stringify(lista.filter((r) => r.usuarioId !== usuarioId), null, 2)}\n`);
}
for (const nombre of ['intentos.json', 'neuroritmo-partidas.json', 'neuroritmo-borradores.json', 'neuroritmo-entregas.json', 'logros.json']) await filtrarUsuario(nombre);

const perfil = path.join(raiz, `.tmp-nr071-${Date.now()}`);
let servidor;
let chrome;
let socket;
const matriz = [];
const excepciones = [];
const comprobar = (condicion, mensaje) => { if (!condicion) throw new Error(mensaje); };
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperarUrl(url) {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* iniciando */ }
    await esperar(200);
  }
  throw new Error(`No respondió ${url}`);
}

try {
  servidor = spawn(process.execPath, ['servidor/server.js'], {
    cwd: raiz, env: { ...process.env, PUERTO: '3117' }, stdio: 'ignore'
  });
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--remote-debugging-port=9237', `--user-data-dir=${perfil}`, 'about:blank'
  ], { cwd: raiz, stdio: 'ignore' });
  await Promise.all([
    esperarUrl('http://127.0.0.1:3117/api/neuroritmo/presentacion'),
    esperarUrl('http://127.0.0.1:9237/json/list')
  ]);

  const login = await fetch('http://127.0.0.1:3117/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'estudiante6@demo.ec', clave: 'Demo12345' })
  });
  comprobar(login.ok, `No se pudo iniciar la sesión estudiantil (${login.status}).`);
  const sesion = await login.json();
  const token = sesion.token;
  const usuario = sesion.usuario;
  comprobar(usuario.id === usuarioId && usuario.rol === 'estudiante', 'La cuenta de prueba no es estudiante.');

  async function api(ruta, metodo = 'GET', cuerpo) {
    const respuesta = await fetch(`http://127.0.0.1:3117${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) })
    });
    const datos = await respuesta.json().catch(() => ({}));
    return { estado: respuesta.status, ok: respuesta.ok, datos };
  }

  const destinos = await fetch('http://127.0.0.1:9237/json/list').then((r) => r.json());
  const destino = destinos.find((p) => p.type === 'page' && !p.url.startsWith('chrome'));
  socket = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let secuencia = 0;
  const pendientes = new Map();
  socket.addEventListener('message', ({ data }) => {
    const mensaje = JSON.parse(data);
    if (mensaje.id && pendientes.has(mensaje.id)) {
      const p = pendientes.get(mensaje.id);
      pendientes.delete(mensaje.id);
      mensaje.error ? p.reject(new Error(mensaje.error.message)) : p.resolve(mensaje.result);
    }
    if (mensaje.method === 'Runtime.exceptionThrown') excepciones.push(mensaje.params.exceptionDetails.text);
  });
  function enviar(method, params = {}) {
    const id = ++secuencia;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pendientes.set(id, { resolve, reject }));
  }
  async function evaluar(expression) {
    const r = await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  }
  async function hasta(expression, mensaje, limite = 15000) {
    const inicio = Date.now();
    while (Date.now() - inicio < limite) {
      if (await evaluar(expression)) return;
      await esperar(100);
    }
    const contexto = await evaluar("({ url: location.href, texto: document.body?.innerText?.slice(0, 600) })");
    throw new Error(`${mensaje}: ${JSON.stringify(contexto)}`);
  }
  async function navegar(url, condicion = "document.readyState === 'complete'") {
    await enviar('Page.navigate', { url });
    await hasta(condicion, `No cargó ${url}`);
  }

  await enviar('Page.enable');
  await enviar('Runtime.enable');
  await navegar('http://127.0.0.1:3117/index.html');
  await evaluar(`sessionStorage.setItem('token', ${JSON.stringify(token)}); sessionStorage.setItem('usuario', ${JSON.stringify(JSON.stringify(usuario))}); true`);
  await navegar('http://127.0.0.1:3117/index.html', "document.querySelector('#vista h1') && !document.querySelector('.neuro__cargando')");
  const inicio = await evaluar(`({
    nombre: document.querySelector('.encabezado-app__usuario-nombre')?.textContent.trim(),
    objetivo: document.querySelector('#vista')?.innerText.includes('Tu objetivo:'),
    neuri: !!document.querySelector('.figura-neuri'),
    explora: !!document.querySelector('a[href="/paginas/explorar.html"]')
  })`);
  comprobar(inicio.nombre === usuario.nombre && inicio.objetivo && inicio.neuri && inicio.explora, 'Inicio u objetivos incompletos.');

  await evaluar("document.querySelector('a[href=\"/paginas/explorar.html\"]').click(); true");
  await hasta("location.pathname === '/paginas/explorar.html' && document.querySelectorAll('.explorar-subtema').length === 2", 'No abrió Explora y aprende');
  await evaluar("document.querySelectorAll('.explorar-subtema__detalle').forEach((d) => { d.open = true; }); true");
  const contenidos = await evaluar(`(() => ({
    unidad: document.querySelector('#titulo-ruta-academica')?.textContent.trim(),
    subtemas: [...document.querySelectorAll('.explorar-subtema')].map((n) => n.innerText.trim()),
    recursos: [...document.querySelectorAll('.explorar-recurso')].map((n) => ({ texto: n.innerText, href: n.querySelector('a')?.href || '' })),
    mapa: document.querySelector('a[href="/index.html#mapa"]')?.href,
    internos: [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin))
  }))()`);
  comprobar(contenidos.unidad === 'La Música en la Educación', 'No aparece la unidad esperada.');
  comprobar(contenidos.subtemas.length === 2 && contenidos.subtemas.every((t) => t.length > 250), 'Los dos subtemas no tienen explicación completa.');
  comprobar(contenidos.recursos.filter((r) => r.href).length === 3, 'No hay exactamente tres recursos verificables.');
  comprobar(!contenidos.recursos.some((r) => r.href.includes('/paginas/autodiagnostico-musical.html')), 'Explora y aprende todavía ofrece acceso a la matriz retirada.');
  const enlacesRotos = [];
  for (const href of [...new Set(contenidos.internos)]) {
    const r = await fetch(href.split('#')[0]);
    if (r.status >= 400) enlacesRotos.push({ href, estado: r.status });
  }
  comprobar(enlacesRotos.length === 0, `Enlaces internos rotos: ${JSON.stringify(enlacesRotos)}`);
  matriz.push({ funcion: 'Inicio, objetivos, unidad, subtemas y recursos', prueba: 'Sesión real, navegación y GET de enlaces internos', resultado: 'Pasa; 3 recursos verificables', archivo: '—' });

  await evaluar("document.querySelector('a[href=\"/index.html#mapa\"]').click(); true");
  await hasta("location.hash === '#mapa' && document.querySelectorAll('.neuro-mision').length === 3", 'No abrió el mapa');

  const valoresM1 = [
    ['i1', { hipotesis: 'El silencio reduce la interferencia verbal durante esta lectura exigente.', prediccion: 'favorable', config: { tipo: 'silencio', volumen: null } }],
    ['i2', { hipotesis: 'La música instrumental baja puede sostener esta tarea mecánica repetitiva.', prediccion: 'favorable', config: { tipo: 'instrumental', volumen: 'bajo' } }],
    ['i3', { hipotesis: 'Una música instrumental baja puede ayudar a regular la tensión.', prediccion: 'favorable', config: { tipo: 'instrumental', volumen: 'bajo' } }],
    ['i4', { opcion: 'b' }]
  ];
  async function completarM1(primerTipo = 'silencio') {
    const inicioM = await api('/api/neuroritmo/m1/iniciar', 'POST', { nueva: true });
    comprobar(inicioM.ok, `No inició M1: ${inicioM.datos.error}`);
    for (const [id, valorOriginal] of valoresM1) {
      const valor = id === 'i1' && primerTipo !== 'silencio'
        ? { ...valorOriginal, prediccion: 'desfavorable', config: { tipo: 'letra', volumen: 'medio' } }
        : valorOriginal;
      const r = await api('/api/neuroritmo/m1/responder', 'POST', { item: id, valor });
      comprobar(r.ok, `Falló ${id} de M1: ${r.datos.error}`);
    }
    const cierre = await api('/api/neuroritmo/m1/finalizar', 'POST', {
      tarjetas: ['t1', 't2'],
      texto: 'La lectura tiene demanda verbal y cada persona responde diferente; compararía condiciones y registraría ideas recordadas para comprobar el efecto.'
    });
    comprobar(cierre.ok, `No finalizó M1: ${cierre.datos.error}`);
    return cierre.datos;
  }
  const m1Primero = await completarM1('silencio');
  const m1Segundo = await completarM1('letra');
  const estadoM1 = (await api('/api/neuroritmo')).datos.progreso.misiones.m1;
  comprobar(m1Primero.puntaje === 100 && m1Segundo.puntaje === 85, 'Puntuación inesperada en M1.');
  comprobar(estadoM1.intentos === 2 && estadoM1.mejor === 100, 'El reintento de M1 perdió la mejor nota.');
  matriz.push({ funcion: 'M1 y reintento', prueba: 'Dos intentos reales: 100 y 85', resultado: 'Pasa; conserva 100 y desbloquea M2', archivo: '—' });

  const inicioM2 = await api('/api/neuroritmo/m2/iniciar', 'POST', { nueva: true });
  comprobar(inicioM2.ok, `No inició M2: ${inicioM2.datos.error}`);
  await navegar('http://127.0.0.1:3117/index.html?nr071=m2#mision-m2', "document.querySelector('.neuro-item--parejas')");
  const pares = [
    ['Codificación', 'Procesar la información nueva'], ['Consolidación', 'Proceso por el que lo aprendido'],
    ['Recuperación', 'Evocar la información'], ['Repetición espaciada', 'Repartir el repaso'],
    ['Memoria de trabajo', 'Mantener y manipular'], ['Pista de recuperación', 'Estímulo asociado']
  ];
  const clicTexto = (texto) => `([...document.querySelectorAll('.neuro-carta')].find((b) => b.querySelector('.neuro-carta__texto').textContent.includes(${JSON.stringify(texto)})))`;
  await evaluar(`${clicTexto(pares[0][0])}.click(); ${clicTexto(pares[0][1])}.click(); true`);
  await hasta("document.querySelector('#parejas-estado').innerText.includes('Parejas formadas: 1')", 'No registró la primera pareja');
  await enviar('Page.reload', { ignoreCache: true });
  await hasta("document.querySelector('#parejas-estado')?.innerText.includes('Parejas formadas: 1')", 'Se perdió el estado de parejas al recargar');
  for (const [concepto, definicion] of pares.slice(1)) await evaluar(`${clicTexto(concepto)}.click(); ${clicTexto(definicion)}.click(); true`);
  await hasta("document.querySelector('[data-registrar-parejas]')", 'No apareció Registrar parejas');
  await evaluar("document.querySelector('[data-registrar-parejas]').click(); true");
  await hasta("document.querySelector('.neuro-item--parejas .retro__titulo')", 'Registrar parejas no respondió');
  const parejaGuardada = (await api('/api/neuroritmo')).datos.progreso.enCurso.m2.respuestas.i1;
  comprobar(parejaGuardada.puntos === 15, 'Las seis parejas correctas no dieron 15 puntos.');
  await evaluar("document.querySelector('.neuro-item__acciones button').click(); true");
  await hasta("document.querySelector('.neuro-cancion-pendiente')", 'No abrió el estado de la canción');
  const cancionUi = await evaluar(`({
    texto: document.querySelector('.neuro-cancion-pendiente').innerText,
    audio: document.querySelectorAll('.neuro-item--cancion audio').length,
    accion: document.querySelectorAll('.neuro-item--cancion .neuro-item__acciones button').length
  })`);
  comprobar(cancionUi.texto.includes('Pendiente de integrar audio y letra autorizados') && cancionUi.audio === 0 && cancionUi.accion === 0, 'La canción pendiente finge reproducción o permite responder.');
  const cancionApi = await api('/api/neuroritmo/m2/responder', 'POST', { item: 'i2', valor: { palabras: {} } });
  comprobar(!cancionApi.ok, 'El servidor aceptó la canción pendiente.');
  matriz.push({ funcion: 'M2: parejas', prueba: '6 parejas, recarga intermedia y registro', resultado: 'Pasa; 15/15 y conserva estado', archivo: '—' });
  matriz.push({ funcion: 'M2: canción', prueba: 'Interfaz y rechazo del servidor', resultado: 'Bloqueada correctamente: falta audio y letra autorizados', archivo: 'Pendiente del equipo' });

  // Puente temporal y reversible: permite probar M3 sin declarar publicada la canción ausente.
  const rutaIntentos = path.join(datosDir, 'intentos.json');
  const intentos = JSON.parse(await readFile(rutaIntentos, 'utf8'));
  intentos.push({
    id: `int_nr071_${Date.now()}`, usuarioId, actividad: 'neuroritmo', temaId: 'tem_000004',
    puntaje: 100, maximo: 100, puntos: 100, errores: 0, fecha: new Date().toISOString(),
    detalle: { mision: 'm2', partidaId: 'puente-nr071', numero: 1, decision: 60, justificacion: 40, pruebaTemporal: true }
  });
  await writeFile(rutaIntentos, `${JSON.stringify(intentos, null, 2)}\n`);

  await navegar('http://127.0.0.1:3117/index.html?nr071=m3#mision-m3', "document.querySelector('#form-diseno')");
  await evaluar(`(() => {
    const f = document.getElementById('form-diseno');
    const poner = (n, v) => { f.elements[n].value = v; f.elements[n].dispatchEvent(new Event('input', { bubbles: true })); };
    poner('objetivo', 'Al finalizar cada estudiante explicará tres conceptos mediante ejemplos propios claros');
    f.elements.tipo.value = 'silencio'; f.elements.tipo.dispatchEvent(new Event('change', { bubbles: true }));
    ['b1','b2','b3','b4','b5'].forEach((id) => document.querySelector('[data-agregar="' + id + '"]').click());
    poner('instrucciones', 'Primero revisen los conceptos, practiquen y luego explíquenlos sin mirar los apuntes.');
    poner('comprobacion', 'Cada estudiante explica los tres conceptos mediante una tarjeta de salida individual.');
    poner('indicador', 'Cada estudiante valora su concentración de uno a cinco al terminar.');
    poner('justificacion', 'La atención se protege al limitar distractores durante la explicación. La recuperación ocurre cuando cada estudiante responde sin mirar. La emoción y la autorregulación se observan con una valoración final, para ajustar el recurso al cansancio sin asumir una respuesta igual para todas las personas.');
    poner('diferencias', 'Cada estudiante puede elegir silencio y comunicar incomodidad, cansancio o necesidad de ajustar el ritmo de trabajo.');
    return true;
  })()`);
  await hasta("document.querySelectorAll('#lista-cotejo .neuro-cotejo__item--ok').length === document.querySelectorAll('#lista-cotejo li').length", 'El diseño válido no completa la lista de cotejo');
  await evaluar("document.querySelector('[data-guardar]').click(); true");
  await hasta("document.querySelector('#estado-borrador').textContent.includes('Borrador guardado')", 'Guardar borrador no tuvo acción');
  await enviar('Page.reload', { ignoreCache: true });
  await hasta("document.querySelector('#form-diseno textarea[name=\"objetivo\"]')?.value.includes('tres conceptos')", 'Se perdió el borrador tras recargar');
  await evaluar("document.querySelector('#form-diseno button[type=\"submit\"]').click(); true");
  await hasta("[...document.querySelectorAll('.modal-acciones button')].some((b) => b.textContent === 'Aceptar')", 'No apareció confirmación de envío');
  await evaluar("[...document.querySelectorAll('.modal-acciones button')].find((b) => b.textContent === 'Aceptar').click(); true");
  await hasta("location.hash === '#retroalimentacion' && document.body.innerText.includes('Misión creada')", 'El envío de M3 no cerró la misión');
  const estadoM3 = (await api('/api/neuroritmo')).datos.progreso.misiones.m3;
  comprobar(estadoM3.estado === 'pendiente', 'M3 enviada no quedó pendiente de valoración docente.');
  matriz.push({ funcion: 'M3: borrador y envío', prueba: 'Guardar, recargar y confirmar envío', resultado: 'Pasa; borrador persiste y entrega queda pendiente', archivo: '—' });

  await navegar('http://127.0.0.1:3117/index.html?nr071=resultados#resultados', "document.querySelector('[data-certificado]')");
  const certificadoUi = await evaluar(`({
    desactivado: document.querySelector('[data-certificado]').disabled,
    requisitos: document.querySelector('.neuro-certificado').innerText,
    botonesSinTexto: [...document.querySelectorAll('#vista button')].filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length
  })`);
  comprobar(certificadoUi.desactivado && certificadoUi.requisitos.includes('Misión 3') && certificadoUi.botonesSinTexto === 0, `La condición del certificado o sus botones es incorrecta: ${JSON.stringify(certificadoUi)}`);
  const certificadoApi = await api('/api/certificados', 'POST', { tipo: 'neuroritmo' });
  comprobar(certificadoApi.estado === 403 && Array.isArray(certificadoApi.datos.requisitos), 'El servidor emitió certificado sin cumplir requisitos.');
  matriz.push({ funcion: 'Resultados y certificado', prueba: 'Vista y POST protegido', resultado: 'Pasa; bloqueado hasta valoración y puntaje de M3', archivo: '—' });

  comprobar(excepciones.length === 0, `Excepciones de navegador: ${excepciones.join('; ')}`);
  console.log(JSON.stringify({ cuenta: `${usuario.correo} (${usuario.rol})`, enlacesInternosRotos: enlacesRotos, excepciones: 0, matriz }, null, 2));
} finally {
  try { socket?.close(); } catch { /* cierre */ }
  chrome?.kill();
  servidor?.kill();
  await esperar(400);
  for (const [ruta, contenido] of respaldo) {
    if (contenido === null) await rm(ruta, { force: true }).catch(() => {});
    else await writeFile(ruta, contenido);
  }
  await rm(perfil, { recursive: true, force: true }).catch(() => {});
}
