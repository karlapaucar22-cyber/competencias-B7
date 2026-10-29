// publico/js/modulos/perfil.js
// Lógica del módulo de perfil de usuario

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { aviso } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { fechaLarga } from '../nucleo/util.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: "Mi Perfil", roles: ["sesion"] });

const formPerfil = document.getElementById('form-perfil');
const inputNombre = document.getElementById('perfil-nombre');
const inputApellido = document.getElementById('perfil-apellido');
const inputCorreo = document.getElementById('perfil-correo');
const inputFoto = document.getElementById('input-foto');
const avatarImg = document.getElementById('avatar-img');
const avatarIniciales = document.getElementById('avatar-iniciales');
const badgeRol = document.getElementById('badge-rol');
const errorNombre = document.getElementById('error-nombre');
const errorApellido = document.getElementById('error-apellido');
const errorFoto = document.getElementById('error-foto');
const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');

const formClave = document.getElementById('form-clave');
const inputActual = document.getElementById('clave-actual');
const inputNueva = document.getElementById('clave-nueva');
const inputRepetir = document.getElementById('clave-repetir');
const errorActual = document.getElementById('error-actual');
const errorNueva = document.getElementById('error-nueva');
const errorRepetir = document.getElementById('error-repetir');
const btnGuardarClave = document.getElementById('btn-guardar-clave');

let archivoFotoSeleccionado = null;
let fotoActual = null;

const REGEX_CLAVE = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

/**
 * Muestra el avatar correspondiente según exista URL de imagen o iniciales.
 */
function actualizarAvatarUI(nombre, apellido, urlFoto) {
  if (urlFoto) {
    avatarImg.src = urlFoto;
    avatarImg.classList.remove('oculto');
    avatarIniciales.classList.add('oculto');
  } else {
    avatarImg.classList.add('oculto');
    avatarIniciales.classList.remove('oculto');
    const iniNombre = (nombre || '').charAt(0).toUpperCase();
    const iniApellido = (apellido || '').charAt(0).toUpperCase();
    avatarIniciales.textContent = `${iniNombre}${iniApellido}` || '??';
  }
}

/**
 * Carga los datos del usuario autenticado en el formulario.
 */
async function cargarDatosPerfil() {
  try {
    const usuario = await api.llamar('GET', '/api/auth/yo');
    inputNombre.value = usuario.nombre || '';
    inputApellido.value = usuario.apellido || '';
    inputCorreo.value = usuario.correo || '';
    badgeRol.textContent = usuario.rol || 'estudiante';
    fotoActual = usuario.foto || null;
    actualizarAvatarUI(usuario.nombre, usuario.apellido, fotoActual);
  } catch (err) {
    aviso(err.message || 'Error al cargar perfil', 'error');
  }
}

await cargarDatosPerfil();

// Cambio y previsualización de foto
inputFoto.addEventListener('change', () => {
  errorFoto.textContent = '';
  const archivo = inputFoto.files && inputFoto.files[0];
  if (!archivo) return;

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/pjpeg', 'image/x-png'];
  const ext = (archivo.name.split('.').pop() || '').toLowerCase();
  const extensionesPermitidas = ['jpg', 'jpeg', 'png', 'webp'];
  const esValido = tiposPermitidos.includes(archivo.type) || extensionesPermitidas.includes(ext);

  if (!esValido) {
    errorFoto.textContent = 'Solo se admiten formatos JPG, PNG o WEBP.';
    inputFoto.value = '';
    return;
  }

  if (archivo.size > 2 * 1024 * 1024) {
    errorFoto.textContent = 'La imagen no debe superar los 2 MB.';
    inputFoto.value = '';
    return;
  }

  archivoFotoSeleccionado = archivo;
  const urlTemporal = URL.createObjectURL(archivo);
  actualizarAvatarUI(inputNombre.value, inputApellido.value, urlTemporal);
});

// Guardar cambios del perfil (nombre, apellido y foto)
formPerfil.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorNombre.textContent = '';
  errorApellido.textContent = '';
  errorFoto.textContent = '';

  const nombre = inputNombre.value.trim();
  const apellido = inputApellido.value.trim();

  let hayError = false;
  if (!nombre) {
    errorNombre.textContent = 'El nombre no puede estar vacío.';
    hayError = true;
  }
  if (!apellido) {
    errorApellido.textContent = 'El apellido no puede estar vacío.';
    hayError = true;
  }
  if (hayError) return;

  btnGuardarPerfil.disabled = true;
  const textoOriginal = btnGuardarPerfil.textContent;
  btnGuardarPerfil.textContent = 'Guardando...';

  try {
    let urlFotoFinal = fotoActual;

    // Si seleccionó una nueva foto, subirla primero
    if (archivoFotoSeleccionado) {
      const resSubida = await api.subir(archivoFotoSeleccionado);
      urlFotoFinal = resSubida.url;
      archivoFotoSeleccionado = null;
    }

    const actualizado = await api.llamar('PUT', '/api/auth/perfil', {
      nombre,
      apellido,
      foto: urlFotoFinal
    });

    fotoActual = actualizado.foto || null;

    // Actualizar usuario guardado en sessionStorage
    const usuarioPrevio = usuarioActual() || {};
    const usuarioNuevo = {
      ...usuarioPrevio,
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      rol: actualizado.rol,
      foto: actualizado.foto
    };
    sessionStorage.setItem('usuario', JSON.stringify(usuarioNuevo));

    // Actualizar texto del encabezado si está visible
    const spanNombreEncabezado = document.querySelector('.encabezado-app__usuario-nombre');
    if (spanNombreEncabezado) {
      spanNombreEncabezado.textContent = actualizado.nombre;
    }

    actualizarAvatarUI(actualizado.nombre, actualizado.apellido, fotoActual);
    aviso('Perfil actualizado con éxito.', 'exito');
  } catch (err) {
    aviso(err.message || 'Error al actualizar perfil', 'error');
  } finally {
    btnGuardarPerfil.disabled = false;
    btnGuardarPerfil.textContent = textoOriginal;
  }
});

