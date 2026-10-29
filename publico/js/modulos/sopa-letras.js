// publico/js/modulos/sopa-letras.js
// Sopa de letras con los términos de una sola palabra del glosario del tema

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { montarAyudaNeuri } from '../nucleo/ayuda-neuri.js';

const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const MINIMO_PALABRAS = 3;
const INTENTOS_POR_PALABRA = 200;

// Direcciones como [desplazamiento fila, desplazamiento columna]
const RECTAS = [[0, 1], [1, 0]];
const DIAGONALES = [[1, 1], [-1, 1]];
const INVERTIDAS = [[0, -1], [-1, 0], [-1, -1], [1, -1]];

const DIFICULTADES = {
  facil: { palabras: 8, tamano: 10, direcciones: RECTAS },
  media: { palabras: 10, tamano: 12, direcciones: [...RECTAS, ...DIAGONALES] },
  dificil: { palabras: 12, tamano: 15, direcciones: [...RECTAS, ...DIAGONALES, ...INVERTIDAS] }
};

/**
 * Genera la sopa colocando de la palabra más larga a la más corta.
 * Permite cruces con letras iguales y descarta la palabra que no quepa.
 * @returns {{ grilla: string[][], ubicaciones: { palabra, fila, columna, direccion, celdas }[] }}
 */
export function generarSopa(palabras, tamano, direcciones, azar = Math.random) {
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(null));
  const ubicaciones = [];
  const ordenadas = [...new Set(palabras)].sort((a, b) => b.length - a.length);
  const entero = (max) => Math.floor(azar() * max);

  for (const palabra of ordenadas) {
    if (palabra.length > tamano) continue;
    for (let intento = 0; intento < INTENTOS_POR_PALABRA; intento++) {
      const [df, dc] = direcciones[entero(direcciones.length)];
      const fila = entero(tamano);
      const columna = entero(tamano);
      const celdas = [...palabra].map((_, i) => [fila + df * i, columna + dc * i]);
      const cabe = celdas.every(([f, c], i) =>
        f >= 0 && f < tamano && c >= 0 && c < tamano && (grilla[f][c] === null || grilla[f][c] === palabra[i]));
      if (!cabe) continue;
      celdas.forEach(([f, c], i) => { grilla[f][c] = palabra[i]; });
      ubicaciones.push({ palabra, fila, columna, direccion: [df, dc], celdas });
      break;
    }
  }

  for (const fila of grilla) {
    for (let c = 0; c < tamano; c++) {
      if (fila[c] === null) fila[c] = LETRAS[entero(LETRAS.length)];
    }
  }
  return { grilla, ubicaciones };
}

// Estado de la partida
let tema = null;
let candidatas = [];          // [{ id, palabra, definicion }]
let sopa = null;
let celdas = [];              // matriz de elementos
let encontradas = new Set();
let terminado = false;
let inicioSel = null;         // { f, c } inicio de la selección
let seleccion = [];
let inicio = 0;
let reloj = null;
let foco = { f: 0, c: 0 };
let ultimaFallida = '';       // letras de la última selección que no formó palabra
let ayuda = null;

const $ = (id) => document.getElementById(id);

// Neuri: pista sobre la primera palabra pendiente de la lista y explicación de la última selección fallida
function contextoNeuri(modo) {
  if (!sopa || terminado) return 'La partida terminó: empieza otra para pedir ayuda a Neuri.';
  const pendiente = sopa.ubicaciones.map((u) => u.palabra).filter((p) => !encontradas.has(p)).sort((a, b) => a.localeCompare(b, 'es'))[0];
  const termino = candidatas.find((c) => c.palabra === pendiente);
  if (!termino) return 'Ya encontraste todas las palabras.';
  if (modo === 'error' && !ultimaFallida) return 'Aún no tienes una selección fallida que explicar.';
  return {
    clave: modo === 'error' ? `error-${ultimaFallida}` : termino.id,
    datos: { temaId: tema.id, terminoId: termino.id, ...(modo === 'error' ? { seleccion: ultimaFallida } : {}) }
  };
}

