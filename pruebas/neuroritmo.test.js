// pruebas/neuroritmo.test.js
// Pruebas de NeuroRitmo: reglas compartidas (publico/js/nucleo/neuroritmo.js), banco de misiones y corrección por ítem

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as reglas from '../publico/js/nucleo/neuroritmo.js';
import { corregirItem, validarDiseno, validarJustificacion, versionPublica } from '../servidor/rutas/neuroritmo.js';

const experiencia = JSON.parse(fs.readFileSync(new URL('../datos/config/neuroritmo.json', import.meta.url), 'utf8'));
const mision = (id) => experiencia.misiones.find((m) => m.id === id);
const item = (m, i) => mision(m).items.find((x) => x.id === i);
const intento = (m, puntaje, extra = {}) => ({ actividad: 'neuroritmo', puntaje, maximo: 100, detalle: { mision: m, ...extra } });
const cancionPublicadaDePrueba = {
  ...item('m2', 'i2'), estado: 'publicado',
  huecos: { 1: 'codificar', 2: 'consolidar', 3: 'recuperar', 4: 'espaciado' },
  explicacion: 'La melodía actúa como pista de recuperación del orden.'
};

describe('Banco de misiones (Tarea 3)', () => {
  test('3 misiones; M1 y M2 con 4 ítems de 15 puntos y justificación de 40', () => {
    assert.equal(experiencia.misiones.length, 3);
    for (const id of ['m1', 'm2']) {
      const m = mision(id);
      assert.equal(m.items.length, 4);
      const maxItems = m.items.reduce((s, i) => s + (i.tipo === 'opcion' ? Math.max(...i.opciones.map((o) => o.puntos))
        : i.tipo === 'simulador' ? Math.max(...Object.values(i.configuraciones).map((c) => c.puntos)) : 15), 0);
      assert.equal(maxItems, 60);
      const dos = [...m.justificacion.tarjetas].sort((a, b) => b.puntos - a.puntos).slice(0, 2);
      assert.equal(dos.reduce((s, t) => s + t.puntos, 0) + 10, 40);
      m.items.forEach((i) => assert.equal(i.pistas.length, 3, `${id}-${i.id} con tres niveles de pista`));
    }
    assert.equal(mision('m3').rubrica.reduce((s, c) => s + c.maximo, 0), 100);
    assert.equal(mision('m3').rubrica.find((c) => c.id === 'c4').maximo, 40);
  });

  test('M1 tiene tres simulaciones y quiz; M2 conserva seis parejas y la canción pendiente sin contenido ficticio', () => {
    assert.deepEqual(mision('m1').items.map((i) => i.tipo), ['simulador', 'simulador', 'simulador', 'opcion']);
    assert.equal(item('m2', 'i1').pares.length, 6);
    const cancion = item('m2', 'i2');
    assert.equal(cancion.estado, 'pendiente');
    assert.match(cancion.estadoMensaje, /pendiente de integrar audio y letra autorizados/i);
    assert.equal(cancion.audio, '');
    assert.deepEqual(cancion.lineas, []);
    assert.deepEqual(cancion.huecos, {});
    const publica = versionPublica(experiencia).misiones.find((m) => m.id === 'm2').items.find((i) => i.id === 'i2');
    assert.equal(publica.estado, 'pendiente');
    assert.ok(!('audio' in publica) && !('lineas' in publica) && !('banco' in publica));
  });

  test('M1 presenta las tres rutas de caso con las mismas variables y sin audio', () => {
    const casos = mision('m1').items.slice(0, 3);
    assert.match(casos[0].situacion, /artículo científico denso/i);
    assert.match(casos[1].situacion, /ordenar alfabéticamente.*referencias bibliográficas/i);
    assert.match(casos[2].situacion, /examen oral.*tensión \(4 de 5\)/i);
    const variables = ['silencio', 'instrumental-bajo', 'instrumental-medio', 'letra-bajo', 'letra-medio'];
    casos.forEach((caso) => {
      assert.deepEqual(Object.keys(caso.configuraciones), variables);
      assert.doesNotMatch(JSON.stringify(caso), /audio|\.mp3/i);
    });
    assert.match(mision('m1').aviso, /modelo educativo.*no una predicción individual/i);
  });

  test('Los recursos enlazados son los de la Tarea 2 (Genially/Canva del equipo)', () => {
    assert.equal(experiencia.recursos.screencast.url, 'https://view.genially.com/6aca29b16ddf6a28c8dadcaf');
    assert.equal(experiencia.recursos.infografia.url, 'https://view.genially.com/6ac9441095a03db4389b6f2f');
  });

  test('La matriz interactiva usa una ruta interna propia y no duplica otro recurso', () => {
    assert.equal(experiencia.recursos.matriz.estado, 'disponible');
    assert.equal(experiencia.recursos.matriz.url, '/paginas/autodiagnostico-musical.html');
    const urls = Object.values(experiencia.recursos).map((r) => r.url).filter(Boolean);
    assert.equal(new Set(urls).size, urls.length);
  });

  test('La versión pública no expone puntos, configuraciones, huecos ni pistas', () => {
    const texto = JSON.stringify(versionPublica(experiencia));
    for (const clave of ['"puntos"', 'configuraciones', 'huecos', '"pistas"', '"retro"']) assert.ok(!texto.includes(clave), clave);
  });

  test('M1 conserva cuatro ítems y el quiz público no revela corrección', () => {
    const m1 = mision('m1');
    assert.equal(m1.items.length, 4);
    const quiz = m1.items[3];
    assert.equal(quiz.tipo, 'opcion');
    assert.deepEqual(quiz.opciones.map((o) => o.texto), [
      'Atención selectiva', 'Memoria de trabajo', 'Control inhibitorio', 'Regulación de la activación'
    ]);
    const quizPublico = versionPublica(experiencia).misiones.find((m) => m.id === 'm1').items[3];
    quizPublico.opciones.forEach((opcion) => assert.deepEqual(Object.keys(opcion).sort(), ['id', 'texto']));
  });

  test('M2 usa exactamente los seis conceptos docentes en el módulo de parejas', () => {
    const parejas = item('m2', 'i1');
    assert.equal(parejas.tipo, 'parejas');
    assert.deepEqual(parejas.pares.map((p) => p.concepto), [
      'Codificación', 'Consolidación', 'Recuperación', 'Repetición espaciada', 'Memoria de trabajo', 'Pista de recuperación'
    ]);
    parejas.pares.forEach((par) => assert.ok(par.definicion.length > 60, `${par.concepto} necesita definición o ejemplo`));
    assert.doesNotMatch(JSON.stringify(mision('m2')), /ahorcado|sopa de letras|crucigrama/i);
  });
});

