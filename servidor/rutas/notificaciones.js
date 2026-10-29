// servidor/rutas/notificaciones.js
// Centro de notificaciones: listado propio, envío de docentes/admin y marcado como leídas

import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { exigirRol } from '../auth.js';
import { notificar } from '../notificar.js';

const router = Router();
const RECIENTES = 30;
const MAX_MENSAJE = 500;

function error(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  return err;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en notificaciones:', err);
  res.status(estado).json({ error: err.message || 'Error en notificaciones' });
}

const propias = async (usuarioId) => (await almacen.leer('notificaciones')).filter((n) => n.usuarioId === usuarioId);

/**
 * GET /api/notificaciones → { notificaciones (30 más recientes), noLeidas (total) }
 */
router.get('/notificaciones', exigirRol(), async (req, res) => {
  try {
    const lista = (await propias(req.usuario.id)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    res.json({ notificaciones: lista.slice(0, RECIENTES), noLeidas: lista.filter((n) => !n.leida).length });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/notificaciones { usuarioId, mensaje, enlace? }
 * Docente: solo a estudiantes de sus grupos. Admin: a cualquier usuario.
 */
router.post('/notificaciones', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const { usuarioId } = req.body || {};
    const mensaje = typeof req.body?.mensaje === 'string' ? req.body.mensaje.trim() : '';
    const enlace = typeof req.body?.enlace === 'string' ? req.body.enlace.trim() : '';
    if (!mensaje) throw error('Escribe el mensaje', 400);
    if (mensaje.length > MAX_MENSAJE) throw error(`El mensaje no puede superar ${MAX_MENSAJE} caracteres`, 400);
    // Solo rutas internas de la plataforma (evita enlaces externos o javascript:)
    if (enlace && !/^\/(?!\/)[^\s]*$/.test(enlace)) throw error('El enlace debe ser una ruta de la plataforma, por ejemplo /paginas/tema.html?id=...', 400);

    const usuarios = await almacen.leer('usuarios');
    const destinatario = usuarios.find((u) => u.id === usuarioId);
    if (req.usuario.rol === 'docente') {
      const suyos = new Set((await acceso.estudiantesDe(req.usuario.id)).map((u) => u.id));
      if (!destinatario || !suyos.has(destinatario.id)) throw error('Solo puedes notificar a estudiantes de tus grupos', 403);
    } else if (!destinatario) {
      throw error('El usuario no existe', 404);
    }

    const remitente = usuarios.find((u) => u.id === req.usuario.id);
    const notificacion = await notificar(destinatario.id, { tipo: 'mensaje-docente', mensaje, enlace });
    const completa = await almacen.actualizar('notificaciones', notificacion.id, {
      remitente: remitente ? `${remitente.nombre} ${remitente.apellido}`.trim() : ''
    });
    res.status(201).json(completa);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/notificaciones/leidas → marca todas las propias como leídas
 */
router.post('/notificaciones/leidas', exigirRol(), async (req, res) => {
  try {
    const pendientes = (await propias(req.usuario.id)).filter((n) => !n.leida);
    for (const n of pendientes) await almacen.actualizar('notificaciones', n.id, { leida: true });
    res.json({ actualizadas: pendientes.length, noLeidas: 0 });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/notificaciones/:id/leida
 */
router.post('/notificaciones/:id/leida', exigirRol(), async (req, res) => {
  try {
    const notificacion = (await almacen.leer('notificaciones')).find((n) => n.id === req.params.id);
    if (!notificacion || notificacion.usuarioId !== req.usuario.id) throw error('Notificación no encontrada', 404);
    const actualizada = notificacion.leida ? notificacion : await almacen.actualizar('notificaciones', notificacion.id, { leida: true });
    res.json({ ...actualizada, noLeidas: (await propias(req.usuario.id)).filter((n) => !n.leida).length });
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
