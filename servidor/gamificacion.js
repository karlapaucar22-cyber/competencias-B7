// servidor/gamificacion.js
// Motor central de gamificación, cálculo de puntos, insignias y logros

import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import * as alertas from './alertas.js';
import { normalizarReglas } from '../publico/js/nucleo/neuroritmo.js';

// NeuroRitmo usa solo reglas.neuroritmo: no le aplican bono, únicas, aprobado ni máximos diarios del quiz
const NEURORITMO = 'neuroritmo';

// Registro de intentos por usuario en memoria para control de tasa (máx intentos/hora)
const registroIntentosHora = new Map();

export function cumpleAporteForo(intentos, condicion = {}, reglasNeuro = {}) {
  const palabras = Number(condicion.palabras ?? reglasNeuro.ecoPalabrasMinimas ?? 15);
  const aportes = (intentos || []).filter((i) => i.actividad === 'foro'
    && String(i.detalle?.temaId ?? '') === String(condicion.temaId ?? '')
    && Number(i.detalle?.palabras) >= palabras);
  const propuesta = aportes.some((i) => i.detalle?.tipoAporte === 'propuesta');
  const comentarioAjeno = aportes.some((i) => i.detalle?.tipoAporte === 'comentario'
    && i.detalle?.respuestaAjena === true && Boolean(i.detalle?.respuestaAId));
  return propuesta && comentarioAjeno;
}

/**
 * Extrae el valor de una clave anidada (ej. "detalle.hiloId" o "temaId")
 *
 * @param {Object} obj
 * @param {string} ruta
 * @returns {any}
 */
function extraerCampo(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = ruta.split('.');
  let actual = obj;
  for (const p of partes) {
    if (actual === null || actual === undefined) return undefined;
    actual = actual[p];
  }
  return actual;
}

/**
 * Procesa el intento de una actividad educativa calculando puntos,
 * evaluando insignias, actualizando logros y llamando a alertas tempranas.
 *
 * @param {Object} usuario - Usuario en sesión
 * @param {Object} datos - Datos del intento
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array<Object> }>}
 */
