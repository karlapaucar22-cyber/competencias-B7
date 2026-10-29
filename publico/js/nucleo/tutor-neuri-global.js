// Chat socrático dentro del único panel global de Neuri.

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';
import { decir, abrirAvatar } from './avatar.js';
import {
  agregarHistorialTutor, guardarHistorialTutor, historialParaApi,
  leerHistorialTutor, limpiarHistorialTutor
} from './historial-tutor.js';

const MAX_MENSAJE = 1000;
const CLAVE_CONTEXTO = 'neuri.tutor.contexto';
const RUTA_ACTIVIDAD = {
  '/paginas/explorar.html': ['explora', 'm1'],
  '/paginas/autodiagnostico-musical.html': ['autodiagnostico', 'm1'],
  '/paginas/recurso-neurociencia.html': ['tema', 'm1'],
  '/paginas/canciones.html': ['canciones', 'm2'],
  '/paginas/pareja.html': ['juego', 'm2'],
  '/paginas/ahorcado.html': ['juego', 'm1'],
  '/paginas/crucigrama.html': ['juego', 'm1'],
  '/paginas/sopa-letras.html': ['juego', 'm1'],
  '/paginas/quiz.html': ['juego', 'm1'],
  '/paginas/simulador.html': ['juego', 'm1'],
  '/paginas/agenda.html': ['agenda', 'm3'],
  '/paginas/foros.html': ['foro', 'm3'],
  '/paginas/hilo.html': ['foro', 'm3']
};

const crear = (etiqueta, clase = '', texto = '') => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
};

const leerContextoGuardado = () => {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO) || 'null'); } catch { return null; }
};
const guardarContexto = (contexto) => {
  try { sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify({ temaId: contexto.temaId, misionId: contexto.misionId })); } catch { /* opcional */ }
};

