import test from 'node:test';
import assert from 'node:assert/strict';
import { fusionarListas } from '../despliegue/preparar-render.mjs';

test('la sincronización agrega registros ausentes sin sobrescribir los existentes', () => {
  const actuales = [{ id: 'tem_1', titulo: 'Editado por docente' }];
  const iniciales = [{ id: 'tem_1', titulo: 'Inicial' }, { id: 'tem_2', titulo: 'Nuevo' }];
  const { resultado, cambios } = fusionarListas(actuales, iniciales, 'temas');
  assert.equal(cambios, 1);
  assert.equal(resultado[0].titulo, 'Editado por docente');
  assert.equal(resultado[1].titulo, 'Nuevo');
});

test('la sincronización une matrículas sin duplicarlas', () => {
  const actuales = [{ id: 'dis_1', estudiantes: ['usu_1', 'usu_2'] }];
  const iniciales = [{ id: 'dis_1', estudiantes: ['usu_2', 'usu_3'] }];
  const { resultado, cambios } = fusionarListas(actuales, iniciales, 'distributivo');
  assert.equal(cambios, 1);
  assert.deepEqual(resultado[0].estudiantes, ['usu_1', 'usu_2', 'usu_3']);
});
