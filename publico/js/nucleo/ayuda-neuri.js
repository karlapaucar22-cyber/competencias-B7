// publico/js/nucleo/ayuda-neuri.js
// Neuri en las actividades complementarias: «Necesito una pista» (pregunta orientadora → pista conceptual →
// ejemplo paralelo) y «Explícame el error». Usa la tarea de IA neuri-actividad del servidor; sin servicio
// o sin conexión muestra pistas predefinidas rotuladas como «sin IA». No cuenta para las misiones de NeuroRitmo.

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';
import { usuarioActual } from './sesion.js';

export const NIVELES = { 1: 'Pregunta orientadora', 2: 'Pista conceptual', 3: 'Ejemplo paralelo' };

// Pistas predefinidas (sin IA) por actividad y nivel; «error» para «Explícame el error»
const PREDEFINIDAS = {
  ahorcado: {
    1: '¿Qué proceso o estructura describe la pista visible? Nómbralo primero con tus palabras.',
    2: 'Relaciona la pista con la definición del glosario del tema: busca la idea central, no la palabra exacta.',
    3: 'Piensa en otra materia: si la pista dijera «órgano que bombea la sangre», buscarías un concepto, no letras sueltas. Haz lo mismo aquí.',
    error: 'Las letras falladas te dicen qué no contiene la palabra. ¿Qué concepto del tema encaja con la pista y con las letras que ya acertaste?'
  },
  pareja: {
    1: '¿Qué palabra clave del término podría aparecer, con otras palabras, en su definición?',
    2: 'Fíjate en la función que describe cada definición (procesar, regular, recordar…) y en qué término cumple esa función.',
    3: 'Como en «corazón – bombea sangre», une cada término con lo que hace o es, no con lo que suena parecido.',
    error: 'Esa definición describe otro concepto. ¿Qué rasgo de la definición no coincide con el término que elegiste?'
  },
  'sopa-letras': {
    1: '¿Qué significa la palabra que buscas? Recordarlo te ayuda a reconocerla en la grilla.',
    2: 'Busca primero la letra inicial y revisa las ocho direcciones posibles a su alrededor.',
    3: 'Igual que al buscar un nombre en una lista, recorre la grilla fila por fila fijándote solo en la primera letra.',
    error: 'Las letras seleccionadas no forman una palabra de la lista. ¿Tu selección empieza y termina en la letra correcta y sigue una sola dirección?'
  },
  crucigrama: {
    1: '¿Qué concepto del tema describe la pista? Cuenta las letras y piensa en términos del glosario.',
    2: 'Usa las letras que se cruzan con otras palabras: limitan las opciones posibles.',
    3: 'En otro tema, «célula que transmite impulsos (7)» llevaría a pensar en el concepto antes que en las letras. Aplícalo a esta pista.',
    error: 'Alguna letra no corresponde. ¿La palabra que escribiste describe exactamente lo que dice la pista o un concepto cercano?'
  },
  quiz: {
    1: '¿Qué te pide exactamente el enunciado: recordar, comparar o aplicar un concepto?',
    2: 'Identifica el concepto del tema al que se refiere la pregunta y descarta las opciones que hablan de otro proceso.',
    3: 'Piensa en una situación distinta con el mismo concepto y comprueba si cada opción seguiría siendo verdadera allí.',
    error: 'Lee la retroalimentación y compárala con tu respuesta: ¿qué condición del enunciado no consideraste?'
  },
  simulador: {
    1: '¿Qué necesita la situación para que el aprendizaje mejore: atención, memoria o autorregulación?',
    2: 'Valora cada decisión según su efecto en los estudiantes y en el concepto del tema, no solo según su comodidad.',
    3: 'Si fueras tú quien aprende algo difícil, ¿qué condición del ambiente te ayudaría más? Usa esa idea en esta escena.',
    error: 'Revisa la consecuencia de tu decisión: ¿qué efecto tuvo en el aprendizaje y qué otra condición podrías priorizar?'
  }
};

const MOTIVOS = {
  429: 'Alcanzaste el límite diario de consultas a la IA.',
  sinConexion: 'No hay conexión a internet.',
  servicio: 'El servicio de IA no está disponible en este momento.'
};

/**
 * Inserta el panel de Neuri antes de `antesDe` (solo para estudiantes; los demás roles no lo ven).
 * @param {{ actividad: string, antesDe: HTMLElement,
 *   contexto: (modo: "pista" | "error") => ({ clave: string, datos: object } | string) }} opciones
 *   contexto devuelve los identificadores del juego o un texto con el motivo por el que aún no aplica.
 * @returns {{ reiniciar(): void } | null}
 */
