import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leer = (ruta) => fs.readFileSync(new URL(ruta, import.meta.url), 'utf8');
const global = leer('../publico/js/nucleo/tutor-neuri-global.js');
const historial = leer('../publico/js/nucleo/historial-tutor.js');
const plantilla = leer('../publico/js/nucleo/plantilla.js');
const asignatura = leer('../publico/js/modulos/asignatura.js');

test('NR-08.3C · la plantilla monta un único tutor global solo para estudiantes', () => {
  assert.match(plantilla, /usuario\?\.rol === 'estudiante'/);
  assert.match(plantilla, /montarTutorNeuriGlobal\(\{ raiz: avatar \}\)/);
  assert.doesNotMatch(asignatura, /montarTutor\(/);
  assert.match(asignatura, /abrirTutorNeuriGlobal/);
});

test('NR-08.3C · detecta temas, misiones e ítems y pide orientación contextual', () => {
  assert.match(global, /#mision-\(m\[1-3\]\)/);
  assert.match(global, /h2\[id\^="titulo-"\]/);
  assert.match(global, /contexto: \{ misionId: contexto\.misionId, itemId: contexto\.itemId, actividad: contexto\.actividad \}/);
  assert.match(global, /Necesito otra pista/);
  assert.match(global, /unidad\.asignaturaId === experiencia\?\.asignaturaId/);
  assert.match(global, /permitidos\.has\(mensaje\.temaId\)/);
  assert.match(global, /'parejas', 'm2'/);
});

test('NR-09.4 · Neuri excluye DigCompEdu y conserva el foco de las tres misiones', () => {
  const prompt = leer('../servidor/prompts/tutor.txt');
  const pagina = leer('../publico/js/modulos/tutor.js');
  assert.match(prompt, /Detectives de la atención/);
  assert.match(prompt, /Laboratorio de la memoria/);
  assert.match(prompt, /Crea tu misión musical/);
  assert.match(prompt, /DigCompEdu/);
  assert.match(pagina, /asignaturaIds: \[experiencia\.asignaturaId\]/);
  assert.match(pagina, /temaIds\.includes\(mensaje\.temaId\)/);
});

test('NR-08.3C · el historial es privado de la sesión y no toca calificaciones', () => {
  assert.match(historial, /sessionStorage/);
  assert.match(historial, /neuri\.tutor:/);
  assert.doesNotMatch(historial + global, /intentos|puntaje|calificaci[oó]n\s*=/i);
  assert.match(global, /no modifica tus calificaciones/);
});
