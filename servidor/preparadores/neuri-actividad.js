// servidor/preparadores/neuri-actividad.js
// Neuri en las actividades complementarias (ahorcado, pareja, sopa de letras, crucigrama, quiz y simulador):
// «Necesito una pista» (tres niveles) y «Explícame el error». Es independiente de las tres misiones
// evaluadas de NeuroRitmo: no lee ni escribe sus partidas. El navegador solo envía identificadores y el
// estado mínimo del juego; el contenido, la solución y los permisos se toman del servidor.

import * as almacen from '../almacen.js';
import { temaDelUsuario } from './tutor.js';
import { AYUDAS } from './neuri.js';
import { filtrarLista } from '../ganchos/simulaciones.js';
import { normalizar } from '../../publico/js/nucleo/util.js';

export const ACTIVIDADES = {
  ahorcado: 'Ahorcado',
  pareja: 'Encuentra la pareja',
  'sopa-letras': 'Sopa de letras',
  crucigrama: 'Crucigrama',
  quiz: 'Quiz por niveles',
  simulador: 'Simulador de escenarios'
};
const ERROR = 'Explícame el error: reconoce lo que tiene sentido del intento, señala qué rasgo del concepto no consideró y termina con una pregunta para que corrija por sí mismo.';
const MAX_BASE = 1500;

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const letras = (v, max) => normalizar(typeof v === 'string' ? v : '').replace(/[^A-ZÑ]/g, '').slice(0, max);
// Fragmento inicial de un texto que la IA no debe citar (definición u opción correcta)
const fragmento = (t, palabras = 6) => sinTildes(t).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, palabras).join(' ');

async function terminoDe(tema, id) {
  const t = (await almacen.leer('glosario')).find((g) => g.id === id && g.temaId === tema.id && g.estado === 'aprobado');
  if (!t) rechazar('Ese término no pertenece al glosario del tema', 404);
  return t;
}

// ---------- Contexto por actividad: { item, situacion, base, respuesta, prohibidos } ----------

async function ahorcado(tema, datos, modo) {
  const t = await terminoDe(tema, datos.terminoId);
  const acertadas = [...new Set(letras(datos.acertadas, 27))].join(', ');
  const erradas = [...new Set(letras(datos.erradas, 27))].join(', ');
  if (modo === 'error' && !erradas) rechazar('Aún no tienes letras falladas en esta palabra', 400);
  return {
    item: `Palabra oculta de ${normalizar(t.termino).length} letras`,
    situacion: `Adivina la palabra del glosario letra por letra. Pista visible: «${t.pista || 'sin pista'}».`,
    base: t.definicion,
    respuesta: `Letras acertadas: ${acertadas || 'ninguna'}. Letras que no están: ${erradas || 'ninguna'}.`,
    prohibidos: [sinTildes(t.termino)]
  };
}

async function pareja(tema, datos, modo) {
  const t = await terminoDe(tema, datos.terminoId);
  const base = {
    situacion: 'Relaciona cada término del glosario con su definición volteando tarjetas.',
    // Los términos son visibles; lo que no se revela es qué definición le corresponde
    prohibidos: [fragmento(t.definicion)]
  };
  if (modo === 'pista') {
    return { ...base, item: `Término «${t.termino}»`, base: t.definicion, respuesta: 'Busca la definición de este término.' };
  }
  const otro = await terminoDe(tema, datos.otroId);
  if (otro.id === t.id) rechazar('Esas dos tarjetas sí forman pareja', 400);
  // Sin el nombre del otro término: decir a qué concepto pertenece la definición revelaría otra pareja
  return {
    ...base,
    item: `Término «${t.termino}»`,
    base: `${t.termino}: ${t.definicion}`,
    respuesta: `Intentó unir el término «${t.termino}» con esta definición, que corresponde a otro concepto: «${otro.definicion}».`,
    prohibidos: [fragmento(t.definicion), fragmento(otro.definicion), sinTildes(otro.termino)]
  };
}