async function iniciar() {
  await montarPlantilla({ titulo: 'Sopa de letras', roles: ['estudiante', 'docente'] });

  document.querySelectorAll('input[name="dificultad"]').forEach((radio) => {
    radio.addEventListener('change', nuevaPartida);
  });

  $('btnCambiarTema').addEventListener('click', async () => {
    const elegido = await obtenerTemaActividad({ forzarModal: true });
    if (elegido?.id) await cargarTema(elegido);
  });

  $('btnRendirse').addEventListener('click', async () => {
    if (terminado) return;
    if (await ui.confirmar('¿Quieres rendirte? Se mostrarán las palabras que faltan.')) finalizar(true);
  });

  const grilla = $('grilla');
  grilla.addEventListener('pointerdown', alPresionar);
  grilla.addEventListener('pointermove', alMover);
  grilla.addEventListener('pointerup', alSoltar);
  grilla.addEventListener('pointercancel', cancelarSeleccion);
  grilla.addEventListener('keydown', alTeclear);

  ayuda = montarAyudaNeuri({ actividad: 'sopa-letras', antesDe: $('contenedorRetro'), contexto: contextoNeuri });
  await cargarTema(await obtenerTemaActividad());
}

async function cargarTema(nuevoTema) {
  detenerReloj();
  if (!nuevoTema?.id) return mostrarEstado('vacio');
  tema = nuevoTema;

  const url = new URL(window.location.href);
  url.searchParams.set('temaId', tema.id);
  window.history.replaceState(null, '', url);

  $('insigniaTema').textContent = `Tema: ${tema.titulo}`;
  $('enlaceTema').href = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;
  mostrarEstado('cargando');

  let lista = [];
  try {
    lista = await api.listar('glosario', { temaId: tema.id });
  } catch (err) {
    console.error('Error al cargar el glosario:', err);
  }

  // Solo términos de una palabra, normalizados y sin repetir
  const vistas = new Map();
  for (const t of lista || []) {
    const palabra = util.normalizar(t.termino);
    if (/^[A-ZÑ]{3,}$/.test(palabra) && !vistas.has(palabra)) {
      vistas.set(palabra, { id: t.id, palabra, definicion: (t.definicion || '').trim() });
    }
  }
  candidatas = [...vistas.values()];

  if (candidatas.length < MINIMO_PALABRAS) return mostrarEstado('vacio');
  mostrarEstado('juego');
  nuevaPartida();
}

function mostrarEstado(estado) {
  $('sopaCargando').hidden = estado !== 'cargando';
  $('sopaVacio').hidden = estado !== 'vacio';
  $('sopaJuego').hidden = estado !== 'juego';
}

function nuevaPartida() {
  detenerReloj();
  const valor = document.querySelector('input[name="dificultad"]:checked').value;
  const { palabras, tamano, direcciones } = DIFICULTADES[valor];

  const aptas = candidatas.filter((c) => c.palabra.length <= tamano);
  const elegidas = util.barajar(aptas).slice(0, palabras).map((c) => c.palabra);
  sopa = generarSopa(elegidas, tamano, direcciones);
  encontradas = new Set();
  terminado = false;
  inicioSel = null;
  seleccion = [];
  foco = { f: 0, c: 0 };
  ultimaFallida = '';
  ayuda?.reiniciar();

  const aviso = $('avisoPalabras');
  const total = sopa.ubicaciones.length;
  aviso.hidden = total === palabras;
  aviso.textContent = `Se colocaron ${total} de ${palabras} palabras posibles para este tema.`;

  pintarGrilla(tamano);
  pintarLista();
  $('contenedorRetro').replaceChildren();
  $('btnRendirse').disabled = false;
  actualizarDatos();
  iniciarReloj();
}

function pintarGrilla(tamano) {
  const grilla = $('grilla');
  grilla.style.setProperty('--columnas', String(tamano));
  grilla.classList.toggle('sopa-grilla--grande', tamano > 12);
  grilla.classList.remove('esta-terminada');
  grilla.setAttribute('aria-rowcount', String(tamano));
  grilla.setAttribute('aria-colcount', String(tamano));

  celdas = sopa.grilla.map((filaLetras, f) => filaLetras.map((letra, c) => {
    const celda = document.createElement('div');
    celda.className = 'sopa-celda';
    celda.setAttribute('role', 'gridcell');
    celda.tabIndex = f === 0 && c === 0 ? 0 : -1;
    celda.dataset.f = String(f);
    celda.dataset.c = String(c);
    celda.textContent = letra;
    etiquetar(celda);
    return celda;
  }));

  grilla.replaceChildren(...celdas.map((fila) => {
    const el = document.createElement('div');
    el.className = 'sopa-fila';
    el.setAttribute('role', 'row');
    el.append(...fila);
    return el;
  }));
}

