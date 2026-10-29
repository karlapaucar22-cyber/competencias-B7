// publico/js/modulos/noticias.js
// Catálogo y visualización paginada de noticias con filtros y marcas de lectura

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Noticias y Novedades", roles: ["sesion"] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const accionesDocenteAdmin = document.getElementById('acciones-docente-admin');
const inputBuscar = document.getElementById('buscar-noticia');
const selectCategoria = document.getElementById('filtro-categoria');
const selectTema = document.getElementById('filtro-tema');

const gridNoticias = document.getElementById('grid-noticias');
const navPaginacion = document.getElementById('nav-paginacion');
const btnAnterior = document.getElementById('btn-pagina-anterior');
const btnSiguiente = document.getElementById('btn-pagina-siguiente');
const indicadorPagina = document.getElementById('indicador-pagina');

let todasLasNoticias = [];
let idsLecturas = new Set();
let mapaTemas = new Map();

const ELEMENTOS_POR_PAGINA = 9;
let paginaActual = 1;

/**
 * Inicializa el catálogo cargando noticias, lecturas del usuario y temas curriculares.
 */
async function iniciar() {
  if (esDocenteOAdmin) {
    accionesDocenteAdmin.style.display = 'block';
  }

  try {
    const [noticias, lecturas, temas] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    todasLasNoticias = Array.isArray(noticias) ? noticias : [];
    idsLecturas = new Set((lecturas || []).map((l) => l.noticiaId));
    mapaTemas = new Map((temas || []).map((t) => [t.id, t.titulo]));

    // Llenar selector de temas
    (temas || []).forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selectTema.appendChild(opt);
    });

    renderizarNoticias();
  } catch (err) {
    gridNoticias.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl); grid-column: 1 / -1;">
        Error al cargar las noticias: ${escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Filtra, ordena y pagina las noticias para mostrarlas en la cuadrícula.
 */
function renderizarNoticias() {
  const termino = (inputBuscar.value || '').trim().toLowerCase();
  const categoriaFiltro = selectCategoria.value;
  const temaFiltro = selectTema.value;

  // 1. Filtrado
  const filtradas = todasLasNoticias.filter((n) => {
    if (categoriaFiltro && n.categoria !== categoriaFiltro) return false;
    if (temaFiltro && n.temaId !== temaFiltro) return false;

    if (termino) {
      const tit = (n.titulo || '').toLowerCase();
      const res = (n.resumen || '').toLowerCase();
      const cue = (n.cuerpo || '').toLowerCase();
      if (!tit.includes(termino) && !res.includes(termino) && !cue.includes(termino)) {
        return false;
      }
    }
    return true;
  });

  // 2. Ordenamiento: destacadas primero, luego por fecha más reciente
  filtradas.sort((a, b) => {
    const destA = Boolean(a.destacada);
    const destB = Boolean(b.destacada);
    if (destA !== destB) {
      return destB ? 1 : -1;
    }

    const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fechaB - fechaA;
  });

  if (filtradas.length === 0) {
    gridNoticias.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); grid-column: 1 / -1; color: var(--color-texto-suave);">
        No se encontraron noticias que coincidan con los filtros seleccionados.
      </div>
    `;
    navPaginacion.style.display = 'none';
    return;
  }

  // 3. Paginación
  const totalPaginas = Math.ceil(filtradas.length / ELEMENTOS_POR_PAGINA);
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;
  if (paginaActual < 1) paginaActual = 1;

  const inicioIdx = (paginaActual - 1) * ELEMENTOS_POR_PAGINA;
  const finIdx = inicioIdx + ELEMENTOS_POR_PAGINA;
  const paginaElementos = filtradas.slice(inicioIdx, finIdx);

  // Renderizar tarjetas
  gridNoticias.innerHTML = paginaElementos.map((n) => {
    const esLeida = idsLecturas.has(n.id);
    const badgeNuevo = !esLeida
      ? '<span class="badge-nuevo" title="No has leído esta noticia">Nuevo</span>'
      : '';

    const badgeDestacada = n.destacada
      ? '<span class="insignia insignia--acento">⭐ Destacada</span>'
      : '';

    const badgeEstado = (esDocenteOAdmin && n.estado)
      ? `<span class="insignia" style="font-size: var(--tamano-xs);">${escapar(n.estado)}</span>`
      : '';

    const fechaTexto = util.fechaLarga(n.fechaPublicacion || n.fecha);

    const imagenHtml = n.imagen
      ? `<div class="noticia-tarjeta__imagen-caja"><img src="${escapar(n.imagen)}" alt="" class="noticia-tarjeta__imagen" loading="lazy"></div>`
      : '';

    const botonEditar = esDocenteOAdmin
      ? `<a href="/paginas/editor-noticia.html?id=${escapar(n.id)}" class="btn btn--pequeno btn--secundario">Editar</a>`
      : '';

    return `
      <article class="tarjeta noticia-tarjeta ${n.destacada ? 'noticia-tarjeta--destacada' : ''}" data-id="${escapar(n.id)}">
        ${imagenHtml}

        <div class="noticia-tarjeta__cuerpo-contenido">
          <div class="noticia-tarjeta__meta">
            <span class="insignia insignia--primario">${escapar(n.categoria || 'Institucional')}</span>
            ${badgeDestacada}
            ${badgeNuevo}
            ${badgeEstado}
            <span class="noticia-tarjeta__fecha">· ${escapar(fechaTexto)}</span>
          </div>

          <h2 class="noticia-tarjeta__titulo">${escapar(n.titulo)}</h2>
          <p class="noticia-tarjeta__resumen">${escapar(n.resumen || '')}</p>
        </div>

        <div class="noticia-tarjeta__pie">
          <a href="/paginas/noticia.html?id=${escapar(n.id)}" class="btn btn--pequeno btn--primario">
            Leer noticia →
          </a>
          ${botonEditar}
        </div>
      </article>
    `;
  }).join('');

  // Actualizar controles de paginación
  if (totalPaginas > 1) {
    navPaginacion.style.display = 'flex';
    indicadorPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    btnAnterior.disabled = paginaActual <= 1;
    btnSiguiente.disabled = paginaActual >= totalPaginas;
  } else {
    navPaginacion.style.display = 'none';
  }
}

// Eventos de filtros
inputBuscar.addEventListener('input', () => {
  paginaActual = 1;
  renderizarNoticias();
});

selectCategoria.addEventListener('change', () => {
  paginaActual = 1;
  renderizarNoticias();
});

selectTema.addEventListener('change', () => {
  paginaActual = 1;
  renderizarNoticias();
});

// Eventos de paginación
btnAnterior.addEventListener('click', () => {
  if (paginaActual > 1) {
    paginaActual--;
    renderizarNoticias();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

btnSiguiente.addEventListener('click', () => {
  paginaActual++;
  renderizarNoticias();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

await iniciar();
