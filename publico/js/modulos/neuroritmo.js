// publico/js/modulos/neuroritmo.js
// NeuroRitmo: Misión Cerebro Sonoro (Tarea 3). Ruta: Inicio → Instrucciones → Mapa → Actividades →
// Retroalimentación → Resultados. El servidor corrige y registra los intentos (como el quiz), por eso
// aquí se usa mostrarRetro() por ítem y mostrarLogros() con el resultado de la gamificación.

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { decir, cambiarEstado, figuraNeuri } from '../nucleo/avatar.js';
import { generarDiploma } from '../nucleo/pdf.js';
import * as reglas from '../nucleo/neuroritmo.js';
import { usuarioActual } from '../nucleo/sesion.js';

// NeuroRitmo es el Inicio de la plataforma (index.html): visible también sin sesión
await montarPlantilla({ titulo: 'Inicio', roles: ['publico'] });

const vista = document.getElementById('vista');
const estadoSr = document.getElementById('neuro-estado');
const listaPasos = document.getElementById('ruta-pasos');
const esc = ui.escapar;
const CLAVE_CIERRE = 'neuroritmo.cierre';
const CLAVE_BORRADOR = 'neuroritmo.m3.borrador';

// Las ocho funciones del storyboard de la Tarea 3 (más el panel docente), en secuencia
const PASOS = [
  { id: 'inicio', texto: 'Bienvenida' },
  { id: 'instrucciones', texto: 'Instrucciones' },
  { id: 'mapa', texto: 'Mapa de misiones' },
  { id: 'actividad', texto: 'Actividad', solo: 'estudiante' },
  { id: 'retroalimentacion', texto: 'Retroalimentación', solo: 'estudiante' },
  { id: 'progreso', texto: 'Progreso', solo: 'estudiante' },
  { id: 'resultados', texto: 'Resultados', solo: 'estudiante' },
  { id: 'reiniciar', texto: 'Reiniciar o cancelar', solo: 'estudiante' },
  { id: 'panel', texto: 'Panel docente', solo: 'docente' }
];
const ESTADOS = {
  bloqueada: { texto: 'Bloqueada', icono: '🔒' },
  abierta: { texto: 'Disponible', icono: '▶️' },
  aprobada: { texto: 'Completada', icono: '✔' },
  pendiente: { texto: 'Pendiente de validación', icono: '⏳' },
  devuelta: { texto: 'Devuelta con sugerencias', icono: '✍️' }
};
const RESULTADOS = { favorable: 'Favorable', neutro: 'Neutro o incierto', desfavorable: 'Desfavorable' };
const SONIDOS_SIMULADOR = [
  ['silencio', 'Silencio'],
  ['instrumental', 'Música instrumental suave'],
  ['letra', 'Canción con letra']
];
const VOLUMENES_SIMULADOR = [['bajo', 'Volumen bajo'], ['medio', 'Volumen medio']];
const PREDICCIONES_SIMULADOR = [
  ['favorable', 'Favorecerá la tarea'],
  ['neutro', 'Será neutra o incierta'],
  ['desfavorable', 'Dificultará la tarea']
];
const TITULOS_RETRO = { completo: 'Muy bien: tu decisión es defendible', parcial: 'Defendible con condiciones', 'sin-puntos': 'Revisa esta decisión' };
const ICONOS_RETRO = { completo: '✔', parcial: '◐', 'sin-puntos': '↻' };
const ICONOS_MISION = { m1: '🔎', m2: '🧪', m3: '🎼' };
const ICONOS_ITEM = { simulador: '🎧', opcion: '❔', parejas: '🃏', cancion: '🎵' };
const CLAVE_DESBLOQUEOS = 'neuroritmo.desbloqueos';

let datos = null;            // { experiencia, progreso, rol, galeriaHiloId, sinGrupo }
let partida = null;          // partida en curso de la misión abierta
let primeraVista = true;
let vistaAnterior = '#inicio';  // a dónde vuelve «Cancelar» en Reiniciar o cancelar

const experiencia = () => datos.experiencia;
const esEstudiante = () => datos?.rol === 'estudiante' && !datos.sinGrupo;
const misionPorId = (id) => experiencia().misiones.find((m) => m.id === id);
const anunciar = (texto) => { estadoSr.textContent = ''; setTimeout(() => { estadoSr.textContent = texto; }, 50); };
const figura = () => figuraNeuri().replace('avatar-guia__figura figura-neuri', 'neuri-figura figura-neuri');
const formatoRecursoVisible = (texto) => String(texto || '')
  .replace(/informe de Tarea 2/gi, 'informe de la colección del curso')
  .replace(/Tarea 2/gi, 'colección del curso');

function reproductorCancionPrincipal(cancion) {
  if (!cancion?.id || !cancion.audio) return '';
  const catalogo = `/paginas/canciones.html?cancionId=${encodeURIComponent(cancion.id)}`;
  return `<div class="neuro-reproductor" data-cancion-principal="${esc(cancion.id)}">
    <div class="neuro-reproductor__cabecera">
      <span class="neuro-reproductor__icono" aria-hidden="true">🎵</span>
      <div><p class="neuro-nota">Canción principal del curso</p><h3 class="neuro-reproductor__titulo">${esc(cancion.titulo)}</h3></div>
    </div>
    <p class="neuro-nota">${esc(cancion.autoria)} · ${esc(cancion.licencia)}</p>
    <audio class="neuro-reproductor__audio" controls preload="metadata" muted src="${esc(cancion.audio)}">
      Tu navegador no puede reproducir este audio. <a href="${esc(cancion.audio)}">Descargar MP3</a>
    </audio>
    ${cancion.letra ? `<details><summary>Transcripción de la canción</summary><div>${util.formatoBasico(cancion.letra)}</div></details>` : ''}
    <p><a class="btn btn--secundario btn--pequeno" href="${catalogo}">Abrir en Canciones</a></p>
  </div>`;
}

function leerSesion(clave) {
  try { return JSON.parse(sessionStorage.getItem(clave) || 'null'); } catch { return null; }
}
function guardarSesion(clave, valor) {
  try { sessionStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}
function leerLocal(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; }
}
function guardarLocal(clave, valor) {
  try { valor === null ? localStorage.removeItem(clave) : localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}

const esVisitante = () => datos?.rol === 'publico';
const ENLACE_INGRESO = '/paginas/ingreso.html';

async function cargarDatos() {
  // Sin sesión: presentación pública (narrativa, reglas, recursos y estaciones, sin ítems ni respuestas)
  datos = usuarioActual()
    ? await api.llamar('GET', '/api/neuroritmo')
    : { ...(await api.llamar('GET', '/api/neuroritmo/presentacion')), rol: 'publico' };
}

// ---------- Navegación ----------

function leerHash() {
  const valor = decodeURIComponent(location.hash.replace(/^#/, '')) || 'inicio';
  const mision = /^mision-(m[1-3])$/.exec(valor)?.[1];
  if (mision) return { nombre: 'actividad', mision };
  return { nombre: PASOS.some((p) => p.id === valor) ? valor : 'inicio', mision: null };
}

function ir(hash) {
  if (location.hash === `#${hash}`) render();
  else location.hash = hash;
}

const pasosVisibles = () => {
  const rol = esEstudiante() ? 'estudiante' : ['docente', 'admin'].includes(datos?.rol) ? 'docente' : 'otro';
  return PASOS.filter((p) => !p.solo || p.solo === rol);
};

// Enlaces «Anterior» y «Siguiente» al pie de cada pantalla, en el orden del storyboard
function navegacionSecuencia(actual) {
  const pasos = pasosVisibles();
  const i = pasos.findIndex((p) => p.id === actual);
  if (i < 0) return;
  const anterior = pasos[i - 1];
  // En una actividad en curso solo se ofrece volver al mapa (la misión avanza con sus propios botones)
  const siguiente = actual === 'actividad' ? null : pasos[i + 1];
  if (!anterior && !siguiente) return;
  vista.insertAdjacentHTML('beforeend', `
    <nav class="neuro-secuencia" aria-label="Recorrido del storyboard">
      ${anterior ? `<a class="btn btn--secundario neuro-secuencia__anterior" href="#${anterior.id}"><span aria-hidden="true">←</span> Anterior: ${esc(anterior.texto)}</a>` : '<span></span>'}
      <span class="neuro-secuencia__posicion">Paso ${i + 1} de ${pasos.length}</span>
      ${siguiente ? `<a class="btn btn--primario neuro-secuencia__siguiente" href="#${siguiente.id}">Siguiente: ${esc(siguiente.texto)} <span aria-hidden="true">→</span></a>` : '<span></span>'}
    </nav>`);
}

function pintarPasos(actual) {
  listaPasos.innerHTML = pasosVisibles().map((p) => `
    <li class="ruta-pasos__paso">
      <a class="ruta-pasos__enlace" href="#${p.id}"${p.id === actual ? ' aria-current="step"' : ''}>${esc(p.texto)}</a>
    </li>`).join('');
}

async function render() {
  const { nombre, mision } = leerHash();
  pintarPasos(nombre);
  try {
    if (nombre === 'instrucciones') vistaInstrucciones();
    else if (nombre === 'mapa') vistaMapa();
    else if (nombre === 'actividad') await vistaActividad(mision);
    else if (nombre === 'retroalimentacion') vistaRetroalimentacion();
    else if (nombre === 'progreso') vistaProgreso();
    else if (nombre === 'resultados') vistaResultados();
    else if (nombre === 'reiniciar') vistaReiniciar();
    else if (nombre === 'panel') await vistaPanel();
    else vistaInicio();
    // Si la vista redirigió (p. ej., Progreso sin datos → Mapa), el hash ya cambió y no se añade la secuencia
    if (leerHash().nombre === nombre) navegacionSecuencia(nombre);
  } catch (err) {
    vista.innerHTML = `<div class="alerta alerta--error" role="alert">${esc(err.message || 'No se pudo cargar esta sección')}</div>
      <p><a class="btn btn--secundario" href="#mapa">Volver al mapa</a></p>`;
  }
  if (nombre !== 'reiniciar') vistaAnterior = location.hash || '#inicio';
  // Transición suave entre pantallas (CSS; se desactiva con movimiento reducido)
  vista.classList.remove('neuro__vista--entrando');
  void vista.offsetWidth;
  vista.classList.add('neuro__vista--entrando');
  if (!primeraVista) vista.querySelector('h1, h2')?.focus();
  primeraVista = false;
}

// ---------- Componentes ----------

// Neuri con globo de diálogo contextual (estado: reposo | celebrando | pensando | animando)
function neuriDice(texto, estado = 'reposo') {
  return `
    <div class="neuri-dialogo neuri-dialogo--${estado}">
      <div class="neuri-dialogo__figura" aria-hidden="true">${figura()}</div>
      <p class="neuri-dialogo__globo"><strong>Neuri:</strong> ${esc(texto)}</p>
    </div>`;
}

function medidorCircular(valor, maximo, etiqueta) {
  const pct = Math.round((valor / maximo) * 100);
  return `<div class="neuro-medidor-circular" style="--valor: ${pct}" role="img" aria-label="${esc(etiqueta)}: ${valor} de ${maximo}">
    <span class="neuro-medidor-circular__valor">${valor}<small>/${maximo}</small></span></div>`;
}

function barraProgreso(total, maximo = experiencia().reglas.maximoRuta) {
  const pct = Math.round((total / maximo) * 100);
  const marca = Math.round((experiencia().logroTotal / maximo) * 100);
  return `
    <div class="neuro-progreso">
      <div class="neuro-progreso__cabecera">
        <span>Progreso de la ruta</span>
        <strong>${total}/${maximo} puntos (${pct} %)</strong>
      </div>
      <div class="progreso neuro-progreso__barra" role="progressbar" aria-label="Puntaje total de NeuroRitmo"
           aria-valuemin="0" aria-valuemax="${maximo}" aria-valuenow="${total}">
        <span class="progreso__barra" style="width: ${Math.min(100, pct)}%"></span>
        <span class="neuro-progreso__marca" style="left: ${marca}%" aria-hidden="true"></span>
      </div>
      <p class="neuro-nota">La marca indica el logro de la ruta: ${experiencia().logroTotal}/${maximo} y al menos ${experiencia().aprobacion}/100 en cada misión.</p>
    </div>`;
}

function enlaceRecurso(clave, prefijo = 'Repasa') {
  const r = experiencia().recursos?.[clave];
  if (!r) return '';
  if (!r.url) return `<span class="neuro-nota">📋 «${esc(r.titulo)}»: pendiente de entrega del equipo.</span>`;
  return `<a class="neuro-recurso" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">📺 ${esc(prefijo)}: «${esc(r.titulo)}» <span class="sr-only">(se abre en otra pestaña)</span>↗</a>`;
}

function insigniasHtml() {
  const lista = datos.progreso?.insignias || [];
  if (!lista.length) return '<p class="neuro-nota">Aún no tienes insignias de NeuroRitmo.</p>';
  return `<ul class="neuro-insignias">${lista.map((i) => `<li class="neuro-medalla"><span class="neuro-medalla__icono" aria-hidden="true">${esc(i.icono)}</span> <span class="neuro-medalla__nombre">${esc(i.nombre)}</span></li>`).join('')}</ul>`;
}

// ---------- 1. Inicio ----------

function vistaInicio() {
  const e = experiencia();
  const p = datos.progreso;
  const [nombre, ...lema] = e.titulo.split(':');
  const iconosRecurso = { screencast: '📺', infografia: '🗺️' };
  const recursosVisibles = Object.entries(e.recursos || {})
    .filter(([clave]) => clave !== 'matriz');
  vista.innerHTML = `
    <section class="neuro-portada" aria-labelledby="neuro-titulo">
      <div class="neuro-portada__notas" aria-hidden="true"><span>♪</span><span>♫</span><span>♩</span><span>♬</span><span>♪</span></div>
      <div class="neuro-portada__texto">
        <p class="neuro-portada__antetitulo">Aventura de aprendizaje · Centro de Estudio Sonoro · UNEMI</p>
        <h1 id="neuro-titulo" tabindex="-1"><span class="neuro-portada__marca">${esc(nombre)}</span> <span class="neuro-portada__lema">${esc(lema.join(':').trim())}</span></h1>
        <p class="neuro-portada__intro">${esc(e.narrativa)}</p>
        <ul class="neuro-portada__datos" aria-label="La aventura en cifras">
          <li><span aria-hidden="true">🎯</span> 3 misiones</li>
          <li><span aria-hidden="true">⭐</span> ${e.reglas.maximoRuta} puntos</li>
          <li><span aria-hidden="true">⏱️</span> ${esc(e.duracion)}</li>
          <li><span aria-hidden="true">🏅</span> Certificado</li>
        </ul>
        <div class="neuro-acciones">
          ${esVisitante()
            ? `<a class="btn btn--primario neuro-btn-grande" href="${ENLACE_INGRESO}">Ingresa para comenzar la aventura <span aria-hidden="true">→</span></a>
               <a class="btn btn--secundario" href="/paginas/registro.html">Regístrate como estudiante</a>
               <a class="btn btn--texto" href="#instrucciones">Conoce las reglas</a>`
            : `<a class="btn btn--primario neuro-btn-grande" href="#instrucciones">Comenzar aventura <span aria-hidden="true">→</span></a>
               <a class="btn btn--secundario" href="#mapa">Ver el mapa de misiones</a>
               ${['docente', 'admin'].includes(datos.rol) ? '<a class="btn btn--acento" href="#panel">Panel docente</a>' : ''}`}
        </div>
        <p class="neuro-nota">🔇 El sonido está silenciado por defecto. Puedes activar la voz de Neuri con el botón del avatar.</p>
      </div>
      <div class="neuro-portada__figura">
        ${figura()}
        <p class="neuro-portada__globo">¡Hola! Soy <strong>Neuri</strong>, un cerebro con audífonos. ¿Me acompañas a restablecer el equilibrio sonoro?</p>
      </div>
    </section>
    ${datos.sinGrupo ? '<div class="alerta alerta--advertencia" role="alert">NeuroRitmo forma parte de la asignatura «Fundamentos de Neuroeducación y Desarrollo Cognitivo Musical». Pide a la administración que te matricule para registrar tu progreso.</div>' : ''}
    <section class="tarjeta neuro-objetivo" aria-label="Objetivo de aprendizaje">
      <span class="neuro-objetivo__icono" aria-hidden="true">🎯</span>
      <p><strong>Tu objetivo:</strong> ${esc(e.objetivo)}</p>
    </section>
    ${p ? `<section class="tarjeta">${barraProgreso(p.total)}</section>` : ''}
    <section class="tarjeta" aria-labelledby="neuro-recursos">
      <h2 id="neuro-recursos" class="tarjeta__titulo">Recursos del curso</h2>
      <p class="tarjeta__subtitulo">La retroalimentación de cada misión enlaza con estos recursos de la colección abierta del equipo.</p>
      <ul class="neuro-lista-recursos">
        ${recursosVisibles.map(([clave, r]) => `
          <li><span class="neuro-lista-recursos__icono" aria-hidden="true">${iconosRecurso[clave] || '📘'}</span>
            ${r.url
              ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.titulo)} <span class="sr-only">(se abre en otra pestaña)</span>↗</a>`
              : `<strong>${esc(r.titulo)}</strong> <span class="insignia insignia--acento">Pendiente de entrega</span>`}
            <span class="neuro-nota">${esc(formatoRecursoVisible(r.formato))} · ${esc(r.autoria)} · ${esc(r.licencia)}</span>
            ${r.alterno ? `<a class="neuro-nota" href="${esc(r.alterno)}" target="_blank" rel="noopener noreferrer">Versión en Canva ↗</a>` : ''}
          </li>`).join('')}
        ${e.cancionPrincipal ? `<li><span class="neuro-lista-recursos__icono" aria-hidden="true">🎵</span>${reproductorCancionPrincipal(e.cancionPrincipal)}</li>` : ''}
      </ul>
    </section>`;
  decir('Te damos la bienvenida al Centro de Estudio Sonoro. Pulsa «Comenzar aventura» para conocer las reglas de la misión.');
}

// ---------- 2. Instrucciones ----------

function vistaInstrucciones() {
  const e = experiencia();
  const iconosReglas = ['📖', '✍️', '🔓', '🤖'];
  vista.innerHTML = `
    <h1 id="neuro-instrucciones" tabindex="-1" class="neuro-titulo">Instrucciones de Neuri</h1>
    ${neuriDice('Antes de empezar, conoce las cuatro reglas del Centro de Estudio Sonoro. ¡Son pocas y te ayudarán a ganar puntos!')}
    <section class="tarjeta neuro-antes" aria-labelledby="neuro-antes">
      <h2 id="neuro-antes" class="tarjeta__titulo">Antes de empezar</h2>
      <dl class="neuro-antes__datos">
        <div><dt><span aria-hidden="true">🎯</span> Objetivo</dt><dd>${esc(e.objetivo)}</dd></div>
        <div><dt><span aria-hidden="true">⏱️</span> Tiempo estimado</dt><dd>${esc(e.duracion)}, en sesiones breves. Puedes salir al mapa y continuar después: tu intento se guarda.</dd></div>
        <div><dt><span aria-hidden="true">📏</span> Normas</dt><dd>${e.reglasJuego.length} reglas, que se detallan abajo.</dd></div>
        <div><dt><span aria-hidden="true">🔇</span> Sonido</dt><dd>Silenciado por defecto; la voz de Neuri se activa solo si tú lo pides. La canción de la Misión 2 se muestra siempre como texto en pantalla.</dd></div>
      </dl>
    </section>
    <section aria-labelledby="neuro-instrucciones">
      <ol class="neuro-reglas neuro-reglas--tarjetas">${e.reglasJuego.map((r, i) => `<li class="neuro-regla"><span class="neuro-regla__icono" aria-hidden="true">${iconosReglas[i] || '⭐'}</span><span>${esc(r)}</span></li>`).join('')}</ol>
    </section>
    <section class="neuro-rejilla" aria-label="Sistema de puntuación">
      ${e.misiones.map((m) => `
        <article class="tarjeta neuro-mini neuro-mini--${m.id}">
          <p class="neuro-mini__estacion"><span aria-hidden="true">${ICONOS_MISION[m.id]}</span> Estación ${esc(m.estacion)} · Nivel ${esc(m.nivel)}</p>
          <h2 class="tarjeta__titulo">Misión ${m.numero}: ${esc(m.titulo)}</h2>
          <p><strong>100 puntos</strong>: 60 por ${m.id === 'm3' ? 'el producto' : 'las decisiones'} y 40 por la justificación.</p>
          <p class="neuro-nota">${m.id === 'm3' ? 'La puntúa tu docente con una rúbrica de cuatro criterios.' : 'La plataforma puntúa automáticamente las decisiones y las tarjetas de argumento.'}</p>
        </article>`).join('')}
    </section>
    <section class="tarjeta" aria-labelledby="neuro-ayudas">
      <h2 id="neuro-ayudas" class="tarjeta__titulo">Pistas y tutor de IA</h2>
      <ul class="neuro-reglas">
        <li><strong>Necesito una pista:</strong> tres niveles preparados por el docente (pregunta orientadora, pista conceptual y ejemplo paralelo). No restan puntos, pero quedan registradas.</li>
        <li><strong>Pregúntale a Neuri:</strong> el tutor de IA orienta con preguntas, sin dar la respuesta ni calificar. En la Misión 1 se habilita desde tu segundo intento; en la 2 ofrece pistas y ejemplos; en la 3 revisa tu borrador.</li>
        <li><strong>Explícame el error:</strong> después de responder, Neuri te ayuda a descubrir qué condición no consideraste.</li>
      </ul>
      <p class="neuro-nota">Logro final: ${e.logroTotal}/${e.reglas.maximoRuta}, mínimo ${e.aprobacion}/100 en cada misión y la justificación de la Misión 3 validada por tu docente → certificado «Ruta NeuroRitmo completada».</p>
      <div class="neuro-acciones"><a class="btn btn--primario" href="#mapa">Ver el mapa de misiones</a></div>
    </section>`;
  decir('Recuerda: toda decisión necesita una justificación y las pistas no restan puntos.');
}

// ---------- 3. Mapa de misiones ----------

function accionMapa(m) {
  const est = datos.progreso.misiones[m.id];
  const enCurso = datos.progreso.enCurso?.[m.id];
  if (est.estado === 'bloqueada') return { texto: 'Bloqueada', bloqueada: true };
  if (est.estado === 'pendiente') return { texto: 'Ver envío', nueva: false };
  if (enCurso) return { texto: 'Continuar', nueva: false };
  if (est.estado === 'devuelta') return { texto: 'Mejorar diseño', nueva: true };
  if (est.intentos > 0) return { texto: est.aprobada ? 'Repetir misión' : 'Reintentar', nueva: true };
  return { texto: 'Iniciar', nueva: true };
}

// Estaciones desbloqueadas que el estudiante aún no había visto (solo para el aviso visual)
function nuevasDesbloqueadas(p) {
  const vistas = new Set(leerLocal(CLAVE_DESBLOQUEOS) || ['m1']);
  const nuevas = ['m2', 'm3'].filter((id) => p.misiones[id].estado !== 'bloqueada' && !vistas.has(id));
  guardarLocal(CLAVE_DESBLOQUEOS, [...new Set([...vistas, ...nuevas])]);
  return nuevas;
}

function vistaMapa() {
  const e = experiencia();
  const p = datos.progreso;
  const nuevas = p ? nuevasDesbloqueadas(p) : [];
  const siguiente = p && e.misiones.find((m) => ['abierta', 'devuelta'].includes(p.misiones[m.id].estado));
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Mapa de misiones</h1>
    ${neuriDice(nuevas.length
      ? `¡Nueva estación desbloqueada: ${misionPorId(nuevas.at(-1)).titulo}! Sigue así.`
      : siguiente ? `Tu próxima parada es «${siguiente.titulo}». Cada estación se abre con 70 de 100 en la anterior.`
      : 'Recorre las tres estaciones del Centro de Estudio Sonoro: Atención, Memoria e Integración pedagógica.', nuevas.length ? 'celebrando' : 'reposo')}
    ${p ? `<section class="tarjeta neuro-resumen-ruta">${barraProgreso(p.total)}${insigniasHtml()}</section>` : ''}
    <ol class="neuro-mapa" aria-label="Estaciones del Centro de Estudio Sonoro">
      ${e.misiones.map((m) => {
        const est = p?.misiones[m.id];
        const estado = est ? ESTADOS[est.estado] : null;
        const accion = p ? accionMapa(m) : null;
        const recien = nuevas.includes(m.id);
        return `
          <li class="neuro-mision neuro-mision--${m.id}${est ? ` neuro-mision--${est.estado}` : ''}${recien ? ' neuro-mision--recien' : ''}" aria-labelledby="mision-${m.id}">
            <div class="neuro-mision__cabecera">
              <span class="neuro-mision__icono" aria-hidden="true">${est?.estado === 'bloqueada' ? '🔒' : ICONOS_MISION[m.id]}</span>
              <div>
                <p class="neuro-mision__estacion">Estación ${m.numero} · ${esc(m.estacion)}</p>
                <h2 id="mision-${m.id}" class="neuro-mision__titulo">${esc(m.titulo)}</h2>
              </div>
            </div>
            <div class="neuro-mision__cuerpo">
              <p class="neuro-mision__etiquetas">
                <span class="neuro-pildora">Rol: ${esc(m.nivel)}</span>
                ${estado ? `<span class="neuro-pildora neuro-pildora--${est.estado}"><span aria-hidden="true">${estado.icono}</span> ${esc(estado.texto)}</span>` : ''}
              </p>
              ${recien ? '<p class="neuro-mision__nueva" role="status">🔓 ¡Estación desbloqueada!</p>' : ''}
              ${est ? `
                <div class="neuro-mision__puntaje">
                  <span>Mejor puntaje <strong>${est.mejor}/100</strong></span>
                  <span>${m.id === 'm3' ? 'Envíos' : 'Intentos'}: ${est.intentos}</span>
                </div>
                <div class="progreso neuro-mision__barra" role="progressbar" aria-label="Mejor puntaje de la misión ${m.numero}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${est.mejor}">
                  <span class="progreso__barra" style="width: ${est.mejor}%"></span>
                  <span class="neuro-progreso__marca" style="left: ${e.aprobacion}%" aria-hidden="true"></span>
                </div>` : ''}
              <p class="neuro-nota">${esc(m.narrativa)}</p>
              ${accion?.bloqueada
                ? `<p class="neuro-mision__candado">🔒 Se desbloquea al obtener ${e.aprobacion}/100 en la misión anterior.</p>`
                : accion ? `<button type="button" class="btn btn--primario" data-mision="${m.id}" data-nueva="${accion.nueva}">${esc(accion.texto)} <span aria-hidden="true">→</span></button>`
                : esVisitante() ? `<a class="btn btn--primario" href="${ENLACE_INGRESO}">Ingresa para jugar</a>`
                : `<a class="btn btn--secundario" href="#mision-${m.id}">Ver contenido</a>`}
              ${m.temaId && !esVisitante() ? `
                <p class="neuro-mision__enlaces">
                  <a class="btn btn--texto btn--pequeno" href="/paginas/tema.html?id=${encodeURIComponent(m.temaId)}">📖 Repasar la lección</a>
                  <a class="btn btn--texto btn--pequeno" href="/paginas/ahorcado.html?temaId=${encodeURIComponent(m.temaId)}">🧩 Practicar el vocabulario</a>
                </p>` : ''}
            </div>
          </li>`;
      }).join('')}
    </ol>
    ${p?.misiones.m3.aprobada ? '<p class="neuro-acciones"><a class="btn btn--acento" href="#resultados">Ver resultados</a></p>' : ''}
    ${esVisitante() ? `<p class="alerta alerta--info">Inicia sesión para jugar las misiones y guardar tu progreso. <a href="${ENLACE_INGRESO}">Ingresar</a></p>`
      : !p && !datos.sinGrupo ? '<p class="alerta alerta--info">Vista docente: el seguimiento del grupo está en «Panel docente».</p>' : ''}`;

  vista.querySelectorAll('button[data-mision]').forEach((boton) => boton.addEventListener('click', () => abrirMision(boton.dataset.mision, boton.dataset.nueva === 'true')));
  decir('Elige una estación. Cada misión se desbloquea con 70 de 100 puntos en la anterior.');
}

