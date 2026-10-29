// publico/js/modulos/editor-tema.js
// Editor integral de la ficha pedagógica del tema y su glosario para docentes y administradores

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { aviso, confirmar, modal, escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Ficha del Tema y Glosario", roles: ["docente", "admin"] });

const temaId = util.parametro('id');

const contenedorCargando = document.getElementById('tema-cargando');
const contenedorFormulario = document.getElementById('tema-formulario-contenedor');
const enlaceVolver = document.getElementById('enlace-volver');

const migaUnidad = document.getElementById('tema-unidad-nombre');
const tituloCabecera = document.getElementById('tema-titulo-cabecera');
const badgeEstadoTema = document.getElementById('badge-estado-tema');
const btnGuardarFicha = document.getElementById('btn-guardar-ficha');

// Campos de ficha
const campoTitulo = document.getElementById('campo-titulo');
const campoDificultad = document.getElementById('campo-dificultad');
const campoEstado = document.getElementById('campo-estado');
const campoResumen = document.getElementById('campo-resumen');
const contadorResumen = document.getElementById('contador-palabras-resumen');
const btnTogglePreview = document.getElementById('btn-toggle-preview');
const resumenPreview = document.getElementById('resumen-preview');

const contObjetivos = document.getElementById('contenedor-objetivos');
const btnAgregarObjetivo = document.getElementById('btn-agregar-objetivo');

const contEjemplos = document.getElementById('contenedor-ejemplos');
const btnAgregarEjemplo = document.getElementById('btn-agregar-ejemplo');

const contErrores = document.getElementById('contenedor-errores');
const btnAgregarError = document.getElementById('btn-agregar-error');

const contPreguntas = document.getElementById('contenedor-preguntas');
const btnAgregarPregunta = document.getElementById('btn-agregar-pregunta');

const contRecursos = document.getElementById('contenedor-recursos');
const btnAgregarRecurso = document.getElementById('btn-agregar-recurso');

const campoPalabrasClave = document.getElementById('campo-palabras-clave');
const campoFuentes = document.getElementById('campo-fuentes');

// Glosario
const tablaGlosarioCuerpo = document.getElementById('tabla-glosario-cuerpo');
const btnAgregarTermino = document.getElementById('btn-agregar-termino');
const metricaTotal = document.getElementById('metrica-total-terminos');
const metricaSeisLetras = document.getElementById('metrica-seis-letras');
const indicadorAptoJuegos = document.getElementById('indicador-apto-juegos');

let temaActual = null;
let unidadActual = null;
let terminosGlosario = [];

let hayCambiosSinGuardar = false;

/**
 * Cuenta palabras en una cadena de texto.
 */
function contarPalabras(texto) {
  if (!texto) return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Carga el tema, la unidad asociada y los términos de glosario.
 */
async function cargarDatos() {
  if (!temaId) {
    contenedorCargando.innerHTML = `
      <div class="alerta alerta--error">
        <strong>Error de parámetro:</strong> No se especificó el identificador del tema (?id=...).
      </div>
      <p><a href="/paginas/editor-contenidos.html" class="btn btn--primario">Ir al editor de contenidos</a></p>
    `;
    return;
  }

  try {
    const [tema, glosarioLista] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('glosario', { temaId })
    ]);

    temaActual = tema;
    terminosGlosario = Array.isArray(glosarioLista) ? glosarioLista.filter((g) => g.temaId === temaId) : [];

    // Cargar información de la unidad
    if (temaActual.unidadId) {
      try {
        unidadActual = await api.obtener('unidades', temaActual.unidadId);
      } catch (e) {
        unidadActual = null;
      }
    }

    poblarFicha();
    renderizarGlosario();

    contenedorCargando.style.display = 'none';
    contenedorFormulario.style.display = 'block';
    hayCambiosSinGuardar = false;
  } catch (err) {
    contenedorCargando.innerHTML = `
      <div class="alerta alerta--error">
        <strong>Error al cargar el tema:</strong> ${escapar(err.message)}
      </div>
      <p><a href="/paginas/editor-contenidos.html" class="btn btn--secundario">Volver a contenidos</a></p>
    `;
  }
}

/**
 * Rellena los campos del formulario con los datos del tema actual.
 */
