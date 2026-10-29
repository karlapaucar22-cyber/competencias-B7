// servidor/notificar.js
// Crea notificaciones para un usuario (colección notificaciones)

import * as almacen from './almacen.js';

/**
 * @param {string} usuarioId
 * @param {{ tipo: string, mensaje: string, enlace?: string }} datos
 * @returns {Promise<Object>} notificación guardada
 */
export async function notificar(usuarioId, { tipo, mensaje, enlace = '' }) {
  if (!usuarioId || !tipo || !mensaje) {
    throw new Error('Notificación incompleta: se requieren usuarioId, tipo y mensaje');
  }
  return almacen.agregar('notificaciones', { usuarioId, tipo, mensaje, enlace, leida: false });
}

export default { notificar };
