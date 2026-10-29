// servidor/rutas/gamificacion.js
// Rutas de la API para gamificación: registro de intentos y consulta de logros

import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { exigirRol } from '../auth.js';
import { procesarIntento } from '../gamificacion.js';

const router = Router();

// Actividades que califica y registra solo el servidor (quiz: /api/quiz/finalizar; foro: al responder;
// neuroritmo: /api/neuroritmo/*). Aceptarlas aquí permitiría sumar puntos sin participar.
export const SOLO_SERVIDOR = ['quiz', 'foro', 'neuroritmo'];

/**
 * POST /api/intentos
 * Registra el intento de una actividad interactiva y ejecuta el motor de gamificación.
 */
router.post('/intentos', exigirRol(), async (req, res, next) => {
  try {
    if (SOLO_SERVIDOR.includes(req.body?.actividad)) {
      return res.status(403).json({ error: 'Esta actividad se registra automáticamente al realizarla en la plataforma' });
    }
    const resultado = await procesarIntento(req.usuario, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    const estado = typeof err.estado === 'number' ? err.estado : 400;
    res.status(estado).json({ error: err.message || 'Error al procesar el intento de gamificación' });
  }
});

/**
 * GET /api/logros/:usuarioId
 * Retorna los logros (puntos, insignias, niveles de quiz) de un usuario.
 * "yo" equivale al usuario en sesión.
 * Permitido a:
 * - El propio usuario (estudiante o cualquier rol)
 * - El docente para estudiantes a su cargo según distributivo
 * - Administradores para cualquier usuario
 */
router.get('/logros/:usuarioId', exigirRol(), async (req, res, next) => {
  try {
    const targetUsuarioId = req.params.usuarioId === 'yo' ? req.usuario.id : req.params.usuarioId;

    // Verificación de acceso
    if (req.usuario.rol !== 'admin' && targetUsuarioId !== req.usuario.id) {
      if (req.usuario.rol === 'docente') {
        const misEstudiantes = await acceso.estudiantesDe(req.usuario.id);
        const esEstudianteMio = misEstudiantes.some((e) => e.id === targetUsuarioId);
        if (!esEstudianteMio) {
          return res.status(403).json({ error: 'No tienes permisos para consultar los logros de este estudiante' });
        }
      } else {
        return res.status(403).json({ error: 'No tienes permisos para consultar los logros de otros usuarios' });
      }
    }

    const todosLogros = await almacen.leer('logros');
    const registro = todosLogros.find((l) => l.usuarioId === targetUsuarioId);

    if (!registro) {
      return res.json({
        usuarioId: targetUsuarioId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      });
    }

    res.json(registro);
  } catch (err) {
    next(err);
  }
});

export default router;