describe('Corrección por ítem', () => {
  const hip = 'Creo que esta condición conviene para la tarea';
  test('Simulador: silencio en lectura = 15 y favorable; letra a volumen medio = 0', () => {
    const a = corregirItem(item('m1', 'i1'), { hipotesis: hip, prediccion: 'favorable', config: { tipo: 'silencio' } });
    assert.equal(a.puntos, 15);
    assert.equal(a.retro.coincide, true);
    assert.equal(corregirItem(item('m1', 'i1'), { hipotesis: hip, prediccion: 'favorable', config: { tipo: 'letra', volumen: 'medio' } }).puntos, 0);
  });
  test('Las tres rutas registran hipótesis y configuración y devuelven explicación docente', () => {
    const rutas = [
      ['i1', { tipo: 'silencio' }, 'favorable'],
      ['i2', { tipo: 'instrumental', volumen: 'bajo' }, 'favorable'],
      ['i3', { tipo: 'instrumental', volumen: 'bajo' }, 'favorable']
    ];
    rutas.forEach(([id, config, prediccion]) => {
      const r = corregirItem(item('m1', id), { hipotesis: `Para el caso ${id} esta condición resulta adecuada`, config, prediccion });
      assert.equal(r.valor.hipotesis, `Para el caso ${id} esta condición resulta adecuada`);
      assert.deepEqual(r.valor.config, { ...config, volumen: config.tipo === 'silencio' ? null : config.volumen });
      assert.equal(r.valor.prediccion, prediccion);
      assert.equal(r.retro.resultado, 'favorable');
      assert.ok(r.retro.explicacion.length > 100);
    });
  });
  test('Simulador exige hipótesis, configuración y predicción', () => {
    assert.throws(() => corregirItem(item('m1', 'i1'), { hipotesis: 'corta', prediccion: 'favorable', config: { tipo: 'silencio' } }), (e) => e.estado === 400);
    assert.throws(() => corregirItem(item('m1', 'i1'), { hipotesis: hip, prediccion: 'favorable', config: { tipo: 'letra' } }), (e) => e.estado === 400);
    assert.throws(() => corregirItem(item('m1', 'i1'), { hipotesis: hip, config: { tipo: 'silencio' } }), (e) => e.estado === 400);
  });
  test('Quiz situacional distingue las cuatro funciones y se corrige en servidor', () => {
    const quiz = item('m1', 'i4');
    const resultados = Object.fromEntries(quiz.opciones.map((opcion) => [opcion.texto, corregirItem(quiz, { opcion: opcion.id }).puntos]));
    assert.deepEqual(resultados, {
      'Atención selectiva': 0,
      'Memoria de trabajo': 15,
      'Control inhibitorio': 0,
      'Regulación de la activación': 0
    });
  });
  test('Canción: acepta mayúsculas y tildes; 3 de 4 = 11', () => {
    const r = corregirItem(cancionPublicadaDePrueba, { palabras: { 1: 'CODIFICAR', 2: 'consolidar', 3: 'releer', 4: 'Espaciado' } });
    assert.equal(r.puntos, 11);
    assert.equal(r.retro.porPalabra['3'], false);
    assert.equal(r.valor.correctas, 3);
    assert.equal(r.valor.errores, 1);
    assert.equal(r.retro.correctas, 3);
    assert.equal(r.retro.errores, 1);
    assert.match(r.retro.explicacion, /pista de recuperación/i);
    assert.match(r.retro.revisar, /pista de recuperación/i);
  });
  test('Canción: 4 de 4 = 15 puntos, registra 4 correctas y 0 errores', () => {
    const r = corregirItem(cancionPublicadaDePrueba, { palabras: { 1: 'codificar', 2: 'consolidar', 3: 'recuperar', 4: 'espaciado' } });
    assert.equal(r.puntos, 15);
    assert.equal(r.valor.correctas, 4);
    assert.equal(r.valor.errores, 0);
    assert.equal(r.retro.correctas, 4);
    assert.equal(r.retro.errores, 0);
    assert.equal(r.retro.revisar, '');
    assert.equal(r.retro.detallePalabras['1'].correcta, true);
  });
  test('Canción pendiente rechaza respuestas y no finge publicación', () => {
    assert.throws(() => corregirItem(item('m2', 'i2'), { palabras: {} }), (e) => e.estado === 409 && /pendiente/i.test(e.message));
  });
  test('Parejas: deben formarse las seis', () => {
    assert.throws(() => corregirItem(item('m2', 'i1'), { pares: ['p1'], errores: 0 }), (e) => e.estado === 400);
    assert.equal(corregirItem(item('m2', 'i1'), { pares: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], errores: 0 }).puntos, 15);
  });
  test('Parejas: registra confusiones por concepto y limita la penalización', () => {
    const parejas = item('m2', 'i1');
    const valor = { pares: parejas.pares.map((p) => p.id), errores: 7, confusiones: { p1: 2, p3: 1 } };
    const r = corregirItem(parejas, valor);
    assert.deepEqual(r.valor, { errores: 7, confusiones: { p1: 2, p3: 1 } });
    assert.equal(r.puntos, 6, 'aun con siete fallos conserva 6/15');
    assert.match(r.retro.explicacion, /Codificación \(2\).*Recuperación \(1\)/);
    assert.throws(() => corregirItem(parejas, { ...valor, confusiones: { p7: 1 } }), (e) => e.estado === 400);
  });
});

