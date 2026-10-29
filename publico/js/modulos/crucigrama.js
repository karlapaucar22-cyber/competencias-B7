// publico/js/modulos/crucigrama.js
// Crucigrama con los términos de una sola palabra del glosario del tema

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { montarAyudaNeuri } from '../nucleo/ayuda-neuri.js';

const MIN_LETRAS = 3;
const MAX_LETRAS = 12;
const MAX_CANDIDATOS = 15;
const MAX_PALABRAS = 12;      // objetivo: 8 a 12 palabras colocadas
const ORDENES = 30;
const MAX_REVELADAS = 3;

// ---------- Generador (función pura) ----------

const clave = (f, c) => `${f},${c}`;
const PASO = { horizontal: [0, 1], vertical: [1, 0] };

function barajarCon(lista, azar) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Construye un crucigrama con un orden dado: la primera palabra va en el centro
function construir(orden) {
  const celdas = new Map();   // "f,c" → { letra, dirs: Set }
  const colocadas = [];
  const limites = { fMin: 0, fMax: 0, cMin: 0, cMax: 0 };

  function poner(item, f, c, direccion) {
    const [df, dc] = PASO[direccion];
    for (let k = 0; k < item.palabra.length; k++) {
      const ff = f + df * k, cc = c + dc * k;
      const celda = celdas.get(clave(ff, cc)) || { letra: item.palabra[k], dirs: new Set() };
      celda.dirs.add(direccion);
      celdas.set(clave(ff, cc), celda);
      limites.fMin = Math.min(limites.fMin, ff); limites.fMax = Math.max(limites.fMax, ff);
      limites.cMin = Math.min(limites.cMin, cc); limites.cMax = Math.max(limites.cMax, cc);
    }
    colocadas.push({ ...item, fila: f, col: c, direccion });
  }

  // Cruces si la palabra cabe sin tocar otras en paralelo ni en los extremos; -1 si no cabe
  function cruces(palabra, f, c, direccion) {
    const [df, dc] = PASO[direccion];
    const [pf, pc] = direccion === 'horizontal' ? [1, 0] : [0, 1];
    if (celdas.has(clave(f - df, c - dc)) || celdas.has(clave(f + df * palabra.length, c + dc * palabra.length))) return -1;
    let n = 0;
    for (let k = 0; k < palabra.length; k++) {
      const ff = f + df * k, cc = c + dc * k;
      const celda = celdas.get(clave(ff, cc));
      if (celda) {
        if (celda.letra !== palabra[k] || celda.dirs.has(direccion)) return -1;
        n++;
      } else if (celdas.has(clave(ff + pf, cc + pc)) || celdas.has(clave(ff - pf, cc - pc))) {
        return -1;
      }
    }
    return n > 0 ? n : -1;
  }

  const area = (f, c, direccion, largo) => {
    const [df, dc] = PASO[direccion];
    const fMin = Math.min(limites.fMin, f), fMax = Math.max(limites.fMax, f + df * (largo - 1));
    const cMin = Math.min(limites.cMin, c), cMax = Math.max(limites.cMax, c + dc * (largo - 1));
    return (fMax - fMin + 1) * (cMax - cMin + 1);
  };

  poner(orden[0], 0, 0, 'horizontal');
  for (const item of orden.slice(1)) {
    if (colocadas.length >= MAX_PALABRAS) break;
    let mejor = null;
    for (const [k, celda] of celdas) {
      const [f, c] = k.split(',').map(Number);
      for (const direccion of ['horizontal', 'vertical']) {
        if (celda.dirs.has(direccion)) continue;
        for (let i = 0; i < item.palabra.length; i++) {
          if (item.palabra[i] !== celda.letra) continue;
          const f0 = direccion === 'vertical' ? f - i : f;
          const c0 = direccion === 'horizontal' ? c - i : c;
          const n = cruces(item.palabra, f0, c0, direccion);
          if (n < 0) continue;
          const a = area(f0, c0, direccion, item.palabra.length);
          if (!mejor || n > mejor.n || (n === mejor.n && a < mejor.a)) mejor = { f: f0, c: c0, direccion, n, a };
        }
      }
    }
    if (mejor) poner(item, mejor.f, mejor.c, mejor.direccion);
  }
  return { colocadas, limites, area: (limites.fMax - limites.fMin + 1) * (limites.cMax - limites.cMin + 1) };
}

