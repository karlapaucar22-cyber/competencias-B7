// NR-09.6 · registro, matrícula, acceso y progreso independiente de una cuenta nueva.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const datos = path.join(raiz, 'datos');
const puerto = 3196;
const base = `http://127.0.0.1:${puerto}`;
const mutables = [
  'usuarios.json', 'distributivo.json', 'sesiones.json', 'intentos.json', 'logros.json',
  'progreso-temas.json', 'neuroritmo-partidas.json', 'notificaciones.json', 'alertas.json',
  'bitacora.jsonl'
];
const respaldo = await fs.mkdtemp(path.join(os.tmpdir(), 'nr-09.6-'));
const existentes = new Set();

for (const archivo of mutables) {
  try {
    await fs.copyFile(path.join(datos, archivo), path.join(respaldo, archivo));
    existentes.add(archivo);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const servidor = spawn(process.execPath, ['servidor/server.js'], {
  cwd: raiz,
  env: { ...process.env, PORT: String(puerto) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let salida = '';
servidor.stdout.on('data', (dato) => { salida += dato; });
servidor.stderr.on('data', (dato) => { salida += dato; });

const comprobar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
  console.log(`✔ ${mensaje}`);
};

async function pedir(metodo, ruta, cuerpo, token) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await respuesta.text();
  let contenido = null;
  try { contenido = JSON.parse(texto); } catch { contenido = texto; }
  return { estado: respuesta.status, contenido };
}

async function esperarServidor() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(`${base}/api/neuroritmo/presentacion`)).ok) return;
    } catch { /* inicia todavía */ }
    await new Promise((resolver) => setTimeout(resolver, 100));
  }
  throw new Error(`El servidor no inició. ${salida}`);
}

try {
  await esperarServidor();
  const marca = Date.now();
  const correo = `nr096.${marca}@demo.ec`;
  const clave = `Prueba${marca}!`;
  const registro = await pedir('POST', '/api/auth/registro', {
    nombre: 'Prueba', apellido: 'NR096', correo, clave, consentimiento: true
  });
  comprobar(registro.estado === 201 && registro.contenido?.rol === 'estudiante', 'crea una cuenta con rol estudiante');

  const duplicado = await pedir('POST', '/api/auth/registro', {
    nombre: 'Prueba', apellido: 'NR096', correo, clave, consentimiento: true
  });
  comprobar(duplicado.estado === 400, 'rechaza cuentas duplicadas');

  const ingreso = await pedir('POST', '/api/auth/login', { correo, clave });
  const token = ingreso.contenido?.token;
  comprobar(ingreso.estado === 200 && token, 'inicia sesión con la cuenta recién creada');

  const asignaturas = await pedir('GET', '/api/asignaturas', undefined, token);
  comprobar(asignaturas.estado === 200 && asignaturas.contenido.some((item) => item.id === 'asi_000001'), 'muestra la asignatura Fundamentos de Neuroeducación');

  const grupo = JSON.parse(await fs.readFile(path.join(datos, 'distributivo.json'), 'utf8')).find((item) => item.id === 'dis_000001');
  comprobar(grupo.estudiantes.filter((id) => id === registro.contenido.id).length === 1, 'guarda una única matrícula en el grupo real');

  for (const [ruta, descripcion] of [
    ['/api/unidades', 'unidades'], ['/api/temas', 'temas y subtemas'], ['/api/canciones', 'recursos musicales'],
    ['/api/simulaciones', 'simuladores'], ['/api/foros-hilos', 'foros'], ['/api/insignias', 'insignias']
  ]) {
    const respuesta = await pedir('GET', ruta, undefined, token);
    comprobar(respuesta.estado === 200 && Array.isArray(respuesta.contenido) && respuesta.contenido.length > 0, `permite consultar ${descripcion}`);
  }

  const neuro = await pedir('GET', '/api/neuroritmo', undefined, token);
  comprobar(neuro.estado === 200 && neuro.contenido?.experiencia?.misiones?.length === 3, 'muestra las tres misiones con desbloqueo progresivo');
  comprobar(neuro.contenido?.progreso && !neuro.contenido?.sinGrupo, 'crea progreso propio, sin copiar avances ajenos');

  const actividad = await pedir('POST', '/api/intentos', {
    actividad: 'ahorcado', temaId: 'tem_000003', puntaje: 1, maximo: 1, errores: 0,
    detalle: { prueba: 'nr-09.6' }
  }, token);
  comprobar(actividad.estado === 201 && actividad.contenido?.puntosGanados > 0, 'realiza y puntúa una actividad autorizada');

  comprobar((await pedir('POST', '/api/auth/logout', {}, token)).estado === 200, 'cierra la sesión');
  const reingreso = await pedir('POST', '/api/auth/login', { correo, clave });
  comprobar(reingreso.estado === 200 && reingreso.contenido?.token, 'vuelve a ingresar con su propia cuenta');
  const intentos = await pedir('GET', '/api/intentos', undefined, reingreso.contenido.token);
  comprobar(intentos.estado === 200 && intentos.contenido.some((item) => item.detalle?.prueba === 'nr-09.6'), 'recupera el progreso guardado tras cerrar sesión');
} finally {
  servidor.kill();
  await new Promise((resolver) => servidor.once('exit', resolver));
  for (const archivo of mutables) {
    const destino = path.join(datos, archivo);
    if (existentes.has(archivo)) await fs.copyFile(path.join(respaldo, archivo), destino);
    else await fs.rm(destino, { force: true });
  }
  await fs.rm(respaldo, { recursive: true, force: true });
}
