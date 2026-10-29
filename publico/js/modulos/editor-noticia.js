// publico/js/modulos/editor-noticia.js
// Lógica para crear y editar noticias por docentes y administradores

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Editor de Noticias", roles: ["docente", "admin"] });

const noticiaId = util.parametro('id');
const esEdicion = Boolean(noticiaId);

const tituloCabecera = document.getElementById('editor-noticia-titulo-cabecera');
const formNoticia = document.getElementById('form-noticia');
const errorDiv = document.getElementById('form-error-noticia');
const btnGuardar = document.getElementById('btn-guardar-noticia');

const campoTitulo = document.getElementById('noticia-titulo');
const campoCategoria = document.getElementById('noticia-categoria');
const campoTema = document.getElementById('noticia-tema');
const campoEstado = document.getElementById('noticia-estado');
const campoResumen = document.getElementById('noticia-resumen');
const contadorResumen = document.getElementById('contador-caracteres-resumen');
const campoImagen = document.getElementById('noticia-imagen');
const btnSubirImagen = document.getElementById('btn-subir-imagen');
const inputArchivoImagen = document.getElementById('input-archivo-imagen');
const imagenPreviaCaja = document.getElementById('imagen-previa-contenedor');
const imagenPreviaImg = document.getElementById('imagen-previa-elemento');
const checkDestacada = document.getElementById('noticia-destacada');
const campoCuerpo = document.getElementById('noticia-cuerpo');
const btnTogglePreview = document.getElementById('btn-toggle-cuerpo-preview');
const cuerpoPreview = document.getElementById('cuerpo-preview');

let noticiaActual = null;

/**
 * Carga temas disponibles y datos previos de la noticia si es edición.
 */
async function iniciar() {
  // 1. Cargar temas para el selector
  try {
    const temas = await api.listar('temas');
    (temas || []).forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      campoTema.appendChild(opt);
    });
  } catch (e) {
    // Silencioso si falla
  }

  // 2. Si es edición, cargar la noticia existente
  if (esEdicion) {
    tituloCabecera.textContent = 'Editar Noticia';
    btnGuardar.textContent = 'Guardar Cambios';

    try {
      noticiaActual = await api.obtener('noticias', noticiaId);
      campoTitulo.value = noticiaActual.titulo || '';
      campoCategoria.value = noticiaActual.categoria || 'Institucional';
      campoTema.value = noticiaActual.temaId || '';
      campoEstado.value = noticiaActual.estado || 'borrador';
      campoResumen.value = noticiaActual.resumen || '';
      campoImagen.value = noticiaActual.imagen || '';
      checkDestacada.checked = Boolean(noticiaActual.destacada);
      campoCuerpo.value = noticiaActual.cuerpo || '';

      actualizarContadorResumen();
      actualizarPreviaImagen();
    } catch (err) {
      errorDiv.textContent = `Error al cargar la noticia: ${err.message}`;
      errorDiv.style.display = 'block';
      btnGuardar.disabled = true;
    }
  } else {
    actualizarContadorResumen();
  }
}

/**
 * Actualiza el contador de caracteres del resumen (máximo 200).
 */
function actualizarContadorResumen() {
  const chars = (campoResumen.value || '').length;
  contadorResumen.textContent = `${chars} / 200 caracteres`;
  contadorResumen.style.color = chars >= 200 ? 'var(--color-advertencia)' : 'inherit';
}

/**
 * Muestra u oculta la miniatura de vista previa de la imagen.
 */
function actualizarPreviaImagen() {
  const url = (campoImagen.value || '').trim();
  if (url) {
    imagenPreviaImg.src = url;
    imagenPreviaCaja.style.display = 'block';
  } else {
    imagenPreviaCaja.style.display = 'none';
    imagenPreviaImg.src = '';
  }
}

// Eventos de entrada
campoResumen.addEventListener('input', actualizarContadorResumen);
campoImagen.addEventListener('input', actualizarPreviaImagen);

// Subida de imagen
btnSubirImagen.addEventListener('click', () => {
  inputArchivoImagen.click();
});

inputArchivoImagen.addEventListener('change', async () => {
  const file = inputArchivoImagen.files[0];
  if (!file) return;

  btnSubirImagen.disabled = true;
  btnSubirImagen.textContent = 'Subiendo...';

  try {
    const res = await api.subir(file);
    campoImagen.value = res.url;
    actualizarPreviaImagen();
    aviso('Imagen subida exitosamente.', 'exito');
  } catch (err) {
    aviso(err.message || 'Error al subir la imagen.', 'error');
  } finally {
    btnSubirImagen.disabled = false;
    btnSubirImagen.textContent = 'Subir imagen';
    inputArchivoImagen.value = '';
  }
});

// Vista previa del cuerpo con formato básico
btnTogglePreview.addEventListener('click', () => {
  const visible = cuerpoPreview.style.display !== 'none';
  if (visible) {
    cuerpoPreview.style.display = 'none';
    btnTogglePreview.textContent = 'Ver vista previa';
  } else {
    cuerpoPreview.innerHTML = util.formatoBasico(campoCuerpo.value || '*(Sin contenido)*');
    cuerpoPreview.style.display = 'block';
    btnTogglePreview.textContent = 'Ocultar vista previa';
  }
});

// Guardar noticia
btnGuardar.addEventListener('click', async () => {
  const titulo = (campoTitulo.value || '').trim();
  const categoria = campoCategoria.value;
  const temaIdSeleccionado = campoTema.value || null;
  const estado = campoEstado.value;
  const resumen = (campoResumen.value || '').trim();
  const imagen = (campoImagen.value || '').trim() || null;
  const destacada = checkDestacada.checked;
  const cuerpo = (campoCuerpo.value || '').trim();

  errorDiv.style.display = 'none';
  errorDiv.textContent = '';

  if (!titulo) {
    errorDiv.textContent = 'El título de la noticia es obligatorio.';
    errorDiv.style.display = 'block';
    campoTitulo.focus();
    return;
  }

  if (!resumen) {
    errorDiv.textContent = 'El resumen de la noticia es obligatorio.';
    errorDiv.style.display = 'block';
    campoResumen.focus();
    return;
  }

  if (resumen.length > 200) {
    errorDiv.textContent = `El resumen no puede superar 200 caracteres (actual: ${resumen.length}).`;
    errorDiv.style.display = 'block';
    campoResumen.focus();
    return;
  }

  if (!cuerpo) {
    errorDiv.textContent = 'El cuerpo de la noticia es obligatorio.';
    errorDiv.style.display = 'block';
    campoCuerpo.focus();
    return;
  }

  const payload = {
    titulo,
    categoria,
    temaId: temaIdSeleccionado,
    estado,
    resumen,
    imagen,
    destacada,
    cuerpo
  };

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    if (esEdicion) {
      await api.actualizar('noticias', noticiaId, payload);
      aviso('Noticia actualizada exitosamente.', 'exito');
    } else {
      await api.crear('noticias', payload);
      aviso('Noticia creada exitosamente.', 'exito');
    }

    setTimeout(() => {
      window.location.href = '/paginas/noticias.html';
    }, 700);
  } catch (err) {
    errorDiv.textContent = err.message || 'Error al guardar la noticia.';
    errorDiv.style.display = 'block';
    btnGuardar.disabled = false;
    btnGuardar.textContent = esEdicion ? 'Guardar Cambios' : 'Guardar Noticia';
  }
});

await iniciar();
