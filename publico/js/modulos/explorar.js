// publico/js/modulos/explorar.js
// Explora y aprende: catálogo de asignaturas, unidades y temas con buscador, y noticias destacadas

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, modal, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Explora y aprende', roles: ['publico'] });

const bienvenidaTitulo = document.getElementById('bienvenida-titulo');
const bienvenidaSubtitulo = document.getElementById('bienvenida-subtitulo');
const bienvenidaAcciones = document.getElementById('bienvenida-acciones');

const seccionTemas = document.getElementById('seccion-temas');
const contenedorAsignaturasTemas = document.getElementById('contenedor-asignaturas-temas');
const inputBuscarTemas = document.getElementById('buscar-temas-inicio');
const seccionRuta = document.getElementById('ruta-academica');
const presentacionAcademica = document.getElementById('presentacion-academica');
const seccionRecursos = document.getElementById('seccion-recursos-neuroritmo');
const tarjetasRecursos = document.getElementById('tarjetas-recursos-neuroritmo');

const usuario = usuarioActual();

let todasLasAsignaturas = [];
let todasLasUnidades = [];
let todosLosTemas = [];
let experienciaNeuroritmo = null;

const MULTIMEDIA_TEMAS = Object.freeze({
  tem_000001: {
    tipo: 'video',
    titulo: 'Cómo la Música Entrena las Funciones Ejecutivas',
    url: '/api/recursos-didacticos/funciones-ejecutivas',
    mime: 'video/mp4'
  },
  tem_000002: {
    tipo: 'audio',
    titulo: 'Cómo hackea la música nuestro cerebro',
    url: '/api/recursos-didacticos/musica-cerebro',
    mime: 'audio/mp4'
  }
});

const SUBTEMAS_NEURORITMO = [
  {
    numero: '1.1',
    titulo: 'Procesamiento cerebral y funciones ejecutivas en la escucha y práctica musical',
    objetivo: 'Analizar una situación de estudio considerando procesamiento auditivo, atención, memoria de trabajo y control inhibitorio.',
    explicacion: [
      'Durante el estudio, la atención sostenida mantiene el foco, la memoria de trabajo conserva y manipula información durante un intervalo breve y el control inhibitorio ayuda a apartar estímulos o respuestas que no sirven a la meta.',
      'Los metaanálisis entregados describen efectos pequeños de distracción auditiva durante la lectura, especialmente ante habla inteligible y música con letra. Por eso, escuchar o practicar música no demuestra por sí solo una mejora de la atención, la memoria o el aprendizaje: la condición sonora debe compararse según la tarea y la persona.'
    ],
    aplicacion: 'En una lectura académica exigente, compara silencio con música instrumental suave y de volumen bajo. Registra el tiempo y las ideas principales que puedes explicar sin mirar; una preferencia musical agradable no sustituye esa comprobación.',
    multimedia: MULTIMEDIA_TEMAS.tem_000001,
    temaId: 'tem_000012',
    misiones: [{ id: 'm1', texto: 'Aplicar en Misión 1' }, { id: 'm2', texto: 'Repasar en Misión 2' }]
  },
  {
    numero: '1.2',
    titulo: 'Impacto socioemocional y autorregulación a través de las artes',
    objetivo: 'Justificar una estrategia de música suave, pausa sonora o silencio según el contexto, el estrés percibido y la respuesta individual.',
    explicacion: [
      'El sonido puede acompañar una estrategia de regulación emocional, pero los documentos entregados no respaldan que mejore siempre la concentración, la memoria o el rendimiento. La respuesta depende de la situación, la tarea y diferencias individuales.',
      'Una elección prudente distingue regular la activación de aprender contenido nuevo y usa un indicador observable. Por ejemplo, antes de una exposición se puede comparar la tensión percibida de 1 a 5 antes y después de una breve condición sonora, y detenerla si compite con el repaso verbal.'
    ],
    aplicacion: 'Música suave puede probarse antes del repaso si resulta agradable; una pausa sonora puede servir como transición; y el silencio es preferible si el sonido añade distracción. La elección es una hipótesis para ese momento, no una regla general.',
    multimedia: MULTIMEDIA_TEMAS.tem_000002,
    temaId: 'tem_000013',
    misiones: [{ id: 'm1', texto: 'Aplicar en Misión 1' }, { id: 'm3', texto: 'Diseñar en Misión 3' }]
  }
];