async function abrirMision(id, nueva) {
  const est = datos.progreso.misiones[id];
  if (nueva && est.intentos > 0 && !(await ui.confirmar('Se iniciará un intento nuevo. Tu mejor puntuación se conserva. ¿Continuar?'))) return;
  if (nueva) {
    try {
      partida = await api.llamar('POST', `/api/neuroritmo/${id}/iniciar`, { nueva: true });
      datos.progreso.enCurso[id] = partida;
    } catch (err) {
      ui.aviso(err.message, 'error');
      return;
    }
  }
  ir(`mision-${id}`);
}

// ---------- 4. Actividades ----------

async function vistaActividad(id) {
  if (esVisitante()) {
    vista.innerHTML = `<h1 tabindex="-1" class="neuro-titulo">Actividades</h1>
      <p class="alerta alerta--info">Las misiones se juegan con tu cuenta para guardar tu progreso.</p>
      <p class="neuro-acciones"><a class="btn btn--primario" href="${ENLACE_INGRESO}">Ingresar</a> <a class="btn btn--secundario" href="/paginas/registro.html">Registrarse</a></p>`;
    return;
  }
  if (!id) {
    // «Actividades»: la misión abierta más avanzada
    const p = datos.progreso;
    if (!p) return ir('mapa');
    id = ['m3', 'm2', 'm1'].find((m) => p.enCurso?.[m]) || ['m1', 'm2', 'm3'].find((m) => ['abierta', 'devuelta', 'pendiente'].includes(p.misiones[m].estado));
    if (!id) {
      vista.innerHTML = `<h1 tabindex="-1" class="neuro-titulo">Actividades</h1>
        <p class="alerta alerta--exito">¡Superaste las tres misiones! Puedes repetir cualquiera desde el mapa para mejorar tu puntaje.</p>
        <p class="neuro-acciones"><a class="btn btn--primario" href="#resultados">Ver resultados</a> <a class="btn btn--secundario" href="#mapa">Ir al mapa</a></p>`;
      return;
    }
  }
  const mision = misionPorId(id);
  if (!mision) return ir('mapa');
  if (!esEstudiante()) return vistaPrevia(mision);

  const est = datos.progreso.misiones[id];
  if (est.estado === 'bloqueada') {
    vista.innerHTML = `<h1 tabindex="-1" class="neuro-titulo">Misión ${mision.numero}: ${esc(mision.titulo)}</h1>
      <p class="alerta alerta--advertencia">🔒 Esta misión se desbloquea al obtener ${experiencia().aprobacion}/100 en la misión anterior.</p>
      <p><a class="btn btn--secundario" href="#mapa">Volver al mapa</a></p>`;
    return;
  }
  if (id === 'm3' && est.estado === 'pendiente') return vistaPendiente(mision);

  partida = datos.progreso.enCurso?.[id];
  if (!partida) {
    partida = await api.llamar('POST', `/api/neuroritmo/${id}/iniciar`, {});
    datos.progreso.enCurso[id] = partida;
  }
  if (id === 'm3') return vistaDiseno(mision);
  pintarMision(mision);
}

function encabezadoMision(mision, paso, total) {
  return `
    <header class="neuro-mision-cabecera neuro-mision-cabecera--${mision.id}">
      <span class="neuro-mision__icono" aria-hidden="true">${ICONOS_MISION[mision.id]}</span>
      <div class="neuro-mision-cabecera__texto">
        <p class="neuro-mini__estacion">Estación ${esc(mision.estacion)} · Nivel ${esc(mision.nivel)} · Intento ${partida?.numero || 1}</p>
        <h1 tabindex="-1" class="neuro-titulo">Misión ${mision.numero}: ${esc(mision.titulo)}</h1>
      </div>
      <a class="btn btn--secundario btn--pequeno" href="#mapa">Salir al mapa</a>
    </header>
    ${total ? `<p class="neuro-paso">Paso ${paso} de ${total}</p>
      <div class="progreso" role="progressbar" aria-label="Avance de la misión" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${paso}">
        <span class="progreso__barra" style="width: ${Math.round((paso / total) * 100)}%"></span>
      </div>` : ''}`;
}

function pintarMision(mision, itemRetro = null) {
  const respuestas = partida.respuestas || {};
  const pendiente = mision.items.find((i) => !respuestas[i.id]);
  const total = mision.items.length + 1;
  const actual = itemRetro || pendiente;
  const paso = actual ? mision.items.indexOf(actual) + 1 : total;
  vista.innerHTML = `
    ${encabezadoMision(mision, paso, total)}
    ${paso === 1 && !itemRetro ? `${neuriDice(mision.narrativa)}<section class="tarjeta neuro-narrativa"><p><strong>📝 Instrucciones:</strong> ${esc(mision.instrucciones)}</p>${mision.aviso ? `<p class="neuro-nota">ℹ️ ${esc(mision.aviso)}</p>` : ''}${notaDistribucion(mision)}</section>${retroAnteriorHtml(mision)}` : ''}
    <ol class="neuro-items" aria-label="Ítems de la misión">
      ${mision.items.map((i, n) => {
        const r = respuestas[i.id];
        return `<li class="neuro-items__item${r ? ` neuro-items__item--${r.retro.nivel}` : ''}">${n + 1}. ${esc(i.titulo)}${r ? ` · ${r.puntos}/${r.maximo || 15}` : ''}</li>`;
      }).join('')}
      <li class="neuro-items__item">${total}. Justificación</li>
    </ol>
    <div id="zona-item"></div>`;
  // Abrir la retroalimentación del intento anterior queda registrado (evidencia de «Mente en ajuste»)
  vista.querySelector('[data-retro-anterior]')?.addEventListener('toggle', (ev) => {
    if (!ev.target.open || partida.retroRevisada) return;
    partida.retroRevisada = true;
    api.llamar('POST', `/api/neuroritmo/${mision.id}/retro-revisada`).catch(() => { partida.retroRevisada = false; });
  });
  const zona = document.getElementById('zona-item');
  if (itemRetro) {
    zona.append(tarjetaItem(mision, itemRetro, respuestas[itemRetro.id]));
    return;
  }
  if (pendiente) {
    zona.append(tarjetaItem(mision, pendiente, null));
    decir(paso === 1
      ? `Misión ${mision.numero}: ${mision.titulo}. ${mision.narrativa} Recuerda: ${mision.instrucciones}`
      : `Continúa con el paso ${paso}: ${pendiente.titulo}. Revisa la situación antes de responder.`);
  } else {
    zona.append(tarjetaJustificacion(mision));
    decir('Última transición: justifica tus decisiones con tus propias palabras antes de cerrar la misión.');
  }
}

