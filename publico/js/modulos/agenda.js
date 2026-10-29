// publico/js/modulos/agenda.js
// Agenda: calendario (mes, semana, lista), "Mi semana" y modal para crear y editar eventos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: 'Agenda', roles: ['sesion'] });

const TIPOS = { tarea: 'Tarea', reunion: 'Reunión', 'fecha-limite': 'Fecha límite', recordatorio: 'Recordatorio' };
const RECORDATORIOS = [{ minutos: 1440, texto: '1 día antes' }, { minutos: 60, texto: '1 hora antes' }];
const ESTADOS_PLANIFICACION = {
  confirmado: 'Confirmado',
  propuesta: 'Propuesta editable',
  'pendiente-confirmacion': 'Pendiente de confirmación docente'
};
const ZONA_ECUADOR = 'America/Guayaquil';
const INICIO_CALENDARIO = '2026-11-04';
const CON_VENCIMIENTO = ['tarea', 'fecha-limite'];
const DIA_MS = 24 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const usuario = usuarioActual();
const esDocente = usuario?.rol === 'docente' || usuario?.rol === 'admin';
let eventos = [];
let grupos = new Map();
let asignaturas = new Map();
let temas = [];
let intentos = [];
let calendario = null;

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

// ───── Fechas
const partesFechaEcuador = (d) => Object.fromEntries(new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONA_ECUADOR, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
const fechaEcuador = (d) => {
  const p = partesFechaEcuador(d);
  return `${p.year}-${p.month}-${p.day}`;
};
const aFecha = (valor) => (valor.length === 10 ? new Date(`${valor}T00:00:00-05:00`) : new Date(valor));
const aEntradaEcuador = (iso) => {
  const p = partesFechaEcuador(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
const sumarDias = (dia, n) => fechaEcuador(new Date(aFecha(dia).getTime() + n * DIA_MS));
const formatoDia = new Intl.DateTimeFormat('es-EC', { timeZone: ZONA_ECUADOR, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatoHora = new Intl.DateTimeFormat('es-EC', { timeZone: ZONA_ECUADOR, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function inicioDe(e) { return aFecha(e.inicio); }
// Momento en que el evento termina (todo el día: al final del último día)
function finDe(e) {
  if (e.todoElDia) return new Date(aFecha(e.fin || e.inicio).getTime() + DIA_MS);
  return aFecha(e.fin || e.inicio);
}

function textoCuando(e) {
  const ini = inicioDe(e);
  if (e.todoElDia) {
    const fin = e.fin && e.fin !== e.inicio ? ` al ${formatoDia.format(aFecha(e.fin))}` : '';
    return `${formatoDia.format(ini)}${fin} (todo el día)`;
  }
  const fin = e.fin ? ` – ${formatoHora.format(aFecha(e.fin))}` : '';
  return `${formatoDia.format(ini)}, ${formatoHora.format(ini)}${fin}`;
}

// ───── Estado del evento
function completado(e) {
  if (e.tipo !== 'fecha-limite' || !e.actividad || !e.temaId) return false;
  return intentos.some((i) => i.actividad === e.actividad && i.temaId === e.temaId && String(i.fecha) > String(e.fecha));
}

function vencido(e, ahora = new Date()) {
  return CON_VENCIMIENTO.includes(e.tipo) && finDe(e) < ahora && !completado(e);
}

const esPropio = (e) => e.propietarioId === usuario?.id;
const nombreGrupo = (id) => {
  const g = grupos.get(id);
  return g ? `${asignaturas.get(g.asignaturaId) || 'Asignatura'} · ${g.paralelo}` : 'Grupo';
};
const temaDe = (id) => temas.find((t) => t.id === id);
const actividadDe = (id) => ACTIVIDADES.find((a) => a.id === id);

// ───── Carga
async function cargar() {
  const [lista, distributivo, listaAsignaturas, unidades, listaTemas, listaIntentos] = await Promise.all([
    api.listar('agenda'),
    api.listar('distributivo'),
    api.listar('asignaturas'),
    api.listar('unidades'),
    api.listar('temas'),
    usuario.rol === 'estudiante' ? api.listar('intentos') : []
  ]);
  eventos = lista;
  grupos = new Map(distributivo.map((g) => [g.id, g]));
  asignaturas = new Map(listaAsignaturas.map((a) => [a.id, a.nombre]));
  const asignaturaDeUnidad = new Map(unidades.map((u) => [u.id, u.asignaturaId]));
  temas = listaTemas.map((t) => ({ ...t, asignaturaId: asignaturaDeUnidad.get(t.unidadId) }));
  intentos = listaIntentos;
}

async function recargar() {
  eventos = await api.listar('agenda');
  calendario?.refetchEvents();
  pintarSemana();
}

// ───── Calendario
function aEventoCalendario(e) {
  const hecho = completado(e);
  return {
    id: e.id,
    title: `${hecho ? '✓ ' : ''}${e.titulo}`,
    start: e.inicio,
    end: e.fin ? (e.todoElDia ? sumarDias(e.fin, 1) : e.fin) : undefined, // FullCalendar: fin exclusivo
    allDay: e.todoElDia,
    editable: esPropio(e),
    classNames: ['agenda-evento', `agenda-tipo--${e.tipo}`],
    extendedProps: { evento: e }
  };
}

function montarCalendario() {
  calendario = new window.FullCalendar.Calendar($('calendario'), {
    locale: 'es',
    timeZone: ZONA_ECUADOR,
    firstDay: 1,
    initialDate: INICIO_CALENDARIO,
    initialView: window.innerWidth < 640 ? 'listWeek' : 'dayGridMonth',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
    buttonText: { list: 'Lista' },
    height: 'auto',
    nowIndicator: true,
    eventInteractive: true,
    dayMaxEvents: 3,
    noEventsContent: 'No hay eventos en este período',
    events: (_info, exito) => exito(eventos.map(aEventoCalendario)),
    eventDidMount: ({ el, event }) => {
      const e = event.extendedProps.evento;
      const estado = ESTADOS_PLANIFICACION[e.estadoPlanificacion || 'confirmado'];
      el.setAttribute('aria-label', `${TIPOS[e.tipo]}: ${e.titulo}, ${textoCuando(e)}, ${estado}${completado(e) ? ', completado' : ''}`);
    },
    dateClick: (info) => abrirEditor(null, info),
    eventClick: (info) => { info.jsEvent.preventDefault(); verEvento(info.event.extendedProps.evento); },
    eventDrop: moverEvento,
    eventResize: moverEvento
  });
  calendario.render();
}

// Respaldo accesible cuando el CDN de FullCalendar no está disponible.
function montarCalendarioAlterno() {
  const contenedor = $('calendario');
  const vista = crear('section', 'agenda-calendario-alterno');
  vista.setAttribute('aria-labelledby', 'agendaMesAlterno');
  const titulo = crear('h2', 'agenda-seccion', 'Noviembre de 2026');
  titulo.id = 'agendaMesAlterno';
  const nota = crear('p', 'agenda-nota', 'Vista mensual accesible · Horario de Ecuador continental (UTC−5).');
  const lista = crear('ul', 'agenda-lista');
  lista.append(...[...eventos].sort((a, b) => inicioDe(a) - inicioDe(b)).map(itemSemana));
  vista.append(titulo, nota, lista);
  contenedor.replaceChildren(vista);
}

// Arrastrar o estirar un evento propio
async function moverEvento({ event, revert }) {
  const todoElDia = event.allDay;
  const cambios = {
    todoElDia,
    inicio: todoElDia ? event.startStr.slice(0, 10) : event.startStr,
    fin: event.end ? (todoElDia ? sumarDias(event.endStr.slice(0, 10), -1) : event.endStr) : null
  };
  try {
    await api.actualizar('agenda', event.id, cambios);
    ui.aviso('Evento reprogramado.', 'exito');
    await recargar();
  } catch (err) {
    revert();
    ui.aviso(`No se pudo mover el evento: ${err.message}`, 'error');
  }
}

// ───── Mi semana
function pintarSemana() {
  const ahora = new Date();
  const hoy = aFecha(fechaEcuador(ahora));
  const limite = new Date(hoy.getTime() + 7 * DIA_MS);
  const desde = new Date(hoy.getTime() - 7 * DIA_MS);

  const vencidosAntes = [];
  const porDia = new Map();
  for (const e of [...eventos].sort((a, b) => inicioDe(a) - inicioDe(b))) {
    const ini = inicioDe(e);
    if (ini < hoy) {
      // Anteriores a hoy: pendientes vencidos de la última semana o eventos que siguen en curso
      if (vencido(e, ahora) && ini >= desde) vencidosAntes.push(e);
      else if (finDe(e) > hoy) porDia.set(fechaEcuador(hoy), [...(porDia.get(fechaEcuador(hoy)) || []), e]);
    } else if (ini < limite) {
      const clave = fechaEcuador(ini);
      porDia.set(clave, [...(porDia.get(clave) || []), e]);
    }
  }

  const secciones = [];
  if (vencidosAntes.length) secciones.push(seccionDia('⚠️ Vencidos sin completar', vencidosAntes, true));
  for (let i = 0; i < 7; i++) {
    const clave = sumarDias(fechaEcuador(hoy), i);
    if (!porDia.has(clave)) continue;
    const titulo = i === 0 ? `Hoy · ${formatoDia.format(aFecha(clave))}` : i === 1 ? `Mañana · ${formatoDia.format(aFecha(clave))}` : formatoDia.format(aFecha(clave));
    secciones.push(seccionDia(titulo, porDia.get(clave)));
  }
  $('miSemana').replaceChildren(...secciones);
  $('semanaVacia').hidden = secciones.length > 0;

  const totalVencidos = eventos.filter((e) => vencido(e, ahora) && inicioDe(e) >= desde && inicioDe(e) < limite).length;
  $('contadorVencidos').hidden = totalVencidos === 0;
  $('contadorVencidos').textContent = String(totalVencidos);
  $('contadorVencidos').setAttribute('aria-label', `${totalVencidos} vencido${totalVencidos === 1 ? '' : 's'}`);
}

function seccionDia(titulo, lista, esVencidos = false) {
  const seccion = crear('section', `agenda-dia${esVencidos ? ' agenda-dia--vencidos' : ''}`);
  const ul = crear('ul', 'agenda-lista');
  ul.append(...lista.map(itemSemana));
  seccion.append(crear('h3', 'agenda-dia__titulo', titulo), ul);
  return seccion;
}

function itemSemana(e) {
  const estaVencido = vencido(e);
  const li = crear('li', `agenda-item agenda-tipo--${e.tipo}${estaVencido ? ' agenda-item--vencido' : ''}`);
  const hora = crear('span', 'agenda-item__hora', e.todoElDia ? 'Todo el día' : formatoHora.format(inicioDe(e)));

  const cuerpo = crear('div', 'agenda-item__cuerpo');
  const boton = crear('button', 'agenda-item__titulo', e.titulo);
  boton.type = 'button';
  boton.addEventListener('click', () => verEvento(e));
  const meta = [textoCuando(e)];
  if (e.grupoId) meta.push(nombreGrupo(e.grupoId));
  const act = actividadDe(e.actividad);
  if (act) meta.push(`${act.texto}${temaDe(e.temaId) ? ` · ${temaDe(e.temaId).titulo}` : ''}`);
  cuerpo.append(boton, crear('span', 'agenda-item__meta', meta.join(' · ')));

  const etiquetas = crear('div', 'agenda-item__etiquetas');
  etiquetas.append(crear('span', 'chip', TIPOS[e.tipo]));
  if ((e.estadoPlanificacion || 'confirmado') !== 'confirmado') {
    etiquetas.append(crear('span', 'insignia agenda-estado--propuesta', ESTADOS_PLANIFICACION[e.estadoPlanificacion]));
  }
  if (completado(e)) etiquetas.append(crear('span', 'insignia agenda-estado--hecho', '✓ Completado'));
  else if (estaVencido) etiquetas.append(crear('span', 'insignia agenda-estado--vencido', 'Vencido'));
  li.append(hora, cuerpo, etiquetas);
  return li;
}

// ───── Detalle (eventos de otros) y editor (eventos propios)
async function verEvento(e) {
  if (esPropio(e)) return abrirEditor(e);
  const dl = crear('dl', 'agenda-detalle');
  const fila = (dt, valor) => {
    const dd = crear('dd');
    dd.append(valor);
    dl.append(crear('dt', '', dt), dd);
  };
  fila('Tipo', TIPOS[e.tipo]);
  fila('Cuándo', textoCuando(e));
  fila('Estado de planificación', ESTADOS_PLANIFICACION[e.estadoPlanificacion || 'confirmado']);
  if (e.responsable) fila('Docente responsable', e.responsable);
  if (e.grupoId) fila('Grupo', nombreGrupo(e.grupoId));
  const act = actividadDe(e.actividad);
  if (act) {
    const enlace = crear('a', '', `${act.texto}${temaDe(e.temaId) ? ` · ${temaDe(e.temaId).titulo}` : ''}`);
    enlace.href = `${act.href}?temaId=${encodeURIComponent(e.temaId)}`;
    fila('Actividad', enlace);
    if (usuario.rol === 'estudiante') fila('Estado', completado(e) ? '✓ Completada' : vencido(e) ? 'Vencida: aún no la realizas' : 'Pendiente');
  }
  if (e.enlace) {
    const enlaceHito = crear('a', '', 'Abrir actividad correspondiente');
    enlaceHito.href = e.enlace;
    fila('Acceso', enlaceHito);
  }
  if (e.recordatorios?.length) fila('Recordatorios', RECORDATORIOS.filter((r) => e.recordatorios.includes(r.minutos)).map((r) => r.texto).join(' y '));
  await ui.modal({ titulo: e.titulo, contenido: dl, acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn btn--secundario' }] });
}

function opcion(valor, texto) {
  const o = crear('option', '', texto);
  o.value = valor;
  return o;
}

async function abrirEditor(evento = null, clic = null) {
  const form = crear('form', 'agenda-form');
  form.noValidate = true;
  form.innerHTML = `
    <div class="campo">
      <label for="evTitulo">Título</label>
      <input type="text" id="evTitulo" maxlength="150" required>
    </div>
    <div class="campo">
      <label for="evTipo">Tipo</label>
      <select id="evTipo"></select>
    </div>
    <label class="agenda-casilla"><input type="checkbox" id="evTodoDia"> Todo el día</label>
    <div class="agenda-form__fila">
      <div class="campo">
        <label for="evInicio">Inicio</label>
        <input type="datetime-local" id="evInicio" required>
      </div>
      <div class="campo">
        <label for="evFin">Fin (opcional)</label>
        <input type="datetime-local" id="evFin">
      </div>
    </div>
    <fieldset>
      <legend>Recordatorios</legend>
      ${RECORDATORIOS.map((r) => `<label class="agenda-casilla"><input type="checkbox" name="recordatorio" value="${r.minutos}"> ${r.texto}</label>`).join('')}
    </fieldset>
    <div id="evDocente" hidden>
      <div class="agenda-form__fila">
        <div class="campo">
          <label for="evEstadoPlanificacion">Estado de planificación</label>
          <select id="evEstadoPlanificacion"></select>
        </div>
        <div class="campo">
          <label for="evResponsable">Docente responsable visible</label>
          <input type="text" id="evResponsable" maxlength="100">
        </div>
      </div>
      <div class="campo">
        <label for="evEnlace">Enlace interno de la actividad</label>
        <input type="text" id="evEnlace" inputmode="url" placeholder="/index.html#mapa">
      </div>
      <div class="campo">
        <label for="evGrupo">Grupo</label>
        <select id="evGrupo"><option value="">Solo para mí</option></select>
      </div>
      <div class="agenda-form__fila">
        <div class="campo">
          <label for="evActividad">Actividad vinculada</label>
          <select id="evActividad"><option value="">Ninguna</option></select>
        </div>
        <div class="campo">
          <label for="evTema">Tema</label>
          <select id="evTema"></select>
        </div>
      </div>
      <p class="agenda-nota">En una fecha límite con actividad y tema, cada estudiante verá ✓ cuando la realice después de crear el evento.</p>
    </div>
    <p class="campo__error" id="evError" role="alert" hidden></p>`;

  const campo = (id) => form.querySelector(`#${id}`);
  Object.entries(TIPOS).forEach(([valor, texto]) => campo('evTipo').append(opcion(valor, texto)));

  // Grupo, actividad y tema solo para docentes (temas de la asignatura del grupo o de todos sus grupos)
  const selTema = campo('evTema');
  const pintarTemas = () => {
    const grupo = grupos.get(campo('evGrupo').value);
    const permitidas = new Set(grupo ? [grupo.asignaturaId] : [...grupos.values()].map((g) => g.asignaturaId));
    const anterior = selTema.value;
    selTema.replaceChildren(opcion('', 'Elige un tema'), ...temas.filter((t) => permitidas.has(t.asignaturaId)).map((t) => opcion(t.id, t.titulo)));
    selTema.value = [...selTema.options].some((o) => o.value === anterior) ? anterior : '';
    selTema.disabled = !campo('evActividad').value;
  };
  if (esDocente) {
    campo('evDocente').hidden = false;
    Object.entries(ESTADOS_PLANIFICACION).forEach(([valor, texto]) => campo('evEstadoPlanificacion').append(opcion(valor, texto)));
    [...grupos.values()].forEach((g) => campo('evGrupo').append(opcion(g.id, nombreGrupo(g.id))));
    // Tutor y simulador no registran intentos con su id: no sirven para una fecha límite con ✓
    ACTIVIDADES.filter((a) => !['tutor', 'simulador'].includes(a.id)).forEach((a) => campo('evActividad').append(opcion(a.id, a.texto)));
    campo('evGrupo').addEventListener('change', pintarTemas);
    campo('evActividad').addEventListener('change', pintarTemas);
  }

  // Cambiar "todo el día" convierte los campos de fecha y hora
  const todoDia = campo('evTodoDia');
  const ajustarTipoFecha = () => {
    for (const id of ['evInicio', 'evFin']) {
      const input = campo(id);
      const valor = input.value;
      input.type = todoDia.checked ? 'date' : 'datetime-local';
      if (valor) input.value = todoDia.checked ? valor.slice(0, 10) : `${valor.slice(0, 10)}T08:00`;
    }
  };
  todoDia.addEventListener('change', ajustarTipoFecha);

  if (evento) {
    campo('evTitulo').value = evento.titulo;
    campo('evTipo').value = evento.tipo;
    todoDia.checked = evento.todoElDia;
    ajustarTipoFecha();
    campo('evInicio').value = evento.todoElDia ? evento.inicio : aEntradaEcuador(evento.inicio);
    if (evento.fin) campo('evFin').value = evento.todoElDia ? evento.fin : aEntradaEcuador(evento.fin);
    form.querySelectorAll('[name="recordatorio"]').forEach((c) => { c.checked = (evento.recordatorios || []).includes(Number(c.value)); });
    if (esDocente) {
      campo('evEstadoPlanificacion').value = evento.estadoPlanificacion || 'confirmado';
      campo('evResponsable').value = evento.responsable || '';
      campo('evEnlace').value = evento.enlace || '';
      campo('evGrupo').value = evento.grupoId || '';
      campo('evActividad').value = evento.actividad || '';
      pintarTemas();
      selTema.value = evento.temaId || '';
    }
  } else {
    const inicio = clic ? (clic.allDay ? `${clic.dateStr.slice(0, 10)}T08:00` : aEntradaEcuador(clic.date.toISOString())) : aEntradaEcuador(new Date(Math.ceil(Date.now() / 3600000) * 3600000).toISOString());
    campo('evInicio').value = inicio;
    form.querySelector('[name="recordatorio"][value="1440"]').checked = true;
    if (esDocente) pintarTemas();
  }

  const leerFecha = (id) => {
    const valor = campo(id).value;
    if (!valor) return null;
    return todoDia.checked ? valor : `${valor}:00-05:00`;
  };

  let resultado = null;
  const acciones = [{ texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' }];
  if (evento) acciones.push({ texto: 'Eliminar', valor: 'eliminar', clase: 'btn btn--peligro' });
  acciones.push({
    texto: evento ? 'Guardar cambios' : 'Crear evento',
    valor: 'guardar',
    clase: 'btn btn--primario',
    validar: async () => {
      const error = campo('evError');
      const mostrar = (texto) => { error.textContent = texto; error.hidden = false; return false; };
      const datos = {
        titulo: campo('evTitulo').value.trim(),
        tipo: campo('evTipo').value,
        todoElDia: todoDia.checked,
        inicio: leerFecha('evInicio'),
        fin: leerFecha('evFin'),
        recordatorios: [...form.querySelectorAll('[name="recordatorio"]:checked')].map((c) => Number(c.value))
      };
      if (esDocente) {
        datos.estadoPlanificacion = campo('evEstadoPlanificacion').value;
        datos.responsable = campo('evResponsable').value.trim() || null;
        datos.enlace = campo('evEnlace').value.trim() || null;
        datos.grupoId = campo('evGrupo').value || null;
        datos.actividad = campo('evActividad').value || null;
        datos.temaId = datos.actividad ? selTema.value || null : null;
      }
      if (!datos.titulo) return mostrar('Escribe un título.');
      if (!datos.inicio) return mostrar('Indica la fecha de inicio.');
      if (datos.fin && aFecha(datos.fin) < aFecha(datos.inicio)) return mostrar('El fin no puede ser anterior al inicio.');
      if (datos.actividad && !datos.temaId) return mostrar('Elige el tema de la actividad vinculada.');
      try {
        resultado = evento ? await api.actualizar('agenda', evento.id, datos) : await api.crear('agenda', datos);
        return true;
      } catch (err) {
        return mostrar(err.message);
      }
    }
  });

  const accion = await ui.modal({ titulo: evento ? 'Editar evento' : 'Nuevo evento', contenido: form, acciones });
  if (accion === 'eliminar') {
    if (!(await ui.confirmar(`¿Eliminar «${evento.titulo}»?`))) return;
    try {
      await api.eliminar('agenda', evento.id);
      ui.aviso('Evento eliminado.', 'exito');
    } catch (err) {
      ui.aviso(`No se pudo eliminar: ${err.message}`, 'error');
      return;
    }
  } else if (resultado) {
    ui.aviso(evento ? 'Evento actualizado.' : 'Evento creado.', 'exito');
  } else {
    return;
  }
  await recargar();
}

// ───── Pestañas y leyenda
function pintarLeyenda() {
  $('leyenda').replaceChildren(...Object.entries(TIPOS).map(([tipo, texto]) => {
    const li = crear('li', `agenda-tipo--${tipo}`);
    const punto = crear('span', 'agenda-punto');
    punto.setAttribute('aria-hidden', 'true');
    li.append(punto, texto);
    return li;
  }));
}

function activarPestana(boton) {
  const pestanas = [$('pestanaCalendario'), $('pestanaSemana')];
  for (const p of pestanas) {
    const activa = p === boton;
    p.setAttribute('aria-selected', String(activa));
    p.tabIndex = activa ? 0 : -1;
    $(p.getAttribute('aria-controls')).hidden = !activa;
  }
  if (boton === $('pestanaCalendario')) calendario?.updateSize();
}

function montarPestanas() {
  const pestanas = [$('pestanaCalendario'), $('pestanaSemana')];
  pestanas.forEach((p, i) => {
    p.addEventListener('click', () => activarPestana(p));
    p.addEventListener('keydown', (ev) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      const otra = pestanas[(i + 1) % pestanas.length];
      otra.focus();
      activarPestana(otra);
    });
  });
}

async function iniciar() {
  pintarLeyenda();
  montarPestanas();
  $('btnNuevoEvento').addEventListener('click', () => abrirEditor());
  try {
    await cargar();
  } catch (err) {
    $('agendaEstado').textContent = `No se pudo cargar la agenda: ${err.message}`;
    return;
  }
  $('agendaEstado').textContent = '';
  if (window.FullCalendar) montarCalendario();
  else montarCalendarioAlterno();
  pintarSemana();

  // Enlace directo a un evento (?id=), por ejemplo desde un recordatorio
  const id = util.parametro('id');
  const evento = id && eventos.find((e) => e.id === id);
  if (evento) verEvento(evento);
}

if (usuario) await iniciar();
