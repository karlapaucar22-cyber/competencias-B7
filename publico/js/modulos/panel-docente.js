// publico/js/modulos/panel-docente.js
// Panel docente: grupos, tabla ordenable, promedio por tema, detalle del estudiante y exportación CSV

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: 'Panel docente', roles: ['docente', 'admin'] });
const permitido = ['docente', 'admin'].includes(usuarioActual()?.rol);   // si no, la plantilla ya redirigió

const $ = (id) => document.getElementById(id);
const NOMBRES = { ...Object.fromEntries(ACTIVIDADES.map((a) => [a.id, a.texto])), 'tema-revisado': 'Tema revisado', crucigrama: 'Crucigrama', simulacion: 'Simulación', foro: 'Foros' };
const nombreActividad = (id) => NOMBRES[id] || id;
const decimal = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('es-EC', { maximumFractionDigits: 1 }));
const nombreCompleto = (e) => `${e.apellido || ''} ${e.nombre || ''}`.trim();

let datos = null;                       // respuesta de /api/resumen/grupo/:id
let orden = { campo: 'nombre', direccion: 'ascending' };
let grafico = null;

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto !== '') nodo.textContent = texto;
  return nodo;
}

function mostrarError(mensaje) {
  $('panelError').hidden = !mensaje;
  $('panelError').textContent = mensaje || '';
}

// ---------- Grupos ----------

async function cargarGrupos() {
  let grupos = [], asignaturas = [];
  try {
    [grupos, asignaturas] = await Promise.all([api.listar('distributivo'), api.listar('asignaturas')]);
  } catch (err) {
    return mostrarError(`No se pudieron cargar los grupos: ${err.message}`);
  }
  const yo = usuarioActual();
  if (yo.rol === 'docente') grupos = grupos.filter((g) => g.docenteId === yo.id);

  const nombreAsig = new Map(asignaturas.map((a) => [a.id, a.nombre]));
  const selector = $('selectorGrupo');
  if (!grupos.length) {
    selector.replaceChildren(crear('option', '', 'Sin grupos'));
    selector.disabled = true;
    $('sinGrupos').hidden = false;
    return;
  }
  selector.replaceChildren(...grupos.map((g) => {
    const op = crear('option', '', `${nombreAsig.get(g.asignaturaId) || 'Asignatura'} · Paralelo ${g.paralelo} · ${g.periodo}`);
    op.value = g.id;
    return op;
  }));
  const inicial = util.parametro('grupoId');
  if (inicial && grupos.some((g) => g.id === inicial)) selector.value = inicial;
  selector.addEventListener('change', () => cargarGrupo(selector.value));
  await cargarGrupo(selector.value);
}

async function cargarGrupo(grupoId) {
  mostrarError('');
  $('btnExportar').disabled = true;
  try {
    datos = await api.llamar('GET', `/api/resumen/grupo/${encodeURIComponent(grupoId)}`);
  } catch (err) {
    $('contenidoGrupo').hidden = true;
    return mostrarError(`No se pudo cargar el grupo: ${err.message}`);
  }
  const url = new URL(window.location.href);
  url.searchParams.set('grupoId', grupoId);
  window.history.replaceState(null, '', url);

  $('contenidoGrupo').hidden = false;
  $('btnExportar').disabled = datos.estudiantes.length === 0;
  pintarResumen();
  pintarTabla();
  pintarGrafico();
  cargarTutor(grupoId);
  cargarNeuroritmo(grupoId);
}

// ---------- NeuroRitmo (reutiliza /api/neuroritmo/panel: el servidor limita al docente del grupo) ----------

const ESTADOS_NEURO = { bloqueada: '🔒', abierta: '▶️', aprobada: '✅', pendiente: '⏳', devuelta: '✍️' };
const TEXTO_ESTADO = { bloqueada: 'bloqueada', abierta: 'disponible', aprobada: 'superada', pendiente: 'por valorar', devuelta: 'devuelta' };

