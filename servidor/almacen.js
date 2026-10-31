import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_DATOS = path.resolve(__dirname, '..', 'datos');
const DIR_RESPALDOS = path.resolve(DIR_DATOS, 'respaldos');
const DIR_CONFIG = path.resolve(DIR_DATOS, 'config');

// Colas de escritura en memoria por ruta de archivo
const colasEscritura = new Map();

// Control en memoria del último respaldo verificado
let fechaUltimoRespaldo = null;

/**
 * Valida y resuelve la ruta de un archivo de colección JSON.
 * Admite minúsculas, números y guiones, con subcarpeta opcional (ej. mensajes/con_000001).
 */
function resolverRutaColeccion(col) {
  if (typeof col !== 'string' || !/^[a-z0-9-]+(?:\/[a-z0-9_-]+)?$/.test(col)) {
    throw new Error(`Nombre de colección inválido: "${col}"`);
  }
  const ruta = path.resolve(DIR_DATOS, `${col}.json`);
  if (!ruta.startsWith(DIR_DATOS)) {
    throw new Error(`Ruta fuera del directorio de datos: "${col}"`);
  }
  return ruta;
}

/**
 * Encola operaciones de escritura por archivo de manera secuencial.
 */
function encolarEscritura(rutaArchivo, operacion) {
  const colaActual = colasEscritura.get(rutaArchivo) || Promise.resolve();
  const siguiente = colaActual
    .catch(() => {})
    .then(async () => {
      await verificarRespaldoDiario();
      return operacion();
    });
  colasEscritura.set(rutaArchivo, siguiente);
  return siguiente;
}

/**
 * Copia recursiva de un directorio excluyendo carpetas o archivos ignorados.
 */
async function copiarDirectorio(origen, destino, ignorarNombres = new Set()) {
  await fs.mkdir(destino, { recursive: true });
  const entradas = await fs.readdir(origen, { withFileTypes: true });

  for (const entrada of entradas) {
    if (ignorarNombres.has(entrada.name) || entrada.name.endsWith('.tmp')) {
      continue;
    }
    const rutaOrigen = path.join(origen, entrada.name);
    const rutaDestino = path.join(destino, entrada.name);

    if (entrada.isDirectory()) {
      await copiarDirectorio(rutaOrigen, rutaDestino, ignorarNombres);
    } else if (entrada.isFile()) {
      await fs.copyFile(rutaOrigen, rutaDestino);
    }
  }
}

/**
 * Realiza un respaldo diario de datos/ (sin datos/respaldos/) y conserva los 14 más recientes.
 */
async function verificarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (fechaUltimoRespaldo === hoy) return;

  const carpetaHoy = path.join(DIR_RESPALDOS, hoy);
  let yaExiste = false;
  try {
    const st = await fs.stat(carpetaHoy);
    if (st.isDirectory()) yaExiste = true;
  } catch {
    yaExiste = false;
  }

  if (!yaExiste) {
    try {
      await fs.mkdir(DIR_RESPALDOS, { recursive: true });
      await copiarDirectorio(DIR_DATOS, carpetaHoy, new Set(['respaldos']));

      // Limpiar respaldos conservando los 14 más recientes
      const elementos = await fs.readdir(DIR_RESPALDOS, { withFileTypes: true });
      const respaldos = elementos
        .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
        .map((e) => e.name)
        .sort();

      if (respaldos.length > 14) {
        const aEliminar = respaldos.slice(0, respaldos.length - 14);
        for (const carpeta of aEliminar) {
          await fs.rm(path.join(DIR_RESPALDOS, carpeta), { recursive: true, force: true });
        }
      }
    } catch (err) {
      console.error('Error al generar respaldo diario:', err);
    }
  }

  fechaUltimoRespaldo = hoy;
}

// En Windows, rename() falla con EPERM/EACCES/EBUSY si otro proceso o petición tiene el archivo
// abierto en ese instante (una lectura simultánea, el antivirus o un editor); se reintenta.
const CODIGOS_BLOQUEO = new Set(['EPERM', 'EACCES', 'EBUSY']);
const REINTENTOS_RENAME = 20;

async function renombrarConReintentos(origen, destino) {
  for (let intento = 0; ; intento++) {
    try {
      return await fs.rename(origen, destino);
    } catch (err) {
      if (!CODIGOS_BLOQUEO.has(err.code) || intento >= REINTENTOS_RENAME) throw err;
      await new Promise((r) => setTimeout(r, 5 + intento * 10));   // espera creciente: ~2 s en total
    }
  }
}

/**
 * Escribe datos de forma atómica usando un archivo temporal .tmp y luego rename.
 */
async function escribirSeguro(rutaArchivo, contenido) {
  const dir = path.dirname(rutaArchivo);
  await fs.mkdir(dir, { recursive: true });
  const rutaTmp = `${rutaArchivo}.tmp`;
  await fs.writeFile(rutaTmp, contenido, 'utf-8');
  await renombrarConReintentos(rutaTmp, rutaArchivo);
}

/**
 * Lee una colección JSON. Devuelve [] si no existe.
 */
export async function leer(col) {
  const ruta = resolverRutaColeccion(col);
  try {
    const data = await fs.readFile(ruta, 'utf-8');
    if (!data.trim()) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Escribe una lista completa en una colección.
 */
export async function escribir(col, lista) {
  if (!Array.isArray(lista)) {
    throw new Error('El contenido a escribir en la colección debe ser un arreglo');
  }
  const ruta = resolverRutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const json = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, json);
  });
}

