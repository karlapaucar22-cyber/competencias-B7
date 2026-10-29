// publico/js/modulos/asignaturas.js
// Catálogo de asignaturas y cálculo de avance curricular para estudiantes y docentes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, escapar } from '../nucleo/ui.js';
import { calcularAvance } from '../nucleo/avance.js';

await montarPlantilla({ titulo: "Mis Asignaturas", roles: ["estudiante", "docente"] });

const gridAsignaturas = document.getElementById('lista-asignaturas-est');

/**
 * Carga las asignaturas del usuario y renderiza las tarjetas con barras de avance.
 */
async function cargarAsignaturas() {
  try {
    const [asignaturas, unidades, temas, progresos] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    const cacheDatos = { unidades, temas, progresos };

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      gridAsignaturas.innerHTML = `
        <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); grid-column: 1 / -1; color: var(--color-texto-suave);">
          No tienes asignaturas matriculadas o asignadas en este período lectivo.
        </div>
      `;
      return;
    }

    const tarjetasHtml = await Promise.all(
      asignaturas.map(async (asig) => {
        const avance = await calcularAvance(asig.id, cacheDatos);

        return `
          <article class="tarjeta tarjeta-asignatura-est" data-id="${escapar(asig.id)}">
            <div>
              <div class="tarjeta-asignatura-est__meta">
                <span class="insignia insignia--acento">${escapar(asig.nivel || 'GENERAL')}</span>
              </div>
              <h2 class="tarjeta-asignatura-est__titulo">${escapar(asig.nombre)}</h2>
              <p class="tarjeta-asignatura-est__desc">${escapar(asig.descripcion || 'Sin descripción.')}</p>
            </div>

            <div>
              <div class="tarjeta-asignatura-est__avance">
                <div class="tarjeta-asignatura-est__avance-cabecera">
                  <span>Avance curricular</span>
                  <span>${avance.porcentaje}%</span>
                </div>
                <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de ${escapar(asig.nombre)}">
                  <span class="progreso__barra" style="width: ${avance.porcentaje}%;"></span>
                </div>
                <div class="tarjeta-asignatura-est__avance-detalle">
                  <span>${avance.revisados} de ${avance.total} tema${avance.total === 1 ? '' : 's'} revisado${avance.revisados === 1 ? '' : 's'}</span>
                  <span>${avance.porcentaje === 100 ? '¡Completado! 🎉' : (avance.porcentaje > 0 ? 'En progreso' : 'Por iniciar')}</span>
                </div>
              </div>

              <div class="tarjeta__pie">
                <a href="/paginas/asignatura.html?id=${escapar(asig.id)}" class="btn btn--primario" style="width: 100%;">
                  Ver unidades y temas →
                </a>
              </div>
            </div>
          </article>
        `;
      })
    );

    gridAsignaturas.innerHTML = tarjetasHtml.join('');
  } catch (err) {
    gridAsignaturas.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl); grid-column: 1 / -1;">
        Error al cargar las asignaturas: ${escapar(err.message)}
      </div>
    `;
  }
}

await cargarAsignaturas();
