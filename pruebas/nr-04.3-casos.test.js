import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { corregirItem } from '../servidor/rutas/neuroritmo.js';

const experiencia = JSON.parse(fs.readFileSync(new URL('../datos/config/neuroritmo.json', import.meta.url), 'utf8'));
const mision = (id) => experiencia.misiones.find((m) => m.id === id);
const item = (m, i) => mision(m).items.find((x) => x.id === i);

describe('NR-04.3 · Ítems 3 y 4 de Misión 2 (Casos, diagnóstico y propuesta)', () => {
  const m2 = mision('m2');
  const i3 = item('m2', 'i3');
  const i4 = item('m2', 'i4');

  describe('Ítem 3: Caso de Andrés (diagnóstico con justificación)', () => {
    test('Diagnóstico correcto con justificación: 15/15 y registra indicador demostrado', () => {
      const justificacion = 'La melodía permitió recuperar la secuencia pero faltó codificar con significado los conceptos.';
      const r = corregirItem(i3, { opcion: 'a', justificacion });
      assert.equal(r.puntos, 15);
      assert.equal(r.maximo, 15);
      assert.equal(r.valor.opcion, 'a');
      assert.equal(r.valor.justificacion, justificacion);
      assert.equal(r.retro.nivel, 'completo');
      assert.equal(r.retro.indicador.demostrado, true);
      assert.equal(r.retro.indicador.estado, 'adquirido');
      assert.equal(r.retro.indicador.concepto, 'Pista de recuperación frente a comprensión');
      assert.equal(r.retro.revisar, '');
      assert.match(r.retro.explicacion, /melodía ayudó a encontrar el orden/i);
    });

    test('Diagnóstico parcial (opción b): 9/15, indicador en-desarrollo y error que explica que la melodía no añade comprensión', () => {
      const r = corregirItem(i3, { opcion: 'b', justificacion: 'Andrés necesita practicar más la recuperación de los conceptos.' });
      assert.equal(r.puntos, 9);
      assert.equal(r.retro.nivel, 'parcial');
      assert.equal(r.retro.indicador.demostrado, false);
      assert.equal(r.retro.indicador.estado, 'en-desarrollo');
      assert.match(r.retro.revisar, /pista de recuperación del orden, pero comprender exige explicar/i);
    });

    test('Diagnóstico erróneo (opción c): 0/15, indicador por-reforzar y sugerencia con recurso', () => {
      const r = corregirItem(i3, { opcion: 'c' });
      assert.equal(r.puntos, 0);
      assert.equal(r.retro.nivel, 'sin-puntos');
      assert.equal(r.retro.indicador.demostrado, false);
      assert.equal(r.retro.indicador.estado, 'por-reforzar');
      assert.match(r.retro.revisar, /diferencia adecuadamente entre recordar una secuencia y comprender/i);
      assert.match(r.retro.sugerencia, /Pista de recuperación frente a comprensión/i);
    });

    test('Rechaza justificación con menos de 6 palabras cuando se envía', () => {
      assert.throws(
        () => corregirItem(i3, { opcion: 'a', justificacion: 'Muy corta' }),
        (e) => e.estado === 400 && e.message.includes('al menos 6 palabras')
      );
    });
  });

  describe('Ítem 4: Propuesta de ritmo o canción breve para recuperar secuencia', () => {
    test('Propuesta defendible: 15/15, registra propuesta e indicador demostrado', () => {
      const propuesta = 'Explicar con ejemplos cada concepto primero y usar la melodía solo como apoyo para recordar el orden.';
      const r = corregirItem(i4, { opcion: 'a', propuesta });
      assert.equal(r.puntos, 15);
      assert.equal(r.valor.opcion, 'a');
      assert.equal(r.valor.propuesta, propuesta);
      assert.equal(r.retro.indicador.demostrado, true);
      assert.equal(r.retro.indicador.estado, 'adquirido');
      assert.equal(r.retro.indicador.concepto, 'Uso del ritmo para recordar una secuencia');
      assert.match(r.retro.explicacion, /apoyo de recuperación/i);
    });

    test('Propuesta no defendible (opción c): 0/15, retroalimentación explica que no sustituye la comprensión', () => {
      const r = corregirItem(i4, { opcion: 'c' });
      assert.equal(r.puntos, 0);
      assert.equal(r.retro.nivel, 'sin-puntos');
      assert.equal(r.retro.indicador.demostrado, false);
      assert.equal(r.retro.indicador.estado, 'por-reforzar');
      assert.match(r.retro.revisar, /nunca como sustituto de la comprensión/i);
    });

    test('Rechaza propuesta con menos de 6 palabras cuando se envía', () => {
      assert.throws(
        () => corregirItem(i4, { opcion: 'a', propuesta: 'Incompleta' }),
        (e) => e.estado === 400 && e.message.includes('al menos 6 palabras')
      );
    });
  });

  describe('Tema y recursos de Misión 2', () => {
    test('Misión 2 está vinculada a tem_000004 y ambos ítems refieren a su recurso screencast', () => {
      assert.equal(m2.temaId, 'tem_000004');
      assert.equal(i3.recurso, 'screencast');
      assert.equal(i4.recurso, 'screencast');
    });
  });
});
