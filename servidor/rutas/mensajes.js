// servidor/rutas/mensajes.js
// Mensajería 1 a 1: contactos permitidos, conversaciones, mensajes (datos/mensajes/<convId>.json),
// leídos, difusión del docente, bloqueos y moderación del admin.
// Las rutas fijas van antes de /mensajes/:convId.

import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { exigirRol } from '../auth.js';

const router = Router();
const MAX_TEXTO = 2000;
const MAX_VISTA_PREVIA = 120;
const POR_PAGINA = 50;
const LIMITE_MINUTO = 30;
const ANTERIORES_REPORTE = 5;
const ID_CONVERSACION = /^con_\d{6}$/;
const REFERENCIA = /^(con_\d{6})\/(men_\d{6})$/;

// ---------- Utilidades ----------

function error(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  return err;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en mensajes:', err);
  res.status(estado).json({ error: estado === 500 ? 'Error en la mensajería' : err.message });
}

// Los cambios se aplican de uno en uno (evita conversaciones duplicadas y leidoHasta perdidos)
let cola = Promise.resolve();
function enOrden(tarea) {
  const resultado = cola.then(tarea);
  cola = resultado.catch(() => {});
  return resultado;
}

// Máximo de mensajes por minuto por usuario (en memoria)
const envios = new Map();
function controlarRitmo(usuarioId, ahora = Date.now()) {
  const recientes = (envios.get(usuarioId) || []).filter((t) => ahora - t < 60000);
  if (recientes.length >= LIMITE_MINUTO) {
    envios.set(usuarioId, recientes);
    throw error(`Estás enviando muchos mensajes seguidos. Espera un momento (máximo ${LIMITE_MINUTO} por minuto).`, 429);
  }
  recientes.push(ahora);
  envios.set(usuarioId, recientes);
}

