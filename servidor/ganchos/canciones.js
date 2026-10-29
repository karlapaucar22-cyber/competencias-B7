// servidor/ganchos/canciones.js
// Ganchos para la colección 'canciones'

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Filtra las canciones según las asignaturas del usuario a través del tema asociado.
 * - Admin: ve todas las canciones.
 * - Docente: ve las canciones de temas asociados a sus asignaturas impartidas.
 * - Estudiante: ve canciones de temas publicados y unidades visibles de sus asignaturas inscritas.
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
    return lista.filter((cancion) => {
      const tema = mapaTemas.get(cancion.temaId);
      if (!tema) return false;
      const unidad = mapaUnidades.get(tema.unidadId);
      return unidad && idsAsigs.has(unidad.asignaturaId);
    });
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((cancion) => {
      const tema = mapaTemas.get(cancion.temaId);
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
 * Valida los campos requeridos y que el docente/admin tenga permiso para editar en la asignatura del tema.
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
      const err = new Error('No tienes permisos para gestionar canciones en esta asignatura');
      err.estado = 403;
      throw err;
    }
  }
  if (!datos) return datos;

  const temaId = datos.temaId !== undefined ? datos.temaId : (anterior ? anterior.temaId : null);
  if (!temaId || typeof temaId !== 'string' || !temaId.trim()) {
    const err = new Error('El tema es obligatorio');
    err.estado = 400;
    throw err;
  }

  const titulo = datos.titulo !== undefined ? datos.titulo : (anterior ? anterior.titulo : null);
  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    const err = new Error('El título de la canción es obligatorio');
    err.estado = 400;
    throw err;
  }

  const audio = datos.audio !== undefined ? datos.audio : (anterior ? anterior.audio : null);
  if (!audio || typeof audio !== 'string' || !audio.trim()) {
    const err = new Error('El archivo de audio MP3 es obligatorio');
    err.estado = 400;
    throw err;
  }

  const autoria = datos.autoria !== undefined ? datos.autoria : (anterior ? anterior.autoria : null);
  if (!autoria || typeof autoria !== 'string' || !autoria.trim()) {
    const err = new Error('La autoría de la canción es obligatoria');
    err.estado = 400;
    throw err;
  }

  const licencia = datos.licencia !== undefined ? datos.licencia : (anterior ? anterior.licencia : null);
  if (!licencia || typeof licencia !== 'string' || !licencia.trim()) {
    const err = new Error('La licencia de la canción es obligatoria');
    err.estado = 400;
    throw err;
  }

  // Verificar que el tema exista
  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) {
    const err = new Error('El tema seleccionado no existe');
    err.estado = 404;
    throw err;
  }

  // Verificar permisos sobre la asignatura del tema
  const asig = await acceso.asignaturaDeTema(temaId);
  const asignaturaId = asig ? asig.id : null;
  const puede = await acceso.puedeEditarAsignatura(usuario, asignaturaId);

  if (!puede) {
    const err = new Error('No tienes permisos para gestionar canciones en esta asignatura');
    err.estado = 403;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