describe('Reglas compartidas', () => {
  test('puntosParejas y puntosCancion', () => {
    assert.deepEqual([0, 2, 3, 4, 5, 6, 9].map(reglas.puntosParejas), [15, 15, 12, 12, 9, 9, 6]);
    assert.deepEqual([0, 1, 2, 3, 4].map((n) => reglas.puntosCancion(n)), [0, 4, 8, 11, 15]);
  });

  test('puntuarJustificacion sin criterios (M2): dos tarjetas (máx. 30) + texto (10 con 20 palabras, 5 con 10)', () => {
    const j = mision('m2').justificacion;
    const veinte = Array.from({ length: 20 }, (_, i) => `palabra${i}`).join(' ');
    assert.deepEqual(reglas.puntuarJustificacion(j, ['t1', 't2'], veinte), { tarjetas: 30, texto: 10, total: 40 });
    assert.deepEqual(reglas.puntuarJustificacion(j, ['t3', 't4'], 'uno dos tres cuatro cinco seis siete ocho nueve diez'), { tarjetas: 8, texto: 5, total: 13 });
    assert.equal(reglas.puntuarJustificacion(j, ['t1', 't1', 't2'], '').tarjetas, 30);
  });

  test('cierre de M1 rechaza opción aislada y exige evidencia individual razonada', () => {
    const m1 = mision('m1');
    const textoPropio = 'La demanda verbal cambia el efecto y debo comprobarlo porque cada persona responde de forma diferente.';
    assert.throws(() => validarJustificacion(m1, { tarjetas: ['t1'], texto: textoPropio }), (e) => e.estado === 400);
    assert.throws(() => validarJustificacion(m1, { tarjetas: ['t1', 't1'], texto: textoPropio }), (e) => e.estado === 400);
    assert.throws(() => validarJustificacion(m1, { tarjetas: ['t1', 't2'], texto: 'Sin explicación suficiente' }), (e) => e.estado === 400);
    assert.deepEqual(validarJustificacion(m1, { tarjetas: ['t1', 't2'], texto: `  ${textoPropio}  ` }), {
      tarjetas: ['t1', 't2'], escrito: textoPropio
    });
  });

  test('revisarDiseno: secuencia de referencia B1→B5 (9 min) cumple; sin cierre final no', () => {
    const bloques = mision('m3').bloques;
    const ok = (d) => Object.fromEntries(reglas.revisarDiseno(d, bloques).map((c) => [c.id, c.cumple]));
    assert.equal(ok({ secuencia: ['b1', 'b2', 'b3', 'b4', 'b5'] }).duracion, true);
    assert.equal(ok({ secuencia: ['b1', 'b2', 'b3', 'b4', 'b5'] }).cierre, true);
    assert.equal(ok({ secuencia: ['b1', 'b2', 'b3', 'b4'] }).cierre, false);
    assert.equal(ok({ secuencia: ['b4', 'b3', 'b5'] }).recuperacion, false);
    assert.equal(ok({ secuencia: ['b6', 'b7'] }).duracion, false);
    assert.equal(ok({ objetivo: 'Que los estudiantes disfruten mucho de la actividad musical hoy' }).objetivo, false);
    assert.equal(ok({ objetivo: 'Al finalizar cada estudiante explicará los tres conceptos con ejemplos' }).objetivo, true);
    assert.equal(ok({ recurso: { tipo: 'silencio' } }).recurso, true);
    assert.equal(ok({ recurso: { tipo: 'ritmo', volumen: 'bajo' } }).recurso, false);
  });

  test('M3 valida en servidor los cuatro bloques, 5–10 minutos y los fundamentos pedagógicos', () => {
    const base = {
      objetivo: 'Al finalizar cada estudiante explicará tres conceptos mediante ejemplos propios claros',
      recurso: { tipo: 'silencio' },
      secuencia: ['b1', 'b2', 'b3', 'b4', 'b5'],
      instrucciones: 'Primero revisen los conceptos, practiquen y luego explíquenlos sin mirar sus apuntes.',
      comprobacion: 'Cada estudiante explica los tres conceptos mediante una tarjeta de salida individual.',
      indicador: 'Valora tu concentración de uno a cinco al terminar.',
      justificacion: 'La atención se protege al limitar distractores durante la explicación. La recuperación ocurre cuando cada estudiante responde sin mirar. La emoción y la autorregulación se observan con una valoración final, de modo que el recurso se ajuste al cansancio sin asumir una respuesta igual para todas las personas.',
      diferencias: 'Cada estudiante puede elegir silencio y comunicar incomodidad, cansancio o necesidad de ajustar el ritmo de trabajo.'
    };
    assert.equal(validarDiseno(base, mision('m3')).secuencia.length, 5);
    assert.throws(() => validarDiseno({ ...base, secuencia: ['b1', 'b2'] }, mision('m3')), (e) => e.estado === 400 && /5 a 10 minutos/i.test(e.message));
    const sinFundamentos = 'Esta explicación tiene suficientes palabras pero no relaciona los procesos pedagógicos solicitados con la actividad diseñada para el grupo al finalizar la jornada y tampoco presenta todos los fundamentos requeridos de manera explícita y comprobable para el docente que la revisará después de recibir el trabajo completo.';
    assert.throws(() => validarDiseno({ ...base, justificacion: sinFundamentos }, mision('m3')), (e) => e.estado === 400 && /atención.*recuperación.*emoción/i.test(e.message));
  });

  test('estadoRuta: desbloqueo con 70, mejor puntaje y M3 solo si el docente la validó', () => {
    let e = reglas.estadoRuta([intento('m1', 64)], [], experiencia);
    assert.equal(e.misiones.m2.estado, 'bloqueada');
    e = reglas.estadoRuta([intento('m1', 64), intento('m1', 83), intento('m1', 50)], [], experiencia);
    assert.equal(e.misiones.m1.mejor, 83);
    assert.equal(e.misiones.m2.estado, 'abierta');
    e = reglas.estadoRuta([intento('m1', 85), intento('m2', 85), intento('m3', 80)], [], experiencia);
    assert.equal(e.misiones.m3.aprobada, false, 'M3 sin validar no cuenta');
    e = reglas.estadoRuta([intento('m1', 72), intento('m2', 71), intento('m3', 75, { validada: true })], [], experiencia);
    assert.equal(e.total, 218);
    assert.equal(e.cumple, false, '218 < 240: en proceso');
    e = reglas.estadoRuta([intento('m1', 72), intento('m2', 94), intento('m3', 75, { validada: true })], [], experiencia);
    assert.equal(e.total, 241);
    assert.equal(e.cumple, true);
  });

  test('estadoRuta: M3 pendiente o devuelta según la última entrega; alerta tras dos intentos bajos', () => {
    const base = [intento('m1', 90), intento('m2', 90)];
    assert.equal(reglas.estadoRuta(base, [{ estado: 'pendiente', fecha: '2026-10-01' }], experiencia).misiones.m3.estado, 'pendiente');
    assert.equal(reglas.estadoRuta(base, [{ estado: 'pendiente', fecha: '2026-10-01' }, { estado: 'devuelta', fecha: '2026-09-01' }], experiencia).misiones.m3.estado, 'pendiente');
    assert.equal(reglas.estadoRuta(base, [{ estado: 'devuelta', fecha: '2026-10-01' }], experiencia).misiones.m3.estado, 'devuelta');
    assert.equal(reglas.estadoRuta([intento('m1', 40), intento('m1', 60)], [], experiencia).misiones.m1.intentosBajo, true);
  });

  test('Mapa NR-03.1: sin intentos M1 está disponible y M2 y M3 bloqueadas', () => {
    const e = reglas.estadoRuta([], [], experiencia);
    assert.deepEqual(['m1', 'm2', 'm3'].map((id) => e.misiones[id].estado), ['abierta', 'bloqueada', 'bloqueada']);
  });

  test('Mapa NR-03.1: el umbral es exactamente 70/100 en M1 y en M2', () => {
    const estados = (...lista) => ['m1', 'm2', 'm3'].map((id) => reglas.estadoRuta(lista, [], experiencia).misiones[id].estado);
    assert.deepEqual(estados(intento('m1', 69)), ['abierta', 'bloqueada', 'bloqueada']);
    assert.deepEqual(estados(intento('m1', 70)), ['aprobada', 'abierta', 'bloqueada']);
    assert.deepEqual(estados(intento('m1', 70), intento('m2', 69)), ['aprobada', 'abierta', 'bloqueada']);
    assert.deepEqual(estados(intento('m1', 70), intento('m2', 70)), ['aprobada', 'aprobada', 'abierta']);
  });

  test('Mapa NR-03.1: una misión bloqueada con puntaje no desbloquea la siguiente', () => {
    const e = reglas.estadoRuta([intento('m1', 50), intento('m2', 95)], [], experiencia);
    assert.equal(e.misiones.m2.estado, 'bloqueada');
    assert.equal(e.misiones.m3.estado, 'bloqueada', 'M3 exige M2 desbloqueada y aprobada');
  });

  test('Mapa NR-03.1: M3 completada solo con validación docente; pendiente mientras se valora', () => {
    const base = [intento('m1', 80), intento('m2', 80)];
    assert.equal(reglas.estadoRuta([...base, intento('m3', 90)], [], experiencia).misiones.m3.estado, 'abierta');
    assert.equal(reglas.estadoRuta(base, [{ estado: 'pendiente', fecha: '2026-10-01' }], experiencia).misiones.m3.estado, 'pendiente');
    assert.equal(reglas.estadoRuta([...base, intento('m3', 90, { validada: true })], [], experiencia).misiones.m3.estado, 'aprobada');
  });
});