/**
 * Genera un crucigrama: la palabra más larga en el centro y las demás donde crucen con letras iguales.
 * Prueba 30 órdenes y conserva el de más palabras colocadas y menor área; recorta la cuadrícula.
 * @param {Array<string | { palabra, pista }>} palabras  ya normalizadas (mayúsculas, sin tildes)
 * @returns {{ filas, columnas, entradas: [{ numero, palabra, pista, fila, col, direccion }] }}
 */
export function generarCrucigrama(palabras, azar = Math.random) {
  const vistas = new Set();
  const lista = [];
  for (const p of palabras) {
    const item = typeof p === 'string' ? { palabra: p, pista: '' } : { palabra: p.palabra, pista: p.pista || '' };
    if (item.palabra && !vistas.has(item.palabra)) {
      vistas.add(item.palabra);
      lista.push(item);
    }
  }
  if (!lista.length) return { filas: 0, columnas: 0, entradas: [] };

  const [primera, ...resto] = [...lista].sort((a, b) => b.palabra.length - a.palabra.length);
  let mejor = null;
  for (let intento = 0; intento < ORDENES; intento++) {
    const orden = [primera, ...(intento === 0 ? resto : barajarCon(resto, azar))];
    const r = construir(orden);
    if (!mejor || r.colocadas.length > mejor.colocadas.length
      || (r.colocadas.length === mejor.colocadas.length && r.area < mejor.area)) mejor = r;
  }

  // Recorte y numeración en orden de lectura (una casilla inicial compartida lleva un solo número)
  const { fMin, fMax, cMin, cMax } = mejor.limites;
  const entradas = mejor.colocadas
    .map((e) => ({ palabra: e.palabra, pista: e.pista, fila: e.fila - fMin, col: e.col - cMin, direccion: e.direccion }))
    .sort((a, b) => a.fila - b.fila || a.col - b.col || (a.direccion === 'horizontal' ? -1 : 1));
  const numeros = new Map();
  for (const e of entradas) {
    if (!numeros.has(clave(e.fila, e.col))) numeros.set(clave(e.fila, e.col), numeros.size + 1);
    e.numero = numeros.get(clave(e.fila, e.col));
  }
  return {
    filas: fMax - fMin + 1,
    columnas: cMax - cMin + 1,
    entradas: entradas.map(({ numero, palabra, pista, fila, col, direccion }) => ({ numero, palabra, pista, fila, col, direccion }))
  };
}

// ---------- Estado de la partida ----------

let tema = null;
let candidatos = [];      // [{ palabra, pista, definicion }]
let cruci = null;
let celdas = new Map();   // "f,c" → { f, c, letra, input, entradas: [índices] }
let estados = [];         // por entrada: 'pendiente' | 'correcta' | 'incorrecta'
let activa = -1;
let actual = null;        // clave de la casilla actual
let reveladas = 0;
let terminado = false;
let inicio = 0;
let reloj = null;

const $ = (id) => document.getElementById(id);
const celdasDe = (i) => {
  const e = cruci.entradas[i];
  const [df, dc] = PASO[e.direccion];
  return [...e.palabra].map((_, k) => celdas.get(clave(e.fila + df * k, e.col + dc * k)));
};
const bloqueada = (celda) => celda.input.readOnly;
let ayuda = null;

// Neuri: pista sobre la palabra activa y explicación de la última comprobación incorrecta
function contextoNeuri(modo) {
  if (!cruci || terminado) return 'El crucigrama terminó: empieza otro para pedir ayuda a Neuri.';
  const e = cruci.entradas[activa];
  const termino = e && candidatos.find((x) => x.palabra === e.palabra);
  if (!termino) return 'Elige una pista del crucigrama.';
  if (estados[activa] === 'correcta') return 'Esa palabra ya está resuelta: elige otra pista.';
  if (modo === 'error' && estados[activa] !== 'incorrecta') return 'Completa la palabra y pulsa «Comprobar» antes de pedir que Neuri explique el error.';
  const intento = celdasDe(activa).map((c) => c.input.value).join('');
  return {
    clave: modo === 'error' ? `${termino.id}-${intento}` : termino.id,
    datos: { temaId: tema.id, terminoId: termino.id, ...(modo === 'error' ? { intento } : {}) }
  };
}

