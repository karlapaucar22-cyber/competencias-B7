// publico/js/nucleo/plantilla.js
// Montaje uniforme de encabezado, menú lateral responsivo y pie de página

import { MENU, GRUPOS_MENU } from './menu.js';
import { escapar, aviso } from './ui.js';
import { usuarioActual, cerrar, exigirRol } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import * as api from './api.js';
import { logrosDe } from './gamificacion.js';
import { montarCampana, alConsultar } from './notificaciones.js';
import { montarAvatar, decir } from './avatar.js';
import { montarTutorNeuriGlobal } from './tutor-neuri-global.js';
import { montarMenuAdaptable } from './menu-adaptable.js';

export const NOMBRE = "NeuroRitmo Digital";

/**
 * Monta la plantilla común en la página:
 * 1. Exige el rol indicado si se especifica.
 * 2. Muestra avisos pendientes almacenados en sessionStorage.
 * 3. Inserta en #plantilla el encabezado con estado de sesión y menú lateral.
 * 4. Marca la página activa con aria-current="page".
 * 5. Habilita el control del menú para móviles y el cierre de sesión.
 * 6. Registra el evento de visita de página si hay sesión activa.
 * 7. Agrega el pie de página con el año al final del body.
 *
 * @param {{ titulo?: string, roles?: string[] }} opciones
 */
