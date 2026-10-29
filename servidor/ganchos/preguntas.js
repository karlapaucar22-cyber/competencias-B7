// servidor/ganchos/preguntas.js
// Ganchos para la colección 'preguntas' (banco del quiz; nunca visible para estudiantes)

import * as acceso from '../acceso.js';

const TIPOS = ['opcion', 'vf', 'completar'];
const ESTADOS = ['aprobado', 'borrador'];

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

async function exigirEdicion(usuario, temaId) {
  const asig = await acceso.asignaturaDeTema(temaId);
  if (!asig) rechazar('El tema de la pregunta no existe', 400);
  if (!(await acceso.puedeEditarAsignatura(usuario, asig.id))) {
    rechazar('No tienes permisos para editar preguntas de esta asignatura', 403);
  }
}

// Valida la pregunta completa (registro anterior fusionado con los cambios)
function validar(p) {
  const nivel = Number(p.nivel);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) rechazar('El nivel debe ser un número de 1 a 5', 400);
  if (!TIPOS.includes(p.tipo)) rechazar('El tipo debe ser opcion, vf o completar', 400);
  if (typeof p.enunciado !== 'string' || !p.enunciado.trim()) rechazar('El enunciado es obligatorio', 400);
  if (p.estado !== undefined && !ESTADOS.includes(p.estado)) rechazar('Estado no válido', 400);

  if (p.tipo === 'opcion') {
    const opciones = Array.isArray(p.opciones) ? p.opciones : [];
    if (opciones.length !== 4 || opciones.some((o) => typeof o !== 'string' || !o.trim())) {
      rechazar('Una pregunta de opción necesita 4 opciones con texto', 400);
    }
    if (new Set(opciones.map((o) => o.trim().toLowerCase())).size !== 4) rechazar('Las opciones no pueden repetirse', 400);
    if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta > 3) rechazar('La respuesta correcta debe ser un índice de 0 a 3', 400);
  } else if (p.tipo === 'vf') {
    if (typeof p.correcta !== 'boolean') rechazar('La respuesta correcta debe ser verdadero o falso', 400);
  } else {
    if (!p.enunciado.includes('____')) rechazar('El enunciado de completar debe incluir "____"', 400);
    if (typeof p.correcta !== 'string' || !p.correcta.trim()) rechazar('La respuesta correcta es obligatoria', 400);
  }
}

/**
 * Admin ve todo; el docente solo las preguntas de sus asignaturas; nadie más.
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol !== 'docente') return [];

  const editables = new Map();
  const resultado = [];
  for (const p of lista) {
    if (!editables.has(p.temaId)) {
      const asig = await acceso.asignaturaDeTema(p.temaId);
      editables.set(p.temaId, Boolean(asig) && (await acceso.puedeEditarAsignatura(usuario, asig.id)));
    }
    if (editables.get(p.temaId)) resultado.push(p);
  }
  return resultado;
}

/**
 * Exige poder editar la asignatura del tema (anterior y nuevo) y valida la forma.
 * En DELETE llega datos = null y solo se comprueba el permiso.
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (anterior) await exigirEdicion(usuario, anterior.temaId);
  if (!datos) return datos;

  const temaId = datos.temaId ?? anterior?.temaId;
  if (!anterior || temaId !== anterior.temaId) await exigirEdicion(usuario, temaId);

  const limpio = { ...datos };
  if (limpio.nivel !== undefined) limpio.nivel = Number(limpio.nivel);
  if (typeof limpio.enunciado === 'string') limpio.enunciado = limpio.enunciado.trim();
  if (typeof limpio.retroalimentacion === 'string') limpio.retroalimentacion = limpio.retroalimentacion.trim();
  if (limpio.tipo === 'vf') limpio.opciones = ['Verdadero', 'Falso'];
  if (limpio.tipo === 'completar') limpio.opciones = [];
  if (!anterior) {
    limpio.origen = limpio.origen === 'ia' ? 'ia' : 'docente';
    limpio.estado = limpio.estado || 'aprobado';
  }

  validar({ ...(anterior || {}), ...limpio });
  return limpio;
}

export default {
  filtrarLista,
  antesDeGuardar
};
