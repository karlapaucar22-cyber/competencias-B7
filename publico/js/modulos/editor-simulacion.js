// publico/js/modulos/editor-simulacion.js
// Editor de simulaciones: datos generales; escenarios (escenas, opciones, validación y mapa)
// o juego de roles (personaje, rúbrica y máximo de turnos)

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import {
  validarEscenario, validarRol, mapaEscenario, MIN_OPCIONES, MAX_OPCIONES, MIN_PUNTOS, MAX_PUNTOS,
  MIN_CRITERIOS, MAX_CRITERIOS, MAX_PUNTOS_CRITERIO
} from '../nucleo/escenarios.js';

await montarPlantilla({ titulo: 'Editor de simulación', roles: ['docente', 'admin'] });

const $ = (id) => document.getElementById(id);
const usuario = usuarioActual();
let sim = null;           // { id?, temaId, titulo, modo, estado, escenaInicial, escenas }
let sucio = false;

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

const etiqueta = (id) => String(id).toUpperCase();
const opcionVacia = () => ({ texto: '', destino: '', puntos: 0, consecuencia: '' });
const resumen = (texto, largo = 40) => {
  const limpio = String(texto || '').replace(/\*\*/g, '').trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1)}…` : limpio;
};

function marcarSucio() {
  sucio = true;
  $('estadoGuardado').textContent = 'Cambios sin guardar.';
}

function nuevoId() {
  const numeros = sim.escenas.map((e) => Number(/^e(\d+)$/.exec(e.id)?.[1]) || 0);
  return `e${Math.max(0, ...numeros) + 1}`;
}

// ---------- Campo con etiqueta ----------
function campo({ id, etiqueta: texto, control, clase = '' }) {
  const caja = crear('div', `campo ${clase}`.trim());
  const label = crear('label', '', texto);
  label.htmlFor = id;
  control.id = id;
  caja.append(label, control);
  return caja;
}

// ---------- Escenas ----------
function tarjetaEscena(escena) {
  const esFinal = !escena.opciones.length;
  const art = crear('article', `escena-tarjeta${esFinal ? ' escena-tarjeta--final' : ''}`);
  art.id = `escena-${escena.id}`;
  art.tabIndex = -1;
  art.setAttribute('aria-labelledby', `nombre-${escena.id}`);

  const cabecera = crear('div', 'escena-tarjeta__cabecera');
  const nombre = crear('h3', 'escena-tarjeta__nombre', etiqueta(escena.id));
  nombre.id = `nombre-${escena.id}`;
  cabecera.append(nombre);
  if (escena.id === sim.escenaInicial) cabecera.append(crear('span', 'insignia insignia--primario', 'Inicial'));
  if (esFinal) cabecera.append(crear('span', 'insignia', 'Final'));
  const eliminar = crear('button', 'btn btn--texto btn--sm', 'Eliminar escena');
  eliminar.type = 'button';
  eliminar.setAttribute('aria-label', `Eliminar la escena ${etiqueta(escena.id)}`);
  eliminar.addEventListener('click', () => eliminarEscena(escena.id));
  cabecera.append(eliminar);

  // Texto
  const texto = crear('textarea');
  texto.maxLength = 4000;
  texto.value = escena.texto;
  texto.addEventListener('input', () => { escena.texto = texto.value; marcarSucio(); pintarMapa(); actualizarDestinos(); });

  // Imagen (api.subir)
  const zonaImagen = crear('div', 'escena-tarjeta__imagen');
  const archivo = crear('input');
  archivo.type = 'file';
  archivo.accept = 'image/*';
  archivo.addEventListener('change', () => subirImagen(escena, archivo));
  zonaImagen.append(campo({ id: `imagen-${escena.id}`, etiqueta: 'Imagen (opcional)', control: archivo }));
  if (escena.imagen) {
    const miniatura = crear('img', 'escena-tarjeta__miniatura');
    miniatura.src = escena.imagen;
    miniatura.alt = `Imagen de la escena ${etiqueta(escena.id)}`;
    const quitar = crear('button', 'btn btn--texto btn--sm', 'Quitar imagen');
    quitar.type = 'button';
    quitar.addEventListener('click', () => { escena.imagen = ''; marcarSucio(); pintarEscenas(`imagen-${escena.id}`); });
    zonaImagen.append(miniatura, quitar);
  }

  // ¿Final?
  const casilla = crear('label', 'escena-tarjeta__casilla');
  const marca = crear('input');
  marca.type = 'checkbox';
  marca.checked = esFinal;
  marca.addEventListener('change', () => cambiarFinal(escena, marca.checked));
  casilla.append(marca, ' Es un final (sin opciones)');

  art.append(cabecera, campo({ id: `texto-${escena.id}`, etiqueta: 'Texto de la escena (admite **negritas** y listas con "- ")', control: texto }), zonaImagen, casilla);

  if (!esFinal) {
    const grupo = crear('fieldset');
    grupo.append(crear('legend', '', `Opciones (${MIN_OPCIONES} a ${MAX_OPCIONES})`));
    escena.opciones.forEach((opcion, i) => grupo.append(bloqueOpcion(escena, opcion, i)));
    const agregar = crear('button', 'btn btn--secundario btn--sm', '＋ Agregar opción');
    agregar.type = 'button';
    agregar.disabled = escena.opciones.length >= MAX_OPCIONES;
    agregar.addEventListener('click', () => {
      escena.opciones.push(opcionVacia());
      marcarSucio();
      pintarEscenas(`${escena.id}-o${escena.opciones.length - 1}-texto`);
    });
    grupo.append(agregar);
    art.append(grupo);
  }
  return art;
}

function bloqueOpcion(escena, opcion, i) {
  const base = `${escena.id}-o${i}`;
  const caja = crear('div', 'opcion-editor');
  const titulo = crear('p', 'opcion-editor__titulo');
  titulo.append(crear('strong', '', `Opción ${i + 1}`));
  const quitar = crear('button', 'btn btn--texto btn--sm', 'Eliminar opción');
  quitar.type = 'button';
  quitar.disabled = escena.opciones.length <= MIN_OPCIONES;
  quitar.setAttribute('aria-label', `Eliminar la opción ${i + 1} de ${etiqueta(escena.id)}`);
  quitar.addEventListener('click', () => {
    escena.opciones.splice(i, 1);
    marcarSucio();
    pintarEscenas(`${escena.id}-o0-texto`);
  });
  titulo.append(quitar);

  const texto = crear('input');
  texto.type = 'text';
  texto.maxLength = 300;
  texto.value = opcion.texto;
  texto.addEventListener('input', () => { opcion.texto = texto.value; marcarSucio(); pintarMapa(); });

  const destino = crear('select');
  destino.dataset.destino = escena.id;
  llenarDestinos(destino, escena.id, opcion.destino);
  destino.addEventListener('change', () => { opcion.destino = destino.value; marcarSucio(); pintarMapa(); });

  const puntos = crear('input');
  puntos.type = 'number';
  puntos.min = String(MIN_PUNTOS);
  puntos.max = String(MAX_PUNTOS);
  puntos.step = '1';
  puntos.value = String(opcion.puntos ?? 0);
  puntos.addEventListener('input', () => { opcion.puntos = puntos.value === '' ? '' : Number(puntos.value); marcarSucio(); pintarMapa(); });

  const consecuencia = crear('textarea');
  consecuencia.maxLength = 1000;
  consecuencia.rows = 2;
  consecuencia.value = opcion.consecuencia;
  consecuencia.addEventListener('input', () => { opcion.consecuencia = consecuencia.value; marcarSucio(); });

  caja.append(
    titulo,
    campo({ id: `${base}-texto`, etiqueta: 'Texto de la opción', control: texto }),
    campo({ id: `${base}-destino`, etiqueta: 'Lleva a', control: destino }),
    campo({ id: `${base}-puntos`, etiqueta: `Puntos (${MIN_PUNTOS} a ${MAX_PUNTOS})`, control: puntos }),
    campo({ id: `${base}-consecuencia`, etiqueta: 'Consecuencia (retroalimentación)', control: consecuencia, clase: 'opcion-editor__consecuencia' })
  );
  return caja;
}

function llenarDestinos(select, propia, valor) {
  const opciones = [crear('option', '', 'Elige la escena')];
  opciones[0].value = '';
  for (const e of sim.escenas) {
    if (e.id === propia) continue;
    const o = crear('option', '', `${etiqueta(e.id)}${e.texto ? ` · ${resumen(e.texto, 32)}` : ''}${e.opciones.length ? '' : ' (final)'}`);
    o.value = e.id;
    opciones.push(o);
  }
  select.replaceChildren(...opciones);
  select.value = sim.escenas.some((e) => e.id === valor && e.id !== propia) ? valor : '';
}

// Refresca las etiquetas de destino sin redibujar (mantiene el foco al escribir)
function actualizarDestinos() {
  document.querySelectorAll('select[data-destino]').forEach((s) => llenarDestinos(s, s.dataset.destino, s.value));
  const inicial = $('simInicial');
  const valor = inicial.value;
  inicial.replaceChildren(...sim.escenas.map((e) => {
    const o = crear('option', '', `${etiqueta(e.id)}${e.texto ? ` · ${resumen(e.texto, 40)}` : ''}`);
    o.value = e.id;
    return o;
  }));
  inicial.value = sim.escenas.some((e) => e.id === valor) ? valor : sim.escenaInicial;
}

function pintarEscenas(enfocar) {
  $('listaEscenas').replaceChildren(...sim.escenas.map(tarjetaEscena));
  actualizarDestinos();
  pintarMapa();
  if (enfocar) document.getElementById(enfocar)?.focus();
}

function agregarEscena() {
  const id = nuevoId();
  sim.escenas.push({ id, texto: '', imagen: '', opciones: [opcionVacia(), opcionVacia()] });
  if (!sim.escenaInicial) sim.escenaInicial = id;
  marcarSucio();
  pintarEscenas(`texto-${id}`);
  document.getElementById(`escena-${id}`)?.scrollIntoView({ block: 'start' });
}

async function eliminarEscena(id) {
  if (sim.escenas.length <= 1) {
    ui.aviso('El escenario necesita al menos una escena.', 'error');
    return;
  }
  const usada = sim.escenas.some((e) => e.opciones.some((o) => o.destino === id));
  if (!(await ui.confirmar(`¿Eliminar la escena ${etiqueta(id)}?${usada ? ' Las opciones que llevan a ella quedarán sin destino.' : ''}`))) return;
  sim.escenas = sim.escenas.filter((e) => e.id !== id);
  sim.escenas.forEach((e) => e.opciones.forEach((o) => { if (o.destino === id) o.destino = ''; }));
  if (sim.escenaInicial === id) sim.escenaInicial = sim.escenas[0].id;
  marcarSucio();
  pintarEscenas('btnAgregarEscena');
}

async function cambiarFinal(escena, final) {
  if (final && escena.opciones.some((o) => o.texto || o.consecuencia)
    && !(await ui.confirmar(`¿Convertir ${etiqueta(escena.id)} en un final? Se borrarán sus opciones.`))) {
    pintarEscenas(`escena-${escena.id}`);
    return;
  }
  escena.opciones = final ? [] : [opcionVacia(), opcionVacia()];
  marcarSucio();
  pintarEscenas(final ? `texto-${escena.id}` : `${escena.id}-o0-texto`);
}

async function subirImagen(escena, input) {
  const archivo = input.files?.[0];
  if (!archivo) return;
  if (!archivo.type.startsWith('image/')) {
    ui.aviso('Elige un archivo de imagen.', 'error');
    input.value = '';
    return;
  }
  try {
    const { url } = await api.subir(archivo);
    escena.imagen = url;
    marcarSucio();
    ui.aviso('Imagen subida.', 'exito');
    pintarEscenas(`imagen-${escena.id}`);
  } catch (err) {
    ui.aviso(`No se pudo subir la imagen: ${err.message}`, 'error');
    input.value = '';
  }
}

// ---------- Mapa ----------
function pintarMapa() {
  const { raiz, sueltas } = mapaEscenario(sim);
  const enlaceEscena = (id) => {
    const a = crear('a', '', etiqueta(id));
    a.href = `#escena-${id}`;
    a.addEventListener('click', (ev) => { ev.preventDefault(); irAEscena(id); });
    return a;
  };
  const rama = (nodo) => {
    const ul = crear('ul');
    for (const h of nodo.hijos) {
      const li = crear('li');
      li.append('→ ');
      if (h.nodo.inexistente) li.append(crear('span', 'mapa-escenario__aviso', '⚠ sin destino'));
      else li.append(enlaceEscena(h.nodo.id));
      li.append(crear('span', 'mapa-escenario__opcion', ` (${resumen(h.opcion, 36) || 'opción sin texto'}, ${h.puntos > 0 ? '+' : ''}${h.puntos})`));
      if (h.nodo.final) li.append(' · final');
      if (h.nodo.repetida) li.append(crear('span', 'mapa-escenario__opcion', ' ↩ ya aparece arriba'));
      if (h.nodo.hijos.length) li.append(rama(h.nodo));
      ul.append(li);
    }
    return ul;
  };
  const contenido = [];
  if (raiz) {
    const ul = crear('ul');
    const li = crear('li');
    li.append(enlaceEscena(raiz.id), ' (inicio)');
    if (raiz.hijos.length) li.append(rama(raiz));
    ul.append(li);
    contenido.push(ul);
  } else {
    contenido.push(crear('p', 'mapa-escenario__aviso', 'Elige la escena inicial.'));
  }
  if (sueltas.length) {
    const p = crear('p', 'mapa-escenario__aviso', 'Sin conexión desde la inicial: ');
    sueltas.forEach((id, i) => { if (i) p.append(', '); p.append(enlaceEscena(id)); });
    contenido.push(p);
  }
  $('mapa').replaceChildren(...contenido);
}

