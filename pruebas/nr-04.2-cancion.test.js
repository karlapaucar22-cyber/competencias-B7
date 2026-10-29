import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { corregirItem, versionPublica } from '../servidor/rutas/neuroritmo.js';

const experiencia = JSON.parse(fs.readFileSync(new URL('../datos/config/neuroritmo.json', import.meta.url), 'utf8'));
const item = (m, i) => experiencia.misiones.find((x) => x.id === m).items.find((x) => x.id === i);

describe('NR-04.2 · Canción de las fases de la memoria', () => {
  const pendiente = item('m2', 'i2');
  const publicada = {
    ...pendiente, estado: 'publicado', audio: '/recurso-autorizado.mp3', autoria: 'Autoría verificada', licencia: 'Licencia verificada',
    lineas: ['{{1}} {{2}} {{3}} {{4}}'], banco: ['codificar', 'consolidar', 'recuperar', 'espaciado', 'releer'],
    huecos: { 1: 'codificar', 2: 'consolidar', 3: 'recuperar', 4: 'espaciado' },
    explicacion: 'La melodía actúa como pista de recuperación del orden.'
  };

  test('No publica audio ni letra inexistentes y muestra el estado pendiente exacto', () => {
    const i2 = versionPublica(experiencia).misiones.find((m) => m.id === 'm2').items.find((i) => i.id === 'i2');
    assert.equal(i2.estado, 'pendiente');
    assert.equal(i2.estadoMensaje, 'Pendiente de integrar audio y letra autorizados');
    assert.ok(!('audio' in i2) && !('lineas' in i2) && !('banco' in i2));
    assert.throws(() => corregirItem(pendiente, { palabras: {} }), (e) => e.estado === 409);
  });

  test('El MP3 catalogado no es un audio real utilizable', () => {
    const ruta = new URL('../publico/recursos/subidas/733d6bc26aeaaa7301c992e908c1cc6d.mp3', import.meta.url);
    assert.equal(fs.readFileSync(ruta, 'utf8'), 'ID3 simulado');
  });

  test('La interfaz preparada registra correctas, errores y feedback palabra a palabra cuando haya material autorizado', () => {
    const r = corregirItem(publicada, { palabras: { 1: 'CODIFICAR', 2: 'releer', 3: 'recuperar', 4: 'releer' } });
    assert.equal(r.puntos, 8);
    assert.deepEqual([r.valor.correctas, r.valor.errores], [2, 2]);
    assert.deepEqual(r.retro.porPalabra, { '1': true, '2': false, '3': true, '4': false });
    assert.equal(r.retro.detallePalabras['2'].correcta, false);
    assert.match(r.retro.detallePalabras['2'].mensaje, /respuesta autorizada/i);
    assert.match(r.retro.explicacion, /pista de recuperación/i);
  });
});
