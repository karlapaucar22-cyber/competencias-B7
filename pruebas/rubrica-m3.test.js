// pruebas/rubrica-m3.test.js
// NR-05.4 · Rúbrica de cuatro criterios de la Misión 3 (60 producto + 40 justificación) configurada por el docente

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as reglas from '../publico/js/nucleo/neuroritmo.js';
import { versionPublica } from '../servidor/rutas/neuroritmo.js';

const experiencia = JSON.parse(fs.readFileSync(new URL('../datos/config/neuroritmo.json', import.meta.url), 'utf8'));
const m3 = experiencia.misiones.find((m) => m.id === 'm3');
const base = () => [
  { id: 'c1', criterio: 'Criterio de producto A', tipo: 'producto', maximo: 20 },
  { id: 'c2', criterio: 'Criterio de producto B', tipo: 'producto', maximo: 20 },
  { id: 'c3', criterio: 'Criterio de producto C', tipo: 'producto', maximo: 20 },
  { id: 'c4', criterio: 'Criterio de justificación', tipo: 'justificacion', maximo: 40 }
];

describe('NR-05.4 · Rúbrica de la Misión 3', () => {
  test('la rúbrica configurada tiene cuatro criterios y no figura como aprobada sin el equipo docente', () => {
    assert.equal(reglas.errorRubrica(m3.rubrica), '');
    assert.ok(['propuesta', 'aprobada'].includes(m3.rubricaConfig.estado));
    if (m3.rubricaConfig.estado === 'aprobada') assert.ok(m3.rubricaConfig.aprobadaPor && m3.rubricaConfig.fechaAprobacion);
    assert.match(m3.rubricaConfig.fuente, /no desarrolla su lista exacta/);
  });

  test('errorRubrica: cuatro criterios c1..c4, producto 60 y justificación 40', () => {
    assert.equal(reglas.errorRubrica(base()), '');
    const dosYDos = base().map((c, n) => ({ ...c, tipo: n < 2 ? 'producto' : 'justificacion', maximo: n < 2 ? 30 : 20 }));
    assert.equal(reglas.errorRubrica(dosYDos), '', 'admite otro reparto siempre que sume 60 + 40');
    assert.match(reglas.errorRubrica(base().slice(0, 3)), /exactamente cuatro/);
    assert.match(reglas.errorRubrica([...base(), { id: 'c5', criterio: 'Extra', tipo: 'producto', maximo: 5 }]), /exactamente cuatro/);
    assert.match(reglas.errorRubrica(base().map((c) => (c.id === 'c1' ? { ...c, maximo: 25 } : c))), /producto deben sumar 60 \(ahora 65\)/);
    assert.match(reglas.errorRubrica(base().map((c) => (c.id === 'c4' ? { ...c, tipo: 'producto' } : c))), /producto deben sumar 60/);
    assert.match(reglas.errorRubrica(base().map((c) => (c.id === 'c2' ? { ...c, criterio: 'ab' } : c))), /nombre del criterio 2/);
    assert.match(reglas.errorRubrica(base().map((c) => (c.id === 'c3' ? { ...c, tipo: 'otro' } : c))), /producto o la justificación/);
    assert.match(reglas.errorRubrica(base().map((c) => (c.id === 'c3' ? { ...c, maximo: 2 } : c))), /entero de 5 o más/);
    assert.match(reglas.errorRubrica(base().map((c, n) => ({ ...c, id: `x${n}` }))), /c1, c2, c3 y c4/);
  });

  test('subtotales: producto hasta 60 y justificación hasta 40 según el tipo de cada criterio', () => {
    assert.deepEqual(reglas.subtotalesRubrica(base(), { c1: 20, c2: 15, c3: 10, c4: 30 }), { producto: 45, justificacion: 30, total: 75 });
    const dosYDos = base().map((c, n) => ({ ...c, tipo: n < 2 ? 'producto' : 'justificacion' }));
    assert.deepEqual(reglas.subtotalesRubrica(dosYDos, { c1: 20, c2: 15, c3: 10, c4: 30 }), { producto: 35, justificacion: 40, total: 75 });
  });

  test('la versión pública muestra la rúbrica y su estado, sin historial ni autoría', () => {
    const publica = versionPublica(experiencia).misiones.find((m) => m.id === 'm3');
    assert.equal(publica.rubricaEstado, m3.rubricaConfig.estado);
    assert.deepEqual(Object.keys(publica.rubrica[0]).sort(), ['criterio', 'id', 'maximo', 'tipo']);
    assert.ok(!JSON.stringify(publica).includes('historial'));
  });

  test('sin intento validado por el docente no hay M3 ni certificado', () => {
    const m = (id, puntaje, extra = {}) => ({ actividad: 'neuroritmo', puntaje, maximo: 100, detalle: { mision: id, ...extra } });
    const autovalidado = reglas.estadoRuta([m('m1', 100), m('m2', 100), m('m3', 100)], [], experiencia);
    assert.deepEqual([autovalidado.misiones.m3.mejor, autovalidado.cumple], [0, false]);
    const validado = reglas.estadoRuta([m('m1', 100), m('m2', 100), m('m3', 90, { validada: true })], [], experiencia);
    assert.deepEqual([validado.misiones.m3.mejor, validado.cumple], [90, true]);
  });
});
