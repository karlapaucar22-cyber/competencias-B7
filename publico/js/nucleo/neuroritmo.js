// publico/js/nucleo/neuroritmo.js
// Reglas puras de NeuroRitmo compartidas por el navegador y el servidor (sin datos ni respuestas)

export const MISIONES = ['m1', 'm2', 'm3'];
export const MAXIMO_MISION = 100;
export const TIPOS_SONIDO = ['silencio', 'instrumental', 'letra'];
export const VOLUMENES = ['bajo', 'medio'];
export const MINIMO_PALABRAS = { hipotesis: 6, justificacion: 20, objetivo: 8, comprobacion: 8, indicador: 4, justificacionM3: 40, diferencias: 15 };
const VERBOS_OBSERVABLES = /\b(explica\w*|aplica\w*|identifica\w*|relaciona\w*|describ\w*|compara\w*|clasifica\w*|resuelv\w*|resolver|ejemplifica\w*|argumenta\w*|distingu\w*|recuerd\w*|nombra\w*|enumera\w*)\b/i;

/**
 * Reglas de NeuroRitmo: la fuente es datos/config/reglas-gamificacion.json → "neuroritmo".
 * Estos valores solo se usan si falta alguna clave.
 */
export const REGLAS_PREDETERMINADAS = {
  misiones: MISIONES, puntosPorMision: 100, decision: 60, justificacion: 40, aprobacion: 70, logroTotal: 240,
  justificacionMinimaM3: 24, conservarMejorIntento: true, descuentoPorPista: 0, mejoraMinima: 15,
  mejoraRequiereRetro: true, ecoPalabrasMinimas: 15
};

/**
 * Normaliza y valida las reglas: decision + justificacion = puntosPorMision; ningún descuento por pistas.
 * @returns {object} reglas completas
 */
export function normalizarReglas(r = {}) {
  const reglas = { ...REGLAS_PREDETERMINADAS, ...(r || {}) };
  for (const k of ['puntosPorMision', 'decision', 'justificacion', 'aprobacion', 'logroTotal', 'justificacionMinimaM3', 'mejoraMinima', 'ecoPalabrasMinimas']) {
    reglas[k] = Number(reglas[k]);
    if (!Number.isFinite(reglas[k]) || reglas[k] < 0) throw new Error(`Regla de NeuroRitmo inválida: ${k}`);
  }
  if (reglas.decision + reglas.justificacion !== reglas.puntosPorMision) throw new Error('Reglas de NeuroRitmo: decisión + justificación debe igualar los puntos por misión');
  if (reglas.aprobacion > reglas.puntosPorMision) throw new Error('Reglas de NeuroRitmo: la aprobación supera el máximo de la misión');
  // Las pistas no restan puntos (Tarea 3): no se admite descuento
  reglas.descuentoPorPista = 0;
  reglas.maximoRuta = reglas.puntosPorMision * MISIONES.length;
  delete reglas._nota;
  return reglas;
}

/**
 * Experiencia con las reglas centrales: experiencia.reglas y los atajos aprobacion, logroTotal y
 * justificacionValidaM3 que usan las vistas y las rutas.
 */
export function combinarReglas(experiencia = {}, gamificacion = {}) {
  const reglas = normalizarReglas(gamificacion?.neuroritmo);
  return { ...experiencia, reglas, aprobacion: reglas.aprobacion, logroTotal: reglas.logroTotal, justificacionValidaM3: reglas.justificacionMinimaM3 };
}

export const contarPalabras = (texto) => String(texto || '').trim().split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

// Clave de configuración del simulador: "silencio" o "<tipo>-<volumen>"
export function claveSimulador({ tipo, volumen } = {}) {
  if (tipo === 'silencio') return 'silencio';
  if (!TIPOS_SONIDO.includes(tipo) || !VOLUMENES.includes(volumen)) return '';
  return `${tipo}-${volumen}`;
}

// Juego de parejas: sin penalizar en exceso (15, 12, 9 o 6 puntos según los errores)
export function puntosParejas(errores) {
  const e = Math.max(0, Number(errores) || 0);
  return e <= 2 ? 15 : e <= 4 ? 12 : e <= 6 ? 9 : 6;
}

