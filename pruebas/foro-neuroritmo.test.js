import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cumpleAporteForo } from '../servidor/gamificacion.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const leerJson = async (ruta) => JSON.parse(await readFile(path.join(raiz, ruta), 'utf8'));

test('Galería NeuroRitmo existe una sola vez y declara consigna, opcionalidad y privacidad', async () => {
  const hilos = await leerJson('datos/foros-hilos.json');
  const galerias = hilos.filter((hilo) => hilo.titulo === 'Galería NeuroRitmo' && hilo.temaId === 'tem_000005');
  assert.equal(galerias.length, 1);
  assert.match(galerias[0].texto, /¿Cómo diseñarías una actividad musical/i);
  assert.match(galerias[0].texto, /5 a 10 minutos/i);
  assert.match(galerias[0].texto, /opcional/i);
  assert.match(galerias[0].texto, /no se copian ni se publican automáticamente/i);
  assert.equal(galerias[0].cerrado, false);
  assert.equal(galerias[0].oculto, false);
});

test('el foro general existe una sola vez, está abierto y acompaña toda la asignatura', async () => {
  const hilos = await leerJson('datos/foros-hilos.json');
  const generales = hilos.filter((hilo) => hilo.titulo === 'Foro general: Neuroeducación, música y aprendizaje');
  assert.equal(generales.length, 1);
  assert.equal(generales[0].asignaturaId, 'asi_000001');
  assert.equal(generales[0].temaId, null);
  assert.equal(generales[0].autorNombre, 'Karla Paucar');
  assert.equal(generales[0].autorRol, 'docente');
  assert.equal(generales[0].fijado, true);
  assert.equal(generales[0].cerrado, false);
  assert.equal(generales[0].oculto, false);
  assert.match(generales[0].texto, /¿De qué manera influye la música en la atención, la memoria y la autorregulación emocional/i);
  assert.match(generales[0].texto, /Responder a esta participación/i);
  assert.match(generales[0].texto, /moderación/i);
});

test('Eco colaborativo exige propuesta y comentario dirigido verificables', () => {
  const temaId = 'tem_000005';
  const propuesta = { actividad: 'foro', detalle: { temaId, palabras: 24, tipoAporte: 'propuesta' } };
  const comentario = { actividad: 'foro', detalle: { temaId, palabras: 18, tipoAporte: 'comentario', respuestaAId: 'res_1', respuestaAjena: true } };
  const condicion = { tipo: 'aporteForo', temaId };
  const reglas = { ecoPalabrasMinimas: 15 };
  assert.equal(cumpleAporteForo([propuesta], condicion, reglas), false);
  assert.equal(cumpleAporteForo([comentario], condicion, reglas), false);
  assert.equal(cumpleAporteForo([propuesta, comentario], condicion, reglas), true);
  assert.equal(cumpleAporteForo([propuesta, { ...comentario, detalle: { ...comentario.detalle, respuestaAjena: false } }], condicion, reglas), false);
  assert.equal(cumpleAporteForo([propuesta, { ...comentario, detalle: { ...comentario.detalle, palabras: 14 } }], condicion, reglas), false);
});

test('la semilla conserva la misma Galería y regla de insignia', async () => {
  const [hilos, insignias] = await Promise.all([
    leerJson('datos/semilla/foros-hilos.json'),
    leerJson('datos/semilla/insignias.json')
  ]);
  assert.equal(hilos.filter((hilo) => hilo.titulo === 'Galería NeuroRitmo').length, 1);
  assert.equal(hilos.filter((hilo) => hilo.titulo === 'Foro general: Neuroeducación, música y aprendizaje').length, 1);
  assert.deepEqual(insignias.find((insignia) => insignia.id === 'eco-colaborativo').condicion, { tipo: 'aporteForo', temaId: 'tem_000005' });
});
