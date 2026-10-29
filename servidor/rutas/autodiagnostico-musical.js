// Autodiagnóstico musical: registro privado y formativo, sin puntos de gamificación.

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { PREGUNTAS_AUTODIAGNOSTICO, resumirAutodiagnostico } from '../../publico/js/nucleo/autodiagnostico-musical.js';

const router = Router();
const COLECCION = 'autodiagnosticos-musicales';
const CONTEXTOS = ['lectura', 'problemas'];
const CONDICIONES = ['silencio', 'cancion-principal'];
const colas = new Map();

function error(mensaje, estado) {
  return Object.assign(new Error(mensaje), { estado });
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en autodiagnóstico musical:', err);
  res.status(estado).json({ error: estado === 500 ? 'No se pudo guardar el autodiagnóstico' : err.message });
}

async function recursosDelEstudiante(usuario) {
  const config = await almacen.leerConfig('neuroritmo');
  const grupo = (await almacen.leer('distributivo')).find((g) =>
    g.asignaturaId === config.asignaturaId && (g.estudiantes || []).includes(usuario.id));
  if (!grupo) throw error('Este recurso pertenece a una asignatura en la que no estás matriculado', 403);
  const cancion = (await almacen.leer('canciones')).find((item) => item.id === config.cancionPrincipalId) || null;
  return {
    cancionPrincipal: cancion ? {
      id: cancion.id,
      titulo: cancion.titulo,
      audio: cancion.audio,
      letra: cancion.letra || '',
      autoria: cancion.autoria || '',
      licencia: cancion.licencia || ''
    } : null
  };
}

function validar(datos, cancionPrincipal) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw error('Datos del autodiagnóstico no válidos', 400);
  if (!CONTEXTOS.includes(datos.contexto)) throw error('Elige una actividad académica', 400);
  if (!CONDICIONES.includes(datos.condicion)) throw error('Elige silencio o la canción principal', 400);
  if (datos.condicion === 'cancion-principal' && !cancionPrincipal) throw error('La canción principal no está disponible', 409);
  const entrada = datos.respuestas;
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw error('Completa las preguntas del autodiagnóstico', 400);
  const ids = new Set(PREGUNTAS_AUTODIAGNOSTICO.map((pregunta) => pregunta.id));
  if (Object.keys(entrada).some((id) => !ids.has(id))) throw error('El autodiagnóstico contiene una pregunta no válida', 400);
  const respuestas = Object.fromEntries(PREGUNTAS_AUTODIAGNOSTICO.map((pregunta) => [pregunta.id, Number(entrada[pregunta.id])]));
  const resultado = resumirAutodiagnostico(respuestas);
  if (!resultado) throw error('Responde todas las preguntas con valores de 1 a 4', 400);
  const observacion = typeof datos.observacion === 'string' ? datos.observacion.trim() : '';
  if (observacion.length > 500) throw error('La observación no puede superar 500 caracteres', 400);
  return {
    contexto: datos.contexto,
    condicion: datos.condicion,
    respuestas,
    observacion,
    cancionId: cancionPrincipal?.id || null,
    resultado,
    actualizado: new Date().toISOString()
  };
}

function enCola(usuarioId, tarea) {
  const actual = (colas.get(usuarioId) || Promise.resolve()).catch(() => {}).then(tarea);
  colas.set(usuarioId, actual);
  actual.finally(() => { if (colas.get(usuarioId) === actual) colas.delete(usuarioId); }).catch(() => {});
  return actual;
}

router.get('/autodiagnostico-musical', exigirRol('estudiante'), async (req, res) => {
  try {
    const recursos = await recursosDelEstudiante(req.usuario);
    const registro = (await almacen.leer(COLECCION)).find((item) => item.usuarioId === req.usuario.id) || null;
    res.json({ ...recursos, registro });
  } catch (err) {
    responderError(res, err);
  }
});

router.put('/autodiagnostico-musical', exigirRol('estudiante'), async (req, res) => {
  try {
    const guardado = await enCola(req.usuario.id, async () => {
      const recursos = await recursosDelEstudiante(req.usuario);
      const datos = validar(req.body, recursos.cancionPrincipal);
      const anterior = (await almacen.leer(COLECCION)).find((item) => item.usuarioId === req.usuario.id);
      return anterior
        ? almacen.actualizar(COLECCION, anterior.id, datos)
        : almacen.agregar(COLECCION, { ...datos, usuarioId: req.usuario.id });
    });
    res.json(guardado);
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
