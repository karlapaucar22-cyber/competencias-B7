// servidor/ganchos/distributivo.js
// Ganchos para la colección 'distributivo'

import * as acceso from '../acceso.js';

/**
 * Filtra los grupos de distributivo según el rol y asignación del usuario.
 * - Admin: ve todo el distributivo.
 * - Docente: ve solo los grupos donde es docenteId.
 * - Estudiante: ve solo los grupos donde está matriculado en estudiantes[].
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const grupos = await acceso.gruposDe(usuario);
  const idsGrupos = new Set(grupos.map((g) => g.id));

  return lista.filter((g) => idsGrupos.has(g.id));
}

/**
 * Valida los datos del grupo antes de crear o actualizar.
 *
 * @param {Object|null} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object|null>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (datos) {
    if (!datos.asignaturaId || !datos.paralelo || !datos.periodo || !datos.docenteId) {
      const err = new Error('Los campos asignatura, paralelo, período y docente son obligatorios');
      err.estado = 400;
      throw err;
    }
    if (!Array.isArray(datos.estudiantes)) {
      datos.estudiantes = [];
    }
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
