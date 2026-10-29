// servidor/rutas/resumen.js
// Resúmenes de progreso por estudiante y por grupo (cada colección se lee una sola vez por petición)

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { evaluarInactividad } from '../alertas.js';

const router = Router();

const ZONA_HORARIA = 'America/Guayaquil';
const SIN_NOTA = 'tema-revisado';          // no cuenta para promedios
const PAUSA_MAX_MS = 30 * 60 * 1000;       // más de 30 min sin eventos = otra sesión
const SEMANAS = 8;
const ULTIMOS = 20;

function error(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  return err;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en resumen:', err);
  res.status(estado).json({ error: err.message || 'Error al calcular el resumen' });
}

// Lectura única de todas las fuentes de la petición
async function cargarDatos() {
  const cols = ['usuarios', 'distributivo', 'asignaturas', 'unidades', 'temas', 'intentos', 'progreso-temas', 'logros', 'alertas'];
  const [listas, bitacora] = await Promise.all([
    Promise.all(cols.map((c) => almacen.leer(c))),
    almacen.leerLineas('bitacora')
  ]);
  const d = Object.fromEntries(cols.map((c, i) => [c, listas[i]]));
  d.bitacora = bitacora;
  d.temaPorId = new Map(d.temas.map((t) => [t.id, t]));
  d.unidadPorId = new Map(d.unidades.map((u) => [u.id, u]));
  return d;
}

// ---------- Cálculos ----------

const redondear = (n) => Math.round(n * 10) / 10;
const nota = (i) => (Number(i.maximo) > 0 ? (Number(i.puntaje) / Number(i.maximo)) * 10 : null);
const conNota = (intentos) => intentos.filter((i) => i.actividad !== SIN_NOTA && nota(i) !== null);

