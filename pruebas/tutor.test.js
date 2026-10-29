// pruebas/tutor.test.js
// Pruebas unitarias del tutor: validación del historial y recorte de la respuesta (sin IA ni escrituras)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import prepararTutor, { validarHistorial, nivelApoyoDe, MAX_TURNOS } from '../servidor/preparadores/tutor.js';
import { recortarRespuesta } from '../servidor/rutas/ia.js';
import { validarTexto } from '../servidor/esquemas-ia.js';

const est = (texto) => ({ rol: 'estudiante', texto });
const tut = (texto) => ({ rol: 'tutor', texto });
const estadoDe = (fn) => { try { fn(); } catch (err) { return err.estado; } return null; };

describe('validarHistorial', () => {
  test('el último mensaje del estudiante es la pregunta; los anteriores, el historial', () => {
    const r = validarHistorial([est('Hola'), tut('¿Qué sabes del tema?'), est('  Poco  ')]);
    assert.equal(r.pregunta, 'Poco');
    assert.deepEqual(r.previos, [est('Hola'), tut('¿Qué sabes del tema?')]);
  });

  test('solo considera los 10 últimos mensajes', () => {
    const largo = Array.from({ length: 15 }, (_, i) => (i % 2 ? tut(`t${i}`) : est(`e${i}`)));
    const r = validarHistorial(largo);
    assert.equal(MAX_TURNOS, 10);
    assert.equal(r.previos.length, 9);
    assert.equal(r.previos[0].texto, 't5');
    assert.equal(r.pregunta, 'e14');
  });

  test('rechaza con 400 historial vacío, roles inválidos, último del tutor y textos de más de 1.000', () => {
    assert.equal(estadoDe(() => validarHistorial([])), 400);
    assert.equal(estadoDe(() => validarHistorial(undefined)), 400);
    assert.equal(estadoDe(() => validarHistorial([{ rol: 'sistema', texto: 'x' }])), 400);
    assert.equal(estadoDe(() => validarHistorial([est('hola'), tut('¿y?')])), 400);
    assert.equal(estadoDe(() => validarHistorial([est('a'.repeat(1001))])), 400);
    assert.equal(estadoDe(() => validarHistorial([est('   ')])), 400);
    assert.equal(validarHistorial([est('a'.repeat(1000))]).pregunta.length, 1000);
  });

  test('un mensaje viejo inválido fuera de los 10 últimos no afecta', () => {
    const lista = [{ rol: 'x', texto: 1 }, ...Array.from({ length: 10 }, () => est('ok'))];
    assert.equal(validarHistorial(lista).pregunta, 'ok');
  });
});

describe('recortarRespuesta', () => {
  test('deja igual las respuestas de hasta 700 caracteres', () => {
    assert.equal(recortarRespuesta('  ¿Qué opinas?  '), '¿Qué opinas?');
    assert.equal(recortarRespuesta('a'.repeat(700)).length, 700);
  });

  test('recorta a 700 como máximo, en un espacio y con "…"', () => {
    const texto = 'palabra '.repeat(200);
    const r = recortarRespuesta(texto);
    assert.ok(r.length <= 700);
    assert.ok(r.endsWith('palabra…'));
  });

  test('sin espacios cercanos corta en 699 + "…"', () => {
    const r = recortarRespuesta('x'.repeat(900));
    assert.equal(r.length, 700);
    assert.ok(r.endsWith('…'));
  });
});

describe('NR-08.3C · tutor socrático contextual', () => {
  test('progresa el apoyo cuando el estudiante expresa dificultad', () => {
    assert.equal(nivelApoyoDe([], '¿Qué relación tiene la atención?'), 1);
    assert.equal(nivelApoyoDe([], 'No entiendo la atención'), 2);
    assert.equal(nivelApoyoDe([est('No entiendo'), tut('Pista')], 'Necesito otra pista'), 3);
  });

  test('el servidor deriva misión, actividad y concepto desde su configuración', async () => {
    const preparado = await prepararTutor({
      temaId: 'tem_000003',
      contexto: { misionId: 'm1', itemId: 'i1', actividad: 'mision' },
      historial: [est('¿Cómo puedo analizar la lectura con música?')]
    }, { id: 'usu_000009', rol: 'estudiante' });
    assert.match(preparado.contexto, /Misión 1: Detectives de la atención/);
    assert.match(preparado.contexto, /Lectura comprensiva/);
    assert.match(preparado.contexto, /Atención selectiva/);
    assert.equal(preparado.__control.preguntas, 1);
    assert.equal(preparado.__control.maxFrases, 4);
  });

  test('acepta 2–4 frases con una pregunta y rechaza soluciones o respuestas extensas', () => {
    const control = { maxPalabras: 90, minFrases: 2, maxFrases: 4, preguntas: 1 };
    const valida = 'Pensemos en la demanda verbal de la tarea. ¿Qué podría competir con las palabras del texto?';
    assert.equal(validarTexto('tutor', valida, control), valida);
    assert.throws(() => validarTexto('tutor', '¿Qué piensas?', control), (error) => error.estado === 502);
    assert.throws(() => validarTexto('tutor', 'Observa el caso. ¿Qué cambia? ¿Qué mantienes?', control), (error) => error.estado === 502);
    assert.throws(() => validarTexto('tutor', 'La respuesta correcta es memoria. ¿Puedes repetirla?', control), (error) => error.estado === 502);
  });
});