export const puntosCancion = (aciertos, total = 4) => Math.round((15 * Math.max(0, Math.min(aciertos, total))) / total);

// Distribución de los 60 puntos de decisiones y productos: 15 por ítem salvo que la misión defina otra
export const PUNTOS_DECISION = 60;
export const LIMITES_PESO = { minimo: 5, maximo: 30 };
export function pesosItems(mision = {}) {
  const valores = mision.distribucion?.valores || {};
  return Object.fromEntries((mision.items || []).map((i) => [i.id, Number(valores[i.id]) || 15]));
}

// Escala los puntos de un ítem corregido sobre 15 al máximo que le asigna la distribución
export const ponderar = (puntos, maximo, base = 15) => Math.round((Math.max(0, Number(puntos) || 0) * maximo) / base);

/**
 * Valida una distribución propuesta: enteros entre 5 y 30 por ítem que sumen 60.
 * @returns {string} mensaje de error o '' si es válida
 */
export function errorDistribucion(valores = {}, items = [], total = PUNTOS_DECISION) {
  const { minimo, maximo } = LIMITES_PESO;
  for (const i of items) {
    const v = valores?.[i.id];
    if (!Number.isInteger(v) || v < minimo || v > maximo) return `«${i.titulo}» debe tener un entero de ${minimo} a ${maximo} puntos`;
  }
  const suma = items.reduce((s, i) => s + valores[i.id], 0);
  return suma === total ? '' : `La distribución debe sumar ${total} puntos (ahora suma ${suma})`;
}

/**
 * Justificación de M1 y M2: dos tarjetas (hasta 30) + explicación escrita (10 con 20 palabras, 5 con 10).
 * @returns {{ tarjetas: number, texto: number, total: number }}
 */
export function puntuarJustificacion(definicion, seleccion = [], texto = '') {
  const elegidas = [...new Set(seleccion)].slice(0, 2);
  const tarjetas = Math.min(30, elegidas.reduce((s, id) => s + (Number(definicion.tarjetas.find((t) => t.id === id)?.puntos) || 0), 0));
  const palabras = contarPalabras(texto);
  if (Array.isArray(definicion.criterios) && definicion.criterios.length) {
    // Criterios de la explicación (docente): cada uno suma si el texto contiene alguno de sus indicadores
    const normal = normalizarTexto(texto);
    const criterios = definicion.criterios.map(({ id, texto: descripcion, puntos, indicadores = [] }) => ({
      id, texto: descripcion, puntos: Number(puntos) || 0,
      cumple: palabras >= 10 && indicadores.some((ind) => normal.includes(normalizarTexto(ind)))
    }));
    const escrito = Math.min(10, criterios.reduce((s, c) => s + (c.cumple ? c.puntos : 0), 0));
    return { tarjetas, texto: escrito, total: tarjetas + escrito, criterios };
  }
  const escrito = palabras >= MINIMO_PALABRAS.justificacion ? 10 : palabras >= 10 ? 5 : 0;
  return { tarjetas, texto: escrito, total: tarjetas + escrito };
}

// Minúsculas, sin tildes y con espacios simples (para comparar indicadores)
const normalizarTexto = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');

/**
 * Lista de cotejo de la microactividad (Misión 3). No asigna puntos: la puntuación es del docente.
 * @returns {Array<{ id, texto, cumple }>}
 */