function promedio(intentos) {
  const notas = conNota(intentos).map(nota);
  return notas.length ? redondear(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
}

function agrupar(intentos, clave) {
  const grupos = new Map();
  for (const i of conNota(intentos)) {
    const k = i[clave];
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  }
  return grupos;
}

// Lunes de la semana (fecha local de Ecuador) en formato AAAA-MM-DD
function semanaDe(fechaIso) {
  const local = new Date(new Date(fechaIso).toLocaleDateString('sv-SE', { timeZone: ZONA_HORARIA }) + 'T00:00:00Z');
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}

// Temas publicados en unidades visibles de las asignaturas indicadas, en orden
function temasPublicados(d, idsAsignaturas) {
  const orden = (x) => Number(x.orden) || 0;
  return d.temas
    .filter((t) => {
      const u = d.unidadPorId.get(t.unidadId);
      return t.estado === 'publicado' && u && u.visible !== false && idsAsignaturas.has(u.asignaturaId);
    })
    .sort((a, b) => {
      const ua = d.unidadPorId.get(a.unidadId), ub = d.unidadPorId.get(b.unidadId);
      return ua.asignaturaId.localeCompare(ub.asignaturaId) || orden(ua) - orden(ub) || orden(a) - orden(b);
    });
}

function conexion(d, usuarioId) {
  const fechas = d.bitacora.filter((e) => e.usuarioId === usuarioId && e.fecha)
    .map((e) => new Date(e.fecha).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  let tiempoMs = 0;
  for (let i = 1; i < fechas.length; i++) {
    const pausa = fechas[i] - fechas[i - 1];
    if (pausa <= PAUSA_MAX_MS) tiempoMs += pausa;
  }
  return {
    ultimaConexion: fechas.length ? new Date(fechas.at(-1)).toISOString() : null,
    tiempoMin: Math.round(tiempoMs / 60000)
  };
}

function porTema(d, intentos, temasBase = null) {
  const grupos = agrupar(intentos, 'temaId');
  const ids = temasBase ? temasBase.map((t) => t.id) : [...grupos.keys()];
  return ids.map((temaId) => ({
    temaId,
    titulo: d.temaPorId.get(temaId)?.titulo || '(tema eliminado)',
    promedio: promedio(grupos.get(temaId) || []),
    intentos: (grupos.get(temaId) || []).length
  }));
}

// ---------- Acceso ----------

function grupoDeEstudiante(d, estudianteId) {
  return d.distributivo.filter((g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId));
}

function verificarAccesoEstudiante(d, usuario, estudiante) {
  if (usuario.rol === 'admin' || usuario.id === estudiante.id) return;
  if (usuario.rol === 'docente' && grupoDeEstudiante(d, estudiante.id).some((g) => g.docenteId === usuario.id)) return;
  throw error('No tienes acceso al progreso de este estudiante', 403);
}

/**
 * GET /api/resumen/estudiante/:id ("yo" permitido)
 */
router.get('/resumen/estudiante/:id', exigirRol(), async (req, res) => {
  try {
    const d = await cargarDatos();
    const id = req.params.id === 'yo' ? req.usuario.id : req.params.id;
    const estudiante = d.usuarios.find((u) => u.id === id && u.rol === 'estudiante');
    if (!estudiante) {
      // Un usuario sin acceso no debe poder averiguar qué ids existen
      if (req.usuario.rol !== 'admin' && req.usuario.id !== id) throw error('No tienes acceso al progreso de este estudiante', 403);
      throw error('Estudiante no encontrado', 404);
    }
    verificarAccesoEstudiante(d, req.usuario, estudiante);

    const idsAsignaturas = new Set(grupoDeEstudiante(d, id).map((g) => g.asignaturaId));
    const temas = temasPublicados(d, idsAsignaturas);
    const revisados = new Set(d['progreso-temas'].filter((p) => p.usuarioId === id).map((p) => p.temaId));
    const intentos = d.intentos.filter((i) => i.usuarioId === id)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const logro = d.logros.find((l) => l.usuarioId === id);

    const porSemana = new Map();
    for (const i of conNota(intentos)) {
      const s = semanaDe(i.fecha);
      if (!porSemana.has(s)) porSemana.set(s, []);
      porSemana.get(s).push(i);
    }

    res.json({
      puntos: Number(logro?.puntos) || 0,
      nivelQuizMax: Math.max(0, ...Object.values(logro?.nivelQuiz || {}).map(Number).filter(Number.isFinite)),
      pctTemas: temas.length ? Math.round((temas.filter((t) => revisados.has(t.id)).length / temas.length) * 100) : 0,
      promedio: promedio(intentos),
      porActividad: [...agrupar(intentos, 'actividad')].map(([actividad, lista]) => ({ actividad, promedio: promedio(lista), intentos: lista.length }))
        .sort((a, b) => a.actividad.localeCompare(b.actividad)),
      porTema: porTema(d, intentos),
      evolucion: [...porSemana].sort(([a], [b]) => a.localeCompare(b)).slice(-SEMANAS)
        .map(([semana, lista]) => ({ semana, promedio: promedio(lista) })),
      pendientes: temas.filter((t) => !revisados.has(t.id)).map((t) => ({ temaId: t.id, titulo: t.titulo })),
      ...conexion(d, id),
      ultimosIntentos: intentos.slice(-ULTIMOS).reverse().map((i) => ({
        id: i.id, actividad: i.actividad, temaId: i.temaId, titulo: d.temaPorId.get(i.temaId)?.titulo || null,
        nivel: i.nivel, puntaje: i.puntaje, maximo: i.maximo,
        nota: i.actividad === SIN_NOTA ? null : (nota(i) === null ? null : redondear(nota(i))),
        puntos: i.puntos, duracionSeg: i.duracionSeg, fecha: i.fecha
      }))
    });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/resumen/grupo/:grupoId (docente del grupo o admin)
 */
router.get('/resumen/grupo/:grupoId', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const grupoPrevio = (await almacen.leer('distributivo')).find((g) => g.id === req.params.grupoId);
    if (!grupoPrevio) throw error('Grupo no encontrado', 404);
    if (req.usuario.rol !== 'admin' && grupoPrevio.docenteId !== req.usuario.id) throw error('No eres docente de este grupo', 403);

    // Alertas de inactividad antes de calcular, para que el resumen ya las cuente
    try {
      await evaluarInactividad(grupoPrevio.id);
    } catch (err) {
      console.error('No se pudo evaluar la inactividad:', err);
    }

    const d = await cargarDatos();
    const grupo = d.distributivo.find((g) => g.id === req.params.grupoId);

    // Todo se calcula sobre la asignatura del grupo
    const temas = temasPublicados(d, new Set([grupo.asignaturaId]));
    const idsTemas = new Set(temas.map((t) => t.id));
    const idsEstudiantes = new Set(grupo.estudiantes || []);
    const intentosGrupo = d.intentos.filter((i) => idsEstudiantes.has(i.usuarioId) && idsTemas.has(i.temaId));
    const asignatura = d.asignaturas.find((a) => a.id === grupo.asignaturaId);
    const docente = d.usuarios.find((u) => u.id === grupo.docenteId);

    const estudiantes = (grupo.estudiantes || [])
      .map((id) => d.usuarios.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => {
        const propios = intentosGrupo.filter((i) => i.usuarioId === u.id);
        const revisados = new Set(d['progreso-temas'].filter((p) => p.usuarioId === u.id && idsTemas.has(p.temaId)).map((p) => p.temaId));
        return {
          id: u.id,
          nombre: u.nombre,
          apellido: u.apellido,
          promedio: promedio(propios),
          actividades: conNota(propios).length,
          pctTemas: temas.length ? Math.round((revisados.size / temas.length) * 100) : 0,
          ultimaConexion: conexion(d, u.id).ultimaConexion,
          alertasActivas: d.alertas.filter((a) => a.estudianteId === u.id && a.estado === 'activa' && (!a.grupoId || a.grupoId === grupo.id)).length
        };
      })
      .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'));

    res.json({
      grupo: {
        id: grupo.id,
        asignaturaId: grupo.asignaturaId,
        asignatura: asignatura?.nombre || '',
        paralelo: grupo.paralelo,
        periodo: grupo.periodo,
        docente: docente ? `${docente.nombre} ${docente.apellido}` : '',
        totalEstudiantes: estudiantes.length,
        totalTemas: temas.length
      },
      estudiantes,
      porTema: porTema(d, intentosGrupo, temas)
    });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/resumen/tutor/:grupoId (docente del grupo o admin)
 * → { porTema: [{ temaId, titulo, consultas }], porEstudiante: [{ id, nombre, consultas }] }
 * Consultas = mensajes enviados al tutor por los estudiantes del grupo en los temas de su asignatura.
 */
router.get('/resumen/tutor/:grupoId', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const [distributivo, usuarios, unidades, temas, consultas] = await Promise.all(
      ['distributivo', 'usuarios', 'unidades', 'temas', 'consultas-tutor'].map((c) => almacen.leer(c)));
    const grupo = distributivo.find((g) => g.id === req.params.grupoId);
    if (!grupo) throw error('Grupo no encontrado', 404);
    if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) throw error('No eres docente de este grupo', 403);

    const idsUnidades = new Set(unidades.filter((u) => u.asignaturaId === grupo.asignaturaId).map((u) => u.id));
    const unidadPorId = new Map(unidades.map((u) => [u.id, u]));
    const temasAsignatura = temas.filter((t) => idsUnidades.has(t.unidadId));
    const idsTemas = new Set(temasAsignatura.map((t) => t.id));
    const idsEstudiantes = new Set(grupo.estudiantes || []);
    const delGrupo = consultas.filter((c) => idsEstudiantes.has(c.usuarioId) && idsTemas.has(c.temaId));

    const sumar = (lista) => lista.reduce((s, c) => s + (Number(c.mensajes) || 0), 0);
    const orden = (x) => Number(x?.orden) || 0;
    const porTemaTutor = temasAsignatura
      .map((t) => ({ temaId: t.id, titulo: t.titulo, consultas: sumar(delGrupo.filter((c) => c.temaId === t.id)), publicado: t.estado === 'publicado', t }))
      .filter((x) => x.publicado || x.consultas > 0)
      .sort((a, b) => b.consultas - a.consultas
        || orden(unidadPorId.get(a.t.unidadId)) - orden(unidadPorId.get(b.t.unidadId)) || orden(a.t) - orden(b.t))
      .map(({ temaId, titulo, consultas: n }) => ({ temaId, titulo, consultas: n }));

    const porEstudiante = [...idsEstudiantes]
      .map((id) => usuarios.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u.id, nombre: `${u.nombre} ${u.apellido}`.trim(), consultas: sumar(delGrupo.filter((c) => c.usuarioId === u.id)) }))
      .sort((a, b) => b.consultas - a.consultas || a.nombre.localeCompare(b.nombre, 'es'));

    res.json({ porTema: porTemaTutor, porEstudiante });
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