function poblarFicha() {
  migaUnidad.textContent = unidadActual ? `Unidad: ${unidadActual.titulo}` : 'Unidad académica';
  tituloCabecera.textContent = temaActual.titulo || 'Sin título';

  actualizarBadgeEstado(temaActual.estado);

  campoTitulo.value = temaActual.titulo || '';
  campoDificultad.value = temaActual.dificultad || 'intermedio';
  campoEstado.value = temaActual.estado || 'borrador';
  campoResumen.value = temaActual.resumen || '';
  actualizarContadorResumen();

  // Listas dinámicas
  contObjetivos.innerHTML = '';
  (temaActual.objetivos || []).forEach((obj) => agregarFilaTexto(contObjetivos, obj));

  contEjemplos.innerHTML = '';
  (temaActual.ejemplos || []).forEach((ej) => agregarFilaTexto(contEjemplos, ej));

  contErrores.innerHTML = '';
  (temaActual.erroresFrecuentes || []).forEach((err) => agregarFilaTexto(contErrores, err));

  contPreguntas.innerHTML = '';
  (temaActual.preguntasGuia || []).forEach((preg) => agregarFilaTexto(contPreguntas, preg));

  contRecursos.innerHTML = '';
  (temaActual.recursos || []).forEach((rec) => agregarFilaRecurso(contRecursos, rec));

  campoPalabrasClave.value = (temaActual.palabrasClave || []).join(', ');
  campoFuentes.value = temaActual.fuentes || '';
}

/**
 * Actualiza el indicador visual del estado del tema en la cabecera.
 */
function actualizarBadgeEstado(estado) {
  const esPublicado = estado === 'publicado';
  badgeEstadoTema.className = `insignia ${esPublicado ? 'insignia--acento' : ''}`;
  badgeEstadoTema.textContent = esPublicado ? 'Publicado' : 'Borrador';
}

/**
 * Actualiza el contador de palabras del resumen conceptual.
 */
function actualizarContadorResumen() {
  const num = contarPalabras(campoResumen.value);
  contadorResumen.textContent = `${num} palabra${num === 1 ? '' : 's'}`;

  contadorResumen.classList.remove('meta-contador--valido', 'meta-contador--aviso');
  if (num >= 300 && num <= 800) {
    contadorResumen.classList.add('meta-contador--valido');
  } else if (num > 0) {
    contadorResumen.classList.add('meta-contador--aviso');
  }
}

/**
 * Agrega una fila de texto simple a una lista dinámica (objetivos, ejemplos, etc.).
 */
function agregarFilaTexto(contenedor, texto = '') {
  const fila = document.createElement('div');
  fila.className = 'item-dinamico-fila';
  fila.innerHTML = `
    <input type="text" value="${escapar(texto)}" placeholder="Escribe aquí...">
    <button type="button" class="item-dinamico-eliminar" aria-label="Eliminar elemento">×</button>
  `;

  fila.querySelector('.item-dinamico-eliminar').addEventListener('click', () => {
    fila.remove();
    hayCambiosSinGuardar = true;
  });

  fila.querySelector('input').addEventListener('input', () => {
    hayCambiosSinGuardar = true;
  });

  contenedor.appendChild(fila);
}

/**
 * Agrega una fila para recurso didáctico (tipo, título, URL y botón subir).
 */
