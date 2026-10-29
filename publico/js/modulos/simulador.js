// publico/js/modulos/simulador.js
// Simulador: escenarios (escenas con decisiones, retroalimentación e informe) y juego de roles
// (chat con un personaje de IA y evaluación con rúbrica); ambos registran el intento

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { mejorPuntaje } from '../nucleo/escenarios.js';
import * as ui from '../nucleo/ui.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';
import { montarAyudaNeuri } from '../nucleo/ayuda-neuri.js';

await montarPlantilla({ titulo: 'Simulador', roles: ['sesion'] });

const MAX_PASOS = 100;   // evita recorridos infinitos si el escenario tiene ciclos
const $ = (id) => document.getElementById(id);
const vistaPrevia = util.parametro('vista') === 'previa';
let sim = null;
let escenas = new Map();
let maximo = 1;
let puntos = 0;
let recorrido = [];      // [{ escena, opcion, texto, destino, puntos, consecuencia }]
let escenaActual = null;
let ayuda = null;

// Neuri: pista antes de decidir y explicación de una decisión desfavorable (el servidor lee la escena)
function contextoNeuri(modo) {
  if (!escenaActual) return 'La simulación terminó: pulsa «Repetir» para volver a practicar.';
  const decision = recorrido.at(-1)?.escena === escenaActual.id ? recorrido.at(-1) : null;
  if (modo === 'pista' && decision) return 'Ya tomaste esta decisión: pulsa «Continuar».';
  if (modo === 'error' && (!decision || decision.puntos > 0)) return decision ? 'Tu decisión fue favorable: no hay error que explicar.' : 'Toma una decisión antes de pedir que Neuri explique el error.';
  return {
    clave: `${escenaActual.id}-${recorrido.length}`,
    datos: { simulacionId: sim.id, escena: escenaActual.id, ...(modo === 'error' ? { opcion: decision.opcion } : {}) }
  };
}

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

const conSigno = (n) => `${n > 0 ? '+' : ''}${n}`;

function actualizarMarcador() {
  $('paso').textContent = `Decisión ${recorrido.length + 1}`;
  $('puntos').textContent = `Puntos: ${puntos}`;
}

function mostrarEscena(id) {
  const escena = escenas.get(id);
  if (!escena) {
    $('estado').textContent = 'Esta simulación tiene una escena que no existe. Avísale a tu docente.';
    return;
  }
  escenaActual = null;
  if (!escena.opciones?.length || recorrido.length >= MAX_PASOS) return mostrarInforme(escena);

  escenaActual = escena;
  ayuda?.reiniciar();
  actualizarMarcador();
  $('retro').replaceChildren();
  const imagen = $('imagenEscena');
  imagen.hidden = !escena.imagen;
  if (escena.imagen) imagen.src = escena.imagen;
  $('textoEscena').innerHTML = util.formatoBasico(escena.texto);
  $('opciones').replaceChildren(...escena.opciones.map((opcion, indice) => {
    const boton = crear('button', 'simulador-opcion', opcion.texto);
    boton.type = 'button';
    boton.setAttribute('aria-pressed', 'false');
    boton.addEventListener('click', () => elegir(escena, opcion, indice, boton));
    return boton;
  }));
  $('escena').focus();
}

function elegir(escena, opcion, indice, boton) {
  const valor = Number(opcion.puntos) || 0;
  $('opciones').querySelectorAll('button').forEach((b) => { b.disabled = true; });
  boton.setAttribute('aria-pressed', 'true');
  puntos += valor;
  recorrido.push({ escena: escena.id, opcion: indice, texto: opcion.texto, destino: opcion.destino, puntos: valor, consecuencia: opcion.consecuencia || '' });
  $('puntos').textContent = `Puntos: ${puntos}`;

  const continuar = crear('button', 'btn btn--primario', 'Continuar →');
  continuar.type = 'button';
  continuar.addEventListener('click', () => mostrarEscena(opcion.destino));
  $('retro').replaceChildren(
    mostrarRetro({ correcto: valor > 0, explicacion: opcion.consecuencia || (valor > 0 ? 'Buena decisión.' : 'Esta decisión tiene consecuencias poco favorables.'), sugerencia: `${conSigno(valor)} puntos` }),
    continuar
  );
  continuar.focus();
}

