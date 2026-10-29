// publico/js/modulos/admin-asignaturas.js
// Gestión y administración de asignaturas para el rol admin

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Administración de Asignaturas", roles: ["admin"] });

const gridAsignaturas = document.getElementById('grid-asignaturas');
const inputBuscar = document.getElementById('buscar-asignatura');
const selectFiltroNivel = document.getElementById('filtro-nivel');
const btnNuevaAsignatura = document.getElementById('btn-nueva-asignatura');

let todasLasAsignaturas = [];
let todosLosGrupos = [];

/**
 * Carga las asignaturas y los grupos del distributivo desde el servidor.
 */
async function cargarDatos() {
  try {
    const [asignaturas, distributivo] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('distributivo')
    ]);
    todasLasAsignaturas = Array.isArray(asignaturas) ? asignaturas : [];
    todosLosGrupos = Array.isArray(distributivo) ? distributivo : [];

    actualizarOpcionesNivel();
    renderizarAsignaturas();
  } catch (err) {
    gridAsignaturas.innerHTML = `
      <div class="asignaturas-vacio" style="color: var(--color-error);">
        Error al cargar las asignaturas: ${escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Llena el selector de niveles con los valores únicos existentes.
 */
function actualizarOpcionesNivel() {
  const nivelesUnicos = [...new Set(
    todasLasAsignaturas.map((a) => (a.nivel || '').trim()).filter(Boolean)
  )].sort();

  const valorActual = selectFiltroNivel.value;
  selectFiltroNivel.innerHTML = '<option value="">Todos los niveles</option>' +
    nivelesUnicos.map((n) => `<option value="${escapar(n)}">${escapar(n)}</option>`).join('');

  if (nivelesUnicos.includes(valorActual)) {
    selectFiltroNivel.value = valorActual;
  }
}

/**
 * Cuenta los grupos asociados a una asignatura en el distributivo.
 */
function contarGrupos(asignaturaId) {
  return todosLosGrupos.filter((g) => g.asignaturaId === asignaturaId).length;
}

/**
 * Renderiza las tarjetas de asignaturas según los filtros aplicados.
 */
function renderizarAsignaturas() {
  const termino = (inputBuscar.value || '').trim().toLowerCase();
  const nivelFiltro = (selectFiltroNivel.value || '').trim().toLowerCase();

  const filtradas = todasLasAsignaturas.filter((a) => {
    if (nivelFiltro && (a.nivel || '').trim().toLowerCase() !== nivelFiltro) {
      return false;
    }
    if (termino) {
      const nom = (a.nombre || '').toLowerCase();
      const desc = (a.descripcion || '').toLowerCase();
      if (!nom.includes(termino) && !desc.includes(termino)) {
        return false;
      }
    }
    return true;
  });

  if (filtradas.length === 0) {
    gridAsignaturas.innerHTML = `
      <div class="asignaturas-vacio">
        No se encontraron asignaturas con los criterios de búsqueda seleccionados.
      </div>
    `;
    return;
  }

  gridAsignaturas.innerHTML = filtradas.map((a) => {
    const numGrupos = contarGrupos(a.id);
    const etiquetaGrupos = numGrupos === 1 ? '1 grupo asignado' : `${numGrupos} grupos asignados`;
    const noSePuedeEliminar = numGrupos > 0;

    return `
      <article class="tarjeta asignatura-tarjeta" data-id="${escapar(a.id)}">
        <div>
          <div class="asignatura-tarjeta__encabezado">
            <span class="insignia insignia--acento">${escapar(a.nivel || 'GENERAL')}</span>
            <span class="insignia insignia--primario">${escapar(etiquetaGrupos)}</span>
          </div>
          <h2 class="asignatura-tarjeta__titulo">${escapar(a.nombre)}</h2>
          <p class="asignatura-tarjeta__descripcion">${escapar(a.descripcion || 'Sin descripción.')}</p>
        </div>

        <div>
          <div class="asignatura-tarjeta__meta">
            <span>ID: ${escapar(a.id)}</span>
          </div>
          <div class="tarjeta__pie">
            <button type="button" class="btn btn--pequeno btn--secundario btn-editar" data-id="${escapar(a.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--pequeno btn--peligro btn-eliminar" data-id="${escapar(a.id)}"
              ${noSePuedeEliminar ? 'disabled title="No se puede eliminar: tiene grupos asignados en el distributivo"' : ''}>
              Eliminar
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Abre el diálogo modal con el formulario para crear o editar una asignatura.
 */
async function abrirModalFormulario(asignatura = null) {
  const esEdicion = Boolean(asignatura && asignatura.id);
  const titulo = esEdicion ? 'Editar Asignatura' : 'Nueva Asignatura';

  const contenedorForm = document.createElement('div');
  contenedorForm.innerHTML = `
    <form id="form-asignatura" onsubmit="return false;">
      <div id="modal-error" class="campo__error" style="display: none; margin-bottom: var(--espacio-m);" role="alert"></div>

      <div class="campo">
        <label for="asig-nombre">Nombre de la asignatura *</label>
        <input type="text" id="asig-nombre" required placeholder="Ej. FUNDAMENTOS DE NEUROEDUCACIÓN" value="${esEdicion ? escapar(asignatura.nombre || '') : ''}">
      </div>

      <div class="campo">
        <label for="asig-nivel">Nivel de formación *</label>
        <input type="text" id="asig-nivel" list="sugerencias-niveles" required placeholder="Ej. POSGRADO, PREGRADO, BACHILLERATO" value="${esEdicion ? escapar(asignatura.nivel || '') : ''}">
        <datalist id="sugerencias-niveles">
          <option value="POSGRADO">
          <option value="PREGRADO">
          <option value="BACHILLERATO">
          <option value="EDUCACIÓN GENERAL BÁSICA">
        </datalist>
      </div>

      <div class="campo">
        <label for="asig-descripcion">Descripción</label>
        <textarea id="asig-descripcion" rows="4" placeholder="Breve descripción de los contenidos y objetivos...">${esEdicion ? escapar(asignatura.descripcion || '') : ''}</textarea>
      </div>
    </form>
  `;

  const inputNombre = contenedorForm.querySelector('#asig-nombre');
  const inputNivel = contenedorForm.querySelector('#asig-nivel');
  const textareaDesc = contenedorForm.querySelector('#asig-descripcion');
  const errorDiv = contenedorForm.querySelector('#modal-error');

  const resultado = await modal({
    titulo,
    contenido: contenedorForm,
    acciones: [
      {
        texto: 'Cancelar',
        valor: null,
        clase: 'btn btn--secundario'
      },
      {
        texto: esEdicion ? 'Guardar Cambios' : 'Crear Asignatura',
        valor: 'guardar',
        clase: 'btn btn--primario',
        validar: async () => {
          const nombre = (inputNombre.value || '').trim();
          const nivel = (inputNivel.value || '').trim().toUpperCase();
          const descripcion = (textareaDesc.value || '').trim();

          errorDiv.style.display = 'none';
          errorDiv.textContent = '';

          if (!nombre) {
            errorDiv.textContent = 'El nombre de la asignatura es obligatorio.';
            errorDiv.style.display = 'block';
            inputNombre.focus();
            return false;
          }

          if (!nivel) {
            errorDiv.textContent = 'El nivel de formación es obligatorio.';
            errorDiv.style.display = 'block';
            inputNivel.focus();
            return false;
          }

          try {
            const payload = { nombre, nivel, descripcion };
            if (esEdicion) {
              await api.actualizar('asignaturas', asignatura.id, payload);
              aviso('Asignatura actualizada exitosamente.', 'exito');
            } else {
              await api.crear('asignaturas', payload);
              aviso('Asignatura creada exitosamente.', 'exito');
            }
            await cargarDatos();
            return true;
          } catch (err) {
            errorDiv.textContent = err.message || 'Error al guardar la asignatura.';
            errorDiv.style.display = 'block';
            return false;
          }
        }
      }
    ]
  });

  return resultado;
}

// Eventos de interacción
inputBuscar.addEventListener('input', renderizarAsignaturas);
selectFiltroNivel.addEventListener('change', renderizarAsignaturas);
btnNuevaAsignatura.addEventListener('click', () => abrirModalFormulario(null));

// Eventos delegados en la cuadrícula de tarjetas
gridAsignaturas.addEventListener('click', async (e) => {
  const btnEditar = e.target.closest('.btn-editar');
  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const asignatura = todasLasAsignaturas.find((a) => a.id === id);
    if (asignatura) {
      await abrirModalFormulario(asignatura);
    }
    return;
  }

  const btnEliminar = e.target.closest('.btn-eliminar');
  if (btnEliminar) {
    const id = btnEliminar.dataset.id;
    const asignatura = todasLasAsignaturas.find((a) => a.id === id);
    if (!asignatura) return;

    const grupos = contarGrupos(id);
    if (grupos > 0) {
      aviso(`No se puede eliminar la asignatura porque tiene ${grupos} grupo(s) asignado(s) en el distributivo.`, 'error');
      return;
    }

    const confirmado = await confirmar(`¿Estás seguro de que deseas eliminar la asignatura "${asignatura.nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    btnEliminar.disabled = true;
    try {
      await api.eliminar('asignaturas', id);
      aviso('Asignatura eliminada exitosamente.', 'exito');
      await cargarDatos();
    } catch (err) {
      aviso(err.message || 'Error al eliminar la asignatura.', 'error');
      btnEliminar.disabled = false;
    }
  }
});

await cargarDatos();
