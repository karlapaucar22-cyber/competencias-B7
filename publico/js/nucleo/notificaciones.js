// publico/js/nucleo/notificaciones.js
// Campana de notificaciones del encabezado: contador, panel desplegable y consulta periódica

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';
import { usuarioActual } from './sesion.js';

const INTERVALO_MS = 60000;
const ICONOS = { noticia: '📰', 'mensaje-docente': '✉️', 'banco-insuficiente': '❓', alerta: '⚠️', agenda: '🗓️' };

let estado = { notificaciones: [], noLeidas: 0 };
let elementos = null;

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

/**
 * Número de notificaciones sin leer (consulta al servidor).
 * @returns {Promise<number>}
 */
export async function noLeidas() {
  await actualizar();
  return estado.noLeidas;
}

const avisosNavegador = () => 'Notification' in window;

// Recordatorios de la agenda: el servidor crea la notificación; aquí se avisa también en el navegador
async function revisarRecordatorios() {
  try {
    const avisos = await api.llamar('GET', '/api/agenda/recordatorios');
    if (!avisosNavegador() || Notification.permission !== 'granted' || !Array.isArray(avisos)) return;
    for (const a of avisos) {
      const aviso = new Notification('Agenda · NeuroRitmo Digital', { body: a.mensaje, tag: `agenda-${a.eventoId}-${a.minutos}` });
      aviso.onclick = () => {
        window.focus();
        aviso.close();
        if (a.enlace) window.location.href = a.enlace;
      };
    }
  } catch {
    // Sin conexión: se reintenta en la siguiente consulta
  }
}

// Bloque "Activar avisos del navegador" del panel según el permiso actual
function pintarAvisos() {
  if (!elementos) return;
  const { avisos, activarAvisos, textoAvisos } = elementos;
  const permiso = avisosNavegador() ? Notification.permission : 'granted';
  avisos.hidden = permiso === 'granted';
  activarAvisos.hidden = permiso !== 'default';
  textoAvisos.textContent = permiso === 'denied'
    ? 'Los avisos del navegador están bloqueados. Puedes permitirlos en la configuración del sitio.'
    : 'Recibe los recordatorios de tu agenda aunque estés en otra pestaña.';
}

// Otras consultas que viajan con la de la campana (p. ej., mensajes no leídos)
const acompanantes = [];
export function alConsultar(funcion) {
  acompanantes.push(funcion);
}

async function actualizar() {
  acompanantes.forEach((f) => Promise.resolve().then(f).catch(() => {}));
  await revisarRecordatorios();
  try {
    estado = await api.llamar('GET', '/api/notificaciones');
    pintarContador();
    if (elementos && !elementos.panel.hidden) pintarLista();
  } catch {
    // Sin conexión: se reintenta en la siguiente consulta
  }
}

function pintarContador() {
  if (!elementos) return;
  const n = estado.noLeidas;
  elementos.contador.hidden = n === 0;
  elementos.contador.textContent = n > 99 ? '99+' : String(n);
  elementos.boton.setAttribute('aria-label', n === 0 ? 'Notificaciones: ninguna sin leer'
    : `Notificaciones: ${n} sin leer`);
  elementos.marcarTodas.disabled = n === 0;
}

function pintarLista() {
  const { lista } = elementos;
  if (!estado.notificaciones.length) {
    lista.replaceChildren(crear('li', 'campana__vacio', 'No tienes notificaciones.'));
    return;
  }
  lista.replaceChildren(...estado.notificaciones.map((n) => {
    const li = crear('li', `campana__item${n.leida ? '' : ' campana__item--nueva'}`);
    const destino = n.enlace ? crear('a', 'campana__enlace') : crear('button', 'campana__enlace');
    if (n.enlace) destino.href = n.enlace;
    else destino.type = 'button';

    const icono = crear('span', 'campana__icono', ICONOS[n.tipo] || '🔔');
    icono.setAttribute('aria-hidden', 'true');
    const cuerpo = crear('span', 'campana__cuerpo');
    if (n.remitente) cuerpo.append(crear('span', 'campana__remitente', `De: ${n.remitente}`));
    cuerpo.append(crear('span', 'campana__mensaje', n.mensaje));
    const fecha = crear('time', 'campana__fecha', util.fechaRelativa(n.fecha));
    fecha.dateTime = n.fecha;
    cuerpo.append(fecha);
    if (!n.leida) cuerpo.append(crear('span', 'sr-only', ' (sin leer)'));
    destino.append(icono, cuerpo);

    destino.addEventListener('click', async (e) => {
      if (n.leida) return;
      if (n.enlace) e.preventDefault();
      try {
        const r = await api.llamar('POST', `/api/notificaciones/${encodeURIComponent(n.id)}/leida`);
        n.leida = true;
        estado.noLeidas = r.noLeidas;
      } catch {
        // Si falla, igual se navega al enlace
      }
      if (n.enlace) window.location.href = n.enlace;
      else { pintarContador(); pintarLista(); }
    });
    li.append(destino);
    return li;
  }));
}

