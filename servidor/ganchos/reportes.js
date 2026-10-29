// servidor/ganchos/reportes.js
// Reportes de contenido: cualquiera con sesión reporta; solo el admin los resuelve

import * as almacen from '../almacen.js';
import { hilosVisibles } from './foros-hilos.js';

const COLECCIONES = ['foros-hilos', 'foros-respuestas'];
const RESOLUCIONES = ['ocultado', 'descartado'];
const MAX_MOTIVO = 500;

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

// ¿El usuario puede ver la publicación que reporta?
async function publicacionVisible(coleccion, id, usuario) {
  const hilos = await almacen.leer('foros-hilos');
  if (coleccion === 'foros-hilos') {
    const hilo = hilos.find((h) => h.id === id);
    return hilo && (await hilosVisibles([hilo], usuario)).length > 0;
  }
  const respuesta = (await almacen.leer('foros-respuestas')).find((r) => r.id === id);
  const hilo = respuesta && hilos.find((h) => h.id === respuesta.hiloId);
  return Boolean(hilo && (!respuesta.oculta || usuario.rol !== 'estudiante') && (await hilosVisibles([hilo], usuario)).length > 0);
}

// Mensaje "<convId>/<mensajeId>": solo un participante, de un mensaje visible que no sea suyo
async function validarMensaje(referenciaId, usuario) {
  const [, convId, mensajeId] = String(referenciaId || '').match(/^(con_\d{6})\/(men_\d{6})$/) || [];
  if (!convId) rechazar('Referencia de mensaje no válida', 400);
  const conversacion = (await almacen.leer('conversaciones')).find((c) => c.id === convId);
  const mensaje = conversacion?.participantes.includes(usuario.id)
    && (await almacen.leer(`mensajes/${convId}`)).find((m) => m.id === mensajeId && !m.oculto);
  if (!mensaje) rechazar('El mensaje no existe o no tienes acceso', 404);
  if (mensaje.autorId === usuario.id) rechazar('No puedes reportar tus propios mensajes', 400);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (datos === null || anterior) {
    if (usuario?.rol !== 'admin') rechazar('Solo el administrador gestiona los reportes', 403);
    if (datos === null) return null;
    const campos = Object.keys(datos);
    if (campos.some((c) => !['estado', 'resolucion'].includes(c))) rechazar('Solo se puede cambiar el estado y la resolución', 400);
    if (datos.estado !== 'resuelto' || !RESOLUCIONES.includes(datos.resolucion)) {
      rechazar('Indica estado "resuelto" y resolución "ocultado" o "descartado"', 400);
    }
    return { estado: 'resuelto', resolucion: datos.resolucion, resueltoPor: usuario.id, fechaResolucion: new Date().toISOString() };
  }

  // Crear
  if (!['foro', 'mensaje'].includes(datos.tipo)) rechazar('Tipo de reporte no válido', 400);
  const coleccion = datos.tipo === 'mensaje' ? 'mensajes' : datos.coleccion;
  if (datos.tipo === 'foro' && !COLECCIONES.includes(coleccion)) rechazar('Indica si reportas un hilo o una respuesta', 400);
  const motivo = typeof datos.motivo === 'string' ? datos.motivo.trim() : '';
  if (!motivo) rechazar('Explica brevemente el motivo del reporte', 400);
  if (motivo.length > MAX_MOTIVO) rechazar(`El motivo no puede superar ${MAX_MOTIVO} caracteres`, 400);
  if (datos.tipo === 'mensaje') await validarMensaje(datos.referenciaId, usuario);
  else if (!(await publicacionVisible(coleccion, datos.referenciaId, usuario))) rechazar('La publicación no existe o no tienes acceso', 404);
  const repetido = (await almacen.leer('reportes')).some((r) => r.reportadoPor === usuario.id && r.estado === 'pendiente'
    && r.coleccion === coleccion && r.referenciaId === datos.referenciaId);
  if (repetido) rechazar('Ya reportaste esta publicación; el equipo la está revisando', 409);

  return { tipo: datos.tipo, coleccion, referenciaId: datos.referenciaId, motivo, reportadoPor: usuario.id, estado: 'pendiente' };
}

export default { antesDeGuardar };
