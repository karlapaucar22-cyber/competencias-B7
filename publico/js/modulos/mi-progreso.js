// publico/js/modulos/mi-progreso.js
// Panel del estudiante: indicadores, evolución semanal, promedio por actividad y temas pendientes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Mi progreso', roles: ['estudiante'] });
const esEstudiante = usuarioActual()?.rol === 'estudiante';   // si no, la plantilla ya redirigió

const $ = (id) => document.getElementById(id);
const NOMBRES = {
  ...Object.fromEntries(ACTIVIDADES.map((a) => [a.id, a.texto])),
  crucigrama: 'Crucigrama', simulacion: 'Simulación', foro: 'Foros'
};
const nombreActividad = (id) => NOMBRES[id] || id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
const decimal = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('es-EC', { maximumFractionDigits: 1 }));
const semanaCorta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });

// Colores y fuente de tokens.css
function token(nombre) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function filasTabla(tabla, filas) {
  tabla.querySelector('tbody').replaceChildren(...filas.map((celdas) => {
    const tr = document.createElement('tr');
    tr.append(...celdas.map((c) => Object.assign(document.createElement('td'), { textContent: c })));
    return tr;
  }));
}

function pintarTarjetas(r) {
  $('valorPuntos').textContent = r.puntos.toLocaleString('es-EC');
  $('valorNivel').textContent = r.nivelQuizMax ? `${r.nivelQuizMax} de 5` : 'Sin aprobar';
  $('valorTemas').textContent = `${r.pctTemas} %`;
  $('rellenoTemas').style.width = `${r.pctTemas}%`;
  $('barraTemas').setAttribute('aria-valuenow', String(r.pctTemas));
  $('valorPromedio').textContent = r.promedio === null ? '—' : `${decimal(r.promedio)}/10`;

  const partes = [];
  if (r.ultimaConexion) partes.push(`Última conexión: ${util.fechaRelativa(r.ultimaConexion)}`);
  partes.push(`tiempo en la plataforma: ${r.tiempoMin >= 60 ? `${Math.floor(r.tiempoMin / 60)} h ${r.tiempoMin % 60} min` : `${r.tiempoMin} min`}`);
  $('textoConexion').textContent = `${partes.join(' · ')}.`;
}

function pintarGraficos(r) {
  const hayDatos = r.evolucion.length > 0 || r.porActividad.length > 0;
  $('sinDatos').hidden = hayDatos;
  $('graficos').hidden = !hayDatos;
  if (!hayDatos) return;

  const Chart = window.Chart;
  const color = { primario: token('--color-primario'), acento: token('--color-acento'), info: token('--color-info'), borde: token('--color-borde'), texto: token('--color-texto-suave') };
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ejes = {
    y: { min: 0, max: 10, ticks: { stepSize: 2, color: color.texto }, grid: { color: color.borde } },
    x: { ticks: { color: color.texto }, grid: { display: false } }
  };
  const base = { responsive: true, maintainAspectRatio: false, animation: reducido ? false : undefined, scales: ejes, plugins: { legend: { display: false } } };

  // Tablas equivalentes para lectores de pantalla
  filasTabla($('tablaEvolucion'), r.evolucion.map((s) => [util.fechaLarga(`${s.semana}T12:00:00`), decimal(s.promedio)]));
  filasTabla($('tablaActividades'), r.porActividad.map((a) => [nombreActividad(a.actividad), decimal(a.promedio), String(a.intentos)]));
  $('graficoEvolucion').setAttribute('aria-label', `Gráfico de líneas del promedio semanal: ${r.evolucion.map((s) => `${semanaCorta(s.semana)} ${decimal(s.promedio)}`).join(', ')}`);
  $('graficoActividades').setAttribute('aria-label', `Gráfico de barras del promedio por actividad: ${r.porActividad.map((a) => `${nombreActividad(a.actividad)} ${decimal(a.promedio)}`).join(', ')}`);

  if (!Chart) {
    // Sin conexión al CDN: las tablas se muestran como alternativa visible
    for (const id of ['tablaEvolucion', 'tablaActividades']) {
      $(id).parentElement.className = 'tabla-contenedor';
      $(id).classList.add('tabla');
    }
    document.querySelectorAll('.progreso-grafico__lienzo').forEach((c) => { c.hidden = true; });
    return;
  }

  Chart.defaults.font.family = token('--fuente-base');
  new Chart($('graficoEvolucion'), {
    type: 'line',
    data: {
      labels: r.evolucion.map((s) => semanaCorta(s.semana)),
      datasets: [{
        label: 'Promedio',
        data: r.evolucion.map((s) => s.promedio),
        borderColor: color.primario,
        backgroundColor: color.primario,
        pointBackgroundColor: color.acento,
        pointBorderColor: color.acento,
        pointRadius: 5,
        tension: 0.3
      }]
    },
    options: base
  });
  new Chart($('graficoActividades'), {
    type: 'bar',
    data: {
      labels: r.porActividad.map((a) => `${nombreActividad(a.actividad)} (${a.intentos})`),
      datasets: [{
        label: 'Promedio',
        data: r.porActividad.map((a) => a.promedio),
        backgroundColor: r.porActividad.map((_, i) => (i % 2 ? color.acento : color.primario)),
        borderRadius: 6,
        maxBarThickness: 48
      }]
    },
    options: base
  });
}