function agregarFilaRecurso(contenedor, recurso = { tipo: 'lectura', titulo: '', url: '' }) {
  const fila = document.createElement('div');
  fila.className = 'recurso-fila';
  fila.innerHTML = `
    <select class="recurso-fila__tipo" aria-label="Tipo de recurso">
      <option value="lectura" ${recurso.tipo === 'lectura' ? 'selected' : ''}>Lectura</option>
      <option value="video" ${recurso.tipo === 'video' ? 'selected' : ''}>Video</option>
      <option value="pdf" ${recurso.tipo === 'pdf' ? 'selected' : ''}>PDF</option>
      <option value="imagen" ${recurso.tipo === 'imagen' ? 'selected' : ''}>Imagen</option>
      <option value="audio" ${recurso.tipo === 'audio' ? 'selected' : ''}>Audio</option>
      <option value="enlace" ${recurso.tipo === 'enlace' ? 'selected' : ''}>Enlace</option>
      <option value="actividad" ${recurso.tipo === 'actividad' ? 'selected' : ''}>Actividad</option>
    </select>
    <input type="text" class="recurso-fila__titulo" placeholder="Título del recurso" value="${escapar(recurso.titulo || '')}">
    <input type="text" class="recurso-fila__url" placeholder="URL o ruta del recurso" value="${escapar(recurso.url || '')}">
    <button type="button" class="btn btn--pequeno btn--secundario btn-subir-recurso" title="Subir archivo local">Subir</button>
    <input type="file" class="input-archivo-oculto" style="display: none;" accept="image/*,application/pdf,audio/mpeg">
    <button type="button" class="item-dinamico-eliminar" aria-label="Eliminar recurso">×</button>
  `;

  const btnSubir = fila.querySelector('.btn-subir-recurso');
  const inputArchivo = fila.querySelector('.input-archivo-oculto');
  const inputUrl = fila.querySelector('.recurso-fila__url');
  const selectTipo = fila.querySelector('.recurso-fila__tipo');

  btnSubir.addEventListener('click', () => inputArchivo.click());

  inputArchivo.addEventListener('change', async () => {
    const file = inputArchivo.files[0];
    if (!file) return;

    btnSubir.disabled = true;
    btnSubir.textContent = 'Subiendo...';

    try {
      const res = await api.subir(file);
      inputUrl.value = res.url;
      // Autoajustar el tipo si es coherente
      if (file.type.startsWith('image/')) selectTipo.value = 'imagen';
      else if (file.type === 'application/pdf') selectTipo.value = 'pdf';
      else if (file.type.startsWith('audio/')) selectTipo.value = 'audio';

      aviso('Archivo subido exitosamente.', 'exito');
      hayCambiosSinGuardar = true;
    } catch (err) {
      aviso(err.message || 'Error al subir el archivo.', 'error');
    } finally {
      btnSubir.disabled = false;
      btnSubir.textContent = 'Subir';
      inputArchivo.value = '';
    }
  });

  fila.querySelector('.item-dinamico-eliminar').addEventListener('click', () => {
    fila.remove();
    hayCambiosSinGuardar = true;
  });

  fila.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('input', () => { hayCambiosSinGuardar = true; });
  });

  contenedor.appendChild(fila);
}

// ==========================================
// Gestión del Glosario
// ==========================================

/**
 * Renderiza la tabla de términos del glosario y calcula las métricas requeridas.
 */
