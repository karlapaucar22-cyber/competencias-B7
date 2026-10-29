// publico/js/modulos/mensajes.js
// Mensajería: lista de conversaciones, chat con burbujas, sondeo de nuevos y marcado como leído

import { montarPlantilla, actualizarContadorMensajes } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Mensajes', roles: ['sesion'] });

const MAX_TEXTO = 2000;
const SONDEO_CHAT_MS = 4000;
const SONDEO_LISTA_MS = 15000;
const ROLES = { estudiante: 'Estudiante', docente: 'Docente', admin: 'Administración' };

const $ = (id) => document.getElementById(id);
const usuario = usuarioActual();
let conversaciones = [];
let abierta = null;          // resumen de la conversación abierta
let mensajes = [];           // mensajes cargados de la conversación abierta
let leidoHastaOtro = null;
let consultandoChat = false;

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

const nombreDe = (p) => `${p?.nombre || ''} ${p?.apellido || ''}`.trim() || 'Usuario';
const inicialDe = (p) => (p?.nombre || '?').charAt(0).toUpperCase();

// ---------- Fechas ----------
const formatoHora = new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatoDia = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoCorto = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: '2-digit' });
const claveDia = (iso) => new Date(iso).toDateString();

function diferenciaDias(iso) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(iso);
  dia.setHours(0, 0, 0, 0);
  return Math.round((hoy - dia) / 86400000);
}

function textoDia(iso) {
  const dias = diferenciaDias(iso);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return formatoDia.format(new Date(iso));
}

function horaCorta(iso) {
  if (!iso) return '';
  const dias = diferenciaDias(iso);
  if (dias === 0) return formatoHora.format(new Date(iso));
  if (dias === 1) return 'Ayer';
  return formatoCorto.format(new Date(iso));
}

// Texto escapado con saltos de línea y enlaces http(s) seguros
function textoConEnlaces(texto) {
  return ui.escapar(texto).replace(/https?:\/\/[^\s<]+/g, (url) => {
    const [, limpio, sobra] = url.match(/^(.*?)([.,;:!?)]*)$/);
    return `<a href="${limpio}" rel="noopener" target="_blank">${limpio}</a>${sobra}`;
  });
}

// ---------- Lista de conversaciones ----------
async function cargarConversaciones() {
  try {
    conversaciones = await api.llamar('GET', '/api/mensajes/conversaciones');
    $('estadoLista').textContent = '';
  } catch (err) {
    $('estadoLista').textContent = `No se pudieron cargar las conversaciones: ${err.message}`;
    return;
  }
  if (abierta) {
    const actual = conversaciones.find((c) => c.id === abierta.id);
    if (actual) {
      abierta = { ...actual, noLeidos: 0 };
      pintarEstadoBloqueo();
    }
  }
  pintarLista();
  actualizarContadorMensajes(conversaciones.reduce((s, c) => s + (abierta?.id === c.id ? 0 : c.noLeidos), 0));
}

