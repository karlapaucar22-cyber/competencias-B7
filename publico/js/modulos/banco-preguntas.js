// publico/js/modulos/banco-preguntas.js
// Banco de preguntas del quiz temático NeuroRitmo, edición manual y propuestas de la IA

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

const TEMA_QUIZ = 'tem_000014';
const NIVELES = { 1: 'Atención y funciones ejecutivas', 2: 'Memoria y aprendizaje musical', 3: 'Autorregulación emocional y diseño de microactividades musicales' };
const TIPOS = { opcion: 'Opción múltiple', vf: 'Verdadero o falso', completar: 'Completar' };
const MINIMO_APROBADAS = 10;

// Estado de la página
let temaId = '';
let nivel = 1;
let preguntas = [];
const propuestas = new Map();   // "temaId|nivel" → [{ clave, ...pregunta }]
let contadorClaves = 0;

const $ = (id) => document.getElementById(id);

// Crea un elemento con atributos y texto o hijos (el texto siempre como textContent)
function el(tag, atributos = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (clave === 'texto') nodo.textContent = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  nodo.append(...hijos.filter(Boolean));
  return nodo;
}

async function iniciar() {
  await montarPlantilla({ titulo: 'Banco de preguntas', roles: ['docente', 'admin'] });

  $('selectorTema').addEventListener('change', (e) => cambiarTema(e.target.value));
  $('btnNueva').addEventListener('click', () => editar(null));
  $('btnGenerar').addEventListener('click', generarConIa);
  $('btnAprobarTodas').addEventListener('click', aprobarTodas);
  $('btnDescartarTodas').addEventListener('click', () => {
    propuestas.delete(claveActual());
    pintarPropuestas();
  });

  pintarPestanas();
  await cargarTemas();
}

async function cargarTemas() {
  let asignaturas = [], unidades = [], temas = [];
  try {
    [asignaturas, unidades, temas] = await Promise.all([
      api.listar('asignaturas'), api.listar('unidades'), api.listar('temas')
    ]);
  } catch (err) {
    ui.aviso(`No se pudieron cargar los temas: ${err.message}`, 'error');
  }

  temas = temas.filter((tema) => tema.id === TEMA_QUIZ);
  unidades = unidades.filter((unidad) => unidad.id === 'uni_000002');
  asignaturas = asignaturas.filter((asignatura) => asignatura.id === 'asi_000001');

  const selector = $('selectorTema');
  selector.replaceChildren(el('option', { value: '', texto: 'Selecciona un tema' }));

  // Agrupa los temas por asignatura y unidad, respetando el orden
  const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0);
  let total = 0;
  for (const asig of asignaturas) {
    for (const unidad of unidades.filter((u) => u.asignaturaId === asig.id).sort(porOrden)) {
      const temasUnidad = temas.filter((t) => t.unidadId === unidad.id).sort(porOrden);
      if (!temasUnidad.length) continue;
      const grupo = el('optgroup', { label: `${asig.nombre} · ${unidad.titulo}` });
      temasUnidad.forEach((t) => grupo.append(el('option', { value: t.id, texto: t.titulo })));
      selector.append(grupo);
      total += temasUnidad.length;
    }
  }

  if (!total) {
    $('bancoVacio').hidden = false;
    selector.disabled = true;
    return;
  }

  const inicial = util.parametro('temaId');
  if (inicial && selector.querySelector(`option[value="${CSS.escape(inicial)}"]`)) {
    selector.value = inicial;
    await cambiarTema(inicial);
  }
}

async function cambiarTema(id) {
  temaId = id;
  $('bancoContenido').hidden = !temaId;
  if (!temaId) return;

  const url = new URL(window.location.href);
  url.searchParams.set('temaId', temaId);
  window.history.replaceState(null, '', url);
  await recargar();
}

async function recargar() {
  try {
    preguntas = await api.listar('preguntas', { temaId });
  } catch (err) {
    preguntas = [];
    ui.aviso(`No se pudieron cargar las preguntas: ${err.message}`, 'error');
  }
  pintarPestanas();
  pintarLista();
  pintarPropuestas();
}

const claveActual = () => `${temaId}|${nivel}`;
const delNivel = (n) => preguntas.filter((p) => Number(p.nivel) === n);
const aprobadas = (n) => delNivel(n).filter((p) => p.estado === 'aprobado').length;