function renderizarGlosario() {
  const total = terminosGlosario.length;
  const seisLetras = terminosGlosario.filter((t) => util.normalizar(t.termino).length === 6).length;

  metricaTotal.textContent = total;
  metricaSeisLetras.textContent = seisLetras;

  const aptoParaJuegos = total >= 12 && seisLetras >= 3;
  if (aptoParaJuegos) {
    indicadorAptoJuegos.innerHTML = `
      <span class="insignia insignia--exito" title="Cumple los requisitos para crucigramas, ahorcado y trivias">
        🎮 Apto para juegos
      </span>
    `;
  } else {
    indicadorAptoJuegos.innerHTML = `
      <span class="insignia" style="opacity: 0.8;" title="Se requieren al menos 12 términos y 3 de 6 letras">
        Faltan para juegos (${total}/12 térm., ${seisLetras}/3 de 6 letras)
      </span>
    `;
  }

  if (total === 0) {
    tablaGlosarioCuerpo.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
          Este tema aún no tiene términos en el glosario.<br>
          Usa el botón "+ Agregar Término" para registrar el primero.
        </td>
      </tr>
    `;
    return;
  }

  tablaGlosarioCuerpo.innerHTML = terminosGlosario.map((t) => {
    const esDeSeis = util.normalizar(t.termino).length === 6;
    const badgeSeis = esDeSeis ? '<span class="termino-seis-letras">6 letras</span>' : '';
    const badgeIa = t.origen === 'ia' ? '<span class="termino-origen-ia" title="Generado con IA y aprobado por el docente">IA</span>' : '';

    return `
      <tr data-id="${escapar(t.id)}">
        <td>
          <div style="font-weight: var(--peso-negrita); color: var(--color-primario);">
            ${escapar(t.termino)}
          </div>
          ${badgeSeis}${badgeIa}
        </td>
        <td style="font-size: var(--tamano-s);">
          ${escapar(t.definicion || '')}
        </td>
        <td style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
          ${escapar(t.pista || 'Sin pista')}
        </td>
        <td style="font-size: var(--tamano-s);">
          ${escapar(t.retroalimentacion || 'Sin retroalimentación')}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: var(--espacio-xs);">
            <button type="button" class="btn btn--pequeno btn--secundario btn-editar-termino" data-id="${escapar(t.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--pequeno btn--peligro btn-eliminar-termino" data-id="${escapar(t.id)}">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Modal para agregar o editar un término de glosario con control de palabras.
 */
async function abrirModalTermino(terminoObj = null) {
  const esEdicion = Boolean(terminoObj && terminoObj.id);
  const tituloModal = esEdicion ? 'Editar Término del Glosario' : 'Nuevo Término del Glosario';

  const contenedor = document.createElement('div');
  contenedor.innerHTML = `
    <form id="form-termino" onsubmit="return false;">
      <div id="modal-error-termino" class="campo__error" style="display: none; margin-bottom: var(--espacio-m);" role="alert"></div>

      <div class="campo">
        <label for="glo-termino">Término * (una sola palabra)</label>
        <input type="text" id="glo-termino" required placeholder="Ej. CORTEX" value="${esEdicion ? escapar(terminoObj.termino || '') : ''}">
      </div>

      <div class="campo">
        <div class="campo-etiqueta-con-meta">
          <label for="glo-definicion">Definición * (máximo 25 palabras)</label>
          <span id="contador-glo-def" class="meta-contador">0 / 25 palabras</span>
        </div>
        <textarea id="glo-definicion" rows="3" required placeholder="Definición concisa y precisa...">${esEdicion ? escapar(terminoObj.definicion || '') : ''}</textarea>
      </div>

      <div class="campo">
        <div class="campo-etiqueta-con-meta">
          <label for="glo-pista">Pista * (máximo 10 palabras)</label>
          <span id="contador-glo-pista" class="meta-contador">0 / 10 palabras</span>
        </div>
        <input type="text" id="glo-pista" required placeholder="Pista orientadora para juegos..." value="${esEdicion ? escapar(terminoObj.pista || '') : ''}">
      </div>

      <div class="campo">
        <label for="glo-retro">Retroalimentación pedagógica *</label>
        <textarea id="glo-retro" rows="2" required placeholder="Mensaje formativo al acertar o fallar el término...">${esEdicion ? escapar(terminoObj.retroalimentacion || '') : ''}</textarea>
      </div>
    </form>
  `;

  const inputTermino = contenedor.querySelector('#glo-termino');
  const txtDefinicion = contenedor.querySelector('#glo-definicion');
  const inputPista = contenedor.querySelector('#glo-pista');
  const txtRetro = contenedor.querySelector('#glo-retro');
  const errorDiv = contenedor.querySelector('#modal-error-termino');

  const contadorDef = contenedor.querySelector('#contador-glo-def');
  const contadorPista = contenedor.querySelector('#contador-glo-pista');

  function actualizarContadores() {
    const nDef = contarPalabras(txtDefinicion.value);
    contadorDef.textContent = `${nDef} / 25 palabras`;
    contadorDef.style.color = nDef > 25 ? 'var(--color-error)' : 'inherit';

    const nPista = contarPalabras(inputPista.value);
    contadorPista.textContent = `${nPista} / 10 palabras`;
    contadorPista.style.color = nPista > 10 ? 'var(--color-error)' : 'inherit';
  }

  txtDefinicion.addEventListener('input', actualizarContadores);
  inputPista.addEventListener('input', actualizarContadores);
  actualizarContadores();

  await modal({
    titulo: tituloModal,
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: esEdicion ? 'Guardar Cambios' : 'Agregar Término',
        valor: 'guardar',
        clase: 'btn btn--primario',
        validar: async () => {
          const termino = (inputTermino.value || '').trim();
          const definicion = (txtDefinicion.value || '').trim();
          const pista = (inputPista.value || '').trim();
          const retroalimentacion = (txtRetro.value || '').trim();

          errorDiv.style.display = 'none';
          errorDiv.textContent = '';

          if (!termino) {
            errorDiv.textContent = 'El término es obligatorio.';
            errorDiv.style.display = 'block';
            inputTermino.focus();
            return false;
          }

          if (termino.includes(' ')) {
            errorDiv.textContent = 'El término debe ser de una sola palabra.';
            errorDiv.style.display = 'block';
            inputTermino.focus();
            return false;
          }

          if (!definicion) {
            errorDiv.textContent = 'La definición es obligatoria.';
            errorDiv.style.display = 'block';
            txtDefinicion.focus();
            return false;
          }

          if (contarPalabras(definicion) > 25) {
            errorDiv.textContent = `La definición no puede superar las 25 palabras (actual: ${contarPalabras(definicion)}).`;
            errorDiv.style.display = 'block';
            txtDefinicion.focus();
            return false;
          }

          if (!pista) {
            errorDiv.textContent = 'La pista es obligatoria.';
            errorDiv.style.display = 'block';
            inputPista.focus();
            return false;
          }

          if (contarPalabras(pista) > 10) {
            errorDiv.textContent = `La pista no puede superar las 10 palabras (actual: ${contarPalabras(pista)}).`;
            errorDiv.style.display = 'block';
            inputPista.focus();
            return false;
          }

          if (!retroalimentacion) {
            errorDiv.textContent = 'La retroalimentación pedagógica es obligatoria.';
            errorDiv.style.display = 'block';
            txtRetro.focus();
            return false;
          }

          try {
            const payload = {
              temaId,
              termino,
              definicion,
              pista,
              retroalimentacion,
              origen: 'docente',
              estado: 'aprobado'
            };

            if (esEdicion) {
              await api.actualizar('glosario', terminoObj.id, payload);
              const idx = terminosGlosario.findIndex((x) => x.id === terminoObj.id);
              if (idx !== -1) terminosGlosario[idx] = { ...terminosGlosario[idx], ...payload };
              aviso('Término actualizado correctamente.', 'exito');
            } else {
              const nuevo = await api.crear('glosario', payload);
              terminosGlosario.push(nuevo);
              aviso('Término agregado exitosamente.', 'exito');
            }

            renderizarGlosario();
            return true;
          } catch (err) {
            errorDiv.textContent = err.message || 'Error al guardar el término.';
            errorDiv.style.display = 'block';
            return false;
          }
        }
      }
    ]
  });
}

