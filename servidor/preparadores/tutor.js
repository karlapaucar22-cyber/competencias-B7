// servidor/preparadores/tutor.js
// Tutor socrático por tema: verifica el acceso y arma el contenido del tema y la conversación previa.
// El navegador envía { temaId, historial }; el servidor no guarda los textos.

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export const MAX_TEXTO = 1000;      // caracteres por mensaje del historial
export const MAX_TURNOS = 10;       // últimos mensajes considerados
const MAX_TERMINOS = 30;            // términos del glosario en el contenido
const MAX_VALOR = 6000;             // ia.rellenar recorta cada {{clave}} a 6.000 caracteres
const ROLES = { estudiante: 'Estudiante', tutor: 'Tutor' };
const ACTIVIDADES = new Set(['tema', 'explora', 'autodiagnostico', 'canciones', 'agenda', 'foro', 'juego', 'mision', 'general']);

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

const lista = (titulo, valores) => {
  const items = (Array.isArray(valores) ? valores : []).filter((v) => typeof v === 'string' && v.trim());
  return items.length ? `${titulo}:\n${items.map((v) => `- ${v.trim()}`).join('\n')}` : '';
};

/**
 * Tema accesible para el usuario (de una de sus asignaturas; los estudiantes, solo publicados).
 * @returns {{ tema, asignatura }}
 */
export async function temaDelUsuario(usuario, temaId) {
  if (typeof temaId !== 'string' || !temaId) rechazar('Elige el tema con el que quieres trabajar', 400);
  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  const asignatura = tema && (await acceso.asignaturaDeTema(temaId));
  const suyas = new Set((await acceso.asignaturasDe(usuario)).map((a) => a.id));
  const visible = tema && (tema.estado === 'publicado' || usuario.rol !== 'estudiante');
  if (!asignatura || !visible) rechazar('Tema no encontrado', 404);
  if (!suyas.has(asignatura.id)) rechazar('No tienes acceso a este tema', 403);
  return { tema, asignatura };
}

/** Valida el historial del navegador: últimos 10 mensajes, el último del estudiante. */
export function validarHistorial(historial) {
  if (!Array.isArray(historial) || !historial.length) rechazar('Escribe tu pregunta para el tutor', 400);
  const recientes = historial.slice(-MAX_TURNOS).map((m) => {
    if (!m || !ROLES[m.rol] || typeof m.texto !== 'string') rechazar('Historial no válido: usa [{ rol: "estudiante" | "tutor", texto }]', 400);
    const texto = m.texto.trim();
    if (texto.length > MAX_TEXTO) rechazar(`Cada mensaje puede tener hasta ${MAX_TEXTO.toLocaleString('es-EC')} caracteres`, 400);
    return { rol: m.rol, texto };
  });
  const ultimo = recientes.at(-1);
  if (ultimo.rol !== 'estudiante' || !ultimo.texto) rechazar('El último mensaje debe ser la pregunta del estudiante', 400);
  return { previos: recientes.slice(0, -1).filter((m) => m.texto), pregunta: ultimo.texto };
}

function contenidoDe(tema, glosario) {
  const terminos = glosario
    .filter((g) => g.temaId === tema.id && g.estado === 'aprobado')
    .slice(0, MAX_TERMINOS)
    .map((g) => `- ${g.termino}: ${g.definicion}`);
  return [
    lista('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen.trim()}` : '',
    lista('Ejemplos', tema.ejemplos),
    lista('Errores frecuentes', tema.erroresFrecuentes),
    lista('Preguntas guía', tema.preguntasGuia),
    terminos.length ? `Glosario:\n${terminos.join('\n')}` : ''
  ].filter(Boolean).join('\n\n').slice(0, MAX_VALOR);
}

export function nivelApoyoDe(previos, pregunta) {
  const mensajes = [...previos, { rol: 'estudiante', texto: pregunta }]
    .filter((m) => m.rol === 'estudiante').slice(-4).map((m) => m.texto.toLowerCase());
  const dificultad = mensajes.filter((texto) => /no (entiendo|se|sé)|me (confunde|cuesta)|otra pista|mas ayuda|más ayuda|ayudame|ayúdame/.test(texto)).length;
  return Math.min(3, 1 + dificultad);
}

async function contextoDe(cuerpo, tema) {
  const experiencia = await almacen.leerConfig('neuroritmo');
  const misionId = typeof cuerpo?.contexto?.misionId === 'string' ? cuerpo.contexto.misionId : '';
  const mision = experiencia.misiones?.find((m) => m.id === misionId && m.temaId === tema.id);
  const itemId = typeof cuerpo?.contexto?.itemId === 'string' ? cuerpo.contexto.itemId : '';
  const item = mision?.items?.find((i) => i.id === itemId);
  const actividad = ACTIVIDADES.has(cuerpo?.contexto?.actividad) ? cuerpo.contexto.actividad : 'general';
  const partes = [`Tema: ${tema.titulo}`];
  if (mision) partes.push(`Misión ${mision.numero}: ${mision.titulo}`);
  if (item) partes.push(`Actividad actual: ${item.titulo}`, `Concepto: ${item.concepto}`);
  else if (actividad !== 'general') partes.push(`Espacio actual: ${actividad}`);
  return partes.join(' · ');
}

/**
 * @param {{ temaId: string, historial: Array<{ rol: "estudiante" | "tutor", texto: string }> }} cuerpo
 * @returns {{ asignatura, nivel, tema, contenido, historial, pregunta }}
 */
export default async function prepararTutor(cuerpo, usuario) {
  const { previos, pregunta } = validarHistorial(cuerpo?.historial);
  const { tema, asignatura } = await temaDelUsuario(usuario, cuerpo?.temaId);
  const contenido = contenidoDe(tema, await almacen.leer('glosario'));
  const nivelApoyo = nivelApoyoDe(previos, pregunta);

  // Conversación previa como texto ({{historial}}); si no cabe, se conservan las líneas más recientes
  const lineas = [];
  let largo = 0;
  for (const m of [...previos].reverse()) {
    const linea = `${ROLES[m.rol]}: ${m.texto}`;
    if (largo + linea.length + 1 > MAX_VALOR) break;
    lineas.unshift(linea);
    largo += linea.length + 1;
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'educación superior',
    tema: tema.titulo,
    contexto: await contextoDe(cuerpo, tema),
    apoyo: nivelApoyo === 1
      ? 'Nivel 1: pregunta orientadora y activación de conocimientos previos.'
      : nivelApoyo === 2
        ? 'Nivel 2: pista conceptual breve y un ejemplo paralelo, todavía sin solución.'
        : 'Nivel 3: andamiaje concreto paso a paso, dejando al estudiante completar la respuesta.',
    contenido: contenido || '(El tema aún no tiene contenido registrado.)',
    historial: lineas.length ? lineas.join('\n') : '(Sin mensajes previos: es el inicio de la conversación.)',
    pregunta,
    __control: { maxPalabras: 90, minFrases: 2, maxFrases: 4, preguntas: 1 }
  };
}
