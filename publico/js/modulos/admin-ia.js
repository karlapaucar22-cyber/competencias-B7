// publico/js/modulos/admin-ia.js
// Estado de Google Gemini (variables del servidor), prueba de conexión y modelos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Inteligencia artificial', roles: ['admin'] });

const $ = (id) => document.getElementById(id);
let config = null;

function pintar(c) {
  config = c;
  const clave = $('estadoClave');
  clave.classList.toggle('ia-sin-clave', !c.claveConfigurada);
  clave.textContent = c.claveConfigurada ? `${c.claveMascara} (variable protegida del servidor)` : 'Sin configurar: falta GEMINI_API_KEY en el servidor';
  const modelo = $('estadoModelo');
  modelo.classList.toggle('ia-sin-clave', !c.modeloConfigurado);
  modelo.textContent = c.modelo || 'Sin configurar: falta IA_MODELO en el servidor';
  $('estadoAlterno').textContent = c.modeloAlterno || 'Ninguno';
  $('btnProbar').disabled = !c.claveConfigurada || !c.modeloConfigurado;
  $('btnModelos').disabled = !c.claveConfigurada;
}

function resultado(tipo, titulo, detalle) {
  const caja = document.createElement('div');
  caja.className = `alerta alerta--${tipo}`;
  const fuerte = document.createElement('strong');
  fuerte.textContent = titulo;
  const texto = document.createElement('span');
  texto.textContent = detalle;
  caja.append(fuerte, texto);
  $('resultadoPrueba').replaceChildren(caja);
}

async function probar() {
  const boton = $('btnProbar');
  boton.disabled = true;
  resultado('info', 'Probando conexión...', `Enviando "Responde solo: OK" a ${config.modelo}.`);
  try {
    const r = await api.llamar('GET', '/api/ia/prueba');
    resultado(r.respuestaEsperada ? 'exito' : 'info', `Conexión correcta con ${r.modelo} (${r.ms} ms)`,
      `${r.usoAlterno ? 'El modelo principal falló y respondió el alterno. ' : ''}Respuesta: «${r.respuesta}».`);
  } catch (err) {
    resultado('error', 'La prueba falló', err.message);
  } finally {
    boton.disabled = false;
  }
}

async function verModelos() {
  const boton = $('btnModelos');
  boton.disabled = true;
  try {
    const modelos = await api.llamar('GET', '/api/ia/modelos');
    const disponibles = new Set(modelos.map((m) => m.id));
    const configurados = [config.modelo, config.modeloAlterno].filter(Boolean);
    $('estadoModelosConfigurados').textContent = configurados.length
      ? configurados.map((id) => `${id}: ${disponibles.has(id) ? '✔ disponible' : '✖ no disponible para esta clave'}`).join(' · ')
      : 'No hay modelos configurados en las variables del servidor.';
    $('listaDisponibles').replaceChildren(...modelos.map((m) => {
      const li = document.createElement('li');
      li.className = `chip${configurados.includes(m.id) ? ' ia-modelo--actual' : ''}`;
      li.textContent = m.id;
      li.title = m.nombre;
      return li;
    }));
    $('seccionModelos').hidden = false;
  } catch (err) {
    ui.aviso(`No se pudieron listar los modelos: ${err.message}`, 'error');
  } finally {
    boton.disabled = false;
  }
}

if (usuarioActual()?.rol === 'admin') {
  $('btnProbar').addEventListener('click', probar);
  $('btnModelos').addEventListener('click', verModelos);
  try {
    pintar(await api.llamar('GET', '/api/ia/configuracion'));
  } catch (err) {
    ui.aviso(`No se pudo leer la configuración: ${err.message}`, 'error');
  }
}