// Pestañas Nivel 1 a 5 con contador de aprobadas
function pintarPestanas() {
  const lista = $('pestanasNivel');
  lista.replaceChildren(...Object.entries(NIVELES).map(([n, nombre]) => {
    n = Number(n);
    const cantidad = aprobadas(n);
    const activa = n === nivel;
    return el('button', {
      type: 'button',
      role: 'tab',
      id: `pestana-${n}`,
      class: 'pestanas__boton',
      'aria-selected': String(activa),
      'aria-controls': 'panelNivel',
      tabindex: activa ? '0' : '-1',
      'data-nivel': String(n),
      onclick: () => elegirNivel(n),
      onkeydown: navegarPestanas
    },
    el('span', { texto: `Nivel ${n} · ${nombre}` }),
    el('span', {
      class: `pestanas__contador${cantidad < MINIMO_APROBADAS ? ' pestanas__contador--bajo' : ''}`,
      'aria-label': `${cantidad} aprobadas`,
      texto: String(cantidad)
    }));
  }));
  $('panelNivel').setAttribute('aria-labelledby', `pestana-${nivel}`);
}

function navegarPestanas(evento) {
  const teclas = { ArrowRight: nivel % 3 + 1, ArrowLeft: (nivel + 1) % 3 + 1, Home: 1, End: 3 };
  if (!(evento.key in teclas)) return;
  evento.preventDefault();
  elegirNivel(teclas[evento.key]);
  $(`pestana-${nivel}`).focus();
}

function elegirNivel(n) {
  nivel = n;
  pintarPestanas();
  pintarLista();
  pintarPropuestas();
}

function pintarLista() {
  const cantidad = aprobadas(nivel);
  const aviso = $('avisoMinimo');
  aviso.hidden = cantidad >= MINIMO_APROBADAS;
  aviso.replaceChildren(
    el('strong', { texto: `Nivel ${nivel} · ${NIVELES[nivel]}: ${cantidad} de ${MINIMO_APROBADAS} preguntas aprobadas` }),
    el('span', { texto: `Agrega al menos ${MINIMO_APROBADAS - cantidad} más para que el quiz tenga variedad y no repita preguntas.` })
  );

  const lista = delNivel(nivel).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  $('listaVacia').hidden = lista.length > 0;
  $('listaPreguntas').replaceChildren(...lista.map((p) => tarjetaPregunta(p, [
    el('button', { type: 'button', class: 'btn btn--secundario btn--sm', texto: 'Editar',
      'aria-label': `Editar: ${p.enunciado}`, onclick: () => editar(p) }),
    el('button', { type: 'button', class: 'btn btn--peligro btn--sm', texto: 'Eliminar',
      'aria-label': `Eliminar: ${p.enunciado}`, onclick: () => eliminar(p) })
  ])));
}

function textoRespuesta(p) {
  if (p.tipo === 'opcion') return p.opciones?.[p.correcta] ?? '(sin respuesta)';
  if (p.tipo === 'vf') return p.correcta === true ? 'Verdadero' : p.correcta === false ? 'Falso' : '(sin respuesta)';
  return p.correcta || '(sin respuesta)';
}

function tarjetaPregunta(p, acciones, errores = []) {
  return el('li', { class: 'banco-item' },
    el('div', { class: 'banco-item__cuerpo' },
      el('p', { class: 'banco-item__enunciado', texto: p.enunciado || '(sin enunciado)' }),
      el('p', { class: 'banco-item__respuesta', texto: `Respuesta: ${textoRespuesta(p)}` }),
      el('div', { class: 'banco-item__etiquetas' },
        el('span', { class: 'chip', texto: TIPOS[p.tipo] || 'Tipo no válido' }),
        p.estado && el('span', { class: `insignia banco-estado--${p.estado}`, texto: p.estado === 'aprobado' ? 'Aprobada' : 'Borrador' }),
        p.origen === 'ia' && el('span', { class: 'insignia insignia--acento', texto: 'IA' })),
      errores.length > 0 && el('p', { class: 'banco-item__error', texto: `Revisar antes de aprobar: ${errores.join(' · ')}` })),
    el('div', { class: 'banco-item__acciones' }, ...acciones));
}

