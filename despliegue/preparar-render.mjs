// Prepara datos iniciales y almacenamiento antes de iniciar el servidor en Render.
// Fusiona por id, respalda antes de cambiar y nunca elimina registros existentes.

import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS_REPO = path.join(RAIZ, 'datos');
const INICIAL = path.join(RAIZ, 'despliegue', 'inicial', 'datos');
const SUBIDAS_INICIALES = path.join(RAIZ, 'despliegue', 'inicial', 'subidas');
const MIGRACION = 'nr-09.1-sincronizacion-render';
const CLAVE_DEMO = 'Demo12345';

async function existe(ruta) {
  try { await fs.access(ruta); return true; } catch { return false; }
}

async function leerLista(ruta) {
  if (!(await existe(ruta))) return [];
  const valor = JSON.parse(await fs.readFile(ruta, 'utf8'));
  return Array.isArray(valor) ? valor : [];
}

async function escribirLista(ruta, lista) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, `${JSON.stringify(lista, null, 2)}\n`, 'utf8');
}

async function copiarFaltantes(origen, destino) {
  if (!(await existe(origen))) return;
  await fs.mkdir(destino, { recursive: true });
  for (const entrada of await fs.readdir(origen, { withFileTypes: true })) {
    if (!entrada.isFile()) continue;
    const salida = path.join(destino, entrada.name);
    if (!(await existe(salida))) await fs.copyFile(path.join(origen, entrada.name), salida);
  }
}

async function copiarSemillas(origen, destino) {
  if (!(await existe(origen))) return;
  await fs.mkdir(destino, { recursive: true });
  for (const entrada of await fs.readdir(origen, { withFileTypes: true })) {
    if (entrada.isFile()) await fs.copyFile(path.join(origen, entrada.name), path.join(destino, entrada.name));
  }
}

export function fusionarListas(actuales, iniciales, coleccion) {
  const resultado = actuales.map((item) => structuredClone(item));
  const porId = new Map(resultado.map((item, indice) => [item.id, indice]));
  let cambios = 0;
  for (const item of iniciales) {
    const indice = porId.get(item.id);
    if (indice === undefined) {
      resultado.push(structuredClone(item));
      porId.set(item.id, resultado.length - 1);
      cambios += 1;
      continue;
    }
    if (coleccion === 'distributivo') {
      const previos = Array.isArray(resultado[indice].estudiantes) ? resultado[indice].estudiantes : [];
      const union = [...new Set([...previos, ...(Array.isArray(item.estudiantes) ? item.estudiantes : [])])];
      if (union.length !== previos.length) {
        resultado[indice] = { ...resultado[indice], estudiantes: union };
        cambios += 1;
      }
    }
  }
  return { resultado, cambios };
}

