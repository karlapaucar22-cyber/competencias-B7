// servidor/rutas/neuroritmo.js
// NeuroRitmo: Misión Cerebro Sonoro. El servidor guarda las respuestas correctas (datos/config/neuroritmo.json),
// corrige cada ítem, puntúa M1 y M2, recibe el diseño de M3 y registra la valoración del docente.

import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { exigirRol } from '../auth.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';
import { evaluarMisionPendiente } from '../alertas.js';
import * as reglas from '../../publico/js/nucleo/neuroritmo.js';

const router = Router();
export const PARTIDAS = 'neuroritmo-partidas';
export const ENTREGAS = 'neuroritmo-entregas';
export const BORRADORES = 'neuroritmo-borradores';
export const PLAZOS = 'neuroritmo-plazos';
const REGLAS_ALERTA = ['misionBaja', 'misionPendiente', 'misionRetrasada'];
const ACTIVIDAD = 'neuroritmo';
const TIPOS_PISTA = ['Pregunta orientadora', 'Pista conceptual', 'Ejemplo paralelo'];
const RESULTADOS = ['favorable', 'neutro', 'desfavorable'];
const ITEM_DISENO = 'diseno';

function error(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  return err;
}

function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  if (estado === 500) console.error('Error en NeuroRitmo:', err);
  res.status(estado).json({ error: estado === 500 ? 'Error en NeuroRitmo' : err.message });
}

// Una operación a la vez por usuario (evita respuestas duplicadas por doble clic)
const colas = new Map();
function enCola(clave, tarea) {
  const actual = (colas.get(clave) || Promise.resolve()).catch(() => {}).then(tarea);
  colas.set(clave, actual);
  actual.finally(() => { if (colas.get(clave) === actual) colas.delete(clave); }).catch(() => {});
  return actual;
}

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const normalizar = (v) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Experiencia (neuroritmo.json) con las reglas centrales de reglas-gamificacion.json → "neuroritmo"
export const leerExperiencia = async () => {
  const [experiencia, gamificacion] = await Promise.all([almacen.leerConfig('neuroritmo'), almacen.leerConfig('reglas-gamificacion')]);
  return reglas.combinarReglas(experiencia, gamificacion);
};

// Referencia única al registro creado desde Canciones; no copia ni crea otra canción.
export async function cancionPrincipalDe(experiencia) {
  const id = texto(experiencia?.cancionPrincipalId, 80);
  if (!id) return null;
  const cancion = (await almacen.leer('canciones')).find((c) => c.id === id);
  if (!cancion) return null;
  const { temaId, titulo, audio, letra, lrc, autoria, licencia } = cancion;
  return { id: cancion.id, temaId, titulo, audio, letra: letra || '', lrc: lrc || '', autoria, licencia };
}

// Guarda neuroritmo.json sin las reglas centrales (viven solo en reglas-gamificacion.json)
async function guardarExperiencia(experiencia) {
  const { reglas: _reglas, aprobacion: _a, logroTotal: _l, justificacionValidaM3: _j, ...propia } = experiencia;
  await almacen.escribirConfig('neuroritmo', propia);
}

// Límites de la rúbrica de M3 con los 60/40 de las reglas centrales
const limitesRubrica = (r) => ({ ...reglas.RUBRICA_M3, producto: r.decision, justificacion: r.justificacion });

// Reglas visibles para el navegador (sin notas internas)
const reglasPublicas = (r) => ({
  puntosPorMision: r.puntosPorMision, decision: r.decision, justificacion: r.justificacion, aprobacion: r.aprobacion,
  logroTotal: r.logroTotal, maximoRuta: r.maximoRuta, justificacionMinimaM3: r.justificacionMinimaM3,
  conservarMejorIntento: r.conservarMejorIntento, descuentoPorPista: r.descuentoPorPista, mejoraMinima: r.mejoraMinima
});

export function misionDe(experiencia, id) {
  const mision = experiencia.misiones.find((m) => m.id === id);
  if (!mision) throw error('La misión no existe', 404);
  return mision;
}

export function itemDe(mision, itemId) {
  if (mision.id === 'm3' && itemId === ITEM_DISENO) return { id: ITEM_DISENO, concepto: 'Diseño de la microactividad', pistas: mision.pistas, situacion: mision.caso };
  const item = (mision.items || []).find((i) => i.id === itemId);
  if (!item) throw error('El ítem no existe en esta misión', 404);
  return item;
}

// ---------- Versión para el navegador (sin puntos ni respuestas) ----------

function itemPublico(i) {
  const base = { id: i.id, tipo: i.tipo, titulo: i.titulo, concepto: i.concepto, recurso: i.recurso, situacion: i.situacion, enunciado: i.enunciado || '' };
  if (i.tipo === 'opcion') base.opciones = i.opciones.map(({ id, texto: t }) => ({ id, texto: t }));
  if (i.tipo === 'parejas') base.pares = i.pares;
  if (i.tipo === 'cancion') {
    Object.assign(base, { estado: i.estado || 'pendiente', estadoMensaje: i.estadoMensaje || '', autoria: i.autoria || '', licencia: i.licencia || '' });
    if (i.estado === 'publicado') Object.assign(base, { audio: i.audio, lineas: i.lineas, banco: i.banco });
  }
  return base;
}

export function versionPublica(e, cancionPrincipal = null) {
  return {
    titulo: e.titulo, narrativa: e.narrativa, objetivo: e.objetivo, duracion: e.duracion, reglasJuego: e.reglasJuego,
    aprobacion: e.aprobacion, logroTotal: e.logroTotal, justificacionValidaM3: e.justificacionValidaM3, reglas: reglasPublicas(e.reglas || reglas.normalizarReglas()), recursos: e.recursos, cancionPrincipal, galeria: { titulo: e.galeria?.titulo || '' },
    // Uso progresivo de Neuri por misión (sin notas internas)
    ia: { niveles: e.ia?.niveles || [], misiones: Object.fromEntries(Object.entries(e.ia?.misiones || {}).map(([id, p]) => [id, { desdeIntento: p.desdeIntento, modos: p.modos, descripcion: p.descripcion }])) },
    misiones: e.misiones.map((m) => ({
      id: m.id, numero: m.numero, titulo: m.titulo, estacion: m.estacion, nivel: m.nivel, subtemas: m.subtemas,
      temaId: m.temaId, insignia: m.insignia, narrativa: m.narrativa, instrucciones: m.instrucciones,
      finalizacion: m.finalizacion, aviso: m.aviso || '', caso: m.caso || '',
      items: (m.items || []).map(itemPublico),
      justificacion: m.justificacion ? {
        consigna: m.justificacion.consigna, tarjetas: m.justificacion.tarjetas.map(({ id, texto: t }) => ({ id, texto: t })),
        // Criterios de la explicación sin sus indicadores (no se revela cómo se detectan)
        criterios: (m.justificacion.criterios || []).map(({ id, texto: t, puntos }) => ({ id, texto: t, maximo: puntos }))
      } : null,
      // Máximo de cada actividad y si el docente ya aprobó la distribución (sin las razones internas)
      ...(m.distribucion ? { distribucion: { estado: m.distribucion.estado, valores: reglas.pesosItems(m), fuente: m.distribucion.fuente } } : {}),
      ...(m.id === 'm3' ? {
        recursosSonoros: m.recursosSonoros.map((s) => s.id === 'cancion-principal' && cancionPrincipal
          ? { ...s, texto: `Canción principal: ${cancionPrincipal.titulo}`, cancionId: cancionPrincipal.id }
          : s),
        bloques: m.bloques, rubrica: m.rubrica.map(({ id, criterio, tipo, maximo }) => ({ id, criterio, tipo, maximo })), rubricaEstado: m.rubricaConfig?.estado || 'propuesta'
      } : {})
    }))
  };
}

// ---------- Corrección por ítem ----------

const nivelDe = (puntos, maximo = 15) => (puntos >= maximo ? 'completo' : puntos > 0 ? 'parcial' : 'sin-puntos');

const SONIDOS = { silencio: 'silencio', instrumental: 'música instrumental suave', letra: 'canción con letra' };
const describirConfig = (c = {}) => (c.tipo === 'silencio' ? 'silencio' : `${SONIDOS[c.tipo] || c.tipo} a volumen ${c.volumen}`);

