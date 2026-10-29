// pruebas/alertas.test.js
// Pruebas unitarias de los cálculos puros de servidor/alertas.js (no leen ni escriben datos)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { promedioReciente, fallosSeguidos, diasInactivo, alertaRepetida, limiteDe, vencidasSinIntento } from '../servidor/alertas.js';

const intento = (puntaje, maximo, fecha, actividad = 'ahorcado', extra = {}) => ({ actividad, puntaje, maximo, fecha, ...extra });
const DIA = 24 * 60 * 60 * 1000;

describe('promedioReciente', () => {
  test('promedia los últimos N intentos sobre 10 con un decimal', () => {
    const lista = [intento(10, 10, '2026-10-01'), intento(5, 10, '2026-10-02'), intento(6, 10, '2026-10-03'), intento(3, 4, '2026-10-04')];
    assert.deepEqual(promedioReciente(lista, 3), { promedio: 6.2, cantidad: 3, ultimaFecha: '2026-10-04' });   // (5 + 6 + 7,5) / 3
  });

  test('usa los más recientes aunque lleguen desordenados', () => {
    const lista = [intento(2, 10, '2026-10-05'), intento(10, 10, '2026-10-01'), intento(4, 10, '2026-10-04')];
    assert.equal(promedioReciente(lista, 2).promedio, 3);
  });

  test('no cuenta "tema-revisado"', () => {
    const lista = [intento(2, 10, '2026-10-01'), intento(1, 1, '2026-10-02', 'tema-revisado'), intento(4, 10, '2026-10-03')];
    assert.equal(promedioReciente(lista, 2).promedio, 3);
  });

  test('devuelve null si aún no hay suficientes intentos', () => {
    assert.equal(promedioReciente([intento(1, 10, '2026-10-01'), intento(1, 10, '2026-10-02')], 3), null);
  });

  test('ignora intentos con máximo 0 (sin nota)', () => {
    assert.equal(promedioReciente([intento(0, 0, '2026-10-01'), intento(8, 10, '2026-10-02')], 2), null);
  });
});

describe('fallosSeguidos', () => {
  const quiz = (aprobado, fecha) => intento(aprobado ? 8 : 4, 10, fecha, 'quiz', { detalle: { aprobado } });

  test('detecta N intentos seguidos sin aprobar', () => {
    assert.deepEqual(fallosSeguidos([quiz(false, '2026-10-01'), quiz(false, '2026-10-02'), quiz(false, '2026-10-03')], 3), { veces: 3, ultimaFecha: '2026-10-03' });
  });

  test('un aprobado reciente corta la racha', () => {
    assert.equal(fallosSeguidos([quiz(false, '2026-10-01'), quiz(false, '2026-10-02'), quiz(true, '2026-10-03')], 3), null);
  });

  test('solo mira los últimos N (un aprobado antiguo no importa)', () => {
    const lista = [quiz(true, '2026-10-01'), quiz(false, '2026-10-02'), quiz(false, '2026-10-03'), quiz(false, '2026-10-04')];
    assert.ok(fallosSeguidos(lista, 3));
  });

  test('ordena por fecha antes de evaluar', () => {
    const lista = [quiz(false, '2026-10-04'), quiz(true, '2026-10-05'), quiz(false, '2026-10-03'), quiz(false, '2026-10-02')];
    assert.equal(fallosSeguidos(lista, 3), null);   // el más reciente (05) está aprobado
  });

  test('menos de N intentos: null', () => {
    assert.equal(fallosSeguidos([quiz(false, '2026-10-01'), quiz(false, '2026-10-02')], 3), null);
  });

  test('sin detalle.aprobado no se considera fallo', () => {
    const lista = [1, 2, 3].map((d) => intento(1, 10, `2026-10-0${d}`, 'quiz'));
    assert.equal(fallosSeguidos(lista, 3), null);
  });
});

describe('diasInactivo', () => {
  const ahora = Date.parse('2026-10-26T12:00:00Z');
  test('cuenta días completos desde el último evento', () => {
    assert.equal(diasInactivo(new Date(ahora - 7 * DIA).toISOString(), ahora), 7);
    assert.equal(diasInactivo(new Date(ahora - 6.9 * DIA).toISOString(), ahora), 6);
  });
  test('sin eventos devuelve null', () => {
    assert.equal(diasInactivo(null, ahora), null);
  });
});

