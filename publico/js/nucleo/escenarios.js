// publico/js/nucleo/escenarios.js
// Reglas de los escenarios del simulador (las usan el editor, el simulador y el servidor)

export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 4;
export const MIN_PUNTOS = -10;
export const MAX_PUNTOS = 10;

const etiqueta = (id) => String(id || '?').toUpperCase();
const vacio = (v) => typeof v !== 'string' || !v.trim();

/**
 * Errores que impiden publicar un escenario: [{ escena: id | null, mensaje }].
 * Revisa destinos, escena inicial, opciones (2 a 4, puntos de −10 a 10, consecuencia),
 * escenas alcanzables, al menos un final y ausencia de ciclos.
 */
export function validarEscenario(sim) {
  const errores = [];
  const error = (escena, mensaje) => errores.push({ escena, mensaje });
  if (vacio(sim?.titulo)) error(null, 'Escribe el título de la simulación.');
  if (!sim?.temaId) error(null, 'Elige el tema.');
  const escenas = Array.isArray(sim?.escenas) ? sim.escenas : [];
  if (!escenas.length) {
    error(null, 'Agrega al menos una escena.');
    return errores;
  }

  const ids = new Set();
  for (const e of escenas) {
    if (ids.has(e.id)) error(e.id, `${etiqueta(e.id)}: el identificador está repetido.`);
    ids.add(e.id);
  }
  if (!ids.has(sim.escenaInicial)) error(null, 'Elige una escena inicial que exista.');

  for (const e of escenas) {
    const opciones = Array.isArray(e.opciones) ? e.opciones : [];
    if (vacio(e.texto)) error(e.id, `${etiqueta(e.id)}: escribe el texto de la escena.`);
    if (opciones.length && (opciones.length < MIN_OPCIONES || opciones.length > MAX_OPCIONES)) {
      error(e.id, `${etiqueta(e.id)}: una escena con decisiones necesita de ${MIN_OPCIONES} a ${MAX_OPCIONES} opciones (o ninguna si es un final).`);
    }
    opciones.forEach((o, i) => {
      const n = `${etiqueta(e.id)}, opción ${i + 1}`;
      if (vacio(o.texto)) error(e.id, `${n}: escribe el texto de la opción.`);
      if (!ids.has(o.destino)) error(e.id, `${n}: elige una escena de destino que exista.`);
      else if (o.destino === e.id) error(e.id, `${n}: no puede llevar a la misma escena.`);
      const p = Number(o.puntos);
      if (!Number.isInteger(p) || p < MIN_PUNTOS || p > MAX_PUNTOS) error(e.id, `${n}: los puntos deben ser un número entero de ${MIN_PUNTOS} a ${MAX_PUNTOS}.`);
      if (vacio(o.consecuencia)) error(e.id, `${n}: escribe la consecuencia (es la retroalimentación del estudiante).`);
    });
  }
  if (!escenas.some((e) => !e.opciones?.length)) error(null, 'El escenario necesita al menos un final (una escena sin opciones).');
  if (!ids.has(sim.escenaInicial)) return errores;

  // Alcanzables desde la inicial y ciclos (búsqueda en profundidad)
  const porId = new Map(escenas.map((e) => [e.id, e]));
  const estado = new Map();   // 1 = en el camino actual, 2 = terminada
  const ciclos = new Set();
  const visitar = (id) => {
    estado.set(id, 1);
    for (const o of porId.get(id)?.opciones || []) {
      if (!porId.has(o.destino)) continue;
      if (estado.get(o.destino) === 1) {
        const clave = `${id}>${o.destino}`;
        if (!ciclos.has(clave)) {
          ciclos.add(clave);
          error(id, `${etiqueta(id)}: la opción «${o.texto || 'sin texto'}» vuelve a ${etiqueta(o.destino)} y forma un ciclo.`);
        }
      } else if (!estado.has(o.destino)) {
        visitar(o.destino);
      }
    }
    estado.set(id, 2);
  };
  visitar(sim.escenaInicial);
  for (const e of escenas) if (!estado.has(e.id)) error(e.id, `${etiqueta(e.id)}: no se puede llegar a esta escena desde la inicial.`);
  return errores;
}

/**
 * Puntaje del mejor camino desde la escena inicial hasta un final (sin repetir escenas).
 */