async function cargarNeuroritmo(grupoId) {
  const nota = $('notaNeuro');
  $('contenidoNeuro').hidden = true;
  $('enlaceNeuro').href = `/index.html?grupoId=${encodeURIComponent(grupoId)}#panel`;
  let d, e;
  try {
    [d, { experiencia: e }] = await Promise.all([
      api.llamar('GET', `/api/neuroritmo/panel?grupoId=${encodeURIComponent(grupoId)}`),
      api.llamar('GET', '/api/neuroritmo')
    ]);
  } catch (err) {
    nota.textContent = err.estado === 400 ? 'Este grupo no participa en NeuroRitmo.' : `No se pudo cargar NeuroRitmo: ${err.message}`;
    return;
  }
  const r = e.reglas;
  const porRevisar = d.pendientes.filter((p) => p.etapa === 'enviado').length;
  const enRevision = d.pendientes.length - porRevisar;
  nota.textContent = `Cada misión se supera con ${r.aprobacion}/${r.puntosPorMision}; se conserva la mejor nota.`;
  const cifras = [
    [String(d.estudiantes.filter((s) => s.cumple).length), 'Ruta completada'],
    [String(d.pendientes.length), 'Justificaciones de M3 pendientes'],
    [`${porRevisar} / ${enRevision}`, 'Propuestas M3 por revisar / en revisión'],
    [String(d.alertas.length), 'Alertas de apoyo activas']
  ];
  $('resumenNeuro').replaceChildren(...cifras.map(([valor, etiqueta]) => {
    const li = crear('li', 'tarjeta');
    li.append(crear('span', 'panel-resumen__valor', valor), crear('span', 'panel-resumen__etiqueta', etiqueta));
    return li;
  }));

  const celda = (m) => crear('td', '', `${ESTADOS_NEURO[m.estado] || ''} ${m.mejor}/${r.puntosPorMision} · ${m.intentos} int. (${TEXTO_ESTADO[m.estado] || m.estado})`);
  $('tablaNeuro').querySelector('tbody').replaceChildren(...d.estudiantes.map((s) => {
    const tr = crear('tr');
    const th = crear('th', '', s.nombre);
    th.scope = 'row';
    tr.append(th, celda(s.misiones.m1), celda(s.misiones.m2), celda(s.misiones.m3), crear('td', '', `${s.total}/${r.maximoRuta}`), crear('td', '', s.alertas ? `🤝 ${s.alertas}` : '—'));
    return tr;
  }));

  $('tablaNeuroConceptos').querySelector('tbody').replaceChildren(...d.conceptos.map((c) => {
    const tr = crear('tr');
    tr.append(crear('td', '', c.mision.toUpperCase()), crear('td', '', c.concepto), crear('td', '', String(c.respuestas)),
      crear('td', '', c.logro === null ? '—' : `${c.logro} %`), crear('td', '', String(c.pistas)));
    return tr;
  }));

  $('listaNeuroAlertas').replaceChildren(...(d.alertas.length
    ? d.alertas.map((a) => crear('li', '', `${a.estudiante} ${a.detalle} (${util.fechaRelativa(a.fecha)})`))
    : [crear('li', 'panel-nota', 'Sin alertas activas.')]));

  const form = $('formPlazos');
  for (const id of ['m1', 'm2', 'm3']) form.elements[id].value = d.plazos[id] || '';
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const plazos = Object.fromEntries(['m1', 'm2', 'm3'].map((id) => [id, form.elements[id].value]));
    try {
      await api.llamar('PUT', '/api/neuroritmo/plazos', { grupoId, plazos });
      ui.aviso('Plazos guardados.', 'exito');
      await cargarNeuroritmo(grupoId);
    } catch (err) {
      ui.aviso(err.message, 'error');
    }
  };
  $('contenidoNeuro').hidden = false;
}

