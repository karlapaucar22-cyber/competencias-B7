// publico/js/modulos/tutor-socratico.js
// Chat del tutor socrático de una asignatura (lateral en escritorio, pantalla completa en móvil).
// Usa POST /api/ia/tutor por tema; la conversación vive solo en esta pestaña (sessionStorage).

import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

const MAX_MENSAJE = 1000;
const MAX_HISTORIAL = 10;
const ESCRITORIO = window.matchMedia('(min-width: 1024px)');

// Conversación guardada en el navegador: { temaId, mensajes: [{ rol: "estudiante" | "tutor", texto }] }
function leerConversacion(clave) {
  try {
    const dato = JSON.parse(sessionStorage.getItem(clave) || 'null');
    return dato && Array.isArray(dato.mensajes) ? dato : null;
  } catch {
    return null;
  }
}

function guardarConversacion(clave, conversacion) {
  try {
    sessionStorage.setItem(clave, JSON.stringify(conversacion));
  } catch {
    // Sin almacenamiento: la conversación dura mientras la página esté abierta
  }
}

function el(tag, atributos = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (clave === 'texto') nodo.textContent = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  nodo.append(...hijos.filter(Boolean));
  return nodo;
}

/**
 * @param {{ panel: HTMLElement, fab: HTMLElement, botonAbrir?: HTMLElement,
 *           asignatura: Object, temas: Array<{ id, titulo }> }} opciones
 */
