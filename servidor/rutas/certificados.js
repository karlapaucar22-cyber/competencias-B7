// servidor/rutas/certificados.js
// Certificados: estado de las condiciones, emisión (cumplimiento y nivel de quiz) y verificación pública

import { Router } from 'express';
import crypto from 'node:crypto';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { exigirRol } from '../auth.js';
import { leerExperiencia, estadoDe } from './neuroritmo.js';

const router = Router();

const NIVELES = { 1: 'Recordar', 2: 'Comprender', 3: 'Aplicar', 4: 'Analizar', 5: 'Evaluar' };
const TIPOS = ['cumplimiento', 'nivel-quiz', 'neuroritmo'];
const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const FORMATO_CODIGO = /^EE-\d{4}-[A-Z0-9]{6}$/;

function error(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  return err;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en certificados:', err);
  res.status(estado).json({ error: err.message || 'Error en certificados', ...(err.requisitos ? { requisitos: err.requisitos } : {}) });
}

// Un certificado a la vez por usuario (evita duplicados por doble clic)
const bloqueos = new Map();
function conBloqueo(clave, tarea) {
  const actual = (bloqueos.get(clave) || Promise.resolve()).catch(() => {}).then(tarea);
  bloqueos.set(clave, actual);
  actual.finally(() => { if (bloqueos.get(clave) === actual) bloqueos.delete(clave); }).catch(() => {});
  return actual;
}

// Temas publicados (en unidades visibles) de las asignaturas del estudiante
async function temasPublicados(usuario) {
  const idsAsignaturas = new Set((await acceso.asignaturasDe(usuario)).map((a) => a.id));
  const idsUnidades = new Set((await almacen.leer('unidades'))
    .filter((u) => idsAsignaturas.has(u.asignaturaId) && u.visible !== false).map((u) => u.id));
  return (await almacen.leer('temas')).filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado');
}

async function logroDe(usuarioId) {
  return (await almacen.leer('logros')).find((l) => l.usuarioId === usuarioId) || { puntos: 0, nivelQuiz: {} };
}

/**
 * Condiciones de reglas-gamificacion.json → certificado, calculadas para el estudiante.
 */
async function evaluarCondiciones(usuario) {
  const reglas = (await almacen.leerConfig('reglas-gamificacion')).certificado || {};
  const nivelRequerido = Number(reglas.nivelQuizRequerido) || 5;
  const temasRequeridos = Number(reglas.temasConNivelRequerido) || 1;
  const puntosMinimos = Number(reglas.puntosMinimos) || 0;
  const pctRequerido = Number(reglas.temasRevisadosPct) || 0;

  const temas = await temasPublicados(usuario);
  const idsTemas = new Set(temas.map((t) => t.id));
  const logro = await logroDe(usuario.id);
  const temasConNivel = Object.entries(logro.nivelQuiz || {})
    .filter(([temaId, nivel]) => idsTemas.has(temaId) && Number(nivel) >= nivelRequerido).length;
  const revisados = new Set((await almacen.leer('progreso-temas'))
    .filter((p) => p.usuarioId === usuario.id && idsTemas.has(p.temaId)).map((p) => p.temaId)).size;
  const pctRevisados = temas.length ? Math.round((revisados / temas.length) * 100) : 0;
  const puntos = Number(logro.puntos) || 0;

  const condiciones = [
    { nombre: `Temas con el nivel ${nivelRequerido} (${NIVELES[nivelRequerido] || ''}) del quiz aprobado`, actual: temasConNivel, requerido: temasRequeridos },
    { nombre: 'Puntos acumulados', actual: puntos, requerido: puntosMinimos },
    { nombre: 'Temas revisados (%)', actual: pctRevisados, requerido: pctRequerido }
  ].map((c) => ({ ...c, cumple: c.actual >= c.requerido }));
  // Sin temas publicados no hay nada que certificar
  if (!temas.length) condiciones[2].cumple = false;

  return { condiciones, cumple: condiciones.every((c) => c.cumple), resumen: { puntos, pctRevisados, temasConNivel, nivelRequerido } };
}

