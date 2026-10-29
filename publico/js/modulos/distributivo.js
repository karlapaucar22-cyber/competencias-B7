// publico/js/modulos/distributivo.js
// Gestión del distributivo académico (grupos, docentes y estudiantes) para el rol admin

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Distributivo Académico", roles: ["admin"] });

const cuerpoTabla = document.getElementById('tabla-distributivo-cuerpo');
const inputBuscar = document.getElementById('buscar-grupo');
const selectFiltroAsig = document.getElementById('filtro-asig');
const selectFiltroPeriodo = document.getElementById('filtro-periodo');
const btnNuevoGrupo = document.getElementById('btn-nuevo-grupo');

let todosLosGrupos = [];
let todasLasAsignaturas = [];
let todosLosUsuarios = [];

let mapaAsignaturas = new Map();
let mapaUsuarios = new Map();

/**
 * Carga las listas de grupos, asignaturas y usuarios desde la API.
 */
async function cargarDatos() {
  try {
    const [grupos, asignaturas, usuarios] = await Promise.all([
      api.listar('distributivo'),
      api.listar('asignaturas'),
      api.listar('usuarios')
    ]);

    todosLosGrupos = Array.isArray(grupos) ? grupos : [];
    todasLasAsignaturas = Array.isArray(asignaturas) ? asignaturas : [];
    todosLosUsuarios = Array.isArray(usuarios) ? usuarios : [];

    mapaAsignaturas = new Map(todasLasAsignaturas.map((a) => [a.id, a]));
    mapaUsuarios = new Map(todosLosUsuarios.map((u) => [u.id, u]));

    poblarFiltros();
    renderizarTabla();
  } catch (err) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
          Error al cargar los datos del distributivo: ${escapar(err.message)}
        </td>
      </tr>
    `;
  }
}

/**
 * Llena los selectores de filtro de asignaturas y períodos.
 */
function poblarFiltros() {
  // Asignaturas
  const valorAsig = selectFiltroAsig.value;
  selectFiltroAsig.innerHTML = '<option value="">Todas las asignaturas</option>' +
    todasLasAsignaturas.map((a) => `<option value="${escapar(a.id)}">${escapar(a.nombre)}</option>`).join('');
  if (todasLasAsignaturas.some((a) => a.id === valorAsig)) {
    selectFiltroAsig.value = valorAsig;
  }

  // Períodos
  const periodosUnicos = [...new Set(todosLosGrupos.map((g) => (g.periodo || '').trim()).filter(Boolean))].sort();
  const valorPeriodo = selectFiltroPeriodo.value;
  selectFiltroPeriodo.innerHTML = '<option value="">Todos los períodos</option>' +
    periodosUnicos.map((p) => `<option value="${escapar(p)}">${escapar(p)}</option>`).join('');
  if (periodosUnicos.includes(valorPeriodo)) {
    selectFiltroPeriodo.value = valorPeriodo;
  }
}

/**
 * Renderiza las filas de la tabla de distributivo según los filtros aplicados.
 */
function renderizarTabla() {
  const termino = (inputBuscar.value || '').trim().toLowerCase();
  const asigId = selectFiltroAsig.value;
  const periodo = (selectFiltroPeriodo.value || '').trim().toLowerCase();

  const filtrados = todosLosGrupos.filter((g) => {
    if (asigId && g.asignaturaId !== asigId) return false;
    if (periodo && (g.periodo || '').trim().toLowerCase() !== periodo) return false;

    if (termino) {
      const asignatura = mapaAsignaturas.get(g.asignaturaId);
      const asigNombre = asignatura ? (asignatura.nombre || '').toLowerCase() : '';
      const paralelo = (g.paralelo || '').toLowerCase();
      const per = (g.periodo || '').toLowerCase();
      const docente = mapaUsuarios.get(g.docenteId);
      const docenteNombre = docente ? `${docente.nombre || ''} ${docente.apellido || ''} ${docente.correo || ''}`.toLowerCase() : '';

      if (!asigNombre.includes(termino) && !paralelo.includes(termino) && !per.includes(termino) && !docenteNombre.includes(termino)) {
        return false;
      }
    }

    return true;
  });

  if (filtrados.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
          No se encontraron grupos que coincidan con la búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  cuerpoTabla.innerHTML = filtrados.map((g) => {
    const asig = mapaAsignaturas.get(g.asignaturaId);
    const docente = mapaUsuarios.get(g.docenteId);
    const numEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

    const nombreAsig = asig ? asig.nombre : `(Asignatura desconocida: ${g.asignaturaId})`;
    const nivelAsig = asig && asig.nivel ? `<span class="insignia insignia--acento" style="margin-left: var(--espacio-xs);">${escapar(asig.nivel)}</span>` : '';

    const nombreDocente = docente ? `${docente.nombre} ${docente.apellido}` : '(Sin docente asignado)';
    const correoDocente = docente ? docente.correo : '';

    return `
      <tr data-id="${escapar(g.id)}">
        <td>
          <div style="font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            ${escapar(nombreAsig)} ${nivelAsig}
          </div>
        </td>
        <td style="text-align: center;">
          <span class="insignia" style="font-size: var(--tamano-s);">${escapar(g.paralelo)}</span>
        </td>
        <td style="text-align: center;">
          <span>${escapar(g.periodo)}</span>
        </td>
        <td>
          <div class="distributivo-docente-celda">
            <span class="distributivo-docente-nombre">${escapar(nombreDocente)}</span>
            <span class="distributivo-docente-correo">${escapar(correoDocente)}</span>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="insignia insignia--primario" title="${numEstudiantes} estudiantes matriculados">
            ${numEstudiantes} estudiante${numEstudiantes === 1 ? '' : 's'}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: var(--espacio-xs);">
            <button type="button" class="btn btn--pequeno btn--secundario btn-editar" data-id="${escapar(g.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--pequeno btn--peligro btn-eliminar" data-id="${escapar(g.id)}">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Abre el diálogo modal con el formulario para crear o editar un grupo del distributivo.
 */
async function abrirModalFormulario(grupo = null) {
  const esEdicion = Boolean(grupo && grupo.id);
  const titulo = esEdicion ? 'Editar Grupo del Distributivo' : 'Nuevo Grupo del Distributivo';

  const docentes = todosLosUsuarios.filter((u) => u.rol === 'docente');
  const estudiantes = todosLosUsuarios.filter((u) => u.rol === 'estudiante');

  const estudiantesSeleccionados = new Set(
    esEdicion && Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []
  );

  const contenedor = document.createElement('div');
  contenedor.innerHTML = `
    <form id="form-distributivo" onsubmit="return false;">
      <div id="modal-error" class="campo__error" style="display: none; margin-bottom: var(--espacio-m);" role="alert"></div>

      <div class="campo">
        <label for="dist-asig">Asignatura *</label>
        <select id="dist-asig" required>
          <option value="">-- Selecciona una asignatura --</option>
          ${todasLasAsignaturas.map((a) => `
            <option value="${escapar(a.id)}" ${grupo && grupo.asignaturaId === a.id ? 'selected' : ''}>
              ${escapar(a.nombre)} (${escapar(a.nivel || 'GENERAL')})
            </option>
          `).join('')}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--espacio-m);">
        <div class="campo">
          <label for="dist-paralelo">Paralelo *</label>
          <input type="text" id="dist-paralelo" required placeholder="Ej. A" value="${esEdicion ? escapar(grupo.paralelo || '') : ''}">
        </div>

        <div class="campo">
          <label for="dist-periodo">Período *</label>
          <input type="text" id="dist-periodo" required placeholder="Ej. 2026-2027" value="${esEdicion ? escapar(grupo.periodo || '') : '2026-2027'}">
        </div>
      </div>

      <div class="campo">
        <label for="dist-docente">Docente *</label>
        <select id="dist-docente" required>
          <option value="">-- Selecciona un docente --</option>
          ${docentes.map((d) => `
            <option value="${escapar(d.id)}" ${grupo && grupo.docenteId === d.id ? 'selected' : ''}>
              ${escapar(d.nombre)} ${escapar(d.apellido)} (${escapar(d.correo)})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="campo">
        <label>Estudiantes matriculados</label>
        <div class="estudiantes-selector">
          <div class="estudiantes-selector__cabecera">
            <span id="contador-estudiantes" class="estudiantes-selector__contador">
              ${estudiantesSeleccionados.size} de ${estudiantes.length} seleccionados
            </span>
            <div class="estudiantes-selector__acciones">
              <button type="button" id="btn-seleccionar-todos" class="btn btn--pequeno btn--texto">Marcar todos</button>
              <button type="button" id="btn-desmarcar-todos" class="btn btn--pequeno btn--texto">Desmarcar todos</button>
            </div>
          </div>

          <div style="margin-bottom: var(--espacio-xs);">
            <input type="search" id="buscar-estudiante-modal" placeholder="Filtrar estudiantes por nombre o correo..." style="min-height: 36px; font-size: var(--tamano-s);">
          </div>

          <div class="estudiantes-lista" id="lista-estudiantes-modal">
            ${estudiantes.length === 0 ? '<p style="padding: var(--espacio-s); font-size: var(--tamano-s); color: var(--color-texto-suave);">No hay estudiantes registrados.</p>' : ''}
            ${estudiantes.map((e) => {
              const estaMarcado = estudiantesSeleccionados.has(e.id);
              const textoBusqueda = `${e.nombre || ''} ${e.apellido || ''} ${e.correo || ''}`.toLowerCase();
              return `
                <label class="estudiante-item" data-id="${escapar(e.id)}" data-texto="${escapar(textoBusqueda)}">
                  <input type="checkbox" class="chk-estudiante" value="${escapar(e.id)}" ${estaMarcado ? 'checked' : ''}>
                  <span class="estudiante-item__nombre">${escapar(e.nombre)} ${escapar(e.apellido)}</span>
                  <span class="estudiante-item__correo">(${escapar(e.correo)})</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </form>
  `;

  const selectAsig = contenedor.querySelector('#dist-asig');
  const inputParalelo = contenedor.querySelector('#dist-paralelo');
  const inputPeriodo = contenedor.querySelector('#dist-periodo');
  const selectDocente = contenedor.querySelector('#dist-docente');
  const errorDiv = contenedor.querySelector('#modal-error');
  const contadorEl = contenedor.querySelector('#contador-estudiantes');
  const buscadorEstudiantes = contenedor.querySelector('#buscar-estudiante-modal');
  const listaEstudiantes = contenedor.querySelector('#lista-estudiantes-modal');
  const btnMarcarTodos = contenedor.querySelector('#btn-seleccionar-todos');
  const btnDesmarcarTodos = contenedor.querySelector('#btn-desmarcar-todos');

  function actualizarContador() {
    const marcados = listaEstudiantes.querySelectorAll('.chk-estudiante:checked').length;
    contadorEl.textContent = `${marcados} de ${estudiantes.length} seleccionados`;
  }

  // Búsqueda en vivo de estudiantes en el modal
  buscadorEstudiantes.addEventListener('input', () => {
    const q = (buscadorEstudiantes.value || '').trim().toLowerCase();
    const items = listaEstudiantes.querySelectorAll('.estudiante-item');
    items.forEach((item) => {
      const texto = item.dataset.texto || '';
      item.style.display = texto.includes(q) ? 'flex' : 'none';
    });
  });

  // Cambio en casillas
  listaEstudiantes.addEventListener('change', (e) => {
    if (e.target.matches('.chk-estudiante')) {
      actualizarContador();
    }
  });

  btnMarcarTodos.addEventListener('click', () => {
    const items = listaEstudiantes.querySelectorAll('.estudiante-item');
    items.forEach((item) => {
      if (item.style.display !== 'none') {
        const chk = item.querySelector('.chk-estudiante');
        if (chk) chk.checked = true;
      }
    });
    actualizarContador();
  });

  btnDesmarcarTodos.addEventListener('click', () => {
    const items = listaEstudiantes.querySelectorAll('.estudiante-item');
    items.forEach((item) => {
      if (item.style.display !== 'none') {
        const chk = item.querySelector('.chk-estudiante');
        if (chk) chk.checked = false;
      }
    });
    actualizarContador();
  });

  const resultado = await modal({
    titulo,
    contenido: contenedor,
    acciones: [
      {
        texto: 'Cancelar',
        valor: null,
        clase: 'btn btn--secundario'
      },
      {
        texto: esEdicion ? 'Guardar Cambios' : 'Crear Grupo',
        valor: 'guardar',
        clase: 'btn btn--primario',
        validar: async () => {
          const asignaturaId = (selectAsig.value || '').trim();
          const paralelo = (inputParalelo.value || '').trim().toUpperCase();
          const periodo = (inputPeriodo.value || '').trim();
          const docenteId = (selectDocente.value || '').trim();

          const checkboxes = listaEstudiantes.querySelectorAll('.chk-estudiante:checked');
          const estudiantesIds = Array.from(checkboxes).map((c) => c.value);

          errorDiv.style.display = 'none';
          errorDiv.textContent = '';

          if (!asignaturaId) {
            errorDiv.textContent = 'Debes seleccionar una asignatura.';
            errorDiv.style.display = 'block';
            selectAsig.focus();
            return false;
          }

          if (!paralelo) {
            errorDiv.textContent = 'El paralelo es obligatorio.';
            errorDiv.style.display = 'block';
            inputParalelo.focus();
            return false;
          }

          if (!periodo) {
            errorDiv.textContent = 'El período lectivo es obligatorio.';
            errorDiv.style.display = 'block';
            inputPeriodo.focus();
            return false;
          }

          if (!docenteId) {
            errorDiv.textContent = 'Debes seleccionar un docente responsable.';
            errorDiv.style.display = 'block';
            selectDocente.focus();
            return false;
          }

          try {
            const payload = {
              asignaturaId,
              paralelo,
              periodo,
              docenteId,
              estudiantes: estudiantesIds
            };

            if (esEdicion) {
              await api.actualizar('distributivo', grupo.id, payload);
              aviso('Grupo del distributivo actualizado exitosamente.', 'exito');
            } else {
              await api.crear('distributivo', payload);
              aviso('Grupo del distributivo creado exitosamente.', 'exito');
            }

            await cargarDatos();
            return true;
          } catch (err) {
            errorDiv.textContent = err.message || 'Error al guardar el grupo.';
            errorDiv.style.display = 'block';
            return false;
          }
        }
      }
    ]
  });

  return resultado;
}

// Eventos de búsqueda y filtros
inputBuscar.addEventListener('input', renderizarTabla);
selectFiltroAsig.addEventListener('change', renderizarTabla);
selectFiltroPeriodo.addEventListener('change', renderizarTabla);
btnNuevoGrupo.addEventListener('click', () => abrirModalFormulario(null));

// Eventos delegados en la tabla
cuerpoTabla.addEventListener('click', async (e) => {
  const btnEditar = e.target.closest('.btn-editar');
  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const grupo = todosLosGrupos.find((g) => g.id === id);
    if (grupo) {
      await abrirModalFormulario(grupo);
    }
    return;
  }

  const btnEliminar = e.target.closest('.btn-eliminar');
  if (btnEliminar) {
    const id = btnEliminar.dataset.id;
    const grupo = todosLosGrupos.find((g) => g.id === id);
    if (!grupo) return;

    const asig = mapaAsignaturas.get(grupo.asignaturaId);
    const nombreAsig = asig ? asig.nombre : grupo.asignaturaId;

    const confirmado = await confirmar(`¿Estás seguro de que deseas eliminar el grupo de "${nombreAsig}" (Paralelo ${grupo.paralelo}, Período ${grupo.periodo})?`);
    if (!confirmado) return;

    btnEliminar.disabled = true;
    try {
      await api.eliminar('distributivo', id);
      aviso('Grupo eliminado exitosamente.', 'exito');
      await cargarDatos();
    } catch (err) {
      aviso(err.message || 'Error al eliminar el grupo.', 'error');
      btnEliminar.disabled = false;
    }
  }
});

await cargarDatos();
