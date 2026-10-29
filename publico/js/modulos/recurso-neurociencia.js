import { montarPlantilla } from '../nucleo/plantilla.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Explorador de neurociencia sonora', roles: ['sesion'] });

const CASOS = {
  lectura: {
    titulo: 'Lectura comprensiva de un artículo',
    demanda: 'Procesamiento verbal alto, atención sostenida y mantenimiento de ideas en la memoria de trabajo.',
    hipotesis: 'Comenzar en silencio es una base prudente. Una canción con letra puede competir con el lenguaje del texto.',
    comprobacion: 'Comparar una condición por vez y registrar tiempo, relecturas e ideas principales explicadas sin mirar.'
  },
  mecanica: {
    titulo: 'Ordenar referencias bibliográficas',
    demanda: 'Tarea repetitiva con menor demanda de comprensión, aunque todavía exige leer nombres, títulos y años.',
    hipotesis: 'Silencio o música instrumental suave a volumen bajo son condiciones comparables; ninguna garantiza menos errores.',
    comprobacion: 'Mantener igual el número de referencias y contar errores de orden o formato en cada condición.'
  },
  estres: {
    titulo: 'Repaso antes de una evaluación con estrés alto',
    demanda: 'Recuperar información ya estudiada mientras se regula un nivel de activación elevado.',
    hipotesis: 'Una pausa breve, silencio o música instrumental suave antes del repaso pueden probarse según la respuesta individual.',
    comprobacion: 'Registrar tensión de 1 a 5 antes y después, y comprobar luego cuántas ideas se explican sin apoyo.'
  }
};

const resultado = document.getElementById('resultado-caso');
const botones = [...document.querySelectorAll('[data-caso]')];

function mostrarCaso(id, enfocar = false) {
  const caso = CASOS[id] || CASOS.lectura;
  resultado.innerHTML = `
    <h3>${escapar(caso.titulo)}</h3>
    <dl>
      <div><dt>Demanda de la tarea</dt><dd>${escapar(caso.demanda)}</dd></div>
      <div><dt>Hipótesis para comprobar</dt><dd>${escapar(caso.hipotesis)}</dd></div>
      <div><dt>Evidencia observable</dt><dd>${escapar(caso.comprobacion)}</dd></div>
    </dl>`;
  botones.forEach((boton) => {
    const activo = boton.dataset.caso === id;
    boton.setAttribute('aria-selected', String(activo));
    boton.classList.toggle('btn--primario', activo);
    boton.classList.toggle('btn--secundario', !activo);
  });
  if (enfocar) resultado.focus();
}

botones.forEach((boton) => boton.addEventListener('click', () => mostrarCaso(boton.dataset.caso, true)));
mostrarCaso('lectura');