export async function montarTutor({ panel, fab, botonAbrir, asignatura, temas }) {
  let enviando = false;
  let restantes = null;
  const clave = `tutor:${usuarioActual()?.id || 'anonimo'}:${asignatura.id}`;
  const conversacion = leerConversacion(clave) || { temaId: temas[0]?.id || '', mensajes: [] };

  // ---------- Estructura ----------
  const mensajes = el('div', { class: 'tutor__mensajes', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversación con el tutor', tabindex: '0' });
  const sugerencias = el('div', { class: 'tutor__sugerencias', role: 'group', 'aria-label': 'Preguntas sugeridas' });
  const enfoque = el('select', { id: 'tutor-enfoque' },
    ...temas.map((t) => el('option', { value: t.id, texto: t.titulo })));
  const entrada = el('textarea', {
    id: 'tutor-entrada', class: 'tutor__entrada', rows: '1', maxlength: String(MAX_MENSAJE),
    placeholder: 'Escribe tu duda o tu respuesta…', 'aria-describedby': 'tutor-ayuda'
  });
  const enviar = el('button', { type: 'submit', class: 'btn btn--primario tutor__enviar', 'aria-label': 'Enviar mensaje', texto: '➤' });
  const pie = el('p', { class: 'tutor__pie', id: 'tutor-ayuda' });
  const formulario = el('form', { class: 'tutor__form', novalidate: true },
    el('label', { for: 'tutor-entrada', class: 'sr-only', texto: 'Mensaje para el tutor (Enter envía, Mayúsculas + Enter hace un salto de línea)' }),
    entrada, enviar);

  panel.replaceChildren(
    el('header', { class: 'tutor__cabecera' },
      el('span', { class: 'tutor__avatar', 'aria-hidden': 'true', texto: '🦉' }),
      el('div', { class: 'tutor__identidad' },
        el('h2', { class: 'tutor__titulo', id: 'tutor-titulo', texto: 'Tutor socrático' }),
        el('p', { class: 'tutor__subtitulo', texto: `Te guía con preguntas · ${asignatura.nombre}`, title: asignatura.nombre })),
      el('button', { type: 'button', class: 'tutor__boton-cabecera', texto: '↺ Nueva', 'aria-label': 'Empezar una conversación nueva', onclick: nuevaConversacion }),
      el('button', { type: 'button', class: 'tutor__boton-cabecera tutor__cerrar', texto: '✕', 'aria-label': 'Cerrar el tutor', onclick: cerrar })),
    el('div', { class: 'tutor__enfoque' }, el('label', { for: 'tutor-enfoque', texto: 'Tema' }), enfoque),
    mensajes, sugerencias, formulario, pie);
  panel.hidden = false;
  fab.hidden = false;
  if (botonAbrir) botonAbrir.closest('[hidden]')?.removeAttribute('hidden');

  // ---------- Mensajes ----------
  function agregar(rol, texto, extra = {}) {
    const burbuja = el('div', { class: `tutor__mensaje tutor__mensaje--${rol}${extra.error ? ' tutor__mensaje--error' : ''}` });
    if (rol === 'tutor') {
      burbuja.append(el('span', { class: 'tutor__autor', texto: 'Tutor' }));
      const cuerpo = el('div');
      cuerpo.innerHTML = util.formatoBasico(texto);   // escapa el HTML y aplica negritas/listas
      burbuja.append(cuerpo);
    } else {
      if (rol === 'usuario') burbuja.append(el('span', { class: 'sr-only', texto: 'Tú: ' }));
      burbuja.append(document.createTextNode(texto));
    }
    mensajes.append(burbuja);
    mensajes.scrollTop = mensajes.scrollHeight;
    return burbuja;
  }

  function bienvenida() {
    agregar('tutor', temas.length
      ? `¡Hola! Soy tu tutor de **${asignatura.nombre}**. No te daré las respuestas de inmediato: te haré preguntas y te daré pistas para que llegues tú a la idea. Elige el tema arriba y cuéntame tu duda.`
      : `¡Hola! Soy tu tutor de **${asignatura.nombre}**. Esta asignatura aún no tiene temas publicados; vuelve cuando tu docente los publique.`);
  }

  function pintarSugerencias(visibles) {
    sugerencias.hidden = !visibles;
    if (!visibles) return;
    const tema = temas.find((t) => t.id === enfoque.value);
    const opciones = tema ? [
      `Ayúdame a entender «${tema.titulo}»`,
      `Hazme una pregunta para comprobar lo que sé de «${tema.titulo}»`,
      'Dame una pista para empezar a estudiar este tema',
      'Explícame un concepto con un ejemplo cotidiano'
    ] : [];
    sugerencias.replaceChildren(...opciones.map((texto) =>
      el('button', { type: 'button', class: 'tutor__sugerencia', texto, onclick: () => mandar(texto) })));
  }

  function actualizarPie() {
    const base = 'Respuestas generadas por IA: contrástalas con el material del curso.';
    pie.textContent = restantes === null ? base : `${base} Te quedan ${restantes} mensajes hoy.`;
    const agotado = restantes === 0;
    const sinTemas = !temas.length;
    entrada.disabled = agotado || enviando || sinTemas;
    enviar.disabled = agotado || enviando || sinTemas;
    if (agotado) entrada.placeholder = 'Alcanzaste el límite de mensajes de hoy. Vuelve mañana.';
  }

  function ajustarAltura() {
    entrada.style.height = 'auto';
    entrada.style.height = `${entrada.scrollHeight}px`;
  }

  // ---------- Envío ----------
  async function actualizarRestantes() {
    try {
      restantes = (await api.llamar('GET', '/api/ia/restantes?tarea=tutor')).restantes;
    } catch {
      // Si falla, se mantiene el valor anterior
    }
  }

  async function mandar(texto) {
    texto = String(texto || '').trim();
    if (!texto || enviando || restantes === 0 || !enfoque.value) return;
    enviando = true;
    actualizarPie();
    pintarSugerencias(false);

    const propia = agregar('usuario', texto);
    entrada.value = '';
    ajustarAltura();
    const escribiendo = el('div', { class: 'tutor__mensaje tutor__mensaje--tutor' },
      el('span', { class: 'sr-only', texto: 'El tutor está escribiendo…' }),
      el('span', { class: 'tutor__escribiendo', 'aria-hidden': 'true' }, el('span'), el('span'), el('span')));
    mensajes.append(escribiendo);
    mensajes.scrollTop = mensajes.scrollHeight;

    try {
      // El navegador envía solo datos: el tema y los últimos mensajes (el último es la pregunta)
      const historial = [...conversacion.mensajes, { rol: 'estudiante', texto }].slice(-MAX_HISTORIAL);
      const r = await api.ia('tutor', { temaId: enfoque.value, historial });
      escribiendo.remove();
      agregar('tutor', r.respuesta);
      conversacion.mensajes.push({ rol: 'estudiante', texto }, { rol: 'tutor', texto: r.respuesta });
      conversacion.temaId = enfoque.value;
      guardarConversacion(clave, conversacion);
      await actualizarRestantes();
    } catch (err) {
      escribiendo.remove();
      propia.remove();
      entrada.value = texto;   // se devuelve el texto para reintentar
      ajustarAltura();
      agregar('sistema', `No se pudo enviar: ${err.message}`, { error: true });
    } finally {
      enviando = false;
      actualizarPie();
      if (!entrada.disabled) entrada.focus();
    }
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    mandar(entrada.value);
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      mandar(entrada.value);
    }
  });
  entrada.addEventListener('input', ajustarAltura);
  enfoque.addEventListener('change', () => {
    const tema = temas.find((t) => t.id === enfoque.value);
    conversacion.temaId = enfoque.value;
    guardarConversacion(clave, conversacion);
    if (tema) agregar('sistema', `Tema: «${tema.titulo}». El tutor se centrará en este tema.`);
  });

  async function nuevaConversacion() {
    if (conversacion.mensajes.length
      && !(await ui.confirmar('¿Empezar una conversación nueva? El tutor olvidará lo que hablaron.'))) return;
    conversacion.mensajes = [];
    guardarConversacion(clave, conversacion);
    mensajes.replaceChildren();
    bienvenida();
    pintarSugerencias(true);
    entrada.focus();
  }

  // ---------- Abrir y cerrar (pantallas pequeñas) ----------
  function abrir() {
    if (!ESCRITORIO.matches) {
      panel.classList.add('tutor--abierto');
      fab.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', alEscape);
    } else {
      panel.scrollIntoView({ block: 'nearest' });
    }
    if (!entrada.disabled) entrada.focus();
  }

  function cerrar() {
    panel.classList.remove('tutor--abierto');
    fab.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', alEscape);
    fab.focus();
  }

  function alEscape(e) {
    if (e.key === 'Escape' && !document.querySelector('.modal-fondo')) cerrar();
  }

  fab.addEventListener('click', abrir);
  botonAbrir?.addEventListener('click', abrir);
  ESCRITORIO.addEventListener('change', (e) => { if (e.matches) cerrar(); });

  // ---------- Conversación guardada en esta pestaña ----------
  if (temas.some((t) => t.id === conversacion.temaId)) enfoque.value = conversacion.temaId;
  bienvenida();
  conversacion.mensajes.forEach((m) => agregar(m.rol === 'tutor' ? 'tutor' : 'usuario', m.texto));
  pintarSugerencias(conversacion.mensajes.length === 0 && temas.length > 0);
  await actualizarRestantes();
  actualizarPie();
}
