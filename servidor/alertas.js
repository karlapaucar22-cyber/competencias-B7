// servidor/alertas.js
// Alertas tempranas: promedio bajo, fallos repetidos en el quiz, inactividad y fechas límite
// vencidas (reglas-alertas.json) y, en NeuroRitmo, misión baja o pendiente (neuroritmo.json → alertas)

import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { notificar } from './notificar.js';
import { ACTIVIDADES } from '../publico/js/nucleo/catalogo-actividades.js';
import { estadoRuta, combinarReglas } from '../publico/js/nucleo/neuroritmo.js';

const SIN_NOTA = 'tema-revisado';
const DIA_MS = 24 * 60 * 60 * 1000;
const NIVELES = { 1: 'Recordar', 2: 'Comprender', 3: 'Aplicar', 4: 'Analizar', 5: 'Evaluar' };

// ---------- Cálculos puros (sin acceso a datos; se prueban en pruebas/alertas.test.js) ----------

const nota = (i) => (Number(i.maximo) > 0 ? (Number(i.puntaje) / Number(i.maximo)) * 10 : null);
const porFecha = (a, b) => String(a.fecha).localeCompare(String(b.fecha));

/**
 * Promedio (sobre 10, un decimal) de los últimos `ultimos` intentos con nota.
 * @returns {{ promedio, cantidad, ultimaFecha } | null} null si aún no hay suficientes intentos
 */
export function promedioReciente(intentos, ultimos) {
  const conNota = intentos.filter((i) => i.actividad !== SIN_NOTA && nota(i) !== null).sort(porFecha);
  if (conNota.length < ultimos) return null;
  const recientes = conNota.slice(-ultimos);
  const promedio = Math.round((recientes.reduce((s, i) => s + nota(i), 0) / recientes.length) * 10) / 10;
  return { promedio, cantidad: recientes.length, ultimaFecha: recientes.at(-1).fecha };
}

/**
 * ¿Los últimos `veces` intentos de quiz (mismo tema y nivel) están todos sin aprobar?
 * @returns {{ veces, ultimaFecha } | null}
 */
export function fallosSeguidos(intentosQuiz, veces) {
  const ordenados = [...intentosQuiz].sort(porFecha);
  if (ordenados.length < veces) return null;
  const ultimos = ordenados.slice(-veces);
  return ultimos.every((i) => i.detalle?.aprobado === false) ? { veces, ultimaFecha: ultimos.at(-1).fecha } : null;
}

/**
 * Días completos sin actividad, o null si no hay eventos.
 */
export function diasInactivo(ultimaFecha, ahora = Date.now()) {
  if (!ultimaFecha) return null;
  return Math.floor((ahora - new Date(ultimaFecha).getTime()) / DIA_MS);
}

/**
 * Momento (ms) en que vence un evento de agenda: con todoElDia, al terminar su último día.
 */
export function limiteDe(evento) {
  const valor = evento.fin || evento.inicio;
  if (evento.todoElDia) return new Date(`${valor}T00:00:00`).getTime() + DIA_MS;
  return new Date(valor).getTime();
}

/**
 * Fechas límite con actividad y tema vencidas hace más de `diasGracia` días sin un intento del
 * estudiante posterior a la creación del evento (el mismo criterio del ✓ de la agenda).
 */
export function vencidasSinIntento(eventos, intentos, diasGracia, ahora = Date.now()) {
  return eventos.filter((e) => e.tipo === 'fecha-limite' && e.actividad && e.temaId
    && ahora - limiteDe(e) > diasGracia * DIA_MS
    && !intentos.some((i) => i.actividad === e.actividad && i.temaId === e.temaId && String(i.fecha) > String(e.fecha)));
}

/**
 * ¿Ya existe esta alerta? Sí si hay una activa con la misma clave, o una atendida después de la
 * última evidencia (así no reaparece al marcarla atendida, pero sí con evidencia nueva).
 */
export function alertaRepetida(alertas, clave, evidencia) {
  return alertas.some((a) => a.estudianteId === clave.estudianteId && a.regla === clave.regla
    && a.grupoId === clave.grupoId && (a.temaId || null) === (clave.temaId || null)
    && (a.estado === 'activa' || String(a.fechaAtendida || a.fecha) >= String(evidencia || '')));
}

// ---------- Creación y aviso ----------

