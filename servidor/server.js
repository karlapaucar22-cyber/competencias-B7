import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import { aplicar } from './ganchos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Render define PORT; PUERTO se conserva para desarrollo local.
const PUERTO = process.env.PORT || process.env.PUERTO || 3000;
const DIR_PUBLICO = path.resolve(__dirname, '..', 'publico');
const DIR_RUTAS = path.resolve(__dirname, 'rutas');

import { cargarUsuario } from './auth.js';

// Middlewares base
app.use(express.static(DIR_PUBLICO));
app.use(express.json({ limit: '1mb' }));
app.use(cargarUsuario);
export { cargarUsuario };

/**
 * Función auxiliar para responder ante errores con formato uniforme { error }
 */
function responderError(res, err) {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  const mensaje = err.message || 'Error interno del servidor';
  res.status(estado).json({ error: mensaje });
}

// Carga automática de rutas específicas en servidor/rutas/*.js en orden alfabético
try {
  const archivos = await fs.readdir(DIR_RUTAS);
  const rutasJs = archivos.filter((a) => a.endsWith('.js')).sort();

  for (const archivo of rutasJs) {
    const rutaArchivo = path.join(DIR_RUTAS, archivo);
    const modulo = await import(pathToFileURL(rutaArchivo).href);
    const router = modulo.default || modulo;
    if (typeof router === 'function' || (router && router.stack)) {
      app.use('/api', router);
    }
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    console.error('Error al cargar rutas desde servidor/rutas:', err);
  }
}

// -------------------------------------------------------------
// API genérica en /api/:col y /api/:col/:id
// -------------------------------------------------------------

// GET /api/:col con filtros exactos por query
app.get('/api/:col', async (req, res) => {
  const { col } = req.params;
  try {
    const autorizado = await puede(req.usuario, 'leer', col);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    let lista = await almacen.leer(col);

    // Filtros exactos basados en req.query
    const clavesQuery = Object.keys(req.query);
    if (clavesQuery.length > 0) {
      lista = lista.filter((item) =>
        clavesQuery.every((clave) => String(item[clave]) === String(req.query[clave]))
      );
    }

    // Gancho filtrarLista
    lista = await aplicar(col, 'filtrarLista', lista, req.usuario);

    res.json(lista);
  } catch (err) {
    responderError(res, err);
  }
});

// GET /api/:col/:id
app.get('/api/:col/:id', async (req, res) => {
  const { col, id } = req.params;
  try {
    const lista = await almacen.leer(col);
    const registro = lista.find((item) => item.id === id);

    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'leer', col, registro);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    res.json(registro);
  } catch (err) {
    responderError(res, err);
  }
});

// POST /api/:col
app.post('/api/:col', async (req, res) => {
  const { col } = req.params;
  try {
    const autorizado = await puede(req.usuario, 'escribir', col, req.body);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Gancho antesDeGuardar
    const datosProcesados = await aplicar(col, 'antesDeGuardar', req.body, req.usuario, null);

    const nuevo = await almacen.agregar(col, datosProcesados);

    // Gancho despuesDeGuardar
    await aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(nuevo);
  } catch (err) {
    responderError(res, err);
  }
});

// PUT /api/:col/:id (fusiona campos)
app.put('/api/:col/:id', async (req, res) => {
  const { col, id } = req.params;
  try {
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'escribir', col, anterior);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Gancho antesDeGuardar
    const cambiosProcesados = await aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);

    const actualizado = await almacen.actualizar(col, id, cambiosProcesados);

    // Gancho despuesDeGuardar
    await aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(actualizado);
  } catch (err) {
    responderError(res, err);
  }
});

// DELETE /api/:col/:id
app.delete('/api/:col/:id', async (req, res) => {
  const { col, id } = req.params;
  try {
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const autorizado = await puede(req.usuario, 'escribir', col, anterior);
    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    // Gancho antesDeGuardar
    await aplicar(col, 'antesDeGuardar', null, req.usuario, anterior);

    await almacen.eliminar(col, id);

    // Gancho despuesDeGuardar
    await aplicar(col, 'despuesDeGuardar', null, req.usuario, anterior);

    res.json({ ok: true });
  } catch (err) {
    responderError(res, err);
  }
});

// Manejador centralizado de errores
app.use((err, req, res, next) => {
  responderError(res, err);
});

// Inicio del servidor HTTP
const servidor = app.listen(PUERTO, () => {
  console.log(`Servidor activo en http://localhost:${PUERTO}`);
});

export { app, servidor };
