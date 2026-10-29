// servidor/esquemas-ia.js
// Valida y normaliza la salida JSON de cada tarea de IA; si no cumple, ia.js reintenta una vez

const TIPOS_PREGUNTA = ['opcion', 'vf', 'completar'];

const texto = (v) => typeof v === 'string' && v.trim().length > 0;
const numero = (v) => typeof v === 'number' && Number.isFinite(v);

// Acepta una lista directa o un objeto que la contenga ({ preguntas: [...] })
function lista(salida, clave) {
  if (Array.isArray(salida)) return salida;
  if (Array.isArray(salida?.[clave])) return salida[clave];
  return Object.values(salida || {}).find(Array.isArray) || [];
}

// «Revisa mi borrador» (Misión 3): aspectos permitidos y señales de que la IA calificó o reescribió el trabajo
const ASPECTOS_BORRADOR = ['objetivo', 'viabilidad', 'diversidad', 'comprobacion'];
const CALIFICA = /\b\d{1,3}\s*(?:\/|de)\s*\d{1,3}\b|\bpunt(?:o|os|aje|uaci)|\bcalific|\bnota\b|\baprobad/i;
const REESCRIBE = /[«"“][^»"”]{90,}[»"”]/;
function aspectoBorrador(v) {
  const a = String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return ASPECTOS_BORRADOR.find((x) => a.startsWith(x.slice(0, 6))) || '';
}
function parteBorrador(p) {
  const aspecto = aspectoBorrador(p?.aspecto);
  if (!aspecto || !texto(p?.texto)) return null;
  const t = p.texto.trim();
  return t.length <= 450 && !CALIFICA.test(t) && !REESCRIBE.test(t) ? { aspecto, texto: t } : null;
}

const ESQUEMAS = {
  // { fortaleza: { aspecto, texto }, mejoras: [{ aspecto, texto }, { aspecto, texto }] } sin puntajes ni reescrituras
  'neuri-borrador': (salida) => {
    const fortaleza = parteBorrador(salida?.fortaleza);
    const mejoras = (Array.isArray(salida?.mejoras) ? salida.mejoras : []).map(parteBorrador);
    if (!fortaleza || mejoras.length !== 2 || mejoras.some((m) => !m)) return null;
    return { fortaleza, mejoras };
  },

  // Lista de { termino, definicion, pista, retroalimentacion }
  'generar-glosario': (salida) => lista(salida, 'terminos')
    .filter((t) => texto(t?.termino) && texto(t?.definicion) && texto(t?.pista) && texto(t?.retroalimentacion))
    .map(({ termino, definicion, pista, retroalimentacion }) => ({
      termino: termino.trim(), definicion: definicion.trim(), pista: pista.trim(), retroalimentacion: retroalimentacion.trim()
    })),

  // Lista de { tipo, enunciado, opciones, correcta, retroalimentacion }
  'generar-preguntas': (salida) => lista(salida, 'preguntas')
    .map((p) => ({ ...p, tipo: String(p?.tipo || '').trim().toLowerCase() }))
    .filter((p) => TIPOS_PREGUNTA.includes(p.tipo) && texto(p.enunciado) && Array.isArray(p.opciones)
      && p.correcta !== undefined && p.correcta !== null && texto(p.retroalimentacion)),

  // { titulo, escenaInicial, escenas[{ id, texto, imagen, opciones[{ texto, destino, puntos, consecuencia }] }] }
  // Normaliza: ids en minúsculas, máximo 4 opciones, puntos enteros de −10 a 10; la validación completa
  // (destinos, ciclos, finales) la hace el editor con escenarios.js
  'generar-escenario': (salida) => {
    if (!salida || Array.isArray(salida) || !texto(salida.titulo) || !Array.isArray(salida.escenas)) return null;
    const id = (v) => String(v).trim().toLowerCase();
    const escenas = salida.escenas
      .filter((e) => texto(e?.id) && texto(e?.texto))
      .map((e) => ({
        id: id(e.id),
        texto: e.texto.trim(),
        imagen: '',
        opciones: (Array.isArray(e.opciones) ? e.opciones : [])
          .filter((o) => texto(o?.texto) && texto(o?.destino))
          .slice(0, 4)
          .map((o) => ({
            texto: o.texto.trim(),
            destino: id(o.destino),
            puntos: Math.max(-10, Math.min(10, Math.round(Number(o.puntos) || 0))),
            consecuencia: texto(o.consecuencia) ? o.consecuencia.trim() : ''
          }))
      }));
    if (!escenas.length) return null;
    const inicial = texto(salida.escenaInicial) ? id(salida.escenaInicial) : '';
    return { titulo: salida.titulo.trim(), escenaInicial: escenas.some((e) => e.id === inicial) ? inicial : escenas[0].id, escenas };
  },

  // { puntaje, maximo, criterios[], comentarioGeneral }
  'evaluar-rol': (salida) => (salida && numero(salida.puntaje) && numero(salida.maximo) && salida.maximo > 0
    && salida.puntaje >= 0 && salida.puntaje <= salida.maximo && Array.isArray(salida.criterios)
    && texto(salida.comentarioGeneral) ? salida : null)
};

/**
 * @returns la salida normalizada; lanza Error (estado 502) si no cumple el esquema de la tarea
 */
export function validarSalida(tarea, salida) {
  const esquema = ESQUEMAS[tarea];
  if (!esquema) return salida;
  const resultado = esquema(salida);
  if (!resultado || (Array.isArray(resultado) && !resultado.length)) {
    const err = new Error('La IA no devolvió un formato válido');
    err.estado = 502;
    throw err;
  }
  return resultado;
}

export const tareasConEsquema = Object.keys(ESQUEMAS);

// ---------- Tareas de texto con control de salida ----------

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Señales de que la IA dio la solución o calificó: «la respuesta correcta es…», «opción b», «8/10», «puntaje»…
// («nota» y «puntos» se permiten: en música y en «puntos clave» son legítimos)
const REVELA = /respuesta correcta|opcion correcta|la correcta es|(elige|elegir|marca|marcar|selecciona|seleccionar)\s+la\s+(opcion|alternativa)|\b(opcion|alternativa|literal)\s+(?:[b-d]\b|a(?=[).:,;]|$))|\b\d{1,3}\s*\/\s*\d{1,3}\b|\bpuntaje|\bcalific|\baprobad/;

