// publico/js/modulos/canciones.js
// Lógica para catálogo de canciones, reproductor personalizado y sincronización LRC

import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';
import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: 'Canciones Educativas', roles: ['sesion'] });

const temaIdParam = util.parametro('temaId');
const cancionIdParam = util.parametro('cancionId');
const usuario = sesion.usuarioActual();

// Elementos del DOM
const zonaAccionDocente = document.getElementById('zonaAccionDocente');
const filtroAsignatura = document.getElementById('filtroAsignatura');
const filtroTema = document.getElementById('filtroTema');
const filtroTexto = document.getElementById('filtroTexto');
const estadoCargando = document.getElementById('estadoCargando');
const panelPrincipalCanciones = document.getElementById('panelPrincipalCanciones');
const contadorCanciones = document.getElementById('contadorCanciones');
const contenedorListaCanciones = document.getElementById('contenedorListaCanciones');
const sinCanciones = document.getElementById('sinCanciones');

// Elementos del Reproductor
const audioNativo = document.getElementById('audioNativo');
const reproductorVacio = document.getElementById('reproductorVacio');
const reproductorActivo = document.getElementById('reproductorActivo');
const cancionTemaBadge = document.getElementById('cancionTemaBadge');
const cancionTitulo = document.getElementById('cancionTitulo');
const cancionAutoria = document.getElementById('cancionAutoria');
const cancionLicencia = document.getElementById('cancionLicencia');
const btnEditarCancionActiva = document.getElementById('btnEditarCancionActiva');
const enlaceEditarCancion = document.getElementById('enlaceEditarCancion');

const btnPlayPause = document.getElementById('btnPlayPause');
const iconoPlayPause = document.getElementById('iconoPlayPause');
const btnRetroceder10 = document.getElementById('btnRetroceder10');
const btnAdelantar10 = document.getElementById('btnAdelantar10');
const barraProgreso = document.getElementById('barraProgreso');
const tiempoActual = document.getElementById('tiempoActual');
const tiempoTotal = document.getElementById('tiempoTotal');
const btnMute = document.getElementById('btnMute');
const iconoVolumen = document.getElementById('iconoVolumen');
const barraVolumen = document.getElementById('barraVolumen');

const badgeModoLetra = document.getElementById('badgeModoLetra');
const cajaLetra = document.getElementById('cajaLetra');

// Estado en memoria
let asignaturas = [];
let unidades = [];
let temas = [];
let canciones = [];
let cancionActual = null;
let lineasLrc = [];
let indiceLrcActivo = -1;
let arrastrandoSlider = false;
let cancionPrincipalId = null;

// Ningún audio comienza a sonar y el primer gesto del usuario decide el volumen.
audioNativo.muted = true;
iconoVolumen.textContent = '🔇';
barraVolumen.value = 0;

// Comprobar rol docente/admin para mostrar botón de creación
if (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) {
  zonaAccionDocente.style.display = 'block';
}

/**
 * Formatea segundos en formato mm:ss
 */
function formatearTiempo(segundos) {
  if (isNaN(segundos) || segundos < 0) return '00:00';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parsea contenido en formato LRC estándar [mm:ss.xx]
 */
function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== 'string') return [];
  const lineas = lrcTexto.split('\n');
  const resultado = [];

  const regexLrc = /\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\](.*)/;

  for (const linea of lineas) {
    const coincidencia = linea.match(regexLrc);
    if (coincidencia) {
      const min = parseInt(coincidencia[1], 10);
      const sec = parseFloat(coincidencia[2]);
      const tiempoSeg = min * 60 + sec;
      const texto = coincidencia[3].trim();
      resultado.push({
        tiempo: tiempoSeg,
        texto: texto
      });
    }
  }

  resultado.sort((a, b) => a.tiempo - b.tiempo);
  return resultado;
}

/**
 * Carga inicial de datos
 */