function pintarResumen() {
  const est = datos.estudiantes;
  const promedios = est.map((e) => e.promedio).filter((p) => p !== null);
  const media = promedios.length ? Math.round((promedios.reduce((a, b) => a + b, 0) / promedios.length) * 10) / 10 : null;
  const conAlertas = est.filter((e) => e.alertasActivas > 0).length;
  const sinActividad = est.filter((e) => e.actividades === 0).length;
  const cifras = [
    [String(est.length), 'Estudiantes'],
    [media === null ? '—' : `${decimal(media)}/10`, 'Promedio del grupo'],
    [`${est.length ? Math.round(est.reduce((a, e) => a + e.pctTemas, 0) / est.length) : 0} %`, 'Temas revisados (media)'],
    [String(sinActividad), 'Sin actividades con nota'],
    [String(conAlertas), 'Con alertas activas']
  ];
  $('resumenGrupo').replaceChildren(...cifras.map(([valor, etiqueta]) => {
    const li = crear('li', 'tarjeta');
    li.append(crear('span', 'panel-resumen__valor', valor), crear('span', 'panel-resumen__etiqueta', etiqueta));
    return li;
  }));
  $('notaAlertas').textContent = conAlertas
    ? `${conAlertas} estudiante${conAlertas === 1 ? '' : 's'} con alertas activas (resaltados en la tabla).`
    : `${datos.grupo.asignatura} · ${datos.grupo.totalTemas} temas publicados.`;
}

// ---------- Tabla ordenable ----------

function valorOrden(e, campo) {
  if (campo === 'nombre') return nombreCompleto(e).toLocaleLowerCase('es');
  return e[campo];
}

function ordenar(lista) {
  const { campo, direccion } = orden;
  const signo = direccion === 'ascending' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = valorOrden(a, campo), vb = valorOrden(b, campo);
    if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;   // vacíos al final
    if (vb === null || vb === undefined) return -1;
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
    return cmp * signo || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');
  });
}

function pintarTabla() {
  document.querySelectorAll('#tablaEstudiantes th').forEach((th) => {
    th.setAttribute('aria-sort', th.querySelector('button').dataset.campo === orden.campo ? orden.direccion : 'none');
  });
  const filas = ordenar(datos.estudiantes).map((e) => {
    const tr = crear('tr', e.alertasActivas > 0 ? 'panel-fila--alerta' : '');
    const boton = crear('button', 'panel-estudiante', nombreCompleto(e));
    boton.type = 'button';
    boton.setAttribute('aria-label', `Ver el resumen de ${nombreCompleto(e)}`);
    boton.addEventListener('click', () => verEstudiante(e));
    const celdaNombre = crear('td');
    celdaNombre.append(boton);
    const alertas = crear('td');
    if (e.alertasActivas > 0) {
      const chip = crear('button', 'chip panel-chip-alerta', `⚠ ${e.alertasActivas}`);
      chip.type = 'button';
      chip.setAttribute('aria-label', `Ver ${e.alertasActivas} alerta${e.alertasActivas === 1 ? '' : 's'} de ${nombreCompleto(e)}`);
      chip.addEventListener('click', () => verAlertas(e));
      alertas.append(chip);
    } else {
      alertas.textContent = '0';
    }
    tr.append(
      celdaNombre,
      crear('td', e.promedio === null ? 'panel-sin-dato' : '', decimal(e.promedio)),
      crear('td', '', String(e.actividades)),
      crear('td', '', `${e.pctTemas} %`),
      crear('td', e.ultimaConexion ? '' : 'panel-sin-dato', e.ultimaConexion ? util.fechaRelativa(e.ultimaConexion) : 'Nunca'),
      alertas
    );
    if (e.ultimaConexion) tr.children[4].title = new Date(e.ultimaConexion).toLocaleString('es-EC');
    return tr;
  });
  const cuerpo = $('tablaEstudiantes').querySelector('tbody');
  if (!filas.length) {
    const td = crear('td', 'panel-sin-dato', 'Este grupo no tiene estudiantes.');
    td.colSpan = 6;
    const tr = crear('tr');
    tr.append(td);
    filas.push(tr);
  }
  cuerpo.replaceChildren(...filas);
}