// En un reintento: retroalimentación del intento anterior por concepto
function retroAnteriorHtml(mision) {
  const previa = datos.progreso?.retroAnterior?.[mision.id];
  if (!previa || Number(partida?.numero) < 2) return '';
  const r = experiencia().reglas;
  return `
    <details class="tarjeta neuro-version" data-retro-anterior>
      <summary>📋 Revisa la retroalimentación de tu intento ${previa.numero} (${previa.puntaje}/${r.puntosPorMision})</summary>
      <ul class="neuro-conceptos">${previa.items.map((i) => `<li class="neuro-conceptos__item"><span aria-hidden="true">${i.puntos >= i.maximo ? '✔' : i.puntos > 0 ? '◐' : '✖'}</span> ${esc(i.concepto)} · ${i.puntos}/${i.maximo}${i.revisar ? `<br><small>${esc(i.revisar)}</small>` : ''}${i.puntos < i.maximo && i.recurso ? `<br><small>${enlaceRecurso(i.recurso)}</small>` : ''}</li>`).join('')}</ul>
      <p class="neuro-nota">Si mejoras ${r.mejoraMinima} puntos o más después de revisar esta retroalimentación (o de usar pistas o a Neuri), obtienes «Mente en ajuste». Las pistas no restan puntos y se conserva tu mejor nota.</p>
    </details>`;
}

// Reparto de los 60 puntos de decisiones y productos cuando la misión lo define (M2)
function notaDistribucion(mision) {
  const d = mision.distribucion;
  if (!d) return '';
  const lista = mision.items.map((i) => `${esc(i.titulo)}: ${d.valores[i.id]}`).join(' · ');
  return `<p class="neuro-nota">🎯 Puntos por actividad (60 en total): ${lista}. Justificación: 40. ${d.estado === 'aprobada'
    ? 'Distribución aprobada por tu docente.'
    : 'Distribución propuesta por el equipo, pendiente de aprobación de tu docente.'}</p>`;
}

function tarjetaItem(mision, item, respuesta) {
  const tarjeta = document.createElement('section');
  tarjeta.className = `tarjeta neuro-item neuro-item--${item.tipo}`;
  tarjeta.setAttribute('aria-labelledby', `titulo-${item.id}`);
  tarjeta.innerHTML = `
    <div class="neuro-item__cabecera">
      <span class="neuro-item__icono" aria-hidden="true">${ICONOS_ITEM[item.tipo] || '⭐'}</span>
      <div>
        <p class="neuro-mini__estacion">Concepto: ${esc(item.concepto)}</p>
        <h2 id="titulo-${item.id}" class="tarjeta__titulo">${esc(item.titulo)}</h2>
      </div>
    </div>
    <p class="neuro-situacion"><span class="neuro-situacion__etiqueta">📍 Situación</span> ${esc(item.situacion)}</p>
    <div class="neuro-item__cuerpo"></div>
    <div class="neuro-item__retro"></div>
    <div class="neuro-item__acciones neuro-acciones"></div>`;
  const cuerpo = tarjeta.querySelector('.neuro-item__cuerpo');
  const constructores = { simulador: itemSimulador, opcion: itemOpcion, parejas: itemParejas, cancion: itemCancion };
  constructores[item.tipo](cuerpo, mision, item, respuesta, tarjeta);
  if (!(item.tipo === 'cancion' && item.estado !== 'publicado')) tarjeta.append(panelAyuda(mision, item, respuesta));
  if (respuesta) mostrarRespuesta(tarjeta, mision, item, respuesta);
  return tarjeta;
}

async function responder(tarjeta, mision, item, valor, boton) {
  boton.disabled = true;
  try {
    const r = await api.llamar('POST', `/api/neuroritmo/${mision.id}/responder`, { item: item.id, valor });
    partida.respuestas = { ...partida.respuestas, [item.id]: { ...r, valor } };
    pintarMision(mision, item);
    anunciar(`${TITULOS_RETRO[r.retro.nivel]}. ${r.puntos} de ${r.maximo} puntos.`);
  } catch (err) {
    boton.disabled = false;
    ui.aviso(err.message, 'error');
  }
}

function mostrarRespuesta(tarjeta, mision, item, r) {
  tarjeta.querySelectorAll('.neuro-item__cuerpo input, .neuro-item__cuerpo select, .neuro-item__cuerpo textarea, .neuro-item__cuerpo button').forEach((c) => { c.disabled = true; });
  const panel = mostrarRetro({ correcto: r.retro.nivel === 'completo', explicacion: r.retro.explicacion, sugerencia: r.retro.sugerencia || r.retro.complemento || '' });
  panel.classList.add(`neuro-retro--${r.retro.nivel}`);
  panel.querySelector('.retro__icono').textContent = ICONOS_RETRO[r.retro.nivel];
  panel.querySelector('.retro__titulo').textContent = `${item.tipo === 'simulador' ? 'Explicación docente · ' : ''}${TITULOS_RETRO[r.retro.nivel]} · ${r.puntos}/${r.maximo || 15} puntos`;
  const recurso = enlaceRecurso(r.retro.recurso);
  const enlaceTema = mision.temaId
    ? `<a class="neuro-recurso neuro-recurso--tema" href="/paginas/tema.html?id=${encodeURIComponent(mision.temaId)}" target="_blank" rel="noopener noreferrer">📖 Repasar tema en Explora y aprende <span class="sr-only">(se abre en otra pestaña)</span>↗</a>`
    : '';
  const fila = (titulo, contenido) => `<div><dt>${titulo}</dt><dd>${contenido}</dd></div>`;
  const ind = r.retro.indicador;
  const badgeInd = ind
    ? `<span class="insignia insignia--${ind.demostrado ? 'verde' : ind.puntos > 0 ? 'amarillo' : 'coral'}">${ind.demostrado ? '✔ Logrado' : ind.puntos > 0 ? '⚠ En desarrollo' : '✖ Por reforzar'} (${ind.puntos}/${ind.maximo})</span> · ${esc(ind.concepto)}`
    : '';
  panel.querySelector('.retro__cuerpo').insertAdjacentHTML('beforeend', `
    <dl class="neuro-retro-detalle">
      ${fila('Concepto aplicado', esc(r.retro.concepto || item.concepto || ''))}
      ${badgeInd ? fila('Indicador de logro', badgeInd) : ''}
      ${r.valor?.justificacion ? fila('Justificación registrada', esc(r.valor.justificacion)) : ''}
      ${r.valor?.propuesta ? fila('Propuesta registrada', esc(r.valor.propuesta)) : ''}
      ${fila('Error a revisar', r.retro.revisar ? esc(r.retro.revisar) : 'Ninguno: tu decisión obtuvo el puntaje completo.')}
      ${r.retro.sugerencia && r.retro.complemento ? fila('Para profundizar', esc(r.retro.complemento)) : ''}
      ${recurso ? fila('Recurso enlazado', recurso) : ''}
      ${enlaceTema ? fila('Recursos del tema', enlaceTema) : ''}
    </dl>
    ${mision.temaId ? `
      <div class="neuro-retro-recursos-accion">
        <a class="btn btn--secundario btn--pequeno" href="/paginas/tema.html?id=${encodeURIComponent(mision.temaId)}" target="_blank" rel="noopener noreferrer">
          📖 Revisar recursos del tema «${esc(mision.titulo || 'Memoria')}» ↗
        </a>
      </div>` : ''}`);
  const zonaRetro = tarjeta.querySelector('.neuro-item__retro');
  if (item.tipo === 'simulador') zonaRetro.insertAdjacentHTML('beforeend', resultadoSimulador(r));
  zonaRetro.append(panel);
  const acciones = tarjeta.querySelector('.neuro-item__acciones');
  const siguiente = document.createElement('button');
  siguiente.type = 'button';
  siguiente.className = 'btn btn--primario';
  const ultimo = mision.items.indexOf(item) === mision.items.length - 1;
  siguiente.textContent = ultimo ? 'Ir a la justificación' : 'Siguiente ítem';
  siguiente.addEventListener('click', () => { pintarMision(mision); vista.querySelector('.neuro-item h2')?.focus(); });
  acciones.replaceChildren(siguiente);
  decir(r.retro.nivel === 'completo' ? '¡Bien razonado! Lee la explicación y continúa al siguiente paso.' : 'Revisa la explicación y el recurso enlazado antes de continuar.');
}

function resultadoSimulador(r) {
  const niveles = { favorable: 3, neutro: 2, desfavorable: 1 };
  const n = niveles[r.retro.resultado] || 1;
  const valor = r.valor || {};
  const tipo = SONIDOS_SIMULADOR.find(([id]) => id === valor.config?.tipo)?.[1] || 'No registrado';
  const volumen = valor.config?.tipo === 'silencio'
    ? 'No corresponde'
    : VOLUMENES_SIMULADOR.find(([id]) => id === valor.config?.volumen)?.[1] || 'No registrado';
  const prediccion = PREDICCIONES_SIMULADOR.find(([id]) => id === valor.prediccion)?.[1] || 'No registrada';
  return `
    <div class="neuro-simulacion neuro-simulacion--${esc(r.retro.resultado)}">
      <p class="neuro-simulacion__titulo">Resultado del modelo: <strong>${esc(RESULTADOS[r.retro.resultado] || r.retro.resultado)}</strong></p>
      <div class="neuro-medidor" aria-hidden="true">${[1, 2, 3].map((i) => `<span class="neuro-medidor__barra${i <= n ? ' neuro-medidor__barra--activa' : ''}"></span>`).join('')}</div>
      <dl class="neuro-simulacion__registro">
        <div><dt>Hipótesis registrada</dt><dd>${esc(valor.hipotesis || 'No registrada')}</dd></div>
        <div><dt>Configuración ejecutada</dt><dd>${esc(tipo)} · ${esc(volumen)}</dd></div>
        <div><dt>Predicción previa</dt><dd>${esc(prediccion)}</dd></div>
      </dl>
      <p><strong>Comparación razonada:</strong> ${r.retro.coincide ? 'tu predicción coincide con el modelo; contrasta ahora tus razones con la explicación docente.' : 'tu predicción no coincide con el modelo; revisa qué demanda de la tarea o qué variable sonora cambia la explicación docente.'}</p>
      <p class="neuro-nota">Es un modelo educativo, no una predicción individual: comprueba el efecto en ti con indicadores observables.</p>
    </div>`;
}

// Ítems 1 a 3 de M1: Sala de estudio sonora
function itemSimulador(cuerpo, mision, item, respuesta, tarjeta) {
  const v = respuesta?.valor || {};
  const id = item.id;
  cuerpo.innerHTML = `
    <div class="campo">
      <label for="hipotesis-${id}">Tu hipótesis: ¿qué condición sonora conviene y por qué?</label>
      <textarea id="hipotesis-${id}" rows="3" maxlength="600" aria-describedby="ayuda-hip-${id}">${esc(v.hipotesis || '')}</textarea>
      <p id="ayuda-hip-${id}" class="neuro-nota">Al menos 6 palabras. <span data-contador>0 palabras</span></p>
    </div>
    <fieldset class="neuro-opciones">
      <legend>Configura el ambiente</legend>
      <p class="neuro-nota">Simulación sin audio: estas opciones representan condiciones de estudio y no reproducen sonido. Puedes cambiar tipo y volumen antes de ejecutar.</p>
      <div class="neuro-opciones__grupo" role="radiogroup" aria-label="Tipo de sonido">
        ${SONIDOS_SIMULADOR.map(([valor, texto]) => `
          <label class="neuro-opcion"><input type="radio" name="tipo-${id}" value="${valor}"${v.config?.tipo === valor ? ' checked' : ''}> ${texto}</label>`).join('')}
      </div>
      <div class="neuro-opciones__grupo" role="radiogroup" aria-label="Volumen">
        ${VOLUMENES_SIMULADOR.map(([valor, texto]) => `
          <label class="neuro-opcion"><input type="radio" name="volumen-${id}" value="${valor}"${v.config?.volumen === valor ? ' checked' : ''}> ${texto}</label>`).join('')}
      </div>
    </fieldset>
    <fieldset class="neuro-opciones">
      <legend>Tu predicción para esta tarea</legend>
      ${PREDICCIONES_SIMULADOR.map(([valor, texto]) => `
        <label class="neuro-opcion"><input type="radio" name="prediccion-${id}" value="${valor}"${v.prediccion === valor ? ' checked' : ''}> ${texto}</label>`).join('')}
    </fieldset>`;
  const hipotesis = cuerpo.querySelector('textarea');
  const contador = cuerpo.querySelector('[data-contador]');
  const contar = () => { contador.textContent = `${reglas.contarPalabras(hipotesis.value)} palabras`; };
  hipotesis.addEventListener('input', contar);
  contar();
  const volumenes = cuerpo.querySelectorAll(`input[name="volumen-${id}"]`);
  const ajustarVolumen = () => {
    const silencio = cuerpo.querySelector(`input[name="tipo-${id}"]:checked`)?.value === 'silencio';
    volumenes.forEach((r) => { r.disabled = silencio || Boolean(respuesta); if (silencio) r.checked = false; });
  };
  cuerpo.querySelectorAll(`input[name="tipo-${id}"]`).forEach((r) => r.addEventListener('change', ajustarVolumen));
  ajustarVolumen();
  if (respuesta) return;

  const boton = botonPrincipal(tarjeta, 'Comprobar en el simulador');
  boton.addEventListener('click', () => {
    const tipo = cuerpo.querySelector(`input[name="tipo-${id}"]:checked`)?.value;
    const volumen = cuerpo.querySelector(`input[name="volumen-${id}"]:checked`)?.value;
    const prediccion = cuerpo.querySelector(`input[name="prediccion-${id}"]:checked`)?.value;
    if (reglas.contarPalabras(hipotesis.value) < reglas.MINIMO_PALABRAS.hipotesis) return avisarCampo(hipotesis, 'Escribe tu hipótesis con al menos 6 palabras.');
    if (!tipo || (tipo !== 'silencio' && !volumen)) return ui.aviso('Configura el tipo de sonido y el volumen.', 'error');
    if (!prediccion) return ui.aviso('Indica tu predicción antes de comprobar.', 'error');
    responder(tarjeta, mision, item, { hipotesis: hipotesis.value, prediccion, config: { tipo, volumen } }, boton);
  });
}

function itemOpcion(cuerpo, mision, item, respuesta, tarjeta) {
  const claveProgreso = `neuroritmo.opcion.${partida?.id}.${item.id}`;
  const guardado = leerLocal(claveProgreso) || {};
  const opciones = respuesta ? item.opciones : util.barajar(item.opciones);
  const esCasoM2 = item.id === 'i3' && mision?.id === 'm2';
  const esPropuestaM2 = item.id === 'i4' && mision?.id === 'm2';
  const valorActual = respuesta?.valor || guardado || {};

  cuerpo.innerHTML = `
    <fieldset class="neuro-opciones">
      <legend>${esc(item.enunciado)}</legend>
      ${opciones.map((o) => `
        <label class="neuro-opcion neuro-opcion--bloque">
          <input type="radio" name="opcion-${item.id}" value="${esc(o.id)}"${valorActual.opcion === o.id ? ' checked' : ''}${respuesta ? ' disabled' : ''}>
          <span>${esc(o.texto)}</span>
        </label>`).join('')}
    </fieldset>
    ${esCasoM2 ? `
      <div class="campo neuro-campo-texto">
        <label for="justificacion-${item.id}">Justifica tu diagnóstico: ¿por qué esta opción explica lo ocurrido con Andrés y qué diferencia la pista de recuperación del orden frente a la comprensión conceptual?</label>
        <textarea id="justificacion-${item.id}" rows="3" placeholder="Explica tu diagnóstico con tus palabras..." maxlength="600"${respuesta ? ' disabled' : ''}>${esc(valorActual.justificacion || '')}</textarea>
        <p class="neuro-nota" data-contador-justificacion>${reglas.contarPalabras(valorActual.justificacion || '')} palabras (mínimo 6)</p>
      </div>` : ''}
    ${esPropuestaM2 ? `
      <div class="campo neuro-campo-texto">
        <label for="propuesta-${item.id}">Tu propuesta de uso pedagógico: explica cómo el ritmo o la canción breve actúa como pista de recuperación y cómo aseguras que no sustituya la comprensión de los conceptos:</label>
        <textarea id="propuesta-${item.id}" rows="3" placeholder="Describe tu propuesta y su justificación..." maxlength="600"${respuesta ? ' disabled' : ''}>${esc(valorActual.propuesta || valorActual.justificacion || '')}</textarea>
        <p class="neuro-nota" data-contador-propuesta>${reglas.contarPalabras(valorActual.propuesta || valorActual.justificacion || '')} palabras (mínimo 6)</p>
      </div>` : ''}`;

  const campoTexto = esCasoM2 ? cuerpo.querySelector(`#justificacion-${item.id}`) : esPropuestaM2 ? cuerpo.querySelector(`#propuesta-${item.id}`) : null;
  const contador = cuerpo.querySelector(esCasoM2 ? '[data-contador-justificacion]' : esPropuestaM2 ? '[data-contador-propuesta]' : null);

  if (campoTexto && contador) {
    const contar = () => {
      contador.textContent = `${reglas.contarPalabras(campoTexto.value)} palabras (mínimo 6)`;
    };
    campoTexto.addEventListener('input', () => {
      contar();
      const opcionSeleccionada = cuerpo.querySelector(`input[name="opcion-${item.id}"]:checked`)?.value;
      guardarLocal(claveProgreso, {
        opcion: opcionSeleccionada,
        ...(esCasoM2 ? { justificacion: campoTexto.value } : { propuesta: campoTexto.value })
      });
    });
  }

  cuerpo.querySelectorAll(`input[name="opcion-${item.id}"]`).forEach((r) => {
    r.addEventListener('change', () => {
      guardarLocal(claveProgreso, {
        opcion: r.value,
        ...(campoTexto ? (esCasoM2 ? { justificacion: campoTexto.value } : { propuesta: campoTexto.value }) : {})
      });
    });
  });

  if (respuesta) {
    guardarLocal(claveProgreso, null);
    return;
  }

  const boton = botonPrincipal(tarjeta, 'Responder');
  boton.addEventListener('click', () => {
    const opcion = cuerpo.querySelector(`input[name="opcion-${item.id}"]:checked`)?.value;
    if (!opcion) return ui.aviso('Elige una opción antes de responder.', 'error');

    if (esCasoM2) {
      const justificacion = campoTexto?.value?.trim() || '';
      if (reglas.contarPalabras(justificacion) < reglas.MINIMO_PALABRAS.hipotesis) {
        return avisarCampo(campoTexto, 'Escribe tu justificación del diagnóstico con al menos 6 palabras.');
      }
      responder(tarjeta, mision, item, { opcion, justificacion }, boton);
      return;
    }

    if (esPropuestaM2) {
      const propuesta = campoTexto?.value?.trim() || '';
      if (reglas.contarPalabras(propuesta) < reglas.MINIMO_PALABRAS.hipotesis) {
        return avisarCampo(campoTexto, 'Explica tu propuesta con al menos 6 palabras, indicando que el ritmo no sustituye la comprensión.');
      }
      responder(tarjeta, mision, item, { opcion, propuesta }, boton);
      return;
    }

    responder(tarjeta, mision, item, { opcion }, boton);
  });
}

