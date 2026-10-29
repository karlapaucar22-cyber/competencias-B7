// servidor/preparadores/generar-escenario.js
// Arma los datos de la plantilla prompts/generar-escenario.txt (borrador de simulación por escenarios)

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const MAX_SITUACION = 800;
const MIN_ESCENAS = 5;
const MAX_ESCENAS = 10;

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

// Une un texto o una lista de textos en líneas con viñeta
function lineas(titulo, valor) {
  const lista = (Array.isArray(valor) ? valor : [valor])
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => `- ${v.trim()}`);
  return lista.length ? `${titulo}:\n${lista.join('\n')}` : '';
}

/**
 * @param {{ temaId: string, situacion: string, escenas: number }} cuerpo
 * @param {Object} usuario
 */
export default async function prepararEscenario(cuerpo, usuario) {
  const { temaId } = cuerpo || {};
  const situacion = typeof cuerpo?.situacion === 'string' ? cuerpo.situacion.trim() : '';
  const escenas = Number(cuerpo?.escenas);

  if (!temaId) rechazar('Falta el tema', 400);
  if (!situacion) rechazar('Describe la situación del escenario', 400);
  if (situacion.length > MAX_SITUACION) rechazar(`La situación puede tener hasta ${MAX_SITUACION} caracteres`, 400);
  if (!Number.isInteger(escenas) || escenas < MIN_ESCENAS || escenas > MAX_ESCENAS) {
    rechazar(`El número de escenas debe estar entre ${MIN_ESCENAS} y ${MAX_ESCENAS}`, 400);
  }

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema) rechazar('El tema no existe', 404);
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura || !(await acceso.puedeEditarAsignatura(usuario, asignatura.id))) {
    rechazar('No tienes permisos para editar este tema', 403);
  }

  const glosario = (await almacen.buscar('glosario', { temaId }))
    .filter((g) => g.estado === 'aprobado' && g.termino && g.definicion)
    .slice(0, 30)
    .map((g) => `${g.termino.trim()}: ${g.definicion.trim()}`);

  const contenido = [
    lineas('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen.trim()}` : '',
    lineas('Ejemplos', tema.ejemplos),
    lineas('Errores frecuentes', tema.erroresFrecuentes),
    lineas('Preguntas guía', tema.preguntasGuia),
    lineas('Palabras clave', tema.palabrasClave),
    lineas('Glosario', glosario)
  ].filter(Boolean).join('\n\n');

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'educación superior',
    tema: tema.titulo,
    contenido: contenido || '(sin contenido registrado)',
    situacion,
    escenas
  };
}