/**
 * Corrige la respuesta de un ítem de M1 o M2 con retroalimentación inmediata completa.
 * maximo: puntos del ítem según la distribución de la misión (15 por defecto); la corrección base es sobre 15.
 * @returns {{ valor, puntos, maximo, retro }} retro: { nivel, concepto, explicacion, revisar, sugerencia,
 *   complemento?, recurso, ... }. «revisar» queda vacío si la decisión obtuvo el puntaje completo.
 */
export function corregirItem(item, valor = {}, maximo = 15) {
  const r = corregirBase(item, valor);
  if (maximo !== r.maximo) {
    r.puntos = reglas.ponderar(r.puntos, maximo, r.maximo);
    r.maximo = maximo;
    r.retro.nivel = nivelDe(r.puntos, maximo);
  }
  const completo = r.puntos >= r.maximo;
  const indicador = {
    concepto: item.concepto,
    demostrado: completo,
    estado: completo ? 'adquirido' : r.puntos > 0 ? 'en-desarrollo' : 'por-reforzar',
    nivel: nivelDe(r.puntos, r.maximo),
    puntos: r.puntos,
    maximo: r.maximo
  };
  let revisar = '';
  if (!completo) {
    if (item.tipo === 'simulador') {
      revisar = `La condición elegida (${describirConfig(r.valor.config)}) no es la más defendible para esta tarea.${r.retro.coincide ? '' : ' Además, tu predicción no coincidió con el resultado del modelo.'}`;
    } else if (item.id === 'i3' && item.concepto?.includes('recuperación')) {
      revisar = 'El diagnóstico elegido no diferencia adecuadamente entre recordar una secuencia y comprender los conceptos. La melodía sirve como pista de recuperación del orden, pero comprender exige explicar el significado de cada concepto con palabras propias.';
    } else if (item.id === 'i4' && item.concepto?.includes('ritmo')) {
      revisar = 'La propuesta elegida no asegura la comprensión conceptual. El ritmo o estribillo corto debe emplearse como apoyo o pista de recuperación del orden, nunca como sustituto de la comprensión previa con ejemplos.';
    } else if (item.tipo === 'opcion') {
      revisar = 'La opción elegida no identifica la mejor respuesta para este caso.';
    } else if (item.tipo === 'parejas') {
      revisar = 'Hubo confusiones entre conceptos cercanos al formar las parejas.';
    } else if (item.tipo === 'cancion') {
      revisar = 'Algunas palabras no corresponden a las fases de la memoria descritas. Recuerda que la melodía actúa como pista de recuperación para el orden, pero cada fase debe comprenderse por su función.';
    }
  }
  const sugerencia = completo
    ? (item.tipo === 'simulador' ? 'Mantén tu decisión como hipótesis: compárala con otra condición y registra un indicador propio.' : 'Aplica este concepto en el siguiente ítem.')
    : `Consulta el recurso enlazado sobre «${item.concepto}» y vuelve a intentar la misión: se conserva tu mejor puntaje.`;
  return { ...r, retro: { ...r.retro, concepto: item.concepto, indicador, revisar, sugerencia } };
}

function corregirBase(item, valor = {}) {
  if (item.tipo === 'simulador') {
    const clave = reglas.claveSimulador(valor.config);
    if (!clave) throw error('Configura el tipo de sonido y el volumen', 400);
    const hipotesis = texto(valor.hipotesis, 600);
    if (reglas.contarPalabras(hipotesis) < reglas.MINIMO_PALABRAS.hipotesis) throw error('Escribe tu hipótesis con al menos 6 palabras', 400);
    if (!RESULTADOS.includes(valor.prediccion)) throw error('Indica tu predicción antes de comprobar', 400);
    const conf = item.configuraciones[clave];
    return {
      valor: { config: { tipo: valor.config.tipo, volumen: clave === 'silencio' ? null : valor.config.volumen }, hipotesis, prediccion: valor.prediccion },
      puntos: conf.puntos, maximo: 15,
      retro: { nivel: nivelDe(conf.puntos), resultado: conf.resultado, coincide: valor.prediccion === conf.resultado, explicacion: conf.explicacion, recurso: item.recurso }
    };
  }
  if (item.tipo === 'opcion') {
    const opcion = item.opciones.find((o) => o.id === valor.opcion);
    if (!opcion) throw error('Elige una opción', 400);
    const justificacion = valor.justificacion ? texto(valor.justificacion, 600) : null;
    const propuesta = valor.propuesta ? texto(valor.propuesta, 600) : null;
    if (justificacion && reglas.contarPalabras(justificacion) < reglas.MINIMO_PALABRAS.hipotesis) {
      throw error('Escribe tu justificación con al menos 6 palabras', 400);
    }
    if (propuesta && reglas.contarPalabras(propuesta) < reglas.MINIMO_PALABRAS.hipotesis) {
      throw error('Escribe tu propuesta con al menos 6 palabras', 400);
    }
    return {
      valor: {
        opcion: opcion.id,
        ...(justificacion ? { justificacion } : {}),
        ...(propuesta ? { propuesta } : {})
      },
      puntos: opcion.puntos,
      maximo: 15,
      retro: { nivel: nivelDe(opcion.puntos), explicacion: opcion.retro, complemento: item.explicacion, recurso: item.recurso }
    };
  }
  if (item.tipo === 'parejas') {
    const errores = Number(valor.errores);
    const formadas = new Set(Array.isArray(valor.pares) ? valor.pares : []);
    if (!Number.isInteger(errores) || errores < 0 || errores > 200) throw error('Número de errores inválido', 400);
    if (formadas.size !== item.pares.length || !item.pares.every((p) => formadas.has(p.id))) throw error('Forma las seis parejas antes de continuar', 400);
    const entradaConfusiones = valor.confusiones ?? {};
    if (!entradaConfusiones || typeof entradaConfusiones !== 'object' || Array.isArray(entradaConfusiones)) throw error('Registro de confusiones inválido', 400);
    const idsPares = new Set(item.pares.map((p) => p.id));
    if (Object.keys(entradaConfusiones).some((id) => !idsPares.has(id))) throw error('Concepto de confusión inválido', 400);
    const confusiones = {};
    for (const par of item.pares) {
      const cantidad = Number(entradaConfusiones[par.id] || 0);
      if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > 200) throw error('Registro de confusiones inválido', 400);
      if (cantidad > 0) confusiones[par.id] = cantidad;
    }
    const puntos = reglas.puntosParejas(errores);
    const conceptosConfundidos = item.pares.filter((p) => confusiones[p.id]).map((p) => `${p.concepto} (${confusiones[p.id]})`);
    return {
      valor: { errores, confusiones }, puntos, maximo: 15,
      retro: { nivel: nivelDe(puntos), explicacion: `Formaste las ${item.pares.length} parejas con ${errores} ${errores === 1 ? 'intento fallido' : 'intentos fallidos'}.${conceptosConfundidos.length ? ` Confusiones registradas: ${conceptosConfundidos.join(', ')}.` : ''} ${item.explicacion}`, recurso: item.recurso }
    };
  }
  if (item.tipo === 'cancion') {
    if (item.estado !== 'publicado') throw error(item.estadoMensaje || 'La canción todavía no está publicada', 409);
    const palabras = valor.palabras && typeof valor.palabras === 'object' ? valor.palabras : {};
    const claves = Object.keys(item.huecos);
    if (claves.length !== 4) throw error('La actividad requiere exactamente cuatro huecos autorizados', 500);
    if (!claves.every((k) => texto(palabras[k], 40))) throw error('Completa las cuatro palabras de la canción', 400);
    const porPalabra = Object.fromEntries(claves.map((k) => [k, normalizar(palabras[k]) === normalizar(item.huecos[k])]));
    const correctas = Object.values(porPalabra).filter(Boolean).length;
    const errores = claves.length - correctas;
    const detallePalabras = Object.fromEntries(claves.map((k) => [k, {
      correcta: porPalabra[k],
      mensaje: porPalabra[k] ? 'Palabra correcta.' : `Revisa esta palabra. La respuesta autorizada es «${item.huecos[k]}».`
    }]));
    const puntos = reglas.puntosCancion(correctas, claves.length);
    return {
      valor: { palabras: Object.fromEntries(claves.map((k) => [k, texto(palabras[k], 40)])), correctas, errores }, puntos, maximo: 15,
      retro: { nivel: nivelDe(puntos), porPalabra, detallePalabras, correctas, errores, explicacion: `Completaste ${correctas} de ${claves.length} palabras correctas (${errores} ${errores === 1 ? 'error' : 'errores'}). ${item.explicacion}`, recurso: item.recurso }
    };
  }
  throw error('Tipo de ítem no admitido', 400);
}