async function codigoUnico() {
  const existentes = new Set((await almacen.leer('certificados')).map((c) => c.codigo));
  const anio = new Date().getFullYear();
  for (;;) {
    const sufijo = Array.from({ length: 6 }, () => CARACTERES[crypto.randomInt(CARACTERES.length)]).join('');
    const codigo = `EE-${anio}-${sufijo}`;
    if (!existentes.has(codigo)) return codigo;
  }
}

const publico = ({ codigo, tipo, detalle, nombreCompleto, fecha, puntuacion, misiones, insignias, huella }) => ({
  codigo, tipo, detalle, nombreCompleto, fecha, ...(puntuacion ? { puntuacion, misiones, insignias, huella } : {})
});

/**
 * Huella de integridad del certificado NeuroRitmo: SHA-256 de código, nombre, fecha, puntuación e insignias.
 * La verificación pública la recalcula para comprobar que los datos no cambiaron.
 */
export function huellaDe({ codigo, nombreCompleto, fecha, puntuacion, misiones, insignias }) {
  const base = JSON.stringify({ codigo, nombreCompleto, fecha, puntuacion, misiones, insignias });
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 16).toUpperCase();
}

/**
 * Requisito combinado de NeuroRitmo (obligatorio en el servidor): M1, M2 y M3 con la aprobación central,
 * total mínimo y M3 validada por el docente. Devuelve el estado de la ruta y los cinco requisitos.
 */
export async function requisitosNeuroritmo(usuarioId) {
  const experiencia = await leerExperiencia();
  const estado = await estadoDe(usuarioId, experiencia);
  const requisitos = estado.condiciones;
  return { experiencia, estado, requisitos, cumple: requisitos.length === 5 && requisitos.every((c) => c.cumple) };
}

/**
 * GET /api/certificados/estado
 */
