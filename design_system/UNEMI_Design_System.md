# UNEMI — Design System

**Identidad, componentes digitales, patrones de navegación y diapositivas**  
**Documento de análisis y propuesta técnica · Edición 1.0 · 17 de octubre de 2026**

> **Alcance.** Esta guía se ha desarrollado a partir del sitio web de la Universidad Estatal de Milagro (fuente principal de arquitectura de información), el *Manual de Identidad Corporativa* publicado por la propia universidad (fuente normativa de identidad), las cuatro imágenes facilitadas y el material docente `MES-U1-T1.pdf` (referencias editoriales complementarias). **No es un design system oficialmente publicado o aprobado por UNEMI.** Se indica explícitamente qué normas proceden de la institución y qué decisiones de interfaz son propuestas de implementación.

## 1. Fuentes y jerarquía

| Nivel | Fuente | Aplicación | Evidencia |
|---|---|---|---|
| 1A · Principal web | [unemi.edu.ec](https://www.unemi.edu.ec/) | Menús, servicios, contenidos, noticias y estructura funcional | Portal consultado el 17-10-2026 |
| 1B · Normativa de marca | [Manual de Identidad Corporativa UNEMI](https://www.unemi.edu.ec/wp-content/uploads/2025/09/MANUAL-DE-IDENTIDAD-CORPORATIVA-V1.pdf) | Logotipo, familia tipográfica, cromática, restricciones, aplicaciones y submarca | Manual aprobado el 29-08-2025; edición disponible en sitio oficial |
| 2 · Diapositivas | `IMAGEN DESARROLLO.png`, `IMAGEN PANTALLA FINAL.png`, `IMAGEN PORTADA.png`, `patron-2.png` | Fondos, marca, composición 16:9 y zócalos | Imágenes originales suministradas |
| 3 · Material docente | `MES-U1-T1.pdf` (68 páginas) | Ejemplos de contenido didáctico, uso de imágenes y recursos de posgrados | Páginas 1, 5, 22, y otros ejemplos observados |
| 4 · Propuesta UI | Este documento y el HTML adjunto | Grid, escala de espaciado, componentes, estados, accesibilidad, tokens de implementación | Recomendaciones técnicas, **no normativas institucionales** |

**Regla de precedencia:** para la reproducción de marca prevalece el manual corporativo sobre los tratamientos particulares de una diapositiva, una captura o este diseño propuesto.

## 2. Principios de diseño

1. **Reconocimiento institucional:** emplear los identificadores oficiales con suficiente espacio de protección y sin modificar proporciones.
2. **Claridad:** colocar la información antes que los ornamentos; limitar saturación de componentes por pantalla.
3. **Consistencia:** aplicar una paleta uniforme a web, sistemas académicos y recursos formativos.
4. **Accesibilidad:** garantizar uso con teclado, jerarquía semántica y contraste de texto medible.
5. **Responsividad:** mantener legibilidad y operabilidad en móvil, tableta, ordenador y proyección.
6. **Trazabilidad:** separar decisiones derivadas del manual de decisiones de UI que deban validarse posteriormente.

Los valores institucionales publicados incluyen respeto, responsabilidad, solidaridad, sencillez, transparencia, honestidad y equidad.

## 3. Logotipo y marca — normativa institucional

El manual presenta el logotipo principal y sus variantes permitidas, su retícula constructiva, área de protección, escala de reproducción y usos incorrectos (aproximadamente págs. 8–18).

### 3.1 Tipografías internas del identificador

- **Aventura Heavy Bold** para la construcción del logotipo UNEMI.
- **Avenir LT Std 65 Medium** para el descriptor institucional.
- Estas dos tipografías no son una instrucción para *recrear* el logotipo mediante texto editable. Se recomienda utilizar siempre los archivos maestros autorizados.

### 3.2 Reglas de aplicación

- No deformar, rotar, estirar ni recolorear arbitrariamente el identificador.
- Conservar la composición, proporciones y área de seguridad determinadas por el manual.
- Emplear exclusivamente las variaciones del manual y verificar su aplicación sobre fondos claros y oscuros.
- Consultar las condiciones de reducción mínima del manual cuando la pieza sea impresa; **no se extrapola automáticamente una medida en centímetros a un mínimo de píxeles digitales**.
- Para el desarrollo web, publicar un recurso SVG o rasterizado de alta calidad que derive del arte maestro institucional aprobado, con atributo `alt` apropiado.
- **UNEMI Posgrados:** el manual establece que el logo institucional es el distintivo único para comunicaciones y títulos oficiales; la variante UNEMI Posgrados se reserva para comercializar los programas ofertados por la Facultad de Posgrados (pág. 61).

**Recursos oficiales:** [Carpeta de artes del manual](https://drive.google.com/drive/folders/1UQH7kzBoxOBhL9l3ZsAzYfeCUHOLMsM6). Los recortes de logo incluidos en el HTML se emplean **solo como ejemplos visuales extraídos de las referencias facilitadas** y deben sustituirse por estos artes antes de cualquier publicación definitiva.

## 4. Cromática institucional

### 4.1 Colores corporativos oficiales

| Token de marca | HEX oficial | Referencia Pantone | Uso sugerido |
|---|---|---|---|
| `--unemi-primary` | `#002E45` | 7463 C | Marca, títulos, encabezados, superficies oscuras |
| `--unemi-accent` | `#FF6900` | 1505 C | Acentos, líneas, indicadores y destacados |
| `--unemi-black` | `#222223` | Neutral Black C | Textos y contraste neutro |

**Referencia:** manual, sección «Cromática principal», pág. 12.

> **Inconsistencia documental detectada.** El manual imprime `RGB R:0 G:46 B:49` junto a `HTML #002E45`. El HEX `#002E45` corresponde matemáticamente a **RGB(0,46,69)**. Esta guía conserva literalmente el valor hexadecimal publicado como referencia digital y no reescribe el documento institucional.

### 4.2 Cromática derivada oficial

**Azules** (manual, «Cromática derivada», pág. 14):

| Nombre de token propuesto | HEX | Uso habitual propuesto |
|---|---|---|
| `--unemi-blue-900` | `#1C3247` | Fondo de presentación oscuro, paneles |
| `--unemi-blue-800` | `#264763` | Encabezados secundarios |
| `--unemi-blue-700` | `#335F7F` | Enlaces y navegación secundaria, previa prueba de contraste |
| `--unemi-blue-600` | `#3C7AA0` | Acentos gráficos sobre fondos adecuados |
| `--unemi-blue-500` | `#4597BF` | Decoración, gráficos y superficies de datos |

**Naranjas** (manual, pág. 14):

`#FC7E00` · `#EA7D06` · `#F48521` · `#F78D37` · `#F7964D` · `#FE9900` · `#DA8B33` · `#F28F19` · `#EF922E` · `#F49D47`.

El naranja `#FC7E00` aparece en los zócalos de los archivos de diapositivas aportados. **Son 15 tonos derivados listados**: cinco azules y diez naranjas.

### 4.3 Neutrales de interfaz — propuesta, NO paleta oficial

| Token | Valor | Función |
|---|---|---|
| `--ui-surface` | `#FFFFFF` | Tarjetas, módulos y fondos limpios |
| `--ui-canvas` | `#F5F7F8` | Fondo de aplicación |
| `--ui-soft` | `#EEF3F6` | Superficies alternativas |
| `--ui-border` | `#DFE7EC` | Bordes, divisores |
| `--ui-text` | `#182D3E` | Texto UI |
| `--ui-text-muted` | `#627586` | Metadatos, texto secundario |
| `--ui-focus` | `#1470A8` | Indicador de foco visible |

### 4.4 Uso cromático recomendado

- Azul corporativo sobre blanco: ideal para texto y enlaces principales.
- Blanco sobre azul oscuro: adecuado para navegación, rótulos y títulos.
- Azul corporativo sobre naranja institucional: adecuado para texto pequeño o botones según contraste calculado.
- **Evitar** blanco sobre naranja `#FF6900` y texto naranja pequeño sobre blanco en interfaces que deban cumplir WCAG AA.
- Reservar los naranjas vivos para acentos, separadores e iconografía no textual, o emplear una combinación textual de alto contraste.

## 5. Contraste de color — cálculo técnico

Los valores siguientes se calcularon a partir de los códigos HEX mediante la fórmula de luminancia relativa WCAG:

| Primer plano | Fondo | Relación | Texto normal (AA: ≥4,5:1) |
|---|---|---:|---|
| `#002E45` | `#FFFFFF` | 14,22:1 | Cumple AAA |
| `#222223` | `#FFFFFF` | 15,90:1 | Cumple AAA |
| `#1C3247` | `#FFFFFF` | 13,15:1 | Cumple AAA |
| `#002E45` | `#FF6900` | 4,92:1 | Cumple AA |
| `#FF6900` | `#FFFFFF` | 2,89:1 | **No cumple AA** |
| `#FC7E00` | `#FFFFFF` | 2,59:1 | **No cumple AA** |

Objetivo técnico recomendado: WCAG 2.2 AA, contraste 4,5:1 para texto normal, 3:1 para texto grande y 3:1 para componentes e indicadores visuales relevantes cuando corresponda.

## 6. Tipografía

### 6.1 Normativa publicada

- Familia principal para acompañar a la marca: **Poppins**; el manual enumera diferentes pesos y estilos (pág. 10).
- Familia alternativa: **Arial**, cuando no se disponga de la familia principal (pág. 11).
- Familia del logotipo y su descriptor: Aventura Heavy Bold / Avenir LT Std 65 Medium; reservadas para el arte de marca.

### 6.2 Escala para productos digitales — propuesta

| Rol | Tamaño preferido | Peso | Interlineado orientativo |
|---|---:|---:|---:|
| Display | 48–64 px | 700–800 | 1,08–1,16 |
| H1 | 36–44 px | 700 | 1,15–1,25 |
| H2 | 24–32 px | 700 | 1,20–1,35 |
| H3 | 18–24 px | 600 | 1,25–1,40 |
| Texto base | 16 px | 400–500 | 1,50–1,70 |
| Texto secundario | 14 px | 400 | 1,45–1,60 |
| Pie / metadatos | 12–14 px | 400–600 | 1,40–1,60 |

Ejemplo de implementación:

```css
body {
  font-family: Poppins, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #002E45;
}
h1 { font-size: clamp(2.25rem, 4vw, 2.75rem); font-weight: 700; }
```

**Nota:** el HTML incluye una importación opcional de Poppins mediante Google Fonts. Si se abre sin conexión o la importación se bloquea, funcionará con Arial. Los archivos tipográficos propietarios no forman parte de la entrega.

## 7. Espaciado, retícula y superficies — propuesta

**Unidad base:** 4 px. Escala recomendada: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px`.

| Contexto | Espaciado sugerido |
|---|---|
| Icono/etiqueta | 4–8 px |
| Controles compactos | 8–12 px |
| Tarjetas y paneles | 16–24 px |
| Agrupación de contenidos | 24–32 px |
| Secciones principales | 48–64 px |

**Breakpoints de desarrollo sugeridos:**

| Ancho | Retícula | Margen lateral |
|---|---|---|
| Menos de 768 px | 4 columnas | 16–24 px |
| 768–1199 px | 8 columnas | 32 px / flexible |
| Desde 1200 px | 12 columnas | Contenedor máx. 1280 px |

**Bordes sugeridos:** `4, 8, 12 y 20 px`. **Animaciones sugeridas:** `150–250 ms`, desactivables mediante `prefers-reduced-motion`.

Las dimensiones anteriores no son equivalentes a las retículas para impresión contempladas en las páginas 19–20 del manual. Estas últimas deben consultarse para papelería oficial.

## 8. Arquitectura de información — observada en la web principal

La navegación pública consultada presenta las siguientes categorías de primer nivel:

```text
UNEMI
├── Identidad
│   ├── Historia / Quiénes somos / Misión, visión y valores
│   ├── Autoridades y comisiones
│   ├── Planificación / Aseguramiento de la calidad
│   └── Sedes, extensiones y centros de apoyo
├── Admisión
├── Grado
│   └── Oferta: presencial / semipresencial / en línea / híbrida
├── Posgrado
├── Investigación
│   └── Líneas / proyectos / grupos / congresos / revistas / publicaciones
├── Vinculación
│   └── Servicios y actividades comunitarias
└── Sala de Prensa
```

El encabezado incorpora además enlaces utilitarios a servicios TIC, recursos electrónicos, transparencia y documentos institucionales.

### 8.1 Patrones de página identificados

| Patrón | Contenido identificado | Recomendación técnica |
|---|---|---|
| Header utilitario | Accesos y servicios | Navegación secundaria legible |
| Navegación de marca | Categorías principales y submenús | Menú responsivo, semántico y accesible |
| Noticias | Publicaciones con fecha | Tarjetas, titular y metadatos |
| Convocatorias | Avisos y documentos relacionados | Jerarquizar vigencia y acción |
| Servicios | CRAI, Bienestar Universitario, Admisión, Normativas | Tarjetas de acceso por área |
| Indicadores | UNEMI en cifras | Componente estadístico responsivo |
| Institucional | Valores, campus, programas académicos | Bloques editoriales con imágenes |
| Footer | Identidad, contactos y enlaces | Navegación de apoyo y datos de institución |

**Importante:** las cantidades publicadas en «UNEMI en cifras» son contenido vivo y deben obtenerse del sitio y no codificarse como tokens de diseño.

### 8.2 Estructura HTML semántica sugerida

```html
<header>
  <nav aria-label="Enlaces institucionales secundarios">...</nav>
  <nav aria-label="Navegación principal">...</nav>
</header>
<main id="contenido">
  <section aria-labelledby="titulo-principal">...</section>
  <section aria-labelledby="noticias">...</section>
  <section aria-labelledby="convocatorias">...</section>
  <section aria-labelledby="servicios">...</section>
</main>
<footer>...</footer>
```

## 9. Componentes de interfaz — propuesta

| Componente | Propósito | Estados o variantes |
|---|---|---|
| Botón principal | Acción más importante | default, hover, focus, active, disabled, loading |
| Botón destacado | CTA promocional | naranja con texto azul corporativo |
| Botón secundario | Acción auxiliar | outline, hover, focus, disabled |
| Enlace | Navegación entre contenidos | default, hover, focus, visited |
| Campo de texto | Capturar información | default, focus, invalid, disabled, readonly |
| Select | Escoger opciones | default, focus, disabled, invalid |
| Tarjeta | Resumir noticias, programas o servicios | contenido e interactiva |
| Tabs | Cambiar categorías de una vista | selected, unselected, focus, teclado |
| Accordion | Mostrar información complementaria | open, closed, focus |
| Diálogo/modal | Confirmar o detallar operaciones | open, closed, Escape, gestión de foco |
| Alerta | Informar al usuario | información, advertencia, error, éxito |
| Badge/tag | Clasificación y metadatos | neutra, destacada, contextual |
| Indicador de progreso | Mostrar estado de ejecución | determinado e indeterminado |
| Navegación/breadcrumb | Orientación jerárquica | active, expanded, collapsed |

### 9.1 Botones

```html
<button type="button" class="btn btn-primary">Consultar oferta</button>
<button type="button" class="btn btn-accent">Solicitar información</button>
```

```css
.btn { min-height: 44px; padding: 11px 18px; border-radius: 8px; font-weight: 700; }
.btn-primary { background: #002E45; color: #FFFFFF; }
.btn-accent  { background: #FF6900; color: #002E45; }
.btn:focus-visible { outline: 3px solid #1470A8; outline-offset: 3px; }
```

### 9.2 Formularios

- Incluir `label` y `id` asociados, instrucciones y errores visibles.
- Distinguir campos obligatorios y usar tipos de entrada adecuados.
- Facilitar autocompletado y avisos de confirmación con `aria-live` o `role="status"`.
- Validar de nuevo en el servidor antes de almacenar datos.
- No colocar datos personales de estudiantes en ejemplos o documentación pública.

### 9.3 Tarjetas y mensajes

- La tarjeta completa solo debe ser interactiva cuando existe una acción única y clara.
- No utilizar únicamente el naranja para indicar error o advertencia; incorporar texto e icono.
- Evitar sombras pronunciadas como único delimitador.
- Mantener consistencia de tamaños y padding entre listados de programas, servicios o noticias.

## 10. Identificadores de plataformas tecnológicas

El manual corporativo, págs. 50–53, define familias de iconos e identificadores para sistemas académicos, sistemas de gestión, aulas virtuales y herramientas (por ejemplo SGA, admisión, aulas virtuales y videoconferencia). Se describen como simples, modernos, claros y alineados con la paleta institucional.

**Pauta:** no sustituir esos identificadores oficiales con pictogramas arbitrarios si ya existe un recurso aprobado. Para iconos de acciones genéricas (buscar, descargar, imprimir), se puede proponer una familia lineal coherente, con trazo consistente y accesibilidad verificada.

## 11. Diapositivas y contenido académico

### 11.1 Referencias de imagen analizadas

| Archivo | Formato observado | Característica |
|---|---|---|
| `IMAGEN DESARROLLO.png` | 1920 × 1080 | Blanco texturizado, logo superior derecho, zócalo bicolor |
| `IMAGEN PANTALLA FINAL.png` | 1920 × 1080 | Fondo `#1C3247` aproximado, marca blanca centrada y franja naranja |
| `IMAGEN PORTADA.png` | 2048 × 1151 | Base clara, logo central superior, bloque azul inferior |
| `patron-2.png` | 1920 × 1080 | Patrón similar al desarrollo, diagonales suaves y tramado de puntos |

**Nota de precisión:** el azul del fondo visual puede fluctuar levemente por degradados y textura; el código `#1C3247` está documentado además como derivado en el manual. La franja inferior se corresponde aproximadamente con `#FC7E00`, también incluida en la paleta derivada.

### 11.2 Tipos de diapositiva recomendados

**A. Portada — estructura propuesta:**

- Fondo claro, contenido de alta prioridad en zona central.
- Logotipo institucional en lugar predominante, sin deformaciones.
- Título de unidad / asignatura / nombre del docente.
- Bloque azul de soporte inferior o pie cromático discreto.

**B. Desarrollo:**

- Fondo claro con textura sutil, nunca por delante del contenido.
- Logotipo de tamaño contenido en esquina superior derecha, con área libre.
- Título principal alineado a la izquierda, 1–2 líneas de preferencia.
- Cuerpo predominantemente gráfico con pocas líneas de texto por bloque.
- Franja azul/naranja en borde inferior.

**C. Separador de sección:**

- Título destacado, número de unidad o tema.
- Reserva de espacio para imagen o forma geométrica.
- Fotografía contextual y alto contraste con el texto.

**D. Cierre:**

- Fondo azul oscuro, identificador claro centrado, banda naranja inferior.
- No introducir elementos que invadan el área del logotipo.

### 11.3 Recursos didácticos observados en `MES-U1-T1.pdf`

El documento aportado contiene **68 páginas**. La portada (pág. 1) utiliza imagen tecnológica lateral y una jerarquía de unidad y asignatura; la página 5 organiza los subtemas con números y un elemento gráfico circular; la página 22 distribuye conceptos en tres columnas verticales de azul oscuro. Otras páginas utilizan títulos cálidos, fotografías, viñetas, recuadros, líneas de cabecera y pie. Estos recursos se consideran **estilos de una presentación concreta**, no sustitutos del manual vigente.

### 11.4 Reglas para elaborar nuevas diapositivas — propuesta

- Lienzo 16:9, preferiblemente 1920 × 1080 píxeles al exportar recursos rasterizados.
- Zona segura sugerida: 5–7 % de margen lateral, 7–10 % superior y 5–8 % inferior, adaptada a logotipo y zócalo.
- El logo debe tomarse del archivo maestro; no usar como archivo final un recorte de las capturas.
- Emplear títulos, cifras y diagramas legibles desde el fondo de un aula.
- No sobrecargar de texto o fotografías cada lámina.
- Añadir fuente o referencia bibliográfica al contenido científico y académico.
- Respetar una misma plantilla de elementos fijos (cabecera, pie, número de diapositiva si aplica).

## 12. Design tokens CSS listos para reutilizar

Los valores indicados como identidad proceden del manual; los restantes son propuestos.

```css
:root {
  /* IDENTIDAD INSTITUCIONAL — manual oficial */
  --unemi-primary: #002E45;
  --unemi-accent: #FF6900;
  --unemi-black: #222223;
  --unemi-blue-900: #1C3247;
  --unemi-blue-800: #264763;
  --unemi-blue-700: #335F7F;
  --unemi-blue-600: #3C7AA0;
  --unemi-blue-500: #4597BF;
  --unemi-orange-slide: #FC7E00;

  /* TOKENS PROPUESTOS PARA INTERFAZ */
  --ui-surface: #FFFFFF;
  --ui-canvas: #F5F7F8;
  --ui-soft: #EEF3F6;
  --ui-border: #DFE7EC;
  --ui-text: #182D3E;
  --ui-text-muted: #627586;
  --ui-focus: #1470A8;
  --ui-radius-xs: 4px;
  --ui-radius-sm: 8px;
  --ui-radius-md: 12px;
  --ui-radius-lg: 20px;
  --ui-space-1: 4px;
  --ui-space-2: 8px;
  --ui-space-3: 12px;
  --ui-space-4: 16px;
  --ui-space-6: 24px;
  --ui-space-8: 32px;
  --ui-space-12: 48px;
  --ui-space-16: 64px;
  --ui-font: Poppins, Arial, sans-serif;
}
```

## 13. Accesibilidad y control de calidad

### 13.1 Checklist recomendado

- [ ] Aplicar título `h1` único y una estructura correcta `h2`–`h6`.
- [ ] Asegurar navegación completa con teclado y foco perceptible.
- [ ] Verificar los contrastes en **todas** las combinaciones reales (incluidos estados de hover y foco).
- [ ] Identificar imágenes informativas con texto alternativo y silenciar las decorativas.
- [ ] Asociar las etiquetas de formulario a cada campo.
- [ ] Incluir mensajes de error con texto, no solo color.
- [ ] Comprobar reflujo en móvil y ampliación hasta 200–400 %.
- [ ] Respetar `prefers-reduced-motion`.
- [ ] Probar lectura con tecnologías de asistencia y la tabulación.
- [ ] Validar equivalencia entre el recurso de marca publicado y la última versión del manual.
- [ ] Documentar aprobación y origen de los recursos gráficos.

### 13.2 Revisión técnica antes de producción

Se recomienda contrastar cualquier implementación con el CSS efectivamente desplegado en el sitio, realizar pruebas en pantallas y navegadores reales, incorporar validación de contenido institucional y obtener la conformidad de Comunicación Institucional cuando se use el logo o material oficial.

## 14. Mantenimiento y gobernanza

| Responsable sugerido | Competencia |
|---|---|
| Comunicación Institucional | Validar archivos maestros, marca, versiones y usos restringidos |
| Dirección TIC / equipo de desarrollo | Tokens, componentes, accesibilidad y deuda técnica |
| Diseñadores UX/UI | Patrones, estados, jerarquía y diseño responsivo |
| Unidades académicas | Adaptación de plantillas dentro de las normas de marca |
| Equipo editorial | Calidad de noticias, fechas, enlaces y documentos |

**Ciclo de mantenimiento propuesto:** revisar arquitectura web y componente de navegación semestralmente; actualizar la guía al publicarse cambios del manual; versionar los tokens de marca de forma controlada; y registrar responsables y fecha de revisión.

## 15. Cómo usar los entregables

1. Abrir `UNEMI_Design_System.html` con un navegador moderno. Permite navegar por secciones, copiar colores y tokens, verificar modelos de componentes, probar un formulario local y alternar ejemplos de diapositivas. **Las imágenes de referencia están incrustadas y funcionan sin archivos gráficos externos**; Poppins se importa en línea cuando existe conectividad, con Arial como respaldo.
2. Usar `UNEMI_Design_System.md` como documentación de referencia para diseño, planificación de un repositorio de componentes o posterior conversión a otros formatos.
3. En el paquete ZIP complementario se incluyen las referencias gráficas optimizadas dentro de `assets/` para trabajar con ellas de manera separada. Los originales suministrados por el usuario mantienen su propia calidad y no son modificados.
4. Sustituir los logotipos visuales demostrativos por los recursos oficiales enlazados antes de publicar material institucional.

---

### Bibliografía y vínculos de origen

- Universidad Estatal de Milagro. [Sitio institucional](https://www.unemi.edu.ec/). Consultado el 17 de octubre de 2026.
- Universidad Estatal de Milagro. [*Manual de Identidad Corporativa* (PDF)](https://www.unemi.edu.ec/wp-content/uploads/2025/09/MANUAL-DE-IDENTIDAD-CORPORATIVA-V1.pdf). Documento aprobado mediante resolución OCS-SO-13-2025-No1 del 29 de agosto de 2025; consultado en octubre de 2026.
- Universidad Estatal de Milagro. [Carpeta de versiones oficiales del logotipo](https://drive.google.com/drive/folders/1UQH7kzBoxOBhL9l3ZsAzYfeCUHOLMsM6), enlazada desde el manual.
- Material aportado por el solicitante: cuatro imágenes de plantillas de diapositivas y documento `MES-U1-T1.pdf`, 68 páginas.

**Estado de esta guía:** propuesta documentada, no una política institucional ratificada por UNEMI. No sustituye al manual ni autoriza nuevas variaciones de marca.
