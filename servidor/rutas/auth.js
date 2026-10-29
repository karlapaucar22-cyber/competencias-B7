// servidor/rutas/auth.js
// Rutas de autenticación, perfil, gestión administrativa de claves y eventos

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Registro en memoria de intentos fallidos por correo para limitar tasa (Rate limiting)
// Mapa: correo normalizado -> { intentos: [timestamp1, timestamp2, ...] }
const intentosFallidos = new Map();
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos
const MAX_FALLOS = 5;

/**
 * Valida si un correo electrónico está temporalmente bloqueado por exceso de intentos fallidos.
 */
function estaBloqueadoPorIntentos(correoNorm) {
  const registro = intentosFallidos.get(correoNorm);
  if (!registro) return false;
  const ahora = Date.now();
  registro.intentos = registro.intentos.filter((t) => ahora - t < VENTANA_BLOQUEO_MS);
  return registro.intentos.length >= MAX_FALLOS;
}

/**
 * Registra un intento fallido de inicio de sesión para un correo.
 */
function registrarIntentoFallido(correoNorm) {
  const ahora = Date.now();
  const registro = intentosFallidos.get(correoNorm) || { intentos: [] };
  registro.intentos = registro.intentos.filter((t) => ahora - t < VENTANA_BLOQUEO_MS);
  registro.intentos.push(ahora);
  intentosFallidos.set(correoNorm, registro);
}

/**
 * Limpia el historial de intentos fallidos tras un inicio de sesión exitoso.
 */
function limpiarIntentosFallidos(correoNorm) {
  intentosFallidos.delete(correoNorm);
}

/**
 * Genera una contraseña temporal aleatoria de 10 caracteres con letras y números.
 */
function crearClaveTemporal() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let resultado = '';
  for (let i = 0; i < 10; i++) {
    resultado += caracteres[bytes[i] % caracteres.length];
  }
  return resultado;
}

