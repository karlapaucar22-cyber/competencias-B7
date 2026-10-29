// servidor/ganchos/unidades.js
// Ganchos para la colección 'unidades'

import * as acceso from '../acceso.js';
import * as almacen from '../almacen.js';

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

// Título comparable: sin tildes, sin mayúsculas y con espacios simples
const normalizarTitulo = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Filtra las unidades según las asignaturas del usuario y visibilidad.
 * - Admin: ve todas las unidades.
 * - Docente: ve las unidades de sus asignaturas.
 * - Estudiante: ve las unidades de sus asignaturas con visible !== false.
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const asigs = await acceso.asignaturasDe(usuario);
  const idsAsigs = new Set(asigs.map((a) => a.id));

  if (usuario.rol === 'estudiante') {
    return lista.filter((u) => idsAsigs.has(u.asignaturaId) && u.visible !== false);
  }

  if (usuario.rol === 'docente') {
    return lista.filter((u) => idsAsigs.has(u.asignaturaId));
  }

  return [];
}

/**
 * Valida permisos y relaciones de la unidad:
 * - Permiso de edición sobre la asignatura de destino y, al editar, también sobre la de origen
 *   (un docente no puede llevarse unidades de una asignatura ajena).
 * - Título obligatorio al crear y sin duplicados dentro de la misma asignatura (409), para que
 *   repetir una creación no genere registros iguales.
 *
 * @param {Object} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!datos) {
    // Eliminar: requiere permiso sobre la asignatura de la unidad
    if (anterior && !(await acceso.puedeEditarAsignatura(usuario, anterior.asignaturaId))) {
      rechazar('No tienes permisos para editar unidades en esta asignatura', 403);
    }
    return datos;
  }

  const asignaturaId = datos.asignaturaId || (anterior && anterior.asignaturaId);
  if (!(await acceso.puedeEditarAsignatura(usuario, asignaturaId))) {
    rechazar('No tienes permisos para editar unidades en esta asignatura', 403);
  }
  if (anterior && anterior.asignaturaId !== asignaturaId && !(await acceso.puedeEditarAsignatura(usuario, anterior.asignaturaId))) {
    rechazar('No tienes permisos sobre la asignatura de origen de esta unidad', 403);
  }

  const titulo = 'titulo' in datos ? datos.titulo : anterior?.titulo;
  if (!anterior && !normalizarTitulo(titulo)) rechazar('El título de la unidad es obligatorio', 400);
  if (!anterior || 'titulo' in datos || 'asignaturaId' in datos) {
    const repetida = (await almacen.leer('unidades')).find((u) => u.asignaturaId === asignaturaId
      && u.id !== anterior?.id && normalizarTitulo(u.titulo) === normalizarTitulo(titulo));
    if (repetida) rechazar(`Ya existe la unidad «${repetida.titulo}» en esta asignatura (${repetida.id})`, 409);
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
