// publico/js/modulos/editor-contenidos.js
// Editor pedagógico de unidades didácticas y temas para docentes y administradores

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, modal, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Editor de Contenidos", roles: ["docente", "admin"] });

const selectorAsig = document.getElementById('selector-asignatura');
const asigInfo = document.getElementById('asig-info');

const listaUnidades = document.getElementById('lista-unidades');
const btnNuevaUnidad = document.getElementById('btn-nueva-unidad');
const contadorUnidades = document.getElementById('contador-unidades');

const listaTemas = document.getElementById('lista-temas');
const btnNuevoTema = document.getElementById('btn-nuevo-tema');
const subtituloUnidadActiva = document.getElementById('subtitulo-unidad-activa');

let asignaturas = [];
let asignaturaActual = null;

let unidadesAsignatura = [];
let unidadSeleccionada = null;

let temasUnidad = [];

/**
 * Carga las asignaturas permitidas para el usuario (filtradas por el servidor según rol).
 */
async function iniciar() {
  try {
    const res = await api.listar('asignaturas');
    asignaturas = Array.isArray(res) ? res : [];

    if (asignaturas.length === 0) {
      selectorAsig.innerHTML = '<option value="">No tienes asignaturas asignadas</option>';
      asigInfo.innerHTML = '<span style="color: var(--color-advertencia);">No se encontraron asignaturas activas en tu perfil.</span>';
      return;
    }

    selectorAsig.innerHTML = '<option value="">-- Selecciona una asignatura --</option>' +
      asignaturas.map((a) => `
        <option value="${escapar(a.id)}">${escapar(a.nombre)} (${escapar(a.nivel || 'GENERAL')})</option>
      `).join('');

    // Si solo hay una asignatura, seleccionarla automáticamente para comodidad del docente
    if (asignaturas.length === 1) {
      selectorAsig.value = asignaturas[0].id;
      await cambiarAsignatura(asignaturas[0].id);
    }
  } catch (err) {
    selectorAsig.innerHTML = '<option value="">Error al cargar asignaturas</option>';
    asigInfo.innerHTML = `<span style="color: var(--color-error);">${escapar(err.message)}</span>`;
  }
}

/**
 * Cambia la asignatura activa y carga sus unidades correspondientes.
 */
async function cambiarAsignatura(asignaturaId) {
  if (!asignaturaId) {
    asignaturaActual = null;
    unidadSeleccionada = null;
    btnNuevaUnidad.disabled = true;
    btnNuevoTema.disabled = true;
    asigInfo.innerHTML = '';
    contadorUnidades.textContent = '0 unidades';
    subtituloUnidadActiva.textContent = 'Selecciona una unidad';
    listaUnidades.innerHTML = '<div class="editor-estado-vacio">Selecciona una asignatura para cargar sus unidades.</div>';
    listaTemas.innerHTML = '<div class="editor-estado-vacio">Selecciona una unidad de la lista para gestionar sus temas.</div>';
    return;
  }

  asignaturaActual = asignaturas.find((a) => a.id === asignaturaId);
  asigInfo.innerHTML = `
    <span class="insignia insignia--acento">${escapar(asignaturaActual.nivel || 'GENERAL')}</span>
    <span>ID: ${escapar(asignaturaActual.id)}</span>
  `;

  btnNuevaUnidad.disabled = false;
  await cargarUnidades();
}

/**
 * Carga y ordena las unidades de la asignatura actual.
 */