// Guardar nueva contraseña
formClave.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorActual.textContent = '';
  errorNueva.textContent = '';
  errorRepetir.textContent = '';

  const actual = inputActual.value;
  const nueva = inputNueva.value;
  const repetir = inputRepetir.value;

  let hayError = false;
  if (!actual) {
    errorActual.textContent = 'Ingresa tu contraseña actual.';
    hayError = true;
  }
  if (!nueva) {
    errorNueva.textContent = 'Ingresa la nueva contraseña.';
    hayError = true;
  } else if (!REGEX_CLAVE.test(nueva)) {
    errorNueva.textContent = 'La nueva contraseña debe tener mínimo 8 caracteres con letras y números.';
    hayError = true;
  }
  if (nueva !== repetir) {
    errorRepetir.textContent = 'Las contraseñas no coinciden.';
    hayError = true;
  }
  if (hayError) return;

  btnGuardarClave.disabled = true;
  const textoOriginal = btnGuardarClave.textContent;
  btnGuardarClave.textContent = 'Actualizando...';

  try {
    await api.llamar('POST', '/api/auth/clave', { actual, nueva });
    inputActual.value = '';
    inputNueva.value = '';
    inputRepetir.value = '';
    aviso('Contraseña actualizada con éxito.', 'exito');
  } catch (err) {
    aviso(err.message || 'Error al cambiar contraseña', 'error');
  } finally {
    btnGuardarClave.disabled = false;
    btnGuardarClave.textContent = textoOriginal;
  }
});

// ---------- Logros: puntos, vitrina de insignias y certificado de cumplimiento (solo estudiantes) ----------

function crear(tag, clase = '', texto = '') {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}

function tarjetaInsignia(insignia, obtenida) {
  const li = crear('li', `insignia-vitrina ${obtenida ? 'insignia-vitrina--obtenida' : 'insignia-vitrina--bloqueada'}`);
  const icono = crear('span', 'insignia-vitrina__icono', insignia.icono || '🏅');
  icono.setAttribute('aria-hidden', 'true');
  const nombre = crear('h4', 'insignia-vitrina__nombre', insignia.nombre);
  const detalle = obtenida
    ? crear('p', 'insignia-vitrina__detalle', `Obtenida el ${fechaLarga(obtenida.fecha)}`)
    : crear('p', 'insignia-vitrina__detalle', `🔒 Por obtener: ${insignia.descripcion || 'condición no especificada'}`);
  li.append(icono, nombre, detalle);
  return li;
}

function filaCondicion(c) {
  const porcentaje = c.requerido > 0 ? Math.min(100, Math.round((c.actual / c.requerido) * 100)) : 100;
  const esPct = c.nombre.includes('%');
  const valor = esPct ? `${c.actual} % de ${c.requerido} %` : `${c.actual} de ${c.requerido}`;
  const li = crear('li', `condicion-certificado${c.cumple ? ' condicion-certificado--cumple' : ''}`);
  const cabecera = crear('div', 'condicion-certificado__cabecera');
  const nombre = crear('span', 'condicion-certificado__nombre', c.nombre);
  const estado = crear('span', 'condicion-certificado__valor', `${c.cumple ? '✔ ' : ''}${valor}`);
  cabecera.append(nombre, estado);
  const barra = crear('div', 'progreso');
  barra.setAttribute('role', 'progressbar');
  barra.setAttribute('aria-valuemin', '0');
  barra.setAttribute('aria-valuemax', '100');
  barra.setAttribute('aria-valuenow', String(porcentaje));
  barra.setAttribute('aria-label', `${c.nombre}: ${valor}${c.cumple ? ', cumplido' : ''}`);
  const relleno = crear('span', 'progreso__barra');
  relleno.style.width = `${porcentaje}%`;
  barra.append(relleno);
  li.append(cabecera, barra);
  return li;
}

