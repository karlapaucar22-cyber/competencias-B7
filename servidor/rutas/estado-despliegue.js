// Diagnóstico público mínimo del despliegue, sin variables ni secretos.

import { Router } from 'express';

const router = Router();

router.get('/estado-despliegue', (req, res) => {
  res.json({
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 12) || 'local',
    rama: process.env.RENDER_GIT_BRANCH || 'local',
    servicio: process.env.RENDER_SERVICE_NAME || 'local',
    almacenamiento: process.env.DISCO ? 'persistente' : 'efimero'
  });
});

export default router;
