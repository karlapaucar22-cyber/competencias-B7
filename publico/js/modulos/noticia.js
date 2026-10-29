// publico/js/modulos/noticia.js
// Detalle de noticia y registro automático de lectura

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Noticia", roles: ["sesion"] });

const noticiaId = util.parametro('id');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const cargandoEl = document.getElementById('noticia-cargando');
const articuloEl = document.getElementById('noticia-articulo');

const categoriaBadge = document.getElementById('noticia-categoria-badge');
const destacadaBadge = document.getElementById('noticia-destacada-badge');
const fechaEl = document.getElementById('noticia-fecha');
const accionEditar = document.getElementById('noticia-accion-editar');
const enlaceEditar = document.getElementById('enlace-editar-noticia');

const tituloEl = document.getElementById('noticia-titulo');
const resumenEl = document.getElementById('noticia-resumen');

const imagenCaja = document.getElementById('noticia-imagen-contenedor');
const imagenEl = document.getElementById('noticia-imagen');

const cuerpoEl = document.getElementById('noticia-cuerpo');

const pieTema = document.getElementById('noticia-pie-tema');
const enlaceTema = document.getElementById('enlace-tema-relacionado');

/**
 * Carga los detalles de la noticia y registra la lectura si es la primera vez.
 */
async function cargarNoticia() {
  if (!noticiaId) {
    cargandoEl.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Identificador de noticia no especificado (?id=...).
        <div style="margin-top: var(--espacio-m);">
          <a href="/paginas/noticias.html" class="btn btn--primario">Volver al catálogo de noticias</a>
        </div>
      </div>
    `;
    return;
  }

  try {
    const noticia = await api.obtener('noticias', noticiaId);

    // Meta y cabecera
    categoriaBadge.textContent = noticia.categoria || 'Institucional';
    if (noticia.destacada) {
      destacadaBadge.style.display = 'inline-flex';
    }

    const fechaTexto = util.fechaLarga(noticia.fechaPublicacion || noticia.fecha);
    fechaEl.textContent = `· Publicado el ${fechaTexto}`;

    if (esDocenteOAdmin) {
      accionEditar.style.display = 'block';
      enlaceEditar.href = `/paginas/editor-noticia.html?id=${escapar(noticia.id)}`;
    }

    tituloEl.textContent = noticia.titulo;
    resumenEl.textContent = noticia.resumen || '';

    // Imagen destacada
    if (noticia.imagen) {
      imagenEl.src = noticia.imagen;
      imagenEl.alt = noticia.titulo || 'Imagen de la noticia';
      imagenCaja.style.display = 'block';
    }

    // Cuerpo con formato seguro
    cuerpoEl.innerHTML = util.formatoBasico(noticia.cuerpo || '');

    // Tema curricular relacionado opcional
    if (noticia.temaId) {
      try {
        const tema = await api.obtener('temas', noticia.temaId);
        if (tema) {
          enlaceTema.textContent = `Explorar: ${tema.titulo} →`;
          enlaceTema.href = `/paginas/tema.html?id=${escapar(tema.id)}`;
          pieTema.style.display = 'block';
        }
      } catch (e) {
        // Ignorar si el tema no existe
      }
    }

    cargandoEl.style.display = 'none';
    articuloEl.style.display = 'flex';

    // Registrar lectura en lecturas-noticias si aún no existe
    registrarLecturaSiNoExiste();
  } catch (err) {
    cargandoEl.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Error al cargar la noticia: ${escapar(err.message)}
        <div style="margin-top: var(--espacio-m);">
          <a href="/paginas/noticias.html" class="btn btn--secundario">Volver a Noticias</a>
        </div>
      </div>
    `;
  }
}

/**
 * Consulta si la noticia ya fue leída; si no, registra el acceso en lecturas-noticias.
 */
async function registrarLecturaSiNoExiste() {
  if (!usuario) return;

  try {
    const lecturas = await api.listar('lecturas-noticias');
    const yaLeida = (lecturas || []).some((l) => l.noticiaId === noticiaId);

    if (!yaLeida) {
      await api.crear('lecturas-noticias', { noticiaId });
    }
  } catch (err) {
    // Silencioso para no interrumpir la experiencia de lectura
  }
}

await cargarNoticia();