async function inicializar() {
  try {
    const [listaAsig, listaUni, listaTemas, listaCanciones, presentacion] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('canciones'),
      api.llamar('GET', '/api/neuroritmo/presentacion')
    ]);

    asignaturas = listaAsig || [];
    unidades = listaUni || [];
    temas = listaTemas || [];
    canciones = listaCanciones || [];
    cancionPrincipalId = presentacion?.experiencia?.cancionPrincipal?.id || null;

    // Llenar selector de Asignaturas
    filtroAsignatura.innerHTML = '<option value="">Todas las asignaturas</option>' +
      asignaturas.map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)}</option>`).join('');

    // Si viene temaIdParam en la URL, resolver su asignatura y preseleccionarlo
    if (temaIdParam) {
      const temaObjetivo = temas.find((t) => t.id === temaIdParam);
      if (temaObjetivo) {
        const uni = unidades.find((u) => u.id === temaObjetivo.unidadId);
        if (uni) {
          filtroAsignatura.value = uni.asignaturaId;
          actualizarSelectorTemas(uni.asignaturaId, temaIdParam);
        }
      }
    } else {
      actualizarSelectorTemas('');
    }

    renderizarCatalogo();

    // Un enlace a la canción principal selecciona exactamente su registro, siempre en pausa.
    if (cancionIdParam && canciones.some((c) => c.id === cancionIdParam)) {
      seleccionarCancion(canciones.find((c) => c.id === cancionIdParam), false);
    } else if (temaIdParam) {
      const primeraDelTema = canciones.find((c) => c.temaId === temaIdParam);
      if (primeraDelTema) {
        seleccionarCancion(primeraDelTema, false);
      }
    } else if (canciones.length > 0) {
      // Preseleccionar la primera canción en el reproductor (en pausa)
      seleccionarCancion(canciones[0], false);
    }

    estadoCargando.style.display = 'none';
    panelPrincipalCanciones.style.display = 'grid';
  } catch (err) {
    estadoCargando.innerHTML = `
      <div style="color: var(--color-error);">
        Error al cargar los datos del catálogo de canciones: ${ui.escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Actualiza el selector de temas según la asignatura elegida
 */
function actualizarSelectorTemas(asignaturaId, temaSeleccionadoId = null) {
  let temasDisponibles = temas;

  if (asignaturaId) {
    const idsUnidades = unidades
      .filter((u) => u.asignaturaId === asignaturaId)
      .map((u) => u.id);
    temasDisponibles = temas.filter((t) => idsUnidades.includes(t.unidadId));
  }

  filtroTema.innerHTML = '<option value="">Todos los temas</option>' +
    temasDisponibles.map((t) => {
      const sel = t.id === temaSeleccionadoId ? 'selected' : '';
      return `<option value="${ui.escapar(t.id)}" ${sel}>${ui.escapar(t.titulo)}</option>`;
    }).join('');
}

/**
 * Filtra y renderiza la lista de canciones en tarjetas
 */
function renderizarCatalogo() {
  const asigId = filtroAsignatura.value;
  const tId = filtroTema.value;
  const busqueda = (filtroTexto.value || '').trim().toLowerCase();

  const filtradas = canciones.filter((c) => {
    // Filtro por tema
    if (tId && c.temaId !== tId) return false;

    // Filtro por asignatura (a través del tema)
    if (asigId) {
      const tema = temas.find((t) => t.id === c.temaId);
      if (!tema) return false;
      const uni = unidades.find((u) => u.id === tema.unidadId);
      if (!uni || uni.asignaturaId !== asigId) return false;
    }

    // Filtro por texto
    if (busqueda) {
      const coincideTitulo = (c.titulo || '').toLowerCase().includes(busqueda);
      const coincideAutor = (c.autoria || '').toLowerCase().includes(busqueda);
      if (!coincideTitulo && !coincideAutor) return false;
    }

    return true;
  });

  contadorCanciones.textContent = `Repertorio (${filtradas.length})`;

  if (filtradas.length === 0) {
    contenedorListaCanciones.innerHTML = '';
    sinCanciones.style.display = 'flex';
    return;
  }

  sinCanciones.style.display = 'none';

  contenedorListaCanciones.innerHTML = filtradas.map((c) => {
    const tema = temas.find((t) => t.id === c.temaId);
    const uni = tema ? unidades.find((u) => u.id === tema.unidadId) : null;
    const asig = uni ? asignaturas.find((a) => a.id === uni.asignaturaId) : null;

    const esActiva = cancionActual && cancionActual.id === c.id;
    const claseActiva = esActiva ? 'cancion-tarjeta--activa' : '';

    const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

    return `
      <article class="cancion-tarjeta ${claseActiva}" data-id="${ui.escapar(c.id)}">
        <div class="cancion-tarjeta__encabezado">
          <div>
            <h3 class="cancion-tarjeta__titulo">${ui.escapar(c.titulo)}</h3>
            <div class="cancion-tarjeta__meta">
              <span>📖 ${ui.escapar(tema ? tema.titulo : 'Tema')}</span>
              ${asig ? `<span>• 🎓 ${ui.escapar(asig.nombre)}</span>` : ''}
            </div>
          </div>
          <span class="insignia insignia--secundario">${ui.escapar(c.licencia || 'Licencia')}</span>
          ${c.id === cancionPrincipalId ? '<span class="insignia insignia--exito">Canción principal</span>' : ''}
        </div>

        <div class="cancion-tarjeta__meta">
          <span>✍ Autoría: ${ui.escapar(c.autoria || 'No especificada')}</span>
        </div>

        <div class="cancion-tarjeta__pie">
          <div class="cancion-tarjeta__acciones">
            <button type="button" class="btn btn--primario btn--sm btn-reproducir-tarjeta" data-id="${ui.escapar(c.id)}">
              ${esActiva && !audioNativo.paused ? '⏸ En reproducción' : '▶ Escuchar'}
            </button>
            ${esDocenteOAdmin ? `
              <a href="/paginas/editor-cancion.html?id=${ui.escapar(c.id)}" class="btn btn--secundario btn--sm">
                ✏ Editar
              </a>
            ` : ''}
          </div>
          ${c.lrc ? '<span class="insignia insignia--exito" title="Incluye letra sincronizada con el compás">LRC ✓</span>' : ''}
        </div>
      </article>
    `;
  }).join('');

  // Vincular eventos a los botones de reproducir de cada tarjeta
  contenedorListaCanciones.querySelectorAll('.btn-reproducir-tarjeta').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const cancion = canciones.find((item) => item.id === id);
      if (cancion) {
        if (cancionActual && cancionActual.id === cancion.id) {
          // Toggle play/pause
          if (audioNativo.paused) {
            audioNativo.play();
          } else {
            audioNativo.pause();
          }
        } else {
          seleccionarCancion(cancion, true);
        }
      }
    });
  });
}