async function cargarUnidades() {
  if (!asignaturaActual) return;

  try {
    const todas = await api.listar('unidades');
    unidadesAsignatura = todas
      .filter((u) => u.asignaturaId === asignaturaActual.id)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    contadorUnidades.textContent = `${unidadesAsignatura.length} unidad${unidadesAsignatura.length === 1 ? '' : 'es'}`;

    if (unidadSeleccionada) {
      unidadSeleccionada = unidadesAsignatura.find((u) => u.id === unidadSeleccionada.id) || null;
    }

    renderizarUnidades();

    if (unidadSeleccionada) {
      await cargarTemas();
    } else {
      btnNuevoTema.disabled = true;
      subtituloUnidadActiva.textContent = 'Selecciona una unidad';
      listaTemas.innerHTML = '<div class="editor-estado-vacio">Selecciona una unidad de la lista para gestionar sus temas.</div>';
    }
  } catch (err) {
    listaUnidades.innerHTML = `
      <div class="editor-estado-vacio" style="color: var(--color-error);">
        Error al cargar unidades: ${escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Renderiza el listado de unidades.
 */
function renderizarUnidades() {
  if (unidadesAsignatura.length === 0) {
    listaUnidades.innerHTML = `
      <div class="editor-estado-vacio">
        Esta asignatura aún no tiene unidades creadas.<br>
        Usa el botón "+ Nueva Unidad" para agregar la primera.
      </div>
    `;
    return;
  }

  const total = unidadesAsignatura.length;

  listaUnidades.innerHTML = unidadesAsignatura.map((u, index) => {
    const esActiva = unidadSeleccionada && unidadSeleccionada.id === u.id;
    const esVisible = u.visible !== false;
    const badgeVisible = esVisible
      ? '<span class="insignia insignia--primario">Visible</span>'
      : '<span class="insignia" style="opacity: 0.7;">Oculta</span>';

    return `
      <div class="unidad-item ${esActiva ? 'unidad-item--activa' : ''}" data-id="${escapar(u.id)}" role="listitem">
        <div class="unidad-item__principal" data-accion="seleccionar" data-id="${escapar(u.id)}">
          <div class="unidad-item__titulo-grupo">
            <span class="unidad-item__orden">Unidad ${index + 1}</span>
            <h3 class="unidad-item__titulo">${escapar(u.titulo)}</h3>
          </div>
          <div>${badgeVisible}</div>
        </div>

        <div class="unidad-item__acciones">
          <div style="display: flex; gap: var(--espacio-xs); margin-right: auto;">
            <button type="button" class="btn-orden" data-accion="subir" data-id="${escapar(u.id)}" title="Subir orden" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-orden" data-accion="bajar" data-id="${escapar(u.id)}" title="Bajar orden" ${index === total - 1 ? 'disabled' : ''}>▼</button>
          </div>

          <button type="button" class="btn btn--pequeno btn--secundario" data-accion="renombrar" data-id="${escapar(u.id)}">
            Renombrar
          </button>

          <button type="button" class="btn btn--pequeno ${esVisible ? 'btn--secundario' : 'btn--acento'}" data-accion="visibilidad" data-id="${escapar(u.id)}" title="${esVisible ? 'Ocultar a estudiantes' : 'Hacer visible a estudiantes'}">
            ${esVisible ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Carga los temas asociados a la unidad seleccionada.
 */
async function cargarTemas() {
  if (!unidadSeleccionada) return;

  btnNuevoTema.disabled = false;
  subtituloUnidadActiva.textContent = `Unidad: ${unidadSeleccionada.titulo}`;

  try {
    const todos = await api.listar('temas');
    temasUnidad = todos
      .filter((t) => t.unidadId === unidadSeleccionada.id)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    renderizarTemas();
  } catch (err) {
    listaTemas.innerHTML = `
      <div class="editor-estado-vacio" style="color: var(--color-error);">
        Error al cargar los temas: ${escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Renderiza el listado de temas de la unidad seleccionada.
 */
function renderizarTemas() {
  if (!unidadSeleccionada) return;

  if (temasUnidad.length === 0) {
    listaTemas.innerHTML = `
      <div class="editor-estado-vacio">
        La unidad "${escapar(unidadSeleccionada.titulo)}" no tiene temas aún.<br>
        Usa el botón "+ Nuevo Tema" para agregar uno.
      </div>
    `;
    return;
  }

  const total = temasUnidad.length;

  listaTemas.innerHTML = temasUnidad.map((t, index) => {
    const esPublicado = t.estado === 'publicado';
    const badgeEstado = esPublicado
      ? '<span class="insignia insignia--acento">Publicado</span>'
      : '<span class="insignia" style="opacity: 0.7;">Borrador</span>';

    return `
      <div class="tema-item" data-id="${escapar(t.id)}" role="listitem">
        <div class="tema-item__principal">
          <div class="tema-item__titulo-grupo">
            <span class="tema-item__orden">Tema ${index + 1}</span>
            <h4 class="tema-item__titulo">${escapar(t.titulo)}</h4>
          </div>
          <div>${badgeEstado}</div>
        </div>

        <div class="tema-item__acciones">
          <div class="tema-item__orden-botones">
            <button type="button" class="btn-orden" data-accion="subir-tema" data-id="${escapar(t.id)}" title="Subir orden" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-orden" data-accion="bajar-tema" data-id="${escapar(t.id)}" title="Bajar orden" ${index === total - 1 ? 'disabled' : ''}>▼</button>
          </div>

          <div class="tema-item__estado-acciones">
            <button type="button" class="btn btn--pequeno btn--secundario" data-accion="toggle-estado" data-id="${escapar(t.id)}">
              ${esPublicado ? 'Pasar a borrador' : 'Publicar'}
            </button>

            <a href="/paginas/editor-tema.html?id=${escapar(t.id)}" class="btn btn--pequeno btn--primario">
              Editar ficha
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Pide un texto mediante una ventana modal accesible.
 */
async function pedirTextoModal({ titulo, etiqueta, valorInicial = '', placeholder = '', textoBoton = 'Guardar' }) {
  const contenedor = document.createElement('div');
  contenedor.innerHTML = `
    <form onsubmit="return false;">
      <div id="modal-error-input" class="campo__error" style="display: none; margin-bottom: var(--espacio-m);" role="alert"></div>
      <div class="campo">
        <label for="input-texto-modal">${escapar(etiqueta)}</label>
        <input type="text" id="input-texto-modal" required placeholder="${escapar(placeholder)}" value="${escapar(valorInicial)}">
      </div>
    </form>
  `;

  const inputEl = contenedor.querySelector('#input-texto-modal');
  const errorEl = contenedor.querySelector('#modal-error-input');

  let valorFinal = null;

  await modal({
    titulo,
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: textoBoton,
        valor: 'ok',
        clase: 'btn btn--primario',
        validar: async () => {
          const val = (inputEl.value || '').trim();
          if (!val) {
            errorEl.textContent = 'Este campo no puede estar vacío.';
            errorEl.style.display = 'block';
            inputEl.focus();
            return false;
          }
          valorFinal = val;
          return true;
        }
      }
    ]
  });

  return valorFinal;
}

// ==========================================
// Eventos y acciones de Unidades
// ==========================================

btnNuevaUnidad.addEventListener('click', async () => {
  if (!asignaturaActual) return;

  const titulo = await pedirTextoModal({
    titulo: 'Nueva Unidad Didáctica',
    etiqueta: 'Título de la unidad *',
    placeholder: 'Ej. UNIDAD 1: BASES NEUROBIOLÓGICAS DE LA MÚSICA',
    textoBoton: 'Crear Unidad'
  });

  if (!titulo) return;

  try {
    const orden = unidadesAsignatura.length > 0
      ? Math.max(...unidadesAsignatura.map((u) => Number(u.orden) || 0)) + 1
      : 1;

    const nueva = await api.crear('unidades', {
      asignaturaId: asignaturaActual.id,
      titulo,
      orden,
      visible: true
    });

    unidadSeleccionada = nueva;
    aviso('Unidad creada exitosamente.', 'exito');
    await cargarUnidades();
  } catch (err) {
    aviso(err.message || 'Error al crear la unidad.', 'error');
  }
});

listaUnidades.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) {
    // Si hace clic en cualquier parte de la tarjeta de unidad
    const item = e.target.closest('.unidad-item');
    if (item) {
      const id = item.dataset.id;
      const u = unidadesAsignatura.find((x) => x.id === id);
      if (u) {
        unidadSeleccionada = u;
        renderizarUnidades();
        await cargarTemas();
      }
    }
    return;
  }

  const accion = btn.dataset.accion;
  const id = btn.dataset.id;
  const unidad = unidadesAsignatura.find((u) => u.id === id);
  if (!unidad) return;

  if (accion === 'seleccionar') {
    unidadSeleccionada = unidad;
    renderizarUnidades();
    await cargarTemas();
    return;
  }

  if (accion === 'renombrar') {
    const nuevoTitulo = await pedirTextoModal({
      titulo: 'Renombrar Unidad',
      etiqueta: 'Título de la unidad *',
      valorInicial: unidad.titulo,
      textoBoton: 'Guardar Título'
    });
    if (!nuevoTitulo || nuevoTitulo === unidad.titulo) return;

    try {
      await api.actualizar('unidades', id, { titulo: nuevoTitulo });
      unidad.titulo = nuevoTitulo;
      aviso('Unidad renombrada correctamente.', 'exito');
      await cargarUnidades();
    } catch (err) {
      aviso(err.message || 'Error al renombrar la unidad.', 'error');
    }
    return;
  }

  if (accion === 'visibilidad') {
    const nuevoVisible = !(unidad.visible !== false);
    try {
      await api.actualizar('unidades', id, { visible: nuevoVisible });
      unidad.visible = nuevoVisible;
      aviso(`Unidad ${nuevoVisible ? 'marcada como visible' : 'oculta a los estudiantes'}.`, 'exito');
      renderizarUnidades();
    } catch (err) {
      aviso(err.message || 'Error al cambiar visibilidad.', 'error');
    }
    return;
  }

  if (accion === 'subir' || accion === 'bajar') {
    const idx = unidadesAsignatura.findIndex((u) => u.id === id);
    const objetivoIdx = accion === 'subir' ? idx - 1 : idx + 1;
    if (objetivoIdx < 0 || objetivoIdx >= unidadesAsignatura.length) return;

    const otra = unidadesAsignatura[objetivoIdx];

    // Asignar nuevos órdenes correlativos
    const ordenActual = Number(unidad.orden) || (idx + 1);
    const ordenOtra = Number(otra.orden) || (objetivoIdx + 1);

    const nuevoOrdenActual = ordenOtra;
    const nuevoOrdenOtra = ordenActual === ordenOtra ? (accion === 'subir' ? ordenOtra + 1 : ordenOtra - 1) : ordenActual;

    try {
      await Promise.all([
        api.actualizar('unidades', unidad.id, { orden: nuevoOrdenActual }),
        api.actualizar('unidades', otra.id, { orden: nuevoOrdenOtra })
      ]);
      aviso('Orden de unidades actualizado.', 'exito');
      await cargarUnidades();
    } catch (err) {
      aviso(err.message || 'Error al reordenar unidades.', 'error');
    }
  }
});

