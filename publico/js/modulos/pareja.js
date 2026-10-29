// publico/js/modulos/pareja.js
// Juego "Encuentra la pareja": relacionar términos del glosario con sus definiciones

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { montarAyudaNeuri } from '../nucleo/ayuda-neuri.js';

const MINIMO_PAREJAS = 4;
const ESPERA_VOLTEO_MS = 1200;

// Estado de la partida
let tema = null;
let glosario = [];
let totalParejas = 0;
let parejasHechas = 0;
let intentos = 0;
let volteadas = [];
let bloqueado = false;
let inicio = 0;
let reloj = null;
let ultimoFallo = null;   // { terminoId, otroId } del último intento sin pareja
let ayuda = null;

const $ = (id) => document.getElementById(id);

// Neuri: pista sobre la tarjeta descubierta (o un término pendiente) y explicación del último fallo
function contextoNeuri(modo) {
  if (!tema || $('parejaJuego').hidden) return 'Elige un tema con glosario para empezar a jugar.';
  if (modo === 'error') {
    if (!ultimoFallo) return 'Aún no tienes un intento fallido que explicar.';
    return { clave: `${ultimoFallo.terminoId}-${ultimoFallo.otroId}`, datos: { temaId: tema.id, ...ultimoFallo } };
  }
  const pendiente = volteadas[0] || $('tablero').querySelector('.pareja-tarjeta--termino:not(.esta-emparejada)');
  if (!pendiente) return 'Ya completaste todas las parejas.';
  return { clave: pendiente.dataset.par, datos: { temaId: tema.id, terminoId: pendiente.dataset.par } };
}

async function iniciar() {
  await montarPlantilla({ titulo: 'Encuentra la pareja', roles: ['estudiante', 'docente'] });

  document.querySelectorAll('input[name="dificultad"]').forEach((radio) => {
    radio.addEventListener('change', nuevaPartida);
  });

  $('btnCambiarTema').addEventListener('click', async () => {
    const elegido = await obtenerTemaActividad({ forzarModal: true });
    if (elegido?.id) await cargarTema(elegido);
  });

  ayuda = montarAyudaNeuri({ actividad: 'pareja', antesDe: $('contenedorRetro'), contexto: contextoNeuri });
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

  try {
    const lista = await api.listar('glosario', { temaId: tema.id });
    glosario = (lista || []).filter((t) => t.termino?.trim() && t.definicion?.trim());
  } catch (err) {
    console.error('Error al cargar el glosario:', err);
    glosario = [];
  }

  if (glosario.length < MINIMO_PAREJAS) return mostrarEstado('vacio');
  mostrarEstado('juego');
  nuevaPartida();
}

function mostrarEstado(estado) {
  $('parejaCargando').hidden = estado !== 'cargando';
  $('parejaVacio').hidden = estado !== 'vacio';
  $('parejaJuego').hidden = estado !== 'juego';
}

function nuevaPartida() {
  detenerReloj();
  const dificultad = Number(document.querySelector('input[name="dificultad"]:checked').value);
  totalParejas = Math.min(dificultad, glosario.length);
  parejasHechas = 0;
  intentos = 0;
  volteadas = [];
  bloqueado = false;
  inicio = 0;
  ultimoFallo = null;
  ayuda?.reiniciar();

  const aviso = $('avisoDisponibles');
  aviso.hidden = totalParejas === dificultad;
  aviso.textContent = `Este tema tiene ${glosario.length} términos: se juega con ${totalParejas} parejas.`;

  const elegidos = util.barajar(glosario).slice(0, totalParejas);
  const tarjetas = util.barajar(elegidos.flatMap((t) => [
    { par: t.id, tipo: 'termino', texto: t.termino.trim(), definicion: t.definicion.trim() },
    { par: t.id, tipo: 'definicion', texto: t.definicion.trim(), definicion: t.definicion.trim() }
  ]));

  const tablero = $('tablero');
  tablero.replaceChildren(...tarjetas.map(crearTarjeta));
  $('contenedorRetro').replaceChildren();
  actualizarDatos();
}