// Validación en el navegador (el servidor valida igual en el gancho)
function validarPregunta(p) {
  const errores = [];
  if (!TIPOS[p.tipo]) errores.push('Tipo no válido');
  if (!p.enunciado?.trim()) errores.push('Falta el enunciado');
  if (p.tipo === 'opcion') {
    const opciones = Array.isArray(p.opciones) ? p.opciones : [];
    if (opciones.length !== 4 || opciones.some((o) => typeof o !== 'string' || !o.trim())) errores.push('Se necesitan 4 opciones con texto');
    else if (new Set(opciones.map((o) => o.trim().toLowerCase())).size !== 4) errores.push('Las opciones no pueden repetirse');
    if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta > 3) errores.push('Marca la opción correcta');
  } else if (p.tipo === 'vf') {
    if (typeof p.correcta !== 'boolean') errores.push('Indica si es verdadero o falso');
  } else if (p.tipo === 'completar') {
    if (!p.enunciado?.includes('____')) errores.push('El enunciado debe incluir "____"');
    if (typeof p.correcta !== 'string' || !p.correcta.trim()) errores.push('Escribe la respuesta correcta');
  }
  return errores;
}

/**
 * Modal de edición. Devuelve los datos de la pregunta o null si se cancela.
 * @param {Object|null} pregunta  existente, propuesta o null (nueva)
 * @param {boolean} esPropuesta   oculta el estado: al guardar queda aprobada
 */
async function abrirEditor(pregunta, esPropuesta = false) {
  const base = pregunta || { tipo: 'opcion', opciones: ['', '', '', ''], correcta: 0, estado: 'aprobado' };
  const id = `ed${++contadorClaves}`;
  let resultado = null;

  const tipo = el('select', { id: `${id}-tipo` },
    ...Object.entries(TIPOS).map(([v, t]) => el('option', { value: v, texto: t })));
  tipo.value = TIPOS[base.tipo] ? base.tipo : 'opcion';
  const enunciado = el('textarea', { id: `${id}-enunciado`, rows: '3', required: true });
  enunciado.value = base.enunciado || '';
  const retro = el('textarea', { id: `${id}-retro`, rows: '2' });
  retro.value = base.retroalimentacion || '';
  const estado = el('select', { id: `${id}-estado` },
    el('option', { value: 'aprobado', texto: 'Aprobada (entra al quiz)' }),
    el('option', { value: 'borrador', texto: 'Borrador' }));
  estado.value = base.estado === 'borrador' ? 'borrador' : 'aprobado';
  const respuesta = el('div');
  const errores = el('ul', { class: 'banco-form__errores campo__error', role: 'alert', hidden: true });

  // Valores en edición, conservados al cambiar de tipo
  const borrador = {
    opciones: Array.from({ length: 4 }, (_, i) => (base.tipo === 'opcion' && base.opciones?.[i]) || ''),
    correctaOpcion: base.tipo === 'opcion' && Number.isInteger(base.correcta) ? base.correcta : 0,
    correctaVf: base.tipo === 'vf' ? base.correcta : true,
    correctaTexto: base.tipo === 'completar' && typeof base.correcta === 'string' ? base.correcta : ''
  };

  function leerRespuesta() {
    if (tipo.dataset.pintado === 'opcion') {
      borrador.opciones = [...respuesta.querySelectorAll('input[type="text"]')].map((i) => i.value);
      const marcada = respuesta.querySelector('input[type="radio"]:checked');
      borrador.correctaOpcion = marcada ? Number(marcada.value) : null;
    } else if (tipo.dataset.pintado === 'vf') {
      const marcada = respuesta.querySelector('input[type="radio"]:checked');
      borrador.correctaVf = marcada ? marcada.value === 'true' : null;
    } else if (tipo.dataset.pintado === 'completar') {
      borrador.correctaTexto = respuesta.querySelector('input').value;
    }
  }

  function pintarRespuesta() {
    leerRespuesta();
    tipo.dataset.pintado = tipo.value;
    if (tipo.value === 'opcion') {
      respuesta.replaceChildren(el('fieldset', {},
        el('legend', { texto: 'Opciones (marca la correcta)' }),
        ...borrador.opciones.map((texto, i) => {
          const campo = el('input', { type: 'text', id: `${id}-op${i}`, 'aria-label': `Texto de la opción ${i + 1}` });
          campo.value = texto;
          return el('div', { class: 'banco-opcion' },
            el('input', { type: 'radio', name: `${id}-correcta`, value: String(i),
              'aria-label': `La opción ${i + 1} es la correcta`, checked: borrador.correctaOpcion === i }),
            campo);
        })));
    } else if (tipo.value === 'vf') {
      respuesta.replaceChildren(el('fieldset', {},
        el('legend', { texto: 'Respuesta correcta' }),
        el('div', { class: 'banco-vf' },
          el('label', {}, el('input', { type: 'radio', name: `${id}-vf`, value: 'true', checked: borrador.correctaVf === true }), ' Verdadero'),
          el('label', {}, el('input', { type: 'radio', name: `${id}-vf`, value: 'false', checked: borrador.correctaVf === false }), ' Falso'))));
    } else {
      const campo = el('input', { type: 'text', id: `${id}-completar` });
      campo.value = borrador.correctaTexto;
      respuesta.replaceChildren(el('div', { class: 'campo' },
        el('label', { for: `${id}-completar`, texto: 'Respuesta correcta (palabra o frase corta)' }),
        campo,
        el('span', { class: 'banco-nota', texto: 'Escribe "____" (cuatro guiones bajos) en el enunciado donde va la respuesta.' })));
    }
  }

  function recoger() {
    leerRespuesta();
    const datos = {
      tipo: tipo.value,
      enunciado: enunciado.value.trim(),
      retroalimentacion: retro.value.trim(),
      estado: esPropuesta ? 'aprobado' : estado.value
    };
    if (datos.tipo === 'opcion') {
      datos.opciones = borrador.opciones.map((o) => o.trim());
      datos.correcta = borrador.correctaOpcion;
    } else if (datos.tipo === 'vf') {
      datos.opciones = ['Verdadero', 'Falso'];
      datos.correcta = borrador.correctaVf;
    } else {
      datos.opciones = [];
      datos.correcta = borrador.correctaTexto.trim();
    }
    return datos;
  }

  tipo.addEventListener('change', pintarRespuesta);
  pintarRespuesta();

  const formulario = el('form', { class: 'banco-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
    errores,
    el('div', { class: 'campo' }, el('label', { for: `${id}-tipo`, texto: 'Tipo' }), tipo),
    el('div', { class: 'campo' }, el('label', { for: `${id}-enunciado`, texto: 'Enunciado' }), enunciado),
    respuesta,
    el('div', { class: 'campo' }, el('label', { for: `${id}-retro`, texto: 'Retroalimentación (por qué es correcta)' }), retro),
    !esPropuesta && el('div', { class: 'campo' }, el('label', { for: `${id}-estado`, texto: 'Estado' }), estado));

  const accion = await ui.modal({
    titulo: pregunta?.id ? 'Editar pregunta' : esPropuesta ? 'Editar propuesta de la IA' : `Nueva pregunta · Nivel ${nivel}`,
    contenido: formulario,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: esPropuesta ? 'Aprobar y guardar' : 'Guardar',
        valor: 'guardar',
        clase: 'btn btn--primario',
        validar: () => {
          const datos = recoger();
          const lista = validarPregunta(datos);
          errores.hidden = lista.length === 0;
          errores.replaceChildren(...lista.map((m) => el('li', { texto: m })));
          if (lista.length) {
            errores.scrollIntoView({ block: 'nearest' });
            return false;
          }
          resultado = datos;
          return true;
        }
      }
    ]
  });
  return accion === 'guardar' ? resultado : null;
}

