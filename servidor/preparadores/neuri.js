// servidor/preparadores/neuri.js
// «Pregúntale a Neuri»: pistas graduadas, «Explícame el error» y «Revisa mi borrador» (Misión 3).
// Solo estudiantes con la misión en curso. La respuesta del estudiante se toma de su partida en el servidor;
// no se envían nombres ni datos personales al modelo.

import * as almacen from '../almacen.js';
import { leerExperiencia, misionDe, itemDe, PARTIDAS, exigirDesbloqueada } from '../rutas/neuroritmo.js';
import { revisarDiseno, minutosSecuencia } from '../../publico/js/nucleo/neuroritmo.js';

// Tres niveles de ayuda (también los usa neuri-actividad en las actividades complementarias)
export const AYUDAS = {
  1: 'Pista de nivel 1 (pregunta orientadora): formula una pregunta que lleve a pensar en la demanda de la tarea, sin dar la respuesta.',
  2: 'Pista de nivel 2 (pista conceptual): recuerda el concepto clave con tus palabras y termina con una pregunta; no indiques qué opción elegir.',
  3: 'Pista de nivel 3 (ejemplo paralelo): plantea un ejemplo de otro contexto que use el mismo concepto y pregunta cómo se aplica al caso.'
};
const SONIDOS = { silencio: 'silencio', instrumental: 'música instrumental suave', letra: 'canción con letra' };

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

const corto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Respuesta del estudiante en palabras (sin datos personales)
function describirRespuesta(item, r) {
  if (!r) return 'Aún no responde este ítem.';
  const v = r.valor || {};
  if (item.tipo === 'simulador') {
    const sonido = SONIDOS[v.config?.tipo] || v.config?.tipo;
    return `Configuró ${sonido}${v.config?.volumen ? ` a volumen ${v.config.volumen}` : ''}. Predijo un efecto ${v.prediccion}. Hipótesis: «${v.hipotesis}». El modelo indicó un efecto ${r.retro?.resultado}.`;
  }
  if (item.tipo === 'opcion') return `Eligió: «${item.opciones.find((o) => o.id === v.opcion)?.texto || ''}».`;
  if (item.tipo === 'parejas') return `Formó las parejas con ${v.errores} intentos fallidos.`;
  if (item.tipo === 'cancion') {
    return `Completó la canción con: ${Object.entries(v.palabras || {}).map(([k, p]) => `${k}) «${p}» ${r.retro?.porPalabra?.[k] ? '(correcta)' : '(por revisar)'}`).join(', ')}.`;
  }
  return '';
}

function baseDe(mision, item, experiencia) {
  const recurso = experiencia.recursos?.[item.recurso];
  return [
    `Concepto objetivo: ${item.concepto}.`,
    item.explicacion || item.pistas?.[1] || '',
    mision.aviso || '',
    recurso ? `Recurso del curso: «${recurso.titulo}» (${recurso.formato}).` : ''
  ].filter(Boolean).join(' ');
}

/**
 * Política de uso progresivo de la IA por misión (neuroritmo.json → ia.misiones): modos y primer intento.
 * Lanza 400/403 si la ayuda pedida no corresponde. La usan también neuri-borrador y la interfaz.
 */
export function exigirPolitica(experiencia, mision, modo, numeroIntento) {
  const politica = experiencia.ia?.misiones?.[mision.id];
  if (!politica || !politica.modos.includes(modo)) {
    if (mision.id === 'm3') rechazar('En la Misión 3 usa «Revisa mi borrador»', 400);
    rechazar(`En la Misión ${mision.numero} Neuri ofrece: ${politica?.descripcion || 'pistas del docente'}`, 400);
  }
  if (Number(numeroIntento) < Number(politica.desdeIntento || 1)) {
    rechazar(`En tu primer intento de la Misión ${mision.numero}, Neuri te orienta con las pistas del docente. La IA se habilita desde tu intento ${politica.desdeIntento}.`, 403);
  }
  return politica;
}

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Textos que la respuesta de la IA no puede contener: la opción con puntaje completo y las palabras
 * faltantes de la canción (el control lo aplica esquemas-ia.js antes de responder).
 */
export function solucionesDe(item) {
  if (item.tipo === 'opcion') return item.opciones.filter((o) => o.puntos >= 15).map((o) => sinTildes(o.texto).slice(0, 60));
  if (item.tipo === 'cancion') return Object.values(item.huecos || {}).map(sinTildes);
  return [];
}