async function iniciar() {
  await montarPlantilla({ titulo: 'Crucigrama', roles: ['estudiante', 'docente'] });

  $('btnCambiarTema').addEventListener('click', async () => {
    const elegido = await obtenerTemaActividad({ forzarModal: true });
    if (elegido?.id) await cargarTema(elegido);
  });
  $('btnComprobar').addEventListener('click', comprobar);
  $('btnRevelar').addEventListener('click', revelar);
  $('btnTerminar').addEventListener('click', () => terminar(true));
  ayuda = montarAyudaNeuri({ actividad: 'crucigrama', antesDe: $('contenedorRetro'), contexto: contextoNeuri });

  const grilla = $('grilla');
  grilla.addEventListener('keydown', alTeclear);
  grilla.addEventListener('input', alEscribir);
  grilla.addEventListener('click', alPulsarCelda);
  grilla.addEventListener('dblclick', () => cambiarDireccion());

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
  const vistas = new Map();
  for (const t of lista || []) {
    const palabra = util.normalizar(t.termino);
    const largo = new RegExp(`^[A-ZÑ]{${MIN_LETRAS},${MAX_LETRAS}}$`);
    if (largo.test(palabra) && !vistas.has(palabra)) {
      vistas.set(palabra, { id: t.id, palabra, pista: (t.pista || t.definicion || '').trim(), definicion: (t.definicion || '').trim() });
    }
  }
  candidatos = [...vistas.values()];
  if (candidatos.length < 3) return mostrarEstado('vacio');
  mostrarEstado('juego');
  nuevaPartida();
}

function mostrarEstado(estado) {
  $('cruciCargando').hidden = estado !== 'cargando';
  $('cruciVacio').hidden = estado !== 'vacio';
  $('cruciJuego').hidden = estado !== 'juego';
}

function nuevaPartida() {
  detenerReloj();
  cruci = generarCrucigrama(util.barajar(candidatos).slice(0, MAX_CANDIDATOS));
  estados = cruci.entradas.map(() => 'pendiente');
  activa = -1;
  actual = null;
  reveladas = 0;
  terminado = false;
  $('contenedorRetro').replaceChildren();
  ayuda?.reiniciar();
  $('btnRevelar').textContent = `Revelar letra (${MAX_REVELADAS})`;
  for (const id of ['btnComprobar', 'btnRevelar', 'btnTerminar']) $(id).disabled = false;
  pintarGrilla();
  pintarPistas();
  actualizarDatos();
  inicio = Date.now();
  reloj = setInterval(() => { $('datoTiempo').textContent = formatoTiempo(segundos()); }, 1000);
  seleccionar(0, false);
}

// ---------- Pintado ----------

function pintarGrilla() {
  celdas = new Map();
  cruci.entradas.forEach((e, i) => {
    const [df, dc] = PASO[e.direccion];
    [...e.palabra].forEach((letra, k) => {
      const k2 = clave(e.fila + df * k, e.col + dc * k);
      if (!celdas.has(k2)) celdas.set(k2, { f: e.fila + df * k, c: e.col + dc * k, letra, entradas: [] });
      celdas.get(k2).entradas.push(i);
    });
  });

  const grilla = $('grilla');
  grilla.style.setProperty('--columnas', String(cruci.columnas));
  const nodos = [];
  for (let f = 0; f < cruci.filas; f++) {
    for (let c = 0; c < cruci.columnas; c++) {
      const celda = celdas.get(clave(f, c));
      if (!celda) {
        const vacia = document.createElement('div');
        vacia.className = 'cruci-vacia';
        vacia.setAttribute('aria-hidden', 'true');
        nodos.push(vacia);
        continue;
      }
      const caja = document.createElement('div');
      caja.className = 'cruci-celda';
      const numero = cruci.entradas.find((e) => e.fila === f && e.col === c)?.numero;
      if (numero) {
        const n = document.createElement('span');
        n.className = 'cruci-numero';
        n.setAttribute('aria-hidden', 'true');
        n.textContent = String(numero);
        caja.append(n);
      }
      const input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('autocapitalize', 'characters');
      input.dataset.clave = clave(f, c);
      input.setAttribute('aria-label', celda.entradas.map((i) => {
        const e = cruci.entradas[i];
        const pos = e.direccion === 'horizontal' ? c - e.col : f - e.fila;
        return `${e.numero} ${e.direccion}, letra ${pos + 1} de ${e.palabra.length}`;
      }).join('; '));
      celda.input = input;
      celda.caja = caja;
      caja.append(input);
      nodos.push(caja);
    }
  }
  grilla.replaceChildren(...nodos);
}

