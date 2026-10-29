// publico/js/modulos/simulaciones.js
// Listado de simulaciones agrupadas por tema; docentes y admin pueden crear y editar

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Simulaciones', roles: ['sesion'] });

const MODOS = { escenarios: 'Escenarios', rol: 'Juego de roles' };
const $ = (id) => document.getElementById(id);
const usuario = usuarioActual();
const editor = usuario?.rol === 'docente' || usuario?.rol === 'admin';

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

function enlace(texto, href, clase) {
  const a = crear('a', clase, texto);
  a.href = href;
  return a;
}

function tarjeta(s) {
  const li = crear('li');
  const art = crear('article', 'simulacion-tarjeta');
  const etiquetas = crear('div', 'simulacion-tarjeta__etiquetas');
  etiquetas.append(crear('span', 'chip', MODOS[s.modo] || s.modo));
  if (editor && s.estado !== 'publicado') etiquetas.append(crear('span', 'insignia', 'Borrador'));
  const acciones = crear('div', 'simulacion-tarjeta__acciones');
  const id = encodeURIComponent(s.id);
  // Docentes y admin prueban en vista previa (no registra intentos)
  acciones.append(editor
    ? enlace('▶ Vista previa', `/paginas/simulador.html?id=${id}&vista=previa`, 'btn btn--primario btn--sm')
    : enlace('▶ Iniciar', `/paginas/simulador.html?id=${id}`, 'btn btn--primario btn--sm'));
  if (editor) acciones.append(enlace('✏️ Editar', `/paginas/editor-simulacion.html?id=${id}`, 'btn btn--secundario btn--sm'));
  art.append(crear('h3', 'simulacion-tarjeta__titulo', s.titulo), etiquetas, acciones);
  art.querySelector('a').setAttribute('aria-label', `${editor ? 'Vista previa de' : 'Iniciar'} «${s.titulo}»`);
  li.append(art);
  return li;
}

async function iniciar() {
  const temaFiltro = util.parametro('temaId');
  if (editor) {
    $('btnNueva').hidden = false;
    if (temaFiltro) $('btnNueva').href = `/paginas/editor-simulacion.html?temaId=${encodeURIComponent(temaFiltro)}`;
  }

  let simulaciones, temas, unidades, asignaturas;
  try {
    [simulaciones, temas, unidades, asignaturas] = await Promise.all(
      ['simulaciones', 'temas', 'unidades', 'asignaturas'].map((c) => api.listar(c)));
  } catch (err) {
    $('estado').textContent = `No se pudieron cargar las simulaciones: ${err.message}`;
    return;
  }
  $('estado').textContent = '';

  const temaPorId = new Map(temas.map((t) => [t.id, t]));
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));
  const asignaturaPorId = new Map(asignaturas.map((a) => [a.id, a]));
  const visibles = simulaciones.filter((s) => !temaFiltro || s.temaId === temaFiltro);

  if (temaFiltro) {
    const tema = temaPorId.get(temaFiltro);
    $('filtroTema').hidden = false;
    $('filtroTema').replaceChildren(`Mostrando el tema «${tema?.titulo || 'seleccionado'}». `, enlace('Ver todas', '/paginas/simulaciones.html', ''));
  }

  // Agrupadas por tema, en el orden de asignatura, unidad y tema
  const orden = (x) => Number(x?.orden) || 0;
  const grupos = new Map();
  for (const s of visibles) grupos.set(s.temaId, [...(grupos.get(s.temaId) || []), s]);
  const idsTemas = [...grupos.keys()].sort((a, b) => {
    const ta = temaPorId.get(a), tb = temaPorId.get(b);
    const ua = unidadPorId.get(ta?.unidadId), ub = unidadPorId.get(tb?.unidadId);
    return String(ua?.asignaturaId).localeCompare(String(ub?.asignaturaId)) || orden(ua) - orden(ub) || orden(ta) - orden(tb);
  });

  $('vacio').hidden = idsTemas.length > 0;
  if (editor) $('vacioTexto').textContent = 'Crea la primera con el botón «Nueva».';
  $('listado').replaceChildren(...idsTemas.map((temaId) => {
    const tema = temaPorId.get(temaId);
    const asignatura = asignaturaPorId.get(unidadPorId.get(tema?.unidadId)?.asignaturaId);
    const seccion = crear('section', 'simulaciones-tema');
    const titulo = crear('h2', 'simulaciones-tema__titulo', tema?.titulo || 'Tema');
    const lista = crear('ul', 'simulaciones-lista');
    lista.append(...grupos.get(temaId).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')).map(tarjeta));
    seccion.append(titulo, crear('p', 'simulaciones-tema__asignatura', asignatura?.nombre || ''), lista);
    return seccion;
  }));
}

if (usuario) await iniciar();