function pintarLista() {
  const filtro = util.normalizar($('buscador').value.trim());
  const visibles = conversaciones.filter((c) => !filtro || util.normalizar(nombreDe(c.otro)).includes(filtro));
  if (!conversaciones.length) $('estadoLista').textContent = 'Aún no tienes conversaciones. Pulsa "Nueva conversación".';
  else if (!visibles.length) $('estadoLista').textContent = 'Ninguna conversación coincide con la búsqueda.';
  else $('estadoLista').textContent = '';

  $('listaConversaciones').replaceChildren(...visibles.map((c) => {
    const li = crear('li');
    const noLeidos = abierta?.id === c.id ? 0 : c.noLeidos;
    const boton = crear('button', `mensajes-conversacion${noLeidos ? ' mensajes-conversacion--nueva' : ''}`);
    boton.type = 'button';
    boton.dataset.id = c.id;
    if (abierta?.id === c.id) boton.setAttribute('aria-current', 'true');

    const avatar = crear('span', 'mensajes-avatar', inicialDe(c.otro));
    avatar.setAttribute('aria-hidden', 'true');
    const cuerpo = crear('span', 'mensajes-conversacion__cuerpo');
    const propio = c.ultimo?.autorId === usuario.id ? 'Tú: ' : '';
    cuerpo.append(
      crear('span', 'mensajes-conversacion__nombre', nombreDe(c.otro)),
      crear('span', 'mensajes-conversacion__ultimo', c.bloqueado ? '🚫 Bloqueado' : c.ultimo ? `${propio}${c.ultimo.texto}` : 'Sin mensajes todavía')
    );
    const lado = crear('span', 'mensajes-conversacion__lado');
    const hora = crear('time', '', horaCorta(c.ultimo?.fecha));
    if (c.ultimo?.fecha) hora.dateTime = c.ultimo.fecha;
    lado.append(hora);
    if (noLeidos) {
      const insignia = crear('span', 'insignia insignia--acento', String(noLeidos));
      lado.append(insignia);
    }
    boton.setAttribute('aria-label', `${nombreDe(c.otro)}${noLeidos ? `, ${noLeidos} sin leer` : ''}${c.ultimo ? `, último mensaje ${horaCorta(c.ultimo.fecha)}` : ''}`);
    boton.append(avatar, cuerpo, lado);
    boton.addEventListener('click', () => abrir(c.id));
    li.append(boton);
    return li;
  }));
}

// ---------- Chat ----------
async function abrir(convId) {
  const conv = conversaciones.find((c) => c.id === convId);
  if (!conv) return;
  abierta = conv;
  mensajes = [];
  leidoHastaOtro = null;
  $('chatVacio').hidden = true;
  $('chat').hidden = false;
  $('mensajesApp').classList.add('mensajes-app--chat');
  $('chatNombre').textContent = nombreDe(conv.otro);
  $('chatRol').textContent = ROLES[conv.otro.rol] || '';
  $('chatInicial').textContent = inicialDe(conv.otro);
  $('listaMensajes').replaceChildren();
  pintarEstadoBloqueo();
  pintarLista();
  history.replaceState(null, '', `?c=${encodeURIComponent(convId)}`);

  try {
    const datos = await api.llamar('GET', `/api/mensajes/${encodeURIComponent(convId)}`);
    if (abierta?.id !== convId) return;
    mensajes = datos.mensajes;
    leidoHastaOtro = datos.leidoHastaOtro;
    $('btnAnteriores').hidden = !datos.hayMas;
    pintarMensajes();
    bajarAlFinal();
  } catch (err) {
    ui.aviso(`No se pudo abrir la conversación: ${err.message}`, 'error');
    return;
  }
  marcarLeido();
  if (!$('textoMensaje').disabled) $('textoMensaje').focus();
}

function cerrarChat() {
  abierta = null;
  $('mensajesApp').classList.remove('mensajes-app--chat');
  $('chat').hidden = true;
  $('chatVacio').hidden = false;
  history.replaceState(null, '', location.pathname);
  pintarLista();
  $('listaConversaciones').querySelector('button')?.focus();
}

async function marcarLeido() {
  if (!abierta) return;
  try {
    await api.llamar('POST', `/api/mensajes/${encodeURIComponent(abierta.id)}/leido`);
    const c = conversaciones.find((x) => x.id === abierta.id);
    if (c) c.noLeidos = 0;
    actualizarContadorMensajes(conversaciones.reduce((s, x) => s + x.noLeidos, 0));
  } catch {
    // Se reintenta al recibir el siguiente mensaje
  }
}