async function editar(pregunta) {
  const datos = await abrirEditor(pregunta);
  if (!datos) return;
  try {
    if (pregunta?.id) await api.actualizar('preguntas', pregunta.id, datos);
    else await api.crear('preguntas', { ...datos, temaId, nivel, origen: 'docente' });
    ui.aviso('Pregunta guardada', 'exito');
    await recargar();
  } catch (err) {
    ui.aviso(`No se pudo guardar: ${err.message}`, 'error');
  }
}

async function eliminar(pregunta) {
  if (!(await ui.confirmar(`¿Eliminar la pregunta "${pregunta.enunciado}"?`))) return;
  try {
    await api.eliminar('preguntas', pregunta.id);
    ui.aviso('Pregunta eliminada', 'exito');
    await recargar();
  } catch (err) {
    ui.aviso(`No se pudo eliminar: ${err.message}`, 'error');
  }
}

// ---------- Propuestas de la IA ----------

// Convierte la respuesta de la IA a la forma de una pregunta
function normalizarPropuesta(p) {
  const tipo = String(p?.tipo || '').toLowerCase();
  const propuesta = {
    clave: ++contadorClaves,
    tipo,
    enunciado: String(p?.enunciado || '').trim(),
    retroalimentacion: String(p?.retroalimentacion || '').trim(),
    opciones: Array.isArray(p?.opciones) ? p.opciones.map((o) => String(o)) : [],
    correcta: p?.correcta
  };
  if (tipo === 'opcion' && typeof propuesta.correcta === 'string' && /^\d$/.test(propuesta.correcta)) {
    propuesta.correcta = Number(propuesta.correcta);
  }
  if (tipo === 'vf') {
    propuesta.opciones = ['Verdadero', 'Falso'];
    if (typeof propuesta.correcta === 'string') {
      const valor = util.normalizar(propuesta.correcta);
      propuesta.correcta = valor === 'TRUE' || valor === 'VERDADERO' ? true : valor === 'FALSE' || valor === 'FALSO' ? false : null;
    }
  }
  if (tipo === 'completar') {
    propuesta.opciones = [];
    propuesta.correcta = String(propuesta.correcta ?? '').trim();
  }
  return propuesta;
}