/**
 * Genera el siguiente ID según regla: 3 primeras letras de la colección + "_" + 6 dígitos.
 */
function generarId(col, lista) {
  const base = col.includes('/') ? col.split('/')[0] : col;
  const letras = base.replace(/[^a-z]/g, '').slice(0, 3).padEnd(3, 'x').toLowerCase();
  const regex = new RegExp(`^${letras}_(\\d+)$`);

  let mayorNumero = 0;
  for (const item of lista) {
    if (item && typeof item.id === 'string') {
      const match = item.id.match(regex);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > mayorNumero) mayorNumero = n;
      }
    }
  }

  const siguiente = String(mayorNumero + 1).padStart(6, '0');
  return `${letras}_${siguiente}`;
}

/**
 * Agrega un nuevo registro asignando ID y fecha ISO.
 */
export async function agregar(col, reg) {
  const ruta = resolverRutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const nuevoRegistro = {
      ...reg,
      id: reg.id || generarId(col, lista),
      fecha: reg.fecha || new Date().toISOString()
    };
    lista.push(nuevoRegistro);
    const json = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, json);
    return nuevoRegistro;
  });
}

/**
 * Actualiza un registro existente por id fusionando campos.
 */
export async function actualizar(col, id, cambios) {
  const ruta = resolverRutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const indice = lista.findIndex((r) => r.id === id);
    if (indice === -1) {
      const err = new Error(`Registro con id "${id}" no encontrado en "${col}"`);
      err.estado = 404;
      throw err;
    }
    const actualizado = {
      ...lista[indice],
      ...cambios,
      id // El id permanece inalterable
    };
    lista[indice] = actualizado;
    const json = JSON.stringify(lista, null, 2);
    await escribirSeguro(ruta, json);
    return actualizado;
  });
}

/**
 * Actualiza un registro a partir de su valor más reciente dentro de la misma cola de escritura.
 * Evita perder cambios simultáneos en listas anidadas, como una matrícula.
 */
export async function actualizarCon(col, id, transformar) {
  if (typeof transformar !== 'function') throw new Error('La transformación de actualización es obligatoria');
  const ruta = resolverRutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const indice = lista.findIndex((registro) => registro.id === id);
    if (indice === -1) {
      const err = new Error(`Registro con id "${id}" no encontrado en "${col}"`);
      err.estado = 404;
      throw err;
    }
    const cambios = await transformar(structuredClone(lista[indice]));
    if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) {
      throw new Error('La transformación debe devolver un objeto');
    }
    const actualizado = { ...lista[indice], ...cambios, id };
    lista[indice] = actualizado;
    await escribirSeguro(ruta, JSON.stringify(lista, null, 2));
    return actualizado;
  });
}

/**
 * Elimina un registro de la colección por id.
 */
export async function eliminar(col, id) {
  const ruta = resolverRutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const nuevaLista = lista.filter((r) => r.id !== id);
    const json = JSON.stringify(nuevaLista, null, 2);
    await escribirSeguro(ruta, json);
    return true;
  });
}

/**
 * Busca registros en la colección según filtro (objeto o función).
 */
export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  if (typeof filtro === 'function') {
    return lista.filter(filtro);
  }
  const entradas = Object.entries(filtro);
  if (entradas.length === 0) return lista;

  return lista.filter((reg) =>
    entradas.every(([clave, valor]) => String(reg[clave]) === String(valor))
  );
}

/**
 * Anexa una línea JSON a un archivo .jsonl (bitácoras o auditoría).
 */
export async function anexarLinea(archivo, obj) {
  if (typeof archivo !== 'string' || !/^[a-z0-9_-]+(?:\.[a-z0-9]+)?$/.test(archivo)) {
    throw new Error(`Nombre de archivo de líneas inválido: "${archivo}"`);
  }
  const ruta = path.resolve(DIR_DATOS, archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`);
  return encolarEscritura(ruta, async () => {
    const dir = path.dirname(ruta);
    await fs.mkdir(dir, { recursive: true });
    const linea = JSON.stringify(obj) + '\n';
    await fs.appendFile(ruta, linea, 'utf-8');
    return obj;
  });
}

/**
 * Lee las líneas de un archivo .jsonl y devuelve un array de objetos.
 */
export async function leerLineas(archivo) {
  if (typeof archivo !== 'string' || !/^[a-z0-9_-]+(?:\.[a-z0-9]+)?$/.test(archivo)) {
    throw new Error(`Nombre de archivo de líneas inválido: "${archivo}"`);
  }
  const ruta = path.resolve(DIR_DATOS, archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`);
  try {
    const data = await fs.readFile(ruta, 'utf-8');
    const lineas = data.split('\n').filter((l) => l.trim().length > 0);
    return lineas.map((l) => JSON.parse(l));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Lee un archivo de configuración de datos/config/<nombre>.json.
 */
export async function leerConfig(nombre) {
  const ruta = path.resolve(DIR_CONFIG, `${nombre}.json`);
  try {
    const data = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

/**
 * Escribe de forma atómica un archivo de configuración datos/config/<nombre>.json.
 */
export async function escribirConfig(nombre, objeto) {
  if (typeof nombre !== 'string' || !/^[a-z0-9-]+$/.test(nombre)) {
    throw new Error(`Nombre de configuración inválido: "${nombre}"`);
  }
  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    throw new Error('La configuración debe ser un objeto');
  }
  const ruta = path.resolve(DIR_CONFIG, `${nombre}.json`);
  return encolarEscritura(ruta, () => escribirSeguro(ruta, JSON.stringify(objeto, null, 2)));
}