export function montarAyudaNeuri({ actividad, antesDe, contexto }) {
  if (usuarioActual()?.rol !== 'estudiante' || !antesDe) return null;
  const predefinidas = PREDEFINIDAS[actividad];
  const panel = document.createElement('section');
  panel.className = 'ayuda-neuri';
  panel.setAttribute('aria-labelledby', 'tituloAyudaNeuri');
  panel.innerHTML = `
    <h2 id="tituloAyudaNeuri" class="ayuda-neuri__titulo">🤖 Pregúntale a Neuri</h2>
    <p class="ayuda-neuri__nota">Neuri te orienta con preguntas, sin darte la respuesta. Actividad complementaria: no cuenta para las misiones de NeuroRitmo.</p>
    <div class="ayuda-neuri__acciones">
      <button type="button" class="btn btn--secundario btn--sm" data-modo="pista"></button>
      <button type="button" class="btn btn--secundario btn--sm" data-modo="error">🧐 Explícame el error</button>
    </div>
    <div class="ayuda-neuri__salida" aria-live="polite"></div>`;
  antesDe.before(panel);

  const botonPista = panel.querySelector('[data-modo="pista"]');
  const salida = panel.querySelector('.ayuda-neuri__salida');
  let clave = null;
  let nivel = 1;

  const pintarBoton = () => {
    botonPista.disabled = nivel > 3;
    botonPista.textContent = nivel > 3 ? '💡 Ya viste los tres niveles de pista' : `💡 Necesito una pista · ${NIVELES[nivel]}`;
  };
  const reiniciar = () => {
    clave = null;
    nivel = 1;
    salida.replaceChildren();
    pintarBoton();
  };
  pintarBoton();

  function mostrar({ origen, titulo, texto, motivo = '' }) {
    const caja = document.createElement('div');
    caja.className = `ayuda-neuri__respuesta ayuda-neuri__respuesta--${origen}`;
    caja.dataset.origen = origen;
    caja.innerHTML = `
      ${motivo ? `<p class="ayuda-neuri__nota">${ui.escapar(motivo)} Se usa una pista predefinida (no generada por IA).</p>` : ''}
      <p><strong>${origen === 'ia' ? '🤖 Neuri (IA generativa)' : '📋 Pista predefinida (sin IA)'} · ${ui.escapar(titulo)}:</strong>
        ${origen === 'ia' ? util.formatoBasico(texto) : ui.escapar(texto)}</p>
      ${origen === 'ia' ? '<p class="ayuda-neuri__nota">Neuri es una IA: contrasta su orientación con el material del tema.</p>' : ''}`;
    salida.append(caja);
  }

  async function pedir(modo, boton) {
    const ctx = contexto(modo);
    if (typeof ctx === 'string' || !ctx) {
      ui.aviso(ctx || 'Neuri todavía no puede ayudarte en este punto.', 'info');
      return;
    }
    // Los niveles de pista avanzan por ítem y vuelven a 1 en el siguiente
    if (ctx.clave !== clave) {
      clave = ctx.clave;
      nivel = 1;
    }
    const nivelPedido = nivel;
    const titulo = modo === 'pista' ? `Nivel ${nivelPedido}: ${NIVELES[nivelPedido]}` : 'Explicación del error';
    const pistaDocente = modo === 'pista' && Array.isArray(ctx.pistas) ? ctx.pistas[nivelPedido - 1] : '';
    const respaldo = pistaDocente || predefinidas?.[modo === 'pista' ? nivelPedido : 'error'] || 'Revisa el contenido del tema y vuelve a intentarlo.';
    const avanzar = () => {
      if (modo === 'pista') nivel++;
      pintarBoton();
    };

    if (!navigator.onLine) {
      mostrar({ origen: 'predefinida', titulo, texto: respaldo, motivo: MOTIVOS.sinConexion });
      return avanzar();
    }
    boton.disabled = true;
    const pensando = Object.assign(document.createElement('p'), { className: 'ayuda-neuri__nota', textContent: 'Neuri está pensando…' });
    salida.append(pensando);
    try {
      const { respuesta } = await api.ia('neuri-actividad', { ...ctx.datos, actividad, modo, ...(modo === 'pista' ? { nivel: nivelPedido } : {}) });
      mostrar({ origen: 'ia', titulo, texto: respuesta });
      avanzar();
    } catch (err) {
      const tareaNoDisponible = err.estado === 404 && /tarea de IA/i.test(err.message || '');
      if ([400, 403, 404, 409].includes(err.estado) && !tareaNoDisponible) {
        ui.aviso(err.message, 'info');
      } else {
        // Límite diario, proveedor caído o red: pista predefinida claramente rotulada
        const motivo = err.estado === 429 ? MOTIVOS[429] : err.estado ? MOTIVOS.servicio : MOTIVOS.sinConexion;
        mostrar({ origen: 'predefinida', titulo, texto: respaldo, motivo });
        avanzar();
      }
    } finally {
      pensando.remove();
      boton.disabled = false;
      pintarBoton();
    }
  }

  panel.querySelectorAll('[data-modo]').forEach((boton) => boton.addEventListener('click', () => pedir(boton.dataset.modo, boton)));
  return { reiniciar };
}
