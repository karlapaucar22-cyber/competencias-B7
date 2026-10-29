// publico/js/modulos/editor-cancion.js
// Lógica para el editor de canciones pedagógicas con sincronización LRC

import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: 'Editor de Canción Educativa', roles: ['docente', 'admin'] });

const cancionId = util.parametro('id');
const temaIdParam = util.parametro('temaId');

// Elementos del DOM
const tituloPagina = document.getElementById('tituloPagina');
const migaActual = document.getElementById('migaActual');
const btnVerCancion = document.getElementById('btnVerCancion');
const estadoCargando = document.getElementById('estadoCargando');
const formularioCancion = document.getElementById('formularioCancion');

const campoTitulo = document.getElementById('campoTitulo');
const selectAsignatura = document.getElementById('selectAsignatura');
const selectTema = document.getElementById('selectTema');
const inputArchivoAudio = document.getElementById('inputArchivoAudio');
const btnElegirAudio = document.getElementById('btnElegirAudio');
const nombreArchivoAudio = document.getElementById('nombreArchivoAudio');
const campoAudioUrl = document.getElementById('campoAudioUrl');
const vistaPreviaAudioContenedor = document.getElementById('vistaPreviaAudioContenedor');
const audioPreview = document.getElementById('audioPreview');
const campoLetra = document.getElementById('campoLetra');
const campoLrc = document.getElementById('campoLrc');
const btnEjemploLrc = document.getElementById('btnEjemploLrc');
const campoAutoria = document.getElementById('campoAutoria');
const selectLicencia = document.getElementById('selectLicencia');
const contenedorLicenciaOtra = document.getElementById('contenedorLicenciaOtra');
const campoLicenciaOtra = document.getElementById('campoLicenciaOtra');
const btnEliminar = document.getElementById('btnEliminar');
const btnGuardar = document.getElementById('btnGuardar');

// Mensajes de error
const errorTitulo = document.getElementById('errorTitulo');
const errorTema = document.getElementById('errorTema');
const errorAudio = document.getElementById('errorAudio');
const errorAutoria = document.getElementById('errorAutoria');
const errorLicencia = document.getElementById('errorLicencia');

let asignaturas = [];
let unidades = [];
let temas = [];
let datosOriginales = null;
let cambiosSinGuardar = false;

// Detección de cambios sin guardar
function marcarCambios() {
  cambiosSinGuardar = true;
}

formularioCancion.addEventListener('input', marcarCambios);
formularioCancion.addEventListener('change', marcarCambios);

window.addEventListener('beforeunload', (e) => {
  if (cambiosSinGuardar) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/**
 * Carga inicial de datos para asignaturas, unidades, temas y canción
 */
async function inicializar() {
  try {
    const [listaAsig, listaUni, listaTemas] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    asignaturas = listaAsig || [];
    unidades = listaUni || [];
    temas = listaTemas || [];

    // Llenar selector de asignaturas
    selectAsignatura.innerHTML = '<option value="">Selecciona una asignatura...</option>' +
      asignaturas.map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || 'Nivel único')})</option>`).join('');

    // Si es edición
    if (cancionId) {
      tituloPagina.textContent = 'Editar Canción Educativa';
      migaActual.textContent = 'Editar canción';
      btnEliminar.style.display = 'inline-flex';

      const cancion = await api.obtener('canciones', cancionId);
      datosOriginales = cancion;

      campoTitulo.value = cancion.titulo || '';
      campoAudioUrl.value = cancion.audio || '';
      campoLetra.value = cancion.letra || '';
      campoLrc.value = cancion.lrc || '';
      campoAutoria.value = cancion.autoria || '';

      if (cancion.audio) {
        audioPreview.src = cancion.audio;
        vistaPreviaAudioContenedor.style.display = 'block';
      }

      // Licencia
      const licEstandar = ['Propia', 'CC BY', 'CC BY-SA'];
      if (licEstandar.includes(cancion.licencia)) {
        selectLicencia.value = cancion.licencia;
      } else if (cancion.licencia) {
        selectLicencia.value = 'Otra';
        contenedorLicenciaOtra.style.display = 'block';
        campoLicenciaOtra.value = cancion.licencia;
      }

      // Preseleccionar asignatura y tema
      configurarSeleccionTema(cancion.temaId);

      // Botón para escuchar
      btnVerCancion.style.display = 'inline-flex';
      btnVerCancion.addEventListener('click', () => {
        window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(cancion.temaId)}`;
      });
    } else {
      tituloPagina.textContent = 'Nueva Canción Educativa';
      migaActual.textContent = 'Nueva canción';

      if (temaIdParam) {
        configurarSeleccionTema(temaIdParam);
      }
    }

    estadoCargando.style.display = 'none';
    formularioCancion.style.display = 'flex';
  } catch (err) {
    estadoCargando.innerHTML = `
      <div style="color: var(--color-error);">
        Error al cargar los datos del editor: ${ui.escapar(err.message)}
      </div>
      <div style="margin-top: var(--espacio-m);">
        <a href="/paginas/canciones.html" class="btn btn--secundario">Regresar al catálogo</a>
      </div>
    `;
  }
}

