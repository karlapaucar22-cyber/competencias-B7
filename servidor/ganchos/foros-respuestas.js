// servidor/ganchos/foros-respuestas.js
// Respuestas de foro: visibles con su hilo, hilo cerrado sin respuestas, moderación y avisos

import * as almacen from '../almacen.js';
import { notificar } from '../notificar.js';
import { procesarIntento } from '../gamificacion.js';
import { contarPalabras } from '../../publico/js/nucleo/neuroritmo.js';
import { MAX_TEXTO, rechazar, esModerador, enPlazoDeEdicion, hilosVisibles, nombreDe } from './foros-hilos.js';

const CAMPOS_MODERACION = ['destacada', 'oculta'];

/** Respuestas de hilos que el usuario puede ver; las ocultas solo docente y admin. */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  const visibles = new Set((await hilosVisibles(await almacen.leer('foros-hilos'), usuario)).map((h) => h.id));
  const ve = usuario.rol === 'docente' || usuario.rol === 'admin';
  return lista.filter((r) => visibles.has(r.hiloId) && (!r.oculta || ve));
}

async function hiloVisible(hiloId, usuario) {
  const hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === hiloId);
  if (!hilo || !(await hilosVisibles([hilo], usuario)).length) rechazar('El hilo no existe o no tienes acceso', 404);
  return hilo;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const hilo = await hiloVisible(anterior ? anterior.hiloId : datos?.hiloId, usuario);
  const moderador = await esModerador(usuario, hilo.asignaturaId);

  if (datos === null) {
    if (!moderador) rechazar('Solo docentes y administradores pueden eliminar respuestas', 403);
    return null;
  }

  const validarTexto = (texto) => {
    if (typeof texto !== 'string' || !texto.trim()) rechazar('Escribe tu respuesta', 400);
    if (texto.length > MAX_TEXTO) rechazar(`La respuesta no puede superar ${MAX_TEXTO.toLocaleString('es-EC')} caracteres`, 400);
  };

  // Crear
  if (!anterior) {
    if (hilo.cerrado) rechazar('Este hilo está cerrado: ya no admite respuestas', 403);
    validarTexto(datos.texto);
    let respuestaAId = null;
    if (datos.respuestaAId !== undefined && datos.respuestaAId !== null && datos.respuestaAId !== '') {
      if (typeof datos.respuestaAId !== 'string') rechazar('La respuesta de referencia no es válida', 400);
      const objetivo = (await almacen.leer('foros-respuestas')).find((r) => r.id === datos.respuestaAId && r.hiloId === hilo.id && !r.oculta && !r.respuestaAId);
      if (!objetivo) rechazar('La propuesta que intentas comentar no existe o no está disponible', 400);
      if (objetivo.autorId === usuario.id) rechazar('Para el comentario colaborativo elige la propuesta de otra persona', 400);
      respuestaAId = objetivo.id;
    }
    return {
      hiloId: hilo.id,
      texto: datos.texto.trim(),
      respuestaAId,
      autorId: usuario.id,
      ...(await nombreDe(usuario.id)),
      destacada: false,
      oculta: false
    };
  }

  // Editar
  const campos = Object.keys(datos);
  const desconocidos = campos.filter((c) => c !== 'texto' && !CAMPOS_MODERACION.includes(c));
  if (desconocidos.length) rechazar(`No se puede cambiar: ${desconocidos.join(', ')}`, 400);
  if (campos.some((c) => CAMPOS_MODERACION.includes(c)) && !moderador) {
    rechazar('Solo docentes y administradores pueden destacar u ocultar respuestas', 403);
  }
  if ('texto' in datos) {
    if (!moderador && !enPlazoDeEdicion(anterior, usuario)) {
      rechazar(anterior.autorId === usuario.id ? 'Solo puedes editar tu respuesta durante los primeros 15 minutos' : 'No puedes editar respuestas de otras personas', 403);
    }
    validarTexto(datos.texto);
  }
  for (const c of CAMPOS_MODERACION) if (c in datos && typeof datos[c] !== 'boolean') rechazar(`"${c}" debe ser verdadero o falso`, 400);
  const cambios = { ...datos };
  if ('texto' in cambios) {
    cambios.texto = cambios.texto.trim();
    cambios.editado = new Date().toISOString();
  }
  return cambios;
}

/**
 * Al crear una respuesta: último movimiento del hilo, aviso al autor del hilo y punto de foro.
 * La respuesta ya está guardada: un fallo aquí no debe devolver error al usuario.
 */
export async function despuesDeGuardar(registro, usuario, anterior) {
  if (!registro || anterior) return;
  let hilo = null;
  try {
    hilo = (await almacen.leer('foros-hilos')).find((h) => h.id === registro.hiloId);
    if (!hilo) return;
    await almacen.actualizar('foros-hilos', hilo.id, { ultimoMovimiento: registro.fecha });
    if (hilo.autorId && hilo.autorId !== usuario.id) {
      await notificar(hilo.autorId, {
        tipo: 'foro',
        mensaje: `${registro.autorNombre || 'Alguien'} respondió en tu hilo «${hilo.titulo}»`,
        enlace: `/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}`
      });
    }
  } catch (err) {
    console.error('No se pudo actualizar el hilo o avisar al autor:', err);
  }
  try {
    const objetivo = registro.respuestaAId
      ? (await almacen.leer('foros-respuestas')).find((r) => r.id === registro.respuestaAId && r.hiloId === registro.hiloId)
      : null;
    // Eco colaborativo distingue la propuesta propia del comentario dirigido a una propuesta ajena.
    await procesarIntento(usuario, {
      actividad: 'foro', puntaje: 1, maximo: 1,
      detalle: {
        hiloId: registro.hiloId,
        temaId: hilo?.temaId || null,
        palabras: contarPalabras(registro.texto),
        tipoAporte: objetivo ? 'comentario' : 'propuesta',
        respuestaAId: objetivo?.id || null,
        respuestaAjena: Boolean(objetivo?.autorId) && objetivo.autorId !== usuario.id
      }
    });
  } catch (err) {
    // Límite de intentos por hora u otra regla: la respuesta ya quedó publicada
    console.error('No se pudo registrar el punto de foro:', err.message);
  }
}

export default { filtrarLista, antesDeGuardar, despuesDeGuardar };