describe('NR-03.4 · Puntuación y retroalimentación de M1', () => {
  const m1 = () => mision('m1');
  const COMPLETO = 'La tarea de lectura exige procesar lenguaje, cada persona responde distinto y lo comprobaría comparando dos condiciones.';
  const NEUTRO = 'Elegí estas opciones después de pensarlo con calma durante un buen rato hoy.';

  test('60 puntos de decisión: cuatro ítems con máximo de 15 (tabla de la Tarea 3)', () => {
    for (const i of m1().items) {
      const maximos = i.configuraciones ? Object.values(i.configuraciones).map((c) => c.puntos) : i.opciones.map((o) => o.puntos);
      assert.equal(Math.max(...maximos), 15, i.id);
    }
    assert.equal(m1().items.length * 15, 60);
  });

  test('40 de justificación: tarjetas (30) + tres criterios de la explicación (4 + 3 + 3)', () => {
    const j = m1().justificacion;
    assert.deepEqual(j.criterios.map((c) => [c.id, c.puntos]), [['tarea', 4], ['diferencias', 3], ['comprobacion', 3]]);
    assert.equal(j.validacionDocente.estado, 'pendiente', 'los criterios se registran como propuesta pendiente de validación docente');
    const r = reglas.puntuarJustificacion(j, ['t1', 't2'], COMPLETO);
    assert.equal(r.total, 40);
    assert.deepEqual(r.criterios.map((c) => c.cumple), [true, true, true]);
  });

  test('la explicación puntúa por criterio, no por longitud', () => {
    const j = m1().justificacion;
    const largoSinCriterios = `${NEUTRO} ${NEUTRO} ${NEUTRO}`;
    assert.equal(reglas.puntuarJustificacion(j, ['t4', 't5'], largoSinCriterios).texto, 0);
    const soloTarea = reglas.puntuarJustificacion(j, [], 'Para esta lectura densa elegí silencio porque así me concentro mucho mejor siempre.');
    assert.deepEqual(soloTarea.criterios.map((c) => c.cumple), [true, false, false]);
    assert.equal(soloTarea.texto, 4);
    // Sin tildes ni mayúsculas también se reconoce
    assert.equal(reglas.puntuarJustificacion(j, [], 'CADA PERSONA REACCIONA DISTINTO, POR ESO LO COMPROBARIA CON UN INDICADOR CLARO').texto, 6);
    assert.equal(reglas.puntuarJustificacion(j, [], 'tarea persona comprobar').texto, 0, 'menos de 10 palabras no suma criterios');
  });

  test('versión pública: criterios sin indicadores', () => {
    const publica = versionPublica(experiencia).misiones.find((m) => m.id === 'm1').justificacion;
    assert.deepEqual(publica.criterios.map((c) => Object.keys(c).sort()), [['id', 'maximo', 'texto'], ['id', 'maximo', 'texto'], ['id', 'maximo', 'texto']]);
    assert.deepEqual(publica.criterios.map((c) => c.maximo), [4, 3, 3]);
  });

  test('retroalimentación inmediata: concepto, error a revisar, recurso y sugerencia', () => {
    const i1 = item('m1', 'i1');
    const base = { hipotesis: 'Creo que esta condición sonora afectará mi lectura', prediccion: 'desfavorable' };
    const mal = corregirItem(i1, { ...base, config: { tipo: 'letra', volumen: 'medio' } });
    assert.equal(mal.puntos, 0);
    assert.equal(mal.retro.concepto, i1.concepto);
    assert.match(mal.retro.revisar, /canción con letra a volumen medio/);
    assert.match(mal.retro.sugerencia, /recurso enlazado.*mejor puntaje/);
    assert.equal(mal.retro.recurso, i1.recurso);
    const bien = corregirItem(i1, { ...base, config: { tipo: 'silencio' }, prediccion: 'favorable' });
    assert.equal(bien.puntos, 15);
    assert.equal(bien.retro.revisar, '', 'sin error que revisar con el puntaje completo');
    assert.ok(bien.retro.sugerencia);
    const quiz = corregirItem(item('m1', 'i4'), { opcion: item('m1', 'i4').opciones.find((o) => o.puntos === 0).id });
    assert.ok(quiz.retro.revisar && quiz.retro.concepto && quiz.retro.complemento);
  });

  test('umbral de la insignia «Observador atencional» y desbloqueo: 69 no, 70 y 100 sí', () => {
    const insignia = JSON.parse(fs.readFileSync(new URL('../datos/insignias.json', import.meta.url), 'utf8')).find((x) => x.id === m1().insignia);
    // El umbral viene de reglas-gamificacion.json → neuroritmo.aprobacion (NR-06.1)
    assert.deepEqual(insignia.condicion, { tipo: 'mision', mision: 'm1' });
    assert.equal(JSON.parse(fs.readFileSync(new URL('../datos/config/reglas-gamificacion.json', import.meta.url), 'utf8')).neuroritmo.aprobacion, 70);
    for (const [puntaje, aprobada] of [[69, false], [70, true], [100, true]]) {
      const e = reglas.estadoRuta([intento('m1', puntaje)], [], experiencia);
      assert.equal(e.misiones.m1.aprobada, aprobada, `${puntaje}`);
      assert.equal(e.misiones.m2.estado, aprobada ? 'abierta' : 'bloqueada', `${puntaje}`);
    }
  });

  test('reintentos: se conserva la mejor nota (70 → 100 → 69 deja 100)', () => {
    const e = reglas.estadoRuta([intento('m1', 69), intento('m1', 70), intento('m1', 100), intento('m1', 69)], [], experiencia);
    assert.equal(e.misiones.m1.mejor, 100);
    assert.equal(e.misiones.m1.intentos, 4);
  });
});

