// pruebas/neuri-niveles.test.js
// NR-06.2 · «Pregúntale a Neuri»: tres niveles, uso progresivo por misión y respuestas sin soluciones ni calificaciones

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validarTexto, tieneControlTexto } from '../servidor/esquemas-ia.js';
import { exigirPolitica, solucionesDe } from '../servidor/preparadores/neuri.js';
import { versionPublica } from '../servidor/rutas/neuroritmo.js';

const experiencia = JSON.parse(fs.readFileSync(new URL('../datos/config/neuroritmo.json', import.meta.url), 'utf8'));
const mision = (id) => experiencia.misiones.find((m) => m.id === id);
const plantilla = fs.readFileSync(new URL('../servidor/prompts/neuri.txt', import.meta.url), 'utf8');
const rechaza = (fn, estado) => assert.throws(fn, (e) => e.estado === estado);

describe('NR-06.2 · Pregúntale a Neuri', () => {
  test('tres niveles de ayuda configurados', () => {
    assert.deepEqual(experiencia.ia.niveles.map((n) => n.nombre), ['Pregunta orientadora', 'Pista conceptual', 'Ejemplo paralelo']);
    assert.equal(experiencia.ia.maxPalabras, 90);
  });

  test('uso progresivo: M1 desde el segundo intento, M2 pistas y ejemplos, M3 solo el borrador', () => {
    rechaza(() => exigirPolitica(experiencia, mision('m1'), 'pista', 1), 403);
    assert.ok(exigirPolitica(experiencia, mision('m1'), 'pista', 2));
    assert.ok(exigirPolitica(experiencia, mision('m1'), 'error', 2));
    assert.ok(exigirPolitica(experiencia, mision('m2'), 'pista', 1));
    rechaza(() => exigirPolitica(experiencia, mision('m2'), 'error', 1), 400);
    assert.ok(exigirPolitica(experiencia, mision('m3'), 'borrador', 1));
    rechaza(() => exigirPolitica(experiencia, mision('m3'), 'pista', 1), 400);
  });

  test('soluciones protegidas: opción de puntaje completo y palabras faltantes de la canción', () => {
    const quiz = mision('m2').items.find((i) => i.tipo === 'opcion');
    assert.equal(solucionesDe(quiz).length, quiz.opciones.filter((o) => o.puntos >= 15).length);
    const cancion = mision('m2').items.find((i) => i.tipo === 'cancion');
    if (cancion.huecos) assert.deepEqual(solucionesDe(cancion).sort(), Object.values(cancion.huecos).map((p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).sort());
    assert.deepEqual(solucionesDe(mision('m2').items.find((i) => i.tipo === 'parejas')), []);
  });

  test('control de salida: breve, sin revelar la solución ni calificar', () => {
    assert.ok(tieneControlTexto('neuri'));
    const control = { maxPalabras: 90, prohibidos: ['codificar', 'la melodia funciono como pista de recuperacion del orden'] };
    const buena = 'Buena idea fijarte en el orden. ¿Qué diferencia hay entre recordar una secuencia y poder explicar cada concepto? Piensa en un ejemplo propio.';
    assert.equal(validarTexto('neuri', buena, control), buena);
    for (const mala of [
      'La respuesta correcta es la primera.', 'Te conviene la opción b.', 'Elige la opción que habla del orden.',
      'Tu justificación merece 8/10.', 'Con esto mejoras tu puntaje.', 'La palabra que falta es codificar.',
      'Piensa que la melodía funcionó como pista de recuperación del orden, pero faltó comprender.',
      Array(120).fill('palabra').join(' ')
    ]) assert.throws(() => validarTexto('neuri', mala, control), (e) => e.estado === 502, mala.slice(0, 40));
    assert.equal(validarTexto('neuri', 'Cada nota de la melodía puede servir como pista. ¿Cuáles son los puntos clave del caso?', control).length > 0, true);
  });

  test('la plantilla exige respuestas breves, basadas en la base docente y sin soluciones ni notas', () => {
    assert.match(plantilla, /2 a 4 frases/);
    assert.match(plantilla, /Nunca reveles la opción correcta/);
    assert.match(plantilla, /no califiques/);
    assert.match(plantilla, /Usa solo la base de conocimiento del docente/);
    assert.ok(!/\{\{(nombre|correo|usuario)\}\}/.test(plantilla));
  });

  test('la versión pública lleva la política sin notas internas', () => {
    const ia = versionPublica(experiencia).ia;
    assert.deepEqual(Object.keys(ia).sort(), ['misiones', 'niveles']);
    assert.deepEqual(ia.misiones.m2.modos, ['pista']);
    assert.ok(!JSON.stringify(ia).includes('_nota'));
  });

  test('las tres misiones conservan sus ayudas en el frontend y sus tareas del servidor', async () => {
    const fuente = await fs.promises.readFile(new URL('../publico/js/modulos/neuroritmo.js', import.meta.url), 'utf8');
    assert.match(fuente, /api\.ia\('neuri'/);
    assert.match(fuente, /api\.ia\('neuri-borrador'/);
    assert.deepEqual(Object.keys(experiencia.ia.misiones).sort(), ['m1', 'm2', 'm3']);
  });
});
