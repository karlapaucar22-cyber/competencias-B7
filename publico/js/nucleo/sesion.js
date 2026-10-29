// publico/js/nucleo/sesion.js
// Gestión de sesión de usuario en el navegador (sessionStorage)

import * as api from './api.js';
import { aviso } from './ui.js';

const CLAVE_TOKEN = 'token';
const CLAVE_USUARIO = 'usuario';

/**
 * Retorna el token de autenticación actual o null si no existe.
 * @returns {string|null}
 */
export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(CLAVE_TOKEN) || null;
}

/**
 * Retorna la información del usuario autenticado actual o null si no hay sesión.
 * @returns {{ id: string, nombre: string, apellido: string, rol: string }|null}
 */
export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CLAVE_USUARIO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Inicia sesión con correo y contraseña.
 * Guarda token y usuario en sessionStorage y devuelve el usuario.
 * @param {string} correo
 * @param {string} clave
 * @returns {Promise<Object>}
 */
export async function iniciar(correo, clave) {
  const respuesta = await api.llamar('POST', '/api/auth/login', { correo, clave });

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(CLAVE_TOKEN, respuesta.token);
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(respuesta.usuario));
  }

  return respuesta.usuario;
}

/**
 * Registra un nuevo usuario estudiante y automáticamente inicia su sesión.
 * @param {Object} datos - { nombre, apellido, correo, clave, consentimiento }
 * @returns {Promise<Object>}
 */
export async function registrar(datos) {
  await api.llamar('POST', '/api/auth/registro', datos);
  return await iniciar(datos.correo, datos.clave);
}

/**
 * Cierra la sesión activa en el servidor y limpia el almacenamiento local.
 */
export async function cerrar() {
  try {
    await api.llamar('POST', '/api/auth/logout');
  } catch {
    // Si la sesión ya expiró o hubo fallo de red, se procede a limpiar de todas formas
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CLAVE_TOKEN);
      sessionStorage.removeItem(CLAVE_USUARIO);
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

/**
 * Valida los permisos de acceso para la página actual.
 * Si no hay sesión → redirige a /paginas/ingreso.html.
 * Si el rol no está permitido → redirige a /index.html con un aviso.
 * @param {Array<string>} roles - Lista de roles permitidos ('publico', 'sesion', 'estudiante', 'docente', 'admin')
 * @returns {boolean}
 */
export function exigirRol(roles = ['publico']) {
  if (!roles || roles.length === 0 || roles.includes('publico')) {
    return true;
  }

  const usuario = usuarioActual();

  if (!usuario || !token()) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
    return false;
  }

  // Permitido para cualquier usuario con sesión
  if (roles.includes('sesion')) {
    return true;
  }

  // El administrador tiene acceso a todos los módulos
  if (usuario.rol === 'admin' || roles.includes(usuario.rol)) {
    return true;
  }

  // Rol no permitido: guardar aviso y redirigir a inicio
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('aviso_pendiente', JSON.stringify({
      texto: 'No tienes permisos para acceder a esa sección.',
      tipo: 'error'
    }));
  }

  if (typeof window !== 'undefined' && window.location) {
    window.location.href = '/index.html';
  }

  return false;
}
