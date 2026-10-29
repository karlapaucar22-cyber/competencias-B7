// servidor/ganchos/intentos.js
// Ganchos para la colección 'intentos'

import * as acceso from '../acceso.js';

/**
 * Filtra los intentos de actividades según el rol del usuario:
 * - Admin: ve todos los intentos.
 * - Docente: ve exclusivamente los intentos de sus estudiantes asignados.
 * - Estudiante: ve solo sus propios intentos.
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
    return lista.filter((intento) => idsEstudiantes.has(intento.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((intento) => intento.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