// ==========================================
// Guardar Ficha del Tema
// ==========================================

async function guardarFicha() {
  const titulo = (campoTitulo.value || '').trim();
  const dificultad = campoDificultad.value;
  const estado = campoEstado.value;
  const resumen = (campoResumen.value || '').trim();

  if (!titulo) {
    aviso('El título del tema es obligatorio.', 'error');
    campoTitulo.focus();
    return;
  }

  // Recolectar listas dinámicas
  const objetivos = Array.from(contObjetivos.querySelectorAll('input'))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const ejemplos = Array.from(contEjemplos.querySelectorAll('input'))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const erroresFrecuentes = Array.from(contErrores.querySelectorAll('input'))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const preguntasGuia = Array.from(contPreguntas.querySelectorAll('input'))
    .map((inp) => inp.value.trim())
    .filter(Boolean);

  const recursos = Array.from(contRecursos.querySelectorAll('.recurso-fila')).map((fila) => {
    return {
      tipo: fila.querySelector('.recurso-fila__tipo').value,
      titulo: fila.querySelector('.recurso-fila__titulo').value.trim(),
      url: fila.querySelector('.recurso-fila__url').value.trim()
    };
  }).filter((r) => r.titulo || r.url);

  const palabrasClave = (campoPalabrasClave.value || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const fuentes = (campoFuentes.value || '').trim();

  const payload = {
    titulo,
    dificultad,
    estado,
    resumen,
    objetivos,
    ejemplos,
    erroresFrecuentes,
    preguntasGuia,
    recursos,
    palabrasClave,
    fuentes
  };

  btnGuardarFicha.disabled = true;
  btnGuardarFicha.textContent = 'Guardando...';

  try {
    const actualizado = await api.actualizar('temas', temaId, payload);
    temaActual = { ...temaActual, ...actualizado };
    tituloCabecera.textContent = temaActual.titulo;
    actualizarBadgeEstado(temaActual.estado);

    hayCambiosSinGuardar = false;
    aviso('Ficha del tema guardada correctamente.', 'exito');
  } catch (err) {
    aviso(err.message || 'Error al guardar la ficha del tema.', 'error');
  } finally {
    btnGuardarFicha.disabled = false;
    btnGuardarFicha.textContent = 'Guardar Ficha';
  }
}

// ==========================================
// Eventos y escuchadores
// ==========================================

campoResumen.addEventListener('input', () => {
  actualizarContadorResumen();
  hayCambiosSinGuardar = true;
});

btnTogglePreview.addEventListener('click', () => {
  const visible = resumenPreview.style.display !== 'none';
  if (visible) {
    resumenPreview.style.display = 'none';
    btnTogglePreview.textContent = 'Ver vista previa';
  } else {
    resumenPreview.innerHTML = util.formatoBasico(campoResumen.value || '*(Sin contenido)*');
    resumenPreview.style.display = 'block';
    btnTogglePreview.textContent = 'Ocultar vista previa';
  }
});

btnAgregarObjetivo.addEventListener('click', () => {
  agregarFilaTexto(contObjetivos, '');
  hayCambiosSinGuardar = true;
});

btnAgregarEjemplo.addEventListener('click', () => {
  agregarFilaTexto(contEjemplos, '');
  hayCambiosSinGuardar = true;
});

btnAgregarError.addEventListener('click', () => {
  agregarFilaTexto(contErrores, '');
  hayCambiosSinGuardar = true;
});

btnAgregarPregunta.addEventListener('click', () => {
  agregarFilaTexto(contPreguntas, '');
  hayCambiosSinGuardar = true;
});

btnAgregarRecurso.addEventListener('click', () => {
  agregarFilaRecurso(contRecursos);
  hayCambiosSinGuardar = true;
});

document.getElementById('form-ficha-tema').addEventListener('input', () => {
  hayCambiosSinGuardar = true;
});

btnGuardarFicha.addEventListener('click', guardarFicha);

// Glosario eventos delegados
btnAgregarTermino.addEventListener('click', () => abrirModalTermino(null));

tablaGlosarioCuerpo.addEventListener('click', async (e) => {
  const btnEditar = e.target.closest('.btn-editar-termino');
  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const item = terminosGlosario.find((g) => g.id === id);
    if (item) await abrirModalTermino(item);
    return;
  }

  const btnEliminar = e.target.closest('.btn-eliminar-termino');
  if (btnEliminar) {
    const id = btnEliminar.dataset.id;
    const item = terminosGlosario.find((g) => g.id === id);
    if (!item) return;

    const conf = await confirmar(`¿Estás seguro de que deseas eliminar el término "${item.termino}" del glosario?`);
    if (!conf) return;

    btnEliminar.disabled = true;
    try {
      await api.eliminar('glosario', id);
      terminosGlosario = terminosGlosario.filter((g) => g.id !== id);
      aviso('Término eliminado del glosario.', 'exito');
      renderizarGlosario();
    } catch (err) {
      aviso(err.message || 'Error al eliminar el término.', 'error');
      btnEliminar.disabled = false;
    }
  }
});

