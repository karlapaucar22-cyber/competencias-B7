// servidor/rutas/quiz.js
// Motor del quiz temático de NeuroRitmo: estado, inicio, respuestas y cierre (solo estudiantes)

import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { exigirRol } from '../auth.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';
import { normalizar, barajar } from '../../publico/js/nucleo/util.js';

const router = Router();

const TEMA_QUIZ = 'tem_000014';
const NIVELES = {
  1: 'Atención y funciones ejecutivas',
  2: 'Memoria y aprendizaje musical',
  3: 'Autorregulación emocional y diseño de microactividades musicales'
};
const ZONA_HORARIA = 'America/Guayaquil';
const TIPO_AVISO_BANCO = 'banco-insuficiente';

function error(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  return err;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en el quiz:', err);
  res.status(estado).json({ error: err.message || 'Error en el quiz' });
}

const dia = (fecha) => new Date(fecha).toLocaleDateString('sv-SE', { timeZone: ZONA_HORARIA });

// Bloqueo por sesión: evita respuestas o cierres simultáneos de la misma sesión
const bloqueos = new Map();
function conBloqueo(clave, tarea) {
  const anterior = bloqueos.get(clave) || Promise.resolve();
  const actual = anterior.catch(() => {}).then(tarea);
  bloqueos.set(clave, actual);
  actual.finally(() => { if (bloqueos.get(clave) === actual) bloqueos.delete(clave); }).catch(() => {});
  return actual;
}

/**
 * El estudiante debe tener la asignatura del tema, y el tema debe estar publicado
 * dentro de una unidad visible.
 */
async function temaAccesible(usuario, temaId) {
  if (!temaId) throw error('Falta el tema', 400);
  if (temaId !== TEMA_QUIZ) throw error('Este quiz está configurado únicamente para la Misión NeuroRitmo', 404);
  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema || tema.estado !== 'publicado') throw error('El tema no existe o no está publicado', 404);
  const unidad = (await almacen.leer('unidades')).find((u) => u.id === tema.unidadId);
  if (!unidad || unidad.visible === false) throw error('El tema no está disponible', 404);
  const asignaturas = await acceso.asignaturasDe(usuario);
  const asignatura = asignaturas.find((a) => a.id === unidad.asignaturaId);
  if (!asignatura) throw error('No tienes acceso a este tema', 403);
  return { tema, asignatura };
}

async function nivelAprobado(usuarioId, temaId) {
  const logro = (await almacen.leer('logros')).find((l) => l.usuarioId === usuarioId);
  return Number(logro?.nivelQuiz?.[temaId]) || 0;
}

function estadoNivel(nivel, aprobadoHasta) {
  if (nivel <= aprobadoHasta) return 'aprobado';
  return nivel === 1 || nivel - 1 <= aprobadoHasta ? 'disponible' : 'bloqueado';
}

function leerNivel(valor) {
  const nivel = Number(valor);
  if (!Number.isInteger(nivel) || !NIVELES[nivel]) throw error('El nivel debe ser un número de 1 a 3', 400);
  return nivel;
}

// Sesión del estudiante en curso o 404 si no le pertenece
async function sesionPropia(usuario, sesionId) {
  if (!sesionId) throw error('Falta la sesión', 400);
  const sesion = (await almacen.leer('quiz-sesiones')).find((s) => s.id === sesionId);
  if (!sesion || sesion.usuarioId !== usuario.id) throw error('Sesión de quiz no encontrada', 404);
  if (sesion.finalizada) throw error('Esta sesión de quiz ya terminó', 409);
  return sesion;
}

function textoCorrecta(p) {
  if (p.tipo === 'opcion') return p.opciones?.[p.correcta] ?? '';
  if (p.tipo === 'vf') return p.correcta ? 'Verdadero' : 'Falso';
  return String(p.correcta ?? '');
}

function evaluar(p, respuesta) {
  if (p.tipo === 'opcion') return Number.isInteger(Number(respuesta)) && Number(respuesta) === p.correcta;
  if (p.tipo === 'vf') {
    const valor = typeof respuesta === 'boolean' ? respuesta
      : ['TRUE', 'VERDADERO'].includes(normalizar(respuesta)) ? true
        : ['FALSE', 'FALSO'].includes(normalizar(respuesta)) ? false : null;
    return valor === p.correcta;
  }
  const limpio = (t) => normalizar(t).replace(/\s+/g, ' ');
  return limpio(respuesta) !== '' && limpio(respuesta) === limpio(p.correcta);
}