function irAEscena(id) {
  const tarjeta = document.getElementById(`escena-${id}`);
  if (!tarjeta) return;
  tarjeta.scrollIntoView({ block: 'start' });
  tarjeta.focus();
}

// ---------- Validación y guardado ----------
function mostrarErrores(errores) {
  document.querySelectorAll('.escena-tarjeta--error').forEach((t) => t.classList.remove('escena-tarjeta--error'));
  $('panelErrores').hidden = !errores.length;
  $('listaErrores').replaceChildren(...errores.map((e) => {
    const li = crear('li');
    if (e.escena && sim.escenas.some((x) => x.id === e.escena)) {
      document.getElementById(`escena-${e.escena}`)?.classList.add('escena-tarjeta--error');
      const a = crear('a', '', e.mensaje);
      a.href = `#escena-${e.escena}`;
      a.addEventListener('click', (ev) => { ev.preventDefault(); irAEscena(e.escena); });
      li.append(a);
    } else {
      li.textContent = e.mensaje;
    }
    return li;
  }));
  if (errores.length) $('panelErrores').focus();
}

function leerGenerales() {
  sim.titulo = $('simTitulo').value.trim();
  sim.temaId = $('simTema').value;
  sim.modo = $('simModo').value;
  sim.estado = $('simEstado').value;
  if (sim.modo === 'escenarios') sim.escenaInicial = $('simInicial').value || sim.escenas[0]?.id || '';
}

