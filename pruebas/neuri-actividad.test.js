// pruebas/neuri-actividad.test.js
// NR-08.5 · Neuri en actividades complementarias: permisos, contexto del servidor, soluciones protegidas
// y separación de las misiones evaluadas

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import preparar, { ACTIVIDADES } from '../servidor/preparadores/neuri-actividad.js';
import { validarTexto, tieneControlTexto } from '../servidor/esquemas-ia.js';
import { formatoDe } from '../servidor/ia.js';

const leer = (col) => JSON.parse(fs.readFileSync(new URL(`../datos/${col}.json`, import.meta.url), 'utf8'));
const usuarios = leer('usuarios');
const estudiante = usuarios.find((u) => u.id === 'usu_000004');
const docente = usuarios.find((u) => u.rol === 'docente');
const termino = leer('glosario').find((g) => g.temaId === 'tem_000001' && g.termino === 'CORTEX');
const otro = leer('glosario').find((g) => g.temaId === 'tem_000001' && g.id !== termino.id);
const ajeno = leer('glosario').find((g) => g.temaId !== 'tem_000001');
const sim = leer('simulaciones').find((s) => s.modo === 'escenarios' && s.estado === 'publicado');
const plantilla = fs.readFileSync(new URL('../servidor/prompts/neuri-actividad.txt', import.meta.url), 'utf8');
const rechaza = (promesa, estado) => assert.rejects(promesa, (e) => e.estado === estado);
const base = { temaId: 'tem_000001', terminoId: termino.id };