function burbuja(m) {
  const mia = m.autorId === usuario.id;
  const li = crear('li', `burbuja ${mia ? 'burbuja--mia' : 'burbuja--otra'}`);
  li.dataset.id = m.id;
  const texto = crear('div', 'burbuja__texto');
  texto.innerHTML = textoConEnlaces(m.texto);
  const pie = crear('div', 'burbuja__pie');
  const hora = crear('time', '', formatoHora.format(new Date(m.fecha)));
  hora.dateTime = m.fecha;
  pie.append(hora);
  if (!mia) {
    const reportar = crear('button', 'burbuja__reportar', 'Reportar');
    reportar.type = 'button';
    reportar.setAttribute('aria-label', 'Reportar este mensaje');
    reportar.addEventListener('click', () => reportarMensaje(m));
    pie.append(reportar);
  }
  li.append(crear('span', 'sr-only', mia ? 'Tú:' : `${nombreDe(abierta.otro)}:`), texto, pie);
  return li;
}

function pintarMensajes() {
  const nodos = [];
  let diaAnterior = null;
  for (const m of mensajes) {
    const dia = claveDia(m.fecha);
    if (dia !== diaAnterior) {
      nodos.push(crear('li', 'mensajes-dia', textoDia(m.fecha)));
      diaAnterior = dia;
    }
    nodos.push(burbuja(m));
  }
  // "Visto" bajo mi último mensaje si el otro ya leyó hasta él
  const ultimoMio = [...mensajes].reverse().find((m) => m.autorId === usuario.id);
  if (ultimoMio && leidoHastaOtro && String(leidoHastaOtro) >= String(ultimoMio.fecha)) {
    const nodo = nodos.find((n) => n.dataset?.id === ultimoMio.id);
    nodo?.querySelector('.burbuja__pie').append(crear('span', '', '✓ Visto'));
  }
  $('listaMensajes').replaceChildren(...nodos);
}

const cercaDelFinal = () => {
  const h = $('historial');
  return h.scrollHeight - h.scrollTop - h.clientHeight < 80;
};
const bajarAlFinal = () => { $('historial').scrollTop = $('historial').scrollHeight; };

