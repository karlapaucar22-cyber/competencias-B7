import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESCALA_AUTODIAGNOSTICO, PREGUNTAS_AUTODIAGNOSTICO, resumirAutodiagnostico } from '../publico/js/nucleo/autodiagnostico-musical.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const leer = (ruta) => readFile(path.join(raiz, ruta), 'utf8');
const leerJson = async (ruta) => JSON.parse(await leer(ruta));

test('la adaptación conserva la escala original y cubre cuatro dimensiones', () => {
  assert.deepEqual(ESCALA_AUTODIAGNOSTICO.map((item) => item.valor), [1, 2, 3, 4]);
  assert.equal(PREGUNTAS_AUTODIAGNOSTICO.length, 8);
  const dimensiones = PREGUNTAS_AUTODIAGNOSTICO.reduce((conteo, pregunta) => {
    conteo[pregunta.dimension] = (conteo[pregunta.dimension] || 0) + 1;
    return conteo;
  }, {});
  assert.deepEqual(dimensiones, { habitos: 2, atencion: 2, memoria: 2, autorregulacion: 2 });
});

test('el resumen es descriptivo, reproducible y exige las ocho respuestas', () => {
  const respuestas = Object.fromEntries(PREGUNTAS_AUTODIAGNOSTICO.map((pregunta, indice) => [pregunta.id, (indice % 4) + 1]));
  const resumen = resumirAutodiagnostico(respuestas);
  assert.equal(resumen.promedioGeneral, 2.5);
  assert.equal(resumen.nivel, 'frecuente');
  assert.match(resumen.mensaje, /tarea|registros/i);
  assert.equal(resumirAutodiagnostico({}), null);
  assert.equal(resumirAutodiagnostico({ ...respuestas, 'memoria-1': 5 }), null);
});

test('la matriz publicada tiene ruta propia y mantiene una sola canción principal', async () => {
  const [config, canciones, pagina] = await Promise.all([
    leerJson('datos/config/neuroritmo.json'),
    leerJson('datos/canciones.json'),
    leer('publico/paginas/autodiagnostico-musical.html')
  ]);
  assert.equal(config.recursos.matriz.estado, 'disponible');
  assert.equal(config.recursos.matriz.url, '/paginas/autodiagnostico-musical.html');
  assert.equal(canciones.filter((cancion) => cancion.id === config.cancionPrincipalId).length, 1);
  assert.match(pagina, /páginas 34–35/i);
  assert.match(pagina, /Misión 1[\s\S]*Misión 2[\s\S]*Misión 3/i);
});

test('el almacenamiento del autodiagnóstico es privado y no registra puntuaciones', async () => {
  const [permisos, ruta] = await Promise.all([
    leerJson('datos/config/permisos.json'),
    leer('servidor/rutas/autodiagnostico-musical.js')
  ]);
  assert.deepEqual(permisos['autodiagnosticos-musicales'], { leer: ['servidor'], escribir: ['servidor'] });
  assert.doesNotMatch(ruta, /procesarIntento|registrarIntento|puntaje|gamificacion/i);
  assert.match(ruta, /exigirRol\('estudiante'\)/);
});
