import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Filtra las asignaturas según el rol y la asignación del usuario.
 * - Admin: ve todas las asignaturas.
 * - Docente y Estudiante: ven únicamente las asignaturas a las que pertenecen según el distributivo.
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await acceso.asignaturasDe(usuario);
  const idsPermitidos = new Set(permitidas.map((a) => a.id));

  return lista.filter((a) => idsPermitidos.has(a.id));
}

/**
 * Valida los datos de la asignatura antes de crear, actualizar o eliminar.
 * - En eliminación (datos === null): impide borrar si tiene grupos en distributivo.
 * - En creación o edición: exige nombre no vacío.
 *
 * @param {Object|null} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object|null>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  // Eliminación
  if (datos === null && anterior) {
    const grupos = await almacen.leer('distributivo');
    const tieneGrupos = grupos.some((g) => g.asignaturaId === anterior.id);
    if (tieneGrupos) {
      const err = new Error('No se puede eliminar la asignatura porque tiene grupos asignados en el distributivo');
      err.estado = 400;
      throw err;
    }
    return null;
  }

  // Creación o edición
  if (datos) {
    if (!datos.nombre || typeof datos.nombre !== 'string' || !datos.nombre.trim()) {
      const err = new Error('El nombre de la asignatura es obligatorio');
      err.estado = 400;
      throw err;
    }
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
