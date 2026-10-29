// Respalda por API las colecciones que una cuenta administradora puede consultar.
// No guarda la contraseña ni el token de sesión.

import fs from 'node:fs/promises';
import path from 'node:path';

const base = String(process.env.AUDITOR_URL || '').replace(/\/+$/, '');
const correo = process.env.AUDITOR_CORREO;
const clave = process.env.AUDITOR_CLAVE;
const destino = path.resolve(process.env.AUDITOR_DESTINO || path.join(
  'datos', 'respaldos', `produccion-${new Date().toISOString().replace(/[:.]/g, '-')}`
));
const colecciones = [
  'usuarios', 'asignaturas', 'distributivo', 'unidades', 'temas', 'glosario',
  'preguntas', 'simulaciones', 'canciones', 'insignias', 'foros-hilos',
  'foros-respuestas', 'agenda', 'noticias', 'intentos', 'logros', 'progreso-temas'
];

if (!base || !correo || !clave) {
  throw new Error('Define AUDITOR_URL, AUDITOR_CORREO y AUDITOR_CLAVE.');
}

async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${base}${ruta}`, opciones);
  const texto = await respuesta.text();
  let datos;
  try { datos = JSON.parse(texto); } catch { datos = { error: texto.slice(0, 200) }; }
  return { estado: respuesta.status, datos };
}

const acceso = await pedir('/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ correo, clave })
});
if (acceso.estado !== 200 || !acceso.datos?.token || acceso.datos?.usuario?.rol !== 'admin') {
  throw new Error(`No se pudo abrir una sesión administrativa (${acceso.estado}).`);
}

await fs.mkdir(destino, { recursive: true });
const manifiesto = { url: base, fecha: new Date().toISOString(), colecciones: {} };
for (const coleccion of colecciones) {
  const respuesta = await pedir(`/api/${coleccion}`, {
    headers: { Authorization: `Bearer ${acceso.datos.token}` }
  });
  manifiesto.colecciones[coleccion] = {
    estado: respuesta.estado,
    total: Array.isArray(respuesta.datos) ? respuesta.datos.length : null
  };
  if (respuesta.estado === 200 && Array.isArray(respuesta.datos)) {
    await fs.writeFile(
      path.join(destino, `${coleccion}.json`),
      `${JSON.stringify(respuesta.datos, null, 2)}\n`, 'utf8'
    );
  }
}
await fs.writeFile(path.join(destino, 'manifiesto.json'), `${JSON.stringify(manifiesto, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ destino, ...manifiesto }, null, 2));