async function guardar() {
  leerGenerales();
  const errores = [];
  if (!sim.titulo) errores.push({ escena: null, mensaje: 'Escribe el título de la simulación.' });
  if (!sim.temaId) errores.push({ escena: null, mensaje: 'Elige el tema.' });
  if (sim.estado === 'publicado') {
    const validacion = sim.modo === 'rol' ? validarRol(sim) : validarEscenario(sim);
    for (const e of validacion) if (!errores.some((x) => x.mensaje === e.mensaje)) errores.push(e);
  }
  mostrarErrores(errores);
  if (errores.length) return;

  const datos = {
    temaId: sim.temaId, titulo: sim.titulo, modo: sim.modo, estado: sim.estado,
    escenaInicial: sim.escenaInicial, escenas: sim.escenas,
    personaje: sim.personaje, rubrica: sim.rubrica, maxTurnos: sim.maxTurnos
  };
  $('btnGuardar').disabled = true;
  try {
    const guardada = sim.id ? await api.actualizar('simulaciones', sim.id, datos) : await api.crear('simulaciones', datos);
    const nueva = !sim.id;
    sim.id = guardada.id;
    sucio = false;
    $('estadoGuardado').textContent = `Guardada (${sim.estado === 'publicado' ? 'publicada' : 'borrador'}).`;
    ui.aviso(sim.estado === 'publicado' ? 'Simulación publicada.' : 'Borrador guardado.', 'exito');
    if (nueva) history.replaceState(null, '', `?id=${encodeURIComponent(sim.id)}`);
    pintarCabecera();
  } catch (err) {
    mostrarErrores([{ escena: null, mensaje: err.message }]);
  } finally {
    $('btnGuardar').disabled = false;
  }
}

