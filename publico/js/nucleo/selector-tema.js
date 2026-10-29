// publico/js/nucleo/selector-tema.js
// Obtiene el tema activo de una actividad a partir de ?temaId= o muestra un selector modal

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

/**
 * Obtiene el tema para la actividad interactiva.
 * Si existe ?temaId= en la URL, lo carga directamente.
 * De lo contrario, despliega un modal con selección en cascada Asignatura → Unidad → Tema
 * (filtrando solo temas publicados y unidades visibles) y retorna el tema elegido.
 *
 * @returns {Promise<Object|null>} Objeto tema seleccionado
 */
export async function obtenerTemaActividad(opciones = {}) {
  const configuracion = typeof opciones === 'object' ? opciones : {};
  const forzarModal = typeof opciones === 'boolean' ? opciones : Boolean(configuracion.forzarModal);
  const temaIdParam = forzarModal ? null : (util.parametro('temaId') || configuracion.temaIdPredeterminado);

  // 1. Si viene temaId en la URL, intentar cargarlo
  if (temaIdParam) {
    try {
      const tema = await api.obtener('temas', temaIdParam);
      const permitido = !Array.isArray(configuracion.temaIds) || configuracion.temaIds.includes(tema?.id);
      if (tema && tema.id && permitido) {
        return tema;
      }
    } catch (err) {
      console.warn(`No se pudo cargar el tema con ID "${temaIdParam}":`, err.message);
    }
  }

  // 2. Si no hay parámetro o falló la carga, abrir modal selector
  const [todasAsig, todasUni, todosTemas] = await Promise.all([
    api.listar('asignaturas'),
    api.listar('unidades'),
    api.listar('temas')
  ]);

  const permitidos = (lista, ids) => !Array.isArray(ids) || !ids.length ? lista : lista.filter((item) => ids.includes(item.id));
  const asignaturas = permitidos(todasAsig || [], configuracion.asignaturaIds);
  const unidades = permitidos((todasUni || []).filter((u) => u.visible !== false), configuracion.unidadIds)
    .filter((u) => asignaturas.some((a) => a.id === u.asignaturaId));
  const temasPublicados = permitidos((todosTemas || []).filter((t) => t.estado === 'publicado'), configuracion.temaIds)
    .filter((t) => unidades.some((u) => u.id === t.unidadId));

  if (temasPublicados.length === 0) {
    await ui.modal({
      titulo: 'Sin contenidos disponibles',
      contenido: '<p>No se encontraron temas publicados disponibles para realizar esta actividad en este momento.</p>',
      acciones: [{ texto: 'Aceptar', valor: null, primario: true }]
    });
    return null;
  }

  // Construir elemento interactivo para el modal
  const contenedor = document.createElement('div');
  contenedor.className = 'selector-tema-modal';
  contenedor.innerHTML = `
    <p style="margin-top: 0; font-size: var(--tamano-s); color: var(--color-texto-suave);">
      Elige la asignatura, unidad y tema didáctico sobre el cual deseas practicar:
    </p>
    <div class="campo">
      <label for="selModalAsignatura" class="campo__etiqueta">Asignatura:</label>
      <select id="selModalAsignatura" class="campo__control">
        <option value="">Selecciona una asignatura...</option>
      </select>
    </div>
    <div class="campo">
      <label for="selModalUnidad" class="campo__etiqueta">Unidad:</label>
      <select id="selModalUnidad" class="campo__control" disabled>
        <option value="">Primero selecciona una asignatura...</option>
      </select>
    </div>
    <div class="campo">
      <label for="selModalTema" class="campo__etiqueta">Tema pedagógico:</label>
      <select id="selModalTema" class="campo__control" disabled>
        <option value="">Primero selecciona una unidad...</option>
      </select>
    </div>
    <div id="errorModalTema" style="color: var(--color-error); font-size: var(--tamano-xs); min-height: 1.2em; margin-top: var(--espacio-xs);"></div>
  `;

  const selAsig = contenedor.querySelector('#selModalAsignatura');
  const selUni = contenedor.querySelector('#selModalUnidad');
  const selTema = contenedor.querySelector('#selModalTema');
  const msgError = contenedor.querySelector('#errorModalTema');

  // Llenar asignaturas
  selAsig.innerHTML = '<option value="">Selecciona una asignatura...</option>' +
    asignaturas.map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)}</option>`).join('');

  // Evento: Cambio de Asignatura
  selAsig.addEventListener('change', () => {
    msgError.textContent = '';
    const asigId = selAsig.value;
    if (!asigId) {
      selUni.innerHTML = '<option value="">Primero selecciona una asignatura...</option>';
      selUni.disabled = true;
      selTema.innerHTML = '<option value="">Primero selecciona una unidad...</option>';
      selTema.disabled = true;
      return;
    }

    const unidadesAsig = unidades.filter((u) => u.asignaturaId === asigId);
    if (unidadesAsig.length === 0) {
      selUni.innerHTML = '<option value="">Esta asignatura no tiene unidades visibles</option>';
      selUni.disabled = true;
      selTema.innerHTML = '<option value="">Sin temas disponibles</option>';
      selTema.disabled = true;
      return;
    }

    selUni.innerHTML = '<option value="">Selecciona una unidad...</option>' +
      unidadesAsig.map((u) => `<option value="${ui.escapar(u.id)}">${ui.escapar(u.titulo)}</option>`).join('');
    selUni.disabled = false;

    selTema.innerHTML = '<option value="">Primero selecciona una unidad...</option>';
    selTema.disabled = true;
    if (unidadesAsig.length === 1) {
      selUni.value = unidadesAsig[0].id;
      selUni.dispatchEvent(new Event('change'));
    }
  });

  // Evento: Cambio de Unidad
  selUni.addEventListener('change', () => {
    msgError.textContent = '';
    const uniId = selUni.value;
    if (!uniId) {
      selTema.innerHTML = '<option value="">Primero selecciona una unidad...</option>';
      selTema.disabled = true;
      return;
    }

    const temasUnidad = temasPublicados.filter((t) => t.unidadId === uniId);
    if (temasUnidad.length === 0) {
      selTema.innerHTML = '<option value="">Esta unidad no tiene temas publicados</option>';
      selTema.disabled = true;
      return;
    }

    selTema.innerHTML = '<option value="">Selecciona un tema...</option>' +
      temasUnidad.map((t) => `<option value="${ui.escapar(t.id)}">${ui.escapar(t.titulo)}</option>`).join('');
    selTema.disabled = false;
    if (temasUnidad.length === 1) selTema.value = temasUnidad[0].id;
  });

  selTema.addEventListener('change', () => {
    msgError.textContent = '';
  });

  // Si solo hay una asignatura, preseleccionarla
  if (asignaturas.length === 1) {
    selAsig.value = asignaturas[0].id;
    selAsig.dispatchEvent(new Event('change'));
  }

  // Desplegar modal
  return new Promise((resolve) => {
    ui.modal({
      titulo: 'Seleccionar Tema de Actividad',
      contenido: contenedor,
      acciones: [
        {
          texto: 'Comenzar actividad',
          valor: 'confirmar',
          primario: true
        },
        {
          texto: 'Cancelar',
          valor: 'cancelar'
        }
      ]
    }).then((accion) => {
      if (accion === 'confirmar') {
        const idTemaElegido = selTema.value;
        if (!idTemaElegido) {
          ui.aviso('Debes seleccionar un tema para iniciar la actividad.', 'error');
          // Reintentar si no seleccionó tema
          obtenerTemaActividad().then(resolve);
          return;
        }

        const temaSeleccionado = temasPublicados.find((t) => t.id === idTemaElegido);
        resolve(temaSeleccionado || null);
      } else {
        resolve(null);
      }
    });
  });
}

export default {
  obtenerTemaActividad
};
