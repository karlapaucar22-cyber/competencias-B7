import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const temas = JSON.parse(await readFile(path.join(raiz, 'datos/temas.json'), 'utf8'));

test('tem_000001 conserva el screencast e integra el video original', () => {
  const tema = temas.find((item) => item.id === 'tem_000001');
  assert.ok(tema);
  assert.equal(tema.recursos.some((recurso) => /ejemplo-neurosonoro/.test(recurso.url)), false);
  assert.ok(tema.recursos.some((recurso) => recurso.url === 'https://view.genially.com/6aca29b16ddf6a28c8dadcaf'));
  assert.ok(tema.recursos.some((recurso) => recurso.url === '/paginas/recurso-neurociencia.html'));
  const video = tema.recursos.find((recurso) => recurso.tipo === 'video');
  assert.ok(video);
  assert.equal(video.estado, 'disponible');
  assert.equal(video.url, '/api/recursos-didacticos/funciones-ejecutivas');
});

test('tem_000002 integra el audio original disponible', () => {
  const tema = temas.find((item) => item.id === 'tem_000002');
  const audio = tema.recursos.find((recurso) => recurso.tipo === 'audio');
  assert.equal(audio.estado, 'disponible');
  assert.equal(audio.url, '/api/recursos-didacticos/musica-cerebro');
  assert.match(audio.detalle, /M4A original/i);
});

test('la alternativa HTML/CSS/JS existe como módulo completo', async () => {
  await Promise.all([
    access(path.join(raiz, 'publico/paginas/recurso-neurociencia.html')),
    access(path.join(raiz, 'publico/css/modulos/recurso-neurociencia.css')),
    access(path.join(raiz, 'publico/js/modulos/recurso-neurociencia.js'))
  ]);
});