function pintarPistas() {
  for (const [direccion, id] of [['horizontal', 'pistasHorizontales'], ['vertical', 'pistasVerticales']]) {
    $(id).replaceChildren(...cruci.entradas.map((e, i) => ({ e, i })).filter(({ e }) => e.direccion === direccion).map(({ e, i }) => {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `cruci-pista${estados[i] !== 'pendiente' ? ` cruci-pista--${estados[i]}` : ''}`;
      boton.dataset.indice = String(i);
      boton.setAttribute('aria-current', String(i === activa));
      const numero = document.createElement('span');
      numero.className = 'cruci-pista__numero';
      numero.textContent = `${e.numero}.`;
      const texto = document.createElement('span');
      texto.textContent = `${e.pista} (${e.palabra.length})`;
      boton.append(numero, texto);
      if (estados[i] !== 'pendiente') boton.append(Object.assign(document.createElement('span'), { className: 'sr-only', textContent: ` (${estados[i]})` }));
      boton.addEventListener('click', () => seleccionar(i, true));
      li.append(boton);
      return li;
    }));
  }
}

function resaltar() {
  for (const celda of celdas.values()) {
    celda.caja.classList.toggle('cruci-celda--palabra', celda.entradas.includes(activa));
    celda.caja.classList.toggle('cruci-celda--actual', clave(celda.f, celda.c) === actual);
  }
  document.querySelectorAll('.cruci-pista').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.indice) === activa)));
  const e = cruci.entradas[activa];
  $('pistaActual').textContent = e ? `${e.numero} ${e.direccion}: ${e.pista} (${e.palabra.length} letras)` : '';
}

// ---------- Selección y teclado ----------

function enfocar(k) {
  actual = k;
  const celda = celdas.get(k);
  resaltar();
  celda.input.focus({ preventScroll: false });
  celda.input.select();
}

function seleccionar(i, mover, celdaPreferida = null) {
  if (i < 0 || i >= cruci.entradas.length) return;
  activa = i;
  const lista = celdasDe(i);
  const destino = celdaPreferida && lista.includes(celdaPreferida) ? celdaPreferida
    : lista.find((c) => !c.input.value && !bloqueada(c)) || lista[0];
  actual = clave(destino.f, destino.c);
  resaltar();
  if (mover) enfocar(actual);
}

function cambiarDireccion() {
  const celda = celdas.get(actual);
  if (!celda || celda.entradas.length < 2) return;
  const otra = celda.entradas.find((i) => i !== activa);
  seleccionar(otra, true, celda);
}

function alPulsarCelda(evento) {
  const input = evento.target.closest('input');
  if (!input) return;
  const celda = celdas.get(input.dataset.clave);
  const preferida = celda.entradas.find((i) => cruci.entradas[i].direccion === cruci.entradas[activa]?.direccion);
  seleccionar(celda.entradas.includes(activa) ? activa : (preferida ?? celda.entradas[0]), true, celda);
}

function moverEnPalabra(paso) {
  const lista = celdasDe(activa);
  let indice = lista.findIndex((c) => clave(c.f, c.c) === actual) + paso;
  while (indice >= 0 && indice < lista.length && bloqueada(lista[indice])) indice += paso;
  if (indice >= 0 && indice < lista.length) enfocar(clave(lista[indice].f, lista[indice].c));
  return indice >= 0 && indice < lista.length ? lista[indice] : null;
}