/**
 * Resuelve la jerarquía del tema y selecciona la asignatura y el tema en los dropdowns
 */
function configurarSeleccionTema(temaIdObjetivo) {
  if (!temaIdObjetivo) return;

  const temaSel = temas.find((t) => t.id === temaIdObjetivo);
  if (!temaSel) return;

  const unidadSel = unidades.find((u) => u.id === temaSel.unidadId);
  if (!unidadSel) return;

  selectAsignatura.value = unidadSel.asignaturaId;
  actualizarTemasPorAsignatura(unidadSel.asignaturaId, temaIdObjetivo);
}

/**
 * Filtra los temas correspondientes a la asignatura seleccionada
 */
function actualizarTemasPorAsignatura(asignaturaId, temaSeleccionadoId = null) {
  if (!asignaturaId) {
    selectTema.innerHTML = '<option value="">Primero selecciona una asignatura...</option>';
    selectTema.disabled = true;
    return;
  }

  const idsUnidades = unidades
    .filter((u) => u.asignaturaId === asignaturaId)
    .map((u) => u.id);

  const temasAsignatura = temas.filter((t) => idsUnidades.includes(t.unidadId));

  if (temasAsignatura.length === 0) {
    selectTema.innerHTML = '<option value="">Esta asignatura no tiene temas creados aún</option>';
    selectTema.disabled = true;
    return;
  }

  selectTema.innerHTML = '<option value="">Selecciona un tema...</option>' +
    temasAsignatura.map((t) => {
      const u = unidades.find((uni) => uni.id === t.unidadId);
      const nombreUni = u ? `[${u.titulo}] ` : '';
      const seleccionado = t.id === temaSeleccionadoId ? 'selected' : '';
      return `<option value="${ui.escapar(t.id)}" ${seleccionado}>${ui.escapar(nombreUni + t.titulo)}</option>`;
    }).join('');

  selectTema.disabled = false;
}

// Evento: Cambio de Asignatura
selectAsignatura.addEventListener('change', () => {
  actualizarTemasPorAsignatura(selectAsignatura.value);
});

// Evento: Subida de archivo de audio MP3
btnElegirAudio.addEventListener('click', () => {
  inputArchivoAudio.click();
});

inputArchivoAudio.addEventListener('change', async () => {
  const archivo = inputArchivoAudio.files[0];
  if (!archivo) return;

  const ext = archivo.name.toLowerCase();
  if (!ext.endsWith('.mp3')) {
    ui.aviso('Solo se permiten archivos de audio con extensión .mp3', 'error');
    return;
  }

  nombreArchivoAudio.textContent = `Subiendo ${archivo.name}...`;
  ui.cargando(true);

  try {
    const respuesta = await api.subir(archivo);
    campoAudioUrl.value = respuesta.url;
    nombreArchivoAudio.textContent = `✓ Archivo cargado: ${archivo.name}`;
    audioPreview.src = respuesta.url;
    vistaPreviaAudioContenedor.style.display = 'block';
    marcarCambios();
    ui.aviso('Audio subido exitosamente.', 'exito');
  } catch (err) {
    nombreArchivoAudio.textContent = 'Error al subir el archivo.';
    ui.aviso(err.message || 'Error al procesar la subida del audio.', 'error');
  } finally {
    ui.cargando(false);
  }
});

// Evento: URL de audio manual
campoAudioUrl.addEventListener('input', () => {
  const url = campoAudioUrl.value.trim();
  if (url) {
    audioPreview.src = url;
    vistaPreviaAudioContenedor.style.display = 'block';
  } else {
    vistaPreviaAudioContenedor.style.display = 'none';
  }
});