function etiquetar(celda) {
  const estado = celda.classList.contains('esta-encontrada') ? ', parte de una palabra encontrada'
    : celda.classList.contains('esta-revelada') ? ', parte de una palabra revelada' : '';
  celda.setAttribute('aria-label',
    `${celda.textContent}, fila ${Number(celda.dataset.f) + 1}, columna ${Number(celda.dataset.c) + 1}${estado}`);
}

function pintarLista() {
  $('listaPalabras').replaceChildren(...sopa.ubicaciones
    .map((u) => u.palabra)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((palabra) => {
      const li = document.createElement('li');
      li.className = 'sopa-palabra';
      li.dataset.palabra = palabra;
      li.textContent = palabra;
      return li;
    }));
}

// Celdas en línea recta desde a hacia b, ajustadas a la dirección más cercana (8 sentidos)
function linea(a, b) {
  const df = b.f - a.f;
  const dc = b.c - a.c;
  if (!df && !dc) return [a];
  const octante = Math.round(Math.atan2(df, dc) / (Math.PI / 4));
  const pf = Math.round(Math.sin(octante * Math.PI / 4));
  const pc = Math.round(Math.cos(octante * Math.PI / 4));
  const tamano = celdas.length;
  let largo = Math.max(Math.abs(df), Math.abs(dc));
  const fuera = (n) => a.f + pf * n < 0 || a.f + pf * n >= tamano || a.c + pc * n < 0 || a.c + pc * n >= tamano;
  while (largo > 0 && fuera(largo)) largo--;
  return Array.from({ length: largo + 1 }, (_, i) => ({ f: a.f + pf * i, c: a.c + pc * i }));
}

function resaltar(lista) {
  seleccion.forEach(({ f, c }) => celdas[f][c].classList.remove('esta-seleccionando'));
  seleccion = lista;
  seleccion.forEach(({ f, c }) => celdas[f][c].classList.add('esta-seleccionando'));
}

function posicion(el) {
  const celda = el?.closest?.('.sopa-celda');
  if (!celda || !$('grilla').contains(celda)) return null;
  return { f: Number(celda.dataset.f), c: Number(celda.dataset.c) };
}

// Selección con mouse y táctil
function alPresionar(evento) {
  const pos = posicion(evento.target);
  if (terminado || !pos || evento.button > 0) return;
  evento.preventDefault();
  $('grilla').setPointerCapture(evento.pointerId);
  inicioSel = pos;
  resaltar([pos]);
}

function alMover(evento) {
  if (!inicioSel) return;
  const pos = posicion(document.elementFromPoint(evento.clientX, evento.clientY));
  if (pos) resaltar(linea(inicioSel, pos));
}

function alSoltar() {
  if (!inicioSel) return;
  inicioSel = null;
  comprobar();
}

function cancelarSeleccion() {
  inicioSel = null;
  resaltar([]);
}

// Selección con teclado (foco itinerante dentro de la grilla)
function alTeclear(evento) {
  if (terminado) return;
  const pasos = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const tamano = celdas.length;

  if (pasos[evento.key]) {
    evento.preventDefault();
    const [df, dc] = pasos[evento.key];
    moverFoco({
      f: Math.min(tamano - 1, Math.max(0, foco.f + df)),
      c: Math.min(tamano - 1, Math.max(0, foco.c + dc))
    });
    if (inicioSel) resaltar(linea(inicioSel, foco));
  } else if (evento.key === 'Enter' || evento.key === ' ') {
    evento.preventDefault();
    if (!inicioSel) {
      inicioSel = { ...foco };
      resaltar([inicioSel]);
    } else {
      resaltar(linea(inicioSel, foco));
      inicioSel = null;
      comprobar();
    }
  } else if (evento.key === 'Escape') {
    cancelarSeleccion();
  }
}

