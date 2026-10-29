// servidor/ganchos/temas.js
// Ganchos para la colección 'temas'

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Filtra los temas según las asignaturas del usuario, visibilidad de la unidad y estado de publicación.
 * - Admin: ve todos los temas.
 * - Docente: ve los temas de sus asignaturas.
 * - Estudiante: ve los temas de sus asignaturas con estado === 'publicado' y unidad visible !== false.
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const asigs = await acceso.asignaturasDe(usuario);
  const idsAsigs = new Set(asigs.map((a) => a.id));

  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

  if (usuario.rol === 'docente') {
    return lista.filter((t) => {
      const u = mapaUnidades.get(t.unidadId);
      return u && idsAsigs.has(u.asignaturaId);
    });
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((t) => {
      const u = mapaUnidades.get(t.unidadId);
      if (!u || u.visible === false || !idsAsigs.has(u.asignaturaId)) {
        return false;
      }
      return t.estado === 'publicado';
    });
  }

  return [];
}

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

/**
 * Lo que le falta a un tema para poder publicarse: resumen, al menos un objetivo y recursos con título
 * y enlace http(s) o ruta interna. Devuelve una lista vacía si está completo.
 *
 * @param {Object} tema
 * @returns {Array<string>}
 */
export function faltasParaPublicar(tema) {
  const faltas = [];
  if (!String(tema?.resumen || '').trim()) faltas.push('el resumen');
  if (!(Array.isArray(tema?.objetivos) && tema.objetivos.some((o) => String(o || '').trim()))) faltas.push('al menos un objetivo');
  const incompletos = (Array.isArray(tema?.recursos) ? tema.recursos : []).filter((r) => !r
    || !String(r.titulo || '').trim() || !/^(https?:\/\/|\/(?!\/))/i.test(String(r.url || '').trim()));
  if (incompletos.length) faltas.push(`completar ${incompletos.length} recurso(s) con título y enlace válido`);
  return faltas;
}

// Título comparable: sin tildes, sin mayúsculas y con espacios simples
const normalizarTitulo = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Valida permisos y relaciones del tema:
 * - Permiso sobre la asignatura de la unidad de destino y, al editar o eliminar, sobre la de origen.
 * - Título obligatorio al crear y sin duplicados dentro de la misma unidad (409), para que repetir
 *   una creación no genere temas iguales.
 *
 * @param {Object} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  const unidades = await almacen.leer('unidades');
  const asignaturaDeUnidad = (id) => unidades.find((u) => u.id === id)?.asignaturaId || null;
  const sinPermiso = 'No tienes permisos para editar temas en esta asignatura';

  // Origen: asignatura actual del tema (al editar o eliminar)
  if (anterior && !(await acceso.puedeEditarAsignatura(usuario, asignaturaDeUnidad(anterior.unidadId)))) {
    rechazar(sinPermiso, 403);
  }
  if (!datos) return datos;

  const unidadId = datos.unidadId || (anterior && anterior.unidadId);
  if (!(await acceso.puedeEditarAsignatura(usuario, asignaturaDeUnidad(unidadId)))) rechazar(sinPermiso, 403);

  const titulo = 'titulo' in datos ? datos.titulo : anterior?.titulo;
  if (!anterior && !normalizarTitulo(titulo)) rechazar('El título del tema es obligatorio', 400);
  if (!anterior || 'titulo' in datos || 'unidadId' in datos) {
    const repetido = (await almacen.leer('temas')).find((t) => t.unidadId === unidadId
      && t.id !== anterior?.id && normalizarTitulo(t.titulo) === normalizarTitulo(titulo));
    if (repetido) rechazar(`Ya existe el tema «${repetido.titulo}» en esta unidad (${repetido.id})`, 409);
  }

  // Publicar exige un contenido mínimo completo; el servidor nunca cambia el estado por sí mismo
  const final = { ...(anterior || {}), ...datos };
  if (final.estado === 'publicado' && (!anterior || ['estado', 'resumen', 'objetivos', 'recursos'].some((k) => k in datos))) {
    const faltas = faltasParaPublicar(final);
    if (faltas.length) rechazar(`No se puede publicar el tema: falta ${faltas.join(', ')}. Guárdalo como borrador.`, 400);
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
