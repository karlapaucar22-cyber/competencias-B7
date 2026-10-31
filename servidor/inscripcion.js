// Inscripción automática de cuentas nuevas en la asignatura de NeuroRitmo.

import * as almacen from './almacen.js';

let colaRegistro = Promise.resolve();

function error(mensaje, estado) {
  const fallo = new Error(mensaje);
  fallo.estado = estado;
  return fallo;
}

export function grupoParaRegistro(experiencia, grupos) {
  const lista = Array.isArray(grupos) ? grupos : [];
  const configurado = String(experiencia?.grupoRegistroId || '').trim();
  if (configurado) {
    const grupo = lista.find((item) => item.id === configurado);
    if (!grupo || grupo.asignaturaId !== experiencia?.asignaturaId) {
      throw error('El grupo configurado para inscripciones de NeuroRitmo no está disponible', 503);
    }
    return grupo;
  }
  const candidatos = lista.filter((item) => item.asignaturaId === experiencia?.asignaturaId);
  if (candidatos.length !== 1) {
    throw error('No se pudo determinar un único grupo para la inscripción de NeuroRitmo', 503);
  }
  return candidatos[0];
}

export const estudiantesCon = (estudiantes, usuarioId) => [
  ...new Set([...(Array.isArray(estudiantes) ? estudiantes : []), usuarioId])
];

export function registrarEstudiante(datos) {
  const operacion = colaRegistro.catch(() => {}).then(async () => {
    const usuarios = await almacen.leer('usuarios');
    if (usuarios.some((usuario) => usuario.correo?.toLowerCase() === datos.correo.toLowerCase())) {
      throw error('El correo electrónico ya se encuentra registrado', 400);
    }

    const experiencia = await almacen.leerConfig('neuroritmo');
    const grupo = grupoParaRegistro(experiencia, await almacen.leer('distributivo'));
    const creado = await almacen.agregar('usuarios', datos);
    try {
      await almacen.actualizarCon('distributivo', grupo.id, (actual) => ({
        estudiantes: estudiantesCon(actual.estudiantes, creado.id)
      }));
      return creado;
    } catch (fallo) {
      await almacen.eliminar('usuarios', creado.id).catch(() => {});
      throw fallo;
    }
  });
  colaRegistro = operacion;
  return operacion;
}
