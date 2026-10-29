import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const leerJson = async (ruta) => JSON.parse(await readFile(path.join(raiz, ruta), 'utf8'));

test('la canción principal referencia el registro y el archivo reales sin duplicarlos', async () => {
  const [config, canciones] = await Promise.all([
    leerJson('datos/config/neuroritmo.json'),
    leerJson('datos/canciones.json')
  ]);
  const cancion = canciones.find((item) => item.id === config.cancionPrincipalId);
  assert.ok(cancion, 'el identificador principal debe existir en canciones.json');
  assert.equal(cancion.id, 'can_000001');
  assert.equal(canciones.filter((item) => item.audio === cancion.audio).length, 1);
  assert.ok(cancion.letra.trim());
  assert.ok(cancion.lrc.trim());
  assert.ok(cancion.autoria.trim());
  assert.ok(cancion.licencia.trim());

  const archivo = path.join(raiz, 'publico', cancion.audio.replace(/^\//, ''));
  const info = await stat(archivo);
  assert.ok(info.size > 1_000_000, 'el archivo no debe ser el marcador ID3 simulado');
});

test('la matriz ofrece una sola canción general y es la principal', async () => {
  const config = await leerJson('datos/config/neuroritmo.json');
  const m3 = config.misiones.find((mision) => mision.id === 'm3');
  const opcionesCancion = m3.recursosSonoros.filter((recurso) => /canci[oó]n/i.test(`${recurso.id} ${recurso.texto}`));
  assert.deepEqual(opcionesCancion.map((recurso) => recurso.id), ['cancion-principal']);
  assert.ok(m3.bloques.find((bloque) => bloque.id === 'b6').texto.includes('canción principal'));
});

test('Misión 2 conserva la actividad pendiente si la canción principal no cubre sus fases', async () => {
  const config = await leerJson('datos/config/neuroritmo.json');
  const item = config.misiones.find((mision) => mision.id === 'm2').items.find((actual) => actual.id === 'i2');
  assert.equal(item.estado, 'pendiente');
  assert.equal(item.audio, '');
  assert.deepEqual(item.lineas, []);
  assert.deepEqual(item.huecos, {});
});