// Ítem 1 de M2: tarjetas volteables (accesibles con teclado)
function itemParejas(cuerpo, mision, item, respuesta, tarjeta) {
  if (respuesta) {
    guardarLocal(`neuroritmo.parejas.${partida?.id}.${item.id}`, null);
    const confusiones = respuesta.valor?.confusiones || {};
    const resumenConfusiones = item.pares.filter((p) => confusiones[p.id]).map((p) => `${p.concepto}: ${confusiones[p.id]}`).join(' · ');
    cuerpo.innerHTML = `<ul class="neuro-parejas-resueltas">${item.pares.map((p) => `<li><strong>${esc(p.concepto)}:</strong> ${esc(p.definicion)}</li>`).join('')}</ul>
      <p class="neuro-nota">${resumenConfusiones ? `Confusiones registradas por concepto: ${esc(resumenConfusiones)}.` : 'Completaste las parejas sin confusiones registradas.'}</p>`;
    return;
  }
  const claveProgreso = `neuroritmo.parejas.${partida?.id}.${item.id}`;
  const idsValidos = new Set(item.pares.map((p) => p.id));
  const guardado = leerLocal(claveProgreso) || {};
  const cartas = util.barajar([
    ...item.pares.map((p) => ({ par: p.id, tipo: 'concepto', texto: p.concepto })),
    ...item.pares.map((p) => ({ par: p.id, tipo: 'definicion', texto: p.definicion }))
  ]);
  let errores = Number.isInteger(guardado.errores) && guardado.errores >= 0 ? guardado.errores : 0;
  let abiertas = [], bloqueado = false;
  const hechas = new Set(Array.isArray(guardado.hechas) ? guardado.hechas.filter((id) => idsValidos.has(id)) : []);
  const confusiones = Object.fromEntries(item.pares.map((p) => [p.id, Math.max(0, Number(guardado.confusiones?.[p.id]) || 0)]));
  cuerpo.innerHTML = `
    <p class="neuro-nota" id="parejas-estado" role="status"></p>
    <div class="neuro-parejas" role="group" aria-label="Tarjetas del juego de parejas">
      ${cartas.map((c, n) => `<button type="button" class="neuro-carta" data-n="${n}" aria-label="Tarjeta ${n + 1}, boca abajo"><span class="neuro-carta__reverso" aria-hidden="true">?</span><span class="neuro-carta__texto" hidden>${esc(c.texto)}</span></button>`).join('')}
    </div>
    <div class="neuro-parejas__explicaciones" aria-live="polite">
      <h3>Explicaciones de las parejas formadas</h3>
      <ul>${item.pares.filter((p) => hechas.has(p.id)).map((p) => `<li data-explicacion="${esc(p.id)}"><strong>${esc(p.concepto)}:</strong> ${esc(p.definicion)}</li>`).join('')}</ul>
    </div>`;
  const estado = cuerpo.querySelector('#parejas-estado');
  const botones = [...cuerpo.querySelectorAll('.neuro-carta')];
  const listaExplicaciones = cuerpo.querySelector('.neuro-parejas__explicaciones ul');
  const guardarProgreso = () => guardarLocal(claveProgreso, { hechas: [...hechas], errores, confusiones });
  const voltear = (b, visible) => {
    const c = cartas[b.dataset.n];
    b.classList.toggle('neuro-carta--abierta', visible);
    b.querySelector('.neuro-carta__texto').hidden = !visible;
    b.querySelector('.neuro-carta__reverso').hidden = visible;
    b.setAttribute('aria-label', visible ? `Tarjeta ${Number(b.dataset.n) + 1}: ${c.texto}` : `Tarjeta ${Number(b.dataset.n) + 1}, boca abajo`);
  };
  const actualizar = () => {
    const resumen = item.pares.filter((p) => confusiones[p.id] > 0).map((p) => `${p.concepto} (${confusiones[p.id]})`).join(', ');
    estado.textContent = `Parejas formadas: ${hechas.size} de ${item.pares.length} · Intentos fallidos: ${errores}${resumen ? ` · Confusiones: ${resumen}` : ''}`;
  };
  const mostrarRegistro = () => {
    if (hechas.size !== item.pares.length || tarjeta.querySelector('[data-registrar-parejas]')) return;
    const boton = botonPrincipal(tarjeta, 'Registrar parejas');
    boton.dataset.registrarParejas = 'true';
    boton.addEventListener('click', () => responder(tarjeta, mision, item, { pares: [...hechas], errores, confusiones }, boton));
  };
  botones.forEach((b) => {
    const c = cartas[b.dataset.n];
    if (!hechas.has(c.par)) return;
    voltear(b, true);
    b.classList.add('neuro-carta--hecha');
    b.disabled = true;
    b.setAttribute('aria-disabled', 'true');
  });
  actualizar();
  mostrarRegistro();
  botones.forEach((b) => b.addEventListener('click', () => {
    if (bloqueado || abiertas.includes(b) || b.classList.contains('neuro-carta--hecha')) return;
    voltear(b, true);
    abiertas.push(b);
    if (abiertas.length < 2) return;
    const [a, c] = abiertas.map((x) => cartas[x.dataset.n]);
    if (a.par === c.par && a.tipo !== c.tipo) {
      hechas.add(a.par);
      abiertas.forEach((x) => { x.classList.add('neuro-carta--hecha'); x.disabled = true; x.setAttribute('aria-disabled', 'true'); });
      const par = item.pares.find((p) => p.id === a.par);
      const explicacion = document.createElement('li');
      explicacion.dataset.explicacion = par.id;
      const concepto = document.createElement('strong');
      concepto.textContent = `${par.concepto}:`;
      explicacion.append(concepto, ` ${par.definicion}`);
      listaExplicaciones.append(explicacion);
      anunciar(`¡Pareja correcta! ${par.concepto}: ${par.definicion}`);
      abiertas = [];
      actualizar();
      guardarProgreso();
      mostrarRegistro();
      if (hechas.size === item.pares.length) tarjeta.querySelector('[data-registrar-parejas]')?.focus();
    } else {
      errores++;
      [...new Set([a.par, c.par])].forEach((idPar) => { confusiones[idPar] = (confusiones[idPar] || 0) + 1; });
      bloqueado = true;
      anunciar('No forman pareja. Observa bien las dos tarjetas.');
      actualizar();
      guardarProgreso();
      setTimeout(() => { abiertas.forEach((x) => voltear(x, false)); abiertas = []; bloqueado = false; }, 1400);
    }
  }));
}

