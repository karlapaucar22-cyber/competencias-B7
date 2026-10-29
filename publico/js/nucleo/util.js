// publico/js/nucleo/util.js
// Utilidades generales: normalización, barajado, fechas y formato básico seguro

import { escapar } from './ui.js';

/**
 * Normaliza un texto convirtiéndolo a mayúsculas, sin tildes ni diéresis,
 * conservando la letra Ñ y eliminando espacios a los extremos.
 */
export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, '')
    .normalize('NFC');
}

/**
 * Baraja los elementos de un arreglo usando el algoritmo Fisher-Yates sin mutar el original.
 */
export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Formatea una fecha ISO a formato largo en español de Ecuador (ej. "24 de octubre de 2026").
 */
export function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Formatea una fecha ISO a tiempo relativo en español de Ecuador (ej. "hace 5 minutos", "ayer").
 */
export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(fecha.getTime())) return '';

  const ahora = Date.now();
  const diferenciaSegundos = Math.round((fecha.getTime() - ahora) / 1000);
  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });

  const absSeg = Math.abs(diferenciaSegundos);
  if (absSeg < 60) {
    return rtf.format(diferenciaSegundos, 'second');
  }
  const diferenciaMinutos = Math.round(diferenciaSegundos / 60);
  const absMin = Math.abs(diferenciaMinutos);
  if (absMin < 60) {
    return rtf.format(diferenciaMinutos, 'minute');
  }
  const diferenciaHoras = Math.round(diferenciaMinutos / 60);
  const absHoras = Math.abs(diferenciaHoras);
  if (absHoras < 24) {
    return rtf.format(diferenciaHoras, 'hour');
  }
  const diferenciaDias = Math.round(diferenciaHoras / 24);
  const absDias = Math.abs(diferenciaDias);
  if (absDias < 30) {
    return rtf.format(diferenciaDias, 'day');
  }
  const diferenciaMeses = Math.round(diferenciaDias / 30);
  const absMeses = Math.abs(diferenciaMeses);
  if (absMeses < 12) {
    return rtf.format(diferenciaMeses, 'month');
  }
  const diferenciaAnios = Math.round(diferenciaDias / 365);
  return rtf.format(diferenciaAnios, 'year');
}

/**
 * Obtiene el valor de un parámetro de consulta (query parameter) desde la URL actual.
 */
export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

/**
 * Transforma texto simple a HTML seguro:
 * 1. Escapa cualquier contenido HTML para evitar inyecciones.
 * 2. Convierte **texto** en <strong>texto</strong>.
 * 3. Convierte líneas que inician con "- " en listas <ul><li>...</li></ul>.
 * 4. Convierte bloques separados por una línea en blanco en párrafos <p>...</p>.
 */
export function formatoBasico(texto) {
  if (texto === null || texto === undefined) return '';
  const textoLimpio = String(texto).replace(/\r\n/g, '\n');
  const seguro = escapar(textoLimpio);

  // Separar bloques por una o más líneas en blanco
  const bloques = seguro.split(/\n\s*\n+/);
  const resultado = [];

  for (const bloque of bloques) {
    const lineas = bloque.split('\n');
    let itemsLista = [];
    let lineasParrafo = [];

    const vaciarParrafo = () => {
      if (lineasParrafo.length > 0) {
        resultado.push(`<p>${lineasParrafo.join('<br>')}</p>`);
        lineasParrafo = [];
      }
    };

    const vaciarLista = () => {
      if (itemsLista.length > 0) {
        resultado.push(`<ul>${itemsLista.map((it) => `<li>${it}</li>`).join('')}</ul>`);
        itemsLista = [];
      }
    };

    for (const linea of lineas) {
      const lineaRecortada = linea.trim();
      if (!lineaRecortada) continue;

      if (lineaRecortada.startsWith('- ')) {
        vaciarParrafo();
        const contenido = lineaRecortada.slice(2).trim();
        itemsLista.push(contenido.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
      } else {
        vaciarLista();
        lineasParrafo.push(lineaRecortada.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
      }
    }
    vaciarParrafo();
    vaciarLista();
  }

  return resultado.join('');
}
