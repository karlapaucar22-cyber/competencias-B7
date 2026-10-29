// publico/js/modulos/prueba-datos.js
// Lógica del módulo de prueba de datos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, escapar } from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Prueba de datos', roles: ['publico'] });

const form = document.getElementById('form-prueba');
const inputTexto = document.getElementById('texto');
const contenedor = document.getElementById('contenedor-registros');
const btnRecargar = document.getElementById('btn-recargar');
const btnGuardar = document.getElementById('btn-guardar');

/**
 * Consulta y muestra los registros existentes en la colección "prueba".
 */
async function cargarRegistros() {
  contenedor.innerHTML = '<p style="color: var(--color-texto-suave);">Cargando registros...</p>';
  try {
    const registros = await api.listar('prueba');
    renderizarRegistros(registros);
  } catch (err) {
    aviso('Error al cargar registros: ' + err.message, 'error');
    contenedor.innerHTML = '<p class="campo__error">No se pudieron cargar los registros.</p>';
  }
}

/**
 * Renderiza la lista de registros o un estado vacío si no existen datos.
 */
function renderizarRegistros(lista) {
  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono" aria-hidden="true">📭</div>
        <p class="vacio__titulo">No hay registros guardados</p>
        <p class="vacio__texto">Escribe un texto en el formulario de arriba para crear el primer registro.</p>
      </div>
    `;
    return;
  }

  const filas = lista.map((reg) => {
    const fecha = reg.fechaCreacion || reg.fecha || reg.creadoEn || '';
    const fechaTexto = fecha ? fechaRelativa(fecha) : 'Reciente';
    return `
      <tr>
        <td><code>${escapar(reg.id || '—')}</code></td>
        <td>${escapar(reg.texto || '')}</td>
        <td><small style="color: var(--color-texto-suave);">${escapar(fechaTexto)}</small></td>
      </tr>
    `;
  }).join('');

  contenedor.innerHTML = `
    <div class="tabla-contenedor">
      <table class="tabla">
        <thead>
          <tr>
            <th>ID</th>
            <th>Texto</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>
    </div>
  `;
}

// Envío del formulario
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = inputTexto?.value.trim();
  if (!texto) return;

  btnGuardar.disabled = true;
  try {
    await api.crear('prueba', { texto });
    aviso('Registro guardado exitosamente', 'exito');
    inputTexto.value = '';
    await cargarRegistros();
  } catch (err) {
    aviso('Error al guardar registro: ' + err.message, 'error');
  } finally {
    btnGuardar.disabled = false;
  }
});

btnRecargar?.addEventListener('click', cargarRegistros);

// Carga inicial de registros
cargarRegistros();