describe('NR-04.4 · Puntuación de M2 y distribución pendiente de aprobación', () => {
  const m2 = () => mision('m2');

  test('la distribución de M2 es una propuesta, suma 60 y declara que no proviene de la Tarea 3', () => {
    const d = m2().distribucion;
    assert.ok(['propuesta', 'aprobada'].includes(d.estado));
    assert.equal(Object.values(reglas.pesosItems(m2())).reduce((s, v) => s + v, 0), 60);
    assert.equal(reglas.errorDistribucion(reglas.pesosItems(m2()), m2().items), '');
    assert.match(d.fuente, /no tomada de la Tarea 3/);
    assert.deepEqual(Object.keys(d.razones), m2().items.map((i) => i.id));
    // 60 de actividades + 40 de justificación (dos tarjetas de 15 y explicación de 10)
    const texto = 'Una melodía puede servir como pista de recuperación del orden, pero no reemplaza comprender cada concepto con ejemplos propios y comprobarlo después sin la canción.';
    assert.equal(reglas.puntuarJustificacion(m2().justificacion, ['t1', 't2'], texto).total, 40);
  });

  test('errorDistribucion: exige enteros de 5 a 30 que sumen 60', () => {
    const items = m2().items;
    assert.equal(reglas.errorDistribucion({ i1: 10, i2: 20, i3: 15, i4: 15 }, items), '');
    assert.match(reglas.errorDistribucion({ i1: 15, i2: 15, i3: 15, i4: 14 }, items), /sumar 60.*59/);
    assert.match(reglas.errorDistribucion({ i1: 4, i2: 26, i3: 15, i4: 15 }, items), /de 5 a 30/);
    assert.match(reglas.errorDistribucion({ i1: 31, i2: 0, i3: 15, i4: 14 }, items), /de 5 a 30/);
    assert.match(reglas.errorDistribucion({ i1: '15', i2: 15, i3: 15, i4: 15 }, items), /entero/);
  });

  test('la corrección se escala al máximo de cada actividad (15 por defecto)', () => {
    const parejas = item('m2', 'i1');
    const todas = { pares: parejas.pares.map((p) => p.id), errores: 3 };
    assert.deepEqual([corregirItem(parejas, todas).puntos, corregirItem(parejas, todas).maximo], [12, 15]);
    const r10 = corregirItem(parejas, todas, 10);
    assert.deepEqual([r10.puntos, r10.maximo, r10.retro.nivel, r10.retro.indicador.maximo], [8, 10, 'parcial', 10]);
    const r20 = corregirItem(parejas, { ...todas, errores: 0 }, 20);
    assert.deepEqual([r20.puntos, r20.retro.nivel, r20.retro.revisar], [20, 'completo', '']);
    const cancion = corregirItem(cancionPublicadaDePrueba, { palabras: { 1: 'codificar', 2: 'consolidar', 3: 'memorizar', 4: 'releer' } }, 20);
    assert.deepEqual([cancion.puntos, cancion.maximo], [11, 20]);
  });

  test('retroalimentación por concepto en cada actividad de M2', () => {
    for (const i of m2().items) {
      const valor = i.tipo === 'parejas' ? { pares: i.pares.map((p) => p.id), errores: 9 }
        : i.tipo === 'cancion' ? { palabras: { 1: 'releer', 2: 'releer', 3: 'releer', 4: 'releer' } }
        : { opcion: i.opciones.find((o) => o.puntos === 0).id };
      const corregible = i.tipo === 'cancion' ? cancionPublicadaDePrueba : i;
      const r = corregirItem(corregible, valor, reglas.pesosItems(m2())[i.id]);
      assert.equal(r.retro.concepto, i.concepto, i.id);
      assert.ok(r.retro.revisar && r.retro.sugerencia && r.retro.recurso, i.id);
      assert.notEqual(r.retro.indicador.estado, 'adquirido', i.id);
    }
  });

  test('la versión pública muestra la distribución y su estado sin las razones internas', () => {
    const publica = versionPublica(experiencia).misiones.find((m) => m.id === 'm2');
    assert.deepEqual(Object.keys(publica.distribucion).sort(), ['estado', 'fuente', 'valores']);
    assert.equal(versionPublica(experiencia).misiones.find((m) => m.id === 'm1').distribucion, undefined);
  });

  test('«Guardián de la memoria» con 70/100 y M3 bloqueada si M2 < 70; se conserva el mejor intento', () => {
    const insignia = JSON.parse(fs.readFileSync(new URL('../datos/insignias.json', import.meta.url), 'utf8')).find((x) => x.id === m2().insignia);
    // El umbral viene de reglas-gamificacion.json → neuroritmo.aprobacion (NR-06.1)
    assert.deepEqual(insignia.condicion, { tipo: 'mision', mision: 'm2' });
    assert.equal(JSON.parse(fs.readFileSync(new URL('../datos/config/reglas-gamificacion.json', import.meta.url), 'utf8')).neuroritmo.aprobacion, 70);
    const m1 = intento('m1', 80);
    for (const [puntaje, aprobada] of [[69, false], [70, true], [100, true]]) {
      const e = reglas.estadoRuta([m1, intento('m2', puntaje)], [], experiencia);
      assert.equal(e.misiones.m2.aprobada, aprobada, `${puntaje}`);
      assert.equal(e.misiones.m3.estado, aprobada ? 'abierta' : 'bloqueada', `${puntaje}`);
    }
    const e = reglas.estadoRuta([m1, intento('m2', 72), intento('m2', 60)], [], experiencia);
    assert.deepEqual([e.misiones.m2.mejor, e.misiones.m3.estado], [72, 'abierta']);
  });
});