async function generarConIa() {
  const entrada = $('cantidadIa');
  const cantidad = Math.min(15, Math.max(5, Math.round(Number(entrada.value) || 5)));
  entrada.value = String(cantidad);

  const boton = $('btnGenerar');
  boton.disabled = true;
  ui.cargando(true);
  try {
    const respuesta = await api.ia('generar-preguntas', { temaId, nivel, cantidad });
    const lista = Array.isArray(respuesta) ? respuesta
      : respuesta?.preguntas || respuesta?.resultado || respuesta?.datos || [];
    if (!Array.isArray(lista) || !lista.length) throw new Error('La IA no devolvió preguntas');

    const clave = claveActual();
    propuestas.set(clave, [...(propuestas.get(clave) || []), ...lista.map(normalizarPropuesta)]);
    pintarPropuestas();
    ui.aviso(`La IA propuso ${lista.length} preguntas. Revísalas antes de aprobarlas.`, 'exito');
    $('tituloPropuestas').scrollIntoView({ block: 'start' });
  } catch (err) {
    ui.aviso(`No se pudo generar con IA: ${err.message}`, 'error');
  } finally {
    ui.cargando(false);
    boton.disabled = false;
  }
}

function pintarPropuestas() {
  const lista = propuestas.get(claveActual()) || [];
  $('seccionPropuestas').hidden = lista.length === 0;
  $('btnAprobarTodas').disabled = !lista.some((p) => validarPregunta(p).length === 0);
  $('listaPropuestas').replaceChildren(...lista.map((p) => {
    const errores = validarPregunta(p);
    return tarjetaPregunta({ ...p, origen: 'ia' }, [
      el('button', { type: 'button', class: 'btn btn--primario btn--sm', texto: 'Aprobar', disabled: errores.length > 0,
        'aria-label': `Aprobar: ${p.enunciado}`, onclick: () => aprobar(p) }),
      el('button', { type: 'button', class: 'btn btn--secundario btn--sm', texto: 'Editar',
        'aria-label': `Editar propuesta: ${p.enunciado}`, onclick: () => editarPropuesta(p) }),
      el('button', { type: 'button', class: 'btn btn--texto btn--sm', texto: 'Descartar',
        'aria-label': `Descartar: ${p.enunciado}`, onclick: () => quitarPropuesta(p) })
    ], errores);
  }));
}

function quitarPropuesta(p) {
  const clave = claveActual();
  propuestas.set(clave, (propuestas.get(clave) || []).filter((x) => x.clave !== p.clave));
  pintarPropuestas();
}

async function guardarPropuesta(p, datos) {
  const { clave, ...pregunta } = { ...p, ...datos };
  await api.crear('preguntas', { ...pregunta, temaId, nivel, origen: 'ia', estado: 'aprobado' });
  quitarPropuesta(p);
}

async function aprobar(p) {
  try {
    await guardarPropuesta(p);
    ui.aviso('Pregunta aprobada', 'exito');
    await recargar();
  } catch (err) {
    ui.aviso(`No se pudo aprobar: ${err.message}`, 'error');
  }
}

async function editarPropuesta(p) {
  const datos = await abrirEditor(p, true);
  if (!datos) return;
  await aprobar({ ...p, ...datos });
}

async function aprobarTodas() {
  const validas = (propuestas.get(claveActual()) || []).filter((p) => validarPregunta(p).length === 0);
  let guardadas = 0;
  for (const p of validas) {
    try {
      await guardarPropuesta(p);
      guardadas++;
    } catch (err) {
      ui.aviso(`No se pudo aprobar "${p.enunciado}": ${err.message}`, 'error');
    }
  }
  if (guardadas) ui.aviso(`${guardadas} preguntas aprobadas`, 'exito');
  await recargar();
}

document.addEventListener('DOMContentLoaded', iniciar);
