// servidor/rutas/simulaciones.js
// Lectura de una simulación por id con las reglas de filtrarLista (la API genérica por id no las aplica)

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { filtrarLista } from '../ganchos/simulaciones.js';

const router = Router();

router.get('/simulaciones/:id', exigirRol(), async (req, res) => {
  try {
    const simulacion = (await almacen.leer('simulaciones')).find((s) => s.id === req.params.id);
    const visible = simulacion && (await filtrarLista([simulacion], req.usuario)).length > 0;
    if (!visible) return res.status(404).json({ error: 'Simulación no encontrada' });
    res.json(simulacion);
  } catch (err) {
    console.error('Error al leer simulaciones:', err);
    res.status(500).json({ error: 'No se pudo cargar la simulación' });
  }
});

export default router;
