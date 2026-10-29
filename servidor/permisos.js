import { leerConfig } from './almacen.js';

/**
 * Evalúa si un usuario tiene permiso para realizar una acción sobre una colección/registro.
 * Según datos/config/permisos.json.
 * Valores permitidos: publico, sesion, estudiante, docente, admin, propio, servidor.
 * - Colección no listada → false.
 * - "servidor" nunca se permite desde la API.
 * - "propio" compara registro.usuarioId con usuario.id.
 *
 * @param {Object|null} usuario - Usuario de la sesión { id, rol, ... }
 * @param {"leer"|"escribir"} accion - Tipo de acción a realizar
 * @param {string} col - Nombre de la colección
 * @param {Object} [registro] - Registro sobre el que se evalúa la acción
 * @returns {Promise<boolean>}
 */
export async function puede(usuario, accion, col, registro = null) {
  if (!accion || !col) return false;

  const permisos = await leerConfig('permisos');
  if (!permisos || typeof permisos !== 'object') return false;

  // Busca regla directa o por nombre base si tiene subcarpeta (ej. mensajes/con_000001 -> mensajes)
  const reglaCol = permisos[col] || (col.includes('/') ? permisos[col.split('/')[0]] : null);
  if (!reglaCol || !Array.isArray(reglaCol[accion])) {
    return false;
  }

  const permitidos = reglaCol[accion];

  // Si incluye 'publico', cualquiera puede acceder
  if (permitidos.includes('publico')) {
    return true;
  }

  // Sin usuario autenticado, no aplican los demás permisos
  if (!usuario) {
    return false;
  }

  // Cualquier usuario con sesión activa
  if (permitidos.includes('sesion')) {
    return true;
  }

  // Rol específico (estudiante, docente, admin)
  if (usuario.rol && permitidos.includes(usuario.rol)) {
    return true;
  }

  // Regla "propio": compara registro.usuarioId con usuario.id o permite listar al usuario autenticado
  if (permitidos.includes('propio')) {
    if (registro) {
      if (usuario.id && registro.usuarioId && String(registro.usuarioId) === String(usuario.id)) {
        return true;
      }
    } else if (usuario.id) {
      return true;
    }
  }

  // 'servidor' nunca se permite desde la API y si no coincidió nada más:
  return false;
}