// ==========================================
// Generar glosario con IA y aprobación docente
// ==========================================

const btnGenerarIa = document.getElementById('btn-generar-ia');
const seccionPropuestas = document.getElementById('propuestas-ia');
const cuerpoPropuestas = document.getElementById('propuestas-ia-cuerpo');
const contadorPropuestas = document.getElementById('propuestas-ia-contador');
const btnAprobarIa = document.getElementById('btn-aprobar-ia');
const btnDescartarIa = document.getElementById('btn-descartar-ia');

let propuestas = [];   // { clave, termino, definicion, pista, retroalimentacion, incluir, repetida }
let siguienteClave = 1;

// Motivo por el que un término repite a uno existente o a otro de la lista ('' si no repite)
function motivoRepetida(termino, clave) {
  const norm = util.normalizar(termino);
  if (!norm) return '';
  if (terminosGlosario.some((g) => util.normalizar(g.termino) === norm)) return 'Ya existe en el glosario';
  const anterior = propuestas.find((p) => p.clave !== clave && util.normalizar(p.termino) === norm);
  return anterior && anterior.clave < clave ? 'Repetido en la lista' : '';
}

function erroresPropuesta(p) {
  const errores = [];
  if (!p.termino.trim()) errores.push('falta el término');
  if (!p.definicion.trim()) errores.push('falta la definición');
  else if (contarPalabras(p.definicion) > 25) errores.push(`definición de ${contarPalabras(p.definicion)} palabras (máx. 25)`);
  if (!p.pista.trim()) errores.push('falta la pista');
  else if (contarPalabras(p.pista) > 10) errores.push(`pista de ${contarPalabras(p.pista)} palabras (máx. 10)`);
  if (!p.retroalimentacion.trim()) errores.push('falta la retroalimentación');
  return errores;
}

