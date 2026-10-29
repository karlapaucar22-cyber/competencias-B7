// publico/js/modulos/quiz.js
// Quiz temático de NeuroRitmo: niveles, una pregunta a la vez, resultado y diploma

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { montarAyudaNeuri } from '../nucleo/ayuda-neuri.js';

const ESTADOS = { bloqueado: 'Bloqueado', disponible: 'Disponible', aprobado: 'Aprobado ✔' };
const TEMA_QUIZ = 'tem_000014';
const FILTROS_NEURORITMO = {
  asignaturaIds: ['asi_000001'],
  unidadIds: ['uni_000002'],
  temaIds: [TEMA_QUIZ],
  temaIdPredeterminado: TEMA_QUIZ
};

// Estado de la página
let tema = null;
let niveles = [];
let partida = null;     // { sesionId, nivel, nombre, preguntas, indice }
let seleccion = null;   // índice (opcion), boolean (vf) o texto (completar)
let respondida = false;
let acerto = false;
let ayuda = null;

const $ = (id) => document.getElementById(id);

// Neuri: pista antes de responder y explicación del error después; el servidor lee la sesión y la pregunta
function contextoNeuri(modo) {
  const p = partida?.preguntas[partida.indice];
  if (!p) return 'Comienza un nivel para pedir ayuda a Neuri.';
  if (modo === 'pista' && respondida) return 'Ya respondiste esta pregunta: pasa a la siguiente.';
  if (modo === 'error' && (!respondida || acerto)) return respondida ? 'Tu respuesta es correcta: no hay error que explicar.' : 'Responde la pregunta antes de pedir que Neuri explique el error.';
  return { clave: p.id, datos: { sesionId: partida.sesionId, preguntaId: p.id }, pistas: p.pistas };
}

async function iniciar() {
  await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

  $('btnCambiarTema').addEventListener('click', async () => {
    if (partida && !(await ui.confirmar('¿Salir del quiz en curso para cambiar de tema?'))) return;
    const elegido = await obtenerTemaActividad({ ...FILTROS_NEURORITMO, forzarModal: true });
    if (elegido?.id) await cargarTema(elegido);
  });
  $('formPregunta').addEventListener('submit', responder);
  $('btnSiguiente').addEventListener('click', siguiente);
  $('btnAbandonar').addEventListener('click', abandonar);
  $('btnReintentar').addEventListener('click', () => iniciarNivel(Number($('btnReintentar').dataset.nivel)));
  $('btnDiploma').addEventListener('click', () => descargarDiploma(Number($('btnDiploma').dataset.nivel)));
  $('btnVolver').addEventListener('click', verNiveles);
  ayuda = montarAyudaNeuri({ actividad: 'quiz', antesDe: $('contenedorRetro'), contexto: contextoNeuri });

  await cargarTema(await obtenerTemaActividad(FILTROS_NEURORITMO));
}

function mostrarVista(vista) {
  for (const id of ['quizCargando', 'vistaNiveles', 'vistaPregunta', 'vistaResultado']) $(id).hidden = id !== vista;
}

async function cargarTema(nuevoTema) {
  partida = null;
  if (!nuevoTema?.id) {
    $('quizCargando').textContent = 'Elige un tema para comenzar el quiz.';
    return mostrarVista('quizCargando');
  }
  tema = nuevoTema;
  const url = new URL(window.location.href);
  url.searchParams.set('temaId', tema.id);
  window.history.replaceState(null, '', url);
  $('insigniaTema').textContent = `Tema: ${tema.titulo}`;
  await verNiveles();
}

// ---------- Niveles ----------