/**
 * Avisa a los docentes del estudiante que el banco no alcanza (una vez al día por tema y nivel).
 */
async function avisarBancoInsuficiente(usuario, tema, asignatura, nivel, sinVer, requeridas) {
  const docentes = new Set((await almacen.leer('distributivo'))
    .filter((g) => g.asignaturaId === asignatura.id && g.estudiantes?.includes(usuario.id) && g.docenteId)
    .map((g) => g.docenteId));
  if (!docentes.size) return;

  const enlace = `/paginas/banco-preguntas.html?temaId=${encodeURIComponent(tema.id)}&nivel=${nivel}`;
  const hoy = dia(Date.now());
  const yaAvisados = new Set((await almacen.leer('notificaciones'))
    .filter((n) => n.tipo === TIPO_AVISO_BANCO && n.enlace === enlace && dia(n.fecha) === hoy)
    .map((n) => n.usuarioId));

  for (const docenteId of docentes) {
    if (yaAvisados.has(docenteId)) continue;
    await notificar(docenteId, {
      tipo: TIPO_AVISO_BANCO,
      mensaje: `El quiz de "${tema.titulo}", nivel ${nivel} (${NIVELES[nivel]}), está repitiendo preguntas: `
        + `un estudiante tenía ${sinVer} sin ver y necesita ${requeridas}. Agrega más preguntas aprobadas.`,
      enlace
    });
  }
}

/**
 * GET /api/quiz/estado?temaId=
 */
