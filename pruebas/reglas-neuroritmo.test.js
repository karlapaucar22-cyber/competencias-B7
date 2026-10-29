// pruebas/reglas-neuroritmo.test.js
// NR-06.1 · Reglas de NeuroRitmo centralizadas en reglas-gamificacion.json → "neuroritmo"

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as reglas from '../publico/js/nucleo/neuroritmo.js';

const leer = (ruta) => JSON.parse(fs.readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const gamificacion = leer('../datos/config/reglas-gamificacion.json');
const experiencia = leer('../datos/config/neuroritmo.json');
const insignias = leer('../datos/insignias.json').filter((i) => i.grupo === 'neuroritmo');
const combinada = reglas.combinarReglas(experiencia, gamificacion);
const intento = (mision, puntaje, extra = {}, fecha = '2026-10-27T10:00:00Z') => ({ actividad: 'neuroritmo', puntaje, maximo: 100, fecha, detalle: { mision, ...extra } });

describe('NR-06.1 · Reglas centrales de NeuroRitmo', () => {
  test('una sola fuente: 3×100, 60/40, aprobación 70, logro 240, mejor nota y pistas sin descuento', () => {
    const r = gamificacion.neuroritmo;
    assert.deepEqual([r.misiones.length, r.puntosPorMision, r.decision, r.justificacion, r.aprobacion, r.logroTotal], [3, 100, 60, 40, 70, 240]);
    assert.equal(r.conservarMejorIntento, true);
    assert.equal(r.descuentoPorPista, 0);
    for (const k of ['aprobacion', 'logroTotal', 'justificacionValidaM3']) assert.ok(!(k in experiencia), `${k} no se duplica en neuroritmo.json`);
    assert.ok(!('neuroritmo' in gamificacion.puntos), 'NeuroRitmo no usa la tabla de puntos genérica');
    assert.equal(combinada.reglas.maximoRuta, 300);
    assert.deepEqual([combinada.aprobacion, combinada.logroTotal, combinada.justificacionValidaM3], [70, 240, 24]);
  });

  test('no se mezcla con las reglas del quiz de cinco niveles', () => {
    for (const lista of [gamificacion.requiereAprobado, Object.keys(gamificacion.unicas || {}), Object.keys(gamificacion.maxDiario || {}), Object.keys(gamificacion.mejorPuntaje || {})]) {
      assert.ok(!(lista || []).includes('neuroritmo'));
    }
    assert.ok(!insignias.some((i) => i.condicion.tipo === 'nivelQuiz'));
  });

  test('normalizarReglas rechaza reglas incoherentes y anula cualquier descuento por pistas', () => {
    assert.throws(() => reglas.normalizarReglas({ decision: 70, justificacion: 40 }), /decisión \+ justificación/);
    assert.throws(() => reglas.normalizarReglas({ aprobacion: 120 }), /aprobación supera/);
    assert.throws(() => reglas.normalizarReglas({ logroTotal: 'mucho' }), /logroTotal/);
    assert.equal(reglas.normalizarReglas({ descuentoPorPista: 5 }).descuentoPorPista, 0);
  });

  test('estadoRuta toma la aprobación y el máximo de la configuración, no de constantes', () => {
    const exigente = reglas.combinarReglas(experiencia, { neuroritmo: { ...gamificacion.neuroritmo, aprobacion: 80, logroTotal: 250 } });
    const datos = [intento('m1', 75)];
    assert.equal(reglas.estadoRuta(datos, [], combinada).misiones.m2.estado, 'abierta', '75 ≥ 70');
    assert.equal(reglas.estadoRuta(datos, [], exigente).misiones.m2.estado, 'bloqueada', '75 < 80');
    assert.match(reglas.estadoRuta(datos, [], exigente).condiciones.find((c) => c.id === 'total').texto, /250\/300/);
  });

  test('reintentos: se conserva la mejor nota por misión', () => {
    const e = reglas.estadoRuta([intento('m1', 90, {}, '2026-10-01'), intento('m1', 50, {}, '2026-10-02')], [], combinada);
    assert.equal(e.misiones.m1.mejor, 90);
    const ultima = reglas.combinarReglas(experiencia, { neuroritmo: { ...gamificacion.neuroritmo, conservarMejorIntento: false } });
    assert.equal(reglas.estadoRuta([intento('m1', 90, {}, '2026-10-01'), intento('m1', 50, {}, '2026-10-02')], [], ultima).misiones.m1.mejor, 50);
  });

  test('las insignias de misión, mejora y foro siguen la configuración central', () => {
    const por = Object.fromEntries(insignias.map((i) => [i.id, i.condicion]));
    assert.deepEqual(por['observador-atencional'], { tipo: 'mision', mision: 'm1' });
    assert.deepEqual(por['guardian-memoria'], { tipo: 'mision', mision: 'm2' });
    assert.deepEqual(por['disenador-neuroritmico'], { tipo: 'mision', mision: 'm3' });
    assert.deepEqual(por['mente-en-ajuste'], { tipo: 'mejora', actividad: 'neuroritmo' });
    assert.deepEqual(por['eco-colaborativo'], { tipo: 'aporteForo', temaId: experiencia.galeria.temaId });
    assert.equal(gamificacion.neuroritmo.mejoraMinima, 15);
    assert.equal(gamificacion.neuroritmo.mejoraRequiereRetro, true);
  });

  test('la rúbrica de M3 y la distribución de M2 usan los 60/40 configurados', () => {
    const r = combinada.reglas;
    const m3 = experiencia.misiones.find((m) => m.id === 'm3');
    assert.equal(reglas.errorRubrica(m3.rubrica, { producto: r.decision, justificacion: r.justificacion }), '');
    const m2 = experiencia.misiones.find((m) => m.id === 'm2');
    assert.equal(reglas.errorDistribucion(reglas.pesosItems(m2), m2.items, r.decision), '');
  });
});
