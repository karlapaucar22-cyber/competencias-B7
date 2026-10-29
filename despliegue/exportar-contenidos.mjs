// despliegue/exportar-contenidos.mjs
// Prepara el paquete de CONTENIDOS para producción (ver docs/despliegue.md, paso 7): asignaturas, unidades,
// temas, glosario, canciones, simulaciones, banco de preguntas e insignias, más las subidas que esos
// contenidos usan. No incluye usuarios, sesiones, intentos, logros, mensajes ni ninguna actividad de demostración.
// Uso (en el equipo del equipo docente): node despliegue/exportar-contenidos.mjs <carpeta-destino>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENIDOS = ['asignaturas', 'unidades', 'temas', 'glosario', 'canciones', 'simulaciones', 'preguntas', 'insignias'];
// Campos que apuntan a cuentas de demostración y no existirán en producción
const CAMPOS_PERSONALES = ['autorId', 'autorNombre', 'docenteId', 'creadoPor', 'actualizadoPor'];

const destino = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!destino) {
  console.error('Uso: node despliegue/exportar-contenidos.mjs <carpeta-destino>');
  process.exit(1);
}
if (destino.startsWith(path.join(RAIZ, 'datos')) || destino.startsWith(path.join(RAIZ, 'publico'))) {
  console.error('El destino no puede estar dentro de datos/ ni de publico/.');
  process.exit(1);
}
fs.mkdirSync(path.join(destino, 'datos'), { recursive: true });
fs.mkdirSync(path.join(destino, 'subidas'), { recursive: true });

const subidas = new Set();
for (const col of CONTENIDOS) {
  const origen = path.join(RAIZ, 'datos', `${col}.json`);
  if (!fs.existsSync(origen)) { console.log(`- ${col}: no existe, se omite`); continue; }
  const lista = JSON.parse(fs.readFileSync(origen, 'utf8'));
  const limpia = lista.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !CAMPOS_PERSONALES.includes(k))));
  const texto = JSON.stringify(limpia, null, 2);
  for (const m of texto.matchAll(/\/recursos\/subidas\/([\w.-]+)/g)) subidas.add(m[1]);
  fs.writeFileSync(path.join(destino, 'datos', `${col}.json`), texto);
  console.log(`- ${col}: ${limpia.length} registros`);
}
// Imagen de la portada de NeuroRitmo (la usa la configuración, no una colección)
subidas.add('neuroritmo-mision-cerebro-sonoro.png');
let copiadas = 0;
for (const archivo of subidas) {
  const origen = path.join(RAIZ, 'publico', 'recursos', 'subidas', archivo);
  if (fs.existsSync(origen)) { fs.copyFileSync(origen, path.join(destino, 'subidas', archivo)); copiadas++; }
  else console.log(`! Falta la subida ${archivo}`);
}
console.log(`Subidas copiadas: ${copiadas}. Paquete listo en ${destino}`);
