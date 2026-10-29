// pruebas/contenidos.test.js
// Pruebas unitarias de publicación y visibilidad de contenidos (NR-02.7): asignatura > unidad > tema,
// glosario, canciones y simulaciones. Solo leen datos/ (registros sintéticos sobre los datos de demostración).

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import * as almacen from '../servidor/almacen.js';
import * as temas from '../servidor/ganchos/temas.js';
import * as glosario from '../servidor/ganchos/glosario.js';
import * as canciones from '../servidor/ganchos/canciones.js';
import * as simulaciones from '../servidor/ganchos/simulaciones.js';

const completo = {
  resumen: 'Resumen del tema.',
  objetivos: ['Justificar la estrategia sonora o el silencio según la tarea.'],
  recursos: [
    { tipo: 'enlace', titulo: 'Infografía', url: 'https://view.genially.com/abc' },
    { tipo: 'actividad', titulo: 'Misión 1', url: '/index.html#mision-m1' }
  ]
};

// Rechazo esperado de un gancho con su código de estado
const rechaza = (promesa, estado) => assert.rejects(promesa, (err) => err.estado === estado);

// Escenario tomado de los datos de demostración: un grupo con su docente, un estudiante matriculado,
// una unidad visible y (si existen) una unidad oculta y un tema en borrador de esa asignatura
const ctx = {};
before(async () => {
  const [grupos, unidades, listaTemas, usuarios] = await Promise.all(['distributivo', 'unidades', 'temas', 'usuarios'].map((c) => almacen.leer(c)));
  const grupo = grupos.find((g) => g.estudiantes?.length && unidades.some((u) => u.asignaturaId === g.asignaturaId && u.visible !== false));
  ctx.asignaturaId = grupo.asignaturaId;
  ctx.docente = { id: grupo.docenteId, rol: 'docente' };
  ctx.estudiante = { id: grupo.estudiantes[0], rol: 'estudiante' };
  // Docente sin ningún grupo de esa asignatura
  const otro = usuarios.find((u) => u.rol === 'docente' && !grupos.some((g) => g.asignaturaId === grupo.asignaturaId && g.docenteId === u.id));
  ctx.docenteAjeno = otro ? { id: otro.id, rol: 'docente' } : { id: 'usu_sin_grupos', rol: 'docente' };
  ctx.sinGrupo = { id: 'usu_sin_grupos', rol: 'estudiante' };
  const propias = unidades.filter((u) => u.asignaturaId === grupo.asignaturaId);
  ctx.unidadVisible = propias.find((u) => u.visible !== false);
  ctx.unidadOculta = propias.find((u) => u.visible === false);
  ctx.temaPublicado = listaTemas.find((t) => t.unidadId === ctx.unidadVisible.id && t.estado === 'publicado');
  ctx.temaBorrador = listaTemas.find((t) => propias.some((u) => u.id === t.unidadId) && t.estado === 'borrador');
});

describe('faltasParaPublicar', () => {
  test('un tema completo puede publicarse', () => {
    assert.deepEqual(temas.faltasParaPublicar(completo), []);
  });

  test('exige resumen y al menos un objetivo no vacío', () => {
    const faltas = temas.faltasParaPublicar({ ...completo, resumen: '   ', objetivos: ['', '  '] });
    assert.deepEqual(faltas, ['el resumen', 'al menos un objetivo']);
  });

  test('un recurso sin título o sin enlace es incompleto', () => {
    const recursos = [{ tipo: 'enlace', titulo: '', url: 'https://a.ec' }, { tipo: 'video', titulo: 'Video', url: '' }, completo.recursos[0]];
    assert.deepEqual(temas.faltasParaPublicar({ ...completo, recursos }), ['completar 2 recurso(s) con título y enlace válido']);
  });

  test('rechaza enlaces javascript:, data: y rutas de otro dominio (//)', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//malicioso.ec/x', 'ftp://a.ec/x']) {
      assert.equal(temas.faltasParaPublicar({ ...completo, recursos: [{ tipo: 'enlace', titulo: 'X', url }] }).length, 1, url);
    }
  });

  test('sin recursos también puede publicarse', () => {
    assert.deepEqual(temas.faltasParaPublicar({ ...completo, recursos: [] }), []);
  });
});

