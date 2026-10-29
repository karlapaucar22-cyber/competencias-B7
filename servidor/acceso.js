// servidor/acceso.js
// Funciones de control de acceso por grupos, asignaturas y distributivo docente/estudiante

import * as almacen from './almacen.js';

/**
 * Retorna la lista de grupos (distributivo) a los que pertenece el usuario.
 * - Admin: ve todos los grupos.
 * - Docente: ve los grupos donde es docenteId.
 * - Estudiante: ve los grupos donde figura en estudiantes[].
 *
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function gruposDe(usuario) {
  if (!usuario) return [];
  const distributivo = await almacen.leer('distributivo');

  if (usuario.rol === 'admin') {
    return distributivo;
  }

  if (usuario.rol === 'docente') {
    return distributivo.filter((g) => g.docenteId === usuario.id);
  }

  if (usuario.rol === 'estudiante') {
    return distributivo.filter(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
    );
  }

  return [];
}

/**
 * Retorna las asignaturas a las que tiene acceso el usuario según sus grupos asignados.
 * - Admin: ve todas las asignaturas.
 * - Docente / Estudiante: ve las asignaturas de sus grupos de distributivo.
 *
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function asignaturasDe(usuario) {
  if (!usuario) return [];
  const todasAsignaturas = await almacen.leer('asignaturas');

  if (usuario.rol === 'admin') {
    return todasAsignaturas;
  }

  const grupos = await gruposDe(usuario);
  const idsAsignaturas = [...new Set(grupos.map((g) => g.asignaturaId).filter(Boolean))];

  return todasAsignaturas.filter((a) => idsAsignaturas.includes(a.id));
}

/**
 * Resuelve la asignatura asociada a un tema navegando tema -> unidad -> asignatura.
 *
 * @param {string} temaId
 * @returns {Promise<Object|null>}
 */
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find((u) => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  const asignaturas = await almacen.leer('asignaturas');
  return asignaturas.find((a) => a.id === unidad.asignaturaId) || null;
}

/**
 * Determina si el usuario tiene permiso para editar contenidos de una asignatura.
 * - Admin: siempre puede editar cualquier asignatura.
 * - Docente: puede editar si está asignado a ella en algún grupo de distributivo.
 *
 * @param {Object|null} usuario
 * @param {string} asignaturaId
 * @returns {Promise<boolean>}
 */
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;

  if (usuario.rol === 'admin') {
    return true;
  }

  if (usuario.rol === 'docente') {
    const distributivo = await almacen.leer('distributivo');
    return distributivo.some(
      (g) => g.docenteId === usuario.id && g.asignaturaId === asignaturaId
    );
  }

  return false;
}

/**
 * Retorna la lista de usuarios estudiantes a cargo de un docente según el distributivo.
 *
 * @param {string} docenteId
 * @returns {Promise<Array<Object>>}
 */
export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const grupos = distributivo.filter((g) => g.docenteId === docenteId);

  const idsEstudiantes = [
    ...new Set(grupos.flatMap((g) => (Array.isArray(g.estudiantes) ? g.estudiantes : [])))
  ];

  if (idsEstudiantes.length === 0) return [];

  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter((u) => idsEstudiantes.includes(u.id));
}

/**
 * Retorna la lista de usuarios docentes que imparten clases a un estudiante según el distributivo.
 *
 * @param {string} estudianteId
 * @returns {Promise<Array<Object>>}
 */
export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const grupos = distributivo.filter(
    (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
  );

  const idsDocentes = [...new Set(grupos.map((g) => g.docenteId).filter(Boolean))];

  if (idsDocentes.length === 0) return [];

  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter((u) => idsDocentes.includes(u.id));
}