export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const err = new Error('Sesión requerida para registrar intentos de actividad');
    err.estado = 401;
    throw err;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const puntosReglas = reglas.puntos || {};

  // 1. Validar actividad registrada
  // NeuroRitmo se registra por su sección propia (reglas.neuroritmo), no por la tabla de puntos genérica
  const registrada = datos?.actividad === NEURORITMO ? Boolean(reglas.neuroritmo) : puntosReglas[datos?.actividad] !== undefined;
  if (!datos || typeof datos.actividad !== 'string' || !registrada) {
    const err = new Error('Actividad inválida o no registrada en reglas de gamificación');
    err.estado = 400;
    throw err;
  }

  // 2. Validar puntaje y máximo (0 <= puntaje <= maximo y maximo > 0)
  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);
  if (isNaN(puntaje) || isNaN(maximo) || puntaje < 0 || puntaje > maximo || maximo <= 0) {
    const err = new Error('Puntaje o máximo inválido: se exige 0 ≤ puntaje ≤ maximo y maximo > 0');
    err.estado = 400;
    throw err;
  }

  const errores = datos.errores !== undefined ? Number(datos.errores) : 0;
  if (isNaN(errores) || errores < 0) {
    const err = new Error('El número de errores debe ser un número entero mayor o igual a cero');
    err.estado = 400;
    throw err;
  }

  // 3. Validar acceso al tema si viene temaId
  if (datos.temaId) {
    const temaId = datos.temaId;
    const asig = await acceso.asignaturaDeTema(temaId);
    if (!asig) {
      const err = new Error('El tema especificado no existe o no tiene asignatura asignada');
      err.estado = 404;
      throw err;
    }

    if (usuario.rol !== 'admin') {
      const asigsUsuario = await acceso.asignaturasDe(usuario);
      if (!asigsUsuario.some((a) => a.id === asig.id)) {
        const err = new Error('No tienes acceso a los contenidos pedagógicos de este tema');
        err.estado = 403;
        throw err;
      }
    }

    if (usuario.rol === 'estudiante') {
      const temas = await almacen.leer('temas');
      const tema = temas.find((t) => t.id === temaId);
      if (!tema || tema.estado !== 'publicado') {
        const err = new Error('El tema no se encuentra publicado para estudiantes');
        err.estado = 403;
        throw err;
      }
    }
  }

  // 4. Límite de intentos por hora (en memoria) -> 429
  const limiteHora = Number(reglas.limiteIntentosHora) || 30;
  const ahora = Date.now();
  const unaHoraAtras = ahora - 60 * 60 * 1000;

  let intentosHora = registroIntentosHora.get(usuario.id) || [];
  intentosHora = intentosHora.filter((ts) => ts > unaHoraAtras);

  if (intentosHora.length >= limiteHora) {
    const err = new Error('Has superado el límite de intentos permitidos por hora');
    err.estado = 429;
    throw err;
  }

  intentosHora.push(ahora);
  registroIntentosHora.set(usuario.id, intentosHora);

  // 5. Cálculo inicial de puntos
  const esNeuro = datos.actividad === NEURORITMO;
  const reglasNeuro = normalizarReglas(reglas.neuroritmo);
  const baseActividad = esNeuro ? reglasNeuro.puntosPorMision : puntosReglas[datos.actividad];
  const puntosBase = Math.round((baseActividad * puntaje) / maximo);
  // mejorPuntaje: se acumula solo la mejora sobre el mejor intento previo con la misma clave (sin bono).
  // NeuroRitmo: siempre por misión si la regla conserva la mejor nota
  const clavesMejor = esNeuro ? (reglasNeuro.conservarMejorIntento ? ['detalle.mision'] : null) : reglas.mejorPuntaje?.[datos.actividad];
  let bono = 0;
  if (!esNeuro && !clavesMejor && errores === 0 && puntaje === maximo && reglas.bonoSinErrores) {
    bono = Number(reglas.bonoSinErrores) || 0;
  }

  let puntosCalculados = puntosBase + bono;

  // 6. Validaciones de deduplicación de puntos:
  const todosIntentos = await almacen.leer('intentos');
  const intentosUsuario = todosIntentos.filter((i) => i.usuarioId === usuario.id);

  // a) Actividad única: ya existe un intento con puntos para la misma clave
  if (!esNeuro && reglas.unicas && reglas.unicas[datos.actividad]) {
    const camposClave = reglas.unicas[datos.actividad];
    if (Array.isArray(camposClave) && camposClave.length > 0) {
      const claveActual = camposClave.map((c) => String(extraerCampo(datos, c) ?? '')).join('::');
      const yaExisteConPuntos = intentosUsuario.some((i) => {
        if (i.actividad !== datos.actividad || (Number(i.puntos) || 0) <= 0) return false;
        const claveAnterior = camposClave.map((c) => String(extraerCampo(i, c) ?? '')).join('::');
        return claveAnterior === claveActual;
      });

      if (yaExisteConPuntos) {
        puntosCalculados = 0;
      }
    }
  }

  if (Array.isArray(clavesMejor) && clavesMejor.length > 0) {
    const claveActual = clavesMejor.map((c) => String(extraerCampo(datos, c) ?? '')).join('::');
    const mejorPrevio = intentosUsuario
      .filter((i) => i.actividad === datos.actividad && clavesMejor.map((c) => String(extraerCampo(i, c) ?? '')).join('::') === claveActual)
      .reduce((m, i) => Math.max(m, Math.round((baseActividad * Number(i.puntaje)) / Number(i.maximo)) || 0), 0);
    puntosCalculados = Math.max(0, puntosBase - mejorPrevio);
  }

  // b) Requiere aprobado y detalle.aprobado !== true
  if (!esNeuro && Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(datos.actividad)) {
    const aprobado = datos.detalle && datos.detalle.aprobado === true;
    if (!aprobado) {
      puntosCalculados = 0;
    }
  }

  // c) Ya alcanzó hoy el máximo diario con puntos
  if (!esNeuro && reglas.maxDiario && reglas.maxDiario[datos.actividad] !== undefined) {
    const maximoHoy = Number(reglas.maxDiario[datos.actividad]);
    const hoyIso = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = intentosUsuario.filter((i) => {
      return (
        i.actividad === datos.actividad &&
        (Number(i.puntos) || 0) > 0 &&
        typeof i.fecha === 'string' &&
        i.fecha.slice(0, 10) === hoyIso
      );
    }).length;

    if (intentosHoyConPuntos >= maximoHoy) {
      puntosCalculados = 0;
    }
  }

  // 7. Guardar intento
  const nuevoIntento = {
    usuarioId: usuario.id,
    actividad: datos.actividad,
    temaId: datos.temaId || null,
    nivel: !esNeuro && datos.nivel !== undefined && datos.nivel !== null ? Number(datos.nivel) : null,
    puntaje,
    maximo,
    errores,
    duracionSeg: Number(datos.duracionSeg || 0),
    detalle: datos.detalle || {},
    puntos: puntosCalculados
  };
  const intentoGuardado = await almacen.agregar('intentos', nuevoIntento);

  // 8. Cargar o crear logros del usuario
  const todosLogros = await almacen.leer('logros');
  let logroUsuario = todosLogros.find((l) => l.usuarioId === usuario.id);
  if (!logroUsuario) {
    logroUsuario = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }

  logroUsuario.puntos = (Number(logroUsuario.puntos) || 0) + puntosCalculados;
  logroUsuario.insignias = Array.isArray(logroUsuario.insignias) ? logroUsuario.insignias : [];
  logroUsuario.nivelQuiz = logroUsuario.nivelQuiz || {};

  // Actualizar nivelQuiz si corresponde
  if (datos.actividad === 'quiz' && datos.temaId && datos.nivel !== undefined) {
    const lvlActual = Number(logroUsuario.nivelQuiz[datos.temaId] || 0);
    const lvlIntento = Number(datos.nivel);
    // El quiz informa detalle.aprobado según reglas.quiz.porcentajeAprobacion; 70 % solo si no viene
    const aprobado = typeof datos.detalle?.aprobado === 'boolean'
      ? datos.detalle.aprobado
      : puntaje >= maximo * 0.7;
    if (aprobado && lvlIntento > lvlActual) {
      logroUsuario.nivelQuiz[datos.temaId] = lvlIntento;
    }
  }

  // 9. Evaluar insignias no obtenidas
  const todasInsignias = await almacen.leer('insignias');
  const idsObtenidas = new Set(logroUsuario.insignias.map((ins) => ins.id));
  const insigniasNuevas = [];
  const todosIntentosActualizados = [...intentosUsuario, intentoGuardado];

  for (const insignia of todasInsignias) {
    if (idsObtenidas.has(insignia.id)) continue;
    const cond = insignia.condicion;
    if (!cond || !cond.tipo) continue;

    let cumple = false;

    if (cond.tipo === 'puntos') {
      cumple = logroUsuario.puntos >= Number(cond.minimo || 0);
    } else if (cond.tipo === 'sinErrores') {
      cumple = todosIntentosActualizados.some((i) => {
        const mismaAct = !cond.actividad || i.actividad === cond.actividad;
        return mismaAct && Number(i.errores || 0) === 0;
      });
    } else if (cond.tipo === 'conteo') {
      // campo/valor opcionales: solo cuentan los intentos con ese dato (p. ej. detalle.temaId del foro)
      const intentosFiltrados = todosIntentosActualizados.filter((i) => (!cond.actividad || i.actividad === cond.actividad)
        && (!cond.campo || String(extraerCampo(i, cond.campo) ?? '') === String(cond.valor ?? '')));

      const camposClave = reglas.unicas && cond.actividad ? reglas.unicas[cond.actividad] : null;
      if (Array.isArray(camposClave) && camposClave.length > 0) {
        const clavesDistintas = new Set(
          intentosFiltrados.map((i) =>
            camposClave.map((c) => String(extraerCampo(i, c) ?? '')).join('::')
          )
        );
        cumple = clavesDistintas.size >= Number(cond.minimo || 1);
      } else {
        cumple = intentosFiltrados.length >= Number(cond.minimo || 1);
      }
    } else if (cond.tipo === 'nivelQuiz') {
      const niveles = Object.values(logroUsuario.nivelQuiz || {}).map(Number);
      const maxNivel = niveles.length > 0 ? Math.max(...niveles) : 0;
      cumple = maxNivel >= Number(cond.nivel || 1);
    } else if (cond.tipo === 'mision') {
      // Misión de NeuroRitmo superada con la aprobación central (la 3 solo si el docente la validó)
      const minimo = Number(cond.minimo ?? reglasNeuro.aprobacion);
      cumple = todosIntentosActualizados.some((i) => i.actividad === (cond.actividad || NEURORITMO)
        && i.detalle?.mision === cond.mision && Number(i.puntaje) >= minimo
        && (cond.mision !== 'm3' || i.detalle?.validada === true));
    } else if (cond.tipo === 'mejora') {
      // Mejora de al menos `minimo` puntos respecto del intento anterior de la misma misión; en NeuroRitmo
      // el reintento debe registrar que revisó la retroalimentación (detalle.retroRevisada)
      const minimo = Number(cond.minimo ?? reglasNeuro.mejoraMinima);
      const exigeRetro = cond.requiereRetro ?? (cond.actividad === NEURORITMO && reglasNeuro.mejoraRequiereRetro);
      const porClave = new Map();
      for (const i of todosIntentosActualizados.filter((x) => x.actividad === cond.actividad).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
        const clave = String(i.detalle?.mision ?? i.temaId ?? '');
        const previo = porClave.get(clave);
        if (previo !== undefined && Number(i.puntaje) - previo >= minimo && (!exigeRetro || i.detalle?.retroRevisada === true)) cumple = true;
        porClave.set(clave, Number(i.puntaje));
      }
    } else if (cond.tipo === 'aporteForo') {
      // Requiere una propuesta propia y un comentario dirigido a la propuesta de otra persona.
      cumple = cumpleAporteForo(todosIntentosActualizados, cond, reglasNeuro);
    } else if (cond.tipo === 'racha') {
      const diasRequeridos = Number(cond.dias || 1);
      const diasConIntento = new Set(
        todosIntentosActualizados
          .map((i) => (typeof i.fecha === 'string' ? i.fecha.slice(0, 10) : ''))
          .filter(Boolean)
      );

      let racha = 0;
      let cursor = new Date();
      while (true) {
        const fechaStr = cursor.toISOString().slice(0, 10);
        if (diasConIntento.has(fechaStr)) {
          racha++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      cumple = racha >= diasRequeridos;
    }

    if (cumple) {
      const registroInsignia = {
        id: insignia.id,
        fecha: new Date().toISOString()
      };
      logroUsuario.insignias.push(registroInsignia);
      idsObtenidas.add(insignia.id);
      insigniasNuevas.push({
        id: insignia.id,
        nombre: insignia.nombre,
        icono: insignia.icono
      });
    }
  }

  // 10. Persistir logros
  if (logroUsuario.id) {
    await almacen.actualizar('logros', logroUsuario.id, logroUsuario);
  } else {
    logroUsuario = await almacen.agregar('logros', logroUsuario);
  }

  // 11. Disparar evaluación de alertas (dentro de try/catch para no interrumpir gamificación)
  try {
    await alertas.evaluarAlertas(intentoGuardado, usuario);
  } catch (errAlertas) {
    console.error('Advertencia: Error no crítico en evaluación de alertas:', errAlertas);
  }

  return {
    puntosGanados: puntosCalculados,
    puntosTotales: logroUsuario.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