// Ítem 2 de M2: canción con cuatro palabras faltantes (reproductor HTML5 con silencio inicial y transcripción legible)
function itemCancion(cuerpo, mision, item, respuesta, tarjeta) {
  const publicada = item.estado === 'publicado'
    && Boolean(item.audio)
    && Array.isArray(item.lineas)
    && Array.isArray(item.banco)
    && new Set(item.lineas.flatMap((linea) => [...String(linea).matchAll(/\{\{(\d)\}\}/g)].map((m) => m[1]))).size === 4;
  if (!publicada) {
    cuerpo.innerHTML = `
      <section class="alerta alerta--advertencia neuro-cancion-pendiente" role="status" aria-labelledby="cancion-pendiente-titulo">
        <h3 id="cancion-pendiente-titulo">${esc(item.estadoMensaje || 'Pendiente de integrar audio y letra autorizados')}</h3>
        <p>No existe en los recursos una canción verificable sobre las fases de la memoria. No se muestra una letra de ejemplo ni se simula reproducción.</p>
        <p>La actividad habilitará un reproductor HTML5 silenciado al inicio, transcripción legible, cuatro huecos y retroalimentación palabra a palabra cuando el equipo entregue el audio, la letra, la autoría y la licencia.</p>
      </section>`;
    tarjeta.querySelector('.neuro-item__acciones')?.replaceChildren();
    return;
  }
  const claveProgreso = `neuroritmo.cancion.${partida?.id}.${item.id}`;
  const guardado = leerLocal(claveProgreso) || {};
  const banco = item.banco;
  const elegido = respuesta?.valor?.palabras || guardado.palabras || {};

  // Transcripción legible estructurada con cuatro huecos
  const lineasHtml = item.lineas.map((linea) => esc(linea).replace(/\{\{(\d)\}\}/g, (_, n) => `
    <span class="neuro-hueco-contenedor">
      <label class="sr-only" for="hueco-${n}">Hueco ${n}: fase de la memoria</label>
      <select id="hueco-${n}" class="neuro-hueco" data-hueco="${n}" aria-label="Hueco ${n}: fase de la memoria"${respuesta ? ' disabled' : ''}>
        <option value="">— Hueco ${n} —</option>
        ${banco.map((p) => `<option value="${esc(p)}"${elegido[n] === p ? ' selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
    </span>`));

  cuerpo.innerHTML = `
    <div class="neuro-cancion-bloque">
      <!-- Reproductor HTML5 con silencio inicial -->
      <section class="neuro-reproductor tarjeta tarjeta--plana" aria-label="Reproductor HTML5 de la canción educativa">
        <div class="neuro-reproductor__cabecera">
          <span class="neuro-reproductor__icono" aria-hidden="true">🎵</span>
          <div>
            <h3 class="neuro-reproductor__titulo">Canción educativa: Fases de la memoria</h3>
            <p class="neuro-nota">Reproductor HTML5 con silencio inicial por defecto.</p>
          </div>
        </div>

        <div class="neuro-reproductor__audio-caja">
          <audio class="neuro-reproductor__audio" controls muted preload="metadata" aria-label="Reproductor de audio de la canción" src="${esc(item.audio)}">
            <p>Tu navegador no admite reproducción HTML5 de audio.</p>
          </audio>
        </div>

        <div class="neuro-reproductor__controles">
          <button type="button" class="btn btn--secundario btn--pequeno" data-cancion-accion="escuchar" title="Escuchar o reproducir canción">
            <span aria-hidden="true">▶</span> Escuchar canción
          </button>
          <button type="button" class="btn btn--secundario btn--pequeno" data-cancion-accion="repetir" title="Volver a escuchar desde el inicio">
            <span aria-hidden="true">🔁</span> Repetir
          </button>
        </div>
        <p class="neuro-nota">${esc(item.autoria)} · ${esc(item.licencia)}</p>
      </section>

      <!-- Transcripción legible de la canción -->
      <section class="neuro-transcripcion tarjeta tarjeta--plana" aria-label="Transcripción legible con cuatro huecos">
        <div class="neuro-transcripcion__cabecera">
          <h3 class="neuro-transcripcion__titulo">Transcripción legible de la canción</h3>
          <p class="neuro-nota">Completa las cuatro palabras faltantes correspondientes a cada fase de la memoria.</p>
        </div>
        <div class="neuro-cancion" role="region" aria-label="Letra de la canción">
          ${lineasHtml.map((l) => `<p class="neuro-cancion__linea">${l}</p>`).join('')}
        </div>
      </section>

      <div class="neuro-cancion-resultado-zona" aria-live="polite"></div>
    </div>`;

  const audioEl = cuerpo.querySelector('.neuro-reproductor__audio');
  if (audioEl) {
    audioEl.muted = true;
    audioEl.volume = 0;
  }

  const btnEscuchar = cuerpo.querySelector('[data-cancion-accion="escuchar"]');
  const btnRepetir = cuerpo.querySelector('[data-cancion-accion="repetir"]');

  btnEscuchar.addEventListener('click', () => {
    audioEl.muted = false;
    audioEl.volume = 0.8;
    audioEl.play().catch(() => ui.aviso('No fue posible reproducir el audio autorizado.', 'error'));
    anunciar('Reproduciendo canción educativa.');
  });

  btnRepetir.addEventListener('click', () => {
    audioEl.currentTime = 0;
    audioEl.muted = false;
    audioEl.volume = 0.8;
    audioEl.play().catch(() => ui.aviso('No fue posible reproducir el audio autorizado.', 'error'));
    anunciar('Repitiendo la canción desde el inicio.');
  });

  // Guardar estado parcial en almacenamiento local mientras el estudiante completa
  if (!respuesta) {
    cuerpo.querySelectorAll('[data-hueco]').forEach((s) => {
      s.addEventListener('change', () => {
        const palabras = Object.fromEntries([...cuerpo.querySelectorAll('[data-hueco]')].map((el) => [el.dataset.hueco, el.value]));
        guardarLocal(claveProgreso, { palabras });
      });
    });
  }

  // Si ya hay respuesta (o al validar): mostrar marcas palabra a palabra y desglose explicativo
  if (respuesta) {
    guardarLocal(claveProgreso, null);
    const retro = respuesta.retro || {};
    const porPalabra = retro.porPalabra || {};
    const claves = ['1', '2', '3', '4'];
    let aciertos = 0;

    cuerpo.querySelectorAll('[data-hueco]').forEach((s) => {
      const n = s.dataset.hueco;
      const ok = Boolean(porPalabra[n]);
      if (ok) aciertos++;
      s.classList.add(ok ? 'neuro-hueco--bien' : 'neuro-hueco--mal');
      s.insertAdjacentHTML('afterend', `
        <span class="neuro-hueco__marca ${ok ? 'neuro-hueco__marca--ok' : 'neuro-hueco__marca--error'}">
          ${ok ? '✔' : '✖'}<span class="sr-only">${ok ? ' palabra correcta' : ' palabra por revisar'}</span>
        </span>`);
    });

    const correctas = typeof retro.correctas === 'number' ? retro.correctas : aciertos;
    const errores = typeof retro.errores === 'number' ? retro.errores : (claves.length - correctas);

    const zonaResultado = cuerpo.querySelector('.neuro-cancion-resultado-zona');
    zonaResultado.innerHTML = `
      <section class="tarjeta tarjeta--plana neuro-cancion-resultado" aria-label="Resultado palabra a palabra de la canción">
        <h4 class="neuro-cancion-resultado__titulo">Registro y retroalimentación palabra a palabra</h4>
        <div class="neuro-cancion-conteo" role="status">
          <span class="insignia insignia--verde">✔ ${correctas} de ${claves.length} correctas</span>
          <span class="insignia insignia--${errores > 0 ? 'coral' : 'verde'}">${errores === 0 ? '0 errores' : `${errores} ${errores === 1 ? 'error' : 'errores'}`}</span>
        </div>
        <ul class="neuro-cancion-desglose" aria-label="Detalle por palabra">
          ${claves.map((k) => {
            const ok = Boolean(porPalabra[k]);
            const palabraElegida = elegido[k] || 'Sin selección';
            const detalle = retro.detallePalabras?.[k];
            return `
              <li class="neuro-cancion-desglose__item neuro-cancion-desglose__item--${ok ? 'ok' : 'error'}">
                <span class="neuro-cancion-desglose__icono" aria-hidden="true">${ok ? '✔' : '✖'}</span>
                <div class="neuro-cancion-desglose__contenido">
                  <p class="neuro-cancion-desglose__linea"><strong>Hueco ${k}:</strong> elegiste «${esc(palabraElegida)}». ${esc(detalle?.mensaje || (ok ? 'Palabra correcta.' : 'Palabra por revisar.'))}</p>
                </div>
              </li>`;
          }).join('')}
        </ul>
        <div class="neuro-cancion-pista-recuperacion">
          <h5 class="neuro-cancion-pista-recuperacion__titulo">🎵 La melodía como pista de recuperación</h5>
          <p>La melodía puede actuar como <strong>pista de recuperación</strong> para recordar el orden trabajado en la canción; este apoyo no sustituye la comprensión de cada concepto.</p>
        </div>
      </section>`;

    return;
  }

  const boton = botonPrincipal(tarjeta, 'Comprobar palabras');
  boton.addEventListener('click', () => {
    const selects = [...cuerpo.querySelectorAll('[data-hueco]')];
    const palabras = Object.fromEntries(selects.map((s) => [s.dataset.hueco, s.value.trim()]));
    const incompleto = selects.find((s) => !s.value.trim());
    if (incompleto) {
      ui.aviso('Completa las cuatro palabras de la canción antes de validar.', 'error');
      incompleto.focus();
      return;
    }
    responder(tarjeta, mision, item, { palabras }, boton);
  });
}

function botonPrincipal(tarjeta, texto) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn btn--primario';
  boton.textContent = texto;
  tarjeta.querySelector('.neuro-item__acciones').replaceChildren(boton);
  return boton;
}

function avisarCampo(campo, mensaje) {
  ui.aviso(mensaje, 'error');
  campo.focus();
}

// ---------- Pistas y «Pregúntale a Neuri» ----------

const ASPECTOS_BORRADOR = { objetivo: 'Objetivo', viabilidad: 'Viabilidad', diversidad: 'Diversidad individual', comprobacion: 'Comprobación del aprendizaje' };

function panelAyuda(mision, item, respuesta) {
  const caja = document.createElement('div');
  caja.className = 'neuro-ayuda';
  // Uso progresivo de la IA por misión (configuración): M1 desde el 2.º intento, M2 pistas y ejemplos, M3 borrador
  const politica = experiencia().ia?.misiones?.[mision.id] || { desdeIntento: 1, modos: [] };
  const niveles = experiencia().ia?.niveles || [];
  const iaBloqueada = Number(partida?.numero || 1) < Number(politica.desdeIntento || 1);
  const completo = respuesta?.retro?.nivel === 'completo';
  const bloqueo = iaBloqueada ? ' disabled aria-describedby="nota-ia"' : '';
  const ICONOS_NIVEL = { 1: '❓', 2: '🧠', 3: '🔁' };
  caja.innerHTML = `
    <div class="neuro-acciones">
      <button type="button" class="btn btn--secundario btn--pequeno" data-pista>💡 Necesito una pista</button>
      ${mision.id === 'm3' ? `<button type="button" class="btn btn--secundario btn--pequeno" data-ia="borrador"${bloqueo}>🤖 Revisa mi borrador</button>` : ''}
    </div>
    ${politica.modos.includes('pista') ? `
      <div class="neuro-acciones" role="group" aria-label="Pregúntale a Neuri (IA): elige el tipo de ayuda">
        ${niveles.map((n) => `<button type="button" class="btn btn--secundario btn--pequeno" data-ia="pista" data-nivel="${n.nivel}"${bloqueo}>${ICONOS_NIVEL[n.nivel] || '🤖'} Neuri: ${esc(n.nombre.toLowerCase())}</button>`).join('')}
        ${respuesta && !completo && politica.modos.includes('error') ? `<button type="button" class="btn btn--secundario btn--pequeno" data-ia="error"${bloqueo}>🤖 Explícame el error</button>` : ''}
      </div>` : ''}
    ${iaBloqueada ? `<p id="nota-ia" class="neuro-nota">En tu primer intento de la Misión ${mision.numero}, Neuri te orienta con las pistas del docente; la IA se habilita desde tu intento ${politica.desdeIntento}.</p>` : ''}
    <div class="neuro-ayuda__salida" aria-live="polite"></div>`;
  const salida = caja.querySelector('.neuro-ayuda__salida');
  const botonPista = caja.querySelector('[data-pista]');
  const usadas = () => Number(partida.pistas?.[item.id]) || 0;
  const pintarBotonPista = () => {
    botonPista.disabled = usadas() >= 3;
    botonPista.textContent = usadas() >= 3 ? '💡 Ya viste las tres pistas' : `💡 Necesito una pista (${usadas() + 1} de 3)`;
  };
  pintarBotonPista();

  async function pedirPista(prefijo = '') {
    if (usadas() >= 3) {
      salida.insertAdjacentHTML('beforeend', `<p class="neuro-nota">${esc(prefijo)} Ya usaste las tres pistas del docente: revisa el recurso del ítem.</p>`);
      return;
    }
    try {
      const r = await api.llamar('POST', `/api/neuroritmo/${mision.id}/pista`, { item: item.id, nivel: usadas() + 1 });
      partida.pistas = { ...partida.pistas, [item.id]: r.nivel };
      salida.insertAdjacentHTML('beforeend', `<div class="neuro-pista">${prefijo ? `<p class="neuro-nota">${esc(prefijo)}</p>` : ''}<p><strong>${esc(r.tipo)}:</strong> ${esc(r.pista)}</p></div>`);
      pintarBotonPista();
      decir(r.pista);
    } catch (err) {
      ui.aviso(err.message, 'error');
    }
  }
  botonPista.addEventListener('click', () => pedirPista());

  // Misión 3 · «Revisa mi borrador»: una fortaleza y dos mejoras; sin IA, pistas docentes predefinidas
  if (mision.id === 'm3') {
    const boton = caja.querySelector('[data-ia]');
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      cambiarEstado('pensando');
      salida.insertAdjacentHTML('beforeend', '<p class="neuro-nota" data-pensando>Neuri está revisando tu borrador…</p>');
      try {
        const r = await api.ia('neuri-borrador', { borrador: leerFormularioDiseno() });
        const parte = (p) => `<li><strong>${esc(ASPECTOS_BORRADOR[p.aspecto] || p.aspecto)}:</strong> ${esc(p.texto)}</li>`;
        salida.insertAdjacentHTML('beforeend', `
          <div class="neuro-pista neuro-pista--ia" data-origen="ia">
            <p><strong>🤖 Revisión de Neuri (IA generativa)</strong></p>
            <p>Fortaleza</p><ul>${parte(r.fortaleza)}</ul>
            <p>Aspectos de mejora</p><ul>${r.mejoras.map(parte).join('')}</ul>
            <p class="neuro-nota">Neuri es una IA: no reescribe tu trabajo ni asigna puntos. Contrasta su orientación con el material del curso; la valoración es de tu docente.</p>
          </div>`);
        decir(`Fortaleza: ${r.fortaleza.texto}`);
      } catch (err) {
        if (err.estado === 400 || err.estado === 409) {
          ui.aviso(err.message, 'error');
        } else {
          const motivo = err.estado === 429 ? 'Alcanzaste el límite diario de consultas a la IA.' : 'El servicio de IA no está disponible en este momento.';
          await pedirPista(`${motivo} Se usan pistas docentes predefinidas (no generadas por IA):`);
          salida.lastElementChild?.setAttribute('data-origen', 'docente');
        }
      } finally {
        salida.querySelector('[data-pensando]')?.remove();
        cambiarEstado('reposo');
        boton.disabled = false;
      }
    });
    return caja;
  }
  caja.querySelectorAll('[data-ia]').forEach((boton) => boton.addEventListener('click', async () => {
    const modo = boton.dataset.ia;
    const nivel = Number(boton.dataset.nivel) || null;
    const tipo = modo === 'error' ? 'Explicación del error' : niveles.find((n) => n.nivel === nivel)?.nombre || 'Ayuda';
    const cuerpo = { mision: mision.id, item: item.id, modo, ...(modo === 'pista' ? { nivel } : {}) };
    boton.disabled = true;
    cambiarEstado('pensando');
    salida.insertAdjacentHTML('beforeend', '<p class="neuro-nota" data-pensando>Neuri está pensando…</p>');
    try {
      const { respuesta: texto } = await api.ia('neuri', cuerpo);
      salida.insertAdjacentHTML('beforeend', `
        <div class="neuro-pista neuro-pista--ia" data-origen="ia">
          <p><strong>🤖 Neuri (IA generativa) · ${esc(tipo)}:</strong> ${util.formatoBasico(texto)}</p>
          <p class="neuro-nota">Neuri es una IA: orienta sin darte la respuesta ni calificar. Contrasta su orientación con el material del curso.</p>
        </div>`);
      decir(texto);
    } catch (err) {
      if (err.estado === 400 || err.estado === 409) {
        ui.aviso(err.message, 'error');
      } else {
        // Sin IA (regla de uso, límite diario o servicio caído): pistas predefinidas del docente, rotuladas
        const motivo = err.estado === 403 ? err.message
          : err.estado === 429 ? 'Alcanzaste el límite diario de consultas a la IA.'
            : 'El servicio de IA no está disponible en este momento.';
        await pedirPista(`${motivo} Se usan pistas docentes predefinidas (no generadas por IA):`);
        salida.lastElementChild?.setAttribute('data-origen', 'docente');
      }
    } finally {
      salida.querySelector('[data-pensando]')?.remove();
      cambiarEstado('reposo');
      boton.disabled = false;
    }
  }));
  return caja;
}

// ---------- Justificación (M1 y M2) ----------

function tarjetaJustificacion(mision) {
  const j = mision.justificacion;
  const tarjeta = document.createElement('section');
  tarjeta.className = 'tarjeta neuro-item';
  tarjeta.setAttribute('aria-labelledby', 'titulo-justificacion');
  const tarjetas = util.barajar(j.tarjetas);
  tarjeta.innerHTML = `
    <h2 id="titulo-justificacion" class="tarjeta__titulo">Justificación (40 puntos)</h2>
    <p class="neuro-situacion">${esc(j.consigna)}</p>
    <fieldset class="neuro-opciones">
      <legend>Tarjetas de argumento (elige exactamente dos)</legend>
      ${tarjetas.map((t) => `<label class="neuro-opcion neuro-opcion--bloque neuro-argumento"><input type="checkbox" value="${esc(t.id)}"> ${esc(t.texto)}</label>`).join('')}
    </fieldset>
    <div class="campo">
      <label for="justificacion-texto">Tu explicación con tus palabras</label>
      <textarea id="justificacion-texto" rows="5" maxlength="2000" aria-describedby="ayuda-justificacion"></textarea>
      <p id="ayuda-justificacion" class="neuro-nota">${j.criterios?.length
        ? `Mínimo 10 palabras. Tu explicación suma hasta 10 puntos: ${j.criterios.map((c) => `${esc(c.texto.toLowerCase())} (${c.maximo})`).join(', ')}.`
        : 'Considera la demanda de la tarea, las diferencias individuales y cómo comprobarías el efecto. Mínimo: 10 palabras; 20 para el puntaje completo.'} <span data-contador>0 palabras</span></p>
    </div>
    <div class="neuro-acciones"><button type="button" class="btn btn--primario" data-enviar>Responder y cerrar la misión</button></div>`;
  const casillas = [...tarjeta.querySelectorAll('input[type="checkbox"]')];
  casillas.forEach((c) => c.addEventListener('change', () => {
    const marcadas = casillas.filter((x) => x.checked).length;
    casillas.forEach((x) => { x.disabled = !x.checked && marcadas >= 2; });
  }));
  const area = tarjeta.querySelector('textarea');
  const contador = tarjeta.querySelector('[data-contador]');
  area.addEventListener('input', () => { contador.textContent = `${reglas.contarPalabras(area.value)} palabras`; });
  const boton = tarjeta.querySelector('[data-enviar]');
  boton.addEventListener('click', async () => {
    const elegidas = casillas.filter((c) => c.checked).map((c) => c.value);
    if (elegidas.length !== 2) return ui.aviso('Elige exactamente dos tarjetas de argumento.', 'error');
    if (reglas.contarPalabras(area.value) < 10) return avisarCampo(area, 'Redacta tu explicación con al menos 10 palabras.');
    boton.disabled = true;
    try {
      const r = await api.llamar('POST', `/api/neuroritmo/${mision.id}/finalizar`, { tarjetas: elegidas, texto: area.value });
      await cerrarMision(mision, r);
    } catch (err) {
      boton.disabled = false;
      ui.aviso(err.message, 'error');
    }
  });
  return tarjeta;
}

async function cerrarMision(mision, resultado) {
  guardarSesion(CLAVE_CIERRE, { mision: mision.id, ...resultado });
  partida = null;
  await cargarDatos();
  ir('retroalimentacion');
  if (resultado.gamificacion) await mostrarLogros(resultado.gamificacion);
}

// ---------- Misión 3: diseñador de microactividad ----------

function leerFormularioDiseno() {
  const f = document.getElementById('form-diseno');
  if (!f) return {};
  const valor = (n) => f.elements[n]?.value || '';
  return {
    objetivo: valor('objetivo'),
    recurso: { tipo: valor('tipo'), letra: valor('letra'), volumen: valor('volumen'), duracion: Number(valor('duracion')) || 0 },
    secuencia: [...f.querySelectorAll('#secuencia-elegida [data-bloque]')].map((li) => li.dataset.bloque),
    instrucciones: valor('instrucciones'), comprobacion: valor('comprobacion'), indicador: valor('indicador'),
    justificacion: valor('justificacion'), diferencias: valor('diferencias')
  };
}

// Etapas de una entrega de la Misión 3
const ETAPAS = {
  enviado: '📨 Enviada', 'en-revision': '🔎 En revisión', devuelto: '✍️ Devuelta para mejora', aprobado: '✔ Aprobada'
};

// Versiones enviadas por el estudiante, con la valoración y el comentario docente de cada una
function historialVersiones(entregas, mision) {
  if (!entregas.length) return '';
  return `
    <section class="tarjeta" aria-labelledby="titulo-versiones">
      <h2 id="titulo-versiones" class="tarjeta__titulo">Tus versiones enviadas</h2>
      ${[...entregas].reverse().map((e) => `
        <details class="neuro-version">
          <summary>Versión ${e.version} · ${ETAPAS[e.etapa]} · ${esc(util.fechaLarga(e.fecha))}${e.puntaje !== null ? ` · ${e.puntaje}/100` : ''}</summary>
          ${e.comentario ? `<div class="neuro-pista"><p><strong>Comentario docente:</strong></p>${util.formatoBasico(e.comentario)}</div>` : ''}
          ${resumenDiseno(e.diseno, mision.bloques, mision.recursosSonoros)}
        </details>`).join('')}
    </section>`;
}

async function vistaDiseno(mision) {
  // El borrador vive en el servidor; se descarta el antiguo del navegador (podía ser de otra cuenta)
  guardarLocal(CLAVE_BORRADOR, null);
  const { borrador: guardado, entregas } = await api.llamar('GET', '/api/neuroritmo/m3/borrador');
  const ultima = entregas.at(-1);
  const devuelta = ultima?.estado === 'devuelta' ? ultima : null;
  const borrador = guardado?.diseno || {};
  const basadoEn = guardado?.basadoEn || null;
  const r = borrador.recurso || {};
  const area = (nombre, etiqueta, ayuda, filas = 3, max = 600) => `
    <div class="campo">
      <label for="d-${nombre}">${etiqueta}</label>
      <textarea id="d-${nombre}" name="${nombre}" rows="${filas}" maxlength="${max}" required${ayuda ? ` aria-describedby="a-${nombre}"` : ''}>${esc(borrador[nombre] || '')}</textarea>
      ${ayuda ? `<p id="a-${nombre}" class="neuro-nota">${ayuda}</p>` : ''}
    </div>`;
  const cancionPrincipal = experiencia().cancionPrincipal;
  vista.innerHTML = `
    ${encabezadoMision(mision, 0, 0)}
    <section class="tarjeta neuro-narrativa">
      <p>${esc(mision.narrativa)}</p>
      <p><strong>Caso:</strong> ${esc(mision.caso)}</p>
      <p><strong>Instrucciones:</strong> ${esc(mision.instrucciones)}</p>
      ${cancionPrincipal ? `<p><strong>Recurso musical principal:</strong> se utiliza únicamente la canción principal registrada.</p>${reproductorCancionPrincipal(cancionPrincipal)}` : ''}
    </section>
    ${devuelta ? `<section class="alerta alerta--advertencia" role="status"><strong>Tu docente devolvió la versión ${devuelta.version} con sugerencias (${devuelta.puntaje}/100):</strong> ${util.formatoBasico(devuelta.comentario)}<p>Esa versión y el comentario se conservan; lo que edites aquí será una versión nueva.</p></section>` : ''}
    ${historialVersiones(entregas, mision)}
    <form id="form-diseno" class="neuro-diseno" novalidate>
      <nav class="tarjeta neuro-diseno__navegacion" aria-label="Bloques del diseñador">
        <button type="button" class="btn btn--texto" data-ir-bloque="diseno-bloque-1">1. Objetivo</button><button type="button" class="btn btn--texto" data-ir-bloque="diseno-bloque-2">2. Recurso</button><button type="button" class="btn btn--texto" data-ir-bloque="diseno-bloque-3">3. Secuencia</button><button type="button" class="btn btn--texto" data-ir-bloque="diseno-bloque-4">4. Comprobación</button><button type="button" class="btn btn--texto" data-ir-bloque="diseno-justificacion">Justificación</button>
      </nav>
      <fieldset id="diseno-bloque-1" class="tarjeta neuro-bloque">
        <legend class="tarjeta__titulo">Bloque 1 · Objetivo</legend>
        ${area('objetivo', 'Objetivo observable de la microactividad', 'Usa un verbo observable (explicar, aplicar, relacionar…). Mínimo 8 palabras.', 2)}
      </fieldset>
      <fieldset id="diseno-bloque-2" class="tarjeta neuro-bloque">
        <legend class="tarjeta__titulo">Bloque 2 · Recurso sonoro o silencio</legend>
        <div class="neuro-campos">
          <div class="campo"><label for="d-tipo">Recurso</label>
            <select id="d-tipo" name="tipo" required><option value="">Elige…</option>${mision.recursosSonoros.map((s) => `<option value="${esc(s.id)}"${r.tipo === s.id ? ' selected' : ''}>${esc(s.texto)}</option>`).join('')}</select></div>
          <div class="campo"><label for="d-letra">¿Tiene letra?</label>
            <select id="d-letra" name="letra" required><option value="no"${r.letra !== 'si' ? ' selected' : ''}>No</option><option value="si"${r.letra === 'si' ? ' selected' : ''}>Sí</option></select></div>
          <div class="campo"><label for="d-volumen">Volumen</label>
            <select id="d-volumen" name="volumen" required><option value="">Elige…</option>${['bajo', 'medio', 'alto'].map((v) => `<option value="${v}"${r.volumen === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="campo"><label for="d-duracion">Duración (min)</label>
            <input id="d-duracion" name="duracion" type="number" min="1" max="10" step="1" required value="${Number(r.duracion) || 1}"></div>
        </div>
      </fieldset>
      <fieldset id="diseno-bloque-3" class="tarjeta neuro-bloque">
        <legend class="tarjeta__titulo">Bloque 3 · Instrucciones y secuencia temporal</legend>
        <p class="neuro-nota">Agrega entre 4 y 6 bloques y ordénalos con «Subir» y «Bajar». <strong id="minutos-total" aria-live="polite"></strong></p>
        <div class="neuro-secuencia">
          <div><h3 class="neuro-subtitulo">Bloques disponibles</h3><ul id="secuencia-disponible" class="neuro-lista-bloques"></ul></div>
          <div><h3 class="neuro-subtitulo">Tu secuencia</h3><ol id="secuencia-elegida" class="neuro-lista-bloques"></ol></div>
        </div>
        ${area('instrucciones', 'Instrucciones para el grupo', '', 3, 1200)}
      </fieldset>
      <fieldset id="diseno-bloque-4" class="tarjeta neuro-bloque">
        <legend class="tarjeta__titulo">Bloque 4 · Comprobación y autorregulación</legend>
        ${area('comprobacion', 'Cómo comprobarás el aprendizaje', 'Por ejemplo, una tarjeta de salida donde explican cada concepto. Mínimo 8 palabras.', 2)}
        ${area('indicador', 'Indicador de autorregulación', 'Por ejemplo: «cada estudiante valora su concentración de 1 a 5 al terminar».', 2, 300)}
      </fieldset>
      <fieldset id="diseno-justificacion" class="tarjeta neuro-bloque">
        <legend class="tarjeta__titulo">Justificación pedagógica (40 puntos)</legend>
        ${area('justificacion', 'Cómo relaciona tu microactividad atención, recuperación y emoción o autorregulación', 'Menciona y relaciona los tres fundamentos. Mínimo 40 palabras.', 5, 2000)}
        ${area('diferencias', 'Precauciones ante las diferencias individuales', 'Por ejemplo, opción de silencio para quien lo prefiera. Mínimo 15 palabras.', 3, 1000)}
      </fieldset>
      <section class="tarjeta" aria-labelledby="titulo-cotejo">
        <h2 id="titulo-cotejo" class="tarjeta__titulo">Lista de cotejo</h2>
        <ul id="lista-cotejo" class="neuro-cotejo"></ul>
      </section>
      <section class="tarjeta neuro-item" id="ayuda-diseno"><div class="neuro-item__acciones"></div></section>
      <p id="estado-borrador" class="neuro-nota" role="status" aria-live="polite">${guardado?.fecha
        ? `✔ Borrador guardado en el servidor · ${esc(util.fechaRelativa(guardado.fecha))}`
        : devuelta ? 'Partes de tu versión devuelta. Tus cambios se guardan automáticamente en el servidor.' : 'Tu borrador se guarda automáticamente en el servidor mientras escribes.'}</p>
      <div class="neuro-acciones">
        <button type="submit" class="btn btn--primario">Enviar al docente</button>
        <button type="button" class="btn btn--secundario" data-guardar>Guardar borrador</button>
        <button type="button" class="btn btn--texto" data-limpiar>Borrar borrador</button>
      </div>
    </form>`;

  const form = document.getElementById('form-diseno');
  const disponible = document.getElementById('secuencia-disponible');
  const elegida = document.getElementById('secuencia-elegida');
  form.querySelectorAll('[data-ir-bloque]').forEach((boton) => boton.addEventListener('click', () => {
    const destino = document.getElementById(boton.dataset.irBloque);
    destino?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    destino?.querySelector('textarea, select, input, button')?.focus({ preventScroll: true });
  }));
  let secuencia = Array.isArray(borrador.secuencia) ? borrador.secuencia.filter((id) => mision.bloques.some((b) => b.id === id)) : [];
  const bloque = (id) => mision.bloques.find((b) => b.id === id);

  function pintarSecuencia(enfocar = null) {
    disponible.innerHTML = mision.bloques.filter((b) => !secuencia.includes(b.id)).map((b) => `
      <li class="neuro-bloque-item"><span>${esc(b.texto)} <small>(${b.minutos} min)</small></span>
        <button type="button" class="btn btn--pequeno btn--secundario" data-agregar="${b.id}" aria-label="Agregar «${esc(b.texto)}»">Agregar</button></li>`).join('') || '<li class="neuro-nota">No quedan bloques.</li>';
    elegida.innerHTML = secuencia.map((id, n) => `
      <li class="neuro-bloque-item" data-bloque="${id}"><span>${esc(bloque(id).texto)} <small>(${bloque(id).minutos} min)</small></span>
        <span class="neuro-bloque-item__botones">
          <button type="button" class="btn btn--pequeno btn--texto" data-subir="${id}" aria-label="Subir «${esc(bloque(id).texto)}»"${n === 0 ? ' disabled' : ''}>↑ Subir</button>
          <button type="button" class="btn btn--pequeno btn--texto" data-bajar="${id}" aria-label="Bajar «${esc(bloque(id).texto)}»"${n === secuencia.length - 1 ? ' disabled' : ''}>↓ Bajar</button>
          <button type="button" class="btn btn--pequeno btn--texto" data-quitar="${id}" aria-label="Quitar «${esc(bloque(id).texto)}»">Quitar</button>
        </span></li>`).join('') || '<li class="neuro-nota">Aún no agregas bloques.</li>';
    document.getElementById('minutos-total').textContent = `Duración: ${reglas.minutosSecuencia(secuencia, mision.bloques)} min`;
    if (enfocar) vista.querySelector(enfocar)?.focus();
    actualizarCotejo();
  }

  form.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const mover = (id, delta) => {
      const i = secuencia.indexOf(id);
      const j = i + delta;
      if (j < 0 || j >= secuencia.length) return;
      [secuencia[i], secuencia[j]] = [secuencia[j], secuencia[i]];
    };
    if (b.dataset.agregar) { secuencia.push(b.dataset.agregar); pintarSecuencia(`[data-quitar="${b.dataset.agregar}"]`); }
    else if (b.dataset.quitar) { secuencia = secuencia.filter((x) => x !== b.dataset.quitar); pintarSecuencia(`[data-agregar="${b.dataset.quitar}"]`); }
    else if (b.dataset.subir) { mover(b.dataset.subir, -1); pintarSecuencia(`[data-subir="${b.dataset.subir}"]:not([disabled]), [data-bajar="${b.dataset.subir}"]`); }
    else if (b.dataset.bajar) { mover(b.dataset.bajar, 1); pintarSecuencia(`[data-bajar="${b.dataset.bajar}"]:not([disabled]), [data-subir="${b.dataset.bajar}"]`); }
  });

  const ajustarRecurso = () => {
    const silencio = form.elements.tipo.value === 'silencio';
    const principal = form.elements.tipo.value === 'cancion-principal';
    if (principal) form.elements.letra.value = 'si';
    form.elements.letra.disabled = silencio || principal;
    ['volumen', 'duracion'].forEach((n) => { form.elements[n].disabled = silencio; });
  };
  // Guardado en el servidor: automático 1,2 s después del último cambio, al ocultar la página o con el botón
  const estadoBorrador = document.getElementById('estado-borrador');
  let temporizador = null;
  let listo = false;
  let cambios = false;
  function programarGuardado() {
    if (!listo) return;
    cambios = true;
    clearTimeout(temporizador);
    estadoBorrador.textContent = 'Cambios sin guardar…';
    temporizador = setTimeout(guardarBorrador, 1200);
  }
  async function guardarBorrador() {
    clearTimeout(temporizador);
    cambios = false;
    try {
      const g = await api.llamar('PUT', '/api/neuroritmo/m3/borrador', { diseno: leerFormularioDiseno(), basadoEn });
      estadoBorrador.textContent = `✔ Borrador guardado en el servidor · ${util.fechaRelativa(g.fecha)}`;
      return true;
    } catch (err) {
      cambios = true;
      estadoBorrador.textContent = `⚠ No se pudo guardar el borrador: ${err.message}`;
      return false;
    }
  }
  const alOcultar = () => { if (cambios && document.visibilityState === 'hidden' && document.body.contains(form)) guardarBorrador(); };
  document.addEventListener('visibilitychange', alOcultar);

  function actualizarCotejo() {
    const borradorActual = leerFormularioDiseno();
    programarGuardado();
    document.getElementById('lista-cotejo').innerHTML = reglas.revisarDiseno(borradorActual, mision.bloques)
      .map((c) => `<li class="neuro-cotejo__item${c.cumple ? ' neuro-cotejo__item--ok' : ''}"><span aria-hidden="true">${c.cumple ? '✔' : '○'}</span> ${esc(c.texto)}<span class="sr-only">${c.cumple ? ': cumple' : ': pendiente'}</span></li>`).join('');
  }
  form.addEventListener('input', actualizarCotejo);
  form.elements.tipo.addEventListener('change', ajustarRecurso);
  ajustarRecurso();
  pintarSecuencia();
  listo = true;

  // Ayuda: pistas del docente y «Revisa mi borrador» con Neuri
  const ayuda = document.getElementById('ayuda-diseno');
  ayuda.prepend(Object.assign(document.createElement('h2'), { className: 'tarjeta__titulo', textContent: 'Ayuda de Neuri' }));
  const panel = panelAyuda(mision, { id: 'diseno' }, null);
  const botonIa = panel.querySelector('[data-ia]');
  botonIa.textContent = '🤖 Revisa mi borrador';
  ayuda.append(panel);

  form.querySelector('[data-guardar]').addEventListener('click', async () => {
    if (await guardarBorrador()) ui.aviso('Borrador guardado.', 'exito');
  });
  form.querySelector('[data-limpiar]').addEventListener('click', async () => {
    if (!(await ui.confirmar('¿Borrar tu borrador guardado? Las versiones enviadas no se modifican.'))) return;
    clearTimeout(temporizador);
    try {
      await api.llamar('DELETE', '/api/neuroritmo/m3/borrador');
      document.removeEventListener('visibilitychange', alOcultar);
      await vistaDiseno(mision);
    } catch (err) {
      ui.aviso(err.message, 'error');
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const diseno = leerFormularioDiseno();
    const pendientes = reglas.revisarDiseno(diseno, mision.bloques).filter((c) => !c.cumple);
    if (pendientes.length) {
      ui.aviso(`Completa la lista de cotejo antes de enviar: ${pendientes.map((p) => p.texto).join('; ')}.`, 'error');
      document.getElementById('lista-cotejo')?.focus();
      return;
    }
    if (!(await ui.confirmar('¿Confirmas el envío de tu microactividad? Mientras tu docente la revisa no podrás modificarla.'))) return;
    const enviar = form.querySelector('button[type="submit"]');
    enviar.disabled = true;
    clearTimeout(temporizador);
    try {
      const r = await api.llamar('POST', '/api/neuroritmo/m3/finalizar', diseno);
      cambios = false;
      document.removeEventListener('visibilitychange', alOcultar);
      await cerrarMision(mision, r);
    } catch (err) {
      enviar.disabled = false;
      ui.aviso(err.message, 'error');
    }
  });
  decir('Misión 3: diseña tu microactividad en cuatro bloques. Puedo revisar tu borrador antes de que lo envíes.');
}

function resumenDiseno(diseno, bloques, recursos) {
  if (!diseno) return '';
  const recurso = recursos.find((s) => s.id === diseno.recurso?.tipo)?.texto || '—';
  return `
    <dl class="neuro-resumen-diseno">
      <dt>Objetivo</dt><dd>${util.formatoBasico(diseno.objetivo)}</dd>
      <dt>Recurso sonoro</dt><dd>${esc(recurso)}${diseno.recurso?.tipo !== 'silencio' ? ` · letra: ${esc(diseno.recurso?.letra || '—')} · volumen: ${esc(diseno.recurso?.volumen || '—')} · ${Number(diseno.recurso?.duracion) || 0} min` : ''}</dd>
      <dt>Secuencia (${reglas.minutosSecuencia(diseno.secuencia, bloques)} min)</dt><dd>${(diseno.secuencia || []).map((id) => esc(bloques.find((b) => b.id === id)?.texto || id)).join(' → ')}</dd>
      <dt>Instrucciones</dt><dd>${util.formatoBasico(diseno.instrucciones)}</dd>
      <dt>Comprobación</dt><dd>${util.formatoBasico(diseno.comprobacion)}</dd>
      <dt>Indicador de autorregulación</dt><dd>${util.formatoBasico(diseno.indicador)}</dd>
      <dt>Justificación</dt><dd>${util.formatoBasico(diseno.justificacion)}</dd>
      <dt>Diferencias individuales</dt><dd>${util.formatoBasico(diseno.diferencias)}</dd>
    </dl>`;
}

function vistaPendiente(mision) {
  const ultima = datos.progreso.ultimaEntrega;
  vista.innerHTML = `
    ${encabezadoMision(mision, 0, 0)}
    <p class="alerta alerta--info" role="status">${ultima?.etapa === 'en-revision'
      ? `🔎 Tu docente está revisando la versión ${ultima.version} desde el ${esc(util.fechaLarga(ultima.revisionInicio))}.`
      : `📨 Versión ${ultima?.version || 1} enviada el ${esc(util.fechaLarga(ultima?.fecha))}; pendiente de revisión.`}
      Solo tu docente la califica con la rúbrica de cuatro criterios; ni la plataforma ni la IA asignan puntaje. No puedes modificarla mientras tanto.</p>
    ${datos.galeriaHiloId ? `<p><a class="btn btn--secundario" href="/paginas/hilo.html?id=${encodeURIComponent(datos.galeriaHiloId)}">Compartir en la ${esc(experiencia().galeria.titulo)} (opcional)</a></p>` : ''}
    <section class="tarjeta"><h2 class="tarjeta__titulo">Tu envío</h2>${resumenDiseno(ultima?.diseno, mision.bloques, mision.recursosSonoros)}</section>`;
}

function vistaPrevia(mision) {
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Misión ${mision.numero}: ${esc(mision.titulo)}</h1>
    <p class="alerta alerta--info">Vista previa docente: las respuestas correctas y la retroalimentación se guardan en el servidor.</p>
    <section class="tarjeta"><p>${esc(mision.narrativa)}</p><p><strong>Instrucciones:</strong> ${esc(mision.instrucciones)}</p>${mision.caso ? `<p><strong>Caso:</strong> ${esc(mision.caso)}</p>` : ''}</section>
    ${mision.items.map((i, n) => `
      <section class="tarjeta"><p class="neuro-mini__estacion">Ítem ${n + 1} · ${esc(i.concepto)}</p><h2 class="tarjeta__titulo">${esc(i.titulo)}</h2>
        <p>${esc(i.situacion)}</p>${i.enunciado ? `<p><strong>${esc(i.enunciado)}</strong></p>` : ''}
        ${i.opciones ? `<ul>${i.opciones.map((o) => `<li>${esc(o.texto)}</li>`).join('')}</ul>` : ''}
        ${i.pares ? `<ul>${i.pares.map((p) => `<li><strong>${esc(p.concepto)}:</strong> ${esc(p.definicion)}</li>`).join('')}</ul>` : ''}
        ${i.lineas ? `<div class="neuro-cancion">${i.lineas.map((l) => `<p>${esc(l.replace(/\{\{\d\}\}/g, '_____'))}</p>`).join('')}</div>` : ''}
      </section>`).join('')}
    ${mision.rubrica ? `<section class="tarjeta"><h2 class="tarjeta__titulo">Rúbrica docente</h2><ul>${mision.rubrica.map((c) => `<li>${esc(c.criterio)} (${c.maximo})</li>`).join('')}</ul>${mision.rubricaEstado === 'aprobada' ? '' : '<p class="neuro-nota">Rúbrica propuesta, pendiente de aprobación del equipo docente.</p>'}</section>` : ''}
    <p><a class="btn btn--secundario" href="#mapa">Volver al mapa</a></p>`;
}

// ---------- 5. Retroalimentación de cierre ----------

function vistaRetroalimentacion() {
  const cierre = leerSesion(CLAVE_CIERRE);
  if (!cierre) {
    vista.innerHTML = `<h1 tabindex="-1" class="neuro-titulo">Retroalimentación</h1>
      <p class="alerta alerta--info">Aquí verás el resumen de cada misión al terminarla: logros, conceptos por reforzar y sugerencias para el siguiente nivel.</p>
      <p class="neuro-acciones"><a class="btn btn--primario" href="#actividad">Ir a las actividades</a><a class="btn btn--secundario" href="/paginas/explorar.html#ruta-academica">Volver a contenidos</a></p>`;
    return;
  }
  const mision = misionPorId(cierre.mision);
  const siguiente = experiencia().misiones[mision.numero];
  const est = datos.progreso?.misiones;
  if (mision.id === 'm3') {
    vista.innerHTML = `
      <h1 tabindex="-1" class="neuro-titulo">Retroalimentación · Misión 3</h1>
      ${neuriDice('¡Misión creada! Tu docente valorará tu diseño con la rúbrica. Si deseas, puedes compartir voluntariamente una versión en la Galería.', 'celebrando')}
      <section class="tarjeta"><p class="alerta alerta--exito" role="status">${esc(cierre.finalizacion)}</p>
        <h2 class="tarjeta__titulo">Lista de cotejo de tu envío</h2>
        <ul class="neuro-cotejo">${cierre.cotejo.map((c) => `<li class="neuro-cotejo__item${c.cumple ? ' neuro-cotejo__item--ok' : ''}"><span aria-hidden="true">${c.cumple ? '✔' : '○'}</span> ${esc(c.texto)}<span class="sr-only">${c.cumple ? ': cumple' : ': pendiente'}</span></li>`).join('')}</ul>
        <p class="neuro-nota">Tu docente asignará la puntuación con la rúbrica de cuatro criterios y validará tu justificación.</p>
        <div class="neuro-acciones">
          ${datos.galeriaHiloId ? `<a class="btn btn--secundario" href="/paginas/hilo.html?id=${encodeURIComponent(datos.galeriaHiloId)}">Compartir en la ${esc(experiencia().galeria.titulo)} (opcional)</a>` : ''}
          <a class="btn btn--secundario" href="/paginas/explorar.html#ruta-academica">Volver a contenidos</a>
          <a class="btn btn--primario" href="#resultados">Ver resultados</a>
        </div>
      </section>`;
    decir('¡Misión creada! Tu docente revisará tu diseño. Puedes volver a contenidos o consultar tus resultados.');
    return;
  }
  const aprobada = cierre.puntaje >= experiencia().aprobacion;
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Retroalimentación · Misión ${mision.numero}: ${esc(mision.titulo)}</h1>
    ${neuriDice(aprobada ? '¡Lo lograste! Mira qué conceptos dominaste y cuáles conviene reforzar.' : 'Cada error es una pista. Revisa la retroalimentación y vuelve a intentarlo: tu mejor puntaje se conserva.', aprobada ? 'celebrando' : 'animando')}
    <section class="tarjeta neuro-cierre${aprobada ? ' neuro-cierre--aprobada' : ''}">
      <div class="neuro-cierre__encabezado">
        ${medidorCircular(cierre.puntaje, 100, `Puntaje de la misión ${mision.numero}`)}
        <p class="neuro-cierre__puntaje"><strong>${cierre.puntaje}/100</strong> <span>(decisiones ${cierre.decision}/60 · justificación ${cierre.justificacion.total}/40)</span></p>
      </div>
      <div class="progreso" role="progressbar" aria-label="Puntaje de la misión" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cierre.puntaje}">
        <span class="progreso__barra" style="width: ${cierre.puntaje}%"></span>
        <span class="neuro-progreso__marca" style="left: ${experiencia().aprobacion}%" aria-hidden="true"></span>
      </div>
      <p class="alerta ${aprobada ? 'alerta--exito' : 'alerta--advertencia'}" role="status">
        ${aprobada ? `✔ Misión aprobada. ${esc(cierre.finalizacion)}` : `Aún no alcanzas ${experiencia().aprobacion}/100. Revisa la retroalimentación y repite la misión: se conserva tu mejor puntaje (${cierre.mejor}/100).`}
      </p>
      ${cierre.mejor > cierre.mejorAnterior && cierre.mejorAnterior > 0 ? `<p>📈 Mejoraste tu mejor puntaje: de ${cierre.mejorAnterior} a ${cierre.mejor}.</p>` : ''}
    </section>
    <section class="tarjeta">
      <h2 class="tarjeta__titulo">Logros por concepto</h2>
      <ul class="neuro-conceptos">${cierre.items.map((i) => {
        const estado = i.puntos >= i.maximo ? ['✔', 'Logrado'] : i.puntos > 0 ? ['◐', 'En desarrollo'] : ['✖', 'Por reforzar'];
        const recurso = i.puntos < i.maximo && i.recurso ? enlaceRecurso(i.recurso) : '';
        return `<li class="neuro-conceptos__item"><span aria-hidden="true">${estado[0]}</span> ${esc(i.concepto)} · ${i.puntos}/${i.maximo} · ${estado[1]}${i.revisar ? `<br><small>${esc(i.revisar)}</small>` : ''}${recurso ? `<br><small>${recurso}</small>` : ''}</li>`;
      }).join('')}</ul>
      ${cierre.distribucion ? notaDistribucion(mision) : ''}
      <h3 class="neuro-subtitulo">Tus tarjetas de argumento</h3>
      <ul class="neuro-conceptos">${cierre.tarjetas.map((t) => `<li class="neuro-conceptos__item"><span aria-hidden="true">${t.nivel === 'completo' ? '✔' : t.nivel === 'parcial' ? '◐' : '✖'}</span> ${esc(t.texto)}</li>`).join('')}</ul>
      ${cierre.justificacion.criterios?.length ? `
        <h3 class="neuro-subtitulo">Tu explicación escrita · ${cierre.justificacion.texto}/10</h3>
        <ul class="neuro-conceptos">${cierre.justificacion.criterios.map((c) => `<li class="neuro-conceptos__item"><span aria-hidden="true">${c.cumple ? '✔' : '✖'}</span> ${esc(c.texto)} · ${c.cumple ? c.puntos : 0}/${c.puntos}</li>`).join('')}</ul>
        <p class="neuro-nota">${esc(cierre.explicacion)}</p>`
        : `<p class="neuro-nota">Explicación escrita: ${cierre.justificacion.texto}/10. ${esc(cierre.explicacion)}</p>`}
    </section>
    ${cierre.reforzar.length ? `<section class="tarjeta"><h2 class="tarjeta__titulo">Conceptos por reforzar</h2><ul>${cierre.reforzar.map((c) => `<li>${esc(c)}</li>`).join('')}</ul><p>${enlaceRecurso('screencast')}</p><p>${enlaceRecurso('infografia')}</p></section>` : ''}
    <div class="neuro-acciones">
      <a class="btn btn--secundario" href="/paginas/explorar.html#ruta-academica">Volver a contenidos</a>
      <a class="btn btn--secundario" href="#mapa">Volver al mapa</a>
      <button type="button" class="btn btn--secundario" data-repetir>Repetir misión</button>
      ${siguiente && est?.[siguiente.id]?.estado !== 'bloqueada' ? `<a class="btn btn--primario" href="#mision-${siguiente.id}">Siguiente misión: ${esc(siguiente.titulo)}</a>` : ''}
    </div>`;
  vista.querySelector('[data-repetir]').addEventListener('click', () => abrirMision(mision.id, true));
  decir(aprobada ? '¡Misión superada! Mira tus logros y lo que conviene reforzar antes de avanzar.' : 'Revisa la retroalimentación: puedes intentarlo de nuevo y se conserva tu mejor puntaje.');
}

// ---------- 6. Progreso (storyboard: 70/100 por misión + insignia) ----------

function vistaProgreso() {
  const p = datos.progreso;
  if (!p) return ir('mapa');
  const e = experiencia();
  const obtenidas = new Set((p.insignias || []).map((i) => i.id));
  const siguiente = e.misiones.find((m) => ['abierta', 'devuelta'].includes(p.misiones[m.id].estado));
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Tu progreso</h1>
    ${neuriDice(siguiente
      ? `Para avanzar necesitas ${e.aprobacion}/100 en cada misión. Tu próxima meta: «${siguiente.titulo}».`
      : p.cumple ? 'Superaste todas las metas. Revisa tus resultados y descarga tu certificado.' : 'Sigue tu avance misión por misión. Tu mejor puntaje siempre se conserva.')}
    <section class="tarjeta">${barraProgreso(p.total)}</section>
    <section class="neuro-medidores neuro-progreso-misiones" aria-label="Progreso por misión">
      ${e.misiones.map((m) => {
        const est = p.misiones[m.id];
        const insignia = obtenidas.has(m.insignia);
        const falta = Math.max(0, e.aprobacion - est.mejor);
        return `
          <article class="tarjeta neuro-medidores__item neuro-mini--${m.id}" aria-labelledby="progreso-${m.id}">
            ${medidorCircular(est.mejor, 100, `Misión ${m.numero}`)}
            <h2 id="progreso-${m.id}" class="neuro-medidores__titulo"><span aria-hidden="true">${ICONOS_MISION[m.id]}</span> ${esc(m.titulo)}</h2>
            <div class="progreso neuro-mision__barra" role="progressbar" aria-label="Mejor puntaje de la misión ${m.numero} frente a la meta de ${e.aprobacion}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${est.mejor}">
              <span class="progreso__barra" style="width: ${est.mejor}%"></span>
              <span class="neuro-progreso__marca" style="left: ${e.aprobacion}%" aria-hidden="true"></span>
            </div>
            <p class="neuro-nota">${ESTADOS[est.estado].icono} ${esc(ESTADOS[est.estado].texto)} · ${est.aprobada ? `meta de ${e.aprobacion}/100 alcanzada` : est.estado === 'bloqueada' ? `se abre con ${e.aprobacion}/100 en la misión anterior` : `te faltan ${falta} puntos para ${e.aprobacion}/100`}</p>
            <p class="neuro-progreso-insignia${insignia ? ' neuro-progreso-insignia--obtenida' : ''}">${insignia ? '🏅 Insignia obtenida' : '🔒 Insignia pendiente'}</p>
          </article>`;
      }).join('')}
    </section>
    <section class="tarjeta"><h2 class="tarjeta__titulo">Todas tus insignias de NeuroRitmo</h2>${insigniasHtml()}</section>`;
  decir('Este es tu progreso: cada misión se supera con 70 de 100. Revisa cuál estación corresponde continuar.');
}

// ---------- 8. Reiniciar o cancelar ----------

function vistaReiniciar() {
  const p = datos.progreso;
  if (!p) return ir('mapa');
  const e = experiencia();
  const misiones = e.misiones.filter((m) => !['bloqueada', 'pendiente'].includes(p.misiones[m.id].estado));
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Reiniciar o cancelar</h1>
    ${neuriDice('Puedes repetir una misión o volver a empezar el recorrido. No te preocupes: tu mejor puntaje de cada misión se conserva.')}
    <section class="tarjeta" aria-labelledby="titulo-repetir">
      <h2 id="titulo-repetir" class="tarjeta__titulo">Repetir una misión</h2>
      <p class="neuro-nota">Se abre un intento nuevo; el anterior en curso se descarta y tu mejor puntaje no cambia.</p>
      <div class="neuro-acciones">
        ${misiones.length ? misiones.map((m) => `<button type="button" class="btn btn--secundario" data-repetir="${m.id}"><span aria-hidden="true">${ICONOS_MISION[m.id]}</span> ${p.enCurso?.[m.id] ? 'Reiniciar intento de' : 'Repetir'} la misión ${m.numero}</button>`).join('')
          : '<p class="neuro-nota">Aún no hay misiones disponibles para repetir.</p>'}
      </div>
    </section>
    <section class="tarjeta" aria-labelledby="titulo-reiniciar">
      <h2 id="titulo-reiniciar" class="tarjeta__titulo">Reiniciar el recorrido</h2>
      <p class="neuro-nota">Vuelve a la bienvenida para recorrer de nuevo instrucciones y mapa. No se borra ningún puntaje ni insignia.</p>
      <div class="neuro-acciones"><a class="btn btn--primario" href="#inicio">Volver a la bienvenida</a></div>
    </section>
    <div class="neuro-acciones"><a class="btn btn--texto" href="${esc(vistaAnterior)}" data-cancelar>Cancelar y volver</a></div>`;
  vista.querySelectorAll('[data-repetir]').forEach((b) => b.addEventListener('click', () => abrirMision(b.dataset.repetir, true)));
  decir('Elige si repites una misión, vuelves a la bienvenida o cancelas. Cancelar conserva tu avance.');
}

// ---------- 7. Resultados ----------

function vistaResultados() {
  const p = datos.progreso;
  if (!p) return ir('mapa');
  const e = experiencia();
  const ultima = p.ultimaEntrega;
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Resultados de la ruta</h1>
    ${neuriDice(p.cumple ? '¡Felicitaciones, completaste la ruta NeuroRitmo! Ya puedes descargar tu certificado.' : 'Este es tu avance. Puedes repetir misiones para mejorar: siempre se conserva tu mejor puntaje.', p.cumple ? 'celebrando' : 'reposo')}
    <section class="tarjeta">${barraProgreso(p.total)}</section>
    <section class="neuro-medidores" aria-label="Mejor puntaje por misión">
      ${e.misiones.map((m) => `
        <article class="tarjeta neuro-medidores__item neuro-mini--${m.id}">
          ${medidorCircular(p.misiones[m.id].mejor, 100, `Misión ${m.numero}`)}
          <p class="neuro-medidores__titulo"><span aria-hidden="true">${ICONOS_MISION[m.id]}</span> ${esc(m.titulo)}</p>
          <p class="neuro-nota">${ESTADOS[p.misiones[m.id].estado].icono} ${esc(ESTADOS[p.misiones[m.id].estado].texto)}</p>
        </article>`).join('')}
    </section>
    <section class="tarjeta">
      <h2 class="tarjeta__titulo">Puntaje por misión</h2>
      <div class="tabla-contenedor"><table class="tabla">
        <caption class="sr-only">Mejor puntaje de cada misión</caption>
        <thead><tr><th scope="col">Misión</th><th scope="col">Nivel</th><th scope="col">Mejor puntaje</th><th scope="col">Estado</th></tr></thead>
        <tbody>${e.misiones.map((m) => `<tr><th scope="row">${m.numero}. ${esc(m.titulo)}</th><td>${esc(m.nivel)}</td><td>${p.misiones[m.id].mejor}/100</td><td>${ESTADOS[p.misiones[m.id].estado].icono} ${esc(ESTADOS[p.misiones[m.id].estado].texto)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">Total</th><td colspan="2"><strong>${p.total}/${e.reglas.maximoRuta}</strong></td></tr></tfoot>
      </table></div>
      ${ultima?.criterios ? `<div class="neuro-pista"><p><strong>👩‍🏫 Valoración docente de la Misión 3: ${ultima.puntaje}/100</strong></p>${ultima.comentario ? util.formatoBasico(ultima.comentario) : ''}</div>` : ''}
    </section>
    <section class="tarjeta"><h2 class="tarjeta__titulo">Insignias</h2>${insigniasHtml()}</section>
    <section class="tarjeta neuro-certificado${p.cumple ? ' neuro-certificado--listo' : ''}">
      <span class="neuro-certificado__icono" aria-hidden="true">🏅</span>
      <h2 class="tarjeta__titulo">Condición de logro</h2>
      <p class="neuro-nota">El certificado exige los cinco requisitos a la vez; el servidor los comprueba antes de emitirlo.</p>
      <ul class="neuro-cotejo" data-requisitos>${p.condiciones.map((c) => `<li class="neuro-cotejo__item${c.cumple ? ' neuro-cotejo__item--ok' : ''}"><span aria-hidden="true">${c.cumple ? '✔' : '○'}</span> ${esc(c.texto)}<span class="sr-only">${c.cumple ? ': cumple' : ': pendiente'}</span></li>`).join('')}</ul>
      <p class="alerta ${p.cumple ? 'alerta--exito' : 'alerta--info'}">${p.cumple ? '🎉 ¡Misión cumplida! Descarga tu certificado.' : 'En proceso: repite las misiones que necesites; se conserva tu mejor puntaje.'}</p>
      <div class="neuro-acciones">
        <button type="button" class="btn btn--acento" data-certificado${p.cumple ? '' : ' disabled aria-describedby="nota-certificado"'}>📄 Descargar certificado «Ruta NeuroRitmo completada»</button>
        <a class="btn btn--secundario" href="#reiniciar" data-reiniciar>Reiniciar o repetir una misión</a>
      </div>
      ${p.cumple ? '' : `<p id="nota-certificado" class="neuro-nota">Te falta: ${esc(p.condiciones.filter((c) => !c.cumple).map((c) => c.texto).join('; '))}. No se emite ningún documento hasta cumplirlo todo.</p>`}
    </section>`;
  const botonCertificado = vista.querySelector('[data-certificado]');
  botonCertificado.addEventListener('click', async () => {
    botonCertificado.disabled = true;
    try {
      const { codigo } = await generarDiploma({ tipo: 'neuroritmo' });
      ui.aviso(`Certificado descargado. Código de verificación: ${codigo}`, 'exito');
    } catch (err) {
      ui.aviso(err.message, 'error');
    } finally {
      botonCertificado.disabled = !p.cumple;
    }
  });
  decir(p.cumple ? '¡Felicitaciones! Completaste la ruta NeuroRitmo. Revisa tu cierre y tus logros.' : 'Este es tu avance. Puedes repetir misiones para mejorar.');
}

// ---------- Panel docente ----------

async function vistaPanel() {
  if (!['docente', 'admin'].includes(datos.rol)) return ir('inicio');
  const grupos = await api.llamar('GET', '/api/neuroritmo/grupos');
  if (!grupos.length) {
    vista.innerHTML = '<h1 tabindex="-1" class="neuro-titulo">Panel docente</h1><p class="alerta alerta--info">No tienes grupos de la asignatura de NeuroRitmo.</p>';
    return;
  }
  const elegido = util.parametro('grupoId') && grupos.some((g) => g.id === util.parametro('grupoId')) ? util.parametro('grupoId') : grupos[0].id;
  vista.innerHTML = `
    <h1 tabindex="-1" class="neuro-titulo">Panel docente · NeuroRitmo</h1>
    <div class="campo neuro-grupo"><label for="grupo-panel">Grupo</label>
      <select id="grupo-panel">${grupos.map((g) => `<option value="${esc(g.id)}"${g.id === elegido ? ' selected' : ''}>Paralelo ${esc(g.paralelo)} · ${esc(g.periodo)} (${g.estudiantes} estudiantes)</option>`).join('')}</select>
    </div>
    <section class="tarjeta" id="distribucion" aria-labelledby="titulo-distribucion"></section>
    <section class="tarjeta" id="rubrica-m3" aria-labelledby="titulo-rubrica"></section>
    <div id="panel-contenido"></div>`;
  const selector = document.getElementById('grupo-panel');
  selector.addEventListener('change', () => pintarPanel(selector.value));
  await Promise.all([pintarDistribucion(), pintarRubrica(() => pintarPanel(selector.value)), pintarPanel(elegido)]);
}

// Rúbrica de cuatro criterios de la Misión 3: el docente la ajusta y la aprueba antes de calificar
async function pintarRubrica(alCambiar) {
  const zona = document.getElementById('rubrica-m3');
  const r = await api.llamar('GET', '/api/neuroritmo/rubrica');
  const aprobada = r.estado === 'aprobada';
  const bloqueo = r.puedeConfigurar ? '' : ' disabled';
  zona.innerHTML = `
    <h2 id="titulo-rubrica" class="tarjeta__titulo">Rúbrica de la Misión 3 · cuatro criterios (${r.limites.producto} producto + ${r.limites.justificacion} justificación)</h2>
    <p class="alerta ${aprobada ? 'alerta--exito' : 'alerta--advertencia'}">${aprobada
      ? `✔ Versión ${r.version} aprobada${r.aprobadaPor ? ` por ${esc(r.aprobadaPor)}` : ''} ${esc(util.fechaRelativa(r.fechaAprobacion))}.`
      : '⚠ Rúbrica propuesta, pendiente de aprobación del equipo docente. No se puede calificar hasta aprobarla.'}</p>
    <p class="neuro-nota">${esc(r.fuente)}</p>
    <form class="neuro-config-rubrica" novalidate>
      ${r.criterios.map((c, n) => `
        <fieldset class="neuro-bloque">
          <legend>Criterio ${n + 1}</legend>
          <div class="campo"><label for="rub-${c.id}-criterio">Nombre del criterio</label>
            <input id="rub-${c.id}-criterio" name="${c.id}-criterio" maxlength="200" value="${esc(c.criterio)}"${bloqueo}></div>
          <div class="campo"><label for="rub-${c.id}-descripcion">Descripción o niveles de logro</label>
            <textarea id="rub-${c.id}-descripcion" name="${c.id}-descripcion" rows="2" maxlength="600"${bloqueo}>${esc(c.descripcion)}</textarea></div>
          <div class="neuro-campos">
            <div class="campo"><label for="rub-${c.id}-tipo">Evalúa</label>
              <select id="rub-${c.id}-tipo" name="${c.id}-tipo"${bloqueo}>
                <option value="producto"${c.tipo === 'producto' ? ' selected' : ''}>Producto</option>
                <option value="justificacion"${c.tipo === 'justificacion' ? ' selected' : ''}>Justificación</option></select></div>
            <div class="campo"><label for="rub-${c.id}-maximo">Puntaje máximo</label>
              <input id="rub-${c.id}-maximo" name="${c.id}-maximo" type="number" min="${r.limites.minimo}" step="1" value="${c.maximo}"${bloqueo}></div>
          </div>
        </fieldset>`).join('')}
      <p class="neuro-nota" aria-live="polite" data-sumas></p>
      ${r.puedeConfigurar ? `<div class="neuro-acciones">
        <button type="button" class="btn btn--secundario" data-guardar-rubrica>Guardar como propuesta</button>
        <button type="submit" class="btn btn--primario">Aprobar rúbrica</button></div>`
        : '<p class="neuro-nota">Solo el docente de la asignatura puede configurar la rúbrica.</p>'}
    </form>
    ${r.historial.length ? `<details class="neuro-version"><summary>Historial de la rúbrica (${r.historial.length})</summary><ul>${[...r.historial].reverse().map((h) => `<li>${h.accion === 'aprobada' ? `✔ Aprobada (versión ${h.version})` : '✎ Guardada como propuesta'} · ${esc(h.por || '—')} · ${esc(util.fechaLarga(h.fecha))}</li>`).join('')}</ul></details>` : ''}`;
  const form = zona.querySelector('form');
  const leer = () => r.criterios.map((c) => ({
    id: c.id, criterio: form.elements[`${c.id}-criterio`].value, descripcion: form.elements[`${c.id}-descripcion`].value,
    tipo: form.elements[`${c.id}-tipo`].value, maximo: Number(form.elements[`${c.id}-maximo`].value)
  }));
  const sumas = () => {
    const c = leer();
    const suma = (tipo) => c.filter((x) => x.tipo === tipo).reduce((s, x) => s + (x.maximo || 0), 0);
    form.querySelector('[data-sumas]').textContent = `Producto: ${suma('producto')}/${r.limites.producto} · Justificación: ${suma('justificacion')}/${r.limites.justificacion}`;
  };
  form.addEventListener('input', sumas);
  sumas();
  async function guardar(aprobar) {
    const criterios = leer();
    const fallo = reglas.errorRubrica(criterios);
    if (fallo) return ui.aviso(fallo, 'error');
    if (aprobar && !(await ui.confirmar('Se aprobará esta rúbrica de cuatro criterios para calificar la Misión 3. Las valoraciones ya hechas conservan la versión con que se calificaron. ¿Aprobarla?'))) return;
    try {
      await api.llamar('PUT', '/api/neuroritmo/rubrica', { criterios, aprobar, confirmado: aprobar });
      ui.aviso(aprobar ? 'Rúbrica aprobada.' : 'Rúbrica guardada como propuesta.', 'exito');
      await pintarRubrica(alCambiar);
      await alCambiar?.();
    } catch (err) {
      ui.aviso(err.message, 'error');
    }
  }
  form.querySelector('[data-guardar-rubrica]')?.addEventListener('click', () => guardar(false));
  form.addEventListener('submit', (ev) => { ev.preventDefault(); if (r.puedeConfigurar) guardar(true); });
}

// Propuesta de reparto de los 60 puntos de M2: el docente la revisa y la aprueba (o la ajusta) antes de fijarla
async function pintarDistribucion() {
  const zona = document.getElementById('distribucion');
  const d = await api.llamar('GET', '/api/neuroritmo/distribucion');
  const aprobada = d.estado === 'aprobada';
  zona.innerHTML = `
    <h2 id="titulo-distribucion" class="tarjeta__titulo">Distribución de los ${d.total} puntos de decisiones y productos · ${esc(d.titulo)}</h2>
    <p class="alerta ${aprobada ? 'alerta--exito' : 'alerta--advertencia'}">${aprobada
      ? `✔ Aprobada${d.aprobadaPor ? ` por ${esc(d.aprobadaPor)}` : ''} ${esc(util.fechaRelativa(d.fechaAprobacion))}${d.ajustada ? ' con ajustes a la propuesta' : ''}.`
      : '⚠ Propuesta pendiente de tu aprobación. No proviene de la Tarea 3: mientras no la apruebes, las misiones se puntúan con estos valores provisionales.'}</p>
    <p class="neuro-nota">${esc(d.fuente)}</p>
    <form class="neuro-distribucion" novalidate>
      <div class="tabla-contenedor"><table class="tabla">
        <caption class="sr-only">Puntos máximos por actividad de la misión</caption>
        <thead><tr><th scope="col">Actividad</th><th scope="col">Razón de la propuesta</th><th scope="col">Puntos</th></tr></thead>
        <tbody>${d.items.map((i) => `<tr>
          <th scope="row">${esc(i.titulo)}<br><small>${esc(i.concepto)}</small></th>
          <td>${esc(i.razon)}${i.propuesto !== i.valor ? `<br><small>Propuesto: ${i.propuesto}</small>` : ''}</td>
          <td><label class="sr-only" for="peso-${esc(i.id)}">Puntos de ${esc(i.titulo)}</label>
            <input id="peso-${esc(i.id)}" name="${esc(i.id)}" type="number" min="${d.limites.minimo}" max="${d.limites.maximo}" step="1" value="${i.valor}"${d.puedeAprobar ? '' : ' disabled'}></td>
        </tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row" colspan="2">Total (justificación aparte: 40)</th><td><strong data-suma>${d.items.reduce((s, i) => s + i.valor, 0)}</strong>/${d.total}</td></tr></tfoot>
      </table></div>
      ${d.puedeAprobar ? `<p class="neuro-nota">Puedes ajustar cada actividad entre ${d.limites.minimo} y ${d.limites.maximo} puntos; el total debe ser ${d.total}. La aprobación se registra una sola vez y los intentos ya finalizados conservan su puntaje.</p>
        <div class="neuro-acciones"><button type="submit" class="btn btn--primario">Aprobar distribución</button></div>` : ''}
    </form>`;
  const form = zona.querySelector('form');
  form.addEventListener('input', () => {
    form.querySelector('[data-suma]').textContent = d.items.reduce((s, i) => s + (Number(form.elements[i.id].value) || 0), 0);
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const valores = Object.fromEntries(d.items.map((i) => [i.id, Number(form.elements[i.id].value)]));
    if (!(await ui.confirmar('La distribución quedará fijada para las próximas partidas de la misión. ¿Aprobarla?'))) return;
    const boton = form.querySelector('[type="submit"]');
    boton.disabled = true;
    try {
      await api.llamar('POST', '/api/neuroritmo/distribucion', { valores });
      ui.aviso('Distribución aprobada.', 'exito');
      await pintarDistribucion();
    } catch (err) {
      boton.disabled = false;
      ui.aviso(err.message, 'error');
    }
  });
}

async function pintarPanel(grupoId) {
  const zona = document.getElementById('panel-contenido');
  const [d, rubrica] = await Promise.all([
    api.llamar('GET', `/api/neuroritmo/panel?grupoId=${encodeURIComponent(grupoId)}`),
    api.llamar('GET', '/api/neuroritmo/rubrica')
  ]);
  const m3 = misionPorId('m3');
  const criteriosRubrica = rubrica.criterios;
  const rubricaLista = rubrica.estado === 'aprobada';
  const celda = (m) => `${m.mejor}/100 ${ESTADOS[m.estado].icono}<span class="sr-only"> ${ESTADOS[m.estado].texto}</span>${m.intentosBajo ? ' <span class="chip">apoyo</span>' : ''}`;
  zona.innerHTML = `
    <section class="tarjeta">
      <h2 class="tarjeta__titulo">Progreso del grupo</h2>
      <div class="tabla-contenedor"><table class="tabla">
        <caption class="sr-only">Mejor puntaje por misión de cada estudiante</caption>
        <thead><tr><th scope="col">Estudiante</th><th scope="col">M1</th><th scope="col">M2</th><th scope="col">M3</th><th scope="col">Total</th><th scope="col">Pistas</th><th scope="col">Logro</th></tr></thead>
        <tbody>${d.estudiantes.map((s) => `<tr><th scope="row">${esc(s.nombre)}</th><td>${celda(s.misiones.m1)}</td><td>${celda(s.misiones.m2)}</td><td>${celda(s.misiones.m3)}</td><td>${s.total}/${experiencia().reglas.maximoRuta}</td><td>${s.pistas}</td><td>${s.cumple ? '🎉 Cumplida' : 'En proceso'}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="neuro-nota">«apoyo»: misión bajo 70 tras dos intentos. Las alertas son de acompañamiento, no de etiquetado.</p>
    </section>
    <section class="tarjeta">
      <h2 class="tarjeta__titulo">Resultados por concepto</h2>
      <ul class="neuro-barras">${d.conceptos.map((c) => `
        <li class="neuro-barras__fila">
          <span>${esc(c.mision.toUpperCase())} · ${esc(c.concepto)} <small>(${c.respuestas} respuestas · ${c.pistas} pistas)</small></span>
          <span class="progreso" role="img" aria-label="${c.logro === null ? 'Sin datos' : `${c.logro} % de logro`}"><span class="progreso__barra" style="width: ${c.logro || 0}%"></span></span>
          <strong>${c.logro === null ? '—' : `${c.logro} %`}</strong>
        </li>`).join('')}</ul>
    </section>
    <section class="tarjeta" id="pendientes">
      <h2 class="tarjeta__titulo">Justificaciones pendientes de la Misión 3 (${d.pendientes.length})</h2>
      ${d.pendientes.length ? '' : '<p class="neuro-nota">No hay diseños pendientes.</p>'}
      <div id="lista-pendientes"></div>
    </section>
    ${d.revisadas.length ? `<section class="tarjeta"><h2 class="tarjeta__titulo">Valoraciones recientes</h2><ul>${d.revisadas.map((e) => `<li>${esc(e.estudiante)} · ${e.estado === 'validada' ? '✔ Validada' : '✍️ Devuelta'} · ${e.puntaje}/100 · ${esc(util.fechaRelativa(e.fechaRevision))}</li>`).join('')}</ul></section>` : ''}`;

  const lista = document.getElementById('lista-pendientes');
  for (const e of d.pendientes) {
    const art = document.createElement('article');
    art.className = 'neuro-entrega';
    art.innerHTML = `
      <h3 class="neuro-subtitulo">${esc(e.estudiante)} · versión ${e.version} · enviado ${esc(util.fechaRelativa(e.fecha))} · ${e.pistas || 0} pistas · ${e.usosIa || 0} consultas a Neuri</h3>
      <p class="neuro-nota"><span class="chip">${ETAPAS[e.etapa]}</span> No tiene puntaje hasta que la valores con la rúbrica.
        ${e.etapa === 'enviado' ? '<button type="button" class="btn btn--secundario btn--pequeno" data-revision>Iniciar revisión</button>' : ''}</p>
      ${e.anterior ? `<details class="neuro-version"><summary>Versión ${e.anterior.version} devuelta (${e.anterior.puntaje}/100) y tu comentario</summary>
        ${e.anterior.comentario ? `<div class="neuro-pista">${util.formatoBasico(e.anterior.comentario)}</div>` : ''}
        ${resumenDiseno(e.anterior.diseno, m3.bloques, m3.recursosSonoros)}</details>` : ''}
      ${resumenDiseno(e.diseno, m3.bloques, m3.recursosSonoros)}
      <ul class="neuro-cotejo">${e.cotejo.map((c) => `<li class="neuro-cotejo__item${c.cumple ? ' neuro-cotejo__item--ok' : ''}"><span aria-hidden="true">${c.cumple ? '✔' : '○'}</span> ${esc(c.texto)}</li>`).join('')}</ul>
      <form class="neuro-rubrica" novalidate>
        ${rubricaLista ? '' : '<p class="alerta alerta--advertencia">La rúbrica aún no está aprobada por el equipo docente: apruébala arriba para poder calificar.</p>'}
        <fieldset${rubricaLista ? '' : ' disabled'}><legend>Rúbrica versión ${rubrica.version} (${rubrica.limites.producto} producto + ${rubrica.limites.justificacion} justificación)</legend>
          ${criteriosRubrica.map((c) => `<div class="campo"><label for="${e.id}-${c.id}">${esc(c.criterio)} · ${c.tipo === 'producto' ? 'producto' : 'justificación'} (0 a ${c.maximo})</label>${c.descripcion ? `<p class="neuro-nota">${esc(c.descripcion)}</p>` : ''}<input id="${e.id}-${c.id}" name="${c.id}" type="number" min="0" max="${c.maximo}" step="1" required></div>`).join('')}
          <div class="campo"><label for="${e.id}-comentario">Comentario formativo</label><textarea id="${e.id}-comentario" name="comentario" rows="3" maxlength="1000"></textarea></div>
          <p class="neuro-nota" aria-live="polite">Producto: <strong data-producto>0</strong>/${rubrica.limites.producto} · Justificación: <strong data-justificacion>0</strong>/${rubrica.limites.justificacion} · Total: <strong data-total>0</strong>/100. Validar exige al menos ${experiencia().justificacionValidaM3}/40 en la justificación.</p>
          <div class="neuro-acciones">
            <button type="submit" class="btn btn--primario" value="validada">Validar misión</button>
            <button type="submit" class="btn btn--secundario" value="devuelta">Devolver para mejora</button>
          </div>
        </fieldset>
      </form>`;
    art.querySelector('[data-revision]')?.addEventListener('click', async () => {
      try {
        await api.llamar('POST', `/api/neuroritmo/entregas/${encodeURIComponent(e.id)}/revision`);
        ui.aviso('Entrega en revisión: el estudiante ya no puede modificarla.', 'exito');
        await pintarPanel(grupoId);
      } catch (err) {
        ui.aviso(err.message, 'error');
      }
    });
    const form = art.querySelector('form');
    const valores = () => Object.fromEntries(criteriosRubrica.map((c) => [c.id, Number(form.elements[c.id].value)]));
    form.addEventListener('input', () => {
      const s = reglas.subtotalesRubrica(criteriosRubrica, valores());
      form.querySelector('[data-producto]').textContent = s.producto;
      form.querySelector('[data-justificacion]').textContent = s.justificacion;
      form.querySelector('[data-total]').textContent = s.total;
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!rubricaLista) return;
      const decision = ev.submitter?.value || 'validada';
      const criterios = valores();
      if (criteriosRubrica.some((c) => form.elements[c.id].value === '')) return ui.aviso('Completa los cuatro criterios de la rúbrica.', 'error');
      const s = reglas.subtotalesRubrica(criteriosRubrica, criterios);
      const resumen = `${e.estudiante} · producto ${s.producto}/60 · justificación ${s.justificacion}/40 · total ${s.total}/100`;
      if (!(await ui.confirmar(decision === 'validada'
        ? `¿Validar la Misión 3? ${resumen}. La valoración quedará registrada y no se podrá cambiar.`
        : `¿Devolver para mejora? ${resumen}. El estudiante verá tu comentario y podrá enviar una versión nueva.`))) return;
      form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        await api.llamar('POST', `/api/neuroritmo/entregas/${encodeURIComponent(e.id)}/calificar`, {
          criterios, decision, comentario: form.elements.comentario.value, confirmado: true, rubricaVersion: rubrica.version
        });
        ui.aviso(decision === 'validada' ? 'Diseño validado.' : 'Diseño devuelto con tus sugerencias.', 'exito');
        await pintarPanel(grupoId);
      } catch (err) {
        form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        ui.aviso(err.message, 'error');
      }
    });
    lista.append(art);
  }
}

// ---------- Arranque ----------

try {
  await cargarDatos();
  window.addEventListener('hashchange', render);
  await render();
} catch (err) {
  vista.innerHTML = `<div class="alerta alerta--error" role="alert">${esc(err.message || 'No se pudo cargar NeuroRitmo')}</div>`;
}
