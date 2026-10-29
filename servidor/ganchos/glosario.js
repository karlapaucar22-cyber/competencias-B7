// servidor/ganchos/glosario.js
// Ganchos para la colección 'glosario'

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Filtra los términos de glosario según las asignaturas del usuario y su estado de aprobación.
 * - Admin: ve todos los términos.
 * - Docente: ve los términos asociados a temas de sus asignaturas.
 * - Estudiante: ve solo términos con estado === 'aprobado', pertenecientes a temas publicados y unidades visibles de sus asignaturas.
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

  const temas = await almacen.leer('temas');
  const mapaTemas = new Map(temas.map((t) => [t.id, t]));

  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

  if (usuario.rol === 'docente') {
    return lista.filter((item) => {
      const tema = mapaTemas.get(item.temaId);
      if (!tema) return false;
      const unidad = mapaUnidades.get(tema.unidadId);
      return unidad && idsAsigs.has(unidad.asignaturaId);
    });
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((item) => {
      if (item.estado !== 'aprobado') return false;

      const tema = mapaTemas.get(item.temaId);
      if (!tema || tema.estado !== 'publicado') return false;

      const unidad = mapaUnidades.get(tema.unidadId);
      if (!unidad || unidad.visible === false || !idsAsigs.has(unidad.asignaturaId)) {
        return false;
      }

      return true;
    });
  }

  return [];
}

/**
 * Valida que el usuario tenga permiso para editar términos en la asignatura del tema asociado.
 *
 * @param {Object} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  // Editar o eliminar: también exige permiso sobre la asignatura del tema de origen
  if (anterior) {
    const origen = await acceso.asignaturaDeTema(anterior.temaId);
    if (!(await acceso.puedeEditarAsignatura(usuario, origen ? origen.id : null))) {
      const err = new Error('No tienes permisos para editar términos en esta asignatura');
      err.estado = 403;
      throw err;
    }
  }
  if (!datos) return datos;

  const temaId = datos.temaId || (anterior && anterior.temaId);
  const asig = await acceso.asignaturaDeTema(temaId);
  const asignaturaId = asig ? asig.id : null;

  const puede = await acceso.puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const err = new Error('No tienes permisos para editar términos en esta asignatura');
    err.estado = 403;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