export default async function preparar(datos, usuario) {
  if (usuario?.rol !== 'estudiante') rechazar('Neuri acompaña a los estudiantes durante las misiones', 403);
  const experiencia = await leerExperiencia();
  const mision = misionDe(experiencia, String(datos.mision || ''));
  const item = itemDe(mision, String(datos.item || ''));
  const modo = datos.modo;
  if (!['pista', 'error', 'borrador'].includes(modo)) rechazar('Tipo de ayuda inválido', 400);

  await exigirDesbloqueada(usuario.id, mision.id, experiencia);
  const partida = (await almacen.leer(PARTIDAS)).find((p) => p.usuarioId === usuario.id && p.mision === mision.id && p.estado === 'en-curso');
  if (!partida) rechazar('Inicia la misión para pedir ayuda a Neuri', 409);
  // Uso progresivo de la IA (Tarea 3): M1 desde el segundo intento; M2 pistas y ejemplos; M3 solo el borrador
  exigirPolitica(experiencia, mision, modo, partida.numero);

  let ayuda, respuesta = '', texto = '', cotejo = '';
  if (modo === 'pista') {
    const nivel = Number(datos.nivel);
    if (!AYUDAS[nivel]) rechazar('El nivel de pista debe ser 1, 2 o 3', 400);
    ayuda = AYUDAS[nivel];
    respuesta = describirRespuesta(item, partida.respuestas?.[item.id]);
  } else if (modo === 'error') {
    if (mision.id === 'm3') rechazar('En la Misión 3 usa «Revisa mi borrador»', 400);
    const r = partida.respuestas?.[item.id];
    if (!r) rechazar('Responde el ítem antes de pedir que Neuri explique el error', 400);
    if (r.retro?.nivel === 'completo') rechazar('Tu respuesta ya es completa: no hay error que explicar', 400);
    ayuda = 'Explícame el error: reconoce lo que tiene sentido de la respuesta, señala qué condición o concepto no consideró y termina con una pregunta que le permita corregir por sí mismo. No digas cuál es la opción correcta.';
    respuesta = describirRespuesta(item, r);
    texto = corto(datos.justificacion, 600);
  } else {
    if (mision.id !== 'm3') rechazar('«Revisa mi borrador» está disponible en la Misión 3', 400);
    const b = datos.borrador && typeof datos.borrador === 'object' ? datos.borrador : {};
    const borrador = {
      objetivo: corto(b.objetivo, 600),
      recurso: { tipo: corto(b.recurso?.tipo, 30), letra: corto(b.recurso?.letra, 5), volumen: corto(b.recurso?.volumen, 10), duracion: Number(b.recurso?.duracion) || 0 },
      secuencia: (Array.isArray(b.secuencia) ? b.secuencia : []).filter((id) => mision.bloques.some((x) => x.id === id)).slice(0, 7),
      instrucciones: corto(b.instrucciones, 1200), comprobacion: corto(b.comprobacion, 600), indicador: corto(b.indicador, 300),
      justificacion: corto(b.justificacion, 2000), diferencias: corto(b.diferencias, 1000)
    };
    if (!borrador.objetivo && !borrador.justificacion) rechazar('Escribe al menos el objetivo o la justificación para que Neuri revise tu borrador', 400);
    const recurso = mision.recursosSonoros.find((s) => s.id === borrador.recurso.tipo)?.texto || 'sin definir';
    ayuda = 'Revisa mi borrador: señala UNA fortaleza y DOS aspectos de mejora vinculados con la lista de cotejo, como preguntas o sugerencias breves. '
      + 'Prioriza los criterios marcados con ✖; si todos tienen ✔, no los cuestiones: propone mejoras de calidad (coherencia con los conceptos, claridad de las instrucciones o profundidad de la justificación). '
      + 'No asignes puntaje ni digas si está aprobado: eso lo decide el docente.';
    texto = [
      `Objetivo: ${borrador.objetivo || '(vacío)'}`,
      `Recurso sonoro: ${recurso}; letra: ${borrador.recurso.letra || '-'}; volumen: ${borrador.recurso.volumen || '-'}; duración: ${borrador.recurso.duracion} min`,
      `Secuencia (${minutosSecuencia(borrador.secuencia, mision.bloques)} min): ${borrador.secuencia.map((id) => mision.bloques.find((x) => x.id === id)?.texto).join(' → ') || '(vacía)'}`,
      `Instrucciones: ${borrador.instrucciones || '(vacío)'}`,
      `Comprobación: ${borrador.comprobacion || '(vacío)'}`,
      `Indicador de autorregulación: ${borrador.indicador || '(vacío)'}`,
      `Justificación: ${borrador.justificacion || '(vacío)'}`,
      `Diferencias individuales: ${borrador.diferencias || '(vacío)'}`
    ].join('\n');
    cotejo = revisarDiseno(borrador, mision.bloques).map((c) => `${c.cumple ? '✔' : '✖'} ${c.texto}`).join('\n');
  }

  // El uso de la IA queda registrado (sin textos) para que el docente vea qué conceptos generan dudas
  await almacen.actualizar(PARTIDAS, partida.id, {
    ia: { ...(partida.ia || {}), [item.id]: (Number(partida.ia?.[item.id]) || 0) + 1 },
    solicitudes: [...(partida.solicitudes || []), { tipo: modo, item: item.id, ...(modo === 'pista' ? { nivel: Number(datos.nivel) } : {}), fecha: new Date().toISOString() }]
  });

  return {
    mision: `Misión ${mision.numero}: ${mision.titulo} (nivel ${mision.nivel})`,
    item: item.titulo || 'Diseño de la microactividad',
    concepto: item.concepto,
    situacion: item.situacion || mision.caso || '',
    base: mision.id === 'm3' ? `${mision.instrucciones} ${mision.pistas[1]}` : baseDe(mision, item, experiencia),
    ayuda,
    respuesta: respuesta || 'No aplica.',
    texto: texto || 'No aplica.',
    cotejo: cotejo || 'No aplica.',
    intento: String(partida.numero),
    // Control de salida (no llega al modelo): longitud y soluciones que no se pueden revelar
    __control: {
      maxPalabras: Number(experiencia.ia?.maxPalabras) || 90,
      minFrases: 2,
      maxFrases: 4,
      preguntas: 1,
      prohibidos: solucionesDe(item)
    }
  };
}
