// pruebas/reglas-alertas.test.js
// Pruebas unitarias de datos/config/reglas-alertas.json (Anexo A y contrato §E)
// Ejecutar: npm test

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerConfig } from '../servidor/almacen.js';
import * as alertas from '../servidor/alertas.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = path.join(RAIZ, 'datos', 'config', 'reglas-alertas.json');
const MAX_MENSAJE = 500;   // mismo límite que POST /api/notificaciones

const bytes = await fs.readFile(RUTA);
const reglas = JSON.parse(bytes.toString('utf-8'));
const esEntero = (n, minimo) => Number.isInteger(n) && n >= minimo;

const ANEXO_A = {
  promedioBajo: { activa: true, umbral: 7, ultimos: 3 },
  fallosQuiz: { activa: true, veces: 3 },
  inactividad: { activa: true, dias: 7 },
  vencidas: { activa: true, diasGracia: 1 },
  mensajesApoyo: [
    'Vi que este tema te está costando. ¿Lo repasamos juntos? Estoy para ayudarte.',
    'Te extrañamos en la plataforma. Hay una actividad corta para retomar el ritmo.',
    '¡Buen esfuerzo! Repasa el tema y vuelve a intentarlo: vas por buen camino.'
  ]
};

describe('Archivo', () => {
  test('existe y es JSON válido', () => {
    assert.equal(typeof reglas, 'object');
    assert.ok(reglas && !Array.isArray(reglas));
  });

  test('está en UTF-8 sin BOM', () => {
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  });

  test('tiene exactamente las claves del contrato §E', () => {
    assert.deepEqual(Object.keys(reglas).sort(), ['fallosQuiz', 'inactividad', 'mensajesApoyo', 'promedioBajo', 'vencidas']);
  });

  test('coincide con el Anexo A', () => {
    assert.deepEqual(reglas, ANEXO_A);
  });

  test('el servidor lo lee igual con leerConfig()', async () => {
    assert.deepEqual(await leerConfig('reglas-alertas'), reglas);
  });
});

describe('Reglas', () => {
  for (const nombre of ['promedioBajo', 'fallosQuiz', 'inactividad', 'vencidas']) {
    test(`${nombre}: es un objeto con "activa" booleano`, () => {
      assert.equal(typeof reglas[nombre], 'object');
      assert.equal(typeof reglas[nombre].activa, 'boolean');
    });
  }

  test('promedioBajo.umbral está en la escala de notas (0 a 10]', () => {
    const { umbral } = reglas.promedioBajo;
    assert.equal(typeof umbral, 'number');
    assert.ok(umbral > 0 && umbral <= 10, `umbral = ${umbral}`);
  });

  test('promedioBajo.ultimos es un entero ≥ 1', () => {
    assert.ok(esEntero(reglas.promedioBajo.ultimos, 1));
  });

  test('fallosQuiz.veces es un entero ≥ 1', () => {
    assert.ok(esEntero(reglas.fallosQuiz.veces, 1));
  });

  test('inactividad.dias es un entero ≥ 1', () => {
    assert.ok(esEntero(reglas.inactividad.dias, 1));
  });

  test('vencidas.diasGracia es un entero ≥ 0', () => {
    assert.ok(esEntero(reglas.vencidas.diasGracia, 0));
  });

  test('no hay campos desconocidos en las reglas', () => {
    assert.deepEqual(Object.keys(reglas.promedioBajo).sort(), ['activa', 'ultimos', 'umbral']);
    assert.deepEqual(Object.keys(reglas.fallosQuiz).sort(), ['activa', 'veces']);
    assert.deepEqual(Object.keys(reglas.inactividad).sort(), ['activa', 'dias']);
    assert.deepEqual(Object.keys(reglas.vencidas).sort(), ['activa', 'diasGracia']);
  });
});

describe('Mensajes de apoyo', () => {
  const { mensajesApoyo } = reglas;

  test('es una lista con al menos un mensaje', () => {
    assert.ok(Array.isArray(mensajesApoyo) && mensajesApoyo.length >= 1);
  });

  test('cada mensaje es texto no vacío y sin espacios sobrantes', () => {
    for (const m of mensajesApoyo) {
      assert.equal(typeof m, 'string');
      assert.ok(m.trim().length > 0);
      assert.equal(m, m.trim());
    }
  });

  test(`cada mensaje cabe en una notificación (≤ ${MAX_MENSAJE} caracteres)`, () => {
    for (const m of mensajesApoyo) assert.ok(m.length <= MAX_MENSAJE, `${m.length} caracteres`);
  });

  test('no se repiten', () => {
    assert.equal(new Set(mensajesApoyo).size, mensajesApoyo.length);
  });

  test('no contienen HTML ni enlaces', () => {
    for (const m of mensajesApoyo) assert.doesNotMatch(m, /<[^>]+>|https?:\/\//);
  });

  test('conservan tildes y signos de apertura (codificación correcta)', () => {
    const todo = mensajesApoyo.join(' ');
    assert.match(todo, /está/);
    assert.match(todo, /¿/);
    assert.match(todo, /¡/);
    assert.doesNotMatch(todo, /Ã|Â/);   // texto mal decodificado
  });

  test('las preguntas abiertas con ¿ se cierran con ?', () => {
    for (const m of mensajesApoyo) {
      assert.equal((m.match(/¿/g) || []).length, (m.match(/\?/g) || []).length, m);
      assert.equal((m.match(/¡/g) || []).length, (m.match(/!/g) || []).length, m);
    }
  });
});

describe('Coherencia con el resto del sistema', () => {
  test('el umbral de promedio bajo no supera la nota de aprobación del quiz', async () => {
    const gamificacion = await leerConfig('reglas-gamificacion');
    const aprobacion = gamificacion.quiz.porcentajeAprobacion / 10;   // 70 % → 7 sobre 10
    assert.ok(reglas.promedioBajo.umbral <= aprobacion, `umbral ${reglas.promedioBajo.umbral} > aprobación ${aprobacion}`);
  });

  test('servidor/alertas.js expone evaluarAlertas y evaluarInactividad', () => {
    assert.equal(typeof alertas.evaluarAlertas, 'function');
    assert.equal(typeof alertas.evaluarInactividad, 'function');
  });

  test('evaluarAlertas ignora intentos que no son de estudiantes o no tienen tema', async () => {
    const intento = { usuarioId: 'usu_000002', actividad: 'quiz', temaId: 'tem_000001', puntaje: 3, maximo: 10 };
    assert.equal(await alertas.evaluarAlertas(intento, { id: 'usu_000002', rol: 'docente' }), null);
    assert.equal(await alertas.evaluarAlertas({ ...intento, temaId: null }, { id: 'usu_000004', rol: 'estudiante' }), null);
  });

  test('evaluarInactividad de un grupo inexistente devuelve una lista vacía', async () => {
    assert.deepEqual(await alertas.evaluarInactividad('dis_999999'), []);
  });
});