describe('temas.antesDeGuardar · aprobar y publicar', () => {
  const nuevo = () => ({ unidadId: ctx.unidadVisible.id, titulo: `Tema de prueba ${Date.now()}`, ...completo });

  test('el docente del grupo publica un tema completo', async () => {
    const datos = { ...nuevo(), estado: 'publicado' };
    assert.equal(await temas.antesDeGuardar(datos, ctx.docente, null), datos);
  });

  test('no se publica con recursos incompletos (400) y el estado no se altera', async () => {
    const datos = { ...nuevo(), estado: 'publicado', recursos: [{ tipo: 'enlace', titulo: 'Sin enlace', url: '' }] };
    await rechaza(temas.antesDeGuardar(datos, ctx.docente, null), 400);
    assert.equal(datos.estado, 'publicado');
  });

  test('un borrador incompleto se guarda como borrador, sin convertirse en publicado', async () => {
    const datos = { ...nuevo(), estado: 'borrador', resumen: '', recursos: [{ tipo: 'enlace', titulo: '', url: '' }] };
    const guardado = await temas.antesDeGuardar(datos, ctx.docente, null);
    assert.equal(guardado.estado, 'borrador');
  });

  test('pasar de borrador a publicado valida el contenido del tema existente', async () => {
    const anterior = { id: 'tem_prueba', unidadId: ctx.unidadVisible.id, titulo: 'Borrador', estado: 'borrador', resumen: '', objetivos: [] };
    await rechaza(temas.antesDeGuardar({ estado: 'publicado' }, ctx.docente, anterior), 400);
    const completoAnterior = { ...anterior, ...completo };
    assert.ok(await temas.antesDeGuardar({ estado: 'publicado' }, ctx.docente, completoAnterior));
  });

  test('editar un campo ajeno a la publicación no bloquea un tema ya publicado', async () => {
    const anterior = { id: 'tem_prueba', unidadId: ctx.unidadVisible.id, titulo: 'Antiguo', estado: 'publicado', resumen: '', objetivos: [] };
    assert.ok(await temas.antesDeGuardar({ dificultad: 'avanzado' }, ctx.docente, anterior));
  });

  test('el estudiante no puede crear, publicar ni eliminar temas (403)', async () => {
    await rechaza(temas.antesDeGuardar({ ...nuevo(), estado: 'publicado' }, ctx.estudiante, null), 403);
    await rechaza(temas.antesDeGuardar({ estado: 'publicado' }, ctx.estudiante, ctx.temaPublicado), 403);
    await rechaza(temas.antesDeGuardar(null, ctx.estudiante, ctx.temaPublicado), 403);
  });

  test('un docente ajeno no puede publicar ni eliminar (403)', async () => {
    await rechaza(temas.antesDeGuardar({ estado: 'borrador' }, ctx.docenteAjeno, ctx.temaPublicado), 403);
    await rechaza(temas.antesDeGuardar(null, ctx.docenteAjeno, ctx.temaPublicado), 403);
  });

  test('título obligatorio (400) y sin duplicados en la unidad (409)', async () => {
    await rechaza(temas.antesDeGuardar({ unidadId: ctx.unidadVisible.id, titulo: '  ' }, ctx.docente, null), 400);
    const repetido = { unidadId: ctx.unidadVisible.id, titulo: ` ${ctx.temaPublicado.titulo.toUpperCase()} ` };
    await rechaza(temas.antesDeGuardar(repetido, ctx.docente, null), 409);
  });
});