function agregarMensajes(nuevos) {
  const ids = new Set(mensajes.map((m) => m.id));
  const realmenteNuevos = nuevos.filter((m) => !ids.has(m.id));
  if (!realmenteNuevos.length) return [];
  const abajo = cercaDelFinal();
  mensajes = [...mensajes, ...realmenteNuevos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  pintarMensajes();
  if (abajo || realmenteNuevos.some((m) => m.autorId === usuario.id)) bajarAlFinal();
  return realmenteNuevos;
}

async function verAnteriores() {
  if (!abierta || !mensajes.length) return;
  const boton = $('btnAnteriores');
  boton.disabled = true;
  try {
    const datos = await api.llamar('GET', `/api/mensajes/${encodeURIComponent(abierta.id)}?antes=${encodeURIComponent(mensajes[0].fecha)}`);
    const h = $('historial');
    const alturaAntes = h.scrollHeight;
    mensajes = [...datos.mensajes, ...mensajes];
    pintarMensajes();
    h.scrollTop += h.scrollHeight - alturaAntes; // mantiene la posición de lectura
    boton.hidden = !datos.hayMas;
  } catch (err) {
    ui.aviso(`No se pudieron cargar los anteriores: ${err.message}`, 'error');
  } finally {
    boton.disabled = false;
  }
}

// Sondeo: solo los mensajes nuevos de la conversación abierta
async function consultarNuevos() {
  if (!abierta || consultandoChat || document.visibilityState !== 'visible') return;
  consultandoChat = true;
  const convId = abierta.id;
  try {
    const ultimo = mensajes.at(-1)?.fecha;
    const datos = await api.llamar('GET', `/api/mensajes/${encodeURIComponent(convId)}${ultimo ? `?desde=${encodeURIComponent(ultimo)}` : ''}`);
    if (abierta?.id !== convId) return;
    const vistoCambio = datos.leidoHastaOtro !== leidoHastaOtro;
    leidoHastaOtro = datos.leidoHastaOtro;
    const recibidos = agregarMensajes(datos.mensajes);
    if (!recibidos.length && vistoCambio) pintarMensajes();
    if (recibidos.some((m) => m.autorId !== usuario.id)) {
      marcarLeido();
      const ultimoRecibido = recibidos.at(-1);
      const c = conversaciones.find((x) => x.id === convId);
      if (c) c.ultimo = { texto: ultimoRecibido.texto.slice(0, 120), fecha: ultimoRecibido.fecha, autorId: ultimoRecibido.autorId };
      pintarLista();
    }
  } catch {
    // Sin conexión: se reintenta en el siguiente ciclo
  } finally {
    consultandoChat = false;
  }
}

// ---------- Envío ----------
function actualizarContador() {
  const n = $('textoMensaje').value.length;
  $('contadorMensaje').textContent = `${n.toLocaleString('es-EC')} / ${MAX_TEXTO.toLocaleString('es-EC')}`;
}

async function enviar() {
  const campo = $('textoMensaje');
  const texto = campo.value.trim();
  if (!abierta || !texto || $('btnEnviar').disabled) return;
  $('btnEnviar').disabled = true;
  try {
    const mensaje = await api.llamar('POST', `/api/mensajes/${encodeURIComponent(abierta.id)}`, { texto });
    campo.value = '';
    actualizarContador();
    agregarMensajes([mensaje]);
    const c = conversaciones.find((x) => x.id === abierta.id);
    if (c) {
      c.ultimo = { texto: mensaje.texto.slice(0, 120), fecha: mensaje.fecha, autorId: usuario.id };
      conversaciones = [c, ...conversaciones.filter((x) => x.id !== c.id)];
    }
    pintarLista();
  } catch (err) {
    ui.aviso(err.message, 'error');
  } finally {
    $('btnEnviar').disabled = Boolean(abierta?.bloqueado);
    campo.focus();
  }
}

// ---------- Bloqueo y reporte ----------
function pintarEstadoBloqueo() {
  if (!abierta) return;
  const bloqueado = Boolean(abierta.bloqueado);
  $('btnBloquear').textContent = abierta.bloqueadoPorMi ? 'Desbloquear' : 'Bloquear';
  $('btnBloquear').hidden = bloqueado && !abierta.bloqueadoPorMi;
  $('avisoBloqueo').hidden = !bloqueado;
  $('avisoBloqueo').textContent = abierta.bloqueadoPorMi
    ? 'Bloqueaste a esta persona: no pueden escribirse. Puedes desbloquearla cuando quieras.'
    : 'No puedes enviar mensajes en esta conversación.';
  $('textoMensaje').disabled = bloqueado;
  $('btnEnviar').disabled = bloqueado;
}

async function alternarBloqueo() {
  if (!abierta) return;
  const otro = abierta.otro;
  try {
    if (abierta.bloqueadoPorMi) {
      await api.llamar('DELETE', `/api/mensajes/bloquear/${encodeURIComponent(otro.id)}`);
      ui.aviso(`Desbloqueaste a ${nombreDe(otro)}.`, 'exito');
    } else {
      if (!(await ui.confirmar(`¿Bloquear a ${nombreDe(otro)}? Ninguno de los dos podrá escribir en esta conversación.`))) return;
      await api.llamar('POST', '/api/mensajes/bloquear', { usuarioId: otro.id });
      ui.aviso(`Bloqueaste a ${nombreDe(otro)}.`, 'exito');
    }
    await cargarConversaciones();
  } catch (err) {
    ui.aviso(err.message, 'error');
  }
}

async function reportarMensaje(m) {
  const form = crear('form');
  form.noValidate = true;
  form.innerHTML = `
    <div class="campo">
      <label for="motivoReporte">¿Por qué reportas este mensaje?</label>
      <textarea id="motivoReporte" rows="3" maxlength="500" required></textarea>
    </div>
    <p class="campo__error" id="errorReporte" role="alert" hidden></p>`;
  let enviado = false;
  await ui.modal({
    titulo: 'Reportar mensaje',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: 'Enviar reporte',
        valor: 'enviar',
        clase: 'btn btn--peligro',
        validar: async () => {
          const error = form.querySelector('#errorReporte');
          const motivo = form.querySelector('#motivoReporte').value.trim();
          if (!motivo) {
            error.textContent = 'Escribe el motivo del reporte.';
            error.hidden = false;
            return false;
          }
          try {
            await api.crear('reportes', { tipo: 'mensaje', referenciaId: `${abierta.id}/${m.id}`, motivo });
            enviado = true;
            return true;
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            return false;
          }
        }
      }
    ]
  });
  if (enviado) ui.aviso('Gracias. El equipo de administración revisará el mensaje.', 'exito');
}