const UTILIDAD_RECURSOS = {
  screencast: 'Introduce el procesamiento musical y ayuda a diferenciar las funciones ejecutivas del subtema 1.1.',
  infografia: 'Relaciona sonido, experiencia emocional y autorregulación para revisar el subtema 1.2.'
};

const RECURSOS_SIN_ACCESO = new Set(['matriz']);

// Listas de texto tolerantes a datos mal formados (un tema dañado no rompe el catálogo)
const comoLista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
// Solo enlaces http(s) o rutas internas: evita javascript: y data:
const urlSegura = (url) => (/^(https?:\/\/|\/(?!\/))/i.test(String(url || '').trim()) ? String(url).trim() : '');

/**
 * Inicializa la página adaptándose al estado de sesión del usuario.
 */
async function inicializar() {
  await cargarPresentacionAcademica();

  if (!usuario) {
    // Usuario no autenticado (público): sin catálogo que buscar
    inputBuscarTemas.closest('.campo').hidden = true;
    bienvenidaTitulo.textContent = 'Explora y aprende';
    bienvenidaSubtitulo.textContent = 'Catálogo de asignaturas, unidades y temas de NeuroRitmo Digital. Inicia sesión para acceder a tus temas de estudio.';

    bienvenidaAcciones.innerHTML = `
      <a href="/paginas/ingreso.html" class="btn btn--primario">Iniciar Sesión</a>
      <a href="/paginas/registro.html" class="btn btn--secundario">Registrarse como Estudiante</a>
    `;

    seccionTemas.style.display = 'block';
    contenedorAsignaturasTemas.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl);">
        <p style="font-size: var(--tamano-m); margin-bottom: var(--espacio-m); color: var(--color-texto);">
          Para visualizar y explorar los temas de estudio, inicia sesión con tu cuenta institucional.
        </p>
        <a href="/paginas/ingreso.html" class="btn btn--primario">Acceder a mis temas →</a>
      </div>
    `;
    return;
  }

  // Usuario con sesión activa (estudiante, docente o admin)
  const rolTexto = usuario.rol === 'admin' ? 'Administrador' : (usuario.rol === 'docente' ? 'Docente' : 'Estudiante');
  bienvenidaTitulo.textContent = 'Explora y aprende';
  bienvenidaSubtitulo.textContent = `¡Hola, ${usuario.nombre}! Aquí están las unidades, los temas y las noticias disponibles para tu rol de ${rolTexto.toLowerCase()}.`;

  const accionesAdminDocente = (usuario.rol === 'docente' || usuario.rol === 'admin')
    ? `<a href="/paginas/editor-contenidos.html" class="btn btn--primario">Editor de Contenidos</a>`
    : '';

  bienvenidaAcciones.innerHTML = `
    <span class="insignia insignia--acento" style="font-size: var(--tamano-s);">${escapar(rolTexto)}</span>
    ${accionesAdminDocente}
    <a href="/paginas/perfil.html" class="btn btn--secundario">Mi Perfil</a>
  `;

  seccionTemas.style.display = 'block';
  await Promise.all([
    cargarNoticiasDestacadas(),
    cargarContenidos()
  ]);
  renderizarPresentacionAcademica();
}

async function cargarPresentacionAcademica() {
  try {
    const respuesta = await api.llamar('GET', '/api/neuroritmo/presentacion');
    experienciaNeuroritmo = respuesta?.experiencia || null;
    renderizarPresentacionAcademica();
  } catch (err) {
    console.warn('No se pudo cargar la presentación académica:', err.message);
  }
}

function enlaceLeccion(subtema) {
  const tema = todosLosTemas.find((t) => t.id === subtema.temaId);
  if (tema) {
    return `<a class="btn btn--primario btn--pequeno" href="/paginas/tema.html?id=${escapar(tema.id)}">Ver lección</a>`;
  }
  return '<span class="insignia insignia--acento">Lección completa pendiente de aprobación docente</span>';
}

function reproductorSubtema(multimedia) {
  if (!multimedia || !urlSegura(multimedia.url)) return '';
  const titulo = escapar(multimedia.titulo);
  const fuente = `<source src="${escapar(multimedia.url)}" type="${escapar(multimedia.mime)}">`;
  const reproductor = multimedia.tipo === 'video'
    ? `<video controls preload="metadata" aria-label="Video: ${titulo}">${fuente}Tu navegador no puede reproducir este video.</video>`
    : `<audio controls preload="metadata" aria-label="Audio: ${titulo}">${fuente}Tu navegador no puede reproducir este audio.</audio>`;

  return `
    <section class="explorar-multimedia" aria-label="Recurso multimedia del subtema">
      <h4>${titulo}</h4>
      ${reproductor}
    </section>`;
}

function reproductorVentanaTema(temaId) {
  const multimedia = MULTIMEDIA_TEMAS[temaId];
  if (!multimedia || !urlSegura(multimedia.url)) return '';
  const titulo = escapar(multimedia.titulo);
  const fuente = `<source src="${escapar(multimedia.url)}" type="${escapar(multimedia.mime)}">`;
  const reproductor = multimedia.tipo === 'video'
    ? `<video controls preload="metadata" aria-label="Video: ${titulo}">${fuente}Tu navegador no puede reproducir este video.</video>`
    : `<audio controls preload="metadata" aria-label="Audio: ${titulo}">${fuente}Tu navegador no puede reproducir este audio.</audio>`;

  return `
    <section class="detalle-tema-seccion detalle-tema-multimedia" data-multimedia-tema="${escapar(temaId)}" aria-labelledby="multimedia-${escapar(temaId)}">
      <h3 id="multimedia-${escapar(temaId)}">Recurso audiovisual</h3>
      <h4>${titulo}</h4>
      ${reproductor}
    </section>`;
}

function tarjetaRecurso(clave, recurso) {
  const url = urlSegura(recurso?.url);
  const utilidad = UTILIDAD_RECURSOS[clave] || 'Material complementario de la experiencia NeuroRitmo.';
  const pendiente = recurso?.estado === 'pendiente' || !url;
  return `
    <article class="tarjeta explorar-recurso">
      <div class="explorar-recurso__cabecera">
        <span class="insignia insignia--primario">${escapar(String(recurso?.formato || 'Recurso').split('·')[0].trim())}</span>
        ${pendiente ? '<span class="insignia insignia--acento">Pendiente</span>' : '<span class="insignia">Disponible</span>'}
      </div>
      <h3 class="tarjeta__titulo">${escapar(recurso?.titulo || 'Recurso educativo')}</h3>
      <p><strong>Utilidad:</strong> ${escapar(utilidad)}</p>
      <p class="neuro-nota">${escapar(recurso?.autoria || 'Autoría no registrada')}</p>
      <div class="explorar-recurso__accion">
        ${pendiente
          ? '<p class="alerta alerta--advertencia" role="status">Recurso pendiente de publicación</p>'
          : `<a class="btn btn--primario" href="${escapar(url)}" target="_blank" rel="noopener noreferrer">Abrir recurso <span class="sr-only">en una pestaña nueva</span> ↗</a>`}
      </div>
    </article>`;
}

function tarjetaCancionPrincipal(cancion) {
  if (!cancion?.id || !urlSegura(cancion.audio)) return '';
  const enlace = `/paginas/canciones.html?cancionId=${encodeURIComponent(cancion.id)}`;
  return `
    <article class="tarjeta explorar-recurso recurso-audio" data-cancion-principal="${escapar(cancion.id)}">
      <div class="explorar-recurso__cabecera">
        <span class="insignia insignia--primario">Audio educativo</span>
        <span class="insignia insignia--exito">Canción principal</span>
      </div>
      <h3 class="tarjeta__titulo">${escapar(cancion.titulo)}</h3>
      <p><strong>Utilidad:</strong> Recurso musical central para escuchar, analizar y retomar en las actividades pertinentes.</p>
      <p class="neuro-nota">${escapar(cancion.autoria)} · ${escapar(cancion.licencia)}</p>
      <audio controls preload="metadata" muted src="${escapar(cancion.audio)}">Tu navegador no puede reproducir este audio.</audio>
      ${cancion.letra ? `<details class="recurso-audio__transcripcion"><summary>Transcripción</summary>${util.formatoBasico(cancion.letra)}</details>` : ''}
      <div class="explorar-recurso__accion"><a class="btn btn--primario" href="${enlace}">Abrir en Canciones</a></div>
    </article>`;
}

function renderizarPresentacionAcademica() {
  if (!experienciaNeuroritmo) return;
  const e = experienciaNeuroritmo;
  seccionRuta.hidden = false;
  presentacionAcademica.innerHTML = `
    <article class="tarjeta explorar-presentacion">
      <p class="explorar-antetitulo">Presentación académica</p>
      <h3 class="tarjeta__titulo">${escapar(e.titulo)}</h3>
      <p>${escapar(e.narrativa)}</p>
      <dl class="explorar-jerarquia">
        <div><dt>Unidad</dt><dd>La Música en la Educación</dd></div>
        <div><dt>Tema</dt><dd>Fundamentos de Neuroeducación y Desarrollo Cognitivo Musical</dd></div>
        <div><dt>Duración de la experiencia</dt><dd>${escapar(e.duracion || 'No indicada')}</dd></div>
      </dl>
      <h4>Objetivo general</h4>
      <p>${escapar(e.objetivo)}</p>
    </article>
    <div class="explorar-subtemas-grid">
      ${SUBTEMAS_NEURORITMO.map((s) => `
        <article class="tarjeta explorar-subtema" data-subtema="${escapar(s.numero)}">
          <span class="insignia insignia--acento">Subtema ${escapar(s.numero)}</span>
          <h3 class="tarjeta__titulo">${escapar(s.titulo)}</h3>
          <p><strong>Objetivo:</strong> ${escapar(s.objetivo)}</p>
          <details class="explorar-subtema__detalle">
            <summary>Leer explicación del subtema ${escapar(s.numero)}</summary>
            ${s.explicacion.map((parrafo) => `<p>${escapar(parrafo)}</p>`).join('')}
            <p><strong>Ejemplo académico:</strong> ${escapar(s.aplicacion)}</p>
            ${reproductorSubtema(s.multimedia)}
            <p class="neuro-nota">Síntesis de la lección en borrador; la versión completa requiere aprobación docente.</p>
          </details>
          <div class="explorar-subtema__acciones">
            ${enlaceLeccion(s)}
            ${s.misiones.map((m) => `<a class="btn btn--secundario btn--pequeno" href="/index.html#mision-${escapar(m.id)}">${escapar(m.texto)}</a>`).join('')}
          </div>
        </article>`).join('')}
    </div>`;

  seccionRecursos.hidden = false;
  tarjetasRecursos.innerHTML = [
    ...Object.entries(e.recursos || {})
      .filter(([clave]) => !RECURSOS_SIN_ACCESO.has(clave))
      .map(([clave, recurso]) => tarjetaRecurso(clave, recurso)),
    tarjetaCancionPrincipal(e.cancionPrincipal)
  ].join('');
}

/**
 * Carga y renderiza las noticias destacadas de la plataforma.
 */
async function cargarNoticiasDestacadas() {
  const seccionNoticias = document.getElementById('seccion-noticias-destacadas');
  const contenedorNoticias = document.getElementById('contenedor-noticias-destacadas');
  if (!seccionNoticias || !contenedorNoticias) return;

  try {
    const noticias = await api.listar('noticias');
    if (!Array.isArray(noticias) || noticias.length === 0) return;

    const publicadas = noticias.filter((n) => n.estado === 'publicado');
    if (publicadas.length === 0) return;

    // Ordenar destacadas primero, luego por fecha más reciente
    publicadas.sort((a, b) => {
      if (a.destacada && !b.destacada) return -1;
      if (!a.destacada && b.destacada) return 1;
      const fA = new Date(a.fechaPublicacion || a.fecha).getTime() || 0;
      const fB = new Date(b.fechaPublicacion || b.fecha).getTime() || 0;
      return fB - fA;
    });

    // Mostrar hasta 3 noticias destacadas en inicio
    const aMostrar = publicadas.slice(0, 3);

    contenedorNoticias.innerHTML = aMostrar.map((n) => `
      <a href="/paginas/noticia.html?id=${escapar(n.id)}" class="noticia-destacada-card">
        ${n.imagen ? `
          <div class="noticia-destacada-card__imagen-caja">
            <img src="${escapar(n.imagen)}" alt="" class="noticia-destacada-card__imagen">
          </div>
        ` : ''}
        <div class="noticia-destacada-card__cuerpo">
          <div class="noticia-destacada-card__meta">
            <span class="insignia insignia--primario">${escapar(n.categoria || 'Académica')}</span>
            ${n.destacada ? '<span class="insignia insignia--acento">Destacada</span>' : ''}
            <span>${util.fechaRelativa(n.fechaPublicacion || n.fecha)}</span>
          </div>
          <h3 class="noticia-destacada-card__titulo">${escapar(n.titulo)}</h3>
          <p class="noticia-destacada-card__resumen">${escapar(n.resumen || '')}</p>
          <div class="noticia-destacada-card__pie">
            <span>Leer noticia completa</span>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </a>
    `).join('');

    seccionNoticias.style.display = 'flex';
  } catch (err) {
    console.warn('No se pudieron cargar las noticias destacadas en inicio:', err.message);
  }
}

/**
 * Carga las asignaturas, unidades y temas permitidos para el usuario.
 */
async function cargarContenidos() {
  try {
    const [asigs, unis, temas] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    todasLasAsignaturas = Array.isArray(asigs) ? asigs : [];
    todasLasUnidades = Array.isArray(unis) ? unis : [];
    todosLosTemas = Array.isArray(temas) ? temas : [];

    renderizarCatalogo();
  } catch (err) {
    contenedorAsignaturasTemas.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        Error al cargar los temas de aprendizaje: ${escapar(err.message)}
      </div>
    `;
  }
}

