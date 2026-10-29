// servidor/ganchos/progreso-temas.js
// Ganchos para la colección 'progreso-temas'

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Filtra el progreso de temas según el rol del usuario:
 * - Admin: ve todo el progreso registrado.
 * - Docente: ve únicamente el progreso de sus estudiantes a cargo.
 * - Estudiante: ve únicamente su propio progreso.
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
    return lista.filter((p) => idsEstudiantes.has(p.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((p) => p.usuarioId === usuario.id);
  }

  return [];
}

/**
 * Fija el usuarioId del usuario autenticado y rechaza duplicados de (usuarioId + temaId).
 *
 * @param {Object} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const err = new Error('Sesión requerida para registrar progreso');
    err.estado = 401;
    throw err;
  }

  if (!datos) return datos;

  datos.usuarioId = usuario.id;

  if (!datos.temaId) {
    const err = new Error('El campo temaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  const progresos = await almacen.leer('progreso-temas');
  const yaExiste = progresos.some(
    (p) =>
      p.usuarioId === usuario.id &&
      p.temaId === datos.temaId &&
      (!anterior || p.id !== anterior.id)
  );

  if (yaExiste) {
    const err = new Error('El progreso de este tema ya ha sido registrado previamente');
    err.estado = 400;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
