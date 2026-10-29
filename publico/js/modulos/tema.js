// publico/js/modulos/tema.js
// Visor interactivo y pedagógico del tema de estudio para estudiantes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { aviso, escapar } from '../nucleo/ui.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Estudio del Tema", roles: ["sesion"] });

const temaId = util.parametro('id');
const esEstudiante = usuarioActual()?.rol === 'estudiante';
// El tutor IA es solo para estudiantes
const actividadesVisibles = ACTIVIDADES.filter((a) => a.id !== 'tutor' || esEstudiante);

// Botón "Pregunta al tutor" junto a "Marcar como revisado"
if (esEstudiante && temaId) {
  const botonTutor = document.createElement('a');
  botonTutor.className = 'btn btn--secundario';
  botonTutor.href = `/paginas/tutor.html?temaId=${encodeURIComponent(temaId)}`;
  botonTutor.textContent = '🦉 Pregunta al tutor';
  document.querySelector('.tema-estudio-cabecera__accion-revisado')?.append(botonTutor);
}

const contenedorCargando = document.getElementById('tema-cargando');
const contenedorEstudio = document.getElementById('tema-contenido-estudio');

// Migas de pan
const migaAsig = document.getElementById('miga-asig');
const migaUni = document.getElementById('miga-uni');
const migaTema = document.getElementById('miga-tema');

// Cabecera
const badgeDificultad = document.getElementById('badge-dificultad');
const badgeEstado = document.getElementById('badge-estado');
const tituloPrincipal = document.getElementById('tema-titulo-principal');
const btnMarcarRevisado = document.getElementById('btn-marcar-revisado');

// Secciones
const resumenCuerpo = document.getElementById('tema-resumen-cuerpo');
const objetivosLista = document.getElementById('tema-objetivos-lista');

const seccionEjemplos = document.getElementById('seccion-ejemplos');
const ejemplosLista = document.getElementById('tema-ejemplos-lista');
const seccionPrecauciones = document.getElementById('seccion-precauciones');
const precaucionesLista = document.getElementById('tema-precauciones-lista');
const seccionReflexion = document.getElementById('seccion-reflexion');
const reflexionLista = document.getElementById('tema-reflexion-lista');

const seccionRecursos = document.getElementById('seccion-recursos');
const recursosLista = document.getElementById('tema-recursos-lista');
const seccionFuentes = document.getElementById('seccion-fuentes');
const fuentesCuerpo = document.getElementById('tema-fuentes');

const actividadesContenedor = document.getElementById('tema-actividades-contenedor');

/**
 * Detecta y convierte URLs de YouTube o Vimeo a URLs aptas para inserción en iframe.
 */
function resolverVideoEmbed(url) {
  if (!url) return null;

  // YouTube (youtube.com, youtu.be, embed)
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
  if (vmMatch) {
    const videoId = vmMatch[3] || vmMatch[1];
    return `https://player.vimeo.com/video/${videoId}`;
  }

  return null;
}

/**
 * Carga el tema y sus dependencias (unidad, asignatura, progreso).
 */
