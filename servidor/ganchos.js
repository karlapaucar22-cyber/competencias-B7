import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_GANCHOS = path.resolve(__dirname, 'ganchos');

// Mapa en memoria con los ganchos cargados por colección
const mapaGanchos = new Map();

/**
 * Carga dinámicamente todos los módulos de ganchos en servidor/ganchos/<col>.js
 */
export async function cargarGanchos() {
  mapaGanchos.clear();
  try {
    const archivos = await fs.readdir(DIR_GANCHOS);
    for (const archivo of archivos) {
      if (archivo.endsWith('.js')) {
        const col = archivo.slice(0, -3);
        const rutaCompleta = path.join(DIR_GANCHOS, archivo);
        const modulo = await import(pathToFileURL(rutaCompleta).href);
        const handlers = modulo.default || modulo;
        mapaGanchos.set(col, handlers);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error al cargar ganchos:', err);
    }
  }
}

// Carga inicial al importar el módulo
await cargarGanchos();

/**
 * Ejecuta un gancho para una colección si existe; de lo contrario devuelve el primer argumento.
 * Si el gancho lanza un Error (por ej. con propiedad 'estado'), se propaga.
 *
 * @param {string} col - Nombre de la colección
 * @param {"filtrarLista"|"antesDeGuardar"|"despuesDeGuardar"} nombre - Nombre del gancho
 * @param  {...any} args - Argumentos para el gancho
 * @returns {Promise<any>}
 */
export async function aplicar(col, nombre, ...args) {
  const clave = col.includes('/') ? col.split('/')[0] : col;
  const handlers = mapaGanchos.get(col) || mapaGanchos.get(clave);

  if (!handlers || typeof handlers[nombre] !== 'function') {
    return args[0];
  }

  const resultado = await handlers[nombre](...args);
  return resultado !== undefined ? resultado : args[0];
}