async function crearAlerta({ estudiante, grupo, regla, temaId = null, detalle, evidencia }) {
  const alertas = await almacen.leer('alertas');
  const clave = { estudianteId: estudiante.id, regla, grupoId: grupo.id, temaId };
  if (alertaRepetida(alertas, clave, evidencia)) return null;

  const alerta = await almacen.agregar('alertas', {
    estudianteId: estudiante.id, docenteId: grupo.docenteId, grupoId: grupo.id, regla, temaId, detalle, estado: 'activa'
  });

  // Aviso al docente del grupo (y a los admin si ajustes.alertasAdmin)
  const nombre = `${estudiante.nombre} ${estudiante.apellido}`.trim();
  const enlace = `/paginas/panel-docente.html?grupoId=${encodeURIComponent(grupo.id)}&estudiante=${encodeURIComponent(estudiante.id)}`;
  const mensaje = `${nombre} podría necesitar tu apoyo: ${detalle}`;
  const destinatarios = new Set(grupo.docenteId ? [grupo.docenteId] : []);
  if ((await almacen.leerConfig('ajustes')).alertasAdmin) {
    (await almacen.leer('usuarios')).filter((u) => u.rol === 'admin' && u.activo !== false).forEach((u) => destinatarios.add(u.id));
  }
  for (const usuarioId of destinatarios) await notificar(usuarioId, { tipo: 'alerta', mensaje, enlace });
  return alerta;
}

/**
 * Evalúa "promedioBajo" y "fallosQuiz" tras un intento del estudiante.
 * Ambas se miden dentro de la asignatura del tema del intento (la del grupo que recibe la alerta).
 */
export async function evaluarAlertas(intento, usuario) {
  if (!intento?.temaId || usuario?.rol !== 'estudiante') return null;
  const reglas = await almacen.leerConfig('reglas-alertas');
  const asignatura = await acceso.asignaturaDeTema(intento.temaId);
  const grupo = asignatura && (await almacen.leer('distributivo'))
    .find((g) => g.asignaturaId === asignatura.id && g.estudiantes?.includes(usuario.id));
  if (!grupo) return null;

  const [usuarios, temas, unidades, intentos] = await Promise.all(['usuarios', 'temas', 'unidades', 'intentos'].map((c) => almacen.leer(c)));
  const estudiante = usuarios.find((u) => u.id === usuario.id) || usuario;
  const idsUnidades = new Set(unidades.filter((u) => u.asignaturaId === asignatura.id).map((u) => u.id));
  const idsTemas = new Set(temas.filter((t) => idsUnidades.has(t.unidadId)).map((t) => t.id));
  const propios = intentos.filter((i) => i.usuarioId === usuario.id && idsTemas.has(i.temaId));
  const creadas = [];

  const pb = reglas.promedioBajo;
  if (pb?.activa) {
    const r = promedioReciente(propios, Number(pb.ultimos) || 3);
    if (r && r.promedio < Number(pb.umbral)) {
      const a = await crearAlerta({
        estudiante, grupo, regla: 'promedioBajo', evidencia: r.ultimaFecha,
        detalle: `su promedio en las últimas ${r.cantidad} actividades de «${asignatura.nombre}» es ${String(r.promedio).replace('.', ',')} sobre 10. Un mensaje de ánimo y un repaso guiado pueden ayudarle.`
      });
      if (a) creadas.push(a);
    }
  }

  const fq = reglas.fallosQuiz;
  if (fq?.activa && intento.actividad === 'quiz' && intento.nivel) {
    const delNivel = propios.filter((i) => i.actividad === 'quiz' && i.temaId === intento.temaId && Number(i.nivel) === Number(intento.nivel));
    const r = fallosSeguidos(delNivel, Number(fq.veces) || 3);
    if (r) {
      const tema = temas.find((t) => t.id === intento.temaId);
      const a = await crearAlerta({
        estudiante, grupo, regla: 'fallosQuiz', temaId: intento.temaId, evidencia: r.ultimaFecha,
        detalle: `lleva ${r.veces} intentos seguidos sin aprobar el nivel ${intento.nivel} (${NIVELES[intento.nivel] || ''}) del quiz de «${tema?.titulo || 'un tema'}». Quizá le sirva repasar el tema con tu guía.`
      });
      if (a) creadas.push(a);
    }
  }

  // NeuroRitmo (datos/config/neuroritmo.json → alertas): misión bajo el umbral tras varios intentos
  // (acompañamiento, no etiquetado)
  const mision = intento.actividad === 'neuroritmo' ? intento.detalle?.mision : null;
  const neuro = mision ? await experienciaNeuroritmo() : null;
  const mb = neuro?.alertas?.misionBaja;
  if (mb?.activa && mision) {
    const deMision = intentos.filter((i) => i.usuarioId === usuario.id && i.actividad === 'neuroritmo' && i.detalle?.mision === mision);
    const mejor = deMision.reduce((m, i) => Math.max(m, Number(i.puntaje) || 0), 0);
    // Umbral = aprobación central de NeuroRitmo (salvo que la alerta defina otro)
    const umbral = Number(mb.umbral ?? neuro.reglas.aprobacion);
    if (deMision.length >= (Number(mb.intentos) || 2) && mejor < umbral) {
      const titulo = neuro.misiones?.find((m) => m.id === mision)?.titulo || mision;
      const a = await crearAlerta({
        estudiante, grupo, regla: 'misionBaja', temaId: intento.temaId, evidencia: intento.fecha,
        detalle: `lleva ${deMision.length} intentos en la misión «${titulo}» de NeuroRitmo sin alcanzar ${umbral}/${neuro.reglas.puntosPorMision} (su mejor puntaje es ${mejor}). Revisar juntos la retroalimentación puede ayudarle.`
      });
      if (a) creadas.push(a);
    }
  }
  return creadas.length ? creadas : null;
}

