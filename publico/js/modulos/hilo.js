// publico/js/modulos/hilo.js
// Hilo del foro: publicación principal, respuestas paginadas, responder, reportar y moderar

import { montarPlantilla, NOMBRE } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Foro', roles: ['sesion'] });

const $ = (id) => document.getElementById(id);
const POR_PAGINA = 20;
const MINUTOS_EDICION = 15;
const MAX_TEXTO = 5000;
const MOTIVOS = ['Contenido ofensivo o irrespetuoso', 'Spam o publicidad', 'Información falsa o engañosa', 'Datos personales expuestos', 'Otro motivo'];

const yo = usuarioActual();
const moderador = yo?.rol === 'docente' || yo?.rol === 'admin';
const hiloId = util.parametro('id');
let hilo = null;
let respuestas = [];
let pagina = 1;
let respuestaObjetivo = null;

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

const enPlazo = (p) => p.autorId === yo?.id && Date.now() - new Date(p.fecha).getTime() <= MINUTOS_EDICION * 60 * 1000;

// ---------- Carga ----------

async function cargar(irAlFinal = false) {
  try {
    [hilo, respuestas] = await Promise.all([
      api.obtener('foros-hilos', hiloId),
      api.listar('foros-respuestas', { hiloId })
    ]);
  } catch (err) {
    $('hiloEstado').textContent = /no encontrado/i.test(err.message)
      ? 'Este hilo no existe o no tienes acceso a él.'
      : `No se pudo cargar el hilo: ${err.message}`;
    return;
  }
  respuestas.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const paginas = Math.max(1, Math.ceil(respuestas.length / POR_PAGINA));
  pagina = irAlFinal ? paginas : Math.min(Math.max(1, Number(util.parametro('pagina')) || 1), paginas);

  document.title = `${hilo.titulo} · Foros · ${NOMBRE}`;
  $('enlaceForos').href = `/paginas/foros.html?asignaturaId=${encodeURIComponent(hilo.asignaturaId)}`;
  $('hiloEstado').hidden = true;
  pintarPrincipal();
  pintarRespuestas();
  $('seccionResponder').hidden = false;
  $('hiloCerrado').hidden = !hilo.cerrado;
  $('formResponder').hidden = Boolean(hilo.cerrado);
}

// ---------- Publicaciones ----------

function cabecera(p, esHilo) {
  const caja = crear('div', 'hilo-publicacion__cabecera');
  const datos = crear('div');
  if (esHilo) {
    const h1 = crear('h1', 'hilo-publicacion__titulo', p.titulo);
    h1.id = 'hiloTitulo';
    datos.append(h1);
  }
  const autor = crear('p', 'hilo-publicacion__autor');
  autor.append(crear('strong', '', p.autorNombre || 'Participante'));
  if (p.autorRol === 'docente' || p.autorRol === 'admin') autor.append(' ', crear('span', 'insignia insignia--primario', p.autorRol === 'docente' ? 'Docente' : 'Admin'));
  const fecha = crear('time', '', util.fechaRelativa(p.fecha));
  fecha.dateTime = p.fecha;
  fecha.title = new Date(p.fecha).toLocaleString('es-EC');
  autor.append(' · ', fecha, p.editado ? ' · editado' : '');
  datos.append(autor);
  caja.append(datos, menuOpciones(p, esHilo));
  return caja;
}

function etiquetas(p, esHilo) {
  const caja = crear('div', 'hilo-publicacion__etiquetas');
  if (esHilo && p.fijado) caja.append(crear('span', 'insignia insignia--acento', '📌 Fijado'));
  if (esHilo && p.cerrado) caja.append(crear('span', 'insignia', '🔒 Cerrado'));
  if (!esHilo && p.destacada) caja.append(crear('span', 'insignia insignia--primario', '⭐ Respuesta destacada'));
  if (p.oculto || p.oculta) caja.append(crear('span', 'insignia', '🙈 Oculto para estudiantes'));
  return caja.childElementCount ? caja : null;
}