export function mejorPuntaje(sim) {
  const porId = new Map((sim?.escenas || []).map((e) => [e.id, e]));
  const mejor = (id, camino) => {
    const escena = porId.get(id);
    if (!escena) return null;
    if (!escena.opciones?.length) return 0;
    camino.add(id);
    let maximo = null;
    for (const o of escena.opciones) {
      if (camino.has(o.destino)) continue;   // ciclo: ese camino no termina
      const resto = mejor(o.destino, camino);
      if (resto !== null) maximo = Math.max(maximo ?? -Infinity, (Number(o.puntos) || 0) + resto);
    }
    camino.delete(id);
    return maximo;
  };
  return mejor(sim?.escenaInicial, new Set()) ?? 0;
}

/**
 * Mapa del escenario como árbol desde la escena inicial:
 * { raiz: { id, hijos: [{ opcion, puntos, nodo }] }, sueltas: [ids no alcanzables] }.
 * Una escena que ya apareció se marca con repetida: true (no se vuelve a expandir).
 */
export function mapaEscenario(sim) {
  const escenas = sim?.escenas || [];
  const porId = new Map(escenas.map((e) => [e.id, e]));
  const vistas = new Set();
  const nodo = (id) => {
    if (!porId.has(id)) return { id, inexistente: true, hijos: [] };
    if (vistas.has(id)) return { id, repetida: true, hijos: [] };
    vistas.add(id);
    const escena = porId.get(id);
    return {
      id,
      final: !escena.opciones?.length,
      hijos: (escena.opciones || []).map((o) => ({ opcion: o.texto, puntos: Number(o.puntos) || 0, nodo: nodo(o.destino) }))
    };
  };
  const raiz = porId.has(sim?.escenaInicial) ? nodo(sim.escenaInicial) : null;
  return { raiz, sueltas: escenas.map((e) => e.id).filter((id) => !vistas.has(id)) };
}

// ---------- Modo rol ----------
export const MIN_CRITERIOS = 3;
export const MAX_CRITERIOS = 5;
export const MIN_TURNOS = 4;
export const MAX_TURNOS = 12;
export const MAX_PUNTOS_CRITERIO = 20;

/**
 * Errores que impiden publicar un juego de roles: [{ escena: null, mensaje }].
 * Exige personaje (nombre, descripción, contexto y objetivo), rúbrica de 3 a 5 criterios con
 * descripción y puntos enteros de 1 a 20, y máximo de turnos de 4 a 12.
 */
export function validarRol(sim) {
  const errores = [];
  const error = (mensaje) => errores.push({ escena: null, mensaje });
  if (vacio(sim?.titulo)) error('Escribe el título de la simulación.');
  if (!sim?.temaId) error('Elige el tema.');
  const p = sim?.personaje || {};
  if (vacio(p.nombre)) error('Personaje: escribe su nombre.');
  if (vacio(p.descripcion)) error('Personaje: describe cómo es (personalidad, rol, preocupaciones).');
  if (vacio(p.contexto)) error('Personaje: escribe el contexto del caso.');
  if (vacio(p.objetivo)) error('Personaje: escribe el objetivo del estudiante.');
  const rubrica = Array.isArray(sim?.rubrica) ? sim.rubrica : [];
  if (rubrica.length < MIN_CRITERIOS || rubrica.length > MAX_CRITERIOS) error(`La rúbrica necesita de ${MIN_CRITERIOS} a ${MAX_CRITERIOS} criterios.`);
  rubrica.forEach((c, i) => {
    if (vacio(c?.criterio)) error(`Criterio ${i + 1}: escribe su nombre.`);
    if (vacio(c?.descripcion)) error(`Criterio ${i + 1}: escribe qué se espera del estudiante.`);
    const puntos = Number(c?.puntos);
    if (!Number.isInteger(puntos) || puntos < 1 || puntos > MAX_PUNTOS_CRITERIO) error(`Criterio ${i + 1}: los puntos deben ser un número entero de 1 a ${MAX_PUNTOS_CRITERIO}.`);
  });
  const turnos = Number(sim?.maxTurnos);
  if (!Number.isInteger(turnos) || turnos < MIN_TURNOS || turnos > MAX_TURNOS) error(`El máximo de turnos debe estar entre ${MIN_TURNOS} y ${MAX_TURNOS}.`);
  return errores;
}

export default { validarEscenario, validarRol, mejorPuntaje, mapaEscenario };
