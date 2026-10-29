// servidor/preparadores/generar-preguntas.js
// Arma los datos de la plantilla prompts/generar-preguntas.txt

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const NIVELES_BLOOM = { 1: 'Recordar', 2: 'Comprender', 3: 'Aplicar', 4: 'Analizar', 5: 'Evaluar' };

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
 * @param {{ temaId: string, nivel: number, cantidad: number }} cuerpo
 * @param {Object} usuario
 */
export default async function prepararPreguntas(cuerpo, usuario) {
  const { temaId } = cuerpo || {};
  const nivel = Number(cuerpo?.nivel);
  const cantidad = Number(cuerpo?.cantidad);

  if (!temaId) rechazar('Falta el tema', 400);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) rechazar('El nivel debe ser un número de 1 a 5', 400);
  if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 15) rechazar('La cantidad debe estar entre 5 y 15', 400);

  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) rechazar('El tema no existe', 404);

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura || !(await acceso.puedeEditarAsignatura(usuario, asignatura.id))) {
    rechazar('No tienes permisos para editar este tema', 403);
  }

  const contenido = [
    lineas('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen.trim()}` : '',
    lineas('Ejemplos', tema.ejemplos),
    lineas('Errores frecuentes', tema.erroresFrecuentes),
    lineas('Preguntas guía', tema.preguntasGuia),
    lineas('Palabras clave', tema.palabrasClave)
  ].filter(Boolean).join('\n\n');

  const glosario = (await almacen.buscar('glosario', { temaId }))
    .filter((g) => g.estado === 'aprobado' && g.termino && g.definicion)
    .map((g) => `${g.termino.trim()}: ${g.definicion.trim()}`);

  const existentes = (await almacen.buscar('preguntas', { temaId }))
    .filter((p) => Number(p.nivel) === nivel && p.enunciado)
    .map((p) => `- ${p.enunciado.trim()}`);

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'no especificado',
    tema: tema.titulo,
    contenido: contenido || '(sin contenido registrado)',
    glosario: glosario.join('\n') || '(sin términos)',
    nivelBloom: `${nivel} ${NIVELES_BLOOM[nivel]}`,
    cantidad,
    existentes: existentes.join('\n') || '(ninguna)'
  };
}
