// publico/js/modulos/foros.js
// Foros por asignatura: hilos (fijados primero), respuestas y nuevo hilo

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Foros', roles: ['sesion'] });

const $ = (id) => document.getElementById(id);
const MAX_TEXTO = 5000;
let asignaturas = [];
let temas = [];          // temas de la asignatura elegida
let hilos = [];
let conteo = new Map();  // hiloId → número de respuestas

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

async function iniciar() {
  try {
    [asignaturas] = await Promise.all([api.listar('asignaturas')]);
  } catch (err) {
    $('forosEstado').textContent = `No se pudieron cargar las asignaturas: ${err.message}`;
    return;
  }
  const selector = $('selectorAsignatura');
  if (!asignaturas.length) {
    selector.replaceChildren(crear('option', '', 'Sin asignaturas'));
    selector.disabled = true;
    $('vacioTitulo').textContent = 'No participas en ninguna asignatura';
    $('vacioTexto').textContent = 'Los foros aparecen cuando perteneces a un grupo.';
    $('forosVacio').hidden = false;
    return;
  }
  selector.replaceChildren(...asignaturas.map((a) => Object.assign(crear('option', '', a.nombre), { value: a.id })));
  const inicial = util.parametro('asignaturaId');
  if (inicial && asignaturas.some((a) => a.id === inicial)) selector.value = inicial;
  selector.addEventListener('change', () => cargarAsignatura());
  $('selectorTema').addEventListener('change', () => { guardarFiltros(); pintarHilos(); });
  $('btnNuevoHilo').addEventListener('click', nuevoHilo);
  await cargarAsignatura(util.parametro('temaId'));
}

function guardarFiltros() {
  const url = new URL(window.location.href);
  url.searchParams.set('asignaturaId', $('selectorAsignatura').value);
  if ($('selectorTema').value) url.searchParams.set('temaId', $('selectorTema').value);
  else url.searchParams.delete('temaId');
  window.history.replaceState(null, '', url);
}

async function cargarAsignatura(temaInicial = '') {
  const asignaturaId = $('selectorAsignatura').value;
  $('forosEstado').textContent = 'Cargando hilos...';
  try {
    const [unidades, todosTemas, lista, respuestas] = await Promise.all([
      api.listar('unidades', { asignaturaId }),
      api.listar('temas'),
      api.listar('foros-hilos', { asignaturaId }),
      api.listar('foros-respuestas')
    ]);
    const idsUnidades = new Set(unidades.filter((u) => u.visible !== false).map((u) => u.id));
    temas = todosTemas.filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado');
    hilos = lista;
    conteo = new Map();
    for (const r of respuestas) conteo.set(r.hiloId, (conteo.get(r.hiloId) || 0) + 1);
  } catch (err) {
    $('forosEstado').textContent = `No se pudieron cargar los hilos: ${err.message}`;
    return;
  }
  $('selectorTema').replaceChildren(crear('option', '', 'Todos los temas'), ...temas.map((t) => Object.assign(crear('option', '', t.titulo), { value: t.id })));
  $('selectorTema').firstChild.value = '';
  if (temaInicial && temas.some((t) => t.id === temaInicial)) $('selectorTema').value = temaInicial;
  $('btnNuevoHilo').disabled = false;
  guardarFiltros();
  pintarHilos();
}

