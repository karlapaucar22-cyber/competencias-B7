// servidor/rutas/foros.js
// Lectura por id de hilos y respuestas con las mismas reglas de visibilidad que el listado.
// (La API genérica GET /api/:col/:id solo revisa permisos.json y no aplica filtrarLista.)

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import * as hilos from '../ganchos/foros-hilos.js';
import * as respuestas from '../ganchos/foros-respuestas.js';

const router = Router();

for (const [col, gancho] of [['foros-hilos', hilos], ['foros-respuestas', respuestas]]) {
  router.get(`/${col}/:id`, exigirRol(), async (req, res) => {
    try {
      const registro = (await almacen.leer(col)).find((r) => r.id === req.params.id);
      const visible = registro && (await gancho.filtrarLista([registro], req.usuario)).length > 0;
      if (!visible) return res.status(404).json({ error: 'Registro no encontrado' });
      res.json(registro);
    } catch (err) {
      console.error(`Error al leer ${col}:`, err);
      res.status(500).json({ error: 'No se pudo cargar la publicación' });
    }
  });
}

export default router;