function pintarPendientes(pendientes) {
  $('sinPendientes').hidden = pendientes.length > 0;
  $('listaPendientes').replaceChildren(...pendientes.map((p) => {
    const li = document.createElement('li');
    const enlace = document.createElement('a');
    enlace.href = `/paginas/tema.html?id=${encodeURIComponent(p.temaId)}`;
    const titulo = document.createElement('span');
    titulo.textContent = p.titulo;
    const accion = document.createElement('span');
    accion.className = 'progreso-pendientes__accion';
    accion.textContent = 'Estudiar →';
    accion.setAttribute('aria-hidden', 'true');
    enlace.append(titulo, accion);
    enlace.setAttribute('aria-label', `Estudiar el tema: ${p.titulo}`);
    li.append(enlace);
    return li;
  }));
}

// ---------- NeuroRitmo: mejores notas, bloqueos, insignias y conceptos a reforzar (datos del servidor) ----------

const ESTADOS_NEURO = {
  bloqueada: '🔒 Bloqueada', abierta: '▶️ Disponible', aprobada: '✅ Superada',
  pendiente: '⏳ En valoración del docente', devuelta: '✍️ Devuelta para mejorar'
};
const NOMBRE_MISION = { m1: 'Misión 1', m2: 'Misión 2', m3: 'Misión 3' };
const fechaPlazo = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { day: 'numeric', month: 'long' });

function itemLista(clase, ...partes) {
  const li = document.createElement('li');
  li.className = clase;
  li.append(...partes);
  return li;
}

async function pintarNeuroritmo() {
  const datos = await api.llamar('GET', '/api/neuroritmo');
  if (!datos.progreso) return;   // sin grupo de NeuroRitmo
  const { experiencia: e, progreso: p } = datos;
  const r = e.reglas;
  $('seccionNeuroritmo').hidden = false;
  $('neuroResumen').textContent = `Total ${p.total}/${r.maximoRuta} puntos. Cada misión se supera con ${r.aprobacion}/${r.puntosPorMision} y se conserva tu mejor nota en cada reintento.`;

  $('neuroMisiones').replaceChildren(...e.misiones.map((m, n) => {
    const est = p.misiones[m.id];
    const motivo = est.estado === 'bloqueada' ? `Se desbloquea con ${r.aprobacion}/${r.puntosPorMision} en la ${NOMBRE_MISION[e.misiones[n - 1]?.id] || 'misión anterior'}.` : '';
    const plazo = p.plazos?.[m.id] && !est.aprobada ? `Plazo sugerido por tu docente: ${fechaPlazo(p.plazos[m.id])}.` : '';
    const barra = Object.assign(document.createElement('div'), { className: 'progreso' });
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-label', `Mejor nota de la ${NOMBRE_MISION[m.id]}`);
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', String(r.puntosPorMision));
    barra.setAttribute('aria-valuenow', String(est.mejor));
    const relleno = Object.assign(document.createElement('span'), { className: 'progreso__barra' });
    relleno.style.width = `${Math.round((est.mejor / r.puntosPorMision) * 100)}%`;
    barra.append(relleno);
    return itemLista('progreso-neuro__mision',
      Object.assign(document.createElement('strong'), { textContent: `${NOMBRE_MISION[m.id]} · ${m.titulo}` }),
      Object.assign(document.createElement('span'), { textContent: `Mejor nota: ${est.mejor}/${r.puntosPorMision} · ${est.intentos} ${est.intentos === 1 ? 'intento' : 'intentos'} · ${ESTADOS_NEURO[est.estado] || est.estado}` }),
      barra,
      ...[motivo, plazo].filter(Boolean).map((t) => Object.assign(document.createElement('span'), { className: 'progreso-nota', textContent: t })));
  }));

  $('neuroInsignias').replaceChildren(...(p.insigniasRuta || []).map((i) => itemLista(
    `progreso-neuro__insignia${i.obtenida ? ' progreso-neuro__insignia--obtenida' : ''}`,
    Object.assign(document.createElement('span'), { textContent: `${i.obtenida ? i.icono : '🔒'} ${i.nombre}` }),
    Object.assign(document.createElement('span'), { className: 'progreso-nota', textContent: i.obtenida ? 'Obtenida' : i.descripcion })
  )));

  const reforzar = p.reforzar || [];
  $('neuroReforzar').replaceChildren(...(reforzar.length
    ? reforzar.map((c) => itemLista('progreso-neuro__concepto',
      Object.assign(document.createElement('strong'), { textContent: `${NOMBRE_MISION[c.mision]} · ${c.concepto}` }),
      ...(c.detalle ? [Object.assign(document.createElement('span'), { className: 'progreso-nota', textContent: c.detalle })] : [])))
    : [itemLista('progreso-nota', document.createTextNode('Nada pendiente por ahora: ¡sigue así!'))]));
}

if (esEstudiante) {
  pintarNeuroritmo().catch((err) => {
    $('seccionNeuroritmo').hidden = false;
    $('neuroResumen').textContent = `No se pudo cargar tu ruta NeuroRitmo: ${err.message}`;
  });
  try {
    const resumen = await api.llamar('GET', '/api/resumen/estudiante/yo');
    pintarTarjetas(resumen);
    pintarGraficos(resumen);
    pintarPendientes(resumen.pendientes);
  } catch (err) {
    $('textoConexion').textContent = '';
    $('progresoError').hidden = false;
    $('progresoError').textContent = `No se pudo cargar tu progreso: ${err.message}`;
  }
}
