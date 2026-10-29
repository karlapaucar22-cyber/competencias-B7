// publico/js/modulos/tutor.js
// Tutor IA de un tema: comparte el historial privado de sesión con el panel global de Neuri.

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';
import {
  agregarHistorialTutor, guardarHistorialTutor, historialParaApi,
  leerHistorialTutor, limpiarHistorialTutor
} from '../nucleo/historial-tutor.js';

await montarPlantilla({ titulo: 'Pregúntale a Neuri', roles: ['estudiante'] });

const MAX_HISTORIAL = 10;
const MAX_MENSAJE = 1000;
const LIMITE_AMABLE = 'Por hoy llegaste al límite de mensajes con el tutor. ¡Buen trabajo! Mañana podrás seguir conversando; mientras tanto, repasa el tema o practica con una actividad.';

const $ = (id) => document.getElementById(id);
let tema = null;
let historial = leerHistorialTutor();
let enviando = false;
let agotado = false;
let opcionesNeuroRitmo = {};

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

// ---------- Mensajes ----------
function agregar(rol, texto, { error = false } = {}) {
  const burbuja = crear('div', `tutor__mensaje tutor__mensaje--${rol}${error ? ' tutor__mensaje--error' : ''}`);
  if (rol === 'tutor') {
    burbuja.append(crear('span', 'tutor__autor', 'Tutor'));
    const cuerpo = crear('div');
    cuerpo.innerHTML = util.formatoBasico(texto);   // escapa el HTML y aplica negritas y listas
    burbuja.append(cuerpo);
  } else {
    if (rol === 'usuario') burbuja.append(crear('span', 'sr-only', 'Tú: '));
    burbuja.append(document.createTextNode(texto));
  }
  $('mensajes').append(burbuja);
  $('mensajes').scrollTop = $('mensajes').scrollHeight;
  return burbuja;
}

function bienvenida() {
  agregar('tutor', `¡Hola! Vamos a trabajar **${tema.titulo}**. No te daré la respuesta de inmediato: te haré preguntas y te daré pistas para que llegues tú a la idea. Elige una pregunta guía o escribe tu duda.`);
}

// Tres preguntas guía del tema (se completan con preguntas generales si faltan)
function pintarSugerencias(visibles) {
  const caja = $('sugerencias');
  caja.hidden = !visibles;
  if (!visibles) return;
  const delTema = (Array.isArray(tema.preguntasGuia) ? tema.preguntasGuia : []).filter((p) => typeof p === 'string' && p.trim());
  const generales = [
    `¿Cuál es la idea principal de «${tema.titulo}»?`,
    'Hazme una pregunta para comprobar lo que sé',
    'Explícame con un ejemplo cotidiano'
  ];
  const opciones = [...delTema, ...generales].slice(0, 3);
  caja.replaceChildren(...opciones.map((texto) => {
    const chip = crear('button', 'tutor__sugerencia', texto);
    chip.type = 'button';
    chip.addEventListener('click', () => enviar(texto));
    return chip;
  }));
}

function actualizarControles() {
  $('entrada').disabled = enviando || agotado;
  $('btnEnviar').disabled = enviando || agotado;
  if (agotado) $('entrada').placeholder = 'Alcanzaste el límite de hoy. Vuelve mañana.';
}

function ajustarAltura() {
  const entrada = $('entrada');
  entrada.style.height = 'auto';
  entrada.style.height = `${entrada.scrollHeight}px`;
}

// ---------- Envío ----------
async function enviar(texto) {
  texto = String(texto || '').trim();
  if (!texto || enviando || agotado || !tema) return;
  if (texto.length > MAX_MENSAJE) {
    ui.aviso(`Tu mensaje puede tener hasta ${MAX_MENSAJE.toLocaleString('es-EC')} caracteres.`, 'error');
    return;
  }
  enviando = true;
  actualizarControles();
  pintarSugerencias(false);

  const propia = agregar('usuario', texto);
  historial = agregarHistorialTutor(historial, 'estudiante', texto, { temaId: tema.id, etiqueta: tema.titulo });
  $('entrada').value = '';
  ajustarAltura();
  const pensando = crear('div', 'tutor__mensaje tutor__mensaje--tutor');
  pensando.append(crear('span', '', 'El tutor está pensando... '));
  const puntos = crear('span', 'tutor__escribiendo');
  puntos.setAttribute('aria-hidden', 'true');
  puntos.append(crear('span'), crear('span'), crear('span'));
  pensando.append(puntos);
  $('mensajes').append(pensando);
  $('mensajes').scrollTop = $('mensajes').scrollHeight;
  cambiarEstado('pensando');

  try {
    const r = await api.ia('tutor', {
      temaId: tema.id,
      contexto: { actividad: 'tema' },
      historial: historialParaApi(historial).slice(-MAX_HISTORIAL)
    });
    pensando.remove();
    agregar('tutor', r.respuesta);
    historial = agregarHistorialTutor(historial, 'tutor', r.respuesta, { temaId: tema.id, etiqueta: tema.titulo });
    // El avatar "habla" y solo lee la respuesta si la voz está activa (sin marcas de formato)
    decir(r.respuesta.replace(/\*\*/g, '').replace(/^\s*-\s+/gm, ''), { soloVoz: true });
  } catch (err) {
    cambiarEstado('reposo');
    pensando.remove();
    historial = guardarHistorialTutor(historial.slice(0, -1));
    if (err.estado === 429) {
      agotado = true;
      agregar('sistema', LIMITE_AMABLE);
    } else {
      propia.remove();
      $('entrada').value = texto;   // se devuelve el texto para reintentar
      ajustarAltura();
      agregar('sistema', `No se pudo enviar: ${err.message}`, { error: true });
    }
  } finally {
    enviando = false;
    actualizarControles();
    if (!$('entrada').disabled) $('entrada').focus();
  }
}

