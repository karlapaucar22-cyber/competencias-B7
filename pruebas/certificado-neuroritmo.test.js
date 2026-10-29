// pruebas/certificado-neuroritmo.test.js
// NR-06.5 · Certificado «Ruta NeuroRitmo completada»: requisito combinado y huella verificable

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as reglas from '../publico/js/nucleo/neuroritmo.js';
import { huellaDe } from '../servidor/rutas/certificados.js';

const leer = (ruta) => JSON.parse(fs.readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const experiencia = reglas.combinarReglas(leer('../datos/config/neuroritmo.json'), leer('../datos/config/reglas-gamificacion.json'));
const intento = (mision, puntaje, extra = {}) => ({ actividad: 'neuroritmo', puntaje, maximo: 100, fecha: '2026-10-27', detalle: { mision, ...extra } });
const ruta = (m1, m2, m3, validada) => reglas.estadoRuta([intento('m1', m1), intento('m2', m2), intento('m3', m3, validada ? { validada: true } : {})], [], experiencia);
const falta = (e) => e.condiciones.filter((c) => !c.cumple).map((c) => c.id);

describe('NR-06.5 · Requisito combinado del certificado', () => {
  test('son exactamente cinco requisitos obligatorios con valor actual y requerido', () => {
    const e = ruta(80, 80, 80, true);
    assert.deepEqual(e.condiciones.map((c) => c.id), ['m1', 'm2', 'm3', 'total', 'validacion']);
    assert.ok(e.condiciones.every((c) => 'actual' in c && 'requerido' in c));
    assert.deepEqual(e.condiciones.slice(0, 3).map((c) => c.requerido), [70, 70, 70]);
    assert.equal(e.condiciones[3].requerido, 240);
  });

  test('70 + 70 + 70 = 210 validada: NO procede (falta el total)', () => {
    const e = ruta(70, 70, 70, true);
    assert.equal(e.total, 210);
    assert.equal(e.cumple, false);
    assert.deepEqual(falta(e), ['total']);
  });

  test('80 + 80 + 80 = 240 con validación docente: procede', () => {
    const e = ruta(80, 80, 80, true);
    assert.equal(e.total, 240);
    assert.equal(e.cumple, true);
  });

  test('240 sin validación docente: NO procede (M3 no cuenta ni está validada)', () => {
    const e = ruta(80, 80, 80, false);
    assert.equal(e.cumple, false);
    assert.deepEqual(falta(e), ['m3', 'total', 'validacion']);
    assert.equal(e.misiones.m3.mejor, 0, 'un 80 en M3 sin validar no suma');
  });

  test('M3 validada con 69 y total ≥ 240: NO procede (M3 bajo 70)', () => {
    const e = ruta(100, 100, 69, true);
    assert.equal(e.total, 269);
    assert.deepEqual(falta(e), ['m3']);
  });

  test('la huella cambia si se altera la puntuación, el nombre o las insignias', () => {
    const base = {
      codigo: 'EE-2026-ABC123', nombreCompleto: 'Ana Pérez', fecha: '2026-10-27T10:00:00.000Z',
      puntuacion: { m1: 80, m2: 80, m3: 80, total: 240, maximo: 300, aprobacion: 70, logroTotal: 240 },
      misiones: [{ id: 'm1', titulo: 'Misión 1', puntaje: 80, maximo: 100 }], insignias: ['Observador atencional']
    };
    const h = huellaDe(base);
    assert.match(h, /^[0-9A-F]{16}$/);
    assert.equal(huellaDe({ ...base }), h);
    assert.notEqual(huellaDe({ ...base, puntuacion: { ...base.puntuacion, total: 260 } }), h);
    assert.notEqual(huellaDe({ ...base, nombreCompleto: 'Otra persona' }), h);
    assert.notEqual(huellaDe({ ...base, insignias: [] }), h);
  });
});
