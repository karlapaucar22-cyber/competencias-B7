// servidor/semilla.js
// Carga de datos semilla de prueba para NeuroRitmo Digital

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_SEMILLA = path.resolve(__dirname, '..', 'datos', 'semilla');
const DIR_DATOS = path.resolve(__dirname, '..', 'datos');
const CLAVE_DEFECTO = 'Demo12345';

/**
 * Función principal para sembrar los datos de prueba.
 * @param {{ forzar?: boolean, autoConfirmar?: boolean }} opciones
 */
export async function sembrar({ forzar = false, autoConfirmar = false } = {}) {
  // Confirmación requerida al forzar si se ejecuta en terminal interactiva
  if (forzar && !autoConfirmar && input.isTTY) {
    const rl = readline.createInterface({ input, output });
    try {
      const respuesta = await rl.question(
        'ADVERTENCIA: Se van a sobrescribir las colecciones existentes con los datos semilla.\n¿Deseas continuar? (s/n): '
      );
      if (!['s', 'si', 'y', 'yes'].includes(respuesta.trim().toLowerCase())) {
        console.log('Operación cancelada por el usuario.');
        return { ok: false, mensaje: 'Cancelado' };
      }
    } finally {
      rl.close();
    }
  }

  const archivos = await fs.readdir(DIR_SEMILLA);
  const archivosJson = archivos.filter((a) => a.endsWith('.json')).sort();

  const claveHashComun = await bcrypt.hash(CLAVE_DEFECTO, 10);
  const resultados = [];

  for (const archivo of archivosJson) {
    const col = archivo.slice(0, -5);
    const rutaDestino = path.join(DIR_DATOS, archivo);
    const rutaOrigen = path.join(DIR_SEMILLA, archivo);

    let existe = false;
    try {
      const stats = await fs.stat(rutaDestino);
      if (stats.isFile()) {
        const contenido = await fs.readFile(rutaDestino, 'utf-8');
        const parsed = JSON.parse(contenido);
        if (Array.isArray(parsed) && parsed.length > 0) {
          existe = true;
        }
      }
    } catch {
      existe = false;
    }

    if (existe && !forzar) {
      console.log(`[OMITIDO] ${archivo} ya existe con datos (usa --forzar para sobrescribir).`);
      resultados.push({ col, estado: 'omitido' });
      continue;
    }

    const rawSemilla = await fs.readFile(rutaOrigen, 'utf-8');
    const datosSemilla = JSON.parse(rawSemilla);

    if (col === 'usuarios') {
      const usuariosConClave = datosSemilla.map((u) => ({
        ...u,
        claveHash: claveHashComun
      }));
      await almacen.escribir('usuarios', usuariosConClave);
      console.log(`[SEMBRADO] usuarios.json (${usuariosConClave.length} usuarios con clave "${CLAVE_DEFECTO}")`);
    } else {
      await almacen.escribir(col, datosSemilla);
      console.log(`[SEMBRADO] ${archivo} (${datosSemilla.length} registros)`);
    }

    resultados.push({ col, estado: 'sembrado' });
  }

  return { ok: true, resultados };
}

// Ejecución directa mediante CLI
const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esPrincipal) {
  const forzar = process.argv.includes('--forzar') || process.argv.includes('-f');
  sembrar({ forzar })
    .then((res) => {
      if (res.ok) {
        console.log('\n✓ Proceso de semilla completado exitosamente.');
      }
    })
    .catch((err) => {
      console.error('\n✗ Error al sembrar datos:', err);
      process.exit(1);
    });
}
