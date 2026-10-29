// servidor/auth.js
// Autenticación, carga de sesión de usuario y control de acceso por roles

import * as almacen from './almacen.js';

/**
 * Limpia del almacenamiento todas las sesiones cuya fecha de expiración sea anterior a la actual.
 */
export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date().toISOString();
    const activas = sesiones.filter((s) => s.expira && s.expira > ahora);
    if (activas.length !== sesiones.length) {
      await almacen.escribir('sesiones', activas);
    }
  } catch (err) {
    console.error('Error al limpiar sesiones vencidas:', err);
  }
}

// Limpiar sesiones expiradas al cargarse el módulo
limpiarSesionesVencidas().catch(() => {});

/**
 * Middleware Express para identificar al usuario a partir del encabezado Authorization: Bearer <token>.
 * Si el token es válido y la sesión no ha expirado, asigna req.usuario = { id, nombre, apellido, rol }.
 * En cualquier otro caso, asigna req.usuario = null.
 */
export async function cargarUsuario(req, res, next) {
  req.usuario = null;

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const ahora = new Date().toISOString();
    const sesiones = await almacen.leer('sesiones');
    const sesion = sesiones.find((s) => s.token === token && s.expira && s.expira > ahora);

    if (!sesion) {
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === sesion.usuarioId && u.activo === true);

    if (!usuario) {
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    };
    req.tokenActual = token;
  } catch (err) {
    console.error('Error al resolver usuario de la sesión:', err);
  }

  next();
}

/**
 * Middleware generador para restringir el acceso según los roles permitidos.
 * Responde 401 si no hay sesión activa, o 403 si el rol del usuario no coincide.
 *
 * @param  {...string} roles - Roles permitidos ('estudiante', 'docente', 'admin', etc.)
 */
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada o token inválido' });
    }
    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado para su rol' });
    }
    next();
  };
}