async function verNiveles() {
  partida = null;
  $('quizCargando').textContent = 'Cargando niveles...';
  mostrarVista('quizCargando');
  try {
    niveles = (await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(tema.id)}`)).niveles;
  } catch (err) {
    $('quizCargando').textContent = `No se pudieron cargar los niveles: ${err.message}`;
    return;
  }
  pintarNiveles();
  mostrarVista('vistaNiveles');
}

function pintarNiveles() {
  $('listaNiveles').replaceChildren(...niveles.map((n) => {
    const li = document.createElement('li');
    const tarjeta = document.createElement('article');
    tarjeta.className = `quiz-nivel quiz-nivel--${n.estado}`;
    tarjeta.setAttribute('aria-labelledby', `nivel-${n.nivel}`);

    const numero = document.createElement('span');
    numero.className = 'quiz-nivel__numero';
    numero.textContent = `Nivel ${n.nivel}`;
    const nombre = document.createElement('h3');
    nombre.className = 'quiz-nivel__nombre';
    nombre.id = `nivel-${n.nivel}`;
    nombre.textContent = n.nombre;
    const estado = document.createElement('span');
    estado.className = `insignia quiz-nivel__estado quiz-nivel__estado--${n.estado}`;
    estado.textContent = ESTADOS[n.estado] || n.estado;
    const mejor = document.createElement('p');
    mejor.className = 'quiz-nivel__mejor';
    mejor.textContent = n.mejorPorcentaje === null ? 'Sin intentos' : `Mejor resultado: ${n.mejorPorcentaje} %`;

    const boton = document.createElement('button');
    boton.type = 'button';
    if (n.estado === 'bloqueado') {
      boton.className = 'btn btn--secundario';
      boton.disabled = true;
      boton.textContent = `🔒 Aprueba el nivel ${n.nivel - 1}`;
    } else {
      boton.className = n.estado === 'aprobado' ? 'btn btn--secundario' : 'btn btn--primario';
      boton.textContent = n.estado === 'aprobado' ? 'Repetir' : 'Comenzar';
      boton.setAttribute('aria-label', `${boton.textContent} el nivel ${n.nivel}, ${n.nombre}`);
      boton.addEventListener('click', () => iniciarNivel(n.nivel));
    }
    tarjeta.append(numero, nombre, estado, mejor, boton);

    if (n.estado === 'aprobado') {
      const diploma = document.createElement('button');
      diploma.type = 'button';
      diploma.className = 'btn btn--texto btn--sm';
      diploma.textContent = 'Descargar diploma';
      diploma.setAttribute('aria-label', `Descargar diploma del nivel ${n.nivel}, ${n.nombre}`);
      diploma.addEventListener('click', () => descargarDiploma(n.nivel));
      tarjeta.append(diploma);
    }
    li.append(tarjeta);
    return li;
  }));
}

// ---------- Preguntas ----------

async function iniciarNivel(nivel) {
  ui.cargando(true);
  try {
    const datos = await api.llamar('POST', '/api/quiz/iniciar', { temaId: tema.id, nivel });
    const nombre = niveles.find((n) => n.nivel === nivel)?.nombre || '';
    partida = { ...datos, nivel, nombre, indice: 0 };
  } catch (err) {
    ui.aviso(err.message, 'error');
    return;
  } finally {
    ui.cargando(false);
  }
  $('tituloNivel').textContent = `Nivel ${nivel} · ${partida.nombre}`;
  mostrarVista('vistaPregunta');
  pintarPregunta();
}

function actualizarProgreso() {
  const total = partida.preguntas.length;
  const hechas = partida.indice + (respondida ? 1 : 0);
  const porcentaje = Math.round((hechas / total) * 100);
  $('textoProgreso').textContent = `Pregunta ${partida.indice + 1} de ${total}`;
  $('rellenoProgreso').style.width = `${porcentaje}%`;
  $('barraProgreso').setAttribute('aria-valuenow', String(porcentaje));
}

function pintarPregunta() {
  const p = partida.preguntas[partida.indice];
  seleccion = null;
  respondida = false;
  acerto = false;
  ayuda?.reiniciar();
  $('enunciado').textContent = p.enunciado;
  $('contenedorRetro').replaceChildren();
  $('btnResponder').hidden = false;
  $('btnResponder').disabled = true;
  $('btnSiguiente').hidden = true;
  $('btnSiguiente').textContent = partida.indice === partida.preguntas.length - 1 ? 'Ver resultado' : 'Siguiente';

  const zona = $('zonaRespuesta');
  if (p.tipo === 'opcion') {
    const grupo = document.createElement('div');
    grupo.className = 'quiz-opciones';
    p.opciones.forEach((texto, i) => {
      const etiqueta = document.createElement('label');
      etiqueta.className = 'quiz-opcion';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'opcion';
      radio.value = String(i);
      radio.addEventListener('change', () => elegir(i));
      const span = document.createElement('span');
      span.textContent = texto;
      etiqueta.append(radio, span);
      grupo.append(etiqueta);
    });
    zona.replaceChildren(grupo);
  } else if (p.tipo === 'vf') {
    const grupo = document.createElement('div');
    grupo.className = 'quiz-vf';
    for (const [texto, valor] of [['Verdadero', true], ['Falso', false]]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-vf__boton';
      btn.textContent = texto;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        grupo.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        elegir(valor);
      });
      grupo.append(btn);
    }
    zona.replaceChildren(grupo);
  } else {
    const campo = document.createElement('div');
    campo.className = 'campo quiz-completar';
    const etiqueta = document.createElement('label');
    etiqueta.htmlFor = 'respuestaCompletar';
    etiqueta.textContent = 'Escribe la palabra o frase que completa el enunciado';
    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.id = 'respuestaCompletar';
    entrada.autocomplete = 'off';
    entrada.maxLength = 120;
    entrada.addEventListener('input', () => elegir(entrada.value.trim() || null));
    campo.append(etiqueta, entrada);
    zona.replaceChildren(campo);
  }

  actualizarProgreso();
  $('enunciado').focus();
}

function elegir(valor) {
  if (respondida) return;
  seleccion = valor;
  $('btnResponder').disabled = seleccion === null;
}

// Marca la elección y la respuesta correcta tras responder
function marcar(p, resultado) {
  const zona = $('zonaRespuesta');
  zona.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
  if (p.tipo === 'opcion') {
    zona.querySelectorAll('.quiz-opcion').forEach((op, i) => {
      if (i === seleccion) op.classList.add(resultado.correcto ? 'es-correcta' : 'es-incorrecta');
      else if (!resultado.correcto && op.textContent === resultado.correcta) op.classList.add('es-correcta');
    });
  } else if (p.tipo === 'vf') {
    zona.querySelectorAll('.quiz-vf__boton').forEach((b) => {
      if (b.getAttribute('aria-pressed') === 'true') b.classList.add(resultado.correcto ? 'es-correcta' : 'es-incorrecta');
      else if (!resultado.correcto && b.textContent === resultado.correcta) b.classList.add('es-correcta');
    });
  }
}

async function responder(evento) {
  evento.preventDefault();
  if (respondida || seleccion === null) return;
  const p = partida.preguntas[partida.indice];
  const boton = $('btnResponder');
  boton.disabled = true;

  let resultado;
  try {
    resultado = await api.llamar('POST', '/api/quiz/responder', { sesionId: partida.sesionId, preguntaId: p.id, respuesta: seleccion });
  } catch (err) {
    ui.aviso(`No se pudo enviar la respuesta: ${err.message}`, 'error');
    boton.disabled = false;
    return;
  }

  respondida = true;
  acerto = resultado.correcto;
  marcar(p, resultado);
  $('contenedorRetro').replaceChildren(mostrarRetro({
    correcto: resultado.correcto,
    explicacion: resultado.retroalimentacion || (resultado.correcto ? '¡Respuesta correcta!' : ''),
    sugerencia: resultado.correcto ? '' : `Respuesta correcta: ${resultado.correcta}`
  }));
  boton.hidden = true;
  $('btnSiguiente').hidden = false;
  $('btnSiguiente').focus();
  actualizarProgreso();
}

async function siguiente() {
  if (partida.indice < partida.preguntas.length - 1) {
    partida.indice++;
    pintarPregunta();
  } else {
    await finalizar();
  }
}

async function abandonar() {
  if (!(await ui.confirmar('¿Salir del quiz? Este intento no se calificará.'))) return;
  await verNiveles();
}

// ---------- Resultado ----------

async function finalizar() {
  const { sesionId, nivel, nombre } = partida;
  $('btnSiguiente').disabled = true;
  let resultado;
  ui.cargando(true);
  try {
    resultado = await api.llamar('POST', '/api/quiz/finalizar', { sesionId });
  } catch (err) {
    ui.aviso(`No se pudo calificar el quiz: ${err.message}`, 'error');
    return;
  } finally {
    ui.cargando(false);
    $('btnSiguiente').disabled = false;
  }
  partida = null;

  const accion = await mostrarResumen({
    titulo: `Nivel ${nivel} · ${nombre}: ${resultado.porcentaje} % ${resultado.aprobado ? '· ¡Aprobado!' : '· No aprobado'}`,
    aciertos: resultado.aciertos,
    errores: resultado.total - resultado.aciertos,
    recomendaciones: resultado.repasar.length
      ? resultado.repasar.map((r) => `${r.enunciado} → ${r.correcta}.${r.retroalimentacion ? ` ${r.retroalimentacion}` : ''}`)
      : ['¡Respondiste todo correctamente!'],
    enlaceTema: tema.id
  });
  if (resultado.aprobado) await mostrarLogros(resultado);

  if (accion === 'repetir') return iniciarNivel(nivel);
  pintarResultado(resultado, nivel, nombre);
}

function pintarResultado(resultado, nivel, nombre) {
  const { aprobado, porcentaje, aciertos, total, puntosGanados } = resultado;
  $('iconoResultado').textContent = aprobado ? '🏆' : '📚';
  $('tituloResultado').textContent = aprobado
    ? `¡Aprobaste el nivel ${nivel} · ${nombre}!`
    : `Nivel ${nivel} · ${nombre}: sigue practicando`;
  const partes = [`Obtuviste ${porcentaje} % (${aciertos} de ${total}).`];
  if (aprobado) {
    if (puntosGanados > 0) partes.push(`Ganaste ${puntosGanados} puntos.`);
    if (nivel < 3) partes.push(`Se desbloqueó el nivel ${nivel + 1}.`);
  } else {
    partes.push('Repasa las preguntas indicadas en el resumen y reintenta con preguntas nuevas.');
  }
  $('textoResultado').textContent = partes.join(' ');

  $('btnDiploma').hidden = !aprobado;
  $('btnDiploma').dataset.nivel = String(nivel);
  $('btnReintentar').hidden = aprobado;
  $('btnReintentar').dataset.nivel = String(nivel);
  mostrarVista('vistaResultado');
  $('tituloResultado').focus();
}

async function descargarDiploma(nivel) {
  let generarDiploma;
  try {
    ({ generarDiploma } = await import('../nucleo/pdf.js'));
  } catch {
    ui.aviso('Los diplomas todavía no están disponibles en la plataforma. Tu nivel aprobado queda registrado.', 'info');
    return;
  }
  try {
    const { codigo } = await generarDiploma({ tipo: 'nivel-quiz', temaId: tema.id, nivel });
    ui.aviso(`Diploma generado. Código de verificación: ${codigo}`, 'exito');
  } catch (err) {
    ui.aviso(`No se pudo generar el diploma: ${err.message}`, 'error');
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