export async function montarTutorNeuriGlobal({ raiz } = {}) {
  if (!raiz || location.pathname.endsWith('/tutor.html') || raiz.querySelector('.avatar-tutor')) return;

  let temas = [];
  let experiencia = null;
  let contexto = null;
  let historial = leerHistorialTutor();
  let enviando = false;
  let temporizadorContexto = null;

  const seccion = crear('section', 'avatar-tutor');
  seccion.setAttribute('aria-label', 'Chat socrático con Neuri');
  seccion.innerHTML = `
    <div class="avatar-tutor__cabecera">
      <div><p class="avatar-tutor__titulo">Tutor socrático</p><p class="avatar-tutor__contexto" role="status"></p></div>
      <button type="button" class="avatar-guia__boton avatar-tutor__nueva" aria-label="Empezar una conversación nueva">↺ Nueva</button>
    </div>
    <div class="avatar-tutor__mensajes tutor__mensajes" role="log" aria-live="polite" aria-relevant="additions" tabindex="0"></div>
    <div class="avatar-tutor__sugerencias tutor__sugerencias" role="group" aria-label="Ayudas de Neuri"></div>
    <form class="avatar-tutor__form tutor__form">
      <label class="sr-only" for="avatar-tutor-entrada">Escribe tu duda o tu respuesta para Neuri</label>
      <textarea id="avatar-tutor-entrada" class="tutor__entrada" rows="1" maxlength="${MAX_MENSAJE}" placeholder="Escribe tu duda o tu respuesta…"></textarea>
      <button type="submit" class="btn btn--primario tutor__enviar" aria-label="Enviar mensaje a Neuri">➤</button>
    </form>
    <p class="avatar-tutor__pie tutor__pie">Neuri orienta con preguntas y no modifica tus calificaciones.</p>`;
  raiz.querySelector('.avatar-guia__globo').insertAdjacentElement('afterend', seccion);

  const mensajes = seccion.querySelector('.avatar-tutor__mensajes');
  const sugerencias = seccion.querySelector('.avatar-tutor__sugerencias');
  const entrada = seccion.querySelector('textarea');
  const enviarBoton = seccion.querySelector('[type="submit"]');
  const contextoTexto = seccion.querySelector('.avatar-tutor__contexto');
  const pie = seccion.querySelector('.avatar-tutor__pie');

  function agregarBurbuja(rol, texto, { error = false } = {}) {
    const visual = rol === 'estudiante' ? 'usuario' : rol;
    const burbuja = crear('div', `tutor__mensaje tutor__mensaje--${visual}${error ? ' tutor__mensaje--error' : ''}`);
    if (rol === 'tutor') {
      burbuja.append(crear('span', 'tutor__autor', 'Neuri'));
      const cuerpo = crear('div');
      cuerpo.innerHTML = util.formatoBasico(texto);
      burbuja.append(cuerpo);
    } else {
      burbuja.append(document.createTextNode(texto));
    }
    mensajes.append(burbuja);
    mensajes.scrollTop = mensajes.scrollHeight;
    return burbuja;
  }

  function pintarHistorial() {
    mensajes.replaceChildren();
    if (!historial.length) {
      agregarBurbuja('tutor', 'Cuéntame qué estás intentando comprender. Te ayudaré con una pregunta y pistas graduales, sin resolverlo por ti.');
      return;
    }
    historial.slice(-20).forEach((mensaje) => agregarBurbuja(mensaje.rol, mensaje.texto));
  }

  function misionPorId(id) {
    return experiencia?.misiones?.find((mision) => mision.id === id) || null;
  }

  function resolverContexto() {
    const url = new URL(location.href);
    const ruta = url.pathname === '/' ? '/index.html' : url.pathname;
    const hashMision = /^#mision-(m[1-3])$/.exec(url.hash)?.[1];
    const [actividadRuta = 'general', misionRuta = ''] = RUTA_ACTIVIDAD[ruta] || [];
    const misionId = hashMision || (ruta === '/index.html' && url.hash === '#actividad' ? leerContextoGuardado()?.misionId : '') || misionRuta;
    const mision = misionPorId(misionId);
    const explicito = url.searchParams.get('temaId') || (ruta.endsWith('/tema.html') ? url.searchParams.get('id') : '');
    const guardado = leerContextoGuardado();
    const candidatos = [explicito, mision?.temaId, guardado?.temaId, experiencia?.misiones?.[0]?.temaId, temas[0]?.id].filter(Boolean);
    const tema = candidatos.map((id) => temas.find((t) => t.id === id)).find(Boolean) || null;
    const itemId = ruta === '/index.html' ? document.querySelector('#vista h2[id^="titulo-"]')?.id.replace('titulo-', '') || '' : '';
    const tituloItem = itemId ? document.getElementById(`titulo-${itemId}`)?.textContent?.trim() : '';
    const actividad = mision ? 'mision' : actividadRuta;
    const etiqueta = [mision ? `Misión ${mision.numero}: ${mision.titulo}` : '', tituloItem, !mision && tema ? tema.titulo : ''].filter(Boolean).join(' · ');
    return { temaId: tema?.id || '', tituloTema: tema?.titulo || '', misionId: mision?.id || '', itemId, actividad, etiqueta: etiqueta || 'Contenido general de NeuroRitmo' };
  }

  function pintarSugerencias() {
    const opciones = contexto?.temaId
      ? ['Ayúdame a empezar', 'Necesito otra pista', 'Comprueba lo que entendí']
      : [];
    sugerencias.replaceChildren(...opciones.map((texto) => {
      const boton = crear('button', 'tutor__sugerencia', texto);
      boton.type = 'button';
      boton.addEventListener('click', () => enviar(texto));
      return boton;
    }));
  }

  function actualizarContexto() {
    const anterior = contexto?.etiqueta;
    contexto = resolverContexto();
    contextoTexto.textContent = contexto.temaId ? `Ahora: ${contexto.etiqueta}` : 'No hay un tema publicado disponible en esta pantalla.';
    entrada.disabled = enviando || !contexto.temaId;
    enviarBoton.disabled = enviando || !contexto.temaId;
    if (contexto.temaId) guardarContexto(contexto);
    pintarSugerencias();
    if (anterior && anterior !== contexto.etiqueta) agregarBurbuja('sistema', `Cambiaste de contexto: ${contexto.etiqueta}. La conversación anterior se conserva.`);
  }

  function ajustarEntrada() {
    entrada.style.height = 'auto';
    entrada.style.height = `${entrada.scrollHeight}px`;
  }

  async function enviar(texto) {
    texto = String(texto || '').trim();
    if (!texto || enviando) return;
    actualizarContexto();
    if (!contexto.temaId) return;
    if (texto.length > MAX_MENSAJE) {
      ui.aviso(`Tu mensaje puede tener hasta ${MAX_MENSAJE.toLocaleString('es-EC')} caracteres.`, 'error');
      return;
    }

    enviando = true;
    entrada.disabled = true;
    enviarBoton.disabled = true;
    historial = agregarHistorialTutor(historial, 'estudiante', texto, contexto);
    const propia = agregarBurbuja('estudiante', texto);
    entrada.value = '';
    ajustarEntrada();
    const pensando = agregarBurbuja('sistema', 'Neuri está pensando…');

    try {
      const respuesta = await api.ia('tutor', {
        temaId: contexto.temaId,
        contexto: { misionId: contexto.misionId, itemId: contexto.itemId, actividad: contexto.actividad },
        historial: historialParaApi(historial)
      });
      pensando.remove();
      historial = agregarHistorialTutor(historial, 'tutor', respuesta.respuesta, contexto);
      agregarBurbuja('tutor', respuesta.respuesta);
      decir(respuesta.respuesta.replace(/\*\*/g, ''), { soloVoz: true });
    } catch (error) {
      pensando.remove();
      propia.remove();
      historial = guardarHistorialTutor(historial.slice(0, -1));
      entrada.value = texto;
      ajustarEntrada();
      agregarBurbuja('sistema', error.estado === 429
        ? 'Llegaste al límite diario del tutor. Tu conversación queda guardada para continuar después.'
        : `No se pudo consultar a Neuri: ${error.message}`, { error: true });
    } finally {
      enviando = false;
      actualizarContexto();
      if (!entrada.disabled) entrada.focus();
    }
  }

  seccion.querySelector('form').addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviar(entrada.value);
  });
  entrada.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      enviar(entrada.value);
    }
  });
  entrada.addEventListener('input', ajustarEntrada);
  seccion.querySelector('.avatar-tutor__nueva').addEventListener('click', async () => {
    if (historial.length && !(await ui.confirmar('¿Empezar una conversación nueva con Neuri?'))) return;
    historial = [];
    limpiarHistorialTutor();
    pintarHistorial();
    entrada.focus();
  });

  try {
    [temas, experiencia] = await Promise.all([
      api.listar('temas'),
      api.llamar('GET', '/api/neuroritmo').then((r) => r.experiencia).catch(() => null)
    ]);
    temas = (temas || []).filter((tema) => tema.estado === 'publicado');
  } catch (error) {
    pie.textContent = `Neuri no pudo cargar el contexto: ${error.message}`;
  }

  pintarHistorial();
  actualizarContexto();
  window.addEventListener('hashchange', () => {
    clearTimeout(temporizadorContexto);
    temporizadorContexto = setTimeout(actualizarContexto, 80);
  });
  const vista = document.getElementById('vista');
  if (vista) new MutationObserver(() => {
    clearTimeout(temporizadorContexto);
    temporizadorContexto = setTimeout(actualizarContexto, 120);
  }).observe(vista, { childList: true, subtree: true });
}

export function abrirTutorNeuriGlobal() {
  abrirAvatar();
  document.querySelector('.avatar-tutor textarea:not(:disabled)')?.focus();
}

