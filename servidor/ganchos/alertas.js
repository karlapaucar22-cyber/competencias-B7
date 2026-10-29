// servidor/ganchos/alertas.js
// Docente: solo alertas de sus grupos. Las alertas las crea el servidor; por la API solo cambia "estado".

import * as almacen from '../almacen.js';

const ESTADOS = ['activa', 'atendida'];

function rechazar(mensaje, estado) {
  const err = new Error(mensaje);
  err.estado = estado;
  throw err;
}

async function gruposDelDocente(usuario) {
  return new Set((await almacen.leer('distributivo')).filter((g) => g.docenteId === usuario.id).map((g) => g.id));
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol !== 'docente') return [];
  const grupos = await gruposDelDocente(usuario);
  return lista.filter((a) => grupos.has(a.grupoId));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!anterior) rechazar('Las alertas las genera la plataforma automáticamente', 403);
  if (datos === null) rechazar('Las alertas no se eliminan: márcalas como atendidas', 403);
  if (usuario?.rol === 'docente' && !(await gruposDelDocente(usuario)).has(anterior.grupoId)) {
    rechazar('Esta alerta no pertenece a tus grupos', 403);
  }

  const campos = Object.keys(datos || {});
  if (campos.length !== 1 || campos[0] !== 'estado') rechazar('Solo se puede cambiar el campo "estado"', 400);
  if (!ESTADOS.includes(datos.estado)) rechazar('El estado debe ser "activa" o "atendida"', 400);

  // Registro de quién la atendió y cuándo
  return datos.estado === 'atendida'
    ? { estado: 'atendida', fechaAtendida: new Date().toISOString(), atendidaPor: usuario.id }
    : { estado: 'activa', fechaAtendida: null, atendidaPor: null };
}

export default { filtrarLista, antesDeGuardar };
