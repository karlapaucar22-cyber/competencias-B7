// servidor/rutas/subidas.js
// Ruta para carga de archivos e imágenes estáticas con permisos según rol

import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_SUBIDAS = path.resolve(__dirname, '..', '..', 'publico', 'recursos', 'subidas');

// Asegurar que el directorio de subidas exista
if (!fs.existsSync(DIR_SUBIDAS)) {
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DIR_SUBIDAS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString('hex');
    cb(null, `${aleatorio}${ext}`);
  }
});

const TIPOS_IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_IMAGENES = ['.jpg', '.jpeg', '.png', '.webp'];

const TIPOS_DOCENTE_ADMIN = [
  ...TIPOS_IMAGENES,
  'application/pdf',
  'audio/mpeg',
  'audio/mp3'
];
const EXT_DOCENTE_ADMIN = [...EXT_IMAGENES, '.pdf', '.mp3'];

// POST /api/subidas (con sesión)
router.post('/subidas', exigirRol(), async (req, res, next) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    const esDocenteOAdmin = req.usuario && (req.usuario.rol === 'docente' || req.usuario.rol === 'admin');

    const maxMB = esDocenteOAdmin ? (ajustes?.maxSubidaMB || 10) : 2;
    const maxBytes = maxMB * 1024 * 1024;

    const tiposPermitidos = esDocenteOAdmin ? TIPOS_DOCENTE_ADMIN : TIPOS_IMAGENES;
    const extensionesPermitidas = esDocenteOAdmin ? EXT_DOCENTE_ADMIN : EXT_IMAGENES;

    const uploadInstancia = multer({
      storage,
      limits: {
        fileSize: maxBytes
      },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const esTipoValido = tiposPermitidos.includes(file.mimetype);
        const esExtValida = extensionesPermitidas.includes(ext);

        if (esTipoValido && esExtValida) {
          cb(null, true);
        } else {
          const mensaje = esDocenteOAdmin
            ? 'Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3'
            : 'Solo se permiten imágenes en formato JPG, PNG o WEBP';
          const err = new Error(mensaje);
          err.estado = 400;
          cb(err);
        }
      }
    });

    uploadInstancia.single('archivo')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `El archivo excede el límite máximo de ${maxMB} MB` });
        }
        return res.status(err.estado || 400).json({ error: err.message || 'Error al procesar la subida' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se envió ningún archivo' });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.json({ url });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
