// pruebas/escenarios.test.js
// Pruebas unitarias de publico/js/nucleo/escenarios.js (validación, mejor camino y mapa)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validarEscenario, mejorPuntaje, mapaEscenario } from '../publico/js/nucleo/escenarios.js';

const op = (destino, puntos = 5, extra = {}) => ({ texto: `Ir a ${destino}`, destino, puntos, consecuencia: 'Pasa algo.', ...extra });
const base = (escenas, extra = {}) => ({ titulo: 'Prueba', temaId: 'tem_1', escenaInicial: 'e1', escenas, ...extra });
const valido = () => base([
  { id: 'e1', texto: 'Inicio', opciones: [op('e2', 10), op('e3', -5)] },
  { id: 'e2', texto: 'Bien', opciones: [op('e4', 10), op('e3', 0)] },
  { id: 'e3', texto: 'Final B', opciones: [] },
  { id: 'e4', texto: 'Final A', opciones: [] }
]);
const mensajes = (sim) => validarEscenario(sim).map((e) => e.mensaje).join(' | ');

describe('validarEscenario', () => {
  test('un escenario completo no tiene errores (y la semilla tampoco)', () => {
    assert.deepEqual(validarEscenario(valido()), []);
    const semilla = JSON.parse(fs.readFileSync(new URL('../datos/semilla/simulaciones.json', import.meta.url), 'utf8'))[0];
    assert.deepEqual(validarEscenario(semilla), []);
  });

  test('destino inexistente y escena inicial inválida', () => {
    const s = valido();
    s.escenas[0].opciones[0].destino = 'e9';
    assert.match(mensajes(s), /E1, opción 1: elige una escena de destino que exista/);
    assert.match(mensajes({ ...valido(), escenaInicial: 'x' }), /escena inicial/);
  });

  test('de 2 a 4 opciones, puntos enteros de −10 a 10 y consecuencia obligatoria', () => {
    const s = valido();
    s.escenas[0].opciones = [op('e2')];
    assert.match(mensajes(s), /de 2 a 4 opciones/);
    const p = valido();
    p.escenas[0].opciones[0].puntos = 11;
    p.escenas[0].opciones[1].puntos = 2.5;
    p.escenas[1].opciones[0].consecuencia = '  ';
    const m = validarEscenario(p);
    assert.equal(m.filter((e) => /puntos/.test(e.mensaje)).length, 2);
    assert.ok(m.some((e) => e.escena === 'e2' && /consecuencia/.test(e.mensaje)));
  });

  test('escenas no alcanzables y falta de final', () => {
    const s = valido();
    s.escenas.push({ id: 'e5', texto: 'Suelta', opciones: [] });
    assert.ok(validarEscenario(s).some((e) => e.escena === 'e5' && /no se puede llegar/.test(e.mensaje)));
    const sinFinal = base([
      { id: 'e1', texto: 'a', opciones: [op('e2'), op('e2')] },
      { id: 'e2', texto: 'b', opciones: [op('e1'), op('e1')] }
    ]);
    assert.match(mensajes(sinFinal), /al menos un final/);
  });

  test('detecta ciclos (una sola vez por arista) y opciones a la misma escena', () => {
    const s = valido();
    s.escenas[1].opciones[1].destino = 'e1';
    const ciclos = validarEscenario(s).filter((e) => /ciclo/.test(e.mensaje));
    assert.equal(ciclos.length, 1);
    assert.equal(ciclos[0].escena, 'e2');
    const propia = valido();
    propia.escenas[0].opciones[1].destino = 'e1';
    assert.match(mensajes(propia), /no puede llevar a la misma escena/);
  });

  test('los errores generales no llevan escena', () => {
    const e = validarEscenario({ escenas: [] });
    assert.ok(e.length >= 2 && e.every((x) => x.escena === null));
  });
});

describe('mejorPuntaje y mapaEscenario', () => {
  test('mejor camino hasta un final', () => {
    assert.equal(mejorPuntaje(valido()), 20);
    const semilla = JSON.parse(fs.readFileSync(new URL('../datos/semilla/simulaciones.json', import.meta.url), 'utf8'))[0];
    assert.equal(mejorPuntaje(semilla), 30);
  });

  test('ignora los ciclos al calcular el mejor camino', () => {
    const s = valido();
    s.escenas[1].opciones[1] = op('e1', 10);
    assert.equal(mejorPuntaje(s), 20);
  });

  test('el mapa marca escenas repetidas, finales, destinos vacíos y escenas sueltas', () => {
    const s = valido();
    s.escenas.push({ id: 'e5', texto: 'Suelta', opciones: [] });
    s.escenas[0].opciones.push(op(''));
    const { raiz, sueltas } = mapaEscenario(s);
    assert.equal(raiz.id, 'e1');
    assert.equal(raiz.hijos[0].nodo.id, 'e2');
    assert.equal(raiz.hijos[0].nodo.hijos[0].nodo.final, true);
    assert.equal(raiz.hijos[1].nodo.repetida, true);   // e3 ya apareció bajo e2
    assert.equal(raiz.hijos[2].nodo.inexistente, true);
    assert.deepEqual(sueltas, ['e5']);
  });
});