async function respaldar(datos) {
  const archivos = (await fs.readdir(datos, { withFileTypes: true }))
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.json'));
  if (!archivos.length) return null;
  const nombre = `sincronizacion-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const destino = path.join(datos, 'respaldos', nombre);
  await fs.mkdir(destino, { recursive: true });
  for (const archivo of archivos) await fs.copyFile(path.join(datos, archivo.name), path.join(destino, archivo.name));
  return destino;
}

async function prepararAlmacenamiento() {
  const disco = String(process.env.DISCO || '').trim();
  if (!disco) {
    await fs.mkdir(DATOS_REPO, { recursive: true });
    return {
      datos: DATOS_REPO,
      subidas: path.join(RAIZ, 'publico', 'recursos', 'subidas')
    };
  }
  if (!path.isAbsolute(disco)) throw new Error('DISCO debe ser una ruta absoluta.');
  const datos = path.join(disco, 'datos');
  const subidas = path.join(disco, 'subidas');
  await fs.mkdir(datos, { recursive: true });
  await fs.mkdir(subidas, { recursive: true });
  let datosYaEnDisco = false;
  try { datosYaEnDisco = await fs.realpath(DATOS_REPO) === await fs.realpath(datos); } catch { /* primer inicio */ }
  if (!datosYaEnDisco) {
    await copiarFaltantes(path.join(DATOS_REPO, 'config'), path.join(datos, 'config'));
    await copiarSemillas(path.join(DATOS_REPO, 'semilla'), path.join(datos, 'semilla'));
    await fs.rm(DATOS_REPO, { recursive: true, force: true });
    await fs.symlink(datos, DATOS_REPO, process.platform === 'win32' ? 'junction' : 'dir');
  }
  const enlaceSubidas = path.join(RAIZ, 'publico', 'recursos', 'subidas');
  await fs.mkdir(path.dirname(enlaceSubidas), { recursive: true });
  let subidasYaEnDisco = false;
  try { subidasYaEnDisco = await fs.realpath(enlaceSubidas) === await fs.realpath(subidas); } catch { /* primer inicio */ }
  if (!subidasYaEnDisco) {
    await fs.rm(enlaceSubidas, { recursive: true, force: true });
    await fs.symlink(subidas, enlaceSubidas, process.platform === 'win32' ? 'junction' : 'dir');
  }
  return { datos, subidas };
}

async function planearFusion(datos) {
  const cambios = [];
  if (!(await existe(INICIAL))) return cambios;
  for (const entrada of await fs.readdir(INICIAL, { withFileTypes: true })) {
    if (!entrada.isFile() || !entrada.name.endsWith('.json')) continue;
    const coleccion = entrada.name.slice(0, -5);
    const actuales = await leerLista(path.join(datos, entrada.name));
    const iniciales = await leerLista(path.join(INICIAL, entrada.name));
    const fusion = fusionarListas(actuales, iniciales, coleccion);
    if (fusion.cambios) cambios.push({ coleccion, ...fusion });
  }
  return cambios;
}

async function aplicarMigracionUsuarios(datos) {
  const rutaMarca = path.join(datos, 'migraciones.json');
  const marcas = await leerLista(rutaMarca);
  if (marcas.some((item) => item.id === MIGRACION)) return 0;
  const rutaUsuarios = path.join(datos, 'usuarios.json');
  const usuarios = await leerLista(rutaUsuarios);
  const semilla = await leerLista(path.join(datos, 'semilla', 'usuarios.json'));
  let cambios = 0;
  const felipe = usuarios.find((item) => item.id === 'usu_000002' && item.correo === 'docente1@demo.ec');
  if (felipe && felipe.rol !== 'estudiante') { felipe.rol = 'estudiante'; cambios += 1; }
  const prueba = semilla.find((item) => item.id === 'usu_000010');
  if (prueba && !usuarios.some((item) => item.id === prueba.id || item.correo === prueba.correo)) {
    usuarios.push({ ...prueba, claveHash: await bcrypt.hash(CLAVE_DEMO, 10) });
    cambios += 1;
  }
  if (cambios) await escribirLista(rutaUsuarios, usuarios);
  marcas.push({ id: MIGRACION, fecha: new Date().toISOString(), cambios });
  await escribirLista(rutaMarca, marcas);
  return cambios;
}

async function principal() {
  const { datos, subidas } = await prepararAlmacenamiento();
  const fusiones = await planearFusion(datos);
  const requiereMigracion = !(await leerLista(path.join(datos, 'migraciones.json')))
    .some((item) => item.id === MIGRACION);
  const respaldo = (fusiones.length || requiereMigracion) ? await respaldar(datos) : null;
  for (const fusion of fusiones) {
    await escribirLista(path.join(datos, `${fusion.coleccion}.json`), fusion.resultado);
  }
  await copiarFaltantes(SUBIDAS_INICIALES, subidas);
  const { sembrar } = await import('../servidor/semilla.js');
  await sembrar({ autoConfirmar: true });
  const cambiosUsuarios = await aplicarMigracionUsuarios(datos);
  console.log(`[SINCRONIZACION] fusiones=${fusiones.length}; usuarios=${cambiosUsuarios}; respaldo=${respaldo || 'no requerido'}`);
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) principal().catch((error) => { console.error('[SINCRONIZACION] Error:', error); process.exit(1); });