import { etapaEntrega, limpiarDiseno, validarDiseno as validarDisenoM3 } from '../servidor/rutas/neuroritmo.js';

describe('NR-05.2 · Borrador y versiones de la Misión 3', () => {
  const m3 = () => mision('m3');

  test('limpiarDiseno acepta borradores incompletos y descarta valores ajenos', () => {
    const d = limpiarDiseno({ objetivo: '  Explicar  ', secuencia: ['b2', 'zz', 'b2', 'b1'], recurso: { tipo: 'inventado', volumen: 'altisimo' }, extra: 'x' }, m3());
    assert.equal(d.objetivo, 'Explicar');
    assert.deepEqual(d.secuencia, ['b2', 'b1'], 'sin duplicados ni bloques inexistentes, conservando el orden');
    assert.equal(d.recurso.tipo, '');
    assert.equal(d.recurso.volumen, '');
    assert.ok(!('extra' in d));
    assert.deepEqual(Object.keys(limpiarDiseno(null, m3())).sort(), Object.keys(d).sort());
  });

  test('el envío exige el diseño completo aunque el borrador no lo esté', () => {
    assert.throws(() => validarDisenoM3({ objetivo: 'Explicar algo' }, m3()), (e) => e.estado === 400);
  });

  test('etapas: enviado → en revisión → devuelto | aprobado', () => {
    assert.equal(etapaEntrega({ estado: 'pendiente' }), 'enviado');
    assert.equal(etapaEntrega({ estado: 'pendiente', revisionInicio: '2026-10-27T10:00:00Z' }), 'en-revision');
    assert.equal(etapaEntrega({ estado: 'devuelta' }), 'devuelto');
    assert.equal(etapaEntrega({ estado: 'validada' }), 'aprobado');
    assert.equal(etapaEntrega(null), null);
  });

  test('la ruta solo cuenta la M3 validada por el docente: una entrega enviada no da puntaje', () => {
    const m1 = intento('m1', 90), m2 = intento('m2', 90);
    const enviada = reglas.estadoRuta([m1, m2], [{ estado: 'pendiente', fecha: '2026-10-27' }], experiencia);
    assert.deepEqual([enviada.misiones.m3.estado, enviada.misiones.m3.mejor], ['pendiente', 0]);
    const sinValidar = reglas.estadoRuta([m1, m2, intento('m3', 95)], [{ estado: 'pendiente', fecha: '2026-10-27' }], experiencia);
    assert.equal(sinValidar.misiones.m3.mejor, 0, 'un intento M3 sin validada:true no cuenta');
  });

  test('la colección de borradores solo la usa el servidor', () => {
    const permisos = JSON.parse(fs.readFileSync(new URL('../datos/config/permisos.json', import.meta.url), 'utf8'));
    assert.deepEqual(permisos['neuroritmo-borradores'], { leer: ['servidor'], escribir: ['servidor'] });
  });
});

