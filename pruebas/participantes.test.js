import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { construirParticipantes } from '../servidor/rutas/participantes.js';

const leerJson = async (ruta) => JSON.parse(await readFile(new URL(ruta, import.meta.url), 'utf8'));

async function datosReales() {
  const [asignaturas, distributivo, usuarios] = await Promise.all([
    leerJson('../datos/asignaturas.json'),
    leerJson('../datos/distributivo.json'),
    leerJson('../datos/usuarios.json')
  ]);
  return { asignaturas, distributivo, usuarios };
}

test('NR-08.16 · muestra a Karla y los ocho estudiantes matriculados sin datos sensibles', async () => {
  const datos = await datosReales();
  const vista = construirParticipantes({
    asignaturaId: 'asi_000001',
    usuario: { id: 'usu_000009', rol: 'estudiante' },
    ...datos
  });
  const grupo = datos.distributivo.find((item) => item.id === 'dis_000001');
  const inscritosActivos = grupo.estudiantes.filter((id) => datos.usuarios.some((usuario) => usuario.id === id && usuario.rol === 'estudiante' && usuario.activo !== false));
  assert.equal(vista.docente.nombre, 'Karla Paucar');
  assert.equal(vista.totalEstudiantes, inscritosActivos.length);
  assert.equal(vista.totalEstudiantes, 8);
  assert.equal(vista.estudiantes.length, inscritosActivos.length);
  assert.deepEqual(vista.estudiantes.map((persona) => persona.nombre).sort((a, b) => a.localeCompare(b, 'es')), [
    'Felipe Arévalo', 'Antonella Chica', 'Michelle Cruzatti', 'Margareth Llive',
    'Mirka Peralta', 'Juan Pérez', 'Aidee Tipanluisa', 'Prueba NR028'
  ].sort((a, b) => a.localeCompare(b, 'es')));
  assert.deepEqual(Object.keys(vista.docente).sort(), ['foto', 'nombre', 'rol']);
  assert.equal(vista.docente.rol, 'docente');
  assert.ok(vista.estudiantes.every((persona) => Object.keys(persona).sort().join(',') === 'foto,nombre,rol' && persona.rol === 'estudiante'));
  assert.ok(!JSON.stringify(vista).match(/correo|telefono|clave|consentimiento/i));
});

test('NR-08.16 · el resultado cambia con el distributivo y bloquea a personas ajenas', async () => {
  const datos = await datosReales();
  const grupo = datos.distributivo.find((item) => item.id === 'dis_000001');
  const reducido = datos.distributivo.map((item) => item.id === grupo.id
    ? { ...item, estudiantes: item.estudiantes.slice(0, -1) }
    : item);
  const usuario = { id: grupo.estudiantes[0], rol: 'estudiante' };
  const vista = construirParticipantes({ asignaturaId: 'asi_000001', usuario, ...datos, distributivo: reducido });
  assert.equal(vista.totalEstudiantes, grupo.estudiantes.length - 1);
  assert.throws(() => construirParticipantes({
    asignaturaId: 'asi_000001',
    usuario: { id: 'usu_ajeno', rol: 'estudiante' },
    ...datos
  }), (error) => error.estado === 403);
});

test('NR-08.12 · Participantes aparece únicamente en el menú estudiantil', async () => {
  const menu = await readFile(new URL('../publico/js/nucleo/menu.js', import.meta.url), 'utf8');
  assert.match(menu, /texto: "Participantes"[\s\S]*?roles: \["estudiante"\][\s\S]*?grupo: "Comunidad"/);
});