router.get('/certificados/estado', exigirRol('estudiante'), async (req, res) => {
  try {
    // ?tipo=neuroritmo → los cinco requisitos de la ruta con su valor actual
    if (req.query.tipo === 'neuroritmo') {
      const { requisitos, cumple, estado } = await requisitosNeuroritmo(req.usuario.id);
      return res.json({ condiciones: requisitos, cumple, total: estado.total, maximo: estado.maximo });
    }
    const { condiciones, cumple } = await evaluarCondiciones(req.usuario);
    res.json({ condiciones, cumple });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/certificados { tipo, temaId?, nivel? } → certificado nuevo o el ya emitido
 */
router.post('/certificados', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const resultado = await conBloqueo(usuario.id, async () => {
      const { tipo } = req.body || {};
      if (!TIPOS.includes(tipo)) throw error('El tipo debe ser "cumplimiento", "nivel-quiz" o "neuroritmo"', 400);

      let detalle, temaId = null, nivel = null, neuro = null;
      if (tipo === 'neuroritmo') {
        // Ruta NeuroRitmo completada: requisito combinado obligatorio; si falta algo no se emite documento
        const { experiencia, estado, requisitos, cumple } = await requisitosNeuroritmo(usuario.id);
        if (!cumple) {
          const err = error(`Aún no completas la ruta NeuroRitmo. Falta: ${requisitos.filter((c) => !c.cumple).map((c) => c.texto).join('; ')}`, 403);
          err.requisitos = requisitos;
          throw err;
        }
        const r = experiencia.reglas;
        const obtenidas = new Set((((await almacen.leer('logros')).find((l) => l.usuarioId === usuario.id))?.insignias || []).map((i) => i.id));
        neuro = {
          puntuacion: { m1: estado.misiones.m1.mejor, m2: estado.misiones.m2.mejor, m3: estado.misiones.m3.mejor, total: estado.total, maximo: r.maximoRuta, aprobacion: r.aprobacion, logroTotal: r.logroTotal },
          misiones: experiencia.misiones.map((m) => ({ id: m.id, titulo: m.titulo, puntaje: estado.misiones[m.id].mejor, maximo: r.puntosPorMision })),
          insignias: (await almacen.leer('insignias')).filter((i) => i.grupo === 'neuroritmo' && obtenidas.has(i.id)).map((i) => i.nombre)
        };
        detalle = `Completó la ruta «${experiencia.titulo}» con ${estado.total}/${r.maximoRuta} puntos. `
          + `Misiones superadas: ${neuro.misiones.map((m) => `${m.titulo} (${m.puntaje}/${m.maximo})`).join(', ')}. `
          + `Misión 3 validada por el docente. Insignias: ${neuro.insignias.join(', ') || 'ninguna'}.`;
      } else if (tipo === 'nivel-quiz') {
        temaId = req.body.temaId;
        nivel = Number(req.body.nivel);
        if (!Number.isInteger(nivel) || !NIVELES[nivel]) throw error('El nivel debe ser un número de 1 a 5', 400);
        const tema = (await temasPublicados(usuario)).find((t) => t.id === temaId);
        if (!tema) throw error('El tema no existe o no tienes acceso a él', 404);
        if ((Number((await logroDe(usuario.id)).nivelQuiz?.[temaId]) || 0) < nivel) {
          throw error(`Aún no apruebas el nivel ${nivel} del quiz de este tema`, 403);
        }
        detalle = `Aprobó el nivel ${nivel} (${NIVELES[nivel]}) del quiz del tema «${tema.titulo}».`;
      } else {
        const estado = await evaluarCondiciones(usuario);
        if (!estado.cumple) {
          const faltan = estado.condiciones.filter((c) => !c.cumple).map((c) => `${c.nombre}: ${c.actual} de ${c.requerido}`);
          throw error(`Aún no cumples las condiciones del certificado (${faltan.join('; ')})`, 403);
        }
        const { puntos, pctRevisados, temasConNivel, nivelRequerido } = estado.resumen;
        detalle = `Cumplió la ruta de aprendizaje con ${puntos} puntos, el ${pctRevisados} % de los temas revisados `
          + `y el nivel ${nivelRequerido} del quiz aprobado en ${temasConNivel} tema${temasConNivel === 1 ? '' : 's'}.`;
      }

      // Si ya existe uno igual, se devuelve el mismo
      const previo = (await almacen.leer('certificados')).find((c) => c.usuarioId === usuario.id && c.tipo === tipo
        && (tipo !== 'nivel-quiz' || (c.temaId === temaId && Number(c.nivel) === nivel)));
      if (previo) return { estado: 200, certificado: previo };

      const persona = (await almacen.leer('usuarios')).find((u) => u.id === usuario.id) || usuario;
      const nombreCompleto = [persona.nombre, persona.apellido].filter(Boolean).join(' ').trim();
      let certificado = await almacen.agregar('certificados', {
        codigo: await codigoUnico(), usuarioId: usuario.id, tipo, detalle, nombreCompleto, temaId, nivel, ...(neuro || {})
      });
      // NeuroRitmo: huella sobre los datos ya guardados (incluye la fecha que asigna el almacén)
      if (neuro) certificado = await almacen.actualizar('certificados', certificado.id, { huella: huellaDe(certificado) });
      return { estado: 201, certificado };
    });
    res.status(resultado.estado).json(publico(resultado.certificado));
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/certificados/verificar/:codigo (sin sesión)
 */
router.get('/certificados/verificar/:codigo', async (req, res) => {
  try {
    const codigo = String(req.params.codigo || '').trim().toUpperCase();
    const certificado = FORMATO_CODIGO.test(codigo)
      ? (await almacen.leer('certificados')).find((c) => c.codigo === codigo)
      : null;
    if (!certificado) return res.json({ valido: false });
    const { nombreCompleto, detalle, fecha, tipo, puntuacion, misiones, insignias, huella } = certificado;
    // NeuroRitmo: puntuación verificable y comprobación de la huella de integridad
    const neuro = puntuacion ? { tipo, puntuacion, misiones, insignias, huella, integro: huella === huellaDe(certificado) } : {};
    res.json({ valido: true, nombreCompleto, detalle, fecha, ...neuro });
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