function actualizarContadorPropuestas() {
  const marcadas = propuestas.filter((p) => p.incluir).length;
  const repetidas = propuestas.filter((p) => p.repetida).length;
  contadorPropuestas.textContent = `${marcadas} de ${propuestas.length} seleccionadas${repetidas ? ` · ${repetidas} repetida${repetidas === 1 ? '' : 's'}` : ''}`;
  btnAprobarIa.disabled = marcadas === 0;
}

function campoPropuesta(p, campo, etiqueta, multilinea) {
  const control = document.createElement(multilinea ? 'textarea' : 'input');
  if (!multilinea) control.type = 'text';
  else control.rows = 3;
  control.value = p[campo];
  control.setAttribute('aria-label', `${etiqueta} de la propuesta ${p.clave}`);
  control.addEventListener('input', () => {
    p[campo] = control.value;
    if (campo === 'termino') {
      // Al corregir el término se vuelve a comprobar si repite
      const antes = p.repetida;
      p.repetida = motivoRepetida(p.termino, p.clave);
      if (antes !== p.repetida) renderizarPropuestas(p.clave);
    }
  });
  const celda = document.createElement('td');
  celda.append(control);
  return celda;
}

function renderizarPropuestas(enfocar = null) {
  seccionPropuestas.hidden = propuestas.length === 0;
  cuerpoPropuestas.replaceChildren(...propuestas.map((p) => {
    const fila = document.createElement('tr');
    if (p.repetida) fila.className = 'propuestas-ia__fila--repetida';

    const celdaCasilla = document.createElement('td');
    const casilla = document.createElement('input');
    casilla.type = 'checkbox';
    casilla.checked = p.incluir;
    casilla.setAttribute('aria-label', `Incluir «${p.termino || 'sin término'}»`);
    casilla.addEventListener('change', () => {
      p.incluir = casilla.checked;
      actualizarContadorPropuestas();
    });
    celdaCasilla.append(casilla);

    const celdaTermino = campoPropuesta(p, 'termino', 'Término', false);
    if (p.repetida) {
      const avisoRep = document.createElement('span');
      avisoRep.className = 'propuestas-ia__aviso';
      avisoRep.textContent = `⚠ ${p.repetida}`;
      celdaTermino.append(avisoRep);
    }
    if (p.error) {
      const error = document.createElement('span');
      error.className = 'propuestas-ia__error';
      error.setAttribute('role', 'alert');
      error.textContent = `Revisar: ${p.error}`;
      celdaTermino.append(error);
    }

    fila.append(
      celdaCasilla,
      celdaTermino,
      campoPropuesta(p, 'definicion', 'Definición', true),
      campoPropuesta(p, 'pista', 'Pista', false),
      campoPropuesta(p, 'retroalimentacion', 'Retroalimentación', true)
    );
    return fila;
  }));
  actualizarContadorPropuestas();
  if (enfocar) {
    const indice = propuestas.findIndex((p) => p.clave === enfocar);
    cuerpoPropuestas.rows[indice]?.querySelector('input[type="text"]')?.focus();
  }
}

async function pedirCantidad() {
  const contenido = document.createElement('div');
  contenido.className = 'campo';
  contenido.innerHTML = `
    <label for="cantidad-ia">Cantidad de términos a proponer (5 a 20)</label>
    <input type="number" id="cantidad-ia" min="5" max="20" step="1" value="10" inputmode="numeric">
    <span class="campo__error" id="error-cantidad-ia" role="alert" hidden></span>
  `;
  let cantidad = null;
  const accion = await modal({
    titulo: 'Generar glosario con IA',
    contenido,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: '✨ Generar',
        valor: 'generar',
        clase: 'btn btn--primario',
        validar: () => {
          const valor = Number(contenido.querySelector('#cantidad-ia').value);
          const error = contenido.querySelector('#error-cantidad-ia');
          if (!Number.isInteger(valor) || valor < 5 || valor > 20) {
            error.textContent = 'Escribe un número entero entre 5 y 20.';
            error.hidden = false;
            return false;
          }
          cantidad = valor;
          return true;
        }
      }
    ]
  });
  return accion === 'generar' ? cantidad : null;
}

