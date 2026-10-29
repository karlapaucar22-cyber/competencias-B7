// publico/js/modulos/verificar.js
// Verificación pública de certificados por código (sin sesión)

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Verificar certificado', roles: ['publico'] });

const FORMATO = /^EE-\d{4}-[A-Z0-9]{6}$/;
const $ = (id) => document.getElementById(id);

function mostrarError(mensaje) {
  $('errorCodigo').hidden = !mensaje;
  $('errorCodigo').textContent = mensaje || '';
  if (mensaje) $('codigo').setAttribute('aria-invalid', 'true');
  else $('codigo').removeAttribute('aria-invalid');
}

function pintar(tipo, titulo, filas = [], texto = '') {
  const caja = document.createElement('div');
  caja.className = `alerta alerta--${tipo} verificar-resultado`;
  const icono = document.createElement('span');
  icono.className = 'verificar-resultado__icono';
  icono.setAttribute('aria-hidden', 'true');
  icono.textContent = tipo === 'exito' ? '✔' : '✖';
  const cuerpo = document.createElement('div');
  const fuerte = document.createElement('strong');
  fuerte.textContent = titulo;
  cuerpo.append(fuerte);
  if (texto) {
    const p = document.createElement('p');
    p.textContent = texto;
    cuerpo.append(p);
  }
  if (filas.length) {
    const dl = document.createElement('dl');
    dl.className = 'verificar-resultado__datos';
    for (const [etiqueta, valor] of filas) {
      const dt = document.createElement('dt');
      dt.textContent = etiqueta;
      const dd = document.createElement('dd');
      dd.textContent = valor;
      dl.append(dt, dd);
    }
    cuerpo.append(dl);
  }
  caja.append(icono, cuerpo);
  $('resultado').replaceChildren(caja);
}

async function verificar(codigo) {
  codigo = codigo.trim().toUpperCase();
  $('codigo').value = codigo;
  if (!FORMATO.test(codigo)) {
    mostrarError('Revisa el código: debe tener la forma EE-2026-ABC123.');
    $('resultado').replaceChildren();
    return;
  }
  mostrarError('');

  const url = new URL(window.location.href);
  url.searchParams.set('codigo', codigo);
  window.history.replaceState(null, '', url);

  $('listaMios').querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.codigo === codigo)));
  $('btnVerificar').disabled = true;
  try {
    const r = await api.llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);
    if (r.valido && r.puntuacion && !r.integro) {
      pintar('error', 'Los datos del certificado no coinciden con su huella', [['Código', codigo]], 'El registro fue alterado después de emitirse. Comunícate con la institución.');
    } else if (r.valido) {
      // NeuroRitmo: puntuación por misión, insignias y huella de integridad
      const neuro = r.puntuacion ? [
        ...r.misiones.map((m) => [m.titulo, `${m.puntaje}/${m.maximo}`]),
        ['Puntuación total', `${r.puntuacion.total}/${r.puntuacion.maximo} (mínimo ${r.puntuacion.logroTotal} y ${r.puntuacion.aprobacion} por misión)`],
        ['Misión 3', 'Validada por el docente'],
        ['Insignias', r.insignias.join(', ') || 'Ninguna'],
        ['Huella de integridad', `${r.huella} ✔ coincide`]
      ] : [];
      pintar('exito', 'Certificado válido', [
        ['Código', codigo],
        ['Otorgado a', r.nombreCompleto],
        ['Logro', r.detalle],
        ...neuro,
        ['Fecha de emisión', util.fechaLarga(r.fecha)]
      ]);
    } else {
      pintar('error', 'No encontramos un certificado con ese código', [], 'Comprueba que lo escribiste igual que en el documento. Si el problema continúa, el certificado no fue emitido por esta plataforma.');
    }
  } catch (err) {
    pintar('error', 'No se pudo verificar en este momento', [], err.message);
  } finally {
    $('btnVerificar').disabled = false;
  }
}

$('formVerificar').addEventListener('submit', (e) => {
  e.preventDefault();
  verificar($('codigo').value);
});

// Certificados propios del usuario con sesión (el más reciente primero)
async function misCertificados() {
  const usuario = usuarioActual();
  if (!usuario) return [];
  try {
    const lista = (await api.listar('certificados')).filter((c) => c.usuarioId === usuario.id);
    return lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  } catch {
    return [];
  }
}

const propios = await misCertificados();
if (propios.length) {
  $('misCertificados').hidden = false;
  $('listaMios').replaceChildren(...propios.map((c) => {
    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'verificar-mios__boton';
    boton.dataset.codigo = c.codigo;
    const codigo = document.createElement('span');
    codigo.className = 'verificar-mios__codigo';
    codigo.textContent = c.codigo;
    const detalle = document.createElement('span');
    const NOMBRES = { cumplimiento: 'Certificado de cumplimiento', neuroritmo: 'Ruta NeuroRitmo completada' };
    detalle.textContent = `${NOMBRES[c.tipo] || 'Diploma de nivel'} · ${util.fechaLarga(c.fecha)}`;
    boton.append(codigo, detalle);
    boton.addEventListener('click', () => verificar(c.codigo));
    li.append(boton);
    return li;
  }));
}

// Con ?codigo= se verifica ese; si no, el certificado más reciente del usuario
const inicial = util.parametro('codigo') || propios[0]?.codigo;
if (inicial) verificar(inicial);
else $('codigo').focus();
