// publico/js/modulos/admin-usuarios.js
// Lógica del módulo de administración de usuarios

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Administración de Usuarios", roles: ["admin"] });

const inputBuscar = document.getElementById('buscar-usuario');
const selectFiltroRol = document.getElementById('filtro-rol');
const cuerpoTabla = document.getElementById('tabla-usuarios-cuerpo');

let todosLosUsuarios = [];

/**
 * Carga la lista inicial de usuarios desde la API.
 */
async function cargarUsuarios() {
  try {
    todosLosUsuarios = await api.listar('usuarios');
    renderizarTabla();
  } catch (err) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
          Error al cargar los usuarios: ${escapar(err.message)}
        </td>
      </tr>
    `;
  }
}

/**
 * Renderiza las filas de la tabla según los filtros aplicados.
 */
function renderizarTabla() {
  const termino = (inputBuscar.value || '').trim().toLowerCase();
  const rolFiltro = selectFiltroRol.value;

  const filtrados = todosLosUsuarios.filter((u) => {
    // Filtro por rol
    if (rolFiltro && u.rol !== rolFiltro) {
      return false;
    }
    // Filtro por búsqueda
    if (termino) {
      const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
      const correo = (u.correo || '').toLowerCase();
      if (!nombreCompleto.includes(termino) && !correo.includes(termino)) {
        return false;
      }
    }
    return true;
  });

  if (filtrados.length === 0) {
    cuerpoTabla.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
          No se encontraron usuarios que coincidan con la búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  cuerpoTabla.innerHTML = filtrados.map((u) => {
    const iniNombre = (u.nombre || '').charAt(0).toUpperCase();
    const iniApellido = (u.apellido || '').charAt(0).toUpperCase();
    const iniciales = `${iniNombre}${iniApellido}` || '??';

    const avatarHtml = u.foto
      ? `<div class="usuario-avatar-mini"><img src="${escapar(u.foto)}" alt=""></div>`
      : `<div class="usuario-avatar-mini" aria-hidden="true">${escapar(iniciales)}</div>`;

    return `
      <tr data-id="${u.id}">
        <td>
          <div class="usuario-celda">
            ${avatarHtml}
            <div class="usuario-info">
              <span class="usuario-info__nombre">${escapar(u.nombre)} ${escapar(u.apellido)}</span>
              <span class="usuario-info__correo">${escapar(u.correo)}</span>
            </div>
          </div>
        </td>
        <td>
          <select class="select-rol-tabla" aria-label="Rol de ${escapar(u.nombre)}" data-id="${u.id}">
            <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
            <option value="docente" ${u.rol === 'docente' ? 'selected' : ''}>Docente</option>
            <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td style="text-align: center;">
          <input type="checkbox" class="casilla-activo-tabla" aria-label="Estado activo de ${escapar(u.nombre)}" data-id="${u.id}" ${u.activo ? 'checked' : ''}>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn btn--pequeno btn--secundario btn-restablecer" data-id="${u.id}" data-nombre="${escapar(u.nombre)}" data-apellido="${escapar(u.apellido)}">
            Restablecer clave
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Eventos de filtrado en vivo
inputBuscar.addEventListener('input', renderizarTabla);
selectFiltroRol.addEventListener('change', renderizarTabla);

// Manejo de eventos delegados en la tabla (cambio de rol, activo y restablecimiento de clave)
cuerpoTabla.addEventListener('change', async (e) => {
  const selectRol = e.target.closest('.select-rol-tabla');
  if (selectRol) {
    const id = selectRol.dataset.id;
    const nuevoRol = selectRol.value;
    const usuario = todosLosUsuarios.find((u) => u.id === id);
    const rolAnterior = usuario ? usuario.rol : 'estudiante';

    try {
      await api.actualizar('usuarios', id, { rol: nuevoRol });
      if (usuario) usuario.rol = nuevoRol;
      aviso('Rol actualizado correctamente.', 'exito');
    } catch (err) {
      selectRol.value = rolAnterior;
      aviso(err.message || 'No se pudo actualizar el rol', 'error');
    }
    return;
  }

  const checkActivo = e.target.closest('.casilla-activo-tabla');
  if (checkActivo) {
    const id = checkActivo.dataset.id;
    const nuevoEstado = checkActivo.checked;
    const usuario = todosLosUsuarios.find((u) => u.id === id);
    const estadoAnterior = usuario ? usuario.activo : true;

    try {
      await api.actualizar('usuarios', id, { activo: nuevoEstado });
      if (usuario) usuario.activo = nuevoEstado;
      aviso('Estado de cuenta actualizado correctamente.', 'exito');
    } catch (err) {
      checkActivo.checked = estadoAnterior;
      aviso(err.message || 'No se pudo actualizar el estado de la cuenta', 'error');
    }
  }
});

cuerpoTabla.addEventListener('click', async (e) => {
  const btnRestablecer = e.target.closest('.btn-restablecer');
  if (!btnRestablecer) return;

  const id = btnRestablecer.dataset.id;
  const nombre = btnRestablecer.dataset.nombre || '';
  const apellido = btnRestablecer.dataset.apellido || '';

  const confirma = await confirmar(`¿Deseas restablecer la contraseña de ${nombre} ${apellido}? Se generará una clave temporal.`);
  if (!confirma) return;

  btnRestablecer.disabled = true;

  try {
    const resultado = await api.llamar('POST', `/api/admin/usuarios/${id}/restablecer`);
    const claveTemporal = resultado.claveTemporal;

    const contenidoHtml = `
      <p>Se ha generado la siguiente contraseña temporal para <strong>${escapar(nombre)} ${escapar(apellido)}</strong>:</p>
      <div style="text-align: center; margin: var(--espacio-m) 0;">
        <code style="font-size: var(--tamano-xl); font-weight: bold; background: var(--color-fondo); padding: var(--espacio-s) var(--espacio-m); border-radius: var(--radio-m); display: inline-block; border: 1px solid var(--color-borde); user-select: all;">${escapar(claveTemporal)}</code>
      </div>
      <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin: 0;">Copia y entrega esta clave al usuario. Por seguridad, no volverá a mostrarse en pantalla.</p>
    `;

    const accionPulsada = await modal({
      titulo: 'Contraseña Temporal Generada',
      contenido: contenidoHtml,
      acciones: [
        { texto: 'Copiar clave', valor: 'copiar', clase: 'btn btn--primario' },
        { texto: 'Cerrar', valor: 'cerrar', clase: 'btn btn--secundario' }
      ]
    });

    if (accionPulsada === 'copiar') {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(claveTemporal);
        aviso('Clave temporal copiada al portapapeles.', 'exito');
      }
    }
  } catch (err) {
    aviso(err.message || 'Error al restablecer la contraseña', 'error');
  } finally {
    btnRestablecer.disabled = false;
  }
});

await cargarUsuarios();