async function mostrarInforme(final) {
  $('escena').hidden = true;
  $('informe').hidden = false;
  $('paso').textContent = `${recorrido.length} decisiones`;
  $('textoFinal').innerHTML = util.formatoBasico(final.texto || 'Fin de la simulación.');
  const obtenido = Math.min(Math.max(0, puntos), maximo);
  $('puntajeFinal').textContent = `Puntaje: ${obtenido} de ${maximo} (mejor camino posible)`;
  $('decisiones').replaceChildren(...recorrido.map((r) => {
    const li = crear('li', `simulador-decision${r.puntos > 0 ? '' : ' simulador-decision--mala'}`);
    li.append(
      crear('p', 'simulador-decision__eleccion', `${r.texto} (${conSigno(r.puntos)} puntos)`),
      crear('p', 'simulador-decision__consecuencia', r.consecuencia || 'Sin comentario.')
    );
    return li;
  }));
  $('informe').focus();

  if (vistaPrevia) return;
  await registrarIntento({
    actividad: 'simulacion',
    temaId: sim.temaId,
    puntaje: obtenido,
    maximo,
    errores: recorrido.filter((r) => r.puntos <= 0).length,
    detalle: { simulacionId: sim.id, recorrido: recorrido.map(({ escena, opcion, destino, puntos: p }) => ({ escena, opcion, destino, puntos: p })) }
  });
}

// ---------- Juego de roles ----------
let conversacion = [];   // [{ rol: "estudiante" | "personaje", texto }] solo en memoria
let enviandoRol = false;

const turnosUsados = () => conversacion.filter((m) => m.rol === 'estudiante').length;
const sinFormato = (texto) => String(texto).replace(/\*\*/g, '').replace(/^\s*-\s+/gm, '');

function burbujaRol(rol, texto, { error = false } = {}) {
  const clase = rol === 'estudiante' ? 'usuario' : rol === 'personaje' ? 'tutor' : 'sistema';
  const b = crear('div', `tutor__mensaje tutor__mensaje--${clase}${error ? ' tutor__mensaje--error' : ''}`);
  if (rol === 'personaje') {
    b.append(crear('span', 'tutor__autor', sim.personaje?.nombre || 'Personaje'));
    const cuerpo = crear('div');
    cuerpo.innerHTML = util.formatoBasico(texto);
    b.append(cuerpo);
  } else {
    if (rol === 'estudiante') b.append(crear('span', 'sr-only', 'Tú: '));
    b.append(document.createTextNode(texto));
  }
  $('rolMensajes').append(b);
  $('rolMensajes').scrollTop = $('rolMensajes').scrollHeight;
  return b;
}

function actualizarTurnos() {
  const max = Number(sim.maxTurnos) || 6;
  $('rolTurnos').textContent = `Turno ${Math.min(turnosUsados() + 1, max)} de ${max}`;
  const bloqueado = enviandoRol || turnosUsados() >= max;
  $('rolEntrada').disabled = bloqueado;
  $('rolEnviar').disabled = bloqueado;
  $('btnTerminarRol').disabled = enviandoRol || turnosUsados() === 0;
}

