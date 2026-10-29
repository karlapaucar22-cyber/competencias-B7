import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { ESCALA_AUTODIAGNOSTICO, PREGUNTAS_AUTODIAGNOSTICO, NOMBRES_DIMENSION } from '../nucleo/autodiagnostico-musical.js';

await montarPlantilla({ titulo: 'Matriz de autodiagnóstico musical', roles: ['estudiante'] });

const form = document.getElementById('formAutodiagnostico');
const listaPreguntas = document.getElementById('listaPreguntas');
const errorFormulario = document.getElementById('errorFormulario');
const estadoGuardado = document.getElementById('estadoGuardado');
const resultado = document.getElementById('resultadoAutodiagnostico');
const resumenResultado = document.getElementById('resumenResultado');
const dimensionesResultado = document.getElementById('dimensionesResultado');
const cancionEstado = document.getElementById('cancionEstado');

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

function renderizarPreguntas() {
  listaPreguntas.replaceChildren(...PREGUNTAS_AUTODIAGNOSTICO.map((pregunta, indice) => {
    const fieldset = crear('fieldset');
    const legend = crear('legend', '', `${indice + 1}. ${pregunta.texto}`);
    const escala = crear('div', 'autodiagnostico__escala');
    escala.append(...ESCALA_AUTODIAGNOSTICO.map((opcion) => {
      const label = crear('label', 'autodiagnostico__opcion');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = pregunta.id;
      input.value = String(opcion.valor);
      input.required = true;
      label.append(input, document.createTextNode(`${opcion.valor} · ${opcion.texto}`));
      return label;
    }));
    fieldset.append(legend, escala);
    return fieldset;
  }));
}

function renderizarCancion(cancion) {
  cancionEstado.replaceChildren();
  if (!cancion?.id || !/^\/(?!\/)/.test(cancion.audio || '')) {
    cancionEstado.textContent = 'La canción principal no está disponible. Aún puedes completar la matriz usando silencio.';
    return;
  }
  const contenedor = crear('div', 'autodiagnostico__reproductor');
  const titulo = crear('h3', '', cancion.titulo);
  const meta = crear('p', 'autodiagnostico__meta', `${cancion.autoria || 'Autoría no registrada'} · ${cancion.licencia || 'Licencia no registrada'}`);
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.muted = true;
  audio.preload = 'metadata';
  audio.src = cancion.audio;
  audio.append(document.createTextNode('Tu navegador no puede reproducir este audio.'));
  contenedor.append(titulo, meta, audio);
  if (cancion.letra) {
    const detalles = document.createElement('details');
    const sumario = crear('summary', '', 'Transcripción de la canción');
    const letra = crear('div', 'autodiagnostico__transcripcion');
    letra.innerHTML = util.formatoBasico(cancion.letra);
    detalles.append(sumario, letra);
    contenedor.append(detalles);
  }
  cancionEstado.replaceWith(contenedor);
}

function completar(registro) {
  if (!registro) return;
  const contexto = form.elements.namedItem('contexto');
  const condicion = form.elements.namedItem('condicion');
  if (contexto) contexto.value = registro.contexto;
  if (condicion) condicion.value = registro.condicion;
  for (const pregunta of PREGUNTAS_AUTODIAGNOSTICO) {
    const grupo = form.elements.namedItem(pregunta.id);
    if (grupo && registro.respuestas?.[pregunta.id]) grupo.value = String(registro.respuestas[pregunta.id]);
  }
  form.elements.observacion.value = registro.observacion || '';
}

function mostrarResultado(registro, enfocar = false) {
  if (!registro?.resultado) return;
  const orientacion = registro.resultado;
  resumenResultado.textContent = `${orientacion.mensaje} Promedio descriptivo: ${Number(orientacion.promedioGeneral).toLocaleString('es-EC')} de 4.`;
  dimensionesResultado.replaceChildren(...Object.entries(NOMBRES_DIMENSION).map(([clave, nombre]) => {
    const tarjeta = crear('article', 'autodiagnostico__dimension');
    tarjeta.append(
      crear('h3', '', nombre),
      crear('p', '', `${Number(orientacion.dimensiones?.[clave] || 0).toLocaleString('es-EC')} de 4`)
    );
    return tarjeta;
  }));
  resultado.hidden = false;
  if (registro.actualizado) {
    const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(registro.actualizado));
    estadoGuardado.textContent = `Guardado el ${fecha}, hora de Ecuador.`;
  }
  if (enfocar) resultado.focus();
}

function datosFormulario() {
  return {
    contexto: form.elements.namedItem('contexto').value,
    condicion: form.elements.namedItem('condicion').value,
    respuestas: Object.fromEntries(PREGUNTAS_AUTODIAGNOSTICO.map((pregunta) => [
      pregunta.id,
      Number(form.elements.namedItem(pregunta.id).value)
    ])),
    observacion: form.elements.observacion.value.trim()
  };
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  errorFormulario.hidden = true;
  if (!form.reportValidity()) {
    errorFormulario.textContent = 'Completa la actividad, la condición y las ocho preguntas.';
    errorFormulario.hidden = false;
    return;
  }
  const boton = form.querySelector('[type="submit"]');
  boton.disabled = true;
  estadoGuardado.textContent = 'Guardando…';
  try {
    const registro = await api.llamar('PUT', '/api/autodiagnostico-musical', datosFormulario());
    mostrarResultado(registro, true);
  } catch (err) {
    errorFormulario.textContent = err.message;
    errorFormulario.hidden = false;
    estadoGuardado.textContent = '';
  } finally {
    boton.disabled = false;
  }
});

renderizarPreguntas();
try {
  const datos = await api.llamar('GET', '/api/autodiagnostico-musical');
  renderizarCancion(datos.cancionPrincipal);
  if (datos.registro) {
    completar(datos.registro);
    mostrarResultado(datos.registro);
    estadoGuardado.textContent = `Se recuperó tu último autodiagnóstico. ${estadoGuardado.textContent}`;
  }
} catch (err) {
  cancionEstado.textContent = `No se pudo cargar el recurso: ${err.message}`;
  form.querySelector('[type="submit"]').disabled = true;
}
