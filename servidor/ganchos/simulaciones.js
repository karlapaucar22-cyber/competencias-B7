// servidor/ganchos/simulaciones.js
// Simulaciones: los estudiantes ven solo las publicadas de sus asignaturas; escribe quien puede editar
// la asignatura del tema. Al publicar, el escenario debe estar completo.

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { validarEscenario, validarRol } from '../../publico/js/nucleo/escenarios.js';

const MODOS = ['escenarios', 'rol'];
const ESTADOS = ['borrador', 'publicado'];
const MAX_TITULO = 150;
const MAX_TEXTO = 4000;
const MAX_ESCENAS = 60;
const MAX_OPCIONES = 6;   // en borrador; para publicar, de 2 a 4 (escenarios.js)

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

// Asignatura de cada tema y si el tema es visible para estudiantes (publicado y unidad visible)
async function asignaturaPorTema() {
  const [temas, unidades] = await Promise.all([almacen.leer('temas'), almacen.leer('unidades')]);
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));
  return new Map(temas.map((t) => {
    const unidad = unidadPorId.get(t.unidadId);
    return [t.id, { asignaturaId: unidad?.asignaturaId, publico: t.estado === 'publicado' && !!unidad && unidad.visible !== false }];
  }));
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  const porTema = await asignaturaPorTema();
  const suyas = new Set((await acceso.asignaturasDe(usuario)).map((a) => a.id));
  return lista.filter((s) => {
    const tema = porTema.get(s.temaId);
    if (!tema || !suyas.has(tema.asignaturaId)) return false;
    return usuario.rol !== 'estudiante' || (s.estado === 'publicado' && tema.publico);
  });
}

async function exigirEdicion(usuario, temaId) {
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) rechazar('El tema no existe', 400);
  if (!(await acceso.puedeEditarAsignatura(usuario, asignatura.id))) rechazar('Solo puedes editar simulaciones de tus asignaturas', 403);
}

const texto = (v, max, campo, obligatorio = true) => {
  if (v === undefined || v === null || v === '') {
    if (obligatorio) rechazar(`Falta ${campo}`, 400);
    return '';
  }
  if (typeof v !== 'string' || v.length > max) rechazar(`${campo} no es válido (máximo ${max} caracteres)`, 400);
  return v.trim();
};

// Normaliza y valida las escenas; con estado "publicado" exige que el recorrido esté completo
function validarEscenas(sim) {
  if (sim.modo !== 'escenarios') return;
  if (!Array.isArray(sim.escenas)) sim.escenas = [];
  if (sim.escenas.length > MAX_ESCENAS) rechazar(`Máximo ${MAX_ESCENAS} escenas`, 400);
  const ids = new Set();
  sim.escenas = sim.escenas.map((e, i) => {
    if (!e || typeof e !== 'object') rechazar(`La escena ${i + 1} no es válida`, 400);
    const id = texto(e.id, 40, `el identificador de la escena ${i + 1}`);
    if (ids.has(id)) rechazar(`El identificador de escena "${id}" está repetido`, 400);
    ids.add(id);
    const opciones = Array.isArray(e.opciones) ? e.opciones : [];
    if (opciones.length > MAX_OPCIONES) rechazar(`La escena "${id}" tiene más de ${MAX_OPCIONES} opciones`, 400);
    return {
      id,
      texto: texto(e.texto, MAX_TEXTO, `el texto de la escena "${id}"`, sim.estado === 'publicado'),
      imagen: texto(e.imagen, 500, `la imagen de la escena "${id}"`, false),
      opciones: opciones.map((o, j) => {
        const puntos = Number(o?.puntos ?? 0);
        if (!Number.isFinite(puntos) || Math.abs(puntos) > 1000) rechazar(`Puntos no válidos en la opción ${j + 1} de "${id}"`, 400);
        return {
          texto: texto(o?.texto, 300, `el texto de la opción ${j + 1} de "${id}"`, sim.estado === 'publicado'),
          destino: texto(o?.destino, 40, `el destino de la opción ${j + 1} de "${id}"`, sim.estado === 'publicado'),
          puntos,
          consecuencia: texto(o?.consecuencia, 1000, `la consecuencia de la opción ${j + 1} de "${id}"`, false)
        };
      })
    };
  });
  // Mismas reglas que el editor (publico/js/nucleo/escenarios.js)
  if (sim.estado === 'publicado') rechazarErrores(validarEscenario(sim));
}

function rechazarErrores(errores) {
  if (!errores.length) return;
  const err = new Error(`No se puede publicar: ${errores[0].mensaje}${errores.length > 1 ? ` (y ${errores.length - 1} problema(s) más)` : ''}`);
  err.estado = 400;
  err.errores = errores;
  throw err;
}

// Normaliza personaje, rúbrica y turnos del modo rol; al publicar aplica validarRol
function validarDatosRol(sim) {
  if (sim.modo !== 'rol') return;
  const p = sim.personaje && typeof sim.personaje === 'object' ? sim.personaje : {};
  sim.personaje = {
    nombre: texto(p.nombre, 80, 'el nombre del personaje', false),
    descripcion: texto(p.descripcion, 1000, 'la descripción del personaje', false),
    contexto: texto(p.contexto, 1500, 'el contexto del caso', false),
    objetivo: texto(p.objetivo, 600, 'el objetivo del estudiante', false)
  };
  const rubrica = Array.isArray(sim.rubrica) ? sim.rubrica : [];
  if (rubrica.length > 5) rechazar('La rúbrica admite como máximo 5 criterios', 400);
  sim.rubrica = rubrica.map((c, i) => ({
    criterio: texto(c?.criterio, 120, `el nombre del criterio ${i + 1}`, false),
    descripcion: texto(c?.descripcion, 500, `la descripción del criterio ${i + 1}`, false),
    puntos: Number(c?.puntos) || 0
  }));
  sim.maxTurnos = Number(sim.maxTurnos) || 6;
  if (sim.estado === 'publicado') rechazarErrores(validarRol(sim));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (anterior) await exigirEdicion(usuario, anterior.temaId);
  if (datos === null) return datos;   // eliminar: basta con poder editar el tema
  if (!datos || typeof datos !== 'object') rechazar('Datos no válidos', 400);

  const sim = { ...(anterior || {}), ...datos };
  delete sim.id;
  delete sim.fecha;
  if (!anterior || sim.temaId !== anterior.temaId) await exigirEdicion(usuario, sim.temaId);
  sim.titulo = texto(sim.titulo, MAX_TITULO, 'el título');
  if (!MODOS.includes(sim.modo)) rechazar('Modo no válido (escenarios o rol)', 400);
  sim.estado = sim.estado || 'borrador';
  if (!ESTADOS.includes(sim.estado)) rechazar('Estado no válido (borrador o publicado)', 400);
  sim.escenaInicial = sim.escenaInicial || sim.escenas?.[0]?.id || '';
  validarEscenas(sim);
  validarDatosRol(sim);
  if (!anterior) sim.autorId = usuario.id;
  return sim;
}

export default { filtrarLista, antesDeGuardar };