router.get('/quiz/estado', exigirRol('estudiante'), async (req, res) => {
  try {
    const { tema } = await temaAccesible(req.usuario, req.query.temaId);
    const aprobadoHasta = await nivelAprobado(req.usuario.id, tema.id);
    const sesiones = (await almacen.leer('quiz-sesiones'))
      .filter((s) => s.usuarioId === req.usuario.id && s.temaId === tema.id && s.finalizada);

    res.json({
      niveles: Object.entries(NIVELES).map(([n, nombre]) => {
        const nivel = Number(n);
        const porcentajes = sesiones.filter((s) => s.nivel === nivel).map((s) => Number(s.porcentaje) || 0);
        return {
          nivel,
          nombre,
          estado: estadoNivel(nivel, aprobadoHasta),
          mejorPorcentaje: porcentajes.length ? Math.max(...porcentajes) : null
        };
      })
    });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/quiz/iniciar { temaId, nivel }
 */
router.post('/quiz/iniciar', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const { tema, asignatura } = await temaAccesible(usuario, req.body?.temaId);
    const nivel = leerNivel(req.body?.nivel);
    if (estadoNivel(nivel, await nivelAprobado(usuario.id, tema.id)) === 'bloqueado') {
      throw error(`Aprueba primero el nivel ${nivel - 1} para desbloquear este nivel`, 403);
    }

    const reglas = (await almacen.leerConfig('reglas-gamificacion')).quiz || {};
    const requeridas = Number(reglas.preguntasPorNivel) || 10;
    const banco = (await almacen.leer('preguntas'))
      .filter((p) => p.temaId === tema.id && Number(p.nivel) === nivel && p.estado === 'aprobado');
    if (!banco.length) {
      await avisarBancoInsuficiente(usuario, tema, asignatura, nivel, 0, requeridas);
      throw error('Este nivel todavía no tiene preguntas. Ya avisamos a tu docente.', 409);
    }

    // Última vez que el estudiante vio cada pregunta
    const vistas = new Map();
    for (const s of (await almacen.leer('quiz-sesiones')).filter((s) => s.usuarioId === usuario.id)) {
      for (const id of s.preguntasIds || []) {
        if (!vistas.has(id) || s.inicio > vistas.get(id)) vistas.set(id, s.inicio);
      }
    }
    const sinVer = barajar(banco.filter((p) => !vistas.has(p.id)));
    let elegidas = sinVer.slice(0, requeridas);
    if (elegidas.length < requeridas) {
      const vistasAntiguas = banco
        .filter((p) => vistas.has(p.id))
        .sort((a, b) => String(vistas.get(a.id)).localeCompare(String(vistas.get(b.id))));
      elegidas = barajar([...elegidas, ...vistasAntiguas.slice(0, requeridas - elegidas.length)]);
      await avisarBancoInsuficiente(usuario, tema, asignatura, nivel, sinVer.length, requeridas);
    }

    const sesion = await almacen.agregar('quiz-sesiones', {
      usuarioId: usuario.id,
      temaId: tema.id,
      nivel,
      preguntasIds: elegidas.map((p) => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    });

    // Sin respuestas ni retroalimentación
    res.status(201).json({
      sesionId: sesion.id,
      preguntas: elegidas.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: p.tipo === 'vf' ? ['Verdadero', 'Falso'] : p.tipo === 'opcion' ? p.opciones : [],
        pistas: Array.isArray(p.pistas) ? p.pistas.slice(0, 3) : []
      }))
    });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/quiz/responder { sesionId, preguntaId, respuesta }
 */
router.post('/quiz/responder', exigirRol('estudiante'), async (req, res) => {
  const { sesionId, preguntaId, respuesta } = req.body || {};
  try {
    const resultado = await conBloqueo(sesionId, async () => {
      const sesion = await sesionPropia(req.usuario, sesionId);
      if (!sesion.preguntasIds.includes(preguntaId)) throw error('La pregunta no pertenece a esta sesión', 400);
      if (sesion.respuestas?.[preguntaId]) throw error('Ya respondiste esta pregunta', 409);
      if (respuesta === undefined || respuesta === null || respuesta === '') throw error('Falta la respuesta', 400);

      const pregunta = (await almacen.leer('preguntas')).find((p) => p.id === preguntaId);
      if (!pregunta) throw error('La pregunta ya no existe en el banco', 410);

      const correcto = evaluar(pregunta, respuesta);
      const guardada = typeof respuesta === 'string' ? respuesta.slice(0, 300) : respuesta;
      await almacen.actualizar('quiz-sesiones', sesion.id, {
        respuestas: { ...sesion.respuestas, [preguntaId]: { respuesta: guardada, correcto, fecha: new Date().toISOString() } }
      });
      return { correcto, retroalimentacion: pregunta.retroalimentacion || '', correcta: textoCorrecta(pregunta) };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/quiz/finalizar { sesionId }
 */
router.post('/quiz/finalizar', exigirRol('estudiante'), async (req, res) => {
  const { sesionId } = req.body || {};
  try {
    const resultado = await conBloqueo(sesionId, async () => {
      const usuario = req.usuario;
      const sesion = await sesionPropia(usuario, sesionId);
      const reglas = (await almacen.leerConfig('reglas-gamificacion')).quiz || {};
      const minimo = Number(reglas.porcentajeAprobacion) || 70;

      const total = sesion.preguntasIds.length;
      const respuestas = sesion.respuestas || {};
      const aciertos = sesion.preguntasIds.filter((id) => respuestas[id]?.correcto === true).length;
      const porcentaje = total ? Math.round((aciertos / total) * 100) : 0;
      const aprobado = total > 0 && porcentaje >= minimo;

      // Primero el nivel aprobado, para que las insignias de nivel lo vean
      if (aprobado) {
        const logro = (await almacen.leer('logros')).find((l) => l.usuarioId === usuario.id);
        if (!logro) {
          await almacen.agregar('logros', { usuarioId: usuario.id, puntos: 0, insignias: [], nivelQuiz: { [sesion.temaId]: sesion.nivel } });
        } else if ((Number(logro.nivelQuiz?.[sesion.temaId]) || 0) < sesion.nivel) {
          await almacen.actualizar('logros', logro.id, { nivelQuiz: { ...logro.nivelQuiz, [sesion.temaId]: sesion.nivel } });
        }
      }

      const duracionSeg = Math.max(1, Math.round((Date.now() - new Date(sesion.inicio).getTime()) / 1000));
      const gamificacion = await procesarIntento(usuario, {
        actividad: 'quiz',
        temaId: sesion.temaId,
        nivel: sesion.nivel,
        puntaje: aciertos,
        maximo: total,
        errores: total - aciertos,
        duracionSeg,
        detalle: { aprobado }
      });

      await almacen.actualizar('quiz-sesiones', sesion.id, {
        finalizada: true, fin: new Date().toISOString(), aciertos, porcentaje, aprobado
      });

      const preguntas = new Map((await almacen.leer('preguntas')).map((p) => [p.id, p]));
      const repasar = sesion.preguntasIds
        .filter((id) => respuestas[id]?.correcto !== true && preguntas.has(id))
        .map((id) => {
          const p = preguntas.get(id);
          return { enunciado: p.enunciado, correcta: textoCorrecta(p), retroalimentacion: p.retroalimentacion || '' };
        });

      return {
        porcentaje,
        aprobado,
        aciertos,
        total,
        repasar,
        puntosGanados: gamificacion.puntosGanados,
        insigniasNuevas: gamificacion.insigniasNuevas
      };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
