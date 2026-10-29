// servidor/preparadores/evaluar-rol.js
// Evalúa la conversación del juego de roles con la rúbrica de la simulación

import { simulacionDeRol, validarHistorial, turnosDe, rechazar } from './rol-simulacion.js';

/**
 * @param {{ simulacionId: string, historial: Array<{ rol, texto }> }} cuerpo
 * @returns {{ personaje, objetivo, rubrica, transcripcion }}
 */
export default async function prepararEvaluacion(cuerpo, usuario) {
  const { sim, asignatura, maxTurnos } = await simulacionDeRol(usuario, cuerpo?.simulacionId);
  const historial = validarHistorial(cuerpo?.historial, maxTurnos);
  if (!turnosDe(historial)) rechazar('Conversa al menos una vez con el personaje antes de terminar', 400);

  const p = sim.personaje || {};
  const nombre = p.nombre || 'Personaje';
  const rubrica = (sim.rubrica || []).map((c, i) => `${i + 1}. ${c.criterio} (máximo ${Number(c.puntos) || 0} puntos): ${c.descripcion}`);
  return {
    personaje: `${nombre}: ${p.descripcion || ''}`.trim(),
    objetivo: p.objetivo || '',
    rubrica: rubrica.join('\n'),
    transcripcion: historial.map((m) => `${m.rol === 'estudiante' ? 'Estudiante' : nombre}: ${m.texto}`).join('\n'),
    asignatura: asignatura?.nombre || '',
    nivel: asignatura?.nivel || 'educación superior',
    criterios: rubrica.length
  };
}
