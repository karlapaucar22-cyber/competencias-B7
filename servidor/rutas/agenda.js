// servidor/rutas/agenda.js
// Recordatorios pendientes del usuario y lectura de un evento por id con las reglas de filtrarLista
// (la API genérica por id no las aplica)

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { notificar } from '../notificar.js';
import { filtrarLista } from '../ganchos/agenda.js';

const router = Router();
const MINUTO_MS = 60 * 1000;
const TIPOS = { tarea: 'Tarea', reunion: 'Reunión', 'fecha-limite': 'Fecha límite', recordatorio: 'Recordatorio' };
const formatoDia = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' });
const formatoHora = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Guayaquil' });

// Las consultas se atienden de una en una para no avisar dos veces (varias pestañas, varios usuarios)
let cola = Promise.resolve();
const enOrden = (tarea) => {
  const resultado = cola.then(tarea);
  cola = resultado.catch(() => {});
  return resultado;
};

const inicioDe = (e) => (e.todoElDia ? new Date(`${e.inicio}T00:00:00`) : new Date(e.inicio)).getTime();
// Pasado este momento el evento ya no se recuerda: final del día (todo el día) o su inicio
const caducaEn = (e) => (e.todoElDia ? inicioDe(e) + 24 * 60 * MINUTO_MS : inicioDe(e));

function mensajeDe(e) {
  const fecha = new Date(inicioDe(e));
  const cuando = e.todoElDia ? `el ${formatoDia.format(fecha)}` : `el ${formatoDia.format(fecha)} a las ${formatoHora.format(fecha)}`;
  const accion = e.tipo === 'fecha-limite' ? 'vence' : 'es';
  return `${TIPOS[e.tipo] || 'Evento'} «${e.titulo}» ${accion} ${cuando}.`;
}

/** Recordatorios que ya llegaron (inicio − minutos) y aún no se avisaron a este usuario. */
export async function recordatoriosPendientes(usuario, ahora = Date.now()) {
  const visibles = await filtrarLista(await almacen.leer('agenda'), usuario);
  const avisos = [];
  for (const e of visibles) {
    const ya = e.avisados?.[usuario.id] || [];
    const llegados = (e.recordatorios || []).filter((m) => !ya.includes(m) && ahora >= inicioDe(e) - m * MINUTO_MS);
    if (!llegados.length || ahora >= caducaEn(e)) continue;
    // Un aviso por evento aunque hayan llegado varios recordatorios a la vez
    const mensaje = mensajeDe(e);
    const enlace = `/paginas/agenda.html?id=${encodeURIComponent(e.id)}`;
    const notificacion = await notificar(usuario.id, { tipo: 'agenda', mensaje, enlace });
    const actual = (await almacen.leer('agenda')).find((x) => x.id === e.id);
    const avisados = { ...(actual?.avisados || {}), [usuario.id]: [...new Set([...ya, ...llegados])] };
    await almacen.actualizar('agenda', e.id, { avisados });
    avisos.push({ id: notificacion.id, eventoId: e.id, titulo: e.titulo, tipo: e.tipo, mensaje, enlace, minutos: Math.min(...llegados) });
  }
  return avisos;
}

/**
 * GET /api/agenda/recordatorios → lista de avisos creados en esta consulta
 */
router.get('/agenda/recordatorios', exigirRol(), async (req, res) => {
  try {
    res.json(await enOrden(() => recordatoriosPendientes(req.usuario)));
  } catch (err) {
    console.error('Error en recordatorios de agenda:', err);
    res.status(500).json({ error: 'No se pudieron revisar los recordatorios' });
  }
});

router.get('/agenda/:id', exigirRol(), async (req, res) => {
  try {
    const evento = (await almacen.leer('agenda')).find((e) => e.id === req.params.id);
    const visible = evento && (await filtrarLista([evento], req.usuario)).length > 0;
    if (!visible) return res.status(404).json({ error: 'Evento no encontrado' });
    res.json(evento);
  } catch (err) {
    console.error('Error al leer agenda:', err);
    res.status(500).json({ error: 'No se pudo cargar el evento' });
  }
});

export default router;