export async function montarPlantilla({ titulo = "", roles = ["publico"] } = {}) {
  // 1. Exigir rol si se especifica
  if (roles && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  // 2. Título del documento
  if (typeof document !== 'undefined') {
    document.title = titulo ? `${titulo} · ${NOMBRE}` : NOMBRE;
  }

  // 3. Mostrar aviso pendiente si proviene de una redirección previa
  if (typeof sessionStorage !== 'undefined') {
    const rawAviso = sessionStorage.getItem('aviso_pendiente');
    if (rawAviso) {
      try {
        const datosAviso = JSON.parse(rawAviso);
        if (datosAviso && datosAviso.texto) {
          aviso(datosAviso.texto, datosAviso.tipo || 'info');
        }
      } catch {}
      sessionStorage.removeItem('aviso_pendiente');
    }
  }

  if (typeof document === 'undefined') return;

  const contPlantilla = document.getElementById('plantilla');
  const rutaActual = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
  const usuario = usuarioActual();
  const rolActual = usuario ? usuario.rol : 'publico';

  // 4. Registro de navegación en bitácora para usuarios con sesión (sin bloquear)
  if (usuario && rutaActual) {
    registrarEvento('pagina', rutaActual).catch(() => {});
  }

  if (contPlantilla) {
    // Filtrar enlaces de menú según rol
    const enlacesVisibles = MENU.filter((item) => {
      if (!item.roles || item.roles.includes('publico')) return true;
      if (!usuario) return false;
      if (item.roles.includes('sesion')) return true;
      if (usuario.rol === 'admin') return true;
      return item.roles.includes(usuario.rol);
    });

    // La opción activa se marca después (marcarActivo), porque depende también del #hash
    const enlaceHtml = (item) => `<a href="${item.href}" class="menu-lateral__enlace" aria-label="${escapar(item.texto)}" title="${escapar(item.texto)}">`
      + `<span class="menu-lateral__icono" aria-hidden="true">${item.icono || '•'}</span>`
      + `<span class="menu-lateral__texto">${escapar(item.texto)}</span></a>`;
    // Secciones del menú (solo las que tienen opciones visibles para el rol)
    const enlacesHtml = GRUPOS_MENU.map((grupo) => {
      const items = enlacesVisibles.filter((item) => (item.grupo || GRUPOS_MENU[0]) === grupo);
      if (!items.length) return '';
      return `<div class="menu-lateral__grupo"><p class="menu-lateral__titulo-grupo">${escapar(grupo)}</p>${items.map(enlaceHtml).join('')}</div>`;
    }).join('');

    // Encabezado: estado de sesión a la derecha
    let areaUsuarioHtml = '';
    if (usuario) {
      const puntosHtml = usuario.rol === 'estudiante'
        ? `<span id="puntos-usuario" class="puntos-usuario" title="Puntos acumulados">🎯 0 pts</span>`
        : '';

      areaUsuarioHtml = `
        <div class="encabezado-app__usuario-area">
          ${puntosHtml}
          <a href="/paginas/perfil.html" class="encabezado-app__usuario" title="Ver mi perfil">
            <span class="encabezado-app__usuario-nombre">${escapar(usuario.nombre)}</span>
            <span class="chip">${escapar(usuario.rol)}</span>
          </a>
          <button type="button" id="btn-cerrar-sesion" class="btn btn--pequeno btn--texto">Salir</button>
        </div>
      `;
    } else {
      areaUsuarioHtml = `
        <div class="encabezado-app__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--pequeno btn--secundario">Ingresar</a>
          <a href="/paginas/registro.html" class="btn btn--pequeno btn--primario">Registrarse</a>
        </div>
      `;
    }

    contPlantilla.innerHTML = `
      <header class="encabezado-app">
        <div class="encabezado-app__marca">
          <span class="encabezado-app__dot" aria-hidden="true"></span>
          <a href="/index.html" class="encabezado-app__nombre">${escapar(NOMBRE)}</a>
          ${titulo ? `<span class="encabezado-app__separador" aria-hidden="true">/</span><span class="encabezado-app__titulo">${escapar(titulo)}</span>` : ''}
        </div>
        <div class="fila encabezado-app__derecha">
          ${areaUsuarioHtml}
          <button type="button" id="btn-menu-movil" class="menu-toggle" aria-label="Abrir menú de navegación" aria-expanded="false" aria-controls="menu-lateral">☰</button>
        </div>
      </header>
      <aside id="menu-lateral" class="menu-lateral" aria-label="Navegación principal">
        <div class="menu-lateral__controles">
          <button type="button" id="btn-menu-fijar" class="menu-lateral__fijar" aria-pressed="false">
            <span aria-hidden="true">📌</span><span class="menu-lateral__fijar-texto">Mantener menú expandido</span>
          </button>
          <button type="button" id="btn-menu-cerrar" class="menu-lateral__cerrar" aria-label="Cerrar menú de navegación">×</button>
        </div>
        <nav class="menu-lateral__nav">
          ${enlacesHtml}
        </nav>
      </aside>
    `;

    marcarActivo();
    window.addEventListener('hashchange', marcarActivo);

    // Botón de cerrar sesión
    const btnSalir = document.getElementById('btn-cerrar-sesion');
    if (btnSalir) {
      btnSalir.addEventListener('click', async (e) => {
        e.preventDefault();
        await cerrar();
      });
    }

    // Puntos acumulados de estudiante
    if (usuario && usuario.rol === 'estudiante') {
      cargarPuntosEstudiante();
    }

    // Contador de noticias no leídas y campana de notificaciones
    if (usuario) {
      cargarInsigniaNoticias(contPlantilla);
      // Mensajes no leídos: se consultan cada 60 s junto con la campana
      alConsultar(() => actualizarContadorMensajes());
      montarCampana();
    }

    // Control adaptable: tres estados en escritorio y cajón temporal en móvil.
    const btnMovil = document.getElementById('btn-menu-movil');
    const menuLateral = document.getElementById('menu-lateral');
    montarMenuAdaptable({
      menu: menuLateral,
      boton: btnMovil,
      botonCerrar: document.getElementById('btn-menu-cerrar'),
      botonFijar: document.getElementById('btn-menu-fijar'),
      usuario
    });
  }

  // 5. Pie de página con el año
  let pie = document.getElementById('pie-plantilla');
  if (!pie) {
    pie = document.createElement('footer');
    pie.id = 'pie-plantilla';
    pie.className = 'pie-app';
    const anio = new Date().getFullYear();
    pie.innerHTML = `<div class="contenedor"><p>&copy; ${anio} ${escapar(NOMBRE)}. Universidad Estatal de Milagro.</p></div>`;
    document.body.appendChild(pie);
  }

  // 6. Neuri está disponible en toda la plataforma; las páginas pueden aportar instrucciones contextuales.
  const conAvatar = document.querySelector('[data-avatar]');
  const instrucciones = conAvatar?.dataset.avatar?.trim();
  const avatar = montarAvatar({ personaje: 'neuri' });
  if (instrucciones) {
    decir(instrucciones);
  }
  if (usuario?.rol === 'estudiante') {
    montarTutorNeuriGlobal({ raiz: avatar }).catch((error) => console.error('No se pudo iniciar el tutor global:', error));
  }
}

/**
 * Marca con aria-current="page" la opción del menú de la página actual. Si varias opciones comparten la
 * ruta (Inicio, Mapa de misiones, Certificado → /index.html), gana la que coincide con el #hash; si
 * ninguna coincide, la que no tiene hash.
 */
function marcarActivo() {
  const enlaces = [...document.querySelectorAll('#menu-lateral .menu-lateral__enlace')];
  const ruta = window.location.pathname === '/' ? '/index.html' : window.location.pathname;
  const hash = window.location.hash;
  const deLaRuta = enlaces.filter((a) => {
    const [destino] = a.getAttribute('href').split('#');
    return ruta === destino || (destino !== '/index.html' && ruta.endsWith(destino));
  });
  const activo = deLaRuta.find((a) => hash && a.getAttribute('href').endsWith(hash))
    || deLaRuta.find((a) => !a.getAttribute('href').includes('#'));
  for (const a of enlaces) {
    const es = a === activo;
    a.classList.toggle('activo', es);
    if (es) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/**
 * Consulta y muestra el número de noticias publicadas no leídas junto al enlace de menú.
 */
async function cargarInsigniaNoticias(contenedor) {
  try {
    const enlaceNoticias = contenedor.querySelector('a[href="/paginas/noticias.html"]');
    if (!enlaceNoticias) return;

    const [noticias, lecturas] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias')
    ]);

    const idsLeidas = new Set((lecturas || []).map((l) => l.noticiaId));
    const noLeidas = (noticias || []).filter(
      (n) => n.estado === 'publicado' && !idsLeidas.has(n.id)
    ).length;

    if (noLeidas > 0) {
      let badge = enlaceNoticias.querySelector('.badge-noticias-no-leidas');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'insignia insignia--acento badge-noticias-no-leidas menu-lateral__contador';
        badge.setAttribute('aria-label', `${noLeidas} noticias sin leer`);
        enlaceNoticias.appendChild(badge);
      }
      badge.textContent = String(noLeidas);
    }
  } catch (e) {
    // Silencioso ante errores de red o permisos
  }
}