async function experienciaNeuroritmo() {
  try {
    // Reglas centrales (reglas-gamificacion.json → neuroritmo) combinadas con la experiencia
    const [experiencia, gamificacion] = await Promise.all([almacen.leerConfig('neuroritmo'), almacen.leerConfig('reglas-gamificacion')]);
    return combinarReglas(experiencia, gamificacion);
  } catch {
    return null;
  }
}

/**
 * Evalúa "inactividad" (sin eventos en la bitácora en X días) y "vencidas" (fechas límite de la
 * agenda del grupo sin intento) para los estudiantes de un grupo.
 * @returns {Promise<Array<Object>>} alertas creadas
 */
export async function evaluarInactividad(grupoId) {
  const reglas = await almacen.leerConfig('reglas-alertas');
  const grupo = (await almacen.leer('distributivo')).find((g) => g.id === grupoId);
  if (!grupo) return [];
  const creadas = reglas.inactividad?.activa ? await evaluarSinActividad(grupo, reglas.inactividad) : [];
  if (reglas.vencidas?.activa) creadas.push(...(await evaluarVencidas(grupo, reglas.vencidas)));
  creadas.push(...(await evaluarMisionPendiente(grupo)));
  return creadas;
}

const hoyEcuador = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guayaquil' });
const fechaCorta = (iso) => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/**
 * NeuroRitmo, alertas de acompañamiento por grupo:
 * - misionRetrasada: el plazo que definió el docente para una misión (neuroritmo-plazos) ya pasó y el
 *   estudiante aún no la supera (solo la primera misión en esa situación; no cuenta una M3 esperando valoración).
 * - misionPendiente (sin plazo docente): misión desbloqueada sin superarse después de `dias` días.
 */