import { conceptosPorReforzar } from '../servidor/rutas/neuroritmo.js';

describe('NR-06.4 · Conceptos a reforzar del estudiante', () => {
  const combinada = reglas.combinarReglas(experiencia, JSON.parse(fs.readFileSync(new URL('../datos/config/reglas-gamificacion.json', import.meta.url), 'utf8')));
  const m1 = mision('m1');
  const respuestas = (puntos) => Object.fromEntries(m1.items.map((i, n) => [i.id, { puntos: puntos[n], maximo: 15, retro: { revisar: puntos[n] < 15 ? `Revisa ${i.concepto}` : '' } }]));

  test('toma el último intento terminado: ítems sin puntaje completo y justificación baja', () => {
    const partidas = [
      { mision: 'm1', estado: 'finalizada', numero: 1, respuestas: respuestas([0, 0, 0, 0]), justificacion: { puntos: { total: 10 } } },
      { mision: 'm1', estado: 'finalizada', numero: 2, respuestas: respuestas([15, 15, 9, 15]), justificacion: { puntos: { total: 40 } } },
      { mision: 'm1', estado: 'en-curso', numero: 3, respuestas: {} }
    ];
    const lista = conceptosPorReforzar(combinada, partidas, null);
    assert.deepEqual(lista.map((c) => c.concepto), [m1.items[2].concepto]);
    assert.equal(lista[0].detalle, `Revisa ${m1.items[2].concepto}`);
    const baja = conceptosPorReforzar(combinada, [{ ...partidas[1], justificacion: { puntos: { total: 20 } } }], null);
    assert.ok(baja.some((c) => c.concepto === m1.justificacion.concepto), 'justificación bajo el 60 %');
  });

  test('M3 devuelta suma el comentario docente; sin intentos no hay nada que reforzar', () => {
    const lista = conceptosPorReforzar(combinada, [], { estado: 'devuelta', comentario: 'Precisa la comprobación.' });
    assert.deepEqual(lista, [{ mision: 'm3', concepto: 'Microactividad: atiende el comentario de tu docente', detalle: 'Precisa la comprobación.' }]);
    assert.deepEqual(conceptosPorReforzar(combinada, [], { estado: 'pendiente' }), []);
  });
});