/**
 * Contador de mensajes no leídos junto a "Mensajes" en el menú.
 * @param {number} [total] si se indica, no consulta al servidor
 */
export async function actualizarContadorMensajes(total) {
  const enlace = document.querySelector('#menu-lateral a[href="/paginas/mensajes.html"]');
  if (!enlace) return;
  try {
    if (typeof total !== 'number') total = (await api.llamar('GET', '/api/mensajes/no-leidos')).total || 0;
  } catch {
    return;
  }
  let contador = enlace.querySelector('.menu-lateral__contador');
  if (!total) {
    contador?.remove();
    return;
  }
  if (!contador) {
    contador = document.createElement('span');
    contador.className = 'insignia insignia--acento menu-lateral__contador';
    enlace.appendChild(contador);
  }
  contador.textContent = total > 99 ? '99+' : String(total);
  contador.setAttribute('aria-label', `${total} mensaje${total === 1 ? '' : 's'} sin leer`);
}

/**
 * Consulta y actualiza los puntos acumulados del estudiante en el encabezado
 */
async function cargarPuntosEstudiante() {
  try {
    const logros = await logrosDe('yo');
    const elementoPuntos = document.getElementById('puntos-usuario');
    if (elementoPuntos) {
      const puntos = logros?.puntos || 0;
      elementoPuntos.textContent = `🎯 ${puntos} pts`;
      elementoPuntos.setAttribute('title', `Puntos acumulados: ${puntos}`);
    }
  } catch (e) {
    // Silencioso ante errores de red o carga inicial
  }
}
