import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clavePreferenciaMenu, guardarPreferenciaMenu, leerPreferenciaMenu, siguienteEstadoMenu } from '../publico/js/nucleo/menu-adaptable.js';

const leer = (ruta) => readFile(new URL(ruta, import.meta.url), 'utf8');

test('NR-08.11 · el menú recorre expandido, contraído, oculto y vuelve a mostrarse', () => {
  assert.equal(siguienteEstadoMenu('expandido'), 'contraido');
  assert.equal(siguienteEstadoMenu('contraido'), 'oculto');
  assert.equal(siguienteEstadoMenu('oculto'), 'expandido');
});

test('NR-08.11 · la preferencia queda aislada por cuenta y rechaza estados inválidos', () => {
  const datos = new Map();
  const almacenamiento = {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, valor)
  };
  const estudiante = { id: 'usu_estudiante' };
  const otraCuenta = { id: 'usu_otra' };
  assert.equal(clavePreferenciaMenu(estudiante), 'menu.vista:usu_estudiante');
  assert.equal(leerPreferenciaMenu(estudiante, almacenamiento), 'contraido');
  guardarPreferenciaMenu(estudiante, 'oculto', almacenamiento);
  guardarPreferenciaMenu(otraCuenta, 'expandido', almacenamiento);
  guardarPreferenciaMenu(estudiante, 'invalido', almacenamiento);
  assert.equal(leerPreferenciaMenu(estudiante, almacenamiento), 'oculto');
  assert.equal(leerPreferenciaMenu(otraCuenta, almacenamiento), 'expandido');
});

test('NR-08.11 · plantilla y estilos conservan etiquetas, cajón móvil y convivencia con Neuri', async () => {
  const [plantilla, estilos] = await Promise.all([
    leer('../publico/js/nucleo/plantilla.js'),
    leer('../publico/css/base.css')
  ]);
  assert.match(plantilla, /montarMenuAdaptable/);
  assert.match(plantilla, /aria-label="\$\{escapar\(item\.texto\)\}"/);
  assert.match(plantilla, /id="btn-menu-cerrar"/);
  assert.match(estilos, /body\.menu-contraido/);
  assert.match(estilos, /body\.menu-oculto/);
  assert.match(estilos, /body\.menu-movil-abierto \.avatar-guia/);
  assert.match(estilos, /\.menu-lateral__cerrar/);
});

test('NR-08.15 · expansión temporal, fijación y nombres completos', async () => {
  const [control, plantilla, estilos] = await Promise.all([
    leer('../publico/js/nucleo/menu-adaptable.js'),
    leer('../publico/js/nucleo/plantilla.js'),
    leer('../publico/css/base.css')
  ]);
  assert.match(control, /pointermove/);
  assert.match(control, /pointerenter/);
  assert.match(control, /menu-temporal-expandido/);
  assert.match(plantilla, /id="btn-menu-fijar"/);
  assert.match(estilos, /body\.menu-contraido\.menu-temporal-expandido/);
  assert.match(estilos, /overflow-wrap: anywhere/);
});