// Evento: Plantilla de ejemplo LRC
btnEjemploLrc.addEventListener('click', () => {
  const plantilla = [
    '[00:00.00] Título de la obra o introducción musical',
    '[00:05.00] Primera estrofa al ritmo del compás',
    '[00:10.00] Segunda frase con melodía y conceptos clave',
    '[00:15.50] Estribillo memorable para el aprendizaje'
  ].join('\n');

  if (!campoLrc.value.trim()) {
    campoLrc.value = plantilla;
  } else {
    campoLrc.value += '\n' + plantilla;
  }
  marcarCambios();
  campoLrc.focus();
});

// Evento: Selector de Licencia
selectLicencia.addEventListener('change', () => {
  if (selectLicencia.value === 'Otra') {
    contenedorLicenciaOtra.style.display = 'block';
    campoLicenciaOtra.focus();
  } else {
    contenedorLicenciaOtra.style.display = 'none';
  }
});

// Limpieza de errores
function limpiarErrores() {
  [errorTitulo, errorTema, errorAudio, errorAutoria, errorLicencia].forEach((el) => {
    if (el) el.textContent = '';
  });
}

// Evento: Guardar Formulario
formularioCancion.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarErrores();

  let hayErrores = false;
  const titulo = campoTitulo.value.trim();
  const temaId = selectTema.value;
  const audio = campoAudioUrl.value.trim();
  const autoria = campoAutoria.value.trim();
  const tipoLicencia = selectLicencia.value;
  const descOtra = campoLicenciaOtra.value.trim();

  if (!titulo) {
    errorTitulo.textContent = 'El título de la canción es obligatorio.';
    hayErrores = true;
  }

  if (!temaId) {
    errorTema.textContent = 'Debes seleccionar un tema pedagógico.';
    hayErrores = true;
  }

  if (!audio) {
    errorAudio.textContent = 'Debes subir o especificar la URL de un audio MP3.';
    hayErrores = true;
  }

  if (!autoria) {
    errorAutoria.textContent = 'La autoría o créditos son obligatorios.';
    hayErrores = true;
  }

  if (!tipoLicencia) {
    errorLicencia.textContent = 'Debes seleccionar una licencia.';
    hayErrores = true;
  } else if (tipoLicencia === 'Otra' && !descOtra) {
    errorLicencia.textContent = 'Especifica la descripción de la licencia personalizada.';
    hayErrores = true;
  }

  if (hayErrores) {
    ui.aviso('Por favor completa todos los campos requeridos correctamente.', 'error');
    return;
  }

  const licenciaFinal = tipoLicencia === 'Otra' ? descOtra : tipoLicencia;

  const payload = {
    titulo,
    temaId,
    audio,
    letra: campoLetra.value.trim(),
    lrc: campoLrc.value.trim(),
    autoria,
    licencia: licenciaFinal
  };

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';
  ui.cargando(true);

  try {
    if (cancionId) {
      await api.actualizar('canciones', cancionId, payload);
      ui.aviso('Canción actualizada exitosamente.', 'exito');
    } else {
      const nueva = await api.crear('canciones', payload);
      ui.aviso('Canción creada exitosamente.', 'exito');
    }
    cambiosSinGuardar = false;
    setTimeout(() => {
      window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(temaId)}`;
    }, 600);
  } catch (err) {
    ui.aviso(err.message || 'Error al guardar la canción.', 'error');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar canción';
  } finally {
    ui.cargando(false);
  }
});

// Evento: Eliminar Canción
btnEliminar.addEventListener('click', async () => {
  if (!cancionId) return;

  const confirmar = await ui.confirmar('¿Estás seguro de que deseas eliminar permanentemente esta canción educativa?');
  if (!confirmar) return;

  btnEliminar.disabled = true;
  ui.cargando(true);

  try {
    await api.eliminar('canciones', cancionId);
    cambiosSinGuardar = false;
    ui.aviso('Canción eliminada correctamente.', 'info');
    setTimeout(() => {
      window.location.href = '/paginas/canciones.html';
    }, 500);
  } catch (err) {
    ui.aviso(err.message || 'Error al eliminar la canción.', 'error');
    btnEliminar.disabled = false;
  } finally {
    ui.cargando(false);
  }
});

await inicializar();