function crearTarjeta(datos, indice) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pareja-tarjeta pareja-tarjeta--${datos.tipo}`;
  btn.dataset.par = datos.par;
  btn.dataset.numero = String(indice + 1);
  btn.dataset.tipo = datos.tipo === 'termino' ? 'Término' : 'Definición';
  btn.dataset.texto = datos.texto;
  btn.dataset.definicion = datos.definicion;

  const interior = document.createElement('span');
  interior.className = 'pareja-tarjeta__interior';

  const frente = document.createElement('span');
  frente.className = 'pareja-tarjeta__cara pareja-tarjeta__frente';
  frente.setAttribute('aria-hidden', 'true');
  frente.textContent = '?';

  const reverso = document.createElement('span');
  reverso.className = 'pareja-tarjeta__cara pareja-tarjeta__reverso';
  reverso.setAttribute('aria-hidden', 'true');
  const tipo = document.createElement('span');
  tipo.className = 'pareja-tarjeta__tipo';
  tipo.textContent = btn.dataset.tipo;
  const texto = document.createElement('span');
  texto.className = 'pareja-tarjeta__texto';
  texto.textContent = datos.texto;
  reverso.append(tipo, texto);

  interior.append(frente, reverso);
  btn.append(interior);
  etiquetar(btn);
  btn.addEventListener('click', () => voltear(btn));
  return btn;
}

// Actualiza el aria-label según el estado de la tarjeta
function etiquetar(btn) {
  const n = btn.dataset.numero;
  if (btn.classList.contains('esta-emparejada')) {
    btn.setAttribute('aria-label', `Tarjeta ${n}, pareja encontrada. ${btn.dataset.tipo}: ${btn.dataset.texto}`);
  } else if (btn.classList.contains('esta-volteada')) {
    btn.setAttribute('aria-label', `Tarjeta ${n}, descubierta. ${btn.dataset.tipo}: ${btn.dataset.texto}`);
  } else {
    btn.setAttribute('aria-label', `Tarjeta ${n}, boca abajo`);
  }
}

function voltear(btn) {
  if (bloqueado || btn.getAttribute('aria-disabled') === 'true' || volteadas.includes(btn)) return;
  if (!inicio) iniciarReloj();

  btn.classList.add('esta-volteada');
  btn.setAttribute('aria-disabled', 'true');
  etiquetar(btn);
  volteadas.push(btn);
  if (volteadas.length < 2) return;

  intentos++;
  const [a, b] = volteadas;
  volteadas = [];

  if (a.dataset.par === b.dataset.par) {
    parejasHechas++;
    [a, b].forEach((t) => {
      t.classList.add('esta-emparejada');
      etiquetar(t);
    });
    $('contenedorRetro').replaceChildren(mostrarRetro({ correcto: true, explicacion: a.dataset.definicion }));
    actualizarDatos();
    if (parejasHechas === totalParejas) finalizar();
    return;
  }

  // No forman pareja: se voltean de nuevo tras la espera
  const [termino, otro] = b.dataset.tipo === 'Término' && a.dataset.tipo !== 'Término' ? [b, a] : [a, b];
  ultimoFallo = { terminoId: termino.dataset.par, otroId: otro.dataset.par };
  bloqueado = true;
  actualizarDatos();
  setTimeout(() => {
    [a, b].forEach((t) => {
      t.classList.remove('esta-volteada');
      t.removeAttribute('aria-disabled');
      etiquetar(t);
    });
    bloqueado = false;
  }, ESPERA_VOLTEO_MS);
}

function actualizarDatos() {
  $('datoParejas').textContent = `${parejasHechas}/${totalParejas}`;
  $('datoIntentos').textContent = String(intentos);
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

async function finalizar() {
  detenerReloj();
  const errores = intentos - parejasHechas;
  const duracionSeg = Math.max(1, segundos());

  try {
    await registrarIntento({
      actividad: 'pareja',
      temaId: tema.id,
      puntaje: Math.max(0, 10 - errores),
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.error('Error al registrar el intento de pareja:', err);
  }

  const accion = await mostrarResumen({
    titulo: `¡Completaste las ${totalParejas} parejas en ${formatoTiempo(duracionSeg)}!`,
    aciertos: parejasHechas,
    errores,
    recomendaciones: errores > totalParejas
      ? 'Repasa las definiciones del tema antes de volver a jugar.'
      : 'Prueba una dificultad mayor para seguir practicando.',
    enlaceTema: tema.id
  });

  if (accion === 'repetir') nuevaPartida();
  else window.location.href = '/paginas/actividades.html';
}

document.addEventListener('DOMContentLoaded', iniciar);