/**
 * Selecciona una canción y la carga en el reproductor
 */
function seleccionarCancion(cancion, reproducirInmediatamente = false) {
  cancionActual = cancion;
  indiceLrcActivo = -1;

  // Actualizar metadatos del reproductor
  cancionTitulo.textContent = cancion.titulo;
  cancionAutoria.textContent = `Autor: ${cancion.autoria || 'No especificada'}`;
  cancionLicencia.textContent = cancion.licencia || 'Licencia libre';

  const tema = temas.find((t) => t.id === cancion.temaId);
  cancionTemaBadge.textContent = tema ? tema.titulo : 'Tema didáctico';

  // Opción de edición si es docente/admin
  if (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) {
    btnEditarCancionActiva.style.display = 'block';
    enlaceEditarCancion.href = `/paginas/editor-cancion.html?id=${encodeURIComponent(cancion.id)}`;
  } else {
    btnEditarCancionActiva.style.display = 'none';
  }

  // Cargar audio
  audioNativo.src = cancion.audio;
  barraProgreso.value = 0;
  tiempoActual.textContent = '00:00';

  // Procesar Letra (LRC o plana)
  lineasLrc = parsearLRC(cancion.lrc);

  if (lineasLrc.length > 0) {
    badgeModoLetra.className = 'insignia insignia--exito';
    badgeModoLetra.textContent = 'LRC Sincronizado';

    cajaLetra.innerHTML = lineasLrc.map((linea, index) => `
      <div class="linea-lrc" data-idx="${index}" data-tiempo="${linea.tiempo}">
        ${ui.escapar(linea.texto || '♪ ♪ ♪')}
      </div>
    `).join('');

    // Permitir clic en cada línea para saltar el audio
    cajaLetra.querySelectorAll('.linea-lrc').forEach((el) => {
      el.addEventListener('click', () => {
        const seg = parseFloat(el.getAttribute('data-tiempo'));
        if (!isNaN(seg)) {
          audioNativo.currentTime = seg;
          if (audioNativo.paused) {
            audioNativo.play();
          }
        }
      });
    });
  } else if (cancion.letra && cancion.letra.trim()) {
    badgeModoLetra.className = 'insignia insignia--secundario';
    badgeModoLetra.textContent = 'Texto plano';
    cajaLetra.innerHTML = `<div class="letra-plana-texto">${ui.escapar(cancion.letra)}</div>`;
  } else {
    badgeModoLetra.className = 'insignia insignia--suave';
    badgeModoLetra.textContent = 'Sin letra';
    cajaLetra.innerHTML = '<div class="letra-vacia-mensaje">Esta canción no dispone de letra registrada.</div>';
  }

  reproductorVacio.style.display = 'none';
  reproductorActivo.style.display = 'block';

  // Resaltar tarjeta activa en la lista
  actualizarTarjetasActivas();

  if (reproducirInmediatamente) {
    audioNativo.play().catch((e) => {
      console.warn('Autoplay bloqueado por el navegador:', e);
    });
  }
}

