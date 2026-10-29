// servidor/ganchos/foros-hilos.js
// Hilos de foro: visibilidad por asignatura, autoría, edición limitada y moderación

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export const MAX_TEXTO = 5000;
const MAX_TITULO = 150;
const MINUTOS_EDICION = 15;
const CAMPOS_AUTOR = ['titulo', 'texto'];
const CAMPOS_MODERACION = ['fijado', 'cerrado', 'oculto'];

export function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

/** Docente de la asignatura o administrador. */
export async function esModerador(usuario, asignaturaId) {
  if (usuario?.rol === 'admin') return true;
  return usuario?.rol === 'docente' && acceso.puedeEditarAsignatura(usuario, asignaturaId);
}

/** ¿El autor puede todavía editar su publicación? (15 minutos desde que la creó) */
export function enPlazoDeEdicion(registro, usuario, ahora = Date.now()) {
  return registro.autorId === usuario?.id && ahora - new Date(registro.fecha).getTime() <= MINUTOS_EDICION * 60 * 1000;
}

/** Hilos que el usuario puede ver: de sus asignaturas; los ocultos solo docente y admin. */
export async function hilosVisibles(lista, usuario) {
  if (!usuario) return [];
  const asignaturas = new Set((await acceso.asignaturasDe(usuario)).map((a) => a.id));
  const ve = usuario.rol === 'docente' || usuario.rol === 'admin';
  return lista.filter((h) => asignaturas.has(h.asignaturaId) && (!h.oculto || ve));
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return [];
  return hilosVisibles(lista, usuario);
}

export async function nombreDe(usuarioId) {
  const u = (await almacen.leer('usuarios')).find((x) => x.id === usuarioId);
  return u ? { autorNombre: `${u.nombre} ${u.apellido}`.trim(), autorRol: u.rol } : { autorNombre: '', autorRol: '' };
}

function validarTexto(texto, obligatorio) {
  if (texto === undefined && !obligatorio) return;
  if (typeof texto !== 'string' || !texto.trim()) rechazar('Escribe el texto de la publicación', 400);
  if (texto.length > MAX_TEXTO) rechazar(`El texto no puede superar ${MAX_TEXTO.toLocaleString('es-EC')} caracteres`, 400);
}

function validarTitulo(titulo, obligatorio) {
  if (titulo === undefined && !obligatorio) return;
  if (typeof titulo !== 'string' || !titulo.trim()) rechazar('Escribe el título del hilo', 400);
  if (titulo.length > MAX_TITULO) rechazar(`El título no puede superar ${MAX_TITULO} caracteres`, 400);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  // Eliminar: solo moderadores
  if (datos === null) {
    if (!(await esModerador(usuario, anterior.asignaturaId))) rechazar('Solo docentes y administradores pueden eliminar hilos', 403);
    return null;
  }

  // Crear
  if (!anterior) {
    const asignatura = (await acceso.asignaturasDe(usuario)).find((a) => a.id === datos.asignaturaId);
    if (!asignatura) rechazar('No participas en el foro de esta asignatura', 403);
    if (datos.temaId) {
      const asig = await acceso.asignaturaDeTema(datos.temaId);
      if (asig?.id !== asignatura.id) rechazar('El tema no pertenece a esta asignatura', 400);
    }
    validarTitulo(datos.titulo, true);
    validarTexto(datos.texto, true);
    const moderador = await esModerador(usuario, asignatura.id);
    return {
      asignaturaId: asignatura.id,
      temaId: datos.temaId || null,
      titulo: datos.titulo.trim(),
      texto: datos.texto.trim(),
      autorId: usuario.id,
      ...(await nombreDe(usuario.id)),
      fijado: moderador && datos.fijado === true,
      cerrado: moderador && datos.cerrado === true,
      oculto: false,
      ultimoMovimiento: new Date().toISOString()
    };
  }

  // Editar
  const moderador = await esModerador(usuario, anterior.asignaturaId);
  const campos = Object.keys(datos);
  const desconocidos = campos.filter((c) => !CAMPOS_AUTOR.includes(c) && !CAMPOS_MODERACION.includes(c));
  if (desconocidos.length) rechazar(`No se puede cambiar: ${desconocidos.join(', ')}`, 400);
  if (campos.some((c) => CAMPOS_MODERACION.includes(c)) && !moderador) {
    rechazar('Solo docentes y administradores pueden fijar, cerrar u ocultar hilos', 403);
  }
  const cambiaContenido = campos.some((c) => CAMPOS_AUTOR.includes(c));
  if (cambiaContenido && !moderador && !enPlazoDeEdicion(anterior, usuario)) {
    rechazar(anterior.autorId === usuario.id ? 'Solo puedes editar tu publicación durante los primeros 15 minutos' : 'No puedes editar publicaciones de otras personas', 403);
  }
  validarTitulo(datos.titulo, false);
  validarTexto(datos.texto, false);
  for (const c of CAMPOS_MODERACION) if (c in datos && typeof datos[c] !== 'boolean') rechazar(`"${c}" debe ser verdadero o falso`, 400);

  const cambios = { ...datos };
  if (typeof cambios.titulo === 'string') cambios.titulo = cambios.titulo.trim();
  if (typeof cambios.texto === 'string') cambios.texto = cambios.texto.trim();
  if (cambiaContenido) cambios.editado = new Date().toISOString();
  return cambios;
}

export default { filtrarLista, antesDeGuardar };