// Escritura (también funciona con teclados virtuales del móvil)
function alEscribir(evento) {
  const input = evento.target;
  const celda = celdas.get(input.dataset.clave);
  if (!celda || bloqueada(celda)) return;
  const letra = util.normalizar(input.value).replace(/[^A-ZÑ]/g, '').slice(-1);
  input.value = letra;
  limpiarMarcas(celda);
  if (letra) moverEnPalabra(1);
}

function limpiarMarcas(celda) {
  for (const i of celda.entradas) {
    if (estados[i] !== 'incorrecta') continue;
    estados[i] = 'pendiente';
    celdasDe(i).forEach((c) => c.caja.classList.remove('cruci-celda--incorrecta'));
    pintarPistas();
  }
}

function alTeclear(evento) {
  const input = evento.target.closest('input');
  if (!input || terminado) return;
  const celda = celdas.get(input.dataset.clave);
  actual = input.dataset.clave;
  const flechas = { ArrowRight: [0, 1, 'horizontal'], ArrowLeft: [0, -1, 'horizontal'], ArrowDown: [1, 0, 'vertical'], ArrowUp: [-1, 0, 'vertical'] };

  if (flechas[evento.key]) {
    evento.preventDefault();
    const [df, dc, direccion] = flechas[evento.key];
    const enEsaDireccion = celda.entradas.find((i) => cruci.entradas[i].direccion === direccion);
    if (cruci.entradas[activa]?.direccion !== direccion && enEsaDireccion !== undefined) {
      seleccionar(enEsaDireccion, true, celda);   // primero cambia de dirección
      return;
    }
    const vecina = celdas.get(clave(celda.f + df, celda.c + dc));
    if (vecina) {
      const entrada = vecina.entradas.find((i) => cruci.entradas[i].direccion === direccion) ?? vecina.entradas[0];
      seleccionar(entrada, true, vecina);
    }
  } else if (evento.key === 'Backspace') {
    evento.preventDefault();
    if (!bloqueada(celda) && input.value) {
      input.value = '';
      limpiarMarcas(celda);
    } else {
      const anterior = moverEnPalabra(-1);
      if (anterior && !bloqueada(anterior)) {
        anterior.input.value = '';
        limpiarMarcas(anterior);
      }
    }
  } else if (evento.key === ' ') {
    evento.preventDefault();
    cambiarDireccion();
  } else if (evento.key === 'Enter') {
    evento.preventDefault();
    comprobar();
  } else if (bloqueada(celda) && /^[a-zñáéíóúü]$/i.test(evento.key)) {
    evento.preventDefault();
    moverEnPalabra(1);   // casilla ya resuelta: se salta
  }
}

// ---------- Acciones ----------

function bloquear(celda, clase) {
  celda.input.readOnly = true;
  celda.caja.classList.remove('cruci-celda--incorrecta');
  celda.caja.classList.add(clase);
}

function comprobar() {
  if (terminado || activa < 0) return;
  const e = cruci.entradas[activa];
  const lista = celdasDe(activa);
  if (lista.some((c) => !c.input.value)) {
    ui.aviso(`Completa las ${e.palabra.length} letras de la palabra ${e.numero} antes de comprobarla.`, 'info');
    return;
  }
  const correcta = lista.map((c) => c.input.value).join('') === e.palabra;
  estados[activa] = correcta ? 'correcta' : 'incorrecta';
  lista.forEach((c) => (correcta ? (c.caja.classList.contains('cruci-celda--revelada') ? null : bloquear(c, 'cruci-celda--correcta')) : c.caja.classList.add('cruci-celda--incorrecta')));
  const definicion = candidatos.find((x) => x.palabra === e.palabra)?.definicion || e.pista;
  $('contenedorRetro').replaceChildren(mostrarRetro({
    correcto: correcta,
    explicacion: correcta ? `${e.palabra}: ${definicion}` : definicion,
    sugerencia: correcta ? '' : 'Revisa las letras marcadas en rojo y vuelve a intentarlo.',
    enlaceTema: correcta ? '' : tema.id
  }));
  pintarPistas();
  actualizarDatos();
  if (estados.every((s) => s === 'correcta')) terminar(false);
  else if (correcta) {
    const siguiente = estados.findIndex((s, i) => i > activa && s !== 'correcta');
    seleccionar(siguiente >= 0 ? siguiente : estados.findIndex((s) => s !== 'correcta'), true);
  }
}