// ---------- Modo rol: personaje y rúbrica ----------
const criterioVacio = () => ({ criterio: '', descripcion: '', puntos: 5 });

function pintarCriterios(enfocar) {
  const total = sim.rubrica.reduce((s, c) => s + (Number(c.puntos) || 0), 0);
  $('totalRubrica').textContent = `Puntaje máximo de la rúbrica: ${total}.`;
  $('btnAgregarCriterio').disabled = sim.rubrica.length >= MAX_CRITERIOS;
  $('listaCriterios').replaceChildren(...sim.rubrica.map((c, i) => {
    const caja = crear('div', 'criterio-editor');
    const nombre = crear('input');
    nombre.type = 'text';
    nombre.maxLength = 120;
    nombre.value = c.criterio;
    nombre.addEventListener('input', () => { c.criterio = nombre.value; marcarSucio(); });
    const puntos = crear('input');
    puntos.type = 'number';
    puntos.min = '1';
    puntos.max = String(MAX_PUNTOS_CRITERIO);
    puntos.step = '1';
    puntos.value = String(c.puntos);
    puntos.addEventListener('input', () => {
      c.puntos = puntos.value === '' ? '' : Number(puntos.value);
      marcarSucio();
      $('totalRubrica').textContent = `Puntaje máximo de la rúbrica: ${sim.rubrica.reduce((s, x) => s + (Number(x.puntos) || 0), 0)}.`;
    });
    const descripcion = crear('textarea');
    descripcion.rows = 2;
    descripcion.maxLength = 500;
    descripcion.value = c.descripcion;
    descripcion.addEventListener('input', () => { c.descripcion = descripcion.value; marcarSucio(); });
    const quitar = crear('button', 'btn btn--texto btn--sm', 'Eliminar criterio');
    quitar.type = 'button';
    quitar.disabled = sim.rubrica.length <= MIN_CRITERIOS;
    quitar.setAttribute('aria-label', `Eliminar el criterio ${i + 1}`);
    quitar.addEventListener('click', () => { sim.rubrica.splice(i, 1); marcarSucio(); pintarCriterios('btnAgregarCriterio'); });
    caja.append(
      campo({ id: `criterio-${i}`, etiqueta: `Criterio ${i + 1}`, control: nombre }),
      campo({ id: `criterio-${i}-puntos`, etiqueta: `Puntos (1 a ${MAX_PUNTOS_CRITERIO})`, control: puntos }),
      campo({ id: `criterio-${i}-descripcion`, etiqueta: 'Qué se espera del estudiante', control: descripcion, clase: 'criterio-editor__descripcion' }),
      quitar
    );
    return caja;
  }));
  if (enfocar) document.getElementById(enfocar)?.focus();
}