async function cargarLogros() {
  const seccion = document.getElementById('logros');
  if (!seccion || usuarioActual()?.rol !== 'estudiante') return;

  seccion.className = 'perfil-logros';
  seccion.setAttribute('aria-labelledby', 'logros-titulo');
  seccion.replaceChildren(crear('h2', 'perfil-logros__titulo', 'Mis logros'), crear('p', 'perfil-logros__cargando', 'Cargando logros...'));
  seccion.querySelector('h2').id = 'logros-titulo';

  const [logros, insignias, estado, emitidos] = await Promise.all([
    logrosDe('yo'),
    api.listar('insignias').catch(() => []),
    api.llamar('GET', '/api/certificados/estado').catch((err) => ({ error: err.message })),
    api.listar('certificados').catch(() => [])
  ]);
  const obtenidas = new Map((logros.insignias || []).map((i) => [i.id, i]));

  // 1. Puntos
  const resumen = crear('div', 'tarjeta perfil-logros__resumen');
  const puntos = crear('p', 'perfil-logros__puntos');
  puntos.append(crear('span', 'perfil-logros__numero', String(logros.puntos)), crear('span', '', ' puntos acumulados'));
  resumen.append(puntos, crear('p', 'perfil-logros__conteo', `${obtenidas.size} de ${insignias.length} insignias obtenidas`));

  // 2. Insignias: primero las obtenidas (más recientes primero), luego las bloqueadas
  const vitrina = crear('section', 'tarjeta perfil-logros__bloque');
  vitrina.setAttribute('aria-labelledby', 'titulo-insignias');
  const tituloInsignias = crear('h3', 'perfil-logros__subtitulo', 'Insignias');
  tituloInsignias.id = 'titulo-insignias';
  const lista = crear('ul', 'vitrina-insignias');
  const ordenadas = [...insignias].sort((a, b) => {
    const fa = obtenidas.get(a.id)?.fecha, fb = obtenidas.get(b.id)?.fecha;
    if (fa && fb) return fb.localeCompare(fa);
    return fa ? -1 : fb ? 1 : 0;
  });
  lista.append(...ordenadas.map((ins) => tarjetaInsignia(ins, obtenidas.get(ins.id))));
  vitrina.append(tituloInsignias, insignias.length ? lista : crear('p', '', 'Aún no hay insignias configuradas.'));

  // 3. Certificado de cumplimiento
  const certificado = crear('section', 'tarjeta perfil-logros__bloque');
  certificado.setAttribute('aria-labelledby', 'titulo-certificado');
  const tituloCert = crear('h3', 'perfil-logros__subtitulo', 'Certificado de cumplimiento');
  tituloCert.id = 'titulo-certificado';
  certificado.append(tituloCert);
  if (estado.error) {
    certificado.append(crear('p', 'campo__error', `No se pudo consultar el estado: ${estado.error}`));
  } else {
    const condiciones = crear('ul', 'condiciones-certificado');
    condiciones.append(...estado.condiciones.map(filaCondicion));
    const boton = crear('button', 'btn btn--primario', 'Descargar certificado');
    boton.type = 'button';
    boton.disabled = !estado.cumple;
    const ayuda = crear('p', 'perfil-logros__ayuda', estado.cumple
      ? '¡Cumples todas las condiciones! Descarga tu certificado en PDF.'
      : 'El botón se habilitará cuando cumplas todas las condiciones.');
    ayuda.id = 'ayuda-certificado';
    boton.setAttribute('aria-describedby', 'ayuda-certificado');
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      const texto = boton.textContent;
      boton.textContent = 'Generando...';
      try {
        const { codigo } = await generarDiploma({ tipo: 'cumplimiento' });
        aviso(`Certificado descargado. Código de verificación: ${codigo}`, 'exito');
        await cargarLogros();   // muestra el certificado en la lista de emitidos
        return;
      } catch (err) {
        aviso(`No se pudo generar el certificado: ${err.message}`, 'error');
      }
      boton.disabled = false;
      boton.textContent = texto;
    });
    certificado.append(condiciones, boton, ayuda);
  }

  // Certificados emitidos, cada uno con su enlace de verificación con el código ya puesto
  const yo = usuarioActual()?.id;
  const propios = emitidos.filter((c) => c.usuarioId === yo).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  if (propios.length) {
    const tituloEmitidos = crear('h4', 'perfil-logros__subtitulo-menor', 'Mis certificados emitidos');
    const lista = crear('ul', 'certificados-emitidos');
    lista.append(...propios.map((c) => {
      const li = crear('li', 'certificado-emitido');
      const datos = crear('div', 'certificado-emitido__datos');
      datos.append(
        crear('span', 'certificado-emitido__codigo', c.codigo),
        crear('span', 'certificado-emitido__detalle', `${c.tipo === 'cumplimiento' ? 'Certificado de cumplimiento' : 'Diploma de nivel'} · ${fechaLarga(c.fecha)}`));
      const enlace = crear('a', 'btn btn--secundario btn--sm', 'Verificar');
      enlace.href = `/paginas/verificar.html?codigo=${encodeURIComponent(c.codigo)}`;
      enlace.setAttribute('aria-label', `Verificar el certificado ${c.codigo}`);
      li.append(datos, enlace);
      return li;
    }));
    certificado.append(tituloEmitidos, lista);
  }

  seccion.replaceChildren(seccion.querySelector('h2'), resumen, vitrina, certificado);
}

cargarLogros().catch((err) => console.error('Error al cargar logros:', err));