async function cargarTema() {
  if (!temaId) {
    contenedorCargando.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Identificador de tema no especificado (?id=...).
        <div style="margin-top: var(--espacio-m);">
          <a href="/paginas/asignaturas.html" class="btn btn--primario">Ir a Mis Asignaturas</a>
        </div>
      </div>
    `;
    return;
  }

  try {
    const [tema, progresos] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('progreso-temas')
    ]);

    // Cargar unidad y asignatura
    let unidad = null;
    let asignatura = null;

    if (tema.unidadId) {
      try {
        unidad = await api.obtener('unidades', tema.unidadId);
        if (unidad && unidad.asignaturaId) {
          asignatura = await api.obtener('asignaturas', unidad.asignaturaId);
        }
      } catch (e) {
        // Asignatura/unidad opcionales si hay inconsistencias
      }
    }

    // Configurar migas de pan
    if (asignatura) {
      migaAsig.innerHTML = `<a href="/paginas/asignatura.html?id=${escapar(asignatura.id)}">${escapar(asignatura.nombre)}</a>`;
    } else {
      migaAsig.textContent = 'Asignatura';
    }

    if (unidad) {
      migaUni.innerHTML = `<span>${escapar(unidad.titulo)}</span>`;
    }

    migaTema.textContent = tema.titulo;

    // Encabezado
    tituloPrincipal.textContent = tema.titulo;
    badgeDificultad.textContent = (tema.dificultad || 'Intermedio').toUpperCase();
    if (tema.estado === 'borrador') {
      badgeEstado.hidden = false;
      badgeEstado.className = 'insignia insignia--acento';
      badgeEstado.textContent = 'BORRADOR';
    }

    // Estado revisado
    const estaRevisado = (progresos || []).some((p) => p.temaId === temaId);
    actualizarEstadoBotonRevisado(estaRevisado);

    // Resumen conceptual con util.formatoBasico
    resumenCuerpo.innerHTML = util.formatoBasico(tema.resumen || 'Sin resumen conceptual registrado.');

    // Objetivos
    if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
      objetivosLista.innerHTML = `<ul>${tema.objetivos.map((o) => `<li>${escapar(o)}</li>`).join('')}</ul>`;
    } else {
      objetivosLista.innerHTML = '<p style="color: var(--color-texto-suave);">No hay objetivos registrados.</p>';
    }

    // Ejemplos
    if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
      seccionEjemplos.style.display = 'block';
      ejemplosLista.innerHTML = `<ul>${tema.ejemplos.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`;
    }

    if (Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0) {
      seccionPrecauciones.hidden = false;
      precaucionesLista.innerHTML = `<ul>${tema.erroresFrecuentes.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`;
    }

    if (Array.isArray(tema.preguntasGuia) && tema.preguntasGuia.length > 0) {
      seccionReflexion.hidden = false;
      reflexionLista.innerHTML = `<ol>${tema.preguntasGuia.map((p) => `<li>${escapar(p)}</li>`).join('')}</ol>`;
    }

    // Recursos didácticos (YouTube/Vimeo en iframe, PDF como enlace, imágenes con alt)
    if (Array.isArray(tema.recursos) && tema.recursos.length > 0) {
      seccionRecursos.style.display = 'block';
      recursosLista.innerHTML = tema.recursos.map((r) => {
        const url = (r.url || '').trim();
        const tipo = (r.tipo || '').toLowerCase();
        const embedVideoUrl = resolverVideoEmbed(url);

        if (r.estado === 'pendiente' || !url) {
          return `
            <article class="recurso-pendiente" role="status">
              <div><span class="insignia insignia--acento">Pendiente de integración</span></div>
              <h4>${escapar(r.titulo || 'Recurso audiovisual')}</h4>
              <p>${escapar(r.detalle || 'El archivo todavía no está disponible. No se presenta un reproductor hasta contar con el recurso verificable.')}</p>
            </article>
          `;
        }

        if (embedVideoUrl) {
          return `
            <div class="recurso-video-tarjeta">
              <h4>${escapar(r.titulo || 'Video interactivo')}</h4>
              <div class="video-contenedor-responsive">
                <iframe src="${escapar(embedVideoUrl)}" title="${escapar(r.titulo || 'Video educativo')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
              </div>
            </div>
          `;
        }

        if (tipo === 'pdf' || url.toLowerCase().endsWith('.pdf')) {
          return `
            <div style="margin-bottom: var(--espacio-xs);">
              <a href="${escapar(url)}" target="_blank" rel="noopener noreferrer" class="recurso-enlace-pdf">
                <span class="insignia insignia--primario">PDF</span>
                <span>${escapar(r.titulo || 'Descargar material en PDF')} ↗</span>
              </a>
            </div>
          `;
        }

        if (tipo === 'imagen' || /\.(jpg|jpeg|png|webp|svg)($|\?)/i.test(url)) {
          return `
            <figure class="recurso-figura">
              <img src="${escapar(url)}" alt="${escapar(r.titulo || 'Ilustración o diagrama del tema')}" class="recurso-imagen">
              ${r.titulo ? `<figcaption>${escapar(r.titulo)}</figcaption>` : ''}
            </figure>
          `;
        }

        if (tipo === 'audio' || /\.(mp3|ogg|wav)($|\?)/i.test(url)) {
          return `
            <div class="recurso-video-tarjeta">
              <h4>${escapar(r.titulo || 'Audio didáctico')}</h4>
              <audio controls src="${escapar(url)}" style="width: 100%;"></audio>
            </div>
          `;
        }

        if (tipo === 'actividad' && url.startsWith('/')) {
          return `
            <article class="recurso-actividad-tarjeta">
              <span class="insignia insignia--exito">Interactivo</span>
              <h4>${escapar(r.titulo || 'Actividad interactiva')}</h4>
              <a href="${escapar(url)}" class="btn btn--primario">Abrir recurso interactivo</a>
            </article>
          `;
        }

        const esInterno = url.startsWith('/');
        return `
          <div style="margin-bottom: var(--espacio-xs);">
            <a href="${escapar(url)}"${esInterno ? '' : ' target="_blank" rel="noopener noreferrer"'} class="btn btn--texto">
              🔗 ${escapar(r.titulo || url)}${esInterno ? '' : ' ↗'}
            </a>
          </div>
        `;
      }).join('');
    }

    if (tema.fuentes) {
      seccionFuentes.hidden = false;
      fuentesCuerpo.innerHTML = util.formatoBasico(tema.fuentes);
    }

    // Bloque: Practica este tema (con ACTIVIDADES)
    if (actividadesVisibles.length > 0) {
      actividadesContenedor.innerHTML = actividadesVisibles.map((act) => `
        <a href="${escapar(act.href)}?temaId=${escapar(temaId)}" class="actividad-enlace-tarjeta">
          <h4>${escapar(act.texto)}</h4>
          <p>${escapar(act.descripcion || 'Pon a prueba tus conocimientos en esta actividad.')}</p>
        </a>
      `).join('');
    } else {
      actividadesContenedor.innerHTML = `
        <div style="grid-column: 1 / -1; padding: var(--espacio-m); background-color: var(--color-superficie); border-radius: var(--radio-m); border: 1px dashed var(--color-borde); color: var(--color-texto-suave); font-size: var(--tamano-s); text-align: center;">
          Próximamente habrá actividades interactivas y desafíos lúdicos disponibles para este tema.
        </div>
      `;
    }

    // Guardar en localStorage el último tema consultado
    try {
      localStorage.setItem('ultimoTema', JSON.stringify({
        id: tema.id,
        titulo: tema.titulo
      }));
    } catch (e) {
      // Ignorar restricciones en entornos privados
    }

    contenedorCargando.style.display = 'none';
    contenedorEstudio.style.display = 'block';
  } catch (err) {
    contenedorCargando.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Error al cargar los datos del tema: ${escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Actualiza la apariencia y estado del botón de revisión.
 */
function actualizarEstadoBotonRevisado(estaRevisado) {
  if (estaRevisado) {
    btnMarcarRevisado.className = 'btn btn--revisado-listo';
    btnMarcarRevisado.textContent = 'Revisado ✓';
    btnMarcarRevisado.disabled = true;
    btnMarcarRevisado.setAttribute('aria-pressed', 'true');
  } else {
    btnMarcarRevisado.className = 'btn btn--primario';
    btnMarcarRevisado.textContent = 'Marcar como revisado';
    btnMarcarRevisado.disabled = false;
    btnMarcarRevisado.setAttribute('aria-pressed', 'false');
  }
}

// Evento: Marcar como revisado
btnMarcarRevisado.addEventListener('click', async () => {
  if (btnMarcarRevisado.disabled) return;

  btnMarcarRevisado.disabled = true;
  btnMarcarRevisado.textContent = 'Guardando avance...';

  try {
    await api.crear('progreso-temas', { temaId });
    actualizarEstadoBotonRevisado(true);
    aviso('¡Tema registrado como revisado! Has avanzado en tu progreso.', 'exito');

    // Registro de gamificación por tema revisado
    try {
      await registrarIntento({ actividad: 'tema-revisado', temaId, puntaje: 1, maximo: 1, errores: 0 });
    } catch (eGamif) {
      console.warn('Registro de gamificación para tema revisado:', eGamif);
    }
  } catch (err) {
    // Si ya existe u otro error
    if (err.message && err.message.includes('previamente')) {
      actualizarEstadoBotonRevisado(true);
    } else {
      aviso(err.message || 'Error al registrar progreso.', 'error');
      btnMarcarRevisado.disabled = false;
      btnMarcarRevisado.textContent = 'Marcar como revisado';
    }
  }
});

await cargarTema();
