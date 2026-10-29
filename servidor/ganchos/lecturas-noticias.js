// servidor/ganchos/lecturas-noticias.js
// Ganchos para la colección 'lecturas-noticias'

import * as almacen from '../almacen.js';

/**
 * Filtra las lecturas para que cada usuario solo vea sus propias lecturas
 * (los administradores pueden ver todas para estadísticas).
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  return lista.filter((l) => l.usuarioId === usuario.id);
}

/**
 * Fija el usuarioId con el usuario actual y rechaza registros duplicados
 * para la combinación (usuarioId + noticiaId).
 *
 * @param {Object|null} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object|null>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (datos === null) return null;

  if (!usuario) {
    const err = new Error('Sesión requerida para registrar lectura de noticias');
    err.estado = 401;
    throw err;
  }

  datos.usuarioId = usuario.id;

  if (!datos.noticiaId) {
    const err = new Error('El campo noticiaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  const lecturas = await almacen.leer('lecturas-noticias');
  const yaExiste = lecturas.some(
    (l) =>
      l.usuarioId === usuario.id &&
      l.noticiaId === datos.noticiaId &&
      (!anterior || l.id !== anterior.id)
  );

  if (yaExiste) {
    const err = new Error('La lectura de esta noticia ya fue registrada previamente');
    err.estado = 400;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