async function enviarRol(texto) {
  texto = String(texto || '').trim();
  const max = Number(sim.maxTurnos) || 6;
  if (!texto || enviandoRol || turnosUsados() >= max) return;
  enviandoRol = true;
  const propia = burbujaRol('estudiante', texto);
  conversacion.push({ rol: 'estudiante', texto });
  $('rolEntrada').value = '';
  actualizarTurnos();
  const pensando = crear('div', 'tutor__mensaje tutor__mensaje--tutor');
  pensando.append(crear('span', '', `${sim.personaje?.nombre || 'El personaje'} está escribiendo... `));
  $('rolMensajes').append(pensando);
  cambiarEstado('pensando');
  try {
    const r = await api.ia('rol-simulacion', { simulacionId: sim.id, historial: conversacion });
    pensando.remove();
    burbujaRol('personaje', r.respuesta);
    conversacion.push({ rol: 'personaje', texto: r.respuesta });
    decir(sinFormato(r.respuesta), { soloVoz: true });
  } catch (err) {
    cambiarEstado('reposo');
    pensando.remove();
    conversacion.pop();
    propia.remove();
    $('rolEntrada').value = texto;
    burbujaRol('sistema', err.estado === 429
      ? 'Por hoy llegaste al límite de mensajes con la IA. Mañana podrás seguir practicando.'
      : `No se pudo enviar: ${err.message}`, { error: true });
  } finally {
    enviandoRol = false;
    actualizarTurnos();
  }
  if (turnosUsados() >= max) {
    burbujaRol('sistema', 'Llegaste al máximo de turnos. Ahora verás tu evaluación.');
    await evaluarRol();
  } else if (!$('rolEntrada').disabled) {
    $('rolEntrada').focus();
  }
}

async function evaluarRol() {
  if (!turnosUsados()) return;
  $('rolChat').hidden = true;
  $('rolInforme').hidden = false;
  $('rolTablaCaja').hidden = true;
  $('rolPuntaje').textContent = '';
  $('rolComentario').replaceChildren();
  $('btnReintentarEvaluacion').hidden = true;
  $('rolEstadoEvaluacion').textContent = 'Evaluando tu conversación con la rúbrica…';
  $('rolInforme').focus();
  cambiarEstado('pensando');
  let evaluacion;
  try {
    evaluacion = await api.ia('evaluar-rol', { simulacionId: sim.id, historial: conversacion });
  } catch (err) {
    cambiarEstado('reposo');
    $('rolEstadoEvaluacion').textContent = err.estado === 429
      ? 'Por hoy llegaste al límite de mensajes con la IA. Mañana podrás pedir la evaluación.'
      : `No se pudo evaluar: ${err.message}`;
    $('btnReintentarEvaluacion').hidden = err.estado === 429;
    return;
  }

  // Puntajes acotados a la rúbrica de la simulación (no se confía ciegamente en la IA)
  const rubrica = sim.rubrica || [];
  const filas = rubrica.map((c, i) => {
    const ia = evaluacion.criterios?.[i] || {};
    const maximo = Number(c.puntos) || 0;
    // El Anexo B.6 devuelve "puntos" por criterio (se acepta también "puntaje")
    const obtenido = Number(ia.puntos ?? ia.puntaje) || 0;
    return { criterio: c.criterio, maximo, puntaje: Math.max(0, Math.min(maximo, Math.round(obtenido))), comentario: ia.comentario || '' };
  });
  const puntaje = filas.reduce((s, f) => s + f.puntaje, 0);
  const maximo = Math.max(1, filas.reduce((s, f) => s + f.maximo, 0));
  $('rolEstadoEvaluacion').textContent = '';
  $('rolPuntaje').textContent = `Puntaje: ${puntaje} de ${maximo}`;
  $('rolCriterios').replaceChildren(...filas.map((f) => {
    const tr = crear('tr');
    tr.append(crear('td', '', f.criterio), crear('td', '', `${f.puntaje} / ${f.maximo}`), crear('td', '', f.comentario));
    return tr;
  }));
  $('rolTablaCaja').hidden = false;
  $('rolComentario').innerHTML = util.formatoBasico(evaluacion.comentarioGeneral || '');
  decir(sinFormato(evaluacion.comentarioGeneral || ''), { soloVoz: true });

  if (vistaPrevia) return;
  await registrarIntento({ actividad: 'simulacion', temaId: sim.temaId, puntaje, maximo, detalle: { simulacionId: sim.id, modo: 'rol' } });
}

