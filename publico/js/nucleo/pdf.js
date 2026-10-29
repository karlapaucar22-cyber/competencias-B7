// publico/js/nucleo/pdf.js
// Diplomas en PDF (jsPDF desde cdnjs) a partir del certificado emitido por el servidor

import * as api from './api.js';
import * as util from './util.js';
import { NOMBRE } from './plantilla.js';

const URL_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let cargaJsPdf = null;

// Carga jsPDF una sola vez si aún no está en la página
function cargarJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  cargaJsPdf ||= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = URL_JSPDF;
    script.async = true;
    script.onload = () => (window.jspdf?.jsPDF ? resolver(window.jspdf.jsPDF) : rechazar(new Error('jsPDF no se inicializó')));
    script.onerror = () => {
      cargaJsPdf = null;
      rechazar(new Error('No se pudo cargar el generador de PDF; revisa tu conexión'));
    };
    document.head.append(script);
  });
  return cargaJsPdf;
}

// Color de tokens.css (#rgb, #rrggbb o rgb()) como [r, g, b]
function colorToken(nombre) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const hex = valor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const largo = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(largo.slice(i, i + 2), 16));
  }
  const rgb = valor.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return rgb.slice(1, 4).map(Number);
  throw new Error(`Falta el color ${nombre} en tokens.css`);
}

function dibujarDiploma(JsPDF, certificado, tipo) {
  const color = {
    primario: colorToken('--color-primario'),
    acento: colorToken('--color-acento'),
    accion: colorToken('--color-accion'),
    texto: colorToken('--color-texto'),
    suave: colorToken('--color-texto-suave'),
    fondo: colorToken('--color-fondo'),
    superficie: colorToken('--color-superficie')
  };
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const centro = ancho / 2;
  const enlace = `${window.location.origin}/paginas/verificar.html?codigo=${encodeURIComponent(certificado.codigo)}`;

  doc.setProperties({ title: `Diploma ${certificado.codigo}`, subject: certificado.detalle, author: NOMBRE });

  // Fondo y marco doble con esquinas
  doc.setFillColor(...color.fondo);
  doc.rect(0, 0, ancho, alto, 'F');
  doc.setFillColor(...color.superficie);
  doc.rect(13, 13, ancho - 26, alto - 26, 'F');
  doc.setDrawColor(...color.primario);
  doc.setLineWidth(2.5);
  doc.rect(8, 8, ancho - 16, alto - 16);
  doc.setDrawColor(...color.acento);
  doc.setLineWidth(0.8);
  doc.rect(13, 13, ancho - 26, alto - 26);
  doc.setFillColor(...color.acento);
  for (const [x, y] of [[13, 13], [ancho - 13, 13], [13, alto - 13], [ancho - 13, alto - 13]]) doc.rect(x - 3, y - 3, 6, 6, 'F');

  // Plataforma y título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...color.accion);   // el acento (amarillo) no es legible como texto sobre blanco
  doc.text(NOMBRE.toUpperCase(), centro, 32, { align: 'center', charSpace: 1.2 });
  doc.setFontSize(30);
  doc.setTextColor(...color.primario);
  const titulos = { 'nivel-quiz': 'Diploma de nivel', neuroritmo: 'Ruta NeuroRitmo completada' };
  doc.text(titulos[tipo] || 'Certificado de cumplimiento', centro, 50, { align: 'center' });
  doc.setDrawColor(...color.acento);
  doc.setLineWidth(1);
  doc.line(centro - 35, 56, centro + 35, 56);

  // Otorgado a · nombre · detalle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...color.suave);
  doc.text('Otorgado a', centro, 74, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...color.primario);
  doc.text(certificado.nombreCompleto || 'Estudiante', centro, 89, { align: 'center', maxWidth: ancho - 60 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...color.texto);
  const lineas = doc.splitTextToSize(certificado.detalle, 210);
  doc.text(lineas, centro, 106, { align: 'center', lineHeightFactor: 1.4 });

  doc.setFontSize(12);
  doc.setTextColor(...color.suave);
  const yFecha = 106 + lineas.length * 7 + 12;
  doc.text(`Fecha de emisión: ${util.fechaLarga(certificado.fecha)}`, centro, yFecha, { align: 'center' });

  // NeuroRitmo: puntuación por misión y huella verificables en la página de verificación
  if (certificado.puntuacion) {
    const p = certificado.puntuacion;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color.texto);
    doc.text(`Puntuación: M1 ${p.m1} · M2 ${p.m2} · M3 ${p.m3} (validada por el docente) · Total ${p.total}/${p.maximo}`, centro, yFecha + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...color.suave);
    doc.text(`Huella de integridad: ${certificado.huella}`, centro, yFecha + 15, { align: 'center' });
  }

  // Código y dirección de verificación
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...color.primario);
  doc.text(`Código de verificación: ${certificado.codigo}`, centro, alto - 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...color.suave);
  const prefijo = 'Verifica su autenticidad en: ';
  const anchoTotal = doc.getTextWidth(prefijo + enlace);
  const x = centro - anchoTotal / 2;
  doc.text(prefijo, x, alto - 26);
  doc.setTextColor(...color.primario);
  doc.textWithLink(enlace, x + doc.getTextWidth(prefijo), alto - 26, { url: enlace });

  return doc;
}

/**
 * Emite (o recupera) el certificado en el servidor y descarga el diploma en PDF.
 * @param {{ tipo: "cumplimiento" | "nivel-quiz" | "neuroritmo", temaId?: string, nivel?: number }} datos
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo, temaId, nivel }) {
  const [certificado, JsPDF] = await Promise.all([
    api.llamar('POST', '/api/certificados', { tipo, temaId, nivel }),
    cargarJsPdf()
  ]);
  dibujarDiploma(JsPDF, certificado, tipo).save(`diploma-${certificado.codigo}.pdf`);
  return { codigo: certificado.codigo };
}

export default { generarDiploma };
