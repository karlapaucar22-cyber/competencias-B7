// publico/js/nucleo/retroalimentacion.js
// Componentes de retroalimentación inmediata y resumen final de actividades

import * as ui from './ui.js';

/**
 * Genera y muestra un panel de retroalimentación inmediata (.retro)
 * accesible con aria-live, ícono, explicación, sugerencia y enlace opcional de repaso.
 *
 * @param {{ correcto: boolean, explicacion: string, sugerencia?: string, enlaceTema?: string }} opciones
 * @returns {HTMLElement} Elemento DOM del panel de retroalimentación
 */
export function mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema }) {
  const panel = document.createElement('div');
  panel.className = `retro ${correcto ? 'retro--correcto' : 'retro--incorrecto'}`;
  panel.setAttribute('role', 'alert');
  panel.setAttribute('aria-live', 'polite');

  const icono = correcto ? '✔' : '✖';
  const encabezadoTexto = correcto ? '¡Correcto!' : 'Respuesta incorrecta';

  let htmlInterno = `
    <div class="retro__icono" aria-hidden="true">${icono}</div>
    <div class="retro__cuerpo">
      <h4 class="retro__titulo">${encabezadoTexto}</h4>
      <p class="retro__explicacion">${ui.escapar(explicacion || '')}</p>
  `;

  if (sugerencia && sugerencia.trim()) {
    htmlInterno += `
      <div class="retro__sugerencia">
        <span aria-hidden="true">💡</span>
        <span>${ui.escapar(sugerencia)}</span>
      </div>
    `;
  }

  if (enlaceTema && enlaceTema.trim()) {
    htmlInterno += `
      <div class="retro__accion">
        <a href="/paginas/tema.html?id=${encodeURIComponent(enlaceTema)}" class="btn btn--texto retro__enlace" target="_blank" rel="noopener noreferrer">
          📖 Repasar el tema ↗
        </a>
      </div>
    `;
  }

  htmlInterno += `</div>`;
  panel.innerHTML = htmlInterno;

  return panel;
}

/**
 * Muestra una ventana modal con el resumen final de la actividad:
 * aciertos, errores, recomendaciones pedagógicas y opciones para repetir o salir.
 *
 * @param {{ titulo?: string, aciertos: number, errores: number, recomendaciones?: string[] | string, enlaceTema?: string }} opciones
 * @returns {Promise<"repetir" | "salir">} Resuelve con la acción elegida por el usuario
 */
export async function mostrarResumen({ titulo, aciertos, errores, recomendaciones, enlaceTema }) {
  const numAciertos = Number(aciertos) || 0;
  const numErrores = Number(errores) || 0;
  const total = numAciertos + numErrores;
  const porcentaje = total > 0 ? Math.round((numAciertos / total) * 100) : 0;

  let recomendacionesHtml = '';
  if (Array.isArray(recomendaciones) && recomendaciones.length > 0) {
    recomendacionesHtml = `
      <div class="resumen-retro__seccion">
        <h5>Recomendaciones didácticas:</h5>
        <ul>
          ${recomendaciones.map((r) => `<li>${ui.escapar(r)}</li>`).join('')}
        </ul>
      </div>
    `;
  } else if (typeof recomendaciones === 'string' && recomendaciones.trim()) {
    recomendacionesHtml = `
      <div class="resumen-retro__seccion">
        <h5>Recomendación:</h5>
        <p>${ui.escapar(recomendaciones)}</p>
      </div>
    `;
  }

  let repasoTemaHtml = '';
  if (enlaceTema && enlaceTema.trim()) {
    repasoTemaHtml = `
      <div style="margin-top: var(--espacio-m); text-align: center;">
        <a href="/paginas/tema.html?id=${encodeURIComponent(enlaceTema)}" class="btn btn--secundario" target="_blank" rel="noopener noreferrer">
          📖 Repasar el contenido del tema ↗
        </a>
      </div>
    `;
  }

  const contenidoHtml = `
    <div class="resumen-retro">
      <div class="resumen-retro__estadisticas">
        <div class="resumen-retro__tarjeta">
          <span class="resumen-retro__valor">${numAciertos}</span>
          <span class="resumen-retro__etiqueta">Aciertos</span>
        </div>
        <div class="resumen-retro__tarjeta">
          <span class="resumen-retro__valor">${numErrores}</span>
          <span class="resumen-retro__etiqueta">Errores</span>
        </div>
        <div class="resumen-retro__tarjeta">
          <span class="resumen-retro__valor">${porcentaje}%</span>
          <span class="resumen-retro__etiqueta">Efectividad</span>
        </div>
      </div>
      ${recomendacionesHtml}
      ${repasoTemaHtml}
    </div>
  `;

  const resultado = await ui.modal({
    titulo: titulo || 'Resumen de Desempeño',
    contenido: contenidoHtml,
    acciones: [
      { texto: 'Jugar de nuevo', valor: 'repetir', primario: true },
      { texto: 'Salir', valor: 'salir' }
    ]
  });

  return resultado === 'repetir' ? 'repetir' : 'salir';
}

export default {
  mostrarRetro,
  mostrarResumen
};
