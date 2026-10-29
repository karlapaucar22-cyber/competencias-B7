// publico/js/modulos/registro.js
// Lógica del módulo de registro de estudiantes

import { montarPlantilla } from '../nucleo/plantilla.js';
import { registrar, usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Registro de Estudiante", roles: ["publico"] });

// Si ya tiene sesión activa, redirigir a inicio
if (usuarioActual()) {
  window.location.href = '/index.html';
}

const form = document.getElementById('formulario-registro');
const inputNombre = document.getElementById('nombre');
const inputApellido = document.getElementById('apellido');
const inputCorreo = document.getElementById('correo');
const inputClave = document.getElementById('clave');
const checkConsentimiento = document.getElementById('consentimiento');

const errorNombre = document.getElementById('error-nombre');
const errorApellido = document.getElementById('error-apellido');
const errorCorreo = document.getElementById('error-correo');
const errorClave = document.getElementById('error-clave');
const errorConsentimiento = document.getElementById('error-consentimiento');

const btnRegistrar = document.getElementById('btn-registrar');
const mensajeGlobal = document.getElementById('mensaje-global');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CLAVE = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

function validarNombre() {
  const valor = inputNombre.value.trim();
  if (!valor) {
    errorNombre.textContent = 'El nombre es obligatorio.';
    return false;
  }
  errorNombre.textContent = '';
  return true;
}

function validarApellido() {
  const valor = inputApellido.value.trim();
  if (!valor) {
    errorApellido.textContent = 'El apellido es obligatorio.';
    return false;
  }
  errorApellido.textContent = '';
  return true;
}

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
  if (!REGEX_CLAVE.test(valor)) {
    errorClave.textContent = 'Debe tener al menos 8 caracteres e incluir letras y números.';
    return false;
  }
  errorClave.textContent = '';
  return true;
}

function validarConsentimiento() {
  if (!checkConsentimiento.checked) {
    errorConsentimiento.textContent = 'Debes aceptar el aviso de privacidad para registrarte.';
    return false;
  }
  errorConsentimiento.textContent = '';
  return true;
}

// Validación en vivo
inputNombre.addEventListener('input', validarNombre);
inputNombre.addEventListener('blur', validarNombre);
inputApellido.addEventListener('input', validarApellido);
inputApellido.addEventListener('blur', validarApellido);
inputCorreo.addEventListener('input', validarCorreo);
inputCorreo.addEventListener('blur', validarCorreo);
inputClave.addEventListener('input', validarClave);
inputClave.addEventListener('blur', validarClave);
checkConsentimiento.addEventListener('change', validarConsentimiento);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombreValido = validarNombre();
  const apellidoValido = validarApellido();
  const correoValido = validarCorreo();
  const claveValida = validarClave();
  const consentimientoValido = validarConsentimiento();

  if (!nombreValido || !apellidoValido || !correoValido || !claveValida || !consentimientoValido) {
    if (!nombreValido) inputNombre.focus();
    else if (!apellidoValido) inputApellido.focus();
    else if (!correoValido) inputCorreo.focus();
    else if (!claveValida) inputClave.focus();
    else if (!consentimientoValido) checkConsentimiento.focus();
    return;
  }

  mensajeGlobal.className = 'oculto';
  mensajeGlobal.textContent = '';
  btnRegistrar.disabled = true;
  const textoOriginal = btnRegistrar.textContent;
  btnRegistrar.textContent = 'Creando cuenta...';

  try {
    const datos = {
      nombre: inputNombre.value.trim(),
      apellido: inputApellido.value.trim(),
      correo: inputCorreo.value.trim(),
      clave: inputClave.value,
      consentimiento: true
    };

    // Registra y automáticamente inicia sesión
    await registrar(datos);
    window.location.href = '/index.html';
  } catch (err) {
    mensajeGlobal.className = 'alerta alerta--error';
    mensajeGlobal.textContent = err.message || 'Error al procesar el registro';
    btnRegistrar.disabled = false;
    btnRegistrar.textContent = textoOriginal;
  }
});