function comenzarRol() {
  conversacion = [];
  $('rolMensajes').replaceChildren();
  $('rolCaso').hidden = true;
  $('rolInforme').hidden = true;
  $('rolChat').hidden = false;
  burbujaRol('sistema', `Conversación con ${sim.personaje?.nombre || 'el personaje'}. Tienes ${Number(sim.maxTurnos) || 6} turnos para lograr tu objetivo.`);
  actualizarTurnos();
  $('rolEntrada').focus();
}

async function iniciarRol() {
  const p = sim.personaje || {};
  $('rolTitulo').textContent = sim.titulo;
  $('rolAvisoPrevia').hidden = !vistaPrevia;
  $('rolNombre').textContent = p.nombre || 'Personaje';
  $('rolDescripcion').innerHTML = util.formatoBasico(p.descripcion || '');
  $('rolContexto').innerHTML = util.formatoBasico(p.contexto || '');
  $('rolObjetivo').textContent = p.objetivo || '';
  $('rolRubrica').replaceChildren(...(sim.rubrica || []).map((c) => crear('li', '', `${c.criterio} (${c.puntos} puntos): ${c.descripcion}`)));
  $('rolTurnos').textContent = `${Number(sim.maxTurnos) || 6} turnos`;
  try {
    const tema = await api.obtener('temas', sim.temaId);
    $('rolTema').textContent = `Juego de roles · ${tema.titulo}`;
  } catch {
    $('rolTema').textContent = 'Juego de roles';
  }
  $('rol').hidden = false;
  $('btnComenzarRol').addEventListener('click', comenzarRol);
  $('btnRepetirRol').addEventListener('click', comenzarRol);
  $('btnReintentarEvaluacion').addEventListener('click', evaluarRol);
  $('btnTerminarRol').addEventListener('click', async () => {
    if (await ui.confirmar('¿Terminar la conversación y ver tu evaluación?')) await evaluarRol();
  });
  $('rolForm').addEventListener('submit', (e) => { e.preventDefault(); enviarRol($('rolEntrada').value); });
  $('rolEntrada').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviarRol($('rolEntrada').value);
    }
  });
}

function comenzar() {
  puntos = 0;
  recorrido = [];
  $('informe').hidden = true;
  $('escena').hidden = false;
  mostrarEscena(sim.escenaInicial);
}

async function iniciar() {
  const id = util.parametro('id');
  if (!id) {
    $('estado').textContent = 'Elige una simulación desde la lista de simulaciones.';
    return;
  }
  try {
    sim = await api.obtener('simulaciones', id);
  } catch (err) {
    $('estado').textContent = `No se pudo abrir la simulación: ${err.message}`;
    return;
  }
  $('estado').textContent = '';
  if (sim.modo === 'rol') return iniciarRol();
  escenas = new Map((sim.escenas || []).map((e) => [e.id, e]));
  maximo = Math.max(1, mejorPuntaje(sim));
  $('tituloSimulacion').textContent = sim.titulo;
  $('avisoPrevia').hidden = !vistaPrevia;
  try {
    const tema = await api.obtener('temas', sim.temaId);
    $('temaSimulacion').textContent = `Simulación · ${tema.titulo}`;
  } catch {
    $('temaSimulacion').textContent = 'Simulación';
  }
  $('simulador').hidden = false;
  $('btnRepetir').addEventListener('click', comenzar);
  if (!vistaPrevia) ayuda = montarAyudaNeuri({ actividad: 'simulador', antesDe: $('retro'), contexto: contextoNeuri });
  comenzar();
}

if (usuarioActual()) await iniciar();