// ---------- Conversación ----------
async function nuevaConversacion({ preguntar = true } = {}) {
  if (preguntar && historial.length && !(await ui.confirmar('¿Empezar una conversación nueva? El tutor olvidará lo que hablaron.'))) return;
  historial = [];
  limpiarHistorialTutor();
  $('mensajes').replaceChildren();
  bienvenida();
  pintarSugerencias(true);
  if (!$('entrada').disabled) $('entrada').focus();
}

async function pintarTema() {
  $('tutorTema').textContent = tema.titulo;
  $('enlaceTema').href = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;
  $('tutorAsignatura').textContent = '';
  try {
    const unidad = await api.obtener('unidades', tema.unidadId);
    const asignatura = await api.obtener('asignaturas', unidad.asignaturaId);
    $('tutorAsignatura').textContent = `${asignatura.nombre} · ${unidad.titulo}`;
  } catch {
    // El nombre de la asignatura es solo informativo
  }
}

async function cambiarTema() {
  const elegido = await obtenerTemaActividad({ ...opcionesNeuroRitmo, forzarModal: true });
  if (!elegido?.id) return;
  tema = elegido;
  history.replaceState(null, '', `?temaId=${encodeURIComponent(tema.id)}`);
  await pintarTema();
  agregar('sistema', `Ahora estudias «${tema.titulo}». Tu conversación anterior se conserva.`);
  pintarSugerencias(true);
}

async function iniciar() {
  const [respuestaNeuro, unidades, temas] = await Promise.all([
    api.llamar('GET', '/api/neuroritmo'), api.listar('unidades'), api.listar('temas')
  ]);
  const experiencia = respuestaNeuro.experiencia;
  const unidadesNeuro = new Set((unidades || [])
    .filter((unidad) => unidad.asignaturaId === experiencia.asignaturaId)
    .map((unidad) => unidad.id));
  const temaIds = (temas || [])
    .filter((item) => item.estado === 'publicado' && unidadesNeuro.has(item.unidadId))
    .map((item) => item.id);
  const predeterminado = experiencia.misiones?.[0]?.temaId || temaIds[0];
  opcionesNeuroRitmo = { asignaturaIds: [experiencia.asignaturaId], temaIds, temaIdPredeterminado: predeterminado };
  const solicitado = new URL(location.href).searchParams.get('temaId');
  if (solicitado && !temaIds.includes(solicitado)) {
    history.replaceState(null, '', `?temaId=${encodeURIComponent(predeterminado)}`);
  }
  historial = guardarHistorialTutor(historial.filter((mensaje) => temaIds.includes(mensaje.temaId)));
  tema = await obtenerTemaActividad(opcionesNeuroRitmo);
  if (!tema) {
    $('tutorEstado').textContent = 'Elige un tema para conversar con el tutor. Puedes entrar desde la página de un tema con "Pregunta al tutor".';
    return;
  }
  $('tutorEstado').textContent = '';
  $('tutorApp').hidden = false;
  await pintarTema();

  $('formTutor').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar($('entrada').value);
  });
  $('entrada').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviar($('entrada').value);
    }
  });
  $('entrada').addEventListener('input', ajustarAltura);
  $('btnNueva').addEventListener('click', () => nuevaConversacion());
  $('btnCambiarTema').addEventListener('click', cambiarTema);

  if (historial.length) {
    historial.slice(-20).forEach((mensaje) => agregar(mensaje.rol === 'tutor' ? 'tutor' : 'usuario', mensaje.texto));
    pintarSugerencias(false);
  } else {
    bienvenida();
    pintarSugerencias(true);
  }
  $('entrada').focus();
}

if (usuarioActual()?.rol === 'estudiante') await iniciar();