// ---------- Datos del estudiante ----------

async function datosDe(usuarioId) {
  const [intentos, entregas] = await Promise.all([almacen.leer('intentos'), almacen.leer(ENTREGAS)]);
  return {
    intentos: intentos.filter((i) => i.usuarioId === usuarioId && i.actividad === ACTIVIDAD),
    entregas: entregas.filter((e) => e.usuarioId === usuarioId)
  };
}

/**
 * Estado de la ruta del estudiante (lo usan también certificados y alertas).
 */
export async function estadoDe(usuarioId, experiencia = null) {
  const e = experiencia || (await leerExperiencia());
  const { intentos, entregas } = await datosDe(usuarioId);
  return reglas.estadoRuta(intentos, entregas, e);
}

async function grupoNeuroritmo(usuario, experiencia) {
  return (await almacen.leer('distributivo'))
    .find((g) => g.asignaturaId === experiencia.asignaturaId && (g.estudiantes || []).includes(usuario.id)) || null;
}

async function exigirParticipante(usuario, experiencia) {
  const grupo = await grupoNeuroritmo(usuario, experiencia);
  if (!grupo) throw error('NeuroRitmo forma parte de una asignatura en la que no estás matriculado', 403);
  return grupo;
}

const partidaPublica = (p) => p && ({ id: p.id, mision: p.mision, numero: p.numero, respuestas: p.respuestas || {}, pistas: p.pistas || {}, retroRevisada: Boolean(p.retroRevisada) });

async function partidaEnCurso(usuarioId, mision) {
  return (await almacen.leer(PARTIDAS)).find((p) => p.usuarioId === usuarioId && p.mision === mision && p.estado === 'en-curso') || null;
}

/**
 * Rechaza (403) una misión bloqueada según el progreso real del estudiante: M2 exige la mínima en M1 y
 * M3 en M2. Se aplica en cada acción de la misión, no solo al iniciarla. Devuelve el estado de la ruta.
 */
export async function exigirDesbloqueada(usuarioId, misionId, experiencia) {
  const estado = await estadoDe(usuarioId, experiencia);
  if (estado.misiones[misionId]?.estado === 'bloqueada') {
    throw error(`Supera la misión anterior con ${experiencia.aprobacion}/100 para desbloquear esta`, 403);
  }
  return estado;
}

async function exigirPartida(usuarioId, mision, experiencia) {
  await exigirDesbloqueada(usuarioId, mision, experiencia);
  const partida = await partidaEnCurso(usuarioId, mision);
  if (!partida) throw error('Primero inicia la misión', 409);
  return partida;
}

async function hiloGaleria(experiencia) {
  const g = experiencia.galeria || {};
  return (await almacen.leer('foros-hilos')).find((h) => h.titulo === g.titulo && h.temaId === g.temaId && !h.oculto)?.id || null;
}

// ---------- Rutas del estudiante ----------

/**
 * GET /api/neuroritmo/presentacion (sin sesión) → { experiencia } para la portada pública del Inicio:
 * narrativa, objetivo, reglas, recursos y estaciones. Sin ítems, tarjetas, bloques ni rúbrica.
 */
