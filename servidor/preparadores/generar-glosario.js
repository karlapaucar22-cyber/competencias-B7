// servidor/preparadores/generar-glosario.js
// Arma los datos de la plantilla prompts/generar-glosario.txt

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

const lineas = (valores) => (Array.isArray(valores) ? valores : [valores])
  .filter((v) => typeof v === 'string' && v.trim())
  .map((v) => `- ${v.trim()}`);

/**
 * @param {{ temaId: string, cantidad: number }} cuerpo  cantidad de 5 a 20
 * @param {Object} usuario
 */
export default async function prepararGlosario(cuerpo, usuario) {
  const { temaId } = cuerpo || {};
  const cantidad = Number(cuerpo?.cantidad);
  if (!temaId) rechazar('Falta el tema', 400);
  if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 20) rechazar('La cantidad debe estar entre 5 y 20', 400);

  const tema = (await almacen.leer('temas')).find((t) => t.id === temaId);
  if (!tema) rechazar('El tema no existe', 404);
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura || !(await acceso.puedeEditarAsignatura(usuario, asignatura.id))) {
    rechazar('No tienes permisos para editar este tema', 403);
  }

  // Contenido: objetivos, resumen y ejemplos del tema
  const contenido = [
    lineas(tema.objetivos).length ? `Objetivos:\n${lineas(tema.objetivos).join('\n')}` : '',
    tema.resumen?.trim() ? `Resumen:\n${tema.resumen.trim()}` : '',
    lineas(tema.ejemplos).length ? `Ejemplos:\n${lineas(tema.ejemplos).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  const existentes = (await almacen.buscar('glosario', { temaId }))
    .map((g) => g.termino?.trim()).filter(Boolean);

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'no especificado',
    tema: tema.titulo,
    contenido: contenido || '(sin contenido registrado)',
    existentes: existentes.length ? existentes : ['(ninguno)'],
    cantidad,
    minimoSeisLetras: 3
  };
}