describe('alertaRepetida (sin duplicados)', () => {
  const clave = { estudianteId: 'usu_1', regla: 'fallosQuiz', grupoId: 'dis_1', temaId: 'tem_1' };
  const base = { ...clave, fecha: '2026-10-10T00:00:00.000Z' };

  test('una activa con la misma clave es duplicado', () => {
    assert.equal(alertaRepetida([{ ...base, estado: 'activa' }], clave, '2026-10-20'), true);
  });

  test('otro tema, otra regla u otro estudiante no son duplicados', () => {
    const activa = { ...base, estado: 'activa' };
    assert.equal(alertaRepetida([{ ...activa, temaId: 'tem_2' }], clave, '2026-10-20'), false);
    assert.equal(alertaRepetida([{ ...activa, regla: 'promedioBajo' }], clave, '2026-10-20'), false);
    assert.equal(alertaRepetida([{ ...activa, estudianteId: 'usu_2' }], clave, '2026-10-20'), false);
  });

  test('atendida después de la evidencia: no se vuelve a crear', () => {
    const atendida = { ...base, estado: 'atendida', fechaAtendida: '2026-10-15T00:00:00.000Z' };
    assert.equal(alertaRepetida([atendida], clave, '2026-10-12T00:00:00.000Z'), true);
  });

  test('atendida antes de nueva evidencia: sí se crea otra', () => {
    const atendida = { ...base, estado: 'atendida', fechaAtendida: '2026-10-15T00:00:00.000Z' };
    assert.equal(alertaRepetida([atendida], clave, '2026-10-20T00:00:00.000Z'), false);
  });

  test('inactividad sin eventos nunca (evidencia vacía) no se repite tras atenderla', () => {
    const c = { estudianteId: 'usu_1', regla: 'inactividad', grupoId: 'dis_1', temaId: null };
    assert.equal(alertaRepetida([{ ...c, fecha: '2026-10-10', estado: 'atendida', fechaAtendida: '2026-10-11' }], c, null), true);
  });
});

describe('vencidasSinIntento', () => {
  const evento = (extra = {}) => ({ id: 'age_1', tipo: 'fecha-limite', actividad: 'pareja', temaId: 'tem_1', inicio: '2026-10-10T15:00:00.000Z', todoElDia: false, fecha: '2026-10-01T00:00:00.000Z', ...extra });
  const limite = Date.parse('2026-10-10T15:00:00.000Z');

  test('limiteDe: con hora es el inicio (o el fin); todo el día termina al acabar el último día', () => {
    assert.equal(limiteDe(evento()), limite);
    assert.equal(limiteDe(evento({ fin: '2026-10-11T15:00:00.000Z' })), limite + DIA);
    assert.equal(limiteDe(evento({ todoElDia: true, inicio: '2026-10-10' })), new Date('2026-10-10T00:00:00').getTime() + DIA);
  });

  test('alerta solo pasados más de diasGracia días del vencimiento', () => {
    assert.equal(vencidasSinIntento([evento()], [], 1, limite + DIA - 1).length, 0);
    assert.equal(vencidasSinIntento([evento()], [], 1, limite + DIA + 1).length, 1);
    assert.equal(vencidasSinIntento([evento()], [], 0, limite + 1).length, 1);
  });

  test('un intento de esa actividad y tema posterior a la creación del evento la evita', () => {
    const ahora = limite + 3 * DIA;
    const hecho = { actividad: 'pareja', temaId: 'tem_1', fecha: '2026-10-05T00:00:00.000Z' };
    assert.equal(vencidasSinIntento([evento()], [hecho], 1, ahora).length, 0);
    assert.equal(vencidasSinIntento([evento()], [{ ...hecho, fecha: '2026-09-30T00:00:00.000Z' }], 1, ahora).length, 1);   // anterior al evento
    assert.equal(vencidasSinIntento([evento()], [{ ...hecho, temaId: 'tem_2' }], 1, ahora).length, 1);
    assert.equal(vencidasSinIntento([evento()], [{ ...hecho, actividad: 'quiz' }], 1, ahora).length, 1);
  });

  test('ignora otros tipos y fechas límite sin actividad o sin tema', () => {
    const ahora = limite + 3 * DIA;
    assert.equal(vencidasSinIntento([evento({ tipo: 'tarea' }), evento({ actividad: null }), evento({ temaId: null })], [], 1, ahora).length, 0);
  });
});
