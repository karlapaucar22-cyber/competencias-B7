// publico/js/modulos/ingreso.js
// Lógica del módulo de inicio de sesión

import { montarPlantilla } from '../nucleo/plantilla.js';
import { iniciar, usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Iniciar Sesión", roles: ["publico"] });

// Si ya tiene sesión activa, redirigir a la página principal
if (usuarioActual()) {
  window.location.href = '/index.html';
}

const form = document.getElementById('formulario-ingreso');
const inputCorreo = document.getElementById('correo');
const inputClave = document.getElementById('clave');
const errorCorreo = document.getElementById('error-correo');
const errorClave = document.getElementById('error-clave');
const btnIngresar = document.getElementById('btn-ingresar');
const mensajeGlobal = document.getElementById('mensaje-global');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarCorreo() {
  const valor = inputCorreo.value.trim();
  if (!valor) {
    errorCorreo.textContent = 'El correo electrónico es obligatorio.';
    return false;
  }
  if (!REGEX_CORREO.test(valor)) {
    errorCorreo.textContent = 'Ingresa un formato de correo electrónico válido.';
    return false;
  }
  errorCorreo.textContent = '';
  return true;
}

function validarClave() {
  const valor = inputClave.value;
  if (!valor) {
    errorClave.textContent = 'La contraseña es obligatoria.';
    return false;
  }
  errorClave.textContent = '';
  return true;
}

// Validación en vivo al escribir y al perder el foco
inputCorreo.addEventListener('input', validarCorreo);
inputCorreo.addEventListener('blur', validarCorreo);
inputClave.addEventListener('input', validarClave);
inputClave.addEventListener('blur', validarClave);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const correoValido = validarCorreo();
  const claveValida = validarClave();

  if (!correoValido || !claveValida) {
    if (!correoValido) inputCorreo.focus();
    else inputClave.focus();
    return;
  }

  // Ocultar mensaje previo y deshabilitar botón
  mensajeGlobal.className = 'oculto';
  mensajeGlobal.textContent = '';
  btnIngresar.disabled = true;
  const textoOriginal = btnIngresar.textContent;
  btnIngresar.textContent = 'Iniciando sesión...';

  try {
    const correo = inputCorreo.value.trim();
    const clave = inputClave.value;

    await iniciar(correo, clave);
    window.location.href = '/index.html';
  } catch (err) {
    mensajeGlobal.className = 'alerta alerta--error';
    mensajeGlobal.textContent = err.message || 'Error al iniciar sesión';
    btnIngresar.disabled = false;
    btnIngresar.textContent = textoOriginal;
  }
});