async function sopaLetras(tema, datos, modo) {
  const t = await terminoDe(tema, datos.terminoId);
  const seleccion = letras(datos.seleccion, 20);
  if (modo === 'error' && seleccion.length < 3) rechazar('Selecciona al menos tres letras antes de pedir que Neuri explique el error', 400);
  return {
    item: `Palabra «${t.termino}» de la lista`,
    // El servidor no conoce la grilla: Neuri no puede revelar la ubicación
    situacion: 'Encuentra en la grilla las palabras de la lista; pueden ir en horizontal, vertical o diagonal.',
    base: t.definicion,
    respuesta: modo === 'error'
      ? `Seleccionó las letras «${seleccion}», que no forman ninguna palabra pendiente de la lista.`
      : 'Aún no encuentra esta palabra en la grilla.',
    prohibidos: []
  };
}

async function crucigrama(tema, datos, modo) {
  const t = await terminoDe(tema, datos.terminoId);
  const largo = normalizar(t.termino).length;
  const intento = letras(datos.intento, largo);
  if (modo === 'error') {
    if (intento.length !== largo) rechazar('Completa todas las letras de la palabra antes de pedir que Neuri explique el error', 400);
    if (intento === normalizar(t.termino)) rechazar('Esa palabra ya es correcta: no hay error que explicar', 400);
  }
  return {
    item: `Palabra de ${largo} letras`,
    situacion: `Pista del crucigrama: «${t.pista || t.definicion}» (${largo} letras).`,
    base: t.definicion,
    respuesta: modo === 'error' ? `Escribió «${intento}».` : 'Aún no completa esta palabra.',
    prohibidos: [sinTildes(t.termino)]
  };
}

function textoCorrecta(p) {
  if (p.tipo === 'opcion') return p.opciones?.[p.correcta] ?? '';
  return p.tipo === 'vf' ? '' : String(p.correcta ?? '');
}

async function quiz(usuario, datos, modo) {
  const sesion = (await almacen.leer('quiz-sesiones')).find((s) => s.id === datos.sesionId);
  if (!sesion || sesion.usuarioId !== usuario.id) rechazar('Sesión de quiz no encontrada', 404);
  if (!sesion.preguntasIds?.includes(datos.preguntaId)) rechazar('La pregunta no pertenece a esta sesión', 400);
  const { tema } = await temaDelUsuario(usuario, sesion.temaId);
  const p = (await almacen.leer('preguntas')).find((x) => x.id === datos.preguntaId);
  if (!p) rechazar('La pregunta ya no existe en el banco', 404);

  const r = sesion.respuestas?.[p.id];
  if (modo === 'pista' && r) rechazar(r.correcto ? 'Ya respondiste bien esta pregunta' : 'Ya respondiste esta pregunta: usa «Explícame el error»', 409);
  if (modo === 'error' && !r) rechazar('Responde la pregunta antes de pedir que Neuri explique el error', 400);
  if (modo === 'error' && r.correcto) rechazar('Tu respuesta es correcta: no hay error que explicar', 400);

  const elegida = !r ? '' : p.tipo === 'opcion' ? p.opciones?.[Number(r.respuesta)] ?? ''
    : p.tipo === 'vf' ? (r.respuesta === true || /^v/i.test(String(r.respuesta)) ? 'Verdadero' : 'Falso') : String(r.respuesta);
  const correcta = textoCorrecta(p);
  return {
    tema,
    item: `Pregunta de nivel ${sesion.nivel}`,
    situacion: `${p.enunciado}${p.tipo === 'opcion' ? ` Opciones: ${p.opciones.map((o) => `«${o}»`).join(', ')}.` : p.tipo === 'vf' ? ' (Verdadero o falso)' : ' (Completar)'}`,
    // La retroalimentación del docente explica la respuesta: solo se usa después de responder
    base: modo === 'error' ? p.retroalimentacion || '' : (p.pistas?.[Number(datos.nivel) - 1] || ''),
    respuesta: modo === 'error' ? `Respondió «${elegida}».` : 'Aún no responde.',
    prohibidos: p.tipo === 'vf'
      ? ['es verdadera', 'es verdadero', 'es falsa', 'es falso', 'afirmacion es correcta', 'afirmacion es incorrecta']
      : [correcta.length > 40 ? fragmento(correcta) : sinTildes(correcta)].filter(Boolean)
  };
}