describe('NR-08.5 · Neuri en actividades complementarias', () => {
  test('seis actividades, sin las misiones evaluadas', () => {
    assert.deepEqual(Object.keys(ACTIVIDADES).sort(), ['ahorcado', 'crucigrama', 'pareja', 'quiz', 'simulador', 'sopa-letras']);
    for (const m of ['m1', 'm2', 'm3', 'neuroritmo']) assert.ok(!ACTIVIDADES[m]);
    assert.equal(formatoDe('neuri-actividad'), 'texto');
    assert.ok(tieneControlTexto('neuri-actividad'));
  });

  test('permisos: solo estudiantes, actividad y modo válidos, tema propio', async () => {
    await rechaza(preparar({ ...base, actividad: 'ahorcado', modo: 'pista', nivel: 1 }, docente), 403);
    await rechaza(preparar({ ...base, actividad: 'm1', modo: 'pista', nivel: 1 }, estudiante), 400);
    await rechaza(preparar({ ...base, actividad: 'ahorcado', modo: 'borrador' }, estudiante), 400);
    await rechaza(preparar({ ...base, actividad: 'ahorcado', modo: 'pista', nivel: 4 }, estudiante), 400);
    await rechaza(preparar({ ...base, actividad: 'ahorcado', modo: 'pista', nivel: 1, terminoId: ajeno.id }, estudiante), 404);
    await rechaza(preparar({ ...base, actividad: 'ahorcado', modo: 'pista', nivel: 1, temaId: 'tem_000012' }, estudiante), 404);
  });

  test('ahorcado y crucigrama: la palabra queda prohibida en la respuesta y no se envía como dato', async () => {
    for (const actividad of ['ahorcado', 'crucigrama']) {
      const r = await preparar({ ...base, actividad, modo: 'pista', nivel: 2 }, estudiante);
      assert.deepEqual(r.__control.prohibidos, ['cortex']);
      assert.ok(!/CORTEX/i.test(`${r.item} ${r.situacion} ${r.respuesta}`), actividad);
      assert.match(r.ayuda, /nivel 2/);
    }
    await rechaza(preparar({ ...base, actividad: 'ahorcado', modo: 'error' }, estudiante), 400);
    const e = await preparar({ ...base, actividad: 'ahorcado', modo: 'error', erradas: 'aszz<script>' }, estudiante);
    assert.match(e.respuesta, /no están: A, S, Z, C, R, I, P, T\./);
    await rechaza(preparar({ ...base, actividad: 'crucigrama', modo: 'error', intento: 'CORTEX' }, estudiante), 400);
    await rechaza(preparar({ ...base, actividad: 'crucigrama', modo: 'error', intento: 'COR' }, estudiante), 400);
    assert.match((await preparar({ ...base, actividad: 'crucigrama', modo: 'error', intento: 'CORTEZ' }, estudiante)).respuesta, /CORTEZ/);
  });

  test('pareja y sopa de letras: contexto del glosario del servidor', async () => {
    const p = await preparar({ ...base, actividad: 'pareja', modo: 'error', otroId: otro.id }, estudiante);
    // El nombre del otro término no llega al modelo y queda prohibido en la respuesta
    assert.equal(p.__control.prohibidos.length, 3);
    assert.ok(!`${p.base} ${p.respuesta} ${p.item}`.includes(otro.termino));
    await rechaza(preparar({ ...base, actividad: 'pareja', modo: 'error', otroId: termino.id }, estudiante), 400);
    const s = await preparar({ ...base, actividad: 'sopa-letras', modo: 'error', seleccion: 'cor' }, estudiante);
    assert.match(s.respuesta, /COR/);
    await rechaza(preparar({ ...base, actividad: 'sopa-letras', modo: 'error', seleccion: 'co' }, estudiante), 400);
  });

  test('simulador: no revela la mejor decisión y solo explica decisiones desfavorables', async () => {
    const escena = sim.escenas.find((e) => e.opciones?.some((o) => o.puntos <= 0) && e.opciones.some((o) => o.puntos > 0));
    const datos = { actividad: 'simulador', simulacionId: sim.id, escena: escena.id };
    const r = await preparar({ ...datos, modo: 'pista', nivel: 1 }, estudiante);
    assert.ok(r.__control.prohibidos.includes('primera opcion'));
    const mala = escena.opciones.findIndex((o) => o.puntos <= 0);
    const buena = escena.opciones.findIndex((o) => o.puntos > 0);
    assert.match((await preparar({ ...datos, modo: 'error', opcion: mala }, estudiante)).respuesta, /Eligió/);
    await rechaza(preparar({ ...datos, modo: 'error', opcion: buena }, estudiante), 400);
    await rechaza(preparar({ ...datos, simulacionId: 'sim_inexistente', modo: 'pista', nivel: 1 }, estudiante), 404);
  });

  test('control de salida: sin palabra oculta (ni deletreada), sin citas ni posición de la opción', () => {
    const control = { maxPalabras: 90, prohibidos: ['cortex', 'capa externa de sustancia gris cerebral', 'primera opcion'] };
    const buena = 'Vas bien con la C. ¿Qué parte del cerebro procesa lo que escuchas de forma más compleja? Piensa en su ubicación.';
    assert.equal(validarTexto('neuri-actividad', buena, control), buena);
    for (const mala of [
      'La palabra es córtex.', 'Se escribe C-O-R-T-E-X.', 'Es la capa externa, de sustancia gris cerebral.',
      'Te conviene la primera opción.', 'La respuesta correcta es la b.', 'Esto mejora tu puntaje.',
      'Vas bien. ¿Qué concepto describe la pista? ¿Qué función cumple?', '¿Qué concepto describe la pista?'
    ]) assert.throws(() => validarTexto('neuri-actividad', mala, control), (e) => e.estado === 502, mala);
  });

  test('la plantilla es socrática y no recibe datos personales', () => {
    assert.match(plantilla, /Nunca reveles la solución/);
    assert.match(plantilla, /no forma parte de las tres misiones evaluadas/);
    assert.match(plantilla, /2 a 4 frases/);
    assert.ok(!/\{\{(nombre|correo|usuario|usuarioId)\}\}/.test(plantilla));
  });

  test('la integración recupera preparadores y conserva respaldo ante una tarea ausente', async () => {
    const [motor, ayuda] = await Promise.all([
      fs.promises.readFile(new URL('../servidor/ia.js', import.meta.url), 'utf8'),
      fs.promises.readFile(new URL('../publico/js/nucleo/ayuda-neuri.js', import.meta.url), 'utf8')
    ]);
    assert.match(motor, /await cargarPreparador\(tarea\)/);
    assert.match(motor, /Promise\.all\(archivos\.map/);
    assert.match(ayuda, /tareaNoDisponible/);
    assert.match(ayuda, /mostrar\(\{ origen: 'predefinida'/);
  });

  test('ahorcado, cuestionario, parejas y simulador reutilizan el mismo panel de Neuri', async () => {
    const modulos = await Promise.all(['ahorcado', 'quiz', 'pareja', 'simulador'].map((nombre) =>
      fs.promises.readFile(new URL(`../publico/js/modulos/${nombre}.js`, import.meta.url), 'utf8')));
    for (const fuente of modulos) {
      assert.match(fuente, /montarAyudaNeuri/);
      assert.match(fuente, /contextoNeuri|actividad: 'ahorcado'/);
    }
  });
});
