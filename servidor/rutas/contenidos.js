// servidor/rutas/contenidos.js
// Lectura por id de asignaturas, unidades, temas, glosario, canciones y noticias con las mismas reglas
// de filtrarLista que el listado. (La API genérica GET /api/:col/:id solo revisa permisos.json: dejaba
// leer borradores, unidades ocultas o contenidos de asignaturas ajenas conociendo el id.)
// Las simulaciones tienen su propia ruta por id en rutas/simulaciones.js.

import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import * as asignaturas from '../ganchos/asignaturas.js';
import * as temas from '../ganchos/temas.js';
import * as unidades from '../ganchos/unidades.js';
import * as glosario from '../ganchos/glosario.js';
import * as canciones from '../ganchos/canciones.js';
import * as noticias from '../ganchos/noticias.js';

const router = Router();

for (const [col, gancho] of [['asignaturas', asignaturas], ['temas', temas], ['unidades', unidades],
  ['glosario', glosario], ['canciones', canciones], ['noticias', noticias]]) {
  router.get(`/${col}/:id`, exigirRol(), async (req, res) => {
    try {
      const registro = (await almacen.leer(col)).find((r) => r.id === req.params.id);
      const visible = registro && (await gancho.filtrarLista([registro], req.usuario)).length > 0;
      if (!visible) return res.status(404).json({ error: 'Registro no encontrado' });
      res.json(registro);
    } catch (err) {
      console.error(`Error al leer ${col}:`, err);
      res.status(500).json({ error: 'No se pudo cargar el contenido' });
    }
  });
}

export default router;