// ---------- Nueva conversación ----------
async function nuevaConversacion() {
  let contactos;
  try {
    contactos = await api.llamar('GET', '/api/mensajes/contactos');
  } catch (err) {
    ui.aviso(`No se pudieron cargar los contactos: ${err.message}`, 'error');
    return;
  }
  const caja = crear('div', 'mensajes-contactos');
  caja.innerHTML = `
    <div class="campo">
      <label for="buscarContacto">Buscar contacto</label>
      <input type="search" id="buscarContacto" autocomplete="off">
    </div>
    <p class="mensajes-nota" id="contactosEstado" role="status"></p>
    <ul aria-label="Contactos"></ul>`;
  const lista = caja.querySelector('ul');
  let elegido = null;
  const pintar = () => {
    const filtro = util.normalizar(caja.querySelector('#buscarContacto').value.trim());
    const visibles = contactos.filter((p) => !filtro || util.normalizar(nombreDe(p)).includes(filtro));
    caja.querySelector('#contactosEstado').textContent = !contactos.length
      ? 'No tienes contactos disponibles todavía.'
      : visibles.length ? '' : 'Nadie coincide con la búsqueda.';
    lista.replaceChildren(...visibles.map((p) => {
      const li = crear('li');
      const boton = crear('button', 'mensajes-conversacion');
      boton.type = 'button';
      const avatar = crear('span', 'mensajes-avatar', inicialDe(p));
      avatar.setAttribute('aria-hidden', 'true');
      const cuerpo = crear('span', 'mensajes-conversacion__cuerpo');
      cuerpo.append(crear('span', 'mensajes-conversacion__nombre', nombreDe(p)), crear('span', 'mensajes-conversacion__ultimo', ROLES[p.rol] || ''));
      boton.append(avatar, cuerpo, crear('span'));
      boton.addEventListener('click', () => {
        elegido = p;
        caja.closest('.modal-dialogo')?.querySelector('.modal-cerrar')?.click();
      });
      li.append(boton);
      return li;
    }));
  };
  caja.querySelector('#buscarContacto').addEventListener('input', pintar);
  pintar();
  await ui.modal({ titulo: 'Nueva conversación', contenido: caja, acciones: [{ texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' }] });
  if (!elegido) return;
  try {
    const conv = await api.llamar('POST', '/api/mensajes/conversaciones', { con: elegido.id });
    await cargarConversaciones();
    if (!conversaciones.some((c) => c.id === conv.id)) conversaciones.unshift(conv);
    await abrir(conv.id);
  } catch (err) {
    ui.aviso(err.message, 'error');
  }
}

// ---------- Mensaje al curso (docentes) ----------
async function mensajeAlCurso() {
  let grupos;
  let asignaturas;
  try {
    [grupos, asignaturas] = await Promise.all([api.listar('distributivo'), api.listar('asignaturas')]);
  } catch (err) {
    ui.aviso(`No se pudieron cargar tus grupos: ${err.message}`, 'error');
    return;
  }
  grupos = grupos.filter((g) => g.docenteId === usuario.id);
  if (!grupos.length) {
    ui.aviso('Aún no tienes grupos asignados.', 'info');
    return;
  }
  const nombreAsignatura = new Map(asignaturas.map((a) => [a.id, a.nombre]));
  const form = crear('form');
  form.noValidate = true;
  form.innerHTML = `
    <div class="campo">
      <label for="difusionGrupo">Grupo</label>
      <select id="difusionGrupo"></select>
    </div>
    <div class="campo">
      <label for="difusionTexto">Mensaje</label>
      <textarea id="difusionTexto" rows="5" maxlength="${MAX_TEXTO}" aria-describedby="difusionContador difusionAyuda"></textarea>
      <span id="difusionContador" class="mensajes-nota">0 / ${MAX_TEXTO.toLocaleString('es-EC')}</span>
      <span id="difusionAyuda" class="mensajes-nota">Cada estudiante lo recibirá en su conversación contigo.</span>
    </div>
    <p class="campo__error" id="difusionError" role="alert" hidden></p>`;
  const selector = form.querySelector('#difusionGrupo');
  for (const g of grupos) {
    const opcion = crear('option', '', `${nombreAsignatura.get(g.asignaturaId) || 'Asignatura'} · ${g.paralelo} (${(g.estudiantes || []).length} estudiantes)`);
    opcion.value = g.id;
    selector.append(opcion);
  }
  const texto = form.querySelector('#difusionTexto');
  texto.addEventListener('input', () => {
    form.querySelector('#difusionContador').textContent = `${texto.value.length.toLocaleString('es-EC')} / ${MAX_TEXTO.toLocaleString('es-EC')}`;
  });

  let resultado = null;
  await ui.modal({
    titulo: 'Mensaje al curso',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: 'Enviar a todo el grupo',
        valor: 'enviar',
        clase: 'btn btn--primario',
        validar: async () => {
          const error = form.querySelector('#difusionError');
          if (!texto.value.trim()) {
            error.textContent = 'Escribe el mensaje.';
            error.hidden = false;
            return false;
          }
          try {
            resultado = await api.llamar('POST', '/api/mensajes/difusion', { grupoId: selector.value, texto: texto.value.trim() });
            return true;
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            return false;
          }
        }
      }
    ]
  });
  if (!resultado) return;
  const omitidos = resultado.omitidos.length;
  ui.aviso(`Mensaje enviado a ${resultado.total} estudiante${resultado.total === 1 ? '' : 's'}${omitidos ? ` (${omitidos} no disponible${omitidos === 1 ? '' : 's'} o con bloqueo)` : ''}.`, 'exito');
  await cargarConversaciones();
  if (abierta) await consultarNuevos();
}

// ---------- Inicio ----------
async function iniciar() {
  $('btnNueva').addEventListener('click', nuevaConversacion);
  if (usuario.rol === 'docente') {
    $('btnDifusion').hidden = false;
    $('btnDifusion').addEventListener('click', mensajeAlCurso);
  }
  $('buscador').addEventListener('input', pintarLista);
  $('btnVolver').addEventListener('click', cerrarChat);
  $('btnBloquear').addEventListener('click', alternarBloqueo);
  $('btnAnteriores').addEventListener('click', verAnteriores);
  $('textoMensaje').addEventListener('input', actualizarContador);
  $('textoMensaje').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviar();
    }
  });
  $('formMensaje').addEventListener('submit', (e) => {
    e.preventDefault();
    enviar();
  });

  await cargarConversaciones();
  const inicial = util.parametro('c');
  if (inicial && conversaciones.some((c) => c.id === inicial)) await abrir(inicial);

  // Sondeos solo con la pestaña visible
  setInterval(consultarNuevos, SONDEO_CHAT_MS);
  setInterval(() => { if (document.visibilityState === 'visible') cargarConversaciones(); }, SONDEO_LISTA_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    consultarNuevos();
    cargarConversaciones();
  });
}

if (usuario) await iniciar();