router.get('/neuroritmo/presentacion', async (req, res) => {
  try {
    const e = await leerExperiencia();
    const cancionPrincipal = await cancionPrincipalDe(e);
    res.json({
      experiencia: {
        titulo: e.titulo, narrativa: e.narrativa, objetivo: e.objetivo, duracion: e.duracion, reglasJuego: e.reglasJuego,
        aprobacion: e.aprobacion, logroTotal: e.logroTotal, justificacionValidaM3: e.justificacionValidaM3, reglas: reglasPublicas(e.reglas || reglas.normalizarReglas()), recursos: e.recursos, cancionPrincipal,
        galeria: { titulo: e.galeria?.titulo || '' },
        misiones: e.misiones.map(({ id, numero, titulo, estacion, nivel, subtemas, narrativa }) => ({ id, numero, titulo, estacion, nivel, subtemas, narrativa }))
      }
    });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/neuroritmo → { experiencia, rol, progreso? } (progreso solo para estudiantes del grupo)
 */
router.get('/neuroritmo', exigirRol(), async (req, res) => {
  try {
    const experiencia = await leerExperiencia();
    const cancionPrincipal = await cancionPrincipalDe(experiencia);
    const respuesta = { experiencia: versionPublica(experiencia, cancionPrincipal), rol: req.usuario.rol, galeriaHiloId: await hiloGaleria(experiencia) };
    if (req.usuario.rol === 'estudiante') {
      const grupo = await grupoNeuroritmo(req.usuario, experiencia);
      if (grupo) {
        const { intentos, entregas } = await datosDe(req.usuario.id);
        const propias = (await almacen.leer(PARTIDAS)).filter((p) => p.usuarioId === req.usuario.id);
        const partidas = propias.filter((p) => p.estado === 'en-curso');
        const ultima = [...entregas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
        const logro = (await almacen.leer('logros')).find((l) => l.usuarioId === req.usuario.id);
        const insignias = new Set((logro?.insignias || []).map((i) => i.id));
        respuesta.progreso = {
          ...reglas.estadoRuta(intentos, entregas, experiencia),
          enCurso: Object.fromEntries(partidas.map((p) => [p.mision, partidaPublica(p)])),
          // Retroalimentación del último intento terminado de M1 y M2 (para revisarla antes de reintentar)
          retroAnterior: Object.fromEntries(experiencia.misiones.filter((m) => m.items).map((m) => {
            const previa = propias.filter((p) => p.mision === m.id && p.estado === 'finalizada').sort((a, b) => b.numero - a.numero)[0];
            return [m.id, previa ? {
              numero: previa.numero, puntaje: previa.puntaje,
              items: resumenItems(m, previa.respuestas || {}).map(({ concepto, puntos, maximo, revisar, recurso }) => ({ concepto, puntos, maximo, revisar, recurso }))
            } : null];
          })),
          ultimaEntrega: ultima ? { id: ultima.id, estado: ultima.estado, etapa: etapaEntrega(ultima), version: ultima.version || 1, revisionInicio: ultima.revisionInicio || null, fecha: ultima.fecha, puntaje: ultima.puntaje ?? null, criterios: ultima.criterios || null, comentario: ultima.comentario || '', diseno: ultima.diseno } : null,
          insignias: (await almacen.leer('insignias')).filter((i) => insignias.has(i.id) && i.grupo === 'neuroritmo').map(({ id, nombre, icono }) => ({ id, nombre, icono })),
          // Todas las insignias de la ruta, para mostrar las pendientes
          insigniasRuta: (await almacen.leer('insignias')).filter((i) => i.grupo === 'neuroritmo').map(({ id, nombre, icono, descripcion }) => ({ id, nombre, icono, descripcion, obtenida: insignias.has(id) })),
          reforzar: conceptosPorReforzar(experiencia, propias, ultima),
          plazos: (await almacen.leer(PLAZOS)).find((p) => p.grupoId === grupo.id)?.plazos || {}
        };
      } else {
        respuesta.sinGrupo = true;
      }
    }
    res.json(respuesta);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/:mision/iniciar { nueva? } → partida en curso (la retoma si existe; nueva=true la reinicia)
 */
router.post('/neuroritmo/:mision/iniciar', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const partida = await enCola(usuario.id, async () => {
      const experiencia = await leerExperiencia();
      const mision = misionDe(experiencia, req.params.mision);
      await exigirParticipante(usuario, experiencia);
      const estado = await exigirDesbloqueada(usuario.id, mision.id, experiencia);
      const actual = estado.misiones[mision.id].estado;
      if (actual === 'pendiente') throw error('Tu diseño está pendiente de valoración del docente', 409);

      const previa = await partidaEnCurso(usuario.id, mision.id);
      if (previa && req.body?.nueva !== true) return previa;
      if (previa) await almacen.actualizar(PARTIDAS, previa.id, { estado: 'abandonada' });
      const numero = (await almacen.leer(PARTIDAS)).filter((p) => p.usuarioId === usuario.id && p.mision === mision.id).length + 1;
      return almacen.agregar(PARTIDAS, { usuarioId: usuario.id, mision: mision.id, numero, estado: 'en-curso', respuestas: {}, pistas: {}, ia: {} });
    });
    res.json(partidaPublica(partida));
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/:mision/responder { item, valor } → { puntos, maximo, retro } (una respuesta por ítem y partida)
 */
router.post('/neuroritmo/:mision/responder', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const resultado = await enCola(usuario.id, async () => {
      const experiencia = await leerExperiencia();
      const mision = misionDe(experiencia, req.params.mision);
      if (mision.id === 'm3') throw error('La Misión 3 se envía completa con «Enviar al docente»', 400);
      const item = itemDe(mision, req.body?.item);
      const partida = await exigirPartida(usuario.id, mision.id, experiencia);
      if (partida.respuestas?.[item.id]) throw error('Ya respondiste este ítem en este intento', 409);
      const corregido = corregirItem(item, req.body?.valor, reglas.pesosItems(mision)[item.id]);
      await almacen.actualizar(PARTIDAS, partida.id, { respuestas: { ...partida.respuestas, [item.id]: corregido } });
      return corregido;
    });
    const { puntos, maximo, retro } = resultado;
    res.json({ puntos, maximo, retro });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/:mision/retro-revisada (estudiante, M1 o M2, desde el segundo intento) → { ok, fecha }
 * Registra que abrió la retroalimentación del intento anterior: es la evidencia de «Mente en ajuste».
 */
router.post('/neuroritmo/:mision/retro-revisada', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const resultado = await enCola(usuario.id, async () => {
      const experiencia = await leerExperiencia();
      const mision = misionDe(experiencia, req.params.mision);
      if (!mision.items) throw error('La Misión 3 se revisa con la valoración docente', 400);
      const partida = await exigirPartida(usuario.id, mision.id, experiencia);
      const previa = (await almacen.leer(PARTIDAS)).some((p) => p.usuarioId === usuario.id && p.mision === mision.id && p.estado === 'finalizada');
      if (partida.numero < 2 || !previa) throw error('Aún no tienes un intento anterior terminado en esta misión', 409);
      if (!partida.retroRevisada) await almacen.actualizar(PARTIDAS, partida.id, { retroRevisada: { fecha: new Date().toISOString(), via: 'resumen' } });
      return { ok: true };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/:mision/pista { item, nivel } → pista predefinida (1 orientadora, 2 conceptual, 3 ejemplo).
 * No resta puntos, pero queda registrada para el panel docente.
 */
router.post('/neuroritmo/:mision/pista', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const resultado = await enCola(usuario.id, async () => {
      const experiencia = await leerExperiencia();
      const mision = misionDe(experiencia, req.params.mision);
      const item = itemDe(mision, req.body?.item);
      const partida = await exigirPartida(usuario.id, mision.id, experiencia);
      const nivel = Number(req.body?.nivel);
      const usadas = Number(partida.pistas?.[item.id]) || 0;
      if (!Number.isInteger(nivel) || nivel < 1 || nivel > item.pistas.length) throw error('Nivel de pista inválido', 400);
      if (nivel > usadas + 1) throw error('Abre las pistas en orden: primero la pregunta orientadora', 400);
      if (nivel > usadas) await almacen.actualizar(PARTIDAS, partida.id, { pistas: { ...partida.pistas, [item.id]: nivel } });
      return { nivel, tipo: TIPOS_PISTA[nivel - 1], pista: item.pistas[nivel - 1], total: item.pistas.length };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

export function validarDiseno(cuerpo = {}, mision) {
  const diseno = limpiarDiseno(cuerpo, mision);
  const faltan = reglas.revisarDiseno(diseno, mision.bloques).filter((criterio) => !criterio.cumple).map((criterio) => criterio.texto);
  if (!diseno.instrucciones) faltan.push('Instrucciones para el grupo');
  if (diseno.secuencia.length < 4 || diseno.secuencia.length > 6) faltan.push('Secuencia de 4 a 6 pasos');
  if (faltan.length) throw error(`Completa ${faltan.join(', ')}`, 400);
  return diseno;
}

// Diseño saneado sin exigir que esté completo (sirve para el borrador)
export function limpiarDiseno(entrada, mision) {
  const cuerpo = entrada && typeof entrada === 'object' ? entrada : {};
  const r = cuerpo.recurso && typeof cuerpo.recurso === 'object' ? cuerpo.recurso : {};
  return {
    objetivo: texto(cuerpo.objetivo, 600),
    recurso: {
      tipo: mision.recursosSonoros.some((s) => s.id === r.tipo) ? r.tipo : '',
      letra: r.tipo === 'silencio' ? null : r.letra === 'si' ? 'si' : 'no',
      volumen: r.tipo === 'silencio' ? null : ['bajo', 'medio', 'alto'].includes(r.volumen) ? r.volumen : '',
      duracion: r.tipo === 'silencio' ? 0 : Math.max(0, Math.min(10, Math.round(Number(r.duracion) || 0)))
    },
    secuencia: [...new Set(Array.isArray(cuerpo.secuencia) ? cuerpo.secuencia : [])].filter((id) => mision.bloques.some((b) => b.id === id)).slice(0, 7),
    instrucciones: texto(cuerpo.instrucciones, 1200),
    comprobacion: texto(cuerpo.comprobacion, 600),
    indicador: texto(cuerpo.indicador, 300),
    justificacion: texto(cuerpo.justificacion, 2000),
    diferencias: texto(cuerpo.diferencias, 1000)
  };
}

// ---------- Borrador y versiones de la Misión 3 ----------

// Etapa visible de una entrega: enviado → en-revision → devuelto | aprobado
export function etapaEntrega(e) {
  if (!e) return null;
  if (e.estado === 'validada') return 'aprobado';
  if (e.estado === 'devuelta') return 'devuelto';
  return e.revisionInicio ? 'en-revision' : 'enviado';
}

const marcar = (e, etapa, usuarioId) => [...(e.historial || []), { etapa, fecha: new Date().toISOString(), por: usuarioId }];

// Versión de la entrega para su autor o su docente (sin datos de otros estudiantes)
const entregaPublica = (e) => ({
  id: e.id, version: e.version || 1, versionAnterior: e.versionAnterior || null, etapa: etapaEntrega(e), estado: e.estado,
  fecha: e.fecha, fechaRevision: e.fechaRevision || null, revisionInicio: e.revisionInicio || null,
  puntaje: e.puntaje ?? null, producto: e.producto ?? null, justificacion: e.justificacion ?? null,
  criterios: e.criterios || null, rubrica: e.rubrica || null, comentario: e.comentario || '',
  diseno: e.diseno, evidencias: e.evidencias || null, historial: e.historial || []
});

async function entregasDe(usuarioId) {
  return (await almacen.leer(ENTREGAS)).filter((e) => e.usuarioId === usuarioId).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

async function exigirM3(usuario) {
  const experiencia = await leerExperiencia();
  const mision = misionDe(experiencia, 'm3');
  await exigirParticipante(usuario, experiencia);
  await exigirDesbloqueada(usuario.id, 'm3', experiencia);
  return { experiencia, mision };
}

/**
 * GET /api/neuroritmo/m3/borrador (estudiante) → { borrador, entregas }
 * borrador: { diseno, fecha, guardados, basadoEn } guardado en el servidor; si no existe y la última versión fue
 * devuelta, se propone partir de ella (basadoEn). entregas: solo las versiones propias, con su etapa y comentario.
 */
router.get('/neuroritmo/m3/borrador', exigirRol('estudiante'), async (req, res) => {
  try {
    await exigirM3(req.usuario);
    const entregas = await entregasDe(req.usuario.id);
    const propio = (await almacen.leer(BORRADORES)).find((b) => b.usuarioId === req.usuario.id);
    const ultima = entregas.at(-1);
    const borrador = propio
      ? { diseno: propio.diseno, fecha: propio.fechaActualizacion || propio.fecha, guardados: propio.guardados || 1, basadoEn: propio.basadoEn || null }
      : ultima?.estado === 'devuelta' ? { diseno: ultima.diseno, fecha: null, guardados: 0, basadoEn: ultima.id } : null;
    res.json({ borrador, entregas: entregas.map(entregaPublica) });
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * PUT /api/neuroritmo/m3/borrador { diseno, basadoEn? } (estudiante) → { fecha, guardados }
 * Guarda el borrador propio (puede estar incompleto). 409 mientras hay una versión enviada o en revisión.
 */
router.put('/neuroritmo/m3/borrador', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const resultado = await enCola(usuario.id, async () => {
      const { mision } = await exigirM3(usuario);
      const entregas = await entregasDe(usuario.id);
      if (entregas.some((e) => e.estado === 'pendiente')) throw error('Tu diseño ya fue enviado: no se puede modificar mientras tu docente lo revisa', 409);
      const diseno = limpiarDiseno(req.body?.diseno, mision);
      const basadoEn = entregas.some((e) => e.id === req.body?.basadoEn && e.estado === 'devuelta') ? req.body.basadoEn : null;
      const fecha = new Date().toISOString();
      const previo = (await almacen.leer(BORRADORES)).find((b) => b.usuarioId === usuario.id);
      const guardado = previo
        ? await almacen.actualizar(BORRADORES, previo.id, { diseno, fechaActualizacion: fecha, guardados: (previo.guardados || 1) + 1, basadoEn: basadoEn || previo.basadoEn || null })
        : await almacen.agregar(BORRADORES, { usuarioId: usuario.id, diseno, fechaActualizacion: fecha, guardados: 1, basadoEn });
      return { fecha: guardado.fechaActualizacion, guardados: guardado.guardados };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * DELETE /api/neuroritmo/m3/borrador (estudiante) → { ok } elimina solo el borrador propio
 */
router.delete('/neuroritmo/m3/borrador', exigirRol('estudiante'), async (req, res) => {
  try {
    await enCola(req.usuario.id, async () => {
      const previo = (await almacen.leer(BORRADORES)).find((b) => b.usuarioId === req.usuario.id);
      if (previo) await almacen.eliminar(BORRADORES, previo.id);
    });
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err);
  }
});

// Resumen por concepto; cada respuesta conserva el máximo con que se corrigió
export const resumenItems = (mision, respuestas) => {
  const pesos = reglas.pesosItems(mision);
  return (mision.items || []).map((i) => {
    const r = respuestas[i.id];
    const puntos = r?.puntos ?? 0;
    const maximo = r?.maximo ?? pesos[i.id];
    const demostrado = puntos >= maximo;
    return {
      id: i.id,
      concepto: i.concepto,
      recurso: i.recurso,
      puntos,
      maximo,
      demostrado,
      revisar: r?.retro?.revisar || '',
      indicador: r?.retro?.indicador || {
        concepto: i.concepto,
        demostrado,
        estado: demostrado ? 'adquirido' : puntos > 0 ? 'en-desarrollo' : 'por-reforzar',
        nivel: nivelDe(puntos, maximo),
        puntos,
        maximo
      }
    };
  });
};

/**
 * Valida la evidencia individual de cierre de M1/M2 antes de puntuarla.
 * Exige dos argumentos distintos del banco y una explicación propia breve.
 */
export function validarJustificacion(mision, cuerpo = {}) {
  const tarjetas = Array.isArray(cuerpo.tarjetas) ? [...new Set(cuerpo.tarjetas)] : [];
  if (tarjetas.length !== 2 || !tarjetas.every((id) => mision.justificacion.tarjetas.some((t) => t.id === id))) {
    throw error('Elige exactamente dos tarjetas de argumento', 400);
  }
  const escrito = texto(cuerpo.texto, 2000);
  if (reglas.contarPalabras(escrito) < 10) throw error('Redacta tu explicación con al menos 10 palabras', 400);
  return { tarjetas, escrito };
}

/**
 * POST /api/neuroritmo/:mision/finalizar
 * M1 y M2 { tarjetas: [id, id], texto } → puntaje (60 decisiones + 40 justificación), intento y estado.
 * M3 { objetivo, recurso, secuencia, instrucciones, comprobacion, indicador, justificacion, diferencias }
 *    → entrega pendiente de la valoración docente (la IA no califica).
 */
router.post('/neuroritmo/:mision/finalizar', exigirRol('estudiante'), async (req, res) => {
  try {
    const usuario = req.usuario;
    const resultado = await enCola(usuario.id, async () => {
      const experiencia = await leerExperiencia();
      const mision = misionDe(experiencia, req.params.mision);
      const grupo = await exigirParticipante(usuario, experiencia);
      const partida = await exigirPartida(usuario.id, mision.id, experiencia);
      const segundos = Math.max(0, Math.min(86400, Math.round((Date.now() - new Date(partida.fecha).getTime()) / 1000))) || 0;
      const pistas = Object.values(partida.pistas || {}).reduce((s, n) => s + Number(n || 0), 0);
      const usosIa = Object.values(partida.ia || {}).reduce((s, n) => s + Number(n || 0), 0);

      if (mision.id === 'm3') {
        if ((await almacen.leer(ENTREGAS)).some((e) => e.usuarioId === usuario.id && e.estado === 'pendiente')) {
          throw error('Ya tienes un diseño pendiente de valoración', 409);
        }
        const diseno = validarDiseno(req.body, mision);
        const cotejo = reglas.revisarDiseno(diseno, mision.bloques);
        // Versión nueva: la anterior devuelta se conserva intacta con su comentario docente
        const previas = await entregasDe(usuario.id);
        const devuelta = [...previas].reverse().find((e) => e.estado === 'devuelta');
        const borrador = (await almacen.leer(BORRADORES)).find((b) => b.usuarioId === usuario.id);
        const ahora = new Date().toISOString();
        const entrega = await almacen.agregar(ENTREGAS, {
          usuarioId: usuario.id, grupoId: grupo.id, partidaId: partida.id, diseno,
          cotejo: cotejo.filter((c) => c.cumple).length, estado: 'pendiente', pistas, usosIa,
          version: previas.length + 1, versionAnterior: devuelta?.id || null,
          // Evidencias del proceso; la puntuación la asigna solo el docente con la rúbrica
          evidencias: {
            cotejo: cotejo.map(({ id, cumple }) => ({ id, cumple })),
            minutos: reglas.minutosSecuencia(diseno.secuencia, mision.bloques),
            palabrasJustificacion: reglas.contarPalabras(diseno.justificacion),
            guardadosBorrador: borrador?.guardados || 0, pistas, usosIa, segundos
          },
          historial: [{ etapa: 'enviado', fecha: ahora, por: usuario.id }]
        });
        if (borrador) await almacen.eliminar(BORRADORES, borrador.id);
        await almacen.actualizar(PARTIDAS, partida.id, { estado: 'finalizada', entregaId: entrega.id, fechaFin: new Date().toISOString() });
        const persona = (await almacen.leer('usuarios')).find((u) => u.id === usuario.id) || usuario;
        try {
          await notificar(grupo.docenteId, {
            tipo: 'neuroritmo',
            mensaje: `${`${persona.nombre || ''} ${persona.apellido || ''}`.trim() || 'Un estudiante'} envió su microactividad de la Misión 3 de NeuroRitmo para tu valoración.`,
            enlace: `/index.html?grupoId=${encodeURIComponent(grupo.id)}#panel`
          });
        } catch (err) {
          console.error('No se pudo avisar al docente:', err.message);
        }
        return { enviado: true, entrega: { id: entrega.id, estado: entrega.estado, fecha: entrega.fecha }, cotejo, finalizacion: mision.finalizacion, estado: await estadoDe(usuario.id, experiencia) };
      }

      const respuestas = partida.respuestas || {};
      if (!mision.items.every((i) => respuestas[i.id])) throw error('Responde los cuatro ítems antes de justificar', 400);
      const { tarjetas, escrito } = validarJustificacion(mision, req.body);

      // Reglas centrales: decisión (60) + justificación (40) = 100; las pistas no descuentan
      const r = experiencia.reglas;
      const justificacion = reglas.puntuarJustificacion(mision.justificacion, tarjetas, escrito);
      const items = resumenItems(mision, respuestas);
      const decision = Math.min(r.decision, items.reduce((s, i) => s + i.puntos, 0));
      const puntaje = Math.max(0, Math.min(r.puntosPorMision, decision + Math.min(r.justificacion, justificacion.total) - pistas * r.descuentoPorPista));
      const anterior = (await estadoDe(usuario.id, experiencia)).misiones[mision.id];
      // «Revisó la retroalimentación» en este reintento: abrió la del intento anterior, pidió pistas o consultó a Neuri
      const retroRevisada = partida.numero > 1 && Boolean(partida.retroRevisada || pistas > 0 || usosIa > 0);
      await almacen.actualizar(PARTIDAS, partida.id, {
        estado: 'finalizada', fechaFin: new Date().toISOString(), puntaje, decision,
        justificacion: { tarjetas, texto: escrito, puntos: justificacion }
      });
      const gamificacion = await procesarIntento(usuario, {
        actividad: ACTIVIDAD, temaId: mision.temaId, puntaje, maximo: r.puntosPorMision,
        errores: items.filter((i) => i.puntos < i.maximo).length, duracionSeg: segundos,
        detalle: { mision: mision.id, partidaId: partida.id, numero: partida.numero, decision, justificacion: justificacion.total, pistas, usosIa, retroRevisada }
      });
      const estado = await estadoDe(usuario.id, experiencia);
      return {
        puntaje, decision, justificacion, items, aprobada: puntaje >= experiencia.aprobacion,
        mejor: estado.misiones[mision.id].mejor, mejorAnterior: anterior.mejor, gamificacion, estado,
        tarjetas: tarjetas.map((id) => {
          const t = mision.justificacion.tarjetas.find((x) => x.id === id);
          return { id, nivel: nivelDe(t.puntos), texto: t.texto };
        }),
        explicacion: mision.justificacion.explicacion,
        distribucion: mision.distribucion ? mision.distribucion.estado : null,
        reforzar: [...items.filter((i) => i.puntos < i.maximo).map((i) => i.concepto), ...(justificacion.total < r.justificacion * 0.6 ? [mision.justificacion.concepto] : [])],
        finalizacion: mision.finalizacion
      };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

// ---------- Rutas del docente ----------

async function grupoDelDocente(usuario, grupoId, experiencia) {
  const grupo = (await almacen.leer('distributivo')).find((g) => g.id === grupoId);
  if (!grupo) throw error('Grupo no encontrado', 404);
  if (usuario.rol !== 'admin' && grupo.docenteId !== usuario.id) throw error('No eres docente de este grupo', 403);
  if (grupo.asignaturaId !== experiencia.asignaturaId) throw error('NeuroRitmo no forma parte de la asignatura de este grupo', 400);
  return grupo;
}

/**
 * GET /api/neuroritmo/grupos (docente o admin) → grupos de la asignatura de NeuroRitmo que puede consultar
 */
router.get('/neuroritmo/grupos', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const experiencia = await leerExperiencia();
    const grupos = (await acceso.gruposDe(req.usuario)).filter((g) => g.asignaturaId === experiencia.asignaturaId);
    res.json(grupos.map(({ id, paralelo, periodo, estudiantes }) => ({ id, paralelo, periodo, estudiantes: (estudiantes || []).length })));
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * Conceptos por reforzar del estudiante: ítems sin puntaje completo y justificación baja en el último
 * intento terminado de M1 y M2, y la versión de M3 devuelta con su comentario docente.
 * @returns {Array<{ mision, concepto, recurso?, detalle? }>}
 */
export function conceptosPorReforzar(experiencia, partidasPropias, ultimaEntrega) {
  const lista = [];
  for (const m of experiencia.misiones.filter((x) => x.items)) {
    const ultima = partidasPropias.filter((p) => p.mision === m.id && p.estado === 'finalizada').sort((a, b) => b.numero - a.numero)[0];
    if (!ultima) continue;
    for (const i of resumenItems(m, ultima.respuestas || {}).filter((x) => x.puntos < x.maximo)) {
      lista.push({ mision: m.id, concepto: i.concepto, recurso: i.recurso, detalle: i.revisar || '' });
    }
    if (Number(ultima.justificacion?.puntos?.total) < experiencia.reglas.justificacion * 0.6) lista.push({ mision: m.id, concepto: m.justificacion.concepto });
  }
  if (ultimaEntrega?.estado === 'devuelta') lista.push({ mision: 'm3', concepto: 'Microactividad: atiende el comentario de tu docente', detalle: ultimaEntrega.comentario || '' });
  return lista;
}

/**
 * GET /api/neuroritmo/plazos?grupoId= (docente del grupo o admin) → { grupoId, plazos{ m1, m2, m3 }, fecha }
 * PUT /api/neuroritmo/plazos { grupoId, plazos{ m1?, m2?, m3? } } (solo el docente del grupo)
 * Fechas AAAA-MM-DD (vacío = sin plazo) en orden no decreciente. Se usan para la alerta misionRetrasada.
 */
router.get('/neuroritmo/plazos', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const experiencia = await leerExperiencia();
    const grupo = await grupoDelDocente(req.usuario, String(req.query.grupoId || ''), experiencia);
    const registro = (await almacen.leer(PLAZOS)).find((p) => p.grupoId === grupo.id);
    res.json({ grupoId: grupo.id, plazos: registro?.plazos || {}, fecha: registro?.fechaActualizacion || null });
  } catch (err) {
    responderError(res, err);
  }
});

router.put('/neuroritmo/plazos', exigirRol('docente'), async (req, res) => {
  try {
    const resultado = await enCola(`plazos:${req.body?.grupoId}`, async () => {
      const experiencia = await leerExperiencia();
      const grupo = await grupoDelDocente(req.usuario, String(req.body?.grupoId || ''), experiencia);
      const entrada = req.body?.plazos && typeof req.body.plazos === 'object' ? req.body.plazos : {};
      const plazos = {};
      for (const m of experiencia.misiones) {
        const v = entrada[m.id];
        if (v === undefined || v === null || v === '') continue;
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw error(`La fecha de la misión ${m.numero} debe tener el formato AAAA-MM-DD`, 400);
        plazos[m.id] = v;
      }
      const fechas = experiencia.misiones.map((m) => plazos[m.id]).filter(Boolean);
      if (fechas.some((f, n) => n > 0 && f < fechas[n - 1])) throw error('Los plazos deben respetar el orden de las misiones', 400);
      const ahora = new Date().toISOString();
      const previo = (await almacen.leer(PLAZOS)).find((p) => p.grupoId === grupo.id);
      const guardado = previo
        ? await almacen.actualizar(PLAZOS, previo.id, { plazos, docenteId: req.usuario.id, fechaActualizacion: ahora })
        : await almacen.agregar(PLAZOS, { grupoId: grupo.id, plazos, docenteId: req.usuario.id, fechaActualizacion: ahora });
      return { grupoId: grupo.id, plazos: guardado.plazos, fecha: guardado.fechaActualizacion };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * GET /api/neuroritmo/panel?grupoId= (docente del grupo o admin)
 * → { estudiantes, conceptos, pendientes, revisadas }
 */
router.get('/neuroritmo/panel', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const experiencia = await leerExperiencia();
    const grupo = await grupoDelDocente(req.usuario, String(req.query.grupoId || ''), experiencia);
    const ids = new Set(grupo.estudiantes || []);
    // Alertas de acompañamiento por plazo o misión pendiente antes de armar el panel
    try {
      await evaluarMisionPendiente(grupo);
    } catch (err) {
      console.error('No se pudieron evaluar las alertas de NeuroRitmo:', err.message);
    }
    const [usuarios, intentos, entregas, partidas, alertas, plazos] = await Promise.all(['usuarios', 'intentos', ENTREGAS, PARTIDAS, 'alertas', PLAZOS].map((c) => almacen.leer(c)));
    const alertasNeuro = alertas.filter((a) => a.grupoId === grupo.id && a.estado === 'activa' && REGLAS_ALERTA.includes(a.regla));
    const nombre = (id) => {
      const u = usuarios.find((x) => x.id === id);
      return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : id;
    };
    const propiasDe = (id) => partidas.filter((p) => p.usuarioId === id);

    const estudiantes = [...ids].map((id) => {
      const estado = reglas.estadoRuta(
        intentos.filter((i) => i.usuarioId === id && i.actividad === ACTIVIDAD),
        entregas.filter((e) => e.usuarioId === id), experiencia
      );
      const pistas = propiasDe(id).reduce((s, p) => s + Object.values(p.pistas || {}).reduce((a, n) => a + Number(n || 0), 0), 0);
      return { id, nombre: nombre(id), misiones: estado.misiones, total: estado.total, cumple: estado.cumple, pistas, alertas: alertasNeuro.filter((a) => a.estudianteId === id).length };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    // Resultados por concepto: respuestas registradas en las partidas del grupo
    const conceptos = [];
    for (const mision of experiencia.misiones.filter((m) => m.items)) {
      const delGrupo = partidas.filter((p) => ids.has(p.usuarioId) && p.mision === mision.id);
      for (const item of mision.items) {
        const respuestas = delGrupo.map((p) => p.respuestas?.[item.id]).filter(Boolean);
        const puntos = respuestas.reduce((s, r) => s + Number(r.puntos || 0), 0);
        const maximos = respuestas.reduce((s, r) => s + Number(r.maximo || 15), 0);
        conceptos.push({
          mision: mision.id, item: item.id, concepto: item.concepto, respuestas: respuestas.length,
          logro: respuestas.length ? Math.round((puntos / maximos) * 100) : null,
          pistas: delGrupo.reduce((s, p) => s + Number(p.pistas?.[item.id] || 0), 0)
        });
      }
      const justificadas = delGrupo.filter((p) => p.justificacion);
      conceptos.push({
        mision: mision.id, item: 'justificacion', concepto: mision.justificacion.concepto, respuestas: justificadas.length,
        logro: justificadas.length ? Math.round((justificadas.reduce((s, p) => s + Number(p.justificacion.puntos?.total || 0), 0) / (justificadas.length * experiencia.reglas.justificacion)) * 100) : null,
        pistas: 0
      });
    }

    const m3 = misionDe(experiencia, 'm3');
    // Cada entrega con su etapa y, si es una mejora, la versión devuelta anterior con su comentario
    const conCotejo = (e) => {
      const anterior = e.versionAnterior ? entregas.find((x) => x.id === e.versionAnterior) : null;
      return {
        ...entregaPublica(e), usuarioId: e.usuarioId, grupoId: e.grupoId, pistas: e.pistas, usosIa: e.usosIa,
        estudiante: nombre(e.usuarioId), cotejo: reglas.revisarDiseno(e.diseno, m3.bloques),
        anterior: anterior ? entregaPublica(anterior) : null
      };
    };
    const delGrupo = entregas.filter((e) => e.grupoId === grupo.id).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    res.json({
      grupo: { id: grupo.id, paralelo: grupo.paralelo, periodo: grupo.periodo },
      estudiantes, conceptos,
      plazos: plazos.find((p) => p.grupoId === grupo.id)?.plazos || {},
      alertas: alertasNeuro.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
        .map((a) => ({ id: a.id, regla: a.regla, estudiante: nombre(a.estudianteId), detalle: a.detalle, fecha: a.fecha })),
      pendientes: delGrupo.filter((e) => e.estado === 'pendiente').map(conCotejo),
      revisadas: delGrupo.filter((e) => e.estado !== 'pendiente').slice(-10).reverse().map(conCotejo)
    });
  } catch (err) {
    responderError(res, err);
  }
});

// ---------- Distribución de puntos de M2 (aprobación docente) ----------

async function misionConDistribucion(usuario) {
  const experiencia = await leerExperiencia();
  const mision = experiencia.misiones.find((m) => m.distribucion);
  if (!mision) throw error('Ninguna misión tiene distribución de puntos por aprobar', 404);
  const puede = usuario.rol === 'admin' || (await acceso.puedeEditarAsignatura(usuario, experiencia.asignaturaId));
  return { experiencia, mision, puede };
}

function distribucionDocente(mision, usuarios, puede, total60) {
  const d = mision.distribucion;
  const aprobador = usuarios.find((u) => u.id === d.aprobadaPor);
  const pesos = reglas.pesosItems(mision);
  return {
    mision: mision.id, titulo: mision.titulo, estado: d.estado, fuente: d.fuente, total: total60,
    limites: reglas.LIMITES_PESO, puedeAprobar: puede && d.estado !== 'aprobada',
    items: mision.items.map((i) => ({
      id: i.id, titulo: i.titulo, tipo: i.tipo, concepto: i.concepto, valor: pesos[i.id],
      propuesto: d.propuestaOriginal?.[i.id] ?? pesos[i.id], razon: d.razones?.[i.id] || ''
    })),
    aprobadaPor: aprobador ? `${aprobador.nombre || ''} ${aprobador.apellido || ''}`.trim() : null,
    fechaAprobacion: d.fechaAprobacion || null, ajustada: Boolean(d.propuestaOriginal)
  };
}

/**
 * GET /api/neuroritmo/distribucion (docente o admin) → propuesta de reparto de los 60 puntos de M2,
 * con la razón de cada valor y su estado ("propuesta" | "aprobada").
 */
router.get('/neuroritmo/distribucion', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const { experiencia, mision, puede } = await misionConDistribucion(req.usuario);
    res.json(distribucionDocente(mision, await almacen.leer('usuarios'), puede, experiencia.reglas.decision));
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/distribucion { valores: { i1..i4 } } (docente de la asignatura o admin)
 * Aprueba la distribución (tal cual o ajustada: enteros de 5 a 30 que sumen 60). Solo una vez;
 * los intentos ya finalizados conservan el puntaje con que se corrigieron.
 */
router.post('/neuroritmo/distribucion', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const resultado = await enCola('config:neuroritmo', async () => {
      const { experiencia, mision, puede } = await misionConDistribucion(req.usuario);
      if (!puede) throw error('Solo el docente de la asignatura de NeuroRitmo puede aprobar la distribución', 403);
      if (mision.distribucion.estado === 'aprobada') throw error('La distribución ya fue aprobada', 409);
      const entrada = req.body?.valores && typeof req.body.valores === 'object' ? req.body.valores : {};
      const valores = Object.fromEntries(mision.items.map((i) => [i.id, Number(entrada[i.id])]));
      const fallo = reglas.errorDistribucion(valores, mision.items, experiencia.reglas.decision);
      if (fallo) throw error(fallo, 400);
      const propuesta = reglas.pesosItems(mision);
      const ajustada = mision.items.some((i) => valores[i.id] !== propuesta[i.id]);
      mision.distribucion = {
        ...mision.distribucion, estado: 'aprobada', valores,
        ...(ajustada ? { propuestaOriginal: propuesta } : {}),
        aprobadaPor: req.usuario.id, fechaAprobacion: new Date().toISOString()
      };
      await guardarExperiencia(experiencia);
      return distribucionDocente(mision, await almacen.leer('usuarios'), puede, experiencia.reglas.decision);
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/entregas/:id/revision (docente del grupo o admin) → entrega en etapa "en-revision".
 * Solo desde "enviado"; el estudiante ya no puede modificarla y no se asigna ningún puntaje.
 */
router.post('/neuroritmo/entregas/:id/revision', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const resultado = await enCola(`entrega:${req.params.id}`, async () => {
      const experiencia = await leerExperiencia();
      const entrega = (await almacen.leer(ENTREGAS)).find((e) => e.id === req.params.id);
      if (!entrega) throw error('Entrega no encontrada', 404);
      await grupoDelDocente(req.usuario, entrega.grupoId, experiencia);
      if (etapaEntrega(entrega) !== 'enviado') throw error('La revisión de esta entrega ya comenzó o terminó', 409);
      const ahora = new Date().toISOString();
      return entregaPublica(await almacen.actualizar(ENTREGAS, entrega.id, {
        revisionInicio: ahora, revisadaPor: req.usuario.id, historial: marcar(entrega, 'en-revision', req.usuario.id)
      }));
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

// ---------- Rúbrica de la Misión 3 (configurada y aprobada por el equipo docente) ----------

function rubricaDocente(m3, usuarios, puede, r) {
  const conf = m3.rubricaConfig || { estado: 'propuesta', version: 0, historial: [] };
  const nombre = (id) => {
    const u = usuarios.find((x) => x.id === id);
    return u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : null;
  };
  return {
    estado: conf.estado, version: conf.version || 0, fuente: conf.fuente || '', puedeConfigurar: puede,
    criterios: m3.rubrica.map(({ id, criterio, descripcion, tipo, maximo }) => ({ id, criterio, descripcion: descripcion || '', tipo, maximo })),
    limites: limitesRubrica(r),
    aprobadaPor: nombre(conf.aprobadaPor), fechaAprobacion: conf.fechaAprobacion || null,
    historial: (conf.historial || []).map((h) => ({ ...h, por: nombre(h.por) }))
  };
}

const puedeConfigurarRubrica = async (usuario, experiencia) => usuario.rol === 'docente' && acceso.puedeEditarAsignatura(usuario, experiencia.asignaturaId);

/**
 * GET /api/neuroritmo/rubrica (docente o admin) → { estado: propuesta|aprobada, version, criterios[4], historial, ... }
 */
router.get('/neuroritmo/rubrica', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const experiencia = await leerExperiencia();
    const m3 = misionDe(experiencia, 'm3');
    res.json(rubricaDocente(m3, await almacen.leer('usuarios'), await puedeConfigurarRubrica(req.usuario, experiencia), experiencia.reglas));
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * PUT /api/neuroritmo/rubrica { criterios[{ id, criterio, descripcion, tipo, maximo }], aprobar?, confirmado? }
 * Solo el docente de la asignatura. Guardar deja la rúbrica como "propuesta" (también si estaba aprobada);
 * aprobar exige confirmado: true y crea una versión nueva. Todo cambio queda en el historial.
 */
router.put('/neuroritmo/rubrica', exigirRol('docente'), async (req, res) => {
  try {
    const resultado = await enCola('config:neuroritmo', async () => {
      const experiencia = await leerExperiencia();
      const m3 = misionDe(experiencia, 'm3');
      if (!(await puedeConfigurarRubrica(req.usuario, experiencia))) throw error('Solo el docente de la asignatura de NeuroRitmo puede configurar la rúbrica', 403);
      const entrada = Array.isArray(req.body?.criterios) ? req.body.criterios : [];
      const criterios = entrada.map((c) => ({
        id: c?.id, criterio: texto(c?.criterio, 200), descripcion: texto(c?.descripcion, 600),
        tipo: c?.tipo, maximo: Number(c?.maximo)
      }));
      const fallo = reglas.errorRubrica(criterios, limitesRubrica(experiencia.reglas));
      if (fallo) throw error(fallo, 400);
      const aprobar = req.body?.aprobar === true;
      if (aprobar && req.body?.confirmado !== true) throw error('Confirma la aprobación de la rúbrica', 400);
      const previa = m3.rubricaConfig || { version: 0, historial: [] };
      const ahora = new Date().toISOString();
      const version = aprobar ? (previa.version || 0) + 1 : previa.version || 0;
      m3.rubrica = criterios;
      m3.rubricaConfig = {
        ...previa, estado: aprobar ? 'aprobada' : 'propuesta', version,
        aprobadaPor: aprobar ? req.usuario.id : null, fechaAprobacion: aprobar ? ahora : null,
        historial: [...(previa.historial || []), { accion: aprobar ? 'aprobada' : 'guardada', version, fecha: ahora, por: req.usuario.id }]
      };
      await guardarExperiencia(experiencia);
      return rubricaDocente(m3, await almacen.leer('usuarios'), true, experiencia.reglas);
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

/**
 * POST /api/neuroritmo/entregas/:id/calificar
 *   { criterios: { c1..c4 }, decision: "validada" | "devuelta", comentario, confirmado: true, rubricaVersion }
 * Solo el docente del grupo (ni estudiantes ni admin). Exige la rúbrica aprobada por el equipo docente, en la
 * misma versión que vio el docente, y confirmación explícita. Producto hasta 60 y justificación hasta 40;
 * validar exige el mínimo de justificación (justificacionValidaM3). Queda en el historial de la entrega.
 */
router.post('/neuroritmo/entregas/:id/calificar', exigirRol('docente'), async (req, res) => {
  try {
    const resultado = await enCola(`entrega:${req.params.id}`, async () => {
      const experiencia = await leerExperiencia();
      const m3 = misionDe(experiencia, 'm3');
      const entrega = (await almacen.leer(ENTREGAS)).find((e) => e.id === req.params.id);
      if (!entrega) throw error('Entrega no encontrada', 404);
      await grupoDelDocente(req.usuario, entrega.grupoId, experiencia);
      if (entrega.usuarioId === req.usuario.id) throw error('No puedes valorar tu propia entrega', 403);
      if (entrega.estado !== 'pendiente') throw error('Esta entrega ya fue valorada', 409);
      const conf = m3.rubricaConfig || {};
      if (conf.estado !== 'aprobada') throw error('La rúbrica de la Misión 3 aún no está aprobada por el equipo docente: apruébala antes de calificar', 409);
      if (Number(req.body?.rubricaVersion) !== conf.version) throw error('La rúbrica cambió mientras calificabas: recarga el panel', 409);
      if (req.body?.confirmado !== true) throw error('Confirma la calificación antes de enviarla', 400);

      const { decision } = req.body || {};
      if (!['validada', 'devuelta'].includes(decision)) throw error('La decisión debe ser "validada" o "devuelta"', 400);
      const criterios = {};
      for (const c of m3.rubrica) {
        const valor = Number(req.body?.criterios?.[c.id]);
        if (!Number.isInteger(valor) || valor < 0 || valor > c.maximo) throw error(`«${c.criterio}» debe ser un entero de 0 a ${c.maximo}`, 400);
        criterios[c.id] = valor;
      }
      const comentario = texto(req.body?.comentario, 1000);
      if (decision === 'devuelta' && !comentario) throw error('Escribe un comentario formativo para devolver el diseño', 400);
      const { producto, justificacion, total: puntaje } = reglas.subtotalesRubrica(m3.rubrica, criterios);
      if (decision === 'validada' && justificacion < experiencia.justificacionValidaM3) {
        throw error(`Para validar, la justificación necesita al menos ${experiencia.justificacionValidaM3}/${experiencia.reglas.justificacion}; devuélvela con un comentario`, 400);
      }
      const ahora = new Date().toISOString();
      const actualizada = await almacen.actualizar(ENTREGAS, entrega.id, {
        estado: decision, criterios, producto, justificacion, puntaje, comentario, docenteId: req.usuario.id, fechaRevision: ahora,
        revisionInicio: entrega.revisionInicio || ahora,
        // Copia de la rúbrica aplicada: la valoración no cambia si después se edita la rúbrica
        rubrica: { version: conf.version, criterios: m3.rubrica.map(({ id, criterio, tipo, maximo }) => ({ id, criterio, tipo, maximo })) },
        historial: [...(entrega.historial || []), {
          etapa: decision === 'validada' ? 'aprobado' : 'devuelto', fecha: ahora, por: req.usuario.id,
          producto, justificacion, puntaje, rubricaVersion: conf.version
        }]
      });

      const estudiante = (await almacen.leer('usuarios')).find((u) => u.id === entrega.usuarioId);
      let gamificacion = null;
      if (decision === 'validada' && estudiante) {
        gamificacion = await procesarIntento(estudiante, {
          actividad: ACTIVIDAD, temaId: m3.temaId, puntaje, maximo: experiencia.reglas.puntosPorMision, errores: 0,
          detalle: { mision: 'm3', validada: true, entregaId: entrega.id, decision: producto, justificacion, rubricaVersion: conf.version }
        });
      }
      try {
        await notificar(entrega.usuarioId, {
          tipo: 'neuroritmo',
          mensaje: decision === 'validada'
            ? `Tu docente validó tu Misión 3 de NeuroRitmo: ${puntaje}/100.`
            : 'Tu docente revisó tu Misión 3 de NeuroRitmo y te dejó sugerencias para mejorarla.',
          enlace: '/index.html#resultados'
        });
      } catch (err) {
        console.error('No se pudo avisar al estudiante:', err.message);
      }
      return { entrega: actualizada, gamificacion };
    });
    res.json(resultado);
  } catch (err) {
    responderError(res, err);
  }
});

export default router;