function cuerpo(p) {
  const div = crear('div', 'hilo-publicacion__cuerpo');
  div.innerHTML = util.formatoBasico(p.texto);   // escapa todo el HTML; solo negritas, listas y párrafos
  return div;
}

function pintarPrincipal() {
  const art = $('hiloPrincipal');
  art.className = `hilo-publicacion hilo-publicacion--principal${hilo.oculto ? ' hilo-publicacion--oculta' : ''}`;
  art.replaceChildren(...[cabecera(hilo, true), etiquetas(hilo, true), cuerpo(hilo)].filter(Boolean));
  art.hidden = false;
}

function pintarRespuestas() {
  $('seccionRespuestas').hidden = false;
  $('tituloRespuestas').textContent = `${respuestas.length} respuesta${respuestas.length === 1 ? '' : 's'}`;
  const desde = (pagina - 1) * POR_PAGINA;
  $('listaRespuestas').start = desde + 1;
  $('listaRespuestas').replaceChildren(...respuestas.slice(desde, desde + POR_PAGINA).map((r) => {
    const li = crear('li', `hilo-publicacion${r.destacada ? ' hilo-publicacion--destacada' : ''}${r.oculta ? ' hilo-publicacion--oculta' : ''}`);
    li.id = `respuesta-${r.id}`;
    const objetivo = r.respuestaAId ? respuestas.find((otra) => otra.id === r.respuestaAId) : null;
    const contexto = objetivo ? crear('p', 'hilo-publicacion__referencia', `↳ Comentario a la propuesta de ${objetivo.autorNombre || 'otra persona'}`) : null;
    li.append(...[cabecera(r, false), contexto, etiquetas(r, false), cuerpo(r)].filter(Boolean));
    return li;
  }));
  pintarPaginacion();
}

function pintarPaginacion() {
  const paginas = Math.ceil(respuestas.length / POR_PAGINA);
  const nav = $('paginacion');
  nav.hidden = paginas <= 1;
  if (paginas <= 1) return;
  const boton = (texto, destino, etiqueta, actual = false) => {
    const b = crear('button', 'btn btn--secundario btn--sm', texto);
    b.type = 'button';
    b.disabled = destino < 1 || destino > paginas;
    if (actual) b.setAttribute('aria-current', 'page');
    b.setAttribute('aria-label', etiqueta);
    b.addEventListener('click', () => irAPagina(destino));
    return b;
  };
  nav.replaceChildren(
    boton('← Anteriores', pagina - 1, 'Página anterior'),
    ...Array.from({ length: paginas }, (_, i) => boton(String(i + 1), i + 1, `Página ${i + 1}`, i + 1 === pagina)),
    boton('Siguientes →', pagina + 1, 'Página siguiente')
  );
}

function irAPagina(n) {
  pagina = n;
  const url = new URL(window.location.href);
  url.searchParams.set('pagina', String(n));
  window.history.replaceState(null, '', url);
  pintarRespuestas();
  $('tituloRespuestas').scrollIntoView({ block: 'start' });
}

// ---------- Menú de opciones ----------

