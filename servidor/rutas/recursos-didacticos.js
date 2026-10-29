// servidor/rutas/recursos-didacticos.js
// Sirve únicamente los recursos multimedia verificados de los subtemas NeuroRitmo.

import { Router } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_RECURSOS = path.resolve(__dirname, '..', '..', 'recursos');

const RECURSOS = Object.freeze({
  'funciones-ejecutivas': {
    archivo: 'Cómo_la_Música_Entrena_las_Funciones_Ejecutivas.mp4',
    tipo: 'video/mp4'
  },
  'musica-cerebro': {
    archivo: 'Cómo_hackea_la_música_nuestro_cerebro.m4a',
    tipo: 'audio/mp4'
  }
});

function responderArchivo(req, res, ruta, tamano, tipo) {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', tipo);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const rango = req.headers.range;
  if (!rango) {
    res.setHeader('Content-Length', tamano);
    createReadStream(ruta).on('error', () => res.destroy()).pipe(res);
    return;
  }

  const coincidencia = /^bytes=(\d*)-(\d*)$/.exec(rango);
  if (!coincidencia) {
    res.status(416).setHeader('Content-Range', `bytes */${tamano}`);
    res.end();
    return;
  }

  let inicio = coincidencia[1] === '' ? 0 : Number(coincidencia[1]);
  let fin = coincidencia[2] === '' ? tamano - 1 : Number(coincidencia[2]);

  if (coincidencia[1] === '' && coincidencia[2] !== '') {
    const ultimosBytes = Number(coincidencia[2]);
    inicio = Math.max(tamano - ultimosBytes, 0);
    fin = tamano - 1;
  }

  if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin) || inicio < 0 || fin < inicio || inicio >= tamano) {
    res.status(416).setHeader('Content-Range', `bytes */${tamano}`);
    res.end();
    return;
  }

  fin = Math.min(fin, tamano - 1);
  res.status(206);
  res.setHeader('Content-Range', `bytes ${inicio}-${fin}/${tamano}`);
  res.setHeader('Content-Length', fin - inicio + 1);
  createReadStream(ruta, { start: inicio, end: fin }).on('error', () => res.destroy()).pipe(res);
}

// GET /api/recursos-didacticos/:id
router.get('/recursos-didacticos/:id', async (req, res, next) => {
  try {
    const recurso = RECURSOS[req.params.id];
    if (!recurso) return res.status(404).json({ error: 'Recurso didáctico no encontrado' });

    const ruta = path.join(DIR_RECURSOS, recurso.archivo);
    const datos = await stat(ruta);
    if (!datos.isFile()) return res.status(404).json({ error: 'Recurso didáctico no disponible' });

    responderArchivo(req, res, ruta, datos.size, recurso.tipo);
  } catch (err) {
    if (err?.code === 'ENOENT') return res.status(404).json({ error: 'Recurso didáctico no disponible' });
    next(err);
  }
});

export default router;
