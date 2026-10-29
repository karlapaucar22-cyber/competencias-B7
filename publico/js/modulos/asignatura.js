// publico/js/modulos/asignatura.js
// Detalle de unidades y temas con estado de avance para el estudiante y docente

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';
import { calcularAvance } from '../nucleo/avance.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { abrirTutorNeuriGlobal } from '../nucleo/tutor-neuri-global.js';

await montarPlantilla({ titulo: "Asignatura", roles: ["estudiante", "docente", "admin"] });

const asignaturaId = util.parametro('id');

const nivelBadge = document.getElementById('asig-nivel-badge');
const tituloEl = document.getElementById('asig-titulo');
const descEl = document.getElementById('asig-descripcion');

const cajaAvance = document.getElementById('asig-avance-caja');
const porcentajeAvanceEl = document.getElementById('asig-avance-porcentaje');
const barraFill = document.getElementById('asig-barra-fill');
const detalleAvanceEl = document.getElementById('asig-avance-detalle');

const contenedorUnidadesTemas = document.getElementById('contenedor-unidades-temas');

async function cargarDetalle() {
  if (!asignaturaId) {
    contenedorUnidadesTemas.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Identificador de asignatura no especificado en la dirección.
        <div style="margin-top: var(--espacio-m);">
          <a href="/paginas/asignaturas.html" class="btn btn--primario">Ir a Mis Asignaturas</a>
        </div>
      </div>
    `;
    return;
  }

  try {
    const [asignatura, unidades, temas, progresos] = await Promise.all([
      api.obtener('asignaturas', asignaturaId),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    nivelBadge.textContent = asignatura.nivel || 'GENERAL';
    tituloEl.textContent = asignatura.nombre;
    descEl.textContent = asignatura.descripcion || 'Sin descripción registrada.';

    // Cálculo del avance de la asignatura
    const cacheDatos = { unidades, temas, progresos };
    const avance = await calcularAvance(asignaturaId, cacheDatos);

    cajaAvance.style.display = 'block';
    porcentajeAvanceEl.textContent = `${avance.porcentaje}%`;
    barraFill.style.width = `${avance.porcentaje}%`;
    detalleAvanceEl.textContent = `${avance.revisados} de ${avance.total} tema${avance.total === 1 ? '' : 's'} revisado${avance.revisados === 1 ? '' : 's'}`;

    // Filtrar unidades visibles de la asignatura
    const unidadesVisibles = (unidades || [])
      .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    // El acceso abre el único tutor global de Neuri; no se monta un segundo chat en esta página.
    const temasAsignatura = unidadesVisibles.flatMap((u) => (temas || [])
      .filter((t) => t.unidadId === u.id && t.estado === 'publicado')
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0)));
    const accesoTutor = document.getElementById('tutor-acceso');
    const botonTutor = document.getElementById('btn-abrir-tutor');
    if (usuarioActual()?.rol === 'estudiante' && temasAsignatura.length) {
      accesoTutor.hidden = false;
      botonTutor.addEventListener('click', abrirTutorNeuriGlobal);
    }

    if (unidadesVisibles.length === 0) {
      contenedorUnidadesTemas.innerHTML = `
        <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
          Esta asignatura no tiene unidades visibles disponibles por ahora.
        </div>
      `;
      return;
    }

    const idsRevisados = new Set((progresos || []).map((p) => p.temaId));

    const htmlBloques = unidadesVisibles.map((u, uIdx) => {
      // Temas publicados de la unidad
      const temasUnidad = (temas || [])
        .filter((t) => t.unidadId === u.id && t.estado === 'publicado')
        .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

      const temasFilasHtml = temasUnidad.length === 0
        ? `<p style="font-size: var(--tamano-s); color: var(--color-texto-suave); padding: var(--espacio-s);">No hay temas publicados en esta unidad.</p>`
        : `
          <div class="temas-filas-lista">
            ${temasUnidad.map((t, tIdx) => {
              const estaRevisado = idsRevisados.has(t.id);
              const badgeEstado = estaRevisado
                ? `<span class="badge-revisado">Revisado ✓</span>`
                : `<span class="badge-pendiente">Pendiente</span>`;

              const dificultad = (t.dificultad || 'intermedio').toLowerCase();
              const badgeDificultad = dificultad === 'avanzado'
                ? '<span class="insignia insignia--acento">Avanzado</span>'
                : (dificultad === 'basico' ? '<span class="insignia insignia--primario">Básico</span>' : '<span class="insignia">Intermedio</span>');

              return `
                <div class="tema-fila-est" data-id="${escapar(t.id)}">
                  <div class="tema-fila-est__info">
                    <div class="tema-fila-est__meta">
                      <span style="font-weight: var(--peso-negrita);">Tema ${tIdx + 1}</span>
                      <span>·</span>
                      ${badgeDificultad}
                    </div>
                    <h3 class="tema-fila-est__titulo">${escapar(t.titulo)}</h3>
                  </div>

                  <div class="tema-fila-est__acciones">
                    ${badgeEstado}
                    <a href="/paginas/tema.html?id=${escapar(t.id)}" class="btn btn--pequeno btn--primario">
                      Estudiar tema →
                    </a>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

      return `
        <article class="unidad-bloque-est">
          <h2 class="unidad-bloque-est__titulo">
            <span style="color: var(--color-texto-suave); font-size: var(--tamano-s); text-transform: uppercase;">Unidad ${uIdx + 1}:</span>
            <span>${escapar(u.titulo)}</span>
          </h2>
          ${temasFilasHtml}
        </article>
      `;
    });

    contenedorUnidadesTemas.innerHTML = htmlBloques.join('');
  } catch (err) {
    contenedorUnidadesTemas.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Error al cargar los datos de la asignatura: ${escapar(err.message)}
      </div>
    `;
  }
}

await cargarDetalle();