export async function evaluarMisionPendiente(grupo) {
  const experiencia = await experienciaNeuroritmo();
  if (!experiencia?.misiones || grupo.asignaturaId !== experiencia.asignaturaId) return [];
  const regla = experiencia.alertas?.misionPendiente;
  const dias = Number(regla?.dias) || 5;
  const aprobacion = experiencia.reglas.aprobacion;
  const [usuarios, intentos, partidas, entregas, todosPlazos] = await Promise.all(['usuarios', 'intentos', 'neuroritmo-partidas', 'neuroritmo-entregas', 'neuroritmo-plazos'].map((c) => almacen.leer(c)));
  const plazos = todosPlazos.find((p) => p.grupoId === grupo.id)?.plazos || {};
  const hoy = hoyEcuador();
  const creadas = [];
  for (const id of grupo.estudiantes || []) {
    const estudiante = usuarios.find((u) => u.id === id);
    if (!estudiante || estudiante.activo === false) continue;
    const propias = partidas.filter((p) => p.usuarioId === id);
    const propios = intentos.filter((i) => i.usuarioId === id && i.actividad === 'neuroritmo').sort(porFecha);
    const estado = estadoRuta(propios, entregas.filter((e) => e.usuarioId === id), experiencia);

    // Plazo docente vencido: la primera misión sin superar cuyo plazo ya pasó
    const retrasada = experiencia.misiones.find((m) => plazos[m.id] && plazos[m.id] < hoy
      && ['abierta', 'devuelta', 'bloqueada'].includes(estado.misiones[m.id]?.estado));
    if (retrasada) {
      const a = await crearAlerta({
        estudiante, grupo, regla: 'misionRetrasada', temaId: retrasada.temaId, evidencia: plazos[retrasada.id],
        detalle: `el plazo que definiste para la misión «${retrasada.titulo}» de NeuroRitmo (${fechaCorta(plazos[retrasada.id])}) ya pasó y aún no la supera (mejor puntaje ${estado.misiones[retrasada.id].mejor}/${experiencia.reglas.puntosPorMision}). Una conversación breve o un plan para el siguiente paso puede ayudarle a avanzar.`
      });
      if (a) creadas.push(a);
    }

    if (!regla?.activa || !propias.length) continue;
    for (const [indice, mision] of experiencia.misiones.entries()) {
      if (plazos[mision.id]) continue;   // con plazo docente manda misionRetrasada
      if (!['abierta', 'devuelta'].includes(estado.misiones[mision.id]?.estado)) continue;
      const desde = indice === 0
        ? propias.filter((p) => p.mision === mision.id).map((p) => p.fecha).sort()[0]
        : propios.find((i) => i.detalle?.mision === experiencia.misiones[indice - 1].id && Number(i.puntaje) >= aprobacion)?.fecha;
      const transcurridos = diasInactivo(desde);
      if (transcurridos === null || transcurridos < dias) continue;
      const a = await crearAlerta({
        estudiante, grupo, regla: 'misionPendiente', temaId: mision.temaId, evidencia: desde,
        detalle: `tiene pendiente la misión «${mision.titulo}» de NeuroRitmo desde hace ${transcurridos} días. Un mensaje de ánimo puede ayudarle a retomarla.`
      });
      if (a) creadas.push(a);
    }
  }
  return creadas;
}

async function evaluarVencidas(grupo, regla) {
  const diasGracia = Number(regla.diasGracia) || 0;
  const [usuarios, agenda, intentos, temas] = await Promise.all(['usuarios', 'agenda', 'intentos', 'temas'].map((c) => almacen.leer(c)));
  const eventos = agenda.filter((e) => e.grupoId === grupo.id);
  if (!eventos.length) return [];

  const formato = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long' });
  const creadas = [];
  for (const id of grupo.estudiantes || []) {
    const estudiante = usuarios.find((u) => u.id === id);
    if (!estudiante || estudiante.activo === false) continue;
    const propios = intentos.filter((i) => i.usuarioId === id);
    for (const e of vencidasSinIntento(eventos, propios, diasGracia)) {
      const limite = limiteDe(e);
      const actividad = ACTIVIDADES.find((a) => a.id === e.actividad)?.texto || e.actividad;
      const tema = temas.find((t) => t.id === e.temaId)?.titulo || 'un tema';
      const a = await crearAlerta({
        estudiante, grupo, regla: 'vencidas', temaId: e.temaId, evidencia: new Date(limite).toISOString(),
        detalle: `no realizó «${actividad}» de «${tema}», que vencía el ${formato.format(new Date(limite - 1))} («${e.titulo}»). Un recordatorio amable puede ayudarle a ponerse al día.`
      });
      if (a) creadas.push(a);
    }
  }
  return creadas;
}

async function evaluarSinActividad(grupo, regla) {
  const dias = Number(regla.dias) || 7;
  const [usuarios, bitacora] = await Promise.all([almacen.leer('usuarios'), almacen.leerLineas('bitacora')]);
  const ultimo = new Map();
  for (const e of bitacora) {
    if (e.usuarioId && e.fecha && String(e.fecha) > String(ultimo.get(e.usuarioId) || '')) ultimo.set(e.usuarioId, e.fecha);
  }

  const creadas = [];
  for (const id of grupo.estudiantes || []) {
    const estudiante = usuarios.find((u) => u.id === id);
    if (!estudiante || estudiante.activo === false) continue;
    const ultimaFecha = ultimo.get(id) || null;
    const sinActividad = diasInactivo(ultimaFecha);
    if (sinActividad !== null && sinActividad < dias) continue;
    const a = await crearAlerta({
      estudiante, grupo, regla: 'inactividad', evidencia: ultimaFecha,
      detalle: ultimaFecha
        ? `no ha ingresado a la plataforma en ${sinActividad} días. Un mensaje cercano puede animarle a retomar.`
        : 'aún no ha ingresado a la plataforma. Un mensaje de bienvenida puede animarle a empezar.'
    });
    if (a) creadas.push(a);
  }
  return creadas;
}

export default {
  evaluarAlertas,
  evaluarInactividad
};
