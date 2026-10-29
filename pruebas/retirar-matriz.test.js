import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (ruta) => readFile(new URL(`../${ruta}`, import.meta.url), 'utf8');

test('NR-08.13 conserva el recurso y retira sus accesos visibles', async () => {
  const [config, explorar, inicio, pagina] = await Promise.all([
    leer('datos/config/neuroritmo.json'),
    leer('publico/js/modulos/explorar.js'),
    leer('publico/js/modulos/neuroritmo.js'),
    leer('publico/paginas/autodiagnostico-musical.html')
  ]);

  assert.equal(JSON.parse(config).recursos.matriz.url, '/paginas/autodiagnostico-musical.html');
  assert.match(pagina, /Matriz de Autodiagnóstico Musical/i);
  assert.match(explorar, /RECURSOS_SIN_ACCESO\.has\(clave\)/);
  assert.match(inicio, /clave !== 'matriz'/);
  assert.doesNotMatch(inicio, /Retoma tu .*matriz de autodiagnóstico musical/i);
});

test('NR-08.13 reorganiza las tarjetas de recursos sin columnas vacías', async () => {
  const css = await leer('publico/css/modulos/explorar.css');
  assert.match(css, /\.explorar-recursos-grid[\s\S]*repeat\(auto-fit,/);
});
