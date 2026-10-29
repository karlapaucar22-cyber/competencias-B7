// Participantes visibles de una asignatura: solo integrantes y sin datos de contacto.

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function fotoPublica(foto) {
  if (typeof foto !== 'string') return null;
  const valor = foto.trim();
  return /^(\/recursos\/|\/subidas\/)/.test(valor)
    || /^data:image\/(png|jpeg|webp);base64,/i.test(valor) ? valor : null;
}

function personaPublica(usuario) {
  return {
    nombre: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim(),
    foto: fotoPublica(usuario.foto),
    rol: usuario.rol === 'docente' ? 'docente' : 'estudiante'
  };
}

export function construirParticipantes({ asignaturaId, usuario, asignaturas, distributivo, usuarios }) {
  const asignatura = asignaturas.find((item) => item.id === asignaturaId);
  if (!asignatura) rechazar('Asignatura no encontrada', 404);

  const grupos = distributivo.filter((grupo) => grupo.asignaturaId === asignaturaId && (
    (usuario.rol === 'estudiante' && Array.isArray(grupo.estudiantes) && grupo.estudiantes.includes(usuario.id))
    || (usuario.rol === 'docente' && grupo.docenteId === usuario.id)
  ));
  if (!grupos.length) rechazar('No perteneces a esta asignatura', 403);

  const porId = new Map(usuarios.filter((item) => item.activo !== false).map((item) => [item.id, item]));
  const idsDocentes = [...new Set(grupos.map((grupo) => grupo.docenteId).filter(Boolean))];
  const idsEstudiantes = [...new Set(grupos.flatMap((grupo) => Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []))];
  const docentes = idsDocentes.map((id) => porId.get(id)).filter((item) => item?.rol === 'docente').map(personaPublica);
  const estudiantes = idsEstudiantes.map((id) => porId.get(id)).filter((item) => item?.rol === 'estudiante')
    .map(personaPublica).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    asignatura: { nombre: asignatura.nombre },
    docente: docentes[0] || null,
    estudiantes,
    totalEstudiantes: estudiantes.length
  };
}

router.get('/participantes/:asignaturaId', exigirRol('estudiante', 'docente'), async (req, res) => {
  try {
    const [asignaturas, distributivo, usuarios] = await Promise.all(
      ['asignaturas', 'distributivo', 'usuarios'].map((coleccion) => almacen.leer(coleccion))
    );
    res.json(construirParticipantes({
      asignaturaId: req.params.asignaturaId,
      usuario: req.usuario,
      asignaturas,
      distributivo,
      usuarios
    }));
  } catch (error) {
    const estado = typeof error.estado === 'number' ? error.estado : 500;
    if (estado === 500) console.error('No se pudieron cargar los participantes:', error);
    res.status(estado).json({ error: estado === 500 ? 'No se pudieron cargar los participantes' : error.message });
  }
});

export default router;