// ==========================================
// Eventos y acciones de Temas
// ==========================================

btnNuevoTema.addEventListener('click', async () => {
  if (!unidadSeleccionada) return;

  const titulo = await pedirTextoModal({
    titulo: 'Nuevo Tema',
    etiqueta: 'Título del tema *',
    placeholder: 'Ej. El impacto del ritmo en la corteza prefrontal',
    textoBoton: 'Crear Tema'
  });

  if (!titulo) return;

  try {
    const orden = temasUnidad.length > 0
      ? Math.max(...temasUnidad.map((t) => Number(t.orden) || 0)) + 1
      : 1;

    await api.crear('temas', {
      unidadId: unidadSeleccionada.id,
      titulo,
      orden,
      estado: 'borrador'
    });

    aviso('Tema creado exitosamente (en estado borrador).', 'exito');
    await cargarTemas();
  } catch (err) {
    aviso(err.message || 'Error al crear el tema.', 'error');
  }
});

listaTemas.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;

  const accion = btn.dataset.accion;
  const id = btn.dataset.id;
  const tema = temasUnidad.find((t) => t.id === id);
  if (!tema) return;

  if (accion === 'toggle-estado') {
    const nuevoEstado = tema.estado === 'publicado' ? 'borrador' : 'publicado';
    try {
      await api.actualizar('temas', id, { estado: nuevoEstado });
      tema.estado = nuevoEstado;
      aviso(`Estado del tema actualizado a "${nuevoEstado}".`, 'exito');
      renderizarTemas();
    } catch (err) {
      aviso(err.message || 'Error al cambiar estado del tema.', 'error');
    }
    return;
  }

  if (accion === 'subir-tema' || accion === 'bajar-tema') {
    const idx = temasUnidad.findIndex((t) => t.id === id);
    const objetivoIdx = accion === 'subir-tema' ? idx - 1 : idx + 1;
    if (objetivoIdx < 0 || objetivoIdx >= temasUnidad.length) return;

    const otro = temasUnidad[objetivoIdx];

    const ordenActual = Number(tema.orden) || (idx + 1);
    const ordenOtro = Number(otro.orden) || (objetivoIdx + 1);

    const nuevoOrdenActual = ordenOtro;
    const nuevoOrdenOtro = ordenActual === ordenOtro ? (accion === 'subir-tema' ? ordenOtro + 1 : ordenOtro - 1) : ordenActual;

    try {
      await Promise.all([
        api.actualizar('temas', tema.id, { orden: nuevoOrdenActual }),
        api.actualizar('temas', otro.id, { orden: nuevoOrdenOtro })
      ]);
      aviso('Orden de temas actualizado.', 'exito');
      await cargarTemas();
    } catch (err) {
      aviso(err.message || 'Error al reordenar temas.', 'error');
    }
  }
});

selectorAsig.addEventListener('change', (e) => {
  cambiarAsignatura(e.target.value);
});

await iniciar();