function menuOpciones(p, esHilo) {
  const coleccion = esHilo ? 'foros-hilos' : 'foros-respuestas';
  const acciones = [];
  if (!esHilo && !p.respuestaAId && p.autorId !== yo?.id && !p.oculta) {
    const texto = hilo?.titulo === 'Galería NeuroRitmo' ? '💬 Comentar esta propuesta' : '💬 Responder a esta participación';
    acciones.push([texto, () => comentarParticipacion(p)]);
  }
  if (p.autorId !== yo?.id) acciones.push(['🚩 Reportar', () => reportar(p, coleccion)]);
  if (moderador || enPlazo(p)) acciones.push(['✏️ Editar', () => editar(p, esHilo)]);
  if (moderador && esHilo) {
    acciones.push([p.fijado ? '📌 Quitar fijado' : '📌 Fijar', () => moderar(coleccion, p, { fijado: !p.fijado }, p.fijado ? 'Hilo sin fijar' : 'Hilo fijado')]);
    acciones.push([p.cerrado ? '🔓 Reabrir' : '🔒 Cerrar', () => moderar(coleccion, p, { cerrado: !p.cerrado }, p.cerrado ? 'Hilo reabierto' : 'Hilo cerrado')]);
    acciones.push([p.oculto ? '👁 Mostrar' : '🙈 Ocultar', () => moderar(coleccion, p, { oculto: !p.oculto }, p.oculto ? 'Hilo visible otra vez' : 'Hilo oculto para estudiantes')]);
  }
  if (moderador && !esHilo) {
    acciones.push([p.destacada ? '⭐ Quitar destacado' : '⭐ Destacar', () => moderar(coleccion, p, { destacada: !p.destacada }, p.destacada ? 'Respuesta sin destacar' : 'Respuesta destacada')]);
    acciones.push([p.oculta ? '👁 Mostrar' : '🙈 Ocultar', () => moderar(coleccion, p, { oculta: !p.oculta }, p.oculta ? 'Respuesta visible otra vez' : 'Respuesta oculta para estudiantes')]);
  }
  const caja = crear('div', 'hilo-opciones');
  if (!acciones.length) return caja;

  const boton = crear('button', 'btn btn--texto btn--sm', '⋯ Opciones');
  boton.type = 'button';
  boton.setAttribute('aria-haspopup', 'true');
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-label', `Opciones de ${esHilo ? 'la publicación' : `la respuesta de ${p.autorNombre}`}`);
  const menu = crear('ul', 'hilo-opciones__menu');
  menu.hidden = true;
  const cerrar = (devolver) => {
    menu.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    if (devolver) boton.focus();
  };
  for (const [texto, accion] of acciones) {
    const li = crear('li');
    const item = crear('button', '', texto);
    item.type = 'button';
    item.addEventListener('click', () => { cerrar(false); accion(); });
    li.append(item);
    menu.append(li);
  }
  boton.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = menu.hidden;
    document.querySelectorAll('.hilo-opciones__menu').forEach((m) => { m.hidden = true; });
    menu.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    if (abrir) menu.querySelector('button').focus();
  });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('button')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); cerrar(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  caja.append(boton, menu);
  return caja;
}

function comentarParticipacion(respuesta) {
  respuestaObjetivo = respuesta;
  const esGaleria = hilo?.titulo === 'Galería NeuroRitmo';
  $('respuestaObjetivoTexto').textContent = `Tu ${esGaleria ? 'comentario' : 'respuesta'} quedará vinculado a la ${esGaleria ? 'propuesta' : 'participación'} de ${respuesta.autorNombre || 'otra persona'}.`;
  $('respuestaObjetivo').hidden = false;
  textarea.placeholder = esGaleria ? 'Señala una fortaleza y una mejora posible…' : 'Amplía la idea, formula una pregunta o aporta una sugerencia…';
  textarea.focus();
  $('seccionResponder').scrollIntoView({ block: 'center' });
}

function cancelarComentarioDirigido() {
  respuestaObjetivo = null;
  $('respuestaObjetivo').hidden = true;
  textarea.placeholder = hilo?.titulo === 'Galería NeuroRitmo' ? 'Escribe tu propuesta o comentario…' : 'Comparte tu aporte al diálogo…';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.hilo-opciones')) document.querySelectorAll('.hilo-opciones__menu').forEach((m) => { m.hidden = true; });
});

async function moderar(coleccion, p, cambios, mensaje) {
  try {
    await api.actualizar(coleccion, p.id, cambios);
    ui.aviso(mensaje, 'exito');
    await cargar();
  } catch (err) {
    ui.aviso(`No se pudo aplicar: ${err.message}`, 'error');
  }
}