export function revisarDiseno(diseno = {}, bloques = []) {
  const secuencia = Array.isArray(diseno.secuencia) ? diseno.secuencia : [];
  const minutos = secuencia.reduce((s, id) => s + (Number(bloques.find((b) => b.id === id)?.minutos) || 0), 0);
  const recurso = diseno.recurso || {};
  const conCondiciones = recurso.tipo === 'silencio' || (recurso.tipo && recurso.volumen && Number(recurso.duracion) > 0);
  const posPractica = secuencia.indexOf('b3');
  const posRecuperacion = secuencia.indexOf('b4');
  const fundamento = normalizarTexto(diseno.justificacion);
  const integraFundamentos = /atencion/.test(fundamento)
    && /recuper/.test(fundamento)
    && /(emocion|autorregul|regulacion emocional)/.test(fundamento);
  return [
    { id: 'objetivo', texto: 'Objetivo observable (un verbo como explicar o aplicar) con al menos 8 palabras', cumple: contarPalabras(diseno.objetivo) >= MINIMO_PALABRAS.objetivo && VERBOS_OBSERVABLES.test(diseno.objetivo || '') },
    { id: 'recurso', texto: 'Recurso sonoro o silencio con sus condiciones (letra, volumen y duración)', cumple: Boolean(conCondiciones) },
    { id: 'duracion', texto: `Secuencia de 5 a 10 minutos (ahora: ${minutos} min)`, cumple: minutos >= 5 && minutos <= 10 },
    { id: 'recuperacion', texto: 'Recuperación sin apoyo después de la práctica con sonido', cumple: posRecuperacion >= 0 && (posPractica < 0 || posRecuperacion > posPractica) },
    { id: 'cierre', texto: 'Cierre y verificación como último bloque', cumple: secuencia.length > 0 && secuencia.at(-1) === 'b5' },
    { id: 'comprobacion', texto: 'Forma de comprobar el aprendizaje descrita (8 palabras o más)', cumple: contarPalabras(diseno.comprobacion) >= MINIMO_PALABRAS.comprobacion },
    { id: 'indicador', texto: 'Indicador de autorregulación (por ejemplo, concentración de 1 a 5)', cumple: contarPalabras(diseno.indicador) >= MINIMO_PALABRAS.indicador },
    { id: 'justificacion', texto: 'Justificación pedagógica de 40 palabras o más', cumple: contarPalabras(diseno.justificacion) >= MINIMO_PALABRAS.justificacionM3 },
    { id: 'fundamentos', texto: 'Justificación que relaciona atención, recuperación y emoción o autorregulación', cumple: integraFundamentos },
    { id: 'diferencias', texto: 'Precauciones ante las diferencias individuales (15 palabras o más)', cumple: contarPalabras(diseno.diferencias) >= MINIMO_PALABRAS.diferencias }
  ];
}

export const minutosSecuencia = (secuencia = [], bloques = []) => secuencia.reduce((s, id) => s + (Number(bloques.find((b) => b.id === id)?.minutos) || 0), 0);

/**
 * Estado de la ruta a partir de los intentos "neuroritmo" y las entregas de la Misión 3 del estudiante.
 * Se conserva la mejor puntuación; M3 solo cuenta si el docente la validó.
 */
export function estadoRuta(intentos = [], entregas = [], experiencia = {}) {
  // Reglas centrales (experiencia.reglas) o, si no vienen, los atajos de la experiencia
  const r = experiencia.reglas || normalizarReglas({ aprobacion: experiencia.aprobacion ?? 70, logroTotal: experiencia.logroTotal ?? 240 });
  const { aprobacion, logroTotal, puntosPorMision, conservarMejorIntento } = r;
  const misiones = {};
  let anteriorAprobada = true;
  for (const id of MISIONES) {
    const propios = intentos.filter((i) => i.detalle?.mision === id && (id !== 'm3' || i.detalle?.validada === true))
      .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
    // Reintentos: se conserva la mejor nota (o la última si la regla lo cambiara)
    const mejor = conservarMejorIntento
      ? propios.reduce((m, i) => Math.max(m, Number(i.puntaje) || 0), 0)
      : Number(propios.at(-1)?.puntaje) || 0;
    const aprobada = propios.length > 0 && mejor >= aprobacion;
    const ultimaEntrega = id === 'm3' ? [...entregas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0] : null;
    let estado = !anteriorAprobada ? 'bloqueada' : aprobada ? 'aprobada' : 'abierta';
    if (id === 'm3' && anteriorAprobada && ultimaEntrega?.estado === 'pendiente') estado = 'pendiente';
    else if (id === 'm3' && anteriorAprobada && !aprobada && ultimaEntrega?.estado === 'devuelta') estado = 'devuelta';
    misiones[id] = {
      mejor,
      intentos: id === 'm3' ? entregas.length : propios.length,
      aprobada,
      estado,
      intentosBajo: !aprobada && propios.length >= 2,
      // M3: hay al menos una valoración validada por el docente (esos intentos solo los crea el servidor al calificar)
      ...(id === 'm3' ? { validada: propios.length > 0 } : {})
    };
    // La cadena es estricta: una misión bloqueada no desbloquea la siguiente aunque tenga puntaje
    anteriorAprobada = anteriorAprobada && aprobada;
  }
  const total = MISIONES.reduce((s, id) => s + misiones[id].mejor, 0);
  // Requisito combinado del certificado «Ruta NeuroRitmo completada»: los cinco son obligatorios
  const condiciones = [
    ...MISIONES.map((id, n) => ({
      id, texto: `Misión ${n + 1}: al menos ${aprobacion}/${puntosPorMision}${id === 'm3' ? ' validados por el docente' : ''} (mejor nota: ${misiones[id].mejor})`,
      actual: misiones[id].mejor, requerido: aprobacion, cumple: misiones[id].aprobada
    })),
    { id: 'total', texto: `Al menos ${logroTotal}/${r.maximoRuta} puntos en la ruta (ahora ${total})`, actual: total, requerido: logroTotal, cumple: total >= logroTotal },
    { id: 'validacion', texto: 'Misión 3 validada por el docente con la rúbrica', actual: misiones.m3.validada ? 1 : 0, requerido: 1, cumple: misiones.m3.validada }
  ];
  return { misiones, total, maximo: r.maximoRuta, porcentaje: Math.round((total / r.maximoRuta) * 100), condiciones, cumple: condiciones.every((c) => c.cumple) };
}