const CONTROLES_TEXTO = {
  tutor: (texto, control = {}) => {
    const limpio = String(texto || '').trim();
    const normal = sinTildes(limpio);
    const palabras = limpio.split(/\s+/).filter(Boolean).length;
    const frases = limpio.split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter(Boolean).length;
    const preguntas = (limpio.match(/\?/g) || []).length;
    if (!limpio || palabras > (Number(control.maxPalabras) || 90)) return null;
    if (frases < (Number(control.minFrases) || 2) || frases > (Number(control.maxFrases) || 4)) return null;
    if (preguntas !== (Number(control.preguntas) || 1) || REVELA.test(normal)) return null;
    return limpio;
  },
  // «Pregúntale a Neuri»: breve, sin soluciones (opción completa, palabras faltantes) ni calificaciones
  neuri: (texto, control = {}) => {
    const limpio = CONTROLES_TEXTO.tutor(texto, { ...control, maxPalabras: Number(control.maxPalabras) || 90 });
    if (!limpio) return null;
    const normal = sinTildes(limpio);
    if ((control.prohibidos || []).some((p) => p && new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normal))) return null;
    return limpio;
  },
  // Neuri en actividades complementarias: mismo control y, además, sin citas de la definición u opción
  // aunque cambie la puntuación, ni la palabra deletreada («C-O-R…»)
  'neuri-actividad': (texto, control = {}) => {
    const limpio = CONTROLES_TEXTO.neuri(texto, control);
    if (!limpio) return null;
    const plano = sinTildes(limpio).replace(/[^\p{L}\p{N}]+/gu, ' ');
    const junto = sinTildes(limpio).replace(/[^\p{L}\p{N}]+/gu, '');
    for (const p of (control.prohibidos || []).filter(Boolean)) {
      if (` ${plano} `.includes(` ${p} `)) return null;
      if (!p.includes(' ') && p.length >= 4 && /(\p{L}[\s.\-–,]+){3,}/u.test(sinTildes(limpio)) && junto.includes(p)) return null;
    }
    return limpio;
  }
};

export const tieneControlTexto = (tarea) => Boolean(CONTROLES_TEXTO[tarea]);

/**
 * @returns el texto aceptado; lanza Error (estado 502) si es largo, revela la solución o califica
 */
export function validarTexto(tarea, texto, control) {
  const resultado = CONTROLES_TEXTO[tarea]?.(texto, control);
  if (!resultado) {
    const err = new Error('La IA no devolvió una orientación válida');
    err.estado = 502;
    throw err;
  }
  return resultado;
}
