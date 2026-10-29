// pruebas/rol.test.js
// Pruebas unitarias del juego de roles: validarRol (escenarios.js) e historial del preparador

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validarRol } from '../publico/js/nucleo/escenarios.js';
import { validarHistorial, turnosDe } from '../servidor/preparadores/rol-simulacion.js';

const criterio = (n, puntos = 5) => ({ criterio: `C${n}`, descripcion: 'Lo esperado', puntos });
const rol = (extra = {}) => ({
  titulo: 'Entrevista', temaId: 'tem_1', maxTurnos: 6,
  personaje: { nombre: 'Sra. Paz', descripcion: 'Madre preocupada', contexto: 'Reunión', objetivo: 'Acordar apoyo' },
  rubrica: [criterio(1), criterio(2), criterio(3)],
  ...extra
});
const estadoDe = (fn) => { try { fn(); } catch (err) { return err.estado; } return null; };

describe('validarRol', () => {
  test('un juego de roles completo no tiene errores', () => {
    assert.deepEqual(validarRol(rol()), []);
  });

  test('exige los cuatro datos del personaje', () => {
    const e = validarRol(rol({ personaje: { nombre: ' ' } })).map((x) => x.mensaje).join(' | ');
    assert.match(e, /nombre/);
    assert.match(e, /describe/);
    assert.match(e, /contexto/);
    assert.match(e, /objetivo/);
  });

  test('rúbrica de 3 a 5 criterios con puntos enteros de 1 a 20', () => {
    assert.ok(validarRol(rol({ rubrica: [criterio(1), criterio(2)] })).some((x) => /3 a 5 criterios/.test(x.mensaje)));
    assert.ok(validarRol(rol({ rubrica: [1, 2, 3, 4, 5, 6].map((n) => criterio(n)) })).some((x) => /3 a 5 criterios/.test(x.mensaje)));
    const malos = validarRol(rol({ rubrica: [criterio(1, 0), criterio(2, 21), criterio(3, 2.5)] }));
    assert.equal(malos.filter((x) => /puntos/.test(x.mensaje)).length, 3);
    assert.ok(validarRol(rol({ rubrica: [criterio(1), { criterio: '', descripcion: '', puntos: 5 }, criterio(3)] })).length === 2);
  });

  test('máximo de turnos de 4 a 12', () => {
    assert.equal(validarRol(rol({ maxTurnos: 4 })).length, 0);
    assert.equal(validarRol(rol({ maxTurnos: 12 })).length, 0);
    assert.ok(validarRol(rol({ maxTurnos: 3 })).some((x) => /turnos/.test(x.mensaje)));
    assert.ok(validarRol(rol({ maxTurnos: 13 })).some((x) => /turnos/.test(x.mensaje)));
  });
});

describe('historial del juego de roles', () => {
  const est = (texto) => ({ rol: 'estudiante', texto });
  const per = (texto) => ({ rol: 'personaje', texto });

  test('limita a los últimos maxTurnos turnos', () => {
    const largo = Array.from({ length: 10 }, (_, i) => [est(`e${i}`), per(`p${i}`)]).flat();
    const r = validarHistorial(largo, 4);
    assert.equal(r.length, 8);
    assert.equal(r[0].texto, 'e6');
    assert.equal(turnosDe(r), 4);
  });

  test('rechaza roles inválidos, textos de más de 1.000 caracteres e historial vacío', () => {
    assert.equal(estadoDe(() => validarHistorial([], 6)), 400);
    assert.equal(estadoDe(() => validarHistorial([{ rol: 'tutor', texto: 'x' }], 6)), 400);
    assert.equal(estadoDe(() => validarHistorial([est('a'.repeat(1001))], 6)), 400);
    assert.equal(validarHistorial([est('  hola  '), per('')], 6).length, 1);
  });
});
