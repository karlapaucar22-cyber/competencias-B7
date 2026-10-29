import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { antesDeGuardar } from '../servidor/ganchos/agenda.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const leerJson = async (ruta) => JSON.parse(await readFile(path.join(raiz, ruta), 'utf8'));

test('la agenda NeuroRitmo inicia el 4 de noviembre y distingue las fechas propuestas', async () => {
  const agenda = await leerJson('datos/agenda.json');
  assert.equal(agenda.length, 6);
  assert.equal(agenda[0].inicio, '2026-11-04');
  assert.equal(agenda[0].todoElDia, true);
  assert.equal(agenda[0].estadoPlanificacion, 'confirmado');
  assert.deepEqual(agenda.slice(1).map((e) => e.estadoPlanificacion), [
    'propuesta', 'propuesta', 'propuesta', 'propuesta', 'pendiente-confirmacion'
  ]);
  assert.ok(agenda.slice(1).every((e) => e.recordatorios.length === 0));
  assert.ok(agenda.every((e) => e.responsable === 'Karla Paucar'));
  assert.deepEqual(agenda.map((e) => e.enlace), [
    '/index.html#instrucciones',
    '/paginas/explorar.html#ruta-academica',
    '/index.html#mision-m1',
    '/index.html#mision-m2',
    '/index.html#mision-m3',
    '/index.html#resultados'
  ]);
});

test('la semilla conserva exactamente el calendario académico', async () => {
  const [agenda, semilla] = await Promise.all([
    leerJson('datos/agenda.json'),
    leerJson('datos/semilla/agenda.json')
  ]);
  assert.deepEqual(semilla, agenda);
});

test('los hitos académicos y sus enlaces siguen protegidos en el servidor', async () => {
  const base = {
    titulo: 'Evento personal', tipo: 'recordatorio', inicio: '2026-11-04T09:00:00-05:00',
    fin: null, todoElDia: false, grupoId: null, actividad: null, temaId: null, recordatorios: []
  };
  const estudiante = { id: 'usu_000004', rol: 'estudiante' };
  await assert.rejects(
    antesDeGuardar({ ...base, estadoPlanificacion: 'propuesta' }, estudiante, null),
    (err) => err.estado === 403
  );
  await assert.rejects(
    antesDeGuardar({ ...base, enlace: 'https://ejemplo.invalid/' }, { id: 'usu_000001', rol: 'admin' }, null),
    (err) => err.estado === 400
  );
});

test('la atribución docente de NeuroRitmo corresponde a la cuenta real de Karla', async () => {
  const [usuarios, distributivo] = await Promise.all([
    leerJson('datos/usuarios.json'),
    leerJson('datos/distributivo.json')
  ]);
  const karla = usuarios.find((u) => u.id === 'usu_000003');
  assert.deepEqual({ nombre: karla.nombre, apellido: karla.apellido, rol: karla.rol }, {
    nombre: 'Karla', apellido: 'Paucar', rol: 'docente'
  });
  assert.equal(distributivo.find((g) => g.id === 'dis_000001').docenteId, 'usu_000003');
});
