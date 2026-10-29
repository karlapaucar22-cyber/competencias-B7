import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leer = (ruta) => fs.readFileSync(new URL(ruta, import.meta.url), 'utf8');
const avatar = leer('../publico/js/nucleo/avatar.js');
const recorrido = leer('../publico/js/modulos/neuroritmo.js');
const plantilla = leer('../publico/js/nucleo/plantilla.js');
const componentes = leer('../publico/css/componentes.css');

test('NR-06.3 · Neuri conserva transcripción y controles de voz optativa', () => {
  assert.match(avatar, /Transcripción de \$\{nombre\}/);
  assert.match(avatar, /avatar-guia__pausa/);
  assert.match(avatar, /speechSynthesis\.pause\(\)/);
  assert.match(avatar, /speechSynthesis\.resume\(\)/);
  assert.match(avatar, /leerPreferencia\(CLAVE_VOZ\) === 'activa'/);
  assert.doesNotMatch(avatar, /guardarPreferencia\(CLAVE_VOZ, 'silencio'\)/);
});

test('NR-08.3B · Neuri se monta globalmente y conserva voz, vista y transcripción', () => {
  assert.match(plantilla, /montarAvatar\(\{ personaje: 'neuri' \}\)/);
  assert.match(avatar, /CLAVE_VISTA = 'avatar\.vista'/);
  assert.match(avatar, /CLAVE_TEXTO = 'avatar\.texto'/);
  for (const estado of ['abierto', 'minimizado', 'oculto']) assert.ok(avatar.includes(`'${estado}'`));
  for (const control of ['avatar-guia__minimizar', 'avatar-guia__minimizado', 'avatar-guia__ocultar', 'avatar-guia__mostrar']) {
    assert.ok(avatar.includes(control), `Falta el control ${control}`);
  }
});

test('NR-08.3B · el panel reserva espacio y adapta su altura en móvil', () => {
  assert.match(componentes, /body\.avatar-guia-abierta #contenido/);
  assert.match(componentes, /body\.con-avatar-guia #contenido/);
  assert.match(componentes, /max-height: 56vh/);
  assert.match(componentes, /padding-bottom: 62vh/);
});

test('NR-06.3 · guía presentación, reglas, transiciones y cierres', () => {
  assert.doesNotMatch(recorrido, /soloVoz/);
  for (const texto of [
    'Centro de Estudio Sonoro',
    'toda decisión necesita una justificación',
    'Misión ${mision.numero}',
    'Continúa con el paso',
    'Última transición',
    '¡Misión superada!'
  ]) assert.ok(recorrido.includes(texto), `Falta el mensaje funcional: ${texto}`);
});

test('NR-06.3 · no se presenta el marcador MP3 como multimedia real', () => {
  const audio = fs.readFileSync(new URL('../publico/recursos/subidas/733d6bc26aeaaa7301c992e908c1cc6d.mp3', import.meta.url), 'utf8');
  assert.equal(audio, 'ID3 simulado');
  assert.ok(fs.existsSync(new URL('../publico/recursos/subidas/neuroritmo-mision-cerebro-sonoro.png', import.meta.url)));
});
