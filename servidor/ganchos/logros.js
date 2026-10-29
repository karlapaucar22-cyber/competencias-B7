// servidor/ganchos/logros.js
// Ganchos para la colección 'logros'

import * as acceso from '../acceso.js';

/**
 * Filtra los logros de gamificación según el rol del usuario:
 * - Admin: ve todos los registros de logros.
 * - Docente: ve exclusivamente los logros de sus estudiantes asignados.
 * - Estudiante: ve solo sus propios logros.
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const estudiantes = await acceso.estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(estudiantes.map((e) => e.id));
    return lista.filter((logro) => idsEstudiantes.has(logro.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((logro) => logro.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