/**
 * Renderiza la jerarquía completa: Asignatura > Unidad > Temas.
 */
function renderizarCatalogo() {
  const termino = (inputBuscarTemas.value || '').trim().toLowerCase();

  if (todasLasAsignaturas.length === 0) {
    contenedorAsignaturasTemas.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
        No tienes asignaturas asignadas en este momento.
      </div>
    `;
    return;
  }

  const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  // Filtrar temas y agrupar
  let htmlAsignaturas = '';
  let totalTemasVisibles = 0;

  for (const asig of todasLasAsignaturas) {
    // Unidades de esta asignatura ordenadas
    const unidades = todasLasUnidades
      .filter((u) => u.asignaturaId === asig.id)
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

    let htmlUnidades = '';

    for (const uni of unidades) {
      // Temas de esta unidad ordenados
      let temas = todosLosTemas
        .filter((t) => t.unidadId === uni.id)
        .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

      // Filtro de búsqueda
      if (termino) {
        temas = temas.filter((t) => {
          const tit = String(t.titulo || '').toLowerCase();
          const res = String(t.resumen || '').toLowerCase();
          const claves = comoLista(t.palabrasClave).join(' ').toLowerCase();
          const obj = comoLista(t.objetivos).join(' ').toLowerCase();
          return tit.includes(termino) || res.includes(termino) || claves.includes(termino) || obj.includes(termino);
        });
      }

      if (temas.length === 0 && termino) {
        continue;
      }

      totalTemasVisibles += temas.length;

      const htmlTarjetasTemas = temas.length === 0
        ? `<p style="font-size: var(--tamano-s); color: var(--color-texto-suave); padding: var(--espacio-s);">No hay temas disponibles en esta unidad.</p>`
        : `
          <div class="temas-grid">
            ${temas.map((t, idx) => {
              const numTema = idx + 1;
              const dificultad = (t.dificultad || 'intermedio').toLowerCase();
              const badgeDificultad = dificultad === 'avanzado'
                ? '<span class="insignia insignia--acento">Avanzado</span>'
                : (dificultad === 'basico' ? '<span class="insignia insignia--primario">Básico</span>' : '<span class="insignia">Intermedio</span>');

              const badgeEstado = (esDocenteOAdmin && t.estado)
                ? `<span class="insignia" style="font-size: var(--tamano-xs);">${escapar(t.estado)}</span>`
                : '';

              const palabrasClaveHtml = comoLista(t.palabrasClave).slice(0, 4).map((p) => `
                <span class="chip">#${escapar(p)}</span>
              `).join('');

              const botonEditar = esDocenteOAdmin
                ? `<a href="/paginas/editor-tema.html?id=${escapar(t.id)}" class="btn btn--pequeno btn--secundario" aria-label="Editar ficha de ${escapar(t.titulo)}">Editar ficha</a>`
                : '';

              return `
                <article class="tema-tarjeta" data-id="${escapar(t.id)}">
                  <div>
                    <div class="tema-tarjeta__cabecera">
                      <span class="tema-tarjeta__orden">Tema ${numTema}</span>
                      <div style="display: flex; gap: 4px;">
                        ${badgeDificultad}
                        ${badgeEstado}
                      </div>
                    </div>

                    <h4 class="tema-tarjeta__titulo">${escapar(t.titulo)}</h4>
                    <p class="tema-tarjeta__resumen">${escapar(t.resumen || 'Sin resumen conceptual registrado.')}</p>

                    ${palabrasClaveHtml ? `<div class="tema-tarjeta__etiquetas">${palabrasClaveHtml}</div>` : ''}
                  </div>

                  <div class="tema-tarjeta__pie">
                    <button type="button" class="btn btn--pequeno btn--primario btn-ver-tema" data-id="${escapar(t.id)}" aria-label="Ver contenido de ${escapar(t.titulo)}">
                      Ver contenido →
                    </button>
                    ${botonEditar}
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        `;

      htmlUnidades += `
        <div class="inicio-unidad-bloque">
          <h3 class="inicio-unidad-bloque__titulo">
            <span>${escapar(uni.titulo)}</span>
            ${uni.visible === false ? '<span class="insignia" style="opacity: 0.7;">Oculta</span>' : ''}
          </h3>
          ${htmlTarjetasTemas}
        </div>
      `;
    }

    if (!htmlUnidades && termino) {
      continue;
    }

    htmlAsignaturas += `
      <section class="inicio-asignatura-bloque" aria-label="Asignatura ${escapar(asig.nombre)}">
        <header class="inicio-asignatura-bloque__cabecera">
          <div class="inicio-asignatura-bloque__meta">
            <span class="insignia insignia--acento">${escapar(asig.nivel || 'GENERAL')}</span>
          </div>
          <h2 class="inicio-asignatura-bloque__titulo">${escapar(asig.nombre)}</h2>
          <p class="inicio-asignatura-bloque__desc">${escapar(asig.descripcion || '')}</p>
        </header>

        <div class="inicio-asignatura-unidades">
          ${htmlUnidades || '<p style="color: var(--color-texto-suave);">No hay unidades disponibles en esta asignatura.</p>'}
        </div>
      </section>
    `;
  }

  // Anuncia solo el número de resultados (no todo el catálogo)
  const estadoBusqueda = document.getElementById('estado-busqueda-temas');
  if (estadoBusqueda) estadoBusqueda.textContent = termino ? `${totalTemasVisibles} tema${totalTemasVisibles === 1 ? '' : 's'} encontrado${totalTemasVisibles === 1 ? '' : 's'}` : '';

  if (!htmlAsignaturas && termino) {
    contenedorAsignaturasTemas.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
        No se encontraron temas que coincidan con "<strong>${escapar(termino)}</strong>".
      </div>
    `;
    return;
  }

  contenedorAsignaturasTemas.innerHTML = htmlAsignaturas;
}

/**
 * Abre una ventana modal accesible con el contenido pedagógico completo del tema.
 */
async function abrirDetalleTema(temaId) {
  const tema = todosLosTemas.find((t) => t.id === temaId);
  if (!tema) return;

  const objetivosHtml = Array.isArray(tema.objetivos) && tema.objetivos.length > 0
    ? `<ul>${tema.objetivos.map((o) => `<li>${escapar(o)}</li>`).join('')}</ul>`
    : '<p style="color: var(--color-texto-suave);">No se han definido objetivos aún.</p>';

  const ejemplosHtml = Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0
    ? `<ul>${tema.ejemplos.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`
    : '';

  const erroresHtml = Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0
    ? `<ul>${tema.erroresFrecuentes.map((e) => `<li>${escapar(e)}</li>`).join('')}</ul>`
    : '';

  const preguntasHtml = Array.isArray(tema.preguntasGuia) && tema.preguntasGuia.length > 0
    ? `<ul>${tema.preguntasGuia.map((p) => `<li>${escapar(p)}</li>`).join('')}</ul>`
    : '';

  const recursosHtml = Array.isArray(tema.recursos) && tema.recursos.length > 0
    ? `<ul>${tema.recursos.map((r) => {
        const url = urlSegura(r?.url);
        const texto = escapar(r?.titulo || r?.url || 'Recurso');
        return `
        <li>
          <strong>[${escapar(String(r?.tipo || 'Enlace').toUpperCase())}]</strong>
          ${url ? `<a href="${escapar(url)}" target="_blank" rel="noopener noreferrer">${texto}</a>` : texto}
        </li>`;
      }).join('')}</ul>`
    : '';

  const contenedorModal = document.createElement('div');
  contenedorModal.className = 'detalle-tema-dialogo';
  contenedorModal.innerHTML = `
    <div class="detalle-tema-seccion">
      <div style="display: flex; gap: var(--espacio-xs); margin-bottom: var(--espacio-s);">
        <span class="insignia insignia--acento">${escapar((tema.dificultad || 'Intermedio').toUpperCase())}</span>
      </div>
      <h3 style="font-size: var(--tamano-s); color: var(--color-primario);">Resumen conceptual</h3>
      <div style="line-height: var(--linea-base); margin-top: var(--espacio-xs);">
        ${util.formatoBasico(tema.resumen || 'Sin resumen.')}
      </div>
    </div>

    ${reproductorVentanaTema(tema.id)}

    <div class="detalle-tema-seccion">
      <h3>Objetivos de Aprendizaje</h3>
      ${objetivosHtml}
    </div>

    ${ejemplosHtml ? `
      <div class="detalle-tema-seccion">
        <h3>Ejemplos de Aplicación</h3>
        ${ejemplosHtml}
      </div>
    ` : ''}

    ${erroresHtml ? `
      <div class="detalle-tema-seccion">
        <h3>Errores Frecuentes y Concepciones Erróneas</h3>
        ${erroresHtml}
      </div>
    ` : ''}

    ${preguntasHtml ? `
      <div class="detalle-tema-seccion">
        <h3>Preguntas Guía</h3>
        ${preguntasHtml}
      </div>
    ` : ''}

    ${recursosHtml ? `
      <div class="detalle-tema-seccion">
        <h3>Recursos Didácticos</h3>
        ${recursosHtml}
      </div>
    ` : ''}

    ${tema.fuentes ? `
      <div class="detalle-tema-seccion">
        <h3>Fuentes y Referencias</h3>
        <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">${escapar(tema.fuentes)}</p>
      </div>
    ` : ''}
  `;

  await modal({
    titulo: tema.titulo,
    contenido: contenedorModal,
    acciones: [
      { texto: 'Cerrar', valor: null, clase: 'btn btn--primario' }
    ]
  });
}

// Evento de búsqueda en vivo
inputBuscarTemas.addEventListener('input', renderizarCatalogo);

// Evento delegado en tarjetas de temas
contenedorAsignaturasTemas.addEventListener('click', (e) => {
  const btnVer = e.target.closest('.btn-ver-tema');
  if (btnVer) {
    const id = btnVer.dataset.id;
    if (id) abrirDetalleTema(id);
  }
});

await inicializar();