/**
 * Marca la tarjeta activa en la vista de lista
 */
function actualizarTarjetasActivas() {
  document.querySelectorAll('.cancion-tarjeta').forEach((tarjeta) => {
    const id = tarjeta.getAttribute('data-id');
    const btn = tarjeta.querySelector('.btn-reproducir-tarjeta');
    if (cancionActual && id === cancionActual.id) {
      tarjeta.classList.add('cancion-tarjeta--activa');
      if (btn) {
        btn.textContent = !audioNativo.paused ? '⏸ En reproducción' : '▶ Reanudar';
      }
    } else {
      tarjeta.classList.remove('cancion-tarjeta--activa');
      if (btn) {
        btn.textContent = '▶ Escuchar';
      }
    }
  });
}

// ============================================================================
// Eventos del Reproductor de Audio
// ============================================================================

// Actualización de duración total
audioNativo.addEventListener('loadedmetadata', () => {
  tiempoTotal.textContent = formatearTiempo(audioNativo.duration || 0);
});

// Actualización en tiempo real del progreso y letra LRC
audioNativo.addEventListener('timeupdate', () => {
  const actual = audioNativo.currentTime;
  const duracion = audioNativo.duration;

  tiempoActual.textContent = formatearTiempo(actual);

  if (!arrastrandoSlider && duracion) {
    barraProgreso.value = (actual / duracion) * 100;
  }

  // Sincronización LRC
  if (lineasLrc.length > 0) {
    // Buscar la línea correspondiente al tiempo actual
    let nuevoIndice = -1;
    for (let i = 0; i < lineasLrc.length; i++) {
      if (actual >= lineasLrc[i].tiempo) {
        nuevoIndice = i;
      } else {
        break;
      }
    }

    if (nuevoIndice !== indiceLrcActivo) {
      const elementosLinea = cajaLetra.querySelectorAll('.linea-lrc');
      
      if (indiceLrcActivo >= 0 && elementosLinea[indiceLrcActivo]) {
        elementosLinea[indiceLrcActivo].classList.remove('linea-lrc--activa');
      }

      if (nuevoIndice >= 0 && elementosLinea[nuevoIndice]) {
        const lineaElemento = elementosLinea[nuevoIndice];
        lineaElemento.classList.add('linea-lrc--activa');
        lineaElemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      indiceLrcActivo = nuevoIndice;
    }
  }
});

// Eventos de reproducción y pausa
audioNativo.addEventListener('play', () => {
  iconoPlayPause.textContent = '⏸';
  btnPlayPause.setAttribute('aria-label', 'Pausar');
  actualizarTarjetasActivas();
});

audioNativo.addEventListener('pause', () => {
  iconoPlayPause.textContent = '▶';
  btnPlayPause.setAttribute('aria-label', 'Reproducir');
  actualizarTarjetasActivas();
});

audioNativo.addEventListener('ended', () => {
  iconoPlayPause.textContent = '▶';
  btnPlayPause.setAttribute('aria-label', 'Reproducir');
  barraProgreso.value = 0;
  tiempoActual.textContent = '00:00';
  actualizarTarjetasActivas();
});

// Botón Play / Pause
btnPlayPause.addEventListener('click', () => {
  if (!audioNativo.src) return;
  if (audioNativo.paused) {
    audioNativo.play();
  } else {
    audioNativo.pause();
  }
});

// Botones de salto +/- 10s
btnRetroceder10.addEventListener('click', () => {
  audioNativo.currentTime = Math.max(0, audioNativo.currentTime - 10);
});

btnAdelantar10.addEventListener('click', () => {
  if (audioNativo.duration) {
    audioNativo.currentTime = Math.min(audioNativo.duration, audioNativo.currentTime + 10);
  }
});

// Control de Barra de Progreso
barraProgreso.addEventListener('mousedown', () => { arrastrandoSlider = true; });
barraProgreso.addEventListener('touchstart', () => { arrastrandoSlider = true; }, { passive: true });

barraProgreso.addEventListener('input', () => {
  if (audioNativo.duration) {
    const tiempo = (barraProgreso.value / 100) * audioNativo.duration;
    tiempoActual.textContent = formatearTiempo(tiempo);
  }
});

barraProgreso.addEventListener('change', () => {
  arrastrandoSlider = false;
  if (audioNativo.duration) {
    audioNativo.currentTime = (barraProgreso.value / 100) * audioNativo.duration;
  }
});

// Control de Volumen
barraVolumen.addEventListener('input', () => {
  const vol = parseFloat(barraVolumen.value);
  audioNativo.volume = vol;
  if (vol === 0) {
    iconoVolumen.textContent = '🔇';
  } else if (vol < 0.5) {
    iconoVolumen.textContent = '🔉';
  } else {
    iconoVolumen.textContent = '🔊';
  }
  audioNativo.muted = vol === 0;
});

btnMute.addEventListener('click', () => {
  audioNativo.muted = !audioNativo.muted;
  if (audioNativo.muted) {
    iconoVolumen.textContent = '🔇';
    barraVolumen.value = 0;
  } else {
    iconoVolumen.textContent = audioNativo.volume < 0.5 ? '🔉' : '🔊';
    barraVolumen.value = audioNativo.volume;
  }
});

// ============================================================================
// Eventos de Filtros
// ============================================================================

filtroAsignatura.addEventListener('change', () => {
  actualizarSelectorTemas(filtroAsignatura.value);
  renderizarCatalogo();
});

filtroTema.addEventListener('change', () => {
  renderizarCatalogo();
});

filtroTexto.addEventListener('input', () => {
  renderizarCatalogo();
});

await inicializar();
