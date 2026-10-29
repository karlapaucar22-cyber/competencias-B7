// servidor/preparadores/rol-simulacion.js
// Juego de roles: el personaje responde al estudiante (plantilla del Anexo B.5)

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { filtrarLista } from '../ganchos/simulaciones.js';

export const MAX_TEXTO = 1000;
const MAX_VALOR = 6000;   // ia.rellenar recorta cada {{clave}} a 6.000 caracteres
const ROLES = ['estudiante', 'personaje'];

export function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

/**
 * Simulación en modo rol visible para el usuario (mismas reglas que el listado) con su tema y asignatura.
 */
export async function simulacionDeRol(usuario, simulacionId) {
  if (typeof simulacionId !== 'string' || !simulacionId) rechazar('Falta la simulación', 400);
  const sim = (await almacen.leer('simulaciones')).find((s) => s.id === simulacionId);
  const visible = sim && (await filtrarLista([sim], usuario)).length > 0;
  if (!visible || sim.modo !== 'rol') rechazar('Juego de roles no encontrado', 404);
  const tema = (await almacen.leer('temas')).find((t) => t.id === sim.temaId);
  const asignatura = await acceso.asignaturaDeTema(sim.temaId);
  return { sim, tema, asignatura, maxTurnos: Number(sim.maxTurnos) || 6 };
}

/**
 * Valida el historial del navegador [{ rol: "estudiante" | "personaje", texto }] y lo limita a los
 * últimos maxTurnos turnos (un turno = mensaje del estudiante + respuesta del personaje).
 */
export function validarHistorial(historial, maxTurnos) {
  if (!Array.isArray(historial) || !historial.length) rechazar('Escribe tu primer mensaje', 400);
  const limpio = historial.map((m) => {
    if (!m || !ROLES.includes(m.rol) || typeof m.texto !== 'string') rechazar('Historial no válido: usa [{ rol: "estudiante" | "personaje", texto }]', 400);
    const texto = m.texto.trim();
    if (texto.length > MAX_TEXTO) rechazar(`Cada mensaje puede tener hasta ${MAX_TEXTO.toLocaleString('es-EC')} caracteres`, 400);
    return { rol: m.rol, texto };
  }).filter((m) => m.texto);
  return limpio.slice(-maxTurnos * 2);
}

export const turnosDe = (historial) => historial.filter((m) => m.rol === 'estudiante').length;

/**
 * @param {{ simulacionId: string, historial: Array<{ rol, texto }> }} cuerpo
 * @returns {{ personaje, contexto, objetivo, historial (texto), mensaje }}
 */
export default async function prepararRol(cuerpo, usuario) {
  const { sim, tema, asignatura, maxTurnos } = await simulacionDeRol(usuario, cuerpo?.simulacionId);
  if (Array.isArray(cuerpo?.historial) && turnosDe(cuerpo.historial) > maxTurnos) {
    rechazar(`Llegaste al máximo de ${maxTurnos} turnos: termina la conversación para ver tu evaluación`, 400);
  }
  const historial = validarHistorial(cuerpo?.historial, maxTurnos);
  const ultimo = historial.at(-1);
  if (!ultimo || ultimo.rol !== 'estudiante') rechazar('El último mensaje debe ser del estudiante', 400);

  const p = sim.personaje || {};
  const nombre = p.nombre || 'Personaje';
  // Conversación previa como texto para {{historial}} (Anexo B.5); si no cabe, se conservan las líneas
  // más recientes. El último mensaje del estudiante va en {{mensaje}}.
  const lineas = [];
  let largo = 0;
  for (const m of historial.slice(0, -1).reverse()) {
    const linea = `${m.rol === 'personaje' ? nombre : 'Estudiante'}: ${m.texto}`;
    if (largo + linea.length + 1 > MAX_VALOR) break;
    lineas.unshift(linea);
    largo += linea.length + 1;
  }
  return {
    personaje: `${nombre}: ${p.descripcion || ''}`.trim(),
    contexto: p.contexto || '',
    objetivo: p.objetivo || '',
    asignatura: asignatura?.nombre || '',
    nivel: asignatura?.nivel || 'educación superior',
    tema: tema?.titulo || '',
    historial: lineas.length ? lineas.join('\n') : '(Es el inicio de la conversación.)',
    mensaje: ultimo.texto
  };
}
