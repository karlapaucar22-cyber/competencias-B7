// servidor/ganchos/noticias.js
// Ganchos para la colección 'noticias'

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

/**
 * Filtra las noticias según el rol del usuario:
 * - Docentes y administradores ven todas las noticias (borradores y publicadas).
 * - Estudiantes ven únicamente las noticias en estado 'publicado'.
 *
 * @param {Array<Object>} lista
 * @param {Object|null} usuario
 * @returns {Promise<Array<Object>>}
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin' || usuario.rol === 'docente') {
    return lista;
  }
  if (usuario.rol === 'estudiante') {
    return lista.filter((n) => n.estado === 'publicado');
  }
  return [];
}

/**
 * Valida y asigna campos automáticos de la noticia:
 * - Fija autorId con el usuario actual al crear.
 * - Fija fechaPublicacion (ISO) cuando el estado pasa a 'publicado'.
 *
 * @param {Object|null} datos
 * @param {Object|null} usuario
 * @param {Object|null} anterior
 * @returns {Promise<Object|null>}
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (datos === null) return null; // Eliminación permitida

  const titulo = datos.titulo !== undefined ? datos.titulo : (anterior ? anterior.titulo : null);
  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    const err = new Error('El título de la noticia es obligatorio');
    err.estado = 400;
    throw err;
  }

  // Creación
  if (!anterior) {
    datos.autorId = usuario ? usuario.id : null;
    if (datos.estado === 'publicado') {
      datos.fechaPublicacion = datos.fechaPublicacion || new Date().toISOString();
    }
  } else {
    // Edición: preservar autor original si ya existía
    datos.autorId = anterior.autorId || (usuario ? usuario.id : null);

    const nuevoEstado = datos.estado !== undefined ? datos.estado : anterior.estado;
    // Si pasa de borrador a publicado, fijar fechaPublicacion si no tenía
    if (nuevoEstado === 'publicado' && (anterior.estado !== 'publicado' || !anterior.fechaPublicacion)) {
      datos.fechaPublicacion = new Date().toISOString();
    } else if (anterior.fechaPublicacion && !datos.fechaPublicacion) {
      datos.fechaPublicacion = anterior.fechaPublicacion;
    }
  }

  return datos;
}

/**
 * Cuando una noticia pasa a "publicado" (al crearla o al editarla) notifica a los estudiantes
 * de la asignatura de su tema, o a todos los estudiantes activos si no tiene tema.
 */
export async function despuesDeGuardar(registro, usuario, anterior) {
  if (!registro || registro.estado !== 'publicado' || anterior?.estado === 'publicado') return;

  try {
    let destinatarios;
    if (registro.temaId) {
      const asignatura = await acceso.asignaturaDeTema(registro.temaId);
      const grupos = asignatura ? (await almacen.leer('distributivo')).filter((g) => g.asignaturaId === asignatura.id) : [];
      destinatarios = [...new Set(grupos.flatMap((g) => g.estudiantes || []))];
    } else {
      destinatarios = (await almacen.leer('usuarios'))
        .filter((u) => u.rol === 'estudiante' && u.activo !== false).map((u) => u.id);
    }

    const mensaje = `Nueva noticia: ${registro.titulo}`;
    const enlace = `/paginas/noticia.html?id=${encodeURIComponent(registro.id)}`;
    for (const usuarioId of destinatarios) {
      await notificar(usuarioId, { tipo: 'noticia', mensaje, enlace });
    }
  } catch (err) {
    // La noticia ya se guardó: un fallo al notificar no debe revertirla
    console.error('No se pudo notificar la noticia publicada:', err);
  }
}

export default {
  filtrarLista,
  antesDeGuardar,
  despuesDeGuardar
};