function moverFoco(pos) {
  celdas[foco.f][foco.c].tabIndex = -1;
  foco = pos;
  const celda = celdas[pos.f][pos.c];
  celda.tabIndex = 0;
  celda.focus();
}

// Compara la selección con las palabras pendientes en ambos sentidos
function comprobar() {
  const texto = seleccion.map(({ f, c }) => sopa.grilla[f][c]).join('');
  const invertido = [...texto].reverse().join('');
  const marcadas = seleccion;
  resaltar([]);
  if (texto.length < MINIMO_PALABRAS) return;

  const hallada = sopa.ubicaciones.find((u) =>
    !encontradas.has(u.palabra) && (u.palabra === texto || u.palabra === invertido));
  if (!hallada) {
    ultimaFallida = texto;
    return;
  }

  encontradas.add(hallada.palabra);
  marcadas.forEach(({ f, c }) => {
    celdas[f][c].classList.add('esta-encontrada');
    etiquetar(celdas[f][c]);
  });
  marcarEnLista(hallada.palabra, 'sopa-palabra--encontrada', 'encontrada');

  const definicion = candidatas.find((c) => c.palabra === hallada.palabra)?.definicion;
  $('contenedorRetro').replaceChildren(mostrarRetro({
    correcto: true,
    explicacion: `${hallada.palabra}: ${definicion || 'término del glosario del tema.'}`
  }));
  actualizarDatos();
  if (encontradas.size === sopa.ubicaciones.length) finalizar(false);
}

function marcarEnLista(palabra, clase, estado) {
  const li = $('listaPalabras').querySelector(`[data-palabra="${palabra}"]`);
  if (!li) return;
  li.classList.add(clase);
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = ` (${estado})`;
  li.append(sr);
}

function actualizarDatos() {
  $('datoEncontradas').textContent = `${encontradas.size}/${sopa.ubicaciones.length}`;
  $('datoTiempo').textContent = formatoTiempo(segundos());
}

function segundos() {
  return inicio ? Math.round((Date.now() - inicio) / 1000) : 0;
}

function formatoTiempo(seg) {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

function iniciarReloj() {
  inicio = Date.now();
  reloj = setInterval(() => {
    $('datoTiempo').textContent = formatoTiempo(segundos());
  }, 1000);
}

function detenerReloj() {
  clearInterval(reloj);
  reloj = null;
}

async function finalizar(rendido) {
  if (terminado) return;
  terminado = true;
  detenerReloj();
  cancelarSeleccion();
  $('grilla').classList.add('esta-terminada');
  $('btnRendirse').disabled = true;

  // Revelar las palabras que faltan
  for (const u of sopa.ubicaciones) {
    if (encontradas.has(u.palabra)) continue;
    u.celdas.forEach(([f, c]) => {
      if (!celdas[f][c].classList.contains('esta-encontrada')) {
        celdas[f][c].classList.add('esta-revelada');
        etiquetar(celdas[f][c]);
      }
    });
    marcarEnLista(u.palabra, 'sopa-palabra--revelada', 'no encontrada');
  }

  const total = sopa.ubicaciones.length;
  const halladas = encontradas.size;
  const duracionSeg = Math.max(1, segundos());

  try {
    await registrarIntento({
      actividad: 'sopa-letras',
      temaId: tema.id,
      puntaje: halladas,
      maximo: total,
      errores: total - halladas,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar el intento de sopa de letras:', err);
  }

  const accion = await mostrarResumen({
    titulo: rendido
      ? `Encontraste ${halladas} de ${total} palabras`
      : `¡Encontraste las ${total} palabras en ${formatoTiempo(duracionSeg)}!`,
    aciertos: halladas,
    errores: total - halladas,
    recomendaciones: rendido
      ? 'Repasa en el tema las palabras reveladas en azul antes de volver a jugar.'
      : 'Prueba una dificultad mayor para seguir practicando.',
    enlaceTema: tema.id
  });

  if (accion === 'repetir') nuevaPartida();
  else window.location.href = '/paginas/actividades.html';
}

document.addEventListener('DOMContentLoaded', iniciar);