function pintarHilos() {
  const temaId = $('selectorTema').value;
  const lista = hilos
    // El foro general acompaña toda la asignatura y permanece visible al filtrar por tema.
    .filter((h) => !temaId || h.temaId === temaId || !h.temaId)
    .sort((a, b) => (b.fijado === true) - (a.fijado === true) || String(b.ultimoMovimiento || b.fecha).localeCompare(String(a.ultimoMovimiento || a.fecha)));

  $('forosEstado').textContent = `${lista.length} hilo${lista.length === 1 ? '' : 's'}${temaId ? ' en este tema' : ''}`;
  $('forosVacio').hidden = lista.length > 0;
  $('vacioTitulo').textContent = 'Aún no hay hilos';
  $('vacioTexto').textContent = temaId ? 'Nadie ha abierto un hilo sobre este tema. ¡Inicia la conversación!' : 'Sé la primera persona en iniciar una conversación.';

  $('listaHilos').replaceChildren(...lista.map((h) => {
    const li = crear('li', `foros-hilo${h.fijado ? ' foros-hilo--fijado' : ''}${h.oculto ? ' foros-hilo--oculto' : ''}`);
    const titulo = crear('h2', 'foros-hilo__titulo');
    const enlace = crear('a', '', h.titulo);
    enlace.href = `/paginas/hilo.html?id=${encodeURIComponent(h.id)}`;
    titulo.append(enlace);

    const etiquetas = crear('div', 'foros-hilo__etiquetas');
    if (h.fijado) etiquetas.append(crear('span', 'insignia insignia--acento', '📌 Fijado'));
    if (h.cerrado) etiquetas.append(crear('span', 'insignia', '🔒 Cerrado'));
    if (h.oculto) etiquetas.append(crear('span', 'insignia', '🙈 Oculto para estudiantes'));
    const tema = temas.find((t) => t.id === h.temaId);
    if (tema) etiquetas.append(crear('span', 'chip', tema.titulo));

    const respuestas = conteo.get(h.id) || 0;
    const movimiento = crear('time', '', util.fechaRelativa(h.ultimoMovimiento || h.fecha));
    movimiento.dateTime = h.ultimoMovimiento || h.fecha;
    const meta = crear('p', 'foros-hilo__meta');
    meta.append(`Por ${h.autorNombre || 'participante'} · ${respuestas} respuesta${respuestas === 1 ? '' : 's'} · último movimiento `, movimiento);

    li.append(titulo, etiquetas, meta);
    return li;
  }));
}

async function nuevoHilo() {
  const form = crear('form');
  form.noValidate = true;
  form.innerHTML = `
    <div class="campo">
      <label for="hiloTitulo">Título</label>
      <input type="text" id="hiloTitulo" maxlength="150" required>
    </div>
    <div class="campo">
      <label for="hiloTema">Tema (opcional)</label>
      <select id="hiloTema"><option value="">Sin tema específico</option></select>
    </div>
    <div class="campo">
      <label for="hiloTexto">Mensaje</label>
      <textarea id="hiloTexto" rows="6" maxlength="${MAX_TEXTO}" required aria-describedby="hiloContador"></textarea>
      <span id="hiloContador" class="foros-contador">0 / ${MAX_TEXTO.toLocaleString('es-EC')}</span>
      <span class="foros-nota">Puedes usar **negrita** y listas con "- ". Podrás editarlo durante 15 minutos.</span>
    </div>
    <p class="campo__error" id="hiloError" role="alert" hidden></p>`;
  const selTema = form.querySelector('#hiloTema');
  temas.forEach((t) => selTema.append(Object.assign(crear('option', '', t.titulo), { value: t.id })));
  selTema.value = $('selectorTema').value;
  const texto = form.querySelector('#hiloTexto');
  texto.addEventListener('input', () => { form.querySelector('#hiloContador').textContent = `${texto.value.length.toLocaleString('es-EC')} / ${MAX_TEXTO.toLocaleString('es-EC')}`; });

  let creado = null;
  await ui.modal({
    titulo: 'Nuevo hilo',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: 'Publicar',
        valor: 'publicar',
        clase: 'btn btn--primario',
        validar: async () => {
          const error = form.querySelector('#hiloError');
          const datos = {
            asignaturaId: $('selectorAsignatura').value,
            temaId: selTema.value || null,
            titulo: form.querySelector('#hiloTitulo').value.trim(),
            texto: texto.value.trim()
          };
          if (!datos.titulo || !datos.texto) {
            error.textContent = 'Escribe un título y un mensaje.';
            error.hidden = false;
            return false;
          }
          try {
            creado = await api.crear('foros-hilos', datos);
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
  if (creado) window.location.href = `/paginas/hilo.html?id=${encodeURIComponent(creado.id)}`;
}

if (usuarioActual()) await iniciar();