async function reportar(p, coleccion) {
  const form = crear('form');
  form.noValidate = true;
  form.innerHTML = `
    <fieldset class="hilo-reporte__motivos">
      <legend>¿Por qué reportas esta publicación?</legend>
      ${MOTIVOS.map((m, i) => `<label class="hilo-reporte__opcion"><input type="radio" name="motivo" value="${i}" ${i === 0 ? 'checked' : ''}> ${ui.escapar(m)}</label>`).join('')}
    </fieldset>
    <div class="campo">
      <label for="detalleReporte">Detalle (opcional)</label>
      <textarea id="detalleReporte" rows="3" maxlength="300"></textarea>
    </div>
    <p class="campo__error" id="errorReporte" role="alert" hidden></p>`;
  const accion = await ui.modal({
    titulo: 'Reportar publicación',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: 'Enviar reporte',
        valor: 'enviado',
        clase: 'btn btn--peligro',
        validar: async () => {
          const motivo = MOTIVOS[Number(form.elements.motivo.value)];
          const detalle = form.querySelector('#detalleReporte').value.trim();
          try {
            await api.crear('reportes', { tipo: 'foro', coleccion, referenciaId: p.id, motivo: detalle ? `${motivo}: ${detalle}` : motivo });
            return true;
          } catch (err) {
            const error = form.querySelector('#errorReporte');
            error.textContent = err.message;
            error.hidden = false;
            return false;
          }
        }
      }
    ]
  });
  if (accion === 'enviado') ui.aviso('Gracias. El equipo de administración revisará la publicación.', 'exito');
}

async function editar(p, esHilo) {
  const form = crear('form');
  form.noValidate = true;
  form.innerHTML = `
    ${esHilo ? '<div class="campo"><label for="editarTitulo">Título</label><input type="text" id="editarTitulo" maxlength="150"></div>' : ''}
    <div class="campo">
      <label for="editarTexto">Texto</label>
      <textarea id="editarTexto" rows="6" maxlength="${MAX_TEXTO}"></textarea>
    </div>
    <p class="campo__error" id="errorEditar" role="alert" hidden></p>`;
  if (esHilo) form.querySelector('#editarTitulo').value = p.titulo;
  form.querySelector('#editarTexto').value = p.texto;
  const accion = await ui.modal({
    titulo: esHilo ? 'Editar hilo' : 'Editar respuesta',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: 'Guardar',
        valor: 'guardado',
        clase: 'btn btn--primario',
        validar: async () => {
          const cambios = { texto: form.querySelector('#editarTexto').value };
          if (esHilo) cambios.titulo = form.querySelector('#editarTitulo').value;
          try {
            await api.actualizar(esHilo ? 'foros-hilos' : 'foros-respuestas', p.id, cambios);
            return true;
          } catch (err) {
            const error = form.querySelector('#errorEditar');
            error.textContent = err.message;
            error.hidden = false;
            return false;
          }
        }
      }
    ]
  });
  if (accion === 'guardado') {
    ui.aviso('Publicación actualizada', 'exito');
    await cargar();
  }
}

// ---------- Responder ----------

const textarea = $('textoRespuesta');
$('cancelarRespuestaObjetivo').addEventListener('click', cancelarComentarioDirigido);
textarea.addEventListener('input', () => {
  $('contadorRespuesta').textContent = `${textarea.value.length.toLocaleString('es-EC')} / ${MAX_TEXTO.toLocaleString('es-EC')}`;
});

$('formResponder').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = textarea.value.trim();
  if (!texto) {
    ui.aviso('Escribe tu respuesta antes de publicarla.', 'info');
    textarea.focus();
    return;
  }
  const boton = $('btnResponder');
  boton.disabled = true;
  try {
    const datos = { hiloId, texto };
    if (respuestaObjetivo) datos.respuestaAId = respuestaObjetivo.id;
    const nueva = await api.crear('foros-respuestas', datos);
    textarea.value = '';
    cancelarComentarioDirigido();
    $('contadorRespuesta').textContent = `0 / ${MAX_TEXTO.toLocaleString('es-EC')}`;
    ui.aviso('Respuesta publicada', 'exito');
    await cargar(true);
    document.getElementById(`respuesta-${nueva.id}`)?.scrollIntoView({ block: 'center' });
  } catch (err) {
    ui.aviso(`No se pudo publicar: ${err.message}`, 'error');
  } finally {
    boton.disabled = false;
  }
});

if (yo) {
  if (!hiloId) $('hiloEstado').textContent = 'Falta el identificador del hilo.';
  else await cargar();
}