document.querySelectorAll('.panel-orden').forEach((boton) => {
  boton.addEventListener('click', () => {
    const campo = boton.dataset.campo;
    orden = { campo, direccion: orden.campo === campo && orden.direccion === 'ascending' ? 'descending' : 'ascending' };
    pintarTabla();
  });
});

// ---------- Gráfico por tema ----------

function token(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function pintarGrafico() {
  const temas = datos.porTema;
  $('tablaTemas').querySelector('tbody').replaceChildren(...temas.map((t) => {
    const tr = crear('tr');
    tr.append(crear('td', '', t.titulo), crear('td', '', decimal(t.promedio)), crear('td', '', String(t.intentos)));
    return tr;
  }));
  $('graficoTemas').setAttribute('aria-label', `Gráfico de barras del promedio por tema: ${temas.map((t) => `${t.titulo} ${decimal(t.promedio)}`).join('; ')}`);

  const Chart = window.Chart;
  if (!Chart) {
    // Sin conexión al CDN: la tabla pasa a ser visible
    $('envolturaTemas').className = 'tabla-contenedor';
    $('tablaTemas').className = 'tabla';
    $('graficoTemas').parentElement.hidden = true;
    return;
  }
  grafico?.destroy();
  Chart.defaults.font.family = token('--fuente-base');
  const borde = token('--color-borde'), suave = token('--color-texto-suave');
  const corto = (t) => (t.length > 28 ? `${t.slice(0, 27)}…` : t);
  grafico = new Chart($('graficoTemas'), {
    type: 'bar',
    data: {
      labels: temas.map((t) => corto(t.titulo)),
      datasets: [{
        label: 'Promedio',
        data: temas.map((t) => t.promedio),
        backgroundColor: temas.map((t) => (t.promedio !== null && t.promedio < 7 ? token('--color-acento') : token('--color-accion'))),
        borderRadius: 6,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (items) => temas[items[0].dataIndex].titulo, afterLabel: (item) => `Intentos: ${temas[item.dataIndex].intentos}` } }
      },
      scales: {
        y: { min: 0, max: 10, ticks: { stepSize: 2, color: suave }, grid: { color: borde } },
        x: { ticks: { color: suave, maxRotation: 45, autoSkip: false }, grid: { display: false } }
      }
    }
  });
}

// ---------- Uso del tutor (solo conteos: el servidor no guarda textos de conversaciones) ----------

const TOP_TEMAS_TUTOR = 5;
let graficoTutor = null;

async function cargarTutor(grupoId) {
  const nota = $('notaTutor');
  $('contenidoTutor').hidden = true;
  nota.textContent = 'Cargando el uso del tutor...';
  let uso;
  try {
    uso = await api.llamar('GET', `/api/resumen/tutor/${encodeURIComponent(grupoId)}`);
  } catch (err) {
    nota.textContent = `No se pudo cargar el uso del tutor: ${err.message}`;
    return;
  }
  if ($('selectorGrupo').value !== grupoId) return;   // el docente ya cambió de grupo

  const total = uso.porEstudiante.reduce((s, e) => s + e.consultas, 0);
  const activos = uso.porEstudiante.filter((e) => e.consultas > 0).length;
  if (!total) {
    graficoTutor?.destroy();
    nota.textContent = 'Aún no hay consultas al tutor en este grupo.';
    return;
  }
  const consultas = (n) => `${n} consulta${n === 1 ? '' : 's'}`;
  nota.textContent = `${consultas(total)} de ${activos} de ${uso.porEstudiante.length} estudiantes. Se cuentan los mensajes enviados al tutor; no se guardan las conversaciones.`;
  $('contenidoTutor').hidden = false;

  const temas = uso.porTema.filter((t) => t.consultas > 0).slice(0, TOP_TEMAS_TUTOR);
  $('tablaTutorTemas').querySelector('tbody').replaceChildren(...temas.map((t) => {
    const tr = crear('tr');
    tr.append(crear('td', '', t.titulo), crear('td', '', String(t.consultas)));
    return tr;
  }));
  $('tablaTutorEstudiantes').querySelector('tbody').replaceChildren(...uso.porEstudiante.map((e) => {
    const tr = crear('tr');
    tr.append(crear('td', '', e.nombre), crear('td', '', String(e.consultas)));
    return tr;
  }));
  pintarGraficoTutor(temas);
}

