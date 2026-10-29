// servidor/ganchos/usuarios.js
// Ganchos para la colección 'usuarios'

/**
 * Filtra la lista de usuarios para no exponer la clave hash.
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Array<Object>}
 */
export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  return lista.map((u) => {
    if (!u || typeof u !== 'object') return u;
    const { claveHash, ...resto } = u;
    return resto;
  });
}

/**
 * Procesa y valida los datos antes de crear o actualizar un usuario.
 * Ignora claveHash y correo, y evita que un administrador se quite el rol o se desactive a sí mismo.
 *
 * @param {Object} datos
 * @param {Object|null} usuario - Usuario actual que realiza la solicitud
 * @param {Object|null} anterior - Registro previo en caso de actualización
 * @returns {Object}
 */
export function antesDeGuardar(datos, usuario, anterior) {
  if (!datos || typeof datos !== 'object') return datos;

  const resultado = { ...datos };
  delete resultado.claveHash;
  delete resultado.correo;

  // Evita que un admin se quite el rol o se desactive a sí mismo
  if (anterior && usuario && anterior.id === usuario.id) {
    if (resultado.rol !== undefined && resultado.rol !== 'admin' && anterior.rol === 'admin') {
      const err = new Error('Un administrador no puede quitarse el rol a sí mismo');
      err.estado = 403;
      throw err;
    }

    if (resultado.activo === false && anterior.activo === true) {
      const err = new Error('Un administrador no puede desactivar su propia cuenta');
      err.estado = 403;
      throw err;
    }
  }

  return resultado;
}

export default {
  filtrarLista,
  antesDeGuardar
};
