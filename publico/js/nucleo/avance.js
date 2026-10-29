// publico/js/nucleo/avance.js
// Avance curricular: temas publicados y revisados de una asignatura (sin efectos al importar)

import * as api from './api.js';

/**
 * Calcula el avance porcentual de temas publicados y revisados para una asignatura.
 *
 * @param {string} asignaturaId
 * @param {Object|null} [cacheDatos=null] Datos opcionales { unidades, temas, progresos }
 * @returns {Promise<{ total: number, revisados: number, porcentaje: number }>}
 */
export async function calcularAvance(asignaturaId, cacheDatos = null) {
  let unidades, temas, progresos;

  if (cacheDatos) {
    ({ unidades, temas, progresos } = cacheDatos);
  } else {
    [unidades, temas, progresos] = await Promise.all([
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);
  }

  const idsUnidades = new Set((unidades || [])
    .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
    .map((u) => u.id));
  const temasPublicados = (temas || []).filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado');

  const idsRevisados = new Set((progresos || []).map((p) => p.temaId));
  const revisados = temasPublicados.filter((t) => idsRevisados.has(t.id)).length;
  const total = temasPublicados.length;
  const porcentaje = total > 0 ? Math.round((revisados / total) * 100) : 0;

  return { total, revisados, porcentaje };
}