function pintarGraficoTutor(temas) {
  $('graficoTutor').setAttribute('aria-label', `Barras horizontales con los temas más consultados al tutor: ${temas.map((t) => `${t.titulo} ${t.consultas}`).join('; ')}`);
  const Chart = window.Chart;
  if (!Chart) {
    // Sin conexión al CDN: la tabla pasa a ser visible
    $('envolturaTutorTemas').className = 'tabla-contenedor';
    $('tablaTutorTemas').className = 'tabla';
    $('graficoTutor').parentElement.hidden = true;
    return;
  }
  graficoTutor?.destroy();
  const borde = token('--color-borde'), suave = token('--color-texto-suave');
  const corto = (t) => (t.length > 34 ? `${t.slice(0, 33)}…` : t);
  graficoTutor = new Chart($('graficoTutor'), {
    type: 'bar',
    data: {
      labels: temas.map((t) => corto(t.titulo)),
      datasets: [{ label: 'Consultas', data: temas.map((t) => t.consultas), backgroundColor: token('--color-info'), borderRadius: 6, maxBarThickness: 32 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (items) => temas[items[0].dataIndex].titulo } }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: suave }, grid: { color: borde } },
        y: { ticks: { color: suave }, grid: { display: false } }
      }
    }
  });
}

// ---------- Detalle del estudiante ----------

