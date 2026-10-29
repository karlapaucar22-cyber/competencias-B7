// Directorio privado de la asignatura NeuroRitmo, derivado del distributivo real.

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';

await montarPlantilla({ titulo: 'Participantes', roles: ['estudiante'] });

const ASIGNATURA_ID = 'asi_000001';
const $ = (id) => document.getElementById(id);
let estudiantes = [];

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

function iniciales(nombre) {
  return String(nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase() || 'NR';
}

function tarjetaPersona(persona, clase = '') {
  const articulo = document.createElement('article');
  articulo.className = `participante ${clase}`.trim();
  const avatar = document.createElement('div');
  avatar.className = 'participante__avatar';
  if (persona.foto) {
    const imagen = document.createElement('img');
    imagen.src = persona.foto;
    imagen.alt = `Avatar de ${persona.nombre}`;
    avatar.append(imagen);
  } else {
    avatar.textContent = iniciales(persona.nombre);
    avatar.setAttribute('aria-hidden', 'true');
  }
  const datos = document.createElement('div');
  const nombre = document.createElement('h3');
  nombre.className = 'participante__nombre';
  nombre.textContent = persona.nombre;
  const rol = document.createElement('p');
  rol.className = 'participante__rol';
  rol.textContent = persona.rol === 'docente' ? 'Docente' : 'Estudiante';
  datos.append(nombre, rol);
  articulo.append(avatar, datos);
  return articulo;
}

function pintarEstudiantes() {
  const consulta = normalizar($('buscarParticipante').value.trim());
  const visibles = estudiantes.filter((persona) => normalizar(persona.nombre).includes(consulta));
  $('listaEstudiantes').replaceChildren(...visibles.map((persona) => {
    const item = document.createElement('li');
    item.append(tarjetaPersona(persona));
    return item;
  }));
  $('participantesVacio').hidden = visibles.length > 0;
  $('contadorEstudiantes').textContent = consulta
    ? `${visibles.length} de ${estudiantes.length} estudiantes`
    : `${estudiantes.length} estudiante${estudiantes.length === 1 ? '' : 's'} inscrito${estudiantes.length === 1 ? '' : 's'}`;
}

async function cargar() {
  try {
    const datos = await api.llamar('GET', `/api/participantes/${ASIGNATURA_ID}`);
    $('nombreAsignatura').textContent = datos.asignatura.nombre;
    $('docenteResponsable').replaceChildren(datos.docente
      ? tarjetaPersona(datos.docente, 'participante--docente')
      : Object.assign(document.createElement('p'), { textContent: 'Docente pendiente de asignación.' }));
    estudiantes = Array.isArray(datos.estudiantes) ? datos.estudiantes : [];
    pintarEstudiantes();
    $('participantesEstado').textContent = 'Directorio actualizado según las matrículas vigentes.';
  } catch (error) {
    $('participantesEstado').textContent = error.message;
    $('docenteResponsable').replaceChildren();
    $('listaEstudiantes').replaceChildren();
  }
}

$('buscarParticipante').addEventListener('input', pintarEstudiantes);
await cargar();