const publico = (u) => (u ? { id: u.id, nombre: u.nombre, apellido: u.apellido, rol: u.rol, foto: u.foto || '' } : null);
const activo = (u) => u && u.activo !== false;
const porNombre = (a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es');
const colMensajes = (convId) => `mensajes/${convId}`;

function validarTexto(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw error('Escribe un mensaje', 400);
  if (texto.length > MAX_TEXTO) throw error(`El mensaje no puede superar ${MAX_TEXTO.toLocaleString('es-EC')} caracteres`, 400);
  return texto.trim();
}

const hayBloqueo = (bloqueos, a, b) => bloqueos.some((x) => (x.usuarioId === a && x.bloqueadoId === b) || (x.usuarioId === b && x.bloqueadoId === a));

/** Contactos con los que el usuario puede iniciar una conversación (sin bloqueos en ningún sentido). */
export async function contactosDe(usuario) {
  const [usuarios, bloqueos, ajustes, distributivo] = await Promise.all([
    almacen.leer('usuarios'), almacen.leer('bloqueos'), almacen.leerConfig('ajustes'), almacen.leer('distributivo')
  ]);
  let ids = new Set();
  if (usuario.rol === 'admin') {
    ids = new Set(usuarios.map((u) => u.id));
  } else if (usuario.rol === 'docente') {
    (await acceso.estudiantesDe(usuario.id)).forEach((u) => ids.add(u.id));
    usuarios.filter((u) => u.rol === 'docente').forEach((u) => ids.add(u.id));
  } else if (usuario.rol === 'estudiante') {
    (await acceso.docentesDe(usuario.id)).forEach((u) => ids.add(u.id));
    if (ajustes.chatEntreEstudiantes) {
      distributivo.filter((g) => g.estudiantes?.includes(usuario.id)).forEach((g) => g.estudiantes.forEach((id) => ids.add(id)));
    }
  }
  ids.delete(usuario.id);
  return usuarios
    .filter((u) => ids.has(u.id) && activo(u) && !hayBloqueo(bloqueos, usuario.id, u.id))
    .sort(porNombre)
    .map(publico);
}

async function conversacionDe(convId, usuario) {
  if (!ID_CONVERSACION.test(convId)) throw error('Conversación no encontrada', 404);
  const conversacion = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
  if (!conversacion) throw error('Conversación no encontrada', 404);
  if (!conversacion.participantes.includes(usuario.id)) throw error('No participas en esta conversación', 403);
  return conversacion;
}

const otroDe = (conversacion, usuarioId) => conversacion.participantes.find((id) => id !== usuarioId);

function noLeidosDe(mensajes, conversacion, usuarioId) {
  const desde = String(conversacion.leidoHasta?.[usuarioId] || '');
  return mensajes.filter((m) => !m.oculto && m.autorId !== usuarioId && String(m.fecha) > desde).length;
}

async function resumenConversacion(conversacion, usuario, usuarios, bloqueos) {
  const otroId = otroDe(conversacion, usuario.id);
  const otro = usuarios.find((u) => u.id === otroId);
  const mensajes = await almacen.leer(colMensajes(conversacion.id));
  return {
    id: conversacion.id,
    otro: publico(otro) || { id: otroId, nombre: 'Usuario', apellido: 'no disponible', rol: '', foto: '' },
    ultimo: conversacion.ultimo || null,
    noLeidos: noLeidosDe(mensajes, conversacion, usuario.id),
    bloqueado: hayBloqueo(bloqueos, usuario.id, otroId),
    bloqueadoPorMi: bloqueos.some((b) => b.usuarioId === usuario.id && b.bloqueadoId === otroId),
    fecha: conversacion.fecha
  };
}

// Busca la conversación entre dos usuarios o la crea (llamar dentro de enOrden)
async function buscarOCrear(a, b) {
  const existente = (await almacen.leer('conversaciones'))
    .find((c) => c.participantes.length === 2 && c.participantes.includes(a) && c.participantes.includes(b));
  if (existente) return { conversacion: existente, creada: false };
  const conversacion = await almacen.agregar('conversaciones', { participantes: [a, b].sort(), ultimo: null, leidoHasta: {} });
  return { conversacion, creada: true };
}

// Agrega un mensaje y actualiza "ultimo" y leidoHasta del autor (llamar dentro de enOrden)
async function publicarMensaje(conversacion, autorId, texto) {
  const mensaje = await almacen.agregar(colMensajes(conversacion.id), { autorId, texto, oculto: false });
  const actual = (await almacen.leer('conversaciones')).find((c) => c.id === conversacion.id);
  await almacen.actualizar('conversaciones', conversacion.id, {
    ultimo: { texto: texto.slice(0, MAX_VISTA_PREVIA), fecha: mensaje.fecha, autorId },
    leidoHasta: { ...(actual?.leidoHasta || {}), [autorId]: mensaje.fecha }
  });
  return mensaje;
}

const vistaMensaje = (m) => ({ id: m.id, autorId: m.autorId, texto: m.texto, fecha: m.fecha });

// ---------- Rutas fijas ----------

/** GET /api/mensajes/contactos → [{ id, nombre, apellido, rol, foto }] */
router.get('/mensajes/contactos', exigirRol(), async (req, res) => {
  try {
    res.json(await contactosDe(req.usuario));
  } catch (err) {
    responderError(res, err);
  }
});

/** GET /api/mensajes/conversaciones → mis conversaciones, la más reciente primero */
router.get('/mensajes/conversaciones', exigirRol(), async (req, res) => {
  try {
    const [conversaciones, usuarios, bloqueos] = await Promise.all([almacen.leer('conversaciones'), almacen.leer('usuarios'), almacen.leer('bloqueos')]);
    const mias = conversaciones.filter((c) => c.participantes.includes(req.usuario.id));
    const lista = await Promise.all(mias.map((c) => resumenConversacion(c, req.usuario, usuarios, bloqueos)));
    lista.sort((a, b) => String(b.ultimo?.fecha || b.fecha).localeCompare(String(a.ultimo?.fecha || a.fecha)));
    res.json(lista);
  } catch (err) {
    responderError(res, err);
  }
});

/** POST /api/mensajes/conversaciones { con } → busca o crea la conversación con un contacto permitido */
router.post('/mensajes/conversaciones', exigirRol(), async (req, res) => {
  try {
    const con = req.body?.con;
    if (typeof con !== 'string' || !con) throw error('Indica con quién quieres conversar', 400);
    if (!(await contactosDe(req.usuario)).some((c) => c.id === con)) throw error('No puedes iniciar una conversación con esta persona', 403);
    const { conversacion, creada } = await enOrden(() => buscarOCrear(req.usuario.id, con));
    const [usuarios, bloqueos] = await Promise.all([almacen.leer('usuarios'), almacen.leer('bloqueos')]);
    res.status(creada ? 201 : 200).json(await resumenConversacion(conversacion, req.usuario, usuarios, bloqueos));
  } catch (err) {
    responderError(res, err);
  }
});

/** GET /api/mensajes/no-leidos → { total } */
router.get('/mensajes/no-leidos', exigirRol(), async (req, res) => {
  try {
    const mias = (await almacen.leer('conversaciones')).filter((c) => c.participantes.includes(req.usuario.id));
    const cuentas = await Promise.all(mias.map(async (c) => noLeidosDe(await almacen.leer(colMensajes(c.id)), c, req.usuario.id)));
    res.json({ total: cuentas.reduce((s, n) => s + n, 0) });
  } catch (err) {
    responderError(res, err);
  }
});

/** POST /api/mensajes/difusion { grupoId, texto } → el docente del grupo escribe a cada estudiante */
router.post('/mensajes/difusion', exigirRol('docente'), async (req, res) => {
  try {
    const { grupoId } = req.body || {};
    const grupo = (await almacen.leer('distributivo')).find((g) => g.id === grupoId);
    if (!grupo) throw error('Grupo no encontrado', 404);
    if (grupo.docenteId !== req.usuario.id) throw error('Solo el docente del grupo puede enviar una difusión', 403);
    const texto = validarTexto(req.body.texto);
    controlarRitmo(req.usuario.id);

    const [usuarios, bloqueos] = await Promise.all([almacen.leer('usuarios'), almacen.leer('bloqueos')]);
    const resultado = await enOrden(async () => {
      const enviados = [];
      const omitidos = [];
      for (const id of grupo.estudiantes || []) {
        const estudiante = usuarios.find((u) => u.id === id);
        if (!activo(estudiante) || hayBloqueo(bloqueos, req.usuario.id, id)) {
          omitidos.push(id);
          continue;
        }
        const { conversacion } = await buscarOCrear(req.usuario.id, id);
        await publicarMensaje(conversacion, req.usuario.id, texto);
        enviados.push({ usuarioId: id, conversacionId: conversacion.id });
      }
      return { enviados, omitidos };
    });
    res.status(201).json({ total: resultado.enviados.length, ...resultado });
  } catch (err) {
    responderError(res, err);
  }
});

/** POST /api/mensajes/bloquear { usuarioId } */
router.post('/mensajes/bloquear', exigirRol(), async (req, res) => {
  try {
    const { usuarioId } = req.body || {};
    if (usuarioId === req.usuario.id) throw error('No puedes bloquearte a ti mismo', 400);
    if (!(await almacen.leer('usuarios')).some((u) => u.id === usuarioId)) throw error('Usuario no encontrado', 404);
    const bloqueo = await enOrden(async () => {
      const existente = (await almacen.leer('bloqueos')).find((b) => b.usuarioId === req.usuario.id && b.bloqueadoId === usuarioId);
      return existente || almacen.agregar('bloqueos', { usuarioId: req.usuario.id, bloqueadoId: usuarioId });
    });
    res.status(201).json({ bloqueado: true, id: bloqueo.id });
  } catch (err) {
    responderError(res, err);
  }
});

/** DELETE /api/mensajes/bloquear/:usuarioId → quita mi bloqueo */
router.delete('/mensajes/bloquear/:usuarioId', exigirRol(), async (req, res) => {
  try {
    const quitado = await enOrden(async () => {
      const lista = await almacen.leer('bloqueos');
      const restantes = lista.filter((b) => !(b.usuarioId === req.usuario.id && b.bloqueadoId === req.params.usuarioId));
      if (restantes.length === lista.length) return false;
      await almacen.escribir('bloqueos', restantes);
      return true;
    });
    if (!quitado) throw error('No tenías bloqueada a esta persona', 404);
    res.json({ bloqueado: false });
  } catch (err) {
    responderError(res, err);
  }
});

/** GET /api/mensajes/reporte/:reporteId (admin) → el mensaje reportado y los 5 anteriores */
router.get('/mensajes/reporte/:reporteId', exigirRol('admin'), async (req, res) => {
  try {
    const reporte = (await almacen.leer('reportes')).find((r) => r.id === req.params.reporteId);
    if (!reporte || reporte.tipo !== 'mensaje') throw error('Reporte de mensaje no encontrado', 404);
    const [, convId, mensajeId] = String(reporte.referenciaId).match(REFERENCIA) || [];
    const conversacion = convId && (await almacen.leer('conversaciones')).find((c) => c.id === convId);
    if (!conversacion) throw error('La conversación ya no existe', 404);
    const mensajes = (await almacen.leer(colMensajes(convId))).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const indice = mensajes.findIndex((m) => m.id === mensajeId);
    if (indice === -1) throw error('El mensaje ya no existe', 404);
    const usuarios = await almacen.leer('usuarios');
    res.json({
      reporte,
      conversacion: { id: conversacion.id, participantes: conversacion.participantes.map((id) => publico(usuarios.find((u) => u.id === id)) || { id }) },
      mensaje: mensajes[indice],
      anteriores: mensajes.slice(Math.max(0, indice - ANTERIORES_REPORTE), indice)
    });
  } catch (err) {
    responderError(res, err);
  }
});

/** POST /api/mensajes/ocultar { referenciaId: "<convId>/<mensajeId>" } (admin) */
router.post('/mensajes/ocultar', exigirRol('admin'), async (req, res) => {
  try {
    const [, convId, mensajeId] = String(req.body?.referenciaId || '').match(REFERENCIA) || [];
    if (!convId) throw error('Referencia no válida: usa "<convId>/<mensajeId>"', 400);
    const mensaje = await enOrden(async () => {
      if (!(await almacen.leer('conversaciones')).some((c) => c.id === convId)) throw error('Conversación no encontrada', 404);
      if (!(await almacen.leer(colMensajes(convId))).some((m) => m.id === mensajeId)) throw error('Mensaje no encontrado', 404);
      const oculto = await almacen.actualizar(colMensajes(convId), mensajeId, { oculto: true, ocultoPor: req.usuario.id, fechaOculto: new Date().toISOString() });
      // La vista previa de la conversación pasa al último mensaje visible
      const visibles = (await almacen.leer(colMensajes(convId))).filter((m) => !m.oculto).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
      const ultimo = visibles.at(-1);
      await almacen.actualizar('conversaciones', convId, {
        ultimo: ultimo ? { texto: ultimo.texto.slice(0, MAX_VISTA_PREVIA), fecha: ultimo.fecha, autorId: ultimo.autorId } : null
      });
      return oculto;
    });
    res.json({ ok: true, mensaje });
  } catch (err) {
    responderError(res, err);
  }
});

// ---------- Rutas por conversación ----------

/** GET /api/mensajes/:convId?desde=&antes= → { mensajes (hasta 50, del más antiguo al más nuevo), hayMas, leidoHastaOtro } */
router.get('/mensajes/:convId', exigirRol(), async (req, res) => {
  try {
    const conversacion = await conversacionDe(req.params.convId, req.usuario);
    const { desde, antes } = req.query;
    let mensajes = (await almacen.leer(colMensajes(conversacion.id)))
      .filter((m) => !m.oculto)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    if (desde) mensajes = mensajes.filter((m) => String(m.fecha) > String(desde));
    if (antes) mensajes = mensajes.filter((m) => String(m.fecha) < String(antes));
    // "desde" trae los siguientes (sondeo); sin él, los más recientes
    const pagina = desde ? mensajes.slice(0, POR_PAGINA) : mensajes.slice(-POR_PAGINA);
    res.json({
      mensajes: pagina.map(vistaMensaje),
      hayMas: mensajes.length > POR_PAGINA,
      leidoHastaOtro: conversacion.leidoHasta?.[otroDe(conversacion, req.usuario.id)] || null
    });
  } catch (err) {
    responderError(res, err);
  }
});

/** POST /api/mensajes/:convId { texto } */
router.post('/mensajes/:convId', exigirRol(), async (req, res) => {
  try {
    const conversacion = await conversacionDe(req.params.convId, req.usuario);
    const texto = validarTexto(req.body?.texto);
    const otroId = otroDe(conversacion, req.usuario.id);
    const [usuarios, bloqueos] = await Promise.all([almacen.leer('usuarios'), almacen.leer('bloqueos')]);
    if (hayBloqueo(bloqueos, req.usuario.id, otroId)) throw error('No puedes enviar mensajes en esta conversación porque hay un bloqueo', 403);
    if (!activo(usuarios.find((u) => u.id === otroId))) throw error('Esta persona ya no está disponible en la plataforma', 403);
    controlarRitmo(req.usuario.id);
    const mensaje = await enOrden(() => publicarMensaje(conversacion, req.usuario.id, texto));
    res.status(201).json(vistaMensaje(mensaje));
  } catch (err) {
    responderError(res, err);
  }
});

/** POST /api/mensajes/:convId/leido → marca como leído hasta ahora */
router.post('/mensajes/:convId/leido', exigirRol(), async (req, res) => {
  try {
    const conversacion = await conversacionDe(req.params.convId, req.usuario);
    const leidoHasta = new Date().toISOString();
    await enOrden(async () => {
      const actual = (await almacen.leer('conversaciones')).find((c) => c.id === conversacion.id);
      await almacen.actualizar('conversaciones', conversacion.id, { leidoHasta: { ...(actual?.leidoHasta || {}), [req.usuario.id]: leidoHasta } });
    });
    res.json({ ok: true, leidoHasta });
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
