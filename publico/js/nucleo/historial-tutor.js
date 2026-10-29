// Historial privado del tutor en la pestaña actual. No contiene notas ni se envía a otras cuentas.

import { usuarioActual } from './sesion.js';

const MAX_GUARDADOS = 40;
const roles = new Set(['estudiante', 'tutor']);
const clave = () => `neuri.tutor:${usuarioActual()?.id || 'sin-sesion'}`;

const limpiarMensaje = (mensaje) => {
  const rol = roles.has(mensaje?.rol) ? mensaje.rol : '';
  const texto = typeof mensaje?.texto === 'string' ? mensaje.texto.trim().slice(0, 1000) : '';
  if (!rol || !texto) return null;
  return {
    rol,
    texto,
    temaId: typeof mensaje.temaId === 'string' ? mensaje.temaId.slice(0, 80) : '',
    contexto: typeof mensaje.contexto === 'string' ? mensaje.contexto.slice(0, 160) : '',
    fecha: typeof mensaje.fecha === 'string' ? mensaje.fecha : new Date().toISOString()
  };
};

export function leerHistorialTutor() {
  try {
    const dato = JSON.parse(sessionStorage.getItem(clave()) || '[]');
    return (Array.isArray(dato) ? dato : []).map(limpiarMensaje).filter(Boolean).slice(-MAX_GUARDADOS);
  } catch {
    return [];
  }
}

export function guardarHistorialTutor(mensajes) {
  const limpio = (Array.isArray(mensajes) ? mensajes : []).map(limpiarMensaje).filter(Boolean).slice(-MAX_GUARDADOS);
  try { sessionStorage.setItem(clave(), JSON.stringify(limpio)); } catch { /* solo dura en memoria */ }
  return limpio;
}

export function agregarHistorialTutor(mensajes, rol, texto, contexto = {}) {
  return guardarHistorialTutor([...mensajes, {
    rol,
    texto,
    temaId: contexto.temaId || '',
    contexto: contexto.etiqueta || '',
    fecha: new Date().toISOString()
  }]);
}

export function limpiarHistorialTutor() {
  try { sessionStorage.removeItem(clave()); } catch { /* sin almacenamiento */ }
}

export const historialParaApi = (mensajes) => (Array.isArray(mensajes) ? mensajes : [])
  .slice(-10).map(({ rol, texto }) => ({ rol, texto }));