function montarRol() {
  const p = sim.personaje;
  const enlazar = (id, clave) => {
    $(id).value = p[clave] || '';
    $(id).addEventListener('input', () => { p[clave] = $(id).value; marcarSucio(); });
  };
  enlazar('rolNombre', 'nombre');
  enlazar('rolDescripcion', 'descripcion');
  enlazar('rolContexto', 'contexto');
  enlazar('rolObjetivo', 'objetivo');
  $('rolTurnos').value = String(sim.maxTurnos);
  $('rolTurnos').addEventListener('input', () => { sim.maxTurnos = $('rolTurnos').value === '' ? '' : Number($('rolTurnos').value); marcarSucio(); });
  $('btnAgregarCriterio').addEventListener('click', () => {
    sim.rubrica.push(criterioVacio());
    marcarSucio();
    pintarCriterios(`criterio-${sim.rubrica.length - 1}`);
  });
  pintarCriterios();
}

// ---------- Borrador con IA ----------
const MAX_SITUACION = 800;
const tieneContenido = () => sim.escenas.some((e) => e.texto.trim() || e.opciones.some((o) => o.texto.trim()));

async function generarConIA() {
  leerGenerales();
  if (!sim.temaId) {
    mostrarErrores([{ escena: null, mensaje: 'Elige el tema antes de generar el borrador con IA.' }]);
    return;
  }
  const form = crear('form');
  form.noValidate = true;
  form.innerHTML = `
    <div class="campo">
      <label for="iaSituacion">Situación que quieres simular</label>
      <textarea id="iaSituacion" rows="5" maxlength="${MAX_SITUACION}" aria-describedby="iaContador iaAyuda" placeholder="Ej.: Un estudiante interrumpe la clase usando el celular durante una evaluación..."></textarea>
      <span id="iaContador" class="editor-sim__nota">0 / ${MAX_SITUACION}</span>
      <span id="iaAyuda" class="editor-sim__nota">La IA usa el contenido del tema; revisa y ajusta el resultado antes de publicar.</span>
    </div>
    <div class="campo">
      <label for="iaEscenas">Número de escenas (5 a 10)</label>
      <input type="number" id="iaEscenas" min="5" max="10" step="1" value="6">
    </div>
    ${tieneContenido() ? '<p class="alerta alerta--advertencia">Reemplazará las escenas actuales (no se guarda hasta que pulses «Guardar»).</p>' : ''}
    <p class="editor-sim__nota" id="iaEstado" role="status"></p>
    <p class="campo__error" id="iaError" role="alert" hidden></p>`;
  const situacion = form.querySelector('#iaSituacion');
  situacion.addEventListener('input', () => { form.querySelector('#iaContador').textContent = `${situacion.value.length} / ${MAX_SITUACION}`; });

  let resultado = null;
  let generando = false;
  await ui.modal({
    titulo: 'Generar borrador con IA',
    contenido: form,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      {
        texto: 'Generar',
        valor: 'generar',
        clase: 'btn btn--primario',
        validar: async () => {
          if (generando) return false;
          const error = form.querySelector('#iaError');
          const mostrar = (texto) => { error.textContent = texto; error.hidden = false; return false; };
          const escenas = Number(form.querySelector('#iaEscenas').value);
          if (!situacion.value.trim()) return mostrar('Describe la situación.');
          if (!Number.isInteger(escenas) || escenas < 5 || escenas > 10) return mostrar('El número de escenas debe estar entre 5 y 10.');
          error.hidden = true;
          generando = true;
          form.querySelector('#iaEstado').textContent = 'Generando el escenario con IA… puede tardar hasta un minuto.';
          form.querySelectorAll('textarea, input').forEach((c) => { c.disabled = true; });
          try {
            resultado = await api.ia('generar-escenario', { temaId: sim.temaId, situacion: situacion.value.trim(), escenas });
            return true;
          } catch (err) {
            form.querySelector('#iaEstado').textContent = '';
            form.querySelectorAll('textarea, input').forEach((c) => { c.disabled = false; });
            return mostrar(err.message);
          } finally {
            generando = false;
          }
        }
      }
    ]
  });
  if (resultado) cargarBorrador(resultado);
}

