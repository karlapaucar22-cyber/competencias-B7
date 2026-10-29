// publico/js/modulos/admin-reportes.js
// Reportes pendientes del foro: ver el contenido, ocultarlo o descartar el reporte

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Reportes', roles: ['admin'] });

const $ = (id) => document.getElementById(id);
let reportes = [];
let contenido = { 'foros-hilos': new Map(), 'foros-respuestas': new Map() };
let usuarios = new Map();
let contextos = new Map();
let cuentas = new Map();

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

async function cargar() {
  try {
    const [lista, hilos, respuestas, personas] = await Promise.all([
      api.listar('reportes', { estado: 'pendiente' }),
      api.listar('foros-hilos'),
      api.listar('foros-respuestas'),
      api.listar('usuarios')
    ]);
    reportes = lista.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    // Reportes de mensajes: el mensaje y los 5 anteriores
    const deMensajes = reportes.filter((r) => r.tipo === 'mensaje');
    const vistas = await Promise.all(deMensajes.map((r) => api.llamar('GET', `/api/mensajes/reporte/${encodeURIComponent(r.id)}`).catch(() => null)));
    contextos = new Map(deMensajes.map((r, i) => [r.id, vistas[i]]));
    contenido = { 'foros-hilos': new Map(hilos.map((h) => [h.id, h])), 'foros-respuestas': new Map(respuestas.map((r) => [r.id, r])) };
    usuarios = new Map(personas.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]));
    cuentas = new Map(personas.map((u) => [u.id, u]));
  } catch (err) {
    $('reportesEstado').textContent = `No se pudieron cargar los reportes: ${err.message}`;
    return;
  }
  pintar();
}

function pintar() {
  $('reportesEstado').textContent = reportes.length ? `${reportes.length} reporte${reportes.length === 1 ? '' : 's'} pendiente${reportes.length === 1 ? '' : 's'}` : '';
  $('reportesVacio').hidden = reportes.length > 0;
  $('listaReportes').replaceChildren(...reportes.map((r) => {
    if (r.tipo === 'mensaje') return reporteMensaje(r);
    const publicacion = contenido[r.coleccion]?.get(r.referenciaId);
    const esHilo = r.coleccion === 'foros-hilos';
    const hilo = esHilo ? publicacion : contenido['foros-hilos'].get(publicacion?.hiloId);
    const li = crear('li', 'reporte');

    const cabecera = crear('div', 'reporte__cabecera');
    cabecera.append(crear('span', 'insignia', esHilo ? 'Hilo' : 'Respuesta'), crear('span', 'reportes-nota',
      `Reportado por ${usuarios.get(r.reportadoPor) || 'usuario'} · ${util.fechaRelativa(r.fecha)}`));
    li.append(cabecera, crear('p', 'reporte__motivo', `Motivo: ${r.motivo}`));

    const caja = crear('div', 'reporte__contenido');
    if (!publicacion) {
      caja.append(crear('p', 'reportes-nota', 'La publicación ya no existe.'));
    } else {
      if (esHilo) caja.append(crear('h3', '', publicacion.titulo));
      else if (hilo) caja.append(crear('p', 'reportes-nota', `En el hilo «${hilo.titulo}»`));
      const texto = crear('div');
      texto.innerHTML = util.formatoBasico(publicacion.texto);
      caja.append(texto, crear('p', 'reportes-nota', `Autor: ${publicacion.autorNombre || 'participante'}${publicacion.oculto || publicacion.oculta ? ' · ya está oculto' : ''}`));
    }
    li.append(caja);

    const acciones = crear('div', 'reporte__acciones');
    const ocultar = crear('button', 'btn btn--peligro', 'Ocultar contenido');
    ocultar.type = 'button';
    ocultar.disabled = !publicacion;
    ocultar.addEventListener('click', () => resolver(r, 'ocultado'));
    const descartar = crear('button', 'btn btn--secundario', 'Descartar');
    descartar.type = 'button';
    descartar.addEventListener('click', () => resolver(r, 'descartado'));
    acciones.append(ocultar, descartar);
    if (hilo) {
      const ver = crear('a', 'btn btn--texto', 'Ver en el foro');
      ver.href = `/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}${esHilo ? '' : `#respuesta-${encodeURIComponent(publicacion.id)}`}`;
      acciones.append(ver);
    }
    li.append(acciones);
    return li;
  }));
}