describe('temas.filtrarLista · el estudiante solo consulta lo publicado de sus grupos', () => {
  const sintetico = (id, unidadId, estado) => ({ id, unidadId, estado, titulo: id });

  test('publicado en unidad visible: sí; borrador o unidad inexistente: no', async () => {
    const lista = [sintetico('a', ctx.unidadVisible.id, 'publicado'), sintetico('b', ctx.unidadVisible.id, 'borrador'), sintetico('c', 'uni_inexistente', 'publicado')];
    assert.deepEqual((await temas.filtrarLista(lista, ctx.estudiante)).map((t) => t.id), ['a']);
  });

  test('publicado en una unidad oculta: no', async (t) => {
    if (!ctx.unidadOculta) return t.skip('no hay unidad oculta en los datos de demostración');
    assert.deepEqual(await temas.filtrarLista([sintetico('d', ctx.unidadOculta.id, 'publicado')], ctx.estudiante), []);
  });

  test('el docente del grupo ve también los borradores', async () => {
    const lista = [sintetico('a', ctx.unidadVisible.id, 'publicado'), sintetico('b', ctx.unidadVisible.id, 'borrador')];
    assert.equal((await temas.filtrarLista(lista, ctx.docente)).length, 2);
  });

  test('estudiante sin grupo de la asignatura: no ve ni lo publicado', async () => {
    assert.deepEqual(await temas.filtrarLista([sintetico('a', ctx.unidadVisible.id, 'publicado')], ctx.sinGrupo), []);
  });

  test('sin sesión: lista vacía', async () => {
    assert.deepEqual(await temas.filtrarLista([sintetico('a', ctx.unidadVisible.id, 'publicado')], null), []);
  });
});

describe('Elementos de un tema (glosario, canciones, simulaciones)', () => {
  test('glosario: el estudiante no ve términos de un tema en borrador ni términos sin aprobar', async (t) => {
    if (!ctx.temaBorrador) return t.skip('no hay tema en borrador en los datos de demostración');
    const lista = [
      { id: 'g1', temaId: ctx.temaPublicado.id, estado: 'aprobado' },
      { id: 'g2', temaId: ctx.temaPublicado.id, estado: 'pendiente' },
      { id: 'g3', temaId: ctx.temaBorrador.id, estado: 'aprobado' }
    ];
    assert.deepEqual((await glosario.filtrarLista(lista, ctx.estudiante)).map((g) => g.id), ['g1']);
    assert.equal((await glosario.filtrarLista(lista, ctx.docente)).length, 3);
  });

  test('glosario y canciones: un docente ajeno no puede editar ni eliminar (403)', async () => {
    const termino = { id: 'glo_prueba', temaId: ctx.temaPublicado.id, termino: 'X', estado: 'aprobado' };
    await rechaza(glosario.antesDeGuardar(null, ctx.docenteAjeno, termino), 403);
    await rechaza(glosario.antesDeGuardar({ termino: 'Y' }, ctx.docenteAjeno, termino), 403);
    const cancion = { id: 'can_prueba', temaId: ctx.temaPublicado.id, titulo: 'X', audio: '/a.mp3', autoria: 'A', licencia: 'CC' };
    await rechaza(canciones.antesDeGuardar(null, ctx.docenteAjeno, cancion), 403);
    assert.equal(await glosario.antesDeGuardar(null, ctx.docente, termino), null);
  });

  test('simulaciones: el estudiante solo ve las publicadas de temas publicados y visibles', async (t) => {
    if (!ctx.temaBorrador) return t.skip('no hay tema en borrador en los datos de demostración');
    const lista = [
      { id: 's1', temaId: ctx.temaPublicado.id, estado: 'publicado' },
      { id: 's2', temaId: ctx.temaPublicado.id, estado: 'borrador' },
      { id: 's3', temaId: ctx.temaBorrador.id, estado: 'publicado' }
    ];
    assert.deepEqual((await simulaciones.filtrarLista(lista, ctx.estudiante)).map((s) => s.id), ['s1']);
    assert.equal((await simulaciones.filtrarLista(lista, ctx.docente)).length, 3);
    assert.deepEqual(await simulaciones.filtrarLista(lista, ctx.sinGrupo), []);
  });
});