function posicionarPanel() {
  const r = elementos.boton.getBoundingClientRect();
  elementos.panel.style.top = `${Math.round(r.bottom + 8)}px`;
}

function abrir() {
  posicionarPanel();
  elementos.panel.hidden = false;
  elementos.boton.setAttribute('aria-expanded', 'true');
  pintarAvisos();
  pintarLista();
  elementos.titulo.focus();
  actualizar();
}

function cerrar(devolverFoco = true) {
  if (elementos.panel.hidden) return;
  elementos.panel.hidden = true;
  elementos.boton.setAttribute('aria-expanded', 'false');
  if (devolverFoco) elementos.boton.focus();
}

/**
 * Inserta la campana en el área de usuario del encabezado y consulta cada 60 s
 * mientras la pestaña está visible.
 */
export function montarCampana() {
  if (!usuarioActual() || elementos) return;
  const area = document.querySelector('.encabezado-app__usuario-area');
  if (!area) return;

  const contenedor = crear('div', 'campana');
  const boton = crear('button', 'campana__boton');
  boton.type = 'button';
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-controls', 'panel-notificaciones');
  const icono = crear('span', '', '🔔');
  icono.setAttribute('aria-hidden', 'true');
  boton.append(icono);
  const contador = crear('span', 'campana__contador');
  contador.setAttribute('aria-hidden', 'true');
  contador.hidden = true;
  boton.append(contador);

  const panel = crear('section', 'campana__panel');
  panel.id = 'panel-notificaciones';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'titulo-notificaciones');
  const cabecera = crear('div', 'campana__cabecera');
  const titulo = crear('h2', 'campana__titulo', 'Notificaciones');
  titulo.id = 'titulo-notificaciones';
  titulo.tabIndex = -1;
  const marcarTodas = crear('button', 'btn btn--texto btn--sm', 'Marcar todas como leídas');
  marcarTodas.type = 'button';
  cabecera.append(titulo, marcarTodas);
  const avisos = crear('div', 'campana__avisos');
  const textoAvisos = crear('p', 'campana__avisos-texto');
  const activarAvisos = crear('button', 'btn btn--secundario btn--sm', 'Activar avisos del navegador');
  activarAvisos.type = 'button';
  avisos.append(textoAvisos, activarAvisos);
  const lista = crear('ul', 'campana__lista');
  panel.append(cabecera, avisos, lista);
  contenedor.append(boton, panel);
  area.prepend(contenedor);
  elementos = { boton, contador, panel, titulo, lista, marcarTodas, avisos, activarAvisos, textoAvisos };
  pintarAvisos();

  activarAvisos.addEventListener('click', async () => {
    const permiso = await Notification.requestPermission();
    pintarAvisos();
    if (permiso === 'granted') ui.aviso('Avisos del navegador activados.', 'exito');
    titulo.focus();
  });

  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.hidden) abrir();
    else cerrar();
  });
  marcarTodas.addEventListener('click', async () => {
    try {
      await api.llamar('POST', '/api/notificaciones/leidas');
      estado.notificaciones.forEach((n) => { n.leida = true; });
      estado.noLeidas = 0;
      pintarContador();
      pintarLista();
      titulo.focus();
    } catch (err) {
      ui.aviso(`No se pudieron marcar como leídas: ${err.message}`, 'error');
    }
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !contenedor.contains(e.target)) cerrar(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden && !document.querySelector('.modal-fondo')) cerrar();
  });
  window.addEventListener('resize', () => { if (!panel.hidden) posicionarPanel(); });

  // Consulta periódica solo con la pestaña visible
  const consultar = () => { if (document.visibilityState === 'visible') actualizar(); };
  setInterval(consultar, INTERVALO_MS);
  document.addEventListener('visibilitychange', consultar);
  actualizar();
}

export default { montarCampana, noLeidas, alConsultar };