async function verEstudiante(estudiante) {
  let r;
  ui.cargando(true);
  try {
    r = await api.llamar('GET', `/api/resumen/estudiante/${encodeURIComponent(estudiante.id)}`);
  } catch (err) {
    ui.aviso(`No se pudo cargar el resumen: ${err.message}`, 'error');
    return;
  } finally {
    ui.cargando(false);
  }

  const contenido = crear('div', 'panel-detalle');
  const cifras = crear('dl', 'panel-detalle__cifras');
  for (const [etiqueta, valor] of [
    ['Promedio', r.promedio === null ? '—' : `${decimal(r.promedio)}/10`],
    ['Puntos', r.puntos.toLocaleString('es-EC')],
    ['Nivel de quiz', r.nivelQuizMax ? `${r.nivelQuizMax} de 5` : '—'],
    ['Temas revisados', `${r.pctTemas} %`],
    ['Tiempo', `${r.tiempoMin} min`]
  ]) {
    const caja = crear('div');
    caja.append(crear('dt', '', etiqueta), crear('dd', '', valor));
    cifras.append(caja);
  }
  contenido.append(cifras);
  contenido.append(crear('p', 'panel-nota', [
    r.ultimaConexion ? `Última conexión: ${util.fechaRelativa(r.ultimaConexion)}.` : 'Aún no se ha conectado.',
    r.pendientes.length ? `${r.pendientes.length} tema${r.pendientes.length === 1 ? '' : 's'} sin revisar.` : 'Revisó todos los temas.',
    r.porActividad.length ? `Por actividad: ${r.porActividad.map((a) => `${nombreActividad(a.actividad)} ${decimal(a.promedio)} (${a.intentos})`).join(', ')}.` : ''
  ].filter(Boolean).join(' ')));

  contenido.append(crear('h3', 'panel-detalle__subtitulo', `Últimos ${r.ultimosIntentos.length} intentos`));
  if (!r.ultimosIntentos.length) {
    contenido.append(crear('p', 'panel-nota', 'Todavía no registra intentos.'));
  } else {
    const tabla = crear('table', 'tabla');
    const cabecera = crear('thead');
    const filaCab = crear('tr');
    for (const t of ['Fecha', 'Actividad', 'Tema', 'Nota', 'Puntos']) {
      const th = crear('th', '', t);
      th.scope = 'col';
      filaCab.append(th);
    }
    cabecera.append(filaCab);
    const cuerpo = crear('tbody');
    for (const i of r.ultimosIntentos) {
      const tr = crear('tr');
      tr.append(
        crear('td', '', new Date(i.fecha).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
        crear('td', '', `${nombreActividad(i.actividad)}${i.nivel ? ` · nivel ${i.nivel}` : ''}`),
        crear('td', '', i.titulo || '—'),
        crear('td', '', decimal(i.nota)),
        crear('td', '', String(i.puntos ?? 0))
      );
      cuerpo.append(tr);
    }
    tabla.append(crear('caption', 'sr-only', 'Últimos intentos del estudiante'), cabecera, cuerpo);
    const envoltura = crear('div', 'tabla-contenedor');
    envoltura.tabIndex = 0;
    envoltura.setAttribute('aria-label', 'Últimos intentos (desplazable)');
    envoltura.append(tabla);
    contenido.append(envoltura);
  }

  await ui.modal({ titulo: nombreCompleto(estudiante), contenido, acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn btn--primario' }] });
}

// ---------- Alertas del estudiante ----------

const REGLAS = { promedioBajo: 'Promedio bajo', fallosQuiz: 'Dificultad en el quiz', inactividad: 'Sin actividad reciente', vencidas: 'Actividad vencida', misionBaja: 'NeuroRitmo: misión bajo 70', misionPendiente: 'NeuroRitmo: misión pendiente', misionRetrasada: 'NeuroRitmo: acompañar el avance (plazo)' };
const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

async function verAlertas(estudiante) {
  let datosAlertas;
  ui.cargando(true);
  try {
    datosAlertas = await api.llamar('GET', `/api/alertas?grupoId=${encodeURIComponent(datos.grupo.id)}`);
  } catch (err) {
    ui.aviso(`No se pudieron cargar las alertas: ${err.message}`, 'error');
    return;
  } finally {
    ui.cargando(false);
  }
  let activas = datosAlertas.alertas.filter((a) => a.estudianteId === estudiante.id && a.estado === 'activa');
  let huboCambios = false;

  const contenido = crear('div', 'panel-detalle');
  const estado = crear('p', 'panel-nota');
  estado.setAttribute('role', 'status');
  const lista = crear('ul', 'panel-alertas');

  function pintarAlertas() {
    if (!activas.length) {
      lista.replaceChildren(crear('li', 'panel-nota', 'No tiene alertas activas. ¡Gracias por acompañarle!'));
      return;
    }
    lista.replaceChildren(...activas.map((a) => {
      const li = crear('li', 'panel-alerta-item');
      const cabecera = crear('div', 'panel-alerta-item__cabecera');
      cabecera.append(crear('strong', '', REGLAS[a.regla] || a.regla), crear('span', 'panel-nota', util.fechaRelativa(a.fecha)));
      li.append(cabecera);
      if (a.tema) li.append(crear('span', 'panel-nota', `Tema: ${a.tema}`));
      li.append(crear('p', 'panel-alerta-item__detalle', mayuscula(a.detalle)));
      const boton = crear('button', 'btn btn--secundario btn--sm', 'Marcar como atendida');
      boton.type = 'button';
      boton.addEventListener('click', async () => {
        boton.disabled = true;
        try {
          await api.actualizar('alertas', a.id, { estado: 'atendida' });
          activas = activas.filter((x) => x.id !== a.id);
          huboCambios = true;
          estado.textContent = `Alerta «${REGLAS[a.regla] || a.regla}» marcada como atendida.`;
          pintarAlertas();
        } catch (err) {
          boton.disabled = false;
          estado.textContent = `No se pudo marcar como atendida: ${err.message}`;
        }
      });
      li.append(boton);
      return li;
    }));
  }

  // Mensaje de apoyo: sugerido o propio
  const formulario = crear('form', 'panel-apoyo');
  formulario.noValidate = true;
  const grupoRadios = crear('fieldset', 'panel-apoyo__opciones');
  grupoRadios.append(crear('legend', '', 'Enviar mensaje de apoyo'));
  const opciones = [...datosAlertas.mensajesApoyo.map((m, i) => ({ valor: String(i), texto: m })), { valor: 'propio', texto: 'Escribir mi propio mensaje' }];
  opciones.forEach((op, i) => {
    const etiqueta = crear('label', 'panel-apoyo__opcion');
    const radio = crear('input');
    radio.type = 'radio';
    radio.name = 'mensajeApoyo';
    radio.value = op.valor;
    radio.checked = i === 0;
    etiqueta.append(radio, crear('span', '', op.texto));
    grupoRadios.append(etiqueta);
  });
  const propio = crear('textarea', 'panel-apoyo__texto');
  propio.id = 'mensajePropio';
  propio.maxLength = 500;
  propio.rows = 3;
  propio.hidden = true;
  propio.setAttribute('aria-label', 'Tu mensaje para el estudiante');
  const enviar = crear('button', 'btn btn--primario', 'Enviar mensaje');
  enviar.type = 'submit';
  formulario.append(grupoRadios, propio, enviar);
  grupoRadios.addEventListener('change', () => {
    propio.hidden = formulario.elements.mensajeApoyo.value !== 'propio';
    if (!propio.hidden) propio.focus();
  });
  formulario.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const eleccion = formulario.elements.mensajeApoyo.value;
    const mensaje = eleccion === 'propio' ? propio.value.trim() : datosAlertas.mensajesApoyo[Number(eleccion)];
    if (!mensaje) {
      estado.textContent = 'Escribe tu mensaje antes de enviarlo.';
      propio.focus();
      return;
    }
    enviar.disabled = true;
    try {
      await api.llamar('POST', '/api/notificaciones', { usuarioId: estudiante.id, mensaje, enlace: '/paginas/mi-progreso.html' });
      estado.textContent = `✔ Mensaje enviado a ${estudiante.nombre}. Lo verá en su campana de notificaciones.`;
      if (eleccion === 'propio') propio.value = '';
    } catch (err) {
      estado.textContent = `No se pudo enviar: ${err.message}`;
    } finally {
      enviar.disabled = false;
    }
  });

  pintarAlertas();
  contenido.append(lista, formulario, estado);
  await ui.modal({ titulo: `Alertas de ${nombreCompleto(estudiante)}`, contenido, acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn btn--secundario' }] });
  if (huboCambios) await cargarGrupo(datos.grupo.id);
}

// ---------- Exportación CSV ----------

function celdaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function exportarCsv() {
  const numero = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));   // coma decimal para Excel en español
  const filas = [
    ['Apellido', 'Nombre', 'Promedio (sobre 10)', 'Actividades', 'Temas revisados (%)', 'Última conexión', 'Alertas activas'],
    ...ordenar(datos.estudiantes).map((e) => [
      e.apellido, e.nombre, numero(e.promedio), e.actividades, e.pctTemas,
      e.ultimaConexion ? new Date(e.ultimaConexion).toLocaleString('es-EC') : '', e.alertasActivas
    ])
  ];
  const csv = '﻿' + filas.map((f) => f.map(celdaCsv).join(';')).join('\r\n') + '\r\n';
  const nombre = `${datos.grupo.asignatura}-${datos.grupo.paralelo}-${new Date().toISOString().slice(0, 10)}`;
  const archivo = `progreso-${util.normalizar(nombre).toLowerCase().replace(/[^a-z0-9ñ]+/g, '-').replace(/^-|-$/g, '')}.csv`;

  const enlace = crear('a');
  enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  enlace.download = archivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  ui.aviso(`Se descargó ${archivo}`, 'exito');
}

$('btnExportar').addEventListener('click', exportarCsv);

if (permitido) {
  await cargarGrupos();
  // Enlace desde la notificación de alerta: abre directamente las alertas del estudiante
  const estudianteId = util.parametro('estudiante');
  const estudiante = estudianteId && datos?.estudiantes.find((e) => e.id === estudianteId);
  if (estudiante) await verAlertas(estudiante);
}
