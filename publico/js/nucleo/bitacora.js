// publico/js/nucleo/bitacora.js
// Registro de eventos en la bitácora del sistema desde el navegador

import * as api from './api.js';

/**
 * Registra un evento en la bitácora del servidor.
 * Se ejecuta de manera asíncrona y no interrumpe la navegación ante errores.
 *
 * @param {string} tipo - Tipo de evento (ej. "pagina", "actividad", "login")
 * @param {string} recurso - Identificador o ruta del recurso involucrado
 * @returns {Promise<void>}
 */
export async function registrarEvento(tipo, recurso) {
  if (!tipo || !recurso) return;

  try {
    await api.llamar('POST', '/api/eventos', { tipo, recurso });
  } catch (err) {
    // Los eventos en segundo plano no deben interrumpir la experiencia de usuario
    console.debug('No se pudo registrar evento en bitácora:', err.message);
  }
}