async function generarConIa() {
  if (propuestas.length && !(await confirmar('Ya hay propuestas sin revisar. ¿Reemplazarlas por una nueva generación?'))) return;
  const cantidad = await pedirCantidad();
  if (!cantidad) return;

  btnGenerarIa.disabled = true;
  cargando(true);
  try {
    const respuesta = await api.ia('generar-glosario', { temaId, cantidad });
    const lista = Array.isArray(respuesta) ? respuesta : [];
    propuestas = [];
    for (const t of lista) {
      const p = {
        clave: siguienteClave++,
        termino: String(t.termino || '').trim(),
        definicion: String(t.definicion || '').trim(),
        pista: String(t.pista || '').trim(),
        retroalimentacion: String(t.retroalimentacion || '').trim()
      };
      propuestas.push(p);
      p.repetida = motivoRepetida(p.termino, p.clave);
      p.incluir = !p.repetida;
    }
    renderizarPropuestas();
    const repetidas = propuestas.filter((p) => p.repetida).length;
    aviso(`La IA propuso ${propuestas.length} términos${repetidas ? ` (${repetidas} repetidos, desmarcados)` : ''}. Revísalos antes de aprobar.`, 'exito');
    seccionPropuestas.scrollIntoView({ block: 'start' });
  } catch (err) {
    aviso(`No se pudo generar con IA: ${err.message}`, 'error');
  } finally {
    cargando(false);
    btnGenerarIa.disabled = false;
  }
}

async function aprobarSeleccionados() {
  const seleccionadas = propuestas.filter((p) => p.incluir);
  if (!seleccionadas.length) return;
  btnAprobarIa.disabled = true;
  let creadas = 0, conErrores = 0;

  for (const p of seleccionadas) {
    p.repetida = motivoRepetida(p.termino, p.clave);
    const errores = erroresPropuesta(p);
    if (p.repetida) errores.unshift(p.repetida.toLowerCase());
    if (errores.length) {
      p.error = errores.join(', ');
      conErrores++;
      continue;
    }
    try {
      const nuevo = await api.crear('glosario', {
        temaId,
        termino: p.termino.trim(),
        definicion: p.definicion.trim(),
        pista: p.pista.trim(),
        retroalimentacion: p.retroalimentacion.trim(),
        origen: 'ia',
        estado: 'aprobado'
      });
      terminosGlosario.push(nuevo);
      propuestas = propuestas.filter((x) => x.clave !== p.clave);
      creadas++;
    } catch (err) {
      p.error = err.message;
      conErrores++;
    }
  }

  // Los que quedan pueden haber pasado a repetir un término recién aprobado
  for (const p of propuestas) {
    p.repetida = motivoRepetida(p.termino, p.clave);
    if (p.repetida) p.incluir = false;
  }
  renderizarGlosario();
  renderizarPropuestas();
  if (creadas) aviso(`${creadas} término${creadas === 1 ? '' : 's'} aprobado${creadas === 1 ? '' : 's'} y agregado${creadas === 1 ? '' : 's'} al glosario.`, 'exito');
  if (conErrores) aviso(`${conErrores} propuesta${conErrores === 1 ? '' : 's'} necesita${conErrores === 1 ? '' : 'n'} corrección: revisa los mensajes en rojo.`, 'error');
}

btnGenerarIa.addEventListener('click', generarConIa);
btnAprobarIa.addEventListener('click', aprobarSeleccionados);
btnDescartarIa.addEventListener('click', async () => {
  if (!(await confirmar('¿Descartar todas las propuestas de la IA sin guardarlas?'))) return;
  propuestas = [];
  renderizarPropuestas();
});

// Aviso al intentar salir con cambios sin guardar
window.addEventListener('beforeunload', (e) => {
  if (hayCambiosSinGuardar) {
    e.preventDefault();
    e.returnValue = '';
  }
});

enlaceVolver.addEventListener('click', async (e) => {
  if (hayCambiosSinGuardar) {
    e.preventDefault();
    const confirma = await confirmar('Tienes cambios sin guardar en la ficha del tema. ¿Deseas salir de todas formas?');
    if (confirma) {
      hayCambiosSinGuardar = false;
      window.location.href = enlaceVolver.href;
    }
  }
});

await cargarDatos();