async function simulador(usuario, datos, modo) {
  const sim = (await almacen.leer('simulaciones')).find((s) => s.id === datos.simulacionId);
  // Mismas reglas de visibilidad que la colección (estudiante: publicada y de sus asignaturas)
  if (!sim || !(await filtrarLista([sim], usuario)).length) rechazar('Simulación no encontrada', 404);
  if (sim.modo !== 'escenarios') rechazar('En el juego de roles conversa directamente con el personaje', 400);
  const { tema } = await temaDelUsuario(usuario, sim.temaId);
  const escena = sim.escenas?.find((e) => e.id === datos.escena);
  if (!escena?.opciones?.length) rechazar('Escena no encontrada', 404);

  const mejor = Math.max(...escena.opciones.map((o) => Number(o.puntos) || 0));
  const situacion = `${escena.texto} Opciones: ${escena.opciones.map((o) => `«${o.texto}»`).join(', ')}.`;
  // Ni la mejor opción ni su posición («la primera opción…»)
  const prohibidos = [
    ...escena.opciones.filter((o) => (Number(o.puntos) || 0) === mejor).map((o) => fragmento(o.texto)),
    'primera opcion', 'segunda opcion', 'tercera opcion', 'cuarta opcion', 'ultima opcion'
  ];
  if (modo === 'pista') {
    return { tema, item: sim.titulo, situacion, base: '', respuesta: 'Aún no decide.', prohibidos };
  }
  const elegida = escena.opciones[Number(datos.opcion)];
  if (!elegida || !Number.isInteger(Number(datos.opcion))) rechazar('Elige una decisión antes de pedir que Neuri explique el error', 400);
  if ((Number(elegida.puntos) || 0) > 0) rechazar('Tu decisión fue favorable: no hay error que explicar', 400);
  return {
    tema,
    item: sim.titulo,
    situacion,
    base: elegida.consecuencia || '',
    respuesta: `Eligió: «${elegida.texto}».`,
    prohibidos
  };
}

const POR_TEMA = { ahorcado, pareja, 'sopa-letras': sopaLetras, crucigrama };

/**
 * @param {{ actividad, modo: "pista" | "error", nivel?, temaId?, terminoId?, otroId?, acertadas?, erradas?,
 *   seleccion?, intento?, sesionId?, preguntaId?, simulacionId?, escena?, opcion? }} datos
 */
export default async function preparar(datos, usuario) {
  if (usuario?.rol !== 'estudiante') rechazar('Neuri acompaña a los estudiantes en las actividades', 403);
  const actividad = String(datos.actividad || '');
  if (!ACTIVIDADES[actividad]) rechazar('Actividad no válida para Neuri', 400);
  const modo = datos.modo;
  if (!['pista', 'error'].includes(modo)) rechazar('Tipo de ayuda inválido', 400);
  const nivel = Number(datos.nivel);
  if (modo === 'pista' && !AYUDAS[nivel]) rechazar('El nivel de pista debe ser 1, 2 o 3', 400);

  let contexto;
  if (POR_TEMA[actividad]) {
    const { tema } = await temaDelUsuario(usuario, datos.temaId);
    contexto = { tema, ...(await POR_TEMA[actividad](tema, datos, modo)) };
  } else {
    contexto = await (actividad === 'quiz' ? quiz : simulador)(usuario, datos, modo);
  }
  const { tema } = contexto;

  return {
    actividad: ACTIVIDADES[actividad],
    tema: tema.titulo,
    item: contexto.item,
    situacion: contexto.situacion,
    base: [contexto.base, tema.resumen].filter(Boolean).join(' ').slice(0, MAX_BASE) || '(Sin base adicional: invita a revisar el tema.)',
    ayuda: modo === 'pista' ? AYUDAS[nivel] : ERROR,
    respuesta: contexto.respuesta,
    // Control de salida (no llega al modelo): brevedad y soluciones que no se pueden revelar
    __control: { maxPalabras: 90, minFrases: 2, maxFrases: 4, preguntas: 1, prohibidos: contexto.prohibidos.filter(Boolean) }
  };
}
