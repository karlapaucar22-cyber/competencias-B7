// NR-09.6 · selección de grupo y matrícula sin duplicados.

import test from 'node:test';
import assert from 'node:assert/strict';
import { estudiantesCon, grupoParaRegistro } from '../servidor/inscripcion.js';

const grupos = [
  { id: 'dis_1', asignaturaId: 'asi_neuro', estudiantes: ['u1'] },
  { id: 'dis_2', asignaturaId: 'asi_otra', estudiantes: [] }
];

test('NR-09.6 · usa el grupo configurado de la asignatura NeuroRitmo', () => {
  assert.equal(grupoParaRegistro({ asignaturaId: 'asi_neuro', grupoRegistroId: 'dis_1' }, grupos).id, 'dis_1');
  assert.throws(
    () => grupoParaRegistro({ asignaturaId: 'asi_neuro', grupoRegistroId: 'dis_2' }, grupos),
    (fallo) => fallo.estado === 503
  );
});

test('NR-09.6 · usa el único grupo de NeuroRitmo si no hay id configurado', () => {
  assert.equal(grupoParaRegistro({ asignaturaId: 'asi_neuro' }, grupos).id, 'dis_1');
  assert.throws(
    () => grupoParaRegistro({ asignaturaId: 'asi_neuro' }, [...grupos, { id: 'dis_3', asignaturaId: 'asi_neuro' }]),
    (fallo) => fallo.estado === 503
  );
});

test('NR-09.6 · añadir una matrícula es idempotente y conserva las existentes', () => {
  assert.deepEqual(estudiantesCon(['u1', 'u2'], 'u3'), ['u1', 'u2', 'u3']);
  assert.deepEqual(estudiantesCon(['u1', 'u2'], 'u2'), ['u1', 'u2']);
});
