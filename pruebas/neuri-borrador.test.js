// pruebas/neuri-borrador.test.js
// NR-05.3 · «Revisa mi borrador»: entrada sin datos personales y salida con una fortaleza y dos mejoras, sin puntos

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validarSalida } from '../servidor/esquemas-ia.js';
import { anonimizar, entradaBorrador } from '../servidor/preparadores/neuri-borrador.js';

const experiencia = JSON.parse(fs.readFileSync(new URL('../datos/config/neuroritmo.json', import.meta.url), 'utf8'));
const m3 = experiencia.misiones.find((m) => m.id === 'm3');
const plantilla = fs.readFileSync(new URL('../servidor/prompts/neuri-borrador.txt', import.meta.url), 'utf8');
const valida = {
  fortaleza: { aspecto: 'objetivo', texto: 'Tu objetivo usa un verbo observable y se puede verificar al final.' },
  mejoras: [
    { aspecto: 'Diversidad individual', texto: '¿Qué alternativa darías a quien se concentra mejor en silencio?' },
    { aspecto: 'comprobación', texto: '¿Cómo sabrás si cada estudiante puede explicar los tres conceptos sin apoyo?' }
  ]
};

describe('NR-05.3 · Revisa mi borrador', () => {
  test('acepta una fortaleza y dos mejoras y normaliza los aspectos', () => {
    const r = validarSalida('neuri-borrador', valida);
    assert.deepEqual([r.fortaleza.aspecto, ...r.mejoras.map((m) => m.aspecto)], ['objetivo', 'diversidad', 'comprobacion']);
  });

  test('rechaza salidas que califican, reescriben o no tienen la forma pedida', () => {
    const con = (cambio) => () => validarSalida('neuri-borrador', { ...valida, ...cambio });
    const err = (e) => e.estado === 502;
    assert.throws(con({ mejoras: [valida.mejoras[0]] }), err, 'una sola mejora');
    assert.throws(con({ mejoras: [...valida.mejoras, valida.mejoras[0]] }), err, 'tres mejoras');
    assert.throws(con({ fortaleza: { aspecto: 'ortografia', texto: 'Bien escrito.' } }), err, 'aspecto ajeno');
    assert.throws(con({ fortaleza: { aspecto: 'objetivo', texto: 'Tu diseño merece 85/100.' } }), err, 'asigna puntaje');
    assert.throws(con({ fortaleza: { aspecto: 'objetivo', texto: 'Obtendrías buenos puntos con este objetivo.' } }), err, 'habla de puntos');
    const reescrito = 'Cambia tu objetivo por: «Al finalizar la sesión cada estudiante explicará con sus palabras los tres conceptos de la unidad usando un ejemplo propio»';
    assert.throws(con({ mejoras: [valida.mejoras[0], { aspecto: 'objetivo', texto: reescrito }] }), err, 'reescribe el trabajo');
    assert.throws(() => validarSalida('neuri-borrador', 'texto libre'), err);
  });

  test('anonimizar quita correos, números largos y el nombre del estudiante', () => {
    const t = anonimizar('Soy Margareth Llive (margareth@unemi.edu.ec, 0991234567) y propongo explicar.', ['Margareth', 'Llive']);
    assert.ok(!/margareth|llive|@|0991234567/i.test(t), t);
    assert.match(t, /\[nombre omitido\].*\[correo omitido\].*\[número omitido\]/);
    assert.equal(anonimizar('Duración de 5 a 10 minutos'), 'Duración de 5 a 10 minutos');
  });

  test('la entrada al modelo solo contiene la microactividad y los criterios del docente', () => {
    const e = entradaBorrador({
      objetivo: 'Explicar los tres conceptos; escribir a ana.perez@correo.com', nombre: 'Ana Pérez', correo: 'ana.perez@correo.com',
      cedula: '0912345678', recurso: { tipo: 'instrumental', volumen: 'bajo', letra: 'no', duracion: 3 }, secuencia: ['b1', 'b2']
    }, m3, ['Ana', 'Pérez']);
    const todo = JSON.stringify(e);
    assert.ok(!/ana|pérez|perez|@|0912345678/i.test(todo), todo);
    assert.match(e.borrador, /Objetivo: Explicar los tres conceptos/);
    assert.equal(e.criterios.split('\n').length, m3.rubrica.length);
    assert.match(e.cotejo, /[✔✖]/);
    assert.equal(e.vacio, false);
    assert.equal(entradaBorrador({ nombre: 'Ana' }, m3).vacio, true);
  });

  test('la plantilla no pide datos personales ni puntajes y exige una fortaleza y dos mejoras', () => {
    const variables = [...plantilla.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(variables)].sort(), ['base', 'borrador', 'caso', 'cotejo', 'criterios', 'mision']);
    assert.match(plantilla, /UNA fortaleza y DOS aspectos de mejora/);
    assert.match(plantilla, /No reescribas el trabajo/);
    assert.match(plantilla, /No asignes puntos/);
    for (const a of ['objetivo', 'viabilidad', 'diversidad', 'comprobacion']) assert.ok(plantilla.includes(`"${a}"`), a);
  });
});