// Carga el resultado como borrador (sin guardar) y muestra la validación
function cargarBorrador(resultado) {
  sim.escenas = resultado.escenas.map((e) => ({ id: e.id, texto: e.texto || '', imagen: '', opciones: (e.opciones || []).map((o) => ({ ...opcionVacia(), ...o })) }));
  sim.escenaInicial = resultado.escenaInicial;
  if (!$('simTitulo').value.trim()) $('simTitulo').value = resultado.titulo;
  $('simEstado').value = 'borrador';
  sim.estado = 'borrador';
  marcarSucio();
  pintarEscenas();
  $('simInicial').value = sim.escenaInicial;
  leerGenerales();
  const errores = validarEscenario(sim);
  mostrarErrores(errores);
  $('estadoGuardado').textContent = `Borrador generado con IA (${sim.escenas.length} escenas): revísalo y pulsa «Guardar».`;
  if (!errores.length) {
    ui.aviso('Borrador generado y sin errores de estructura. Revísalo antes de publicar.', 'exito');
    $('listaEscenas').querySelector('.escena-tarjeta')?.focus();
  }
}

// ---------- Datos generales ----------
function pintarCabecera() {
  $('tituloEditor').textContent = sim.id ? `Editar: ${sim.titulo || 'simulación'}` : 'Nueva simulación';
  $('btnPrevia').hidden = !sim.id;
  if (sim.id) $('btnPrevia').href = `/paginas/simulador.html?id=${encodeURIComponent(sim.id)}&vista=previa`;
}