// Mensaje privado reportado: participantes, los 5 anteriores y el reportado resaltado
function reporteMensaje(r) {
  const vista = contextos.get(r.id);
  const li = crear('li', 'reporte');
  const cabecera = crear('div', 'reporte__cabecera');
  cabecera.append(crear('span', 'insignia', 'Mensaje'), crear('span', 'reportes-nota',
    `Reportado por ${usuarios.get(r.reportadoPor) || 'usuario'} · ${util.fechaRelativa(r.fecha)}`));
  li.append(cabecera, crear('p', 'reporte__motivo', `Motivo: ${r.motivo}`));

  const caja = crear('div', 'reporte__contenido');
  if (!vista) {
    caja.append(crear('p', 'reportes-nota', 'El mensaje ya no existe.'));
  } else {
    const nombres = new Map(vista.conversacion.participantes.map((p) => [p.id, `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'participante']));
    caja.append(crear('p', 'reportes-nota', `Conversación entre ${[...nombres.values()].join(' y ')}`));
    const lista = crear('ol', 'reporte__mensajes');
    for (const m of [...vista.anteriores, vista.mensaje]) {
      const item = crear('li', m.id === vista.mensaje.id ? 'reporte__mensaje reporte__mensaje--reportado' : 'reporte__mensaje');
      const texto = crear('div');
      texto.innerHTML = util.formatoBasico(m.texto);
      item.append(crear('span', 'reportes-nota', `${nombres.get(m.autorId) || 'participante'} · ${util.fechaRelativa(m.fecha)}${m.oculto ? ' · oculto' : ''}`), texto);
      lista.append(item);
    }
    caja.append(lista);
  }
  li.append(caja);

  const acciones = crear('div', 'reporte__acciones');
  const ocultar = crear('button', 'btn btn--peligro', 'Ocultar mensaje');
  ocultar.type = 'button';
  ocultar.disabled = !vista || vista.mensaje.oculto;
  ocultar.addEventListener('click', () => resolver(r, 'ocultado'));

  // Desactivar al autor del mensaje (no a administradores ni a cuentas ya inactivas)
  const autor = vista && cuentas.get(vista.mensaje.autorId);
  const desactivar = crear('button', 'btn btn--secundario', autor?.activo === false ? 'Usuario desactivado' : 'Desactivar usuario');
  desactivar.type = 'button';
  desactivar.disabled = !autor || autor.activo === false || autor.rol === 'admin';
  if (autor) desactivar.setAttribute('aria-label', `Desactivar a ${usuarios.get(autor.id) || 'el autor'}`);
  desactivar.addEventListener('click', () => desactivarUsuario(autor));

  const descartar = crear('button', 'btn btn--secundario', 'Descartar');
  descartar.type = 'button';
  descartar.addEventListener('click', () => resolver(r, 'descartado'));
  acciones.append(ocultar, desactivar, descartar);
  li.append(acciones);
  return li;
}

async function desactivarUsuario(autor) {
  const nombre = usuarios.get(autor.id) || 'este usuario';
  if (!(await ui.confirmar(`¿Desactivar la cuenta de ${nombre}? No podrá ingresar a la plataforma hasta que un administrador la reactive.`))) return;
  try {
    await api.actualizar('usuarios', autor.id, { activo: false });
    ui.aviso(`Cuenta de ${nombre} desactivada. Decide ahora si ocultas el mensaje o descartas el reporte.`, 'exito');
    await cargar();
  } catch (err) {
    ui.aviso(`No se pudo desactivar la cuenta: ${err.message}`, 'error');
  }
}

async function resolver(reporte, resolucion) {
  try {
    if (resolucion === 'ocultado' && reporte.tipo === 'mensaje') {
      await api.llamar('POST', '/api/mensajes/ocultar', { referenciaId: reporte.referenciaId });
    } else if (resolucion === 'ocultado') {
      await api.actualizar(reporte.coleccion, reporte.referenciaId, reporte.coleccion === 'foros-hilos' ? { oculto: true } : { oculta: true });
    }
    // Al ocultar se resuelven todos los reportes pendientes de esa publicación
    const mismos = resolucion === 'ocultado'
      ? reportes.filter((x) => x.coleccion === reporte.coleccion && x.referenciaId === reporte.referenciaId)
      : [reporte];
    for (const x of mismos) await api.actualizar('reportes', x.id, { estado: 'resuelto', resolucion });
    ui.aviso(resolucion === 'ocultado'
      ? `Contenido oculto para estudiantes${mismos.length > 1 ? ` (${mismos.length} reportes resueltos)` : ''}.`
      : 'Reporte descartado.', 'exito');
    await cargar();
  } catch (err) {
    ui.aviso(`No se pudo resolver el reporte: ${err.message}`, 'error');
  }
}

if (usuarioActual()?.rol === 'admin') await cargar();
