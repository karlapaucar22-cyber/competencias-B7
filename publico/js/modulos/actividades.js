// publico/js/modulos/actividades.js
// Catálogo de actividades lúdicas y formativas para estudiantes y docentes

import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { escapar } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Actividades', roles: ['estudiante', 'docente'] });

const contenedorActividades = document.getElementById('contenedorActividades');

const ICONOS_ACTIVIDAD = {
  ahorcado: '🎈',
  canciones: '🎵',
  quiz: '🧠',
  crucigrama: '🧩',
  'sopa-letras': '🔍',
  memoria: '🃏',
  ordenar: '🔢',
  completar: '✍️',
  foro: '💬',
  simulacion: '🎭',
  tutor: '🦉',
  simulador: '🎭'
};

function renderizarActividades() {
  if (!Array.isArray(ACTIVIDADES) || ACTIVIDADES.length === 0) {
    contenedorActividades.innerHTML = `
      <div class="vacio" style="grid-column: 1 / -1;">
        <div class="vacio__icono">🎮</div>
        <h3 class="vacio__titulo">Próximamente nuevas actividades</h3>
        <p class="vacio__texto">Estamos preparando dinámicas interactivas para tu aprendizaje.</p>
      </div>
    `;
    return;
  }

  // El tutor IA es solo para estudiantes
  const esEstudiante = usuarioActual()?.rol === 'estudiante';
  contenedorActividades.innerHTML = ACTIVIDADES.filter((a) => a.id !== 'tutor' || esEstudiante).map((act) => {
    const icono = ICONOS_ACTIVIDAD[act.id] || '🎯';
    return `
      <article class="actividad-card">
        <div class="actividad-card__icono" aria-hidden="true">${icono}</div>
        <div class="actividad-card__cuerpo">
          <h2 class="actividad-card__titulo">${escapar(act.texto)}</h2>
          <p class="actividad-card__descripcion">${escapar(act.descripcion)}</p>
        </div>
        <div class="actividad-card__pie" style="display: flex; flex-direction: column; gap: var(--espacio-xs);">
          <a href="${escapar(act.href)}" class="btn btn--primario" style="width: 100%;">
            Jugar
          </a>
          ${act.id === 'ahorcado' ? `
            <div style="display: flex; gap: var(--espacio-xs); flex-wrap: wrap; justify-content: center; font-size: var(--texto-xs);">
              <a href="/paginas/ahorcado.html?temaId=tem_000001" class="btn btn--texto btn--sm" style="padding: 2px 6px;">🧠 Tema 1 (Funciones)</a>
              <a href="/paginas/ahorcado.html?temaId=tem_000002" class="btn btn--texto btn--sm" style="padding: 2px 6px;">💖 Tema 2 (Estrés)</a>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');
}

renderizarActividades();