function aplicarModo() {
  const rol = $('simModo').value === 'rol';
  $('zonaRol').hidden = !rol;
  $('zonaEscenarios').hidden = rol;
  $('campoInicial').hidden = rol;
}

async function cargarTemas() {
  const [temas, unidades, asignaturas, grupos] = await Promise.all(['temas', 'unidades', 'asignaturas', 'distributivo'].map((c) => api.listar(c)));
  // Docente: temas de las asignaturas de sus grupos; admin: todos
  const permitidas = new Set(usuario.rol === 'admin' ? asignaturas.map((a) => a.id) : grupos.filter((g) => g.docenteId === usuario.id).map((g) => g.asignaturaId));
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));
  const orden = (x) => Number(x?.orden) || 0;
  const select = $('simTema');
  for (const a of asignaturas.filter((x) => permitidas.has(x.id))) {
    const grupo = crear('optgroup');
    grupo.label = a.nombre;
    temas.filter((t) => unidadPorId.get(t.unidadId)?.asignaturaId === a.id)
      .sort((x, y) => orden(unidadPorId.get(x.unidadId)) - orden(unidadPorId.get(y.unidadId)) || orden(x) - orden(y))
      .forEach((t) => {
        const o = crear('option', '', t.titulo);
        o.value = t.id;
        grupo.append(o);
      });
    if (grupo.children.length) select.append(grupo);
  }
}

async function iniciar() {
  const id = util.parametro('id');
  try {
    await cargarTemas();
    sim = id ? await api.obtener('simulaciones', id) : null;
  } catch (err) {
    $('estadoCarga').textContent = `No se pudo abrir el editor: ${err.message}`;
    return;
  }
  if (!sim) {
    sim = { temaId: util.parametro('temaId') || '', titulo: '', modo: 'escenarios', estado: 'borrador', escenaInicial: 'e1', escenas: [{ id: 'e1', texto: '', imagen: '', opciones: [opcionVacia(), opcionVacia()] }] };
  }
  sim.escenas = (sim.escenas || []).map((e) => ({ id: e.id, texto: e.texto || '', imagen: e.imagen || '', opciones: (e.opciones || []).map((o) => ({ ...opcionVacia(), ...o })) }));
  if (!sim.escenas.length) sim.escenas = [{ id: 'e1', texto: '', imagen: '', opciones: [opcionVacia(), opcionVacia()] }];
  sim.personaje = { nombre: '', descripcion: '', contexto: '', objetivo: '', ...(sim.personaje || {}) };
  sim.rubrica = Array.isArray(sim.rubrica) && sim.rubrica.length ? sim.rubrica.map((c) => ({ ...criterioVacio(), ...c })) : [criterioVacio(), criterioVacio(), criterioVacio()];
  sim.maxTurnos = Number(sim.maxTurnos) || 6;

  $('estadoCarga').textContent = '';
  $('editor').hidden = false;
  $('simTitulo').value = sim.titulo || '';
  $('simTema').value = sim.temaId || '';
  if (sim.temaId && $('simTema').value !== sim.temaId) ui.aviso('No puedes editar simulaciones de ese tema.', 'error');
  $('simModo').value = sim.modo || 'escenarios';
  $('simEstado').value = sim.estado || 'borrador';
  pintarCabecera();
  aplicarModo();
  pintarEscenas();
  montarRol();
  $('simInicial').value = sim.escenaInicial;

  for (const control of ['simTitulo', 'simTema', 'simEstado']) $(control).addEventListener('input', marcarSucio);
  $('simModo').addEventListener('change', () => { aplicarModo(); marcarSucio(); });
  $('simInicial').addEventListener('change', () => { sim.escenaInicial = $('simInicial').value; marcarSucio(); pintarEscenas(); $('simInicial').focus(); });
  $('btnAgregarEscena').addEventListener('click', agregarEscena);
  $('btnGenerarIA').addEventListener('click', generarConIA);
  $('btnGuardar').addEventListener('click', guardar);
  $('btnPrevia').addEventListener('click', () => { if (sucio) ui.aviso('La vista previa muestra la última versión guardada.', 'info'); });
  window.addEventListener('beforeunload', (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } });
}

if (['docente', 'admin'].includes(usuario?.rol)) await iniciar();
