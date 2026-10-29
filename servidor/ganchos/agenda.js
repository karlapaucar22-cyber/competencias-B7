// servidor/ganchos/agenda.js
// Agenda: eventos propios y de mis grupos; solo el propietario edita o elimina

import * as acceso from '../acceso.js';
import { ACTIVIDADES } from '../../publico/js/nucleo/catalogo-actividades.js';

export const TIPOS = ['tarea', 'reunion', 'fecha-limite', 'recordatorio'];
export const ESTADOS_PLANIFICACION = ['confirmado', 'propuesta', 'pendiente-confirmacion'];
export const RECORDATORIOS = [1440, 60]; // minutos antes: 1 día y 1 hora
const MAX_TITULO = 150;
const MAX_RESPONSABLE = 100;
const CAMPOS = ['titulo', 'tipo', 'inicio', 'fin', 'todoElDia', 'grupoId', 'actividad', 'temaId', 'recordatorios', 'estadoPlanificacion', 'responsable', 'enlace'];
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ENLACE_INTERNO = /^\/(?!\/)(?:index\.html|paginas\/[a-z0-9-]+\.html)(?:[?#][a-z0-9%._~!$&'()*+,;=:@/?#-]*)?$/i;

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

const esDocente = (usuario) => usuario?.rol === 'docente' || usuario?.rol === 'admin';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  const grupos = new Set((await acceso.gruposDe(usuario)).map((g) => g.id));
  return lista.filter((e) => e.propietarioId === usuario.id || (e.grupoId && grupos.has(e.grupoId)));
}

function validarFecha(valor, todoElDia, nombre) {
  const valida = typeof valor === 'string' && (todoElDia ? SOLO_FECHA.test(valor) : !SOLO_FECHA.test(valor)) && !Number.isNaN(Date.parse(valor));
  if (!valida) rechazar(`La fecha de ${nombre} no es válida`, 400);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (anterior && anterior.propietarioId !== usuario?.id) rechazar('Solo quien creó el evento puede modificarlo o eliminarlo', 403);
  if (datos === null) return datos;
  if (!datos || typeof datos !== 'object') rechazar('Datos del evento no válidos', 400);

  const cambios = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'id') continue;
    if (!CAMPOS.includes(clave)) rechazar(`El campo "${clave}" no se puede modificar`, 400);
    cambios[clave] = valor;
  }
  const evento = { ...(anterior || {}), ...cambios };

  if (typeof evento.titulo !== 'string' || !evento.titulo.trim()) rechazar('Escribe el título del evento', 400);
  if (evento.titulo.length > MAX_TITULO) rechazar(`El título no puede superar ${MAX_TITULO} caracteres`, 400);
  if (!TIPOS.includes(evento.tipo)) rechazar('Tipo de evento no válido', 400);
  evento.todoElDia = evento.todoElDia === true;
  validarFecha(evento.inicio, evento.todoElDia, 'inicio');
  if (evento.fin) {
    validarFecha(evento.fin, evento.todoElDia, 'fin');
    if (Date.parse(evento.fin) < Date.parse(evento.inicio)) rechazar('El fin no puede ser anterior al inicio', 400);
  } else {
    evento.fin = null;
  }
  const recordatorios = Array.isArray(evento.recordatorios) ? evento.recordatorios : [];
  if (!recordatorios.every((m) => RECORDATORIOS.includes(m))) rechazar('Recordatorio no válido', 400);
  evento.recordatorios = [...new Set(recordatorios)].sort((a, b) => b - a);

  evento.estadoPlanificacion = evento.estadoPlanificacion || 'confirmado';
  if (!ESTADOS_PLANIFICACION.includes(evento.estadoPlanificacion)) rechazar('Estado de planificación no válido', 400);
  evento.responsable = typeof evento.responsable === 'string' ? evento.responsable.trim() : null;
  if (evento.responsable?.length > MAX_RESPONSABLE) rechazar(`El nombre responsable no puede superar ${MAX_RESPONSABLE} caracteres`, 400);
  evento.enlace = typeof evento.enlace === 'string' && evento.enlace.trim() ? evento.enlace.trim() : null;
  if (evento.enlace && !ENLACE_INTERNO.test(evento.enlace)) rechazar('El enlace debe ser una ruta interna válida', 400);
  if ((evento.responsable || evento.enlace || evento.estadoPlanificacion !== 'confirmado') && !esDocente(usuario)) {
    rechazar('Solo docentes y administradores pueden configurar hitos académicos', 403);
  }

  // Grupo y actividad vinculada: solo docente y admin, y solo de sus grupos
  evento.grupoId = evento.grupoId || null;
  evento.actividad = evento.actividad || null;
  evento.temaId = evento.temaId || null;
  let grupo = null;
  if (evento.grupoId) {
    if (!esDocente(usuario)) rechazar('Solo los docentes pueden asignar eventos a un grupo', 403);
    grupo = (await acceso.gruposDe(usuario)).find((g) => g.id === evento.grupoId);
    if (!grupo) rechazar('Solo puedes usar tus propios grupos', 403);
  }
  if (evento.actividad || evento.temaId) {
    if (!esDocente(usuario)) rechazar('Solo los docentes pueden vincular actividades', 403);
    // Tutor y simulador no registran intentos con su id: no pueden vincularse a una fecha límite
    if (['tutor', 'simulador'].includes(evento.actividad) ||!ACTIVIDADES.some((a) => a.id === evento.actividad)) rechazar('Actividad no válida', 400);
    const asignatura = await acceso.asignaturaDeTema(evento.temaId);
    if (!asignatura) rechazar('Elige el tema de la actividad', 400);
    if (grupo && asignatura.id !== grupo.asignaturaId) rechazar('El tema no pertenece a la asignatura del grupo', 400);
  }

  const resultado = {};
  for (const clave of CAMPOS) resultado[clave] = clave === 'titulo' ? evento.titulo.trim() : evento[clave];
  if (!anterior) return { ...resultado, propietarioId: usuario.id, avisados: {} };
  // Si cambia la hora o los recordatorios, se vuelven a avisar
  const reprogramado = resultado.inicio !== anterior.inicio || String(resultado.recordatorios) !== String(anterior.recordatorios || []);
  return reprogramado ? { ...resultado, avisados: {} } : resultado;
}

export default { filtrarLista, antesDeGuardar };