function revelar() {
  if (terminado || reveladas >= MAX_REVELADAS || activa < 0) return;
  const lista = celdasDe(activa);
  const enActual = celdas.get(actual);
  const necesita = (c) => !bloqueada(c) && c.input.value !== c.letra;
  const destino = enActual && lista.includes(enActual) && necesita(enActual) ? enActual : lista.find(necesita);
  if (!destino) {
    ui.aviso('Esta palabra no tiene letras por revelar.', 'info');
    return;
  }
  destino.input.value = destino.letra;
  bloquear(destino, 'cruci-celda--revelada');
  limpiarMarcas(destino);
  reveladas++;
  $('btnRevelar').textContent = `Revelar letra (${MAX_REVELADAS - reveladas})`;
  $('btnRevelar').disabled = reveladas >= MAX_REVELADAS;
  enfocar(clave(destino.f, destino.c));
}

function actualizarDatos() {
  $('datoCorrectas').textContent = `${estados.filter((s) => s === 'correcta').length}/${estados.length}`;
}

const segundos = () => (inicio ? Math.round((Date.now() - inicio) / 1000) : 0);
const formatoTiempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function detenerReloj() {
  clearInterval(reloj);
  reloj = null;
}

async function terminar(preguntar) {
  if (terminado) return;
  if (preguntar && estados.some((s) => s !== 'correcta')
    && !(await ui.confirmar('¿Terminar el crucigrama? Las palabras que no estén completas y correctas contarán como incorrectas.'))) return;
  terminado = true;
  detenerReloj();
  for (const id of ['btnComprobar', 'btnRevelar', 'btnTerminar']) $(id).disabled = true;

  // Califica todas las palabras y muestra la solución
  cruci.entradas.forEach((e, i) => {
    const lista = celdasDe(i);
    const correcta = lista.map((c) => c.input.value).join('') === e.palabra;
    estados[i] = correcta ? 'correcta' : 'incorrecta';
    for (const c of lista) {
      if (!correcta && c.input.value !== c.letra) {
        c.input.value = c.letra;
        c.caja.classList.add('cruci-celda--incorrecta');
      } else if (!c.caja.classList.contains('cruci-celda--revelada') && !c.caja.classList.contains('cruci-celda--incorrecta')) {
        c.caja.classList.add('cruci-celda--correcta');
      }
      c.input.readOnly = true;
    }
  });
  pintarPistas();
  actualizarDatos();

  const total = cruci.entradas.length;
  const correctas = estados.filter((s) => s === 'correcta').length;
  const incorrectas = total - correctas;
  const duracionSeg = Math.max(1, segundos());
  try {
    await registrarIntento({
      actividad: 'crucigrama',
      temaId: tema.id,
      puntaje: correctas,
      maximo: total,
      errores: incorrectas + reveladas,
      duracionSeg,
      detalle: { reveladas }
    });
  } catch (err) {
    console.error('Error al registrar el intento de crucigrama:', err);
  }

  const falladas = cruci.entradas.filter((_, i) => estados[i] !== 'correcta')
    .map((e) => `${e.palabra}: ${candidatos.find((x) => x.palabra === e.palabra)?.definicion || e.pista}`);
  const accion = await mostrarResumen({
    titulo: `Crucigrama: ${correctas} de ${total} palabras${reveladas ? ` · ${reveladas} letra${reveladas === 1 ? '' : 's'} revelada${reveladas === 1 ? '' : 's'}` : ''}`,
    aciertos: correctas,
    errores: incorrectas + reveladas,
    recomendaciones: falladas.length ? falladas : ['¡Completaste todas las palabras! Prueba otro crucigrama del tema.'],
    enlaceTema: tema.id
  });
  if (accion === 'repetir') nuevaPartida();
  else window.location.href = '/paginas/actividades.html';
}

document.addEventListener('DOMContentLoaded', iniciar);