// Rúbrica de la Misión 3: cuatro criterios; los de producto suman 60 y los de justificación 40
export const RUBRICA_M3 = { criterios: 4, producto: 60, justificacion: 40, minimo: 5 };

/**
 * Valida la rúbrica que configura el docente.
 * @param {Array<{ id, criterio, tipo, maximo }>} criterios
 * @returns {string} mensaje de error o '' si es válida
 */
export function errorRubrica(criterios = [], limites = RUBRICA_M3) {
  const { producto, justificacion, minimo } = { ...RUBRICA_M3, ...limites };
  if (!Array.isArray(criterios) || criterios.length !== RUBRICA_M3.criterios) return 'La rúbrica debe tener exactamente cuatro criterios';
  for (const [n, c] of criterios.entries()) {
    if (c?.id !== `c${n + 1}`) return 'Los criterios deben ser c1, c2, c3 y c4';
    if (typeof c.criterio !== 'string' || c.criterio.trim().length < 5) return `Escribe el nombre del criterio ${n + 1} (5 caracteres o más)`;
    if (!['producto', 'justificacion'].includes(c.tipo)) return `Indica si el criterio ${n + 1} evalúa el producto o la justificación`;
    if (!Number.isInteger(c.maximo) || c.maximo < minimo) return `El máximo del criterio ${n + 1} debe ser un entero de ${minimo} o más`;
  }
  const suma = (tipo) => criterios.filter((c) => c.tipo === tipo).reduce((s, c) => s + c.maximo, 0);
  if (suma('producto') !== producto) return `Los criterios de producto deben sumar ${producto} (ahora ${suma('producto')})`;
  if (suma('justificacion') !== justificacion) return `Los criterios de justificación deben sumar ${justificacion} (ahora ${suma('justificacion')})`;
  return '';
}

// Subtotales de una valoración: { producto, justificacion, total }
export function subtotalesRubrica(rubrica = [], valores = {}) {
  const suma = (tipo) => rubrica.filter((c) => c.tipo === tipo).reduce((s, c) => s + (Number(valores[c.id]) || 0), 0);
  const producto = suma('producto');
  const justificacion = suma('justificacion');
  return { producto, justificacion, total: producto + justificacion };
}

export default { MISIONES, REGLAS_PREDETERMINADAS, normalizarReglas, combinarReglas, contarPalabras, claveSimulador, puntosParejas, puntosCancion, pesosItems, ponderar, errorDistribucion, puntuarJustificacion, revisarDiseno, minutosSecuencia, estadoRuta, errorRubrica, subtotalesRubrica };
