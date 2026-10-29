// servidor/rutas/alertas.js
// Alertas de un grupo para el docente: listado con datos legibles y mensajes de apoyo sugeridos

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

/**
 * GET /api/alertas?grupoId= (docente del grupo o admin) → { alertas, mensajesApoyo }
 */
router.get('/alertas', exigirRol('docente', 'admin'), async (req, res) => {
  try {
    const grupo = (await almacen.leer('distributivo')).find((g) => g.id === req.query.grupoId);
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });
    if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) {
      return res.status(403).json({ error: 'No eres docente de este grupo' });
    }

    const [alertas, usuarios, temas, reglas, neuroritmo] = await Promise.all([
      almacen.leer('alertas'), almacen.leer('usuarios'), almacen.leer('temas'), almacen.leerConfig('reglas-alertas'), almacen.leerConfig('neuroritmo')
    ]);
    const nombre = new Map(usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`.trim()]));
    const titulo = new Map(temas.map((t) => [t.id, t.titulo]));

    res.json({
      alertas: alertas
        .filter((a) => a.grupoId === grupo.id)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
        .map((a) => ({ ...a, estudiante: nombre.get(a.estudianteId) || '', tema: a.temaId ? titulo.get(a.temaId) || '' : null })),
      // Anexo A (reglas-alertas.json) más los mensajes de acompañamiento de NeuroRitmo (neuroritmo.json → alertas)
      mensajesApoyo: [...(Array.isArray(reglas.mensajesApoyo) ? reglas.mensajesApoyo : []), ...(neuroritmo?.alertas?.mensajesApoyo || [])]
    });
  } catch (err) {
    console.error('Error al listar alertas:', err);
    res.status(500).json({ error: 'No se pudieron cargar las alertas' });
  }
});

export default router;