// -----------------------------------------------------------------------------
// POST /api/auth/registro
// -----------------------------------------------------------------------------
router.post('/auth/registro', async (req, res) => {
  const { nombre, apellido, correo, clave, consentimiento } = req.body || {};

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
    return res.status(400).json({ error: 'El apellido es obligatorio' });
  }

  // Validación de correo electrónico
  const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correo || typeof correo !== 'string' || !formatoCorreo.test(correo.trim())) {
    return res.status(400).json({ error: 'El formato del correo electrónico es inválido' });
  }

  const correoNorm = correo.trim().toLowerCase();

  // Validación de contraseña: 8 o más caracteres con letras y números
  const formatoClave = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
  if (!clave || typeof clave !== 'string' || !formatoClave.test(clave)) {
    return res.status(400).json({
      error: 'La contraseña debe tener al menos 8 caracteres y contener tanto letras como números'
    });
  }

  // Consentimiento obligatorio
  if (consentimiento !== true) {
    return res.status(400).json({
      error: 'Debe aceptar los términos y condiciones de consentimiento para registrarse'
    });
  }

  try {
    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.some((u) => u.correo && u.correo.toLowerCase() === correoNorm);
    if (yaExiste) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);

    const nuevoUsuario = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoUsuario);

    res.status(201).json({
      id: creado.id,
      nombre: creado.nombre,
      apellido: creado.apellido,
      correo: creado.correo,
      rol: creado.rol
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al procesar el registro' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/auth/login
// -----------------------------------------------------------------------------
router.post('/auth/login', async (req, res) => {
  const { correo, clave } = req.body || {};

  if (!correo || !clave || typeof correo !== 'string' || typeof clave !== 'string') {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  const correoNorm = correo.trim().toLowerCase();

  // Verificación de límite de intentos fallidos
  if (estaBloqueadoPorIntentos(correoNorm)) {
    return res.status(429).json({
      error: 'Demasiados intentos fallidos. Por favor, espere 15 minutos antes de volver a intentar.'
    });
  }

  try {
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.correo && u.correo.toLowerCase() === correoNorm);

    if (!usuario || !usuario.activo) {
      registrarIntentoFallido(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(clave, usuario.claveHash || '');
    if (!coincide) {
      registrarIntentoFallido(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Login correcto: limpiar intentos fallidos
    limpiarIntentosFallidos(correoNorm);

    // Crear sesión (32 bytes aleatorios en hex, expira en 8 horas)
    const token = crypto.randomBytes(32).toString('hex');
    const ahora = Date.now();
    const expira = new Date(ahora + 8 * 60 * 60 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    // Registro automático en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error en el inicio de sesión' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/auth/logout
// -----------------------------------------------------------------------------
router.post('/auth/logout', async (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  try {
    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const sesion = sesiones.find((s) => s.token === token);
      if (sesion) {
        await almacen.eliminar('sesiones', sesion.id);
      }
    }

    if (req.usuario && req.usuario.id) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cerrar sesión' });
  }
});

// -----------------------------------------------------------------------------
// GET /api/auth/yo
// -----------------------------------------------------------------------------
router.get('/auth/yo', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Sesión no iniciada' });
  }

  try {
    const usuarios = await almacen.leer('usuarios');
    const u = usuarios.find((user) => user.id === req.usuario.id);
    if (!u) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      rol: u.rol,
      foto: u.foto || null,
      activo: u.activo,
      fechaCreacion: u.fechaCreacion || u.fecha
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al obtener usuario' });
  }
});

// -----------------------------------------------------------------------------
// PUT /api/auth/perfil
// -----------------------------------------------------------------------------
router.put('/auth/perfil', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Sesión no iniciada' });
  }

  const { nombre, apellido, foto } = req.body || {};
  const cambios = {};

  if (typeof nombre === 'string' && nombre.trim()) {
    cambios.nombre = nombre.trim();
  }
  if (typeof apellido === 'string' && apellido.trim()) {
    cambios.apellido = apellido.trim();
  }
  if (foto !== undefined) {
    cambios.foto = foto;
  }

  try {
    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);

    res.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      correo: actualizado.correo,
      rol: actualizado.rol,
      foto: actualizado.foto || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al actualizar perfil' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/auth/clave
// -----------------------------------------------------------------------------
router.post('/auth/clave', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'Sesión no iniciada' });
  }

  const { actual, nueva } = req.body || {};

  if (!actual || !nueva || typeof actual !== 'string' || typeof nueva !== 'string') {
    return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva' });
  }

  const formatoClave = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
  if (!formatoClave.test(nueva)) {
    return res.status(400).json({
      error: 'La nueva contraseña debe tener al menos 8 caracteres y contener letras y números'
    });
  }

  try {
    const usuarios = await almacen.leer('usuarios');
    const u = usuarios.find((user) => user.id === req.usuario.id);
    if (!u) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(actual, u.claveHash || '');
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevaHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', u.id, { claveHash: nuevaHash });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cambiar contraseña' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/admin/usuarios/:id/restablecer
// -----------------------------------------------------------------------------
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const usuarios = await almacen.leer('usuarios');
    const u = usuarios.find((user) => user.id === id);
    if (!u) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const claveTemporal = crearClaveTemporal();
    const claveHash = await bcrypt.hash(claveTemporal, 10);

    await almacen.actualizar('usuarios', id, { claveHash });

    // Registrar evento administrativo en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo: 'restablecer-clave',
      recurso: `usuario:${id}`,
      fecha: new Date().toISOString()
    });

    res.json({ claveTemporal });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al restablecer contraseña' });
  }
});

// -----------------------------------------------------------------------------
// POST /api/eventos
// -----------------------------------------------------------------------------
router.post('/eventos', async (req, res) => {
  const { tipo, recurso } = req.body || {};

  if (!tipo || !recurso || typeof tipo !== 'string' || typeof recurso !== 'string') {
    return res.status(400).json({ error: 'Tipo y recurso son campos requeridos' });
  }

  try {
    const evento = {
      usuarioId: req.usuario ? req.usuario.id : null,
      tipo: tipo.trim(),
      recurso: recurso.trim(),
      fecha: new Date().toISOString()
    };

    await almacen.anexarLinea('bitacora.jsonl', evento);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al registrar evento en bitácora' });
  }
});

export default router;
