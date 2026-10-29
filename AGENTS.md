# AGENTS.md · Ecosistema Educativo Digital
Eres el desarrollador de este proyecto. Aplica estas reglas en todas tus respuestas.
 
## Producto
Identidad global: **NeuroRitmo Digital** (Misión Cerebro Sonoro, Tarea 3), guiada por Neuri. El Inicio
(index.html, raíz) es la experiencia NeuroRitmo con js/modulos/neuroritmo.js; /paginas/neuroritmo.html solo
redirige al Inicio; el catálogo de temas está en paginas/explorar.html. Diseño: tokens --nr-* de tokens.css
(design_system/design-system-neuroritmo.md). Nombre visible: NOMBRE de js/nucleo/plantilla.js.
Menú (js/nucleo/menu.js): grupo «Ruta de aprendizaje» en orden fijo; las opciones #mapa, #resultados y #panel abren vistas del Inicio.
Plataforma web educativa: contenidos (asignatura > unidad > tema), juegos con
retroalimentación, gamificación (puntos, insignias, diplomas), tutor IA socrático,
paneles, alertas, noticias, canciones, foros, mensajería, agenda y simulador.
Roles: estudiante, docente, admin. Interfaz en español (Ecuador).
 
## Tecnologías (no uses otras)
- Navegador: HTML5, CSS3 y JavaScript moderno SIN frameworks (no React, Vue, Angular,
  jQuery, Tailwind ni Bootstrap). Módulos ES (import/export).
  Por CDN solo: Chart.js, jsPDF, DOMPurify y FullCalendar.
- Servidor: Node.js 20+ con Express y módulos ES. npm solo: express, bcryptjs, dotenv, multer.
- Datos: archivos JSON en datos/ (bitácoras en .jsonl). Sin bases de datos.
 
## Estructura
servidor/  server.js, almacen.js, permisos.js, ganchos.js, acceso.js, auth.js,
           gamificacion.js, notificar.js, alertas.js, ia.js, esquemas-ia.js
servidor/rutas/<grupo>.js · servidor/ganchos/<col>.js · servidor/preparadores/<tarea>.js
           (se cargan solos al iniciar) · servidor/prompts/<tarea>.txt
datos/     <col>.json, config/, semilla/, mensajes/, respaldos/
publico/   index.html, paginas/, css/(tokens|base|componentes).css, css/modulos/,
           js/nucleo/, js/modulos/, recursos/
docs/      contratos.md (firmas, rutas y datos) · estado.md (avance)
 
## Reglas
1. Un módulo = paginas/<m>.html + css/modulos/<m>.css + js/modulos/<m>.js.
2. Datos solo con js/nucleo/api.js; nunca fetch directo en un módulo.
3. Estilos solo con variables de tokens.css y clases de componentes.css; nada de colores,
   fuentes ni tamaños fijos. Los componentes nuevos se agregan al final de componentes.css.
4. Toda actividad usa mostrarRetro() y registrarIntento(); puntos e insignias los
   calcula el servidor.
5. Permisos siempre en el servidor (permisos.json + ganchos). Un gancho rechaza lanzando
   un Error con la propiedad estado (403, 400...).
6. Texto de usuarios: util.formatoBasico() o ui.escapar(); HTML solo con ui.limpiar().
7. Responsive desde 360 px y accesible: label, alt, foco visible, teclado, contraste AA.
8. Nombres en español; archivos en minúsculas, sin tildes y con guiones;
   comentarios breves en español.
9. Consulta en docs/contratos.md solo las secciones que indique la tarea.
   No reimplementes funciones del núcleo: impórtalas.
10. Rutas nuevas en servidor/rutas/, reglas por colección en servidor/ganchos/ y menú en
    js/nucleo/menu.js. No edites server.js salvo que la tarea lo pida.
 
## Esqueleto de página
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/componentes.css">
<link rel="stylesheet" href="/css/modulos/<m>.css"></head>
<body><div id="plantilla"></div><main id="contenido" class="contenedor"></main>
<script type="module" src="/js/modulos/<m>.js"></script></body></html>
El JS de la página empieza con: await montarPlantilla({ titulo: "...", roles: [...] });
 
## Cómo responder (ahorro de tokens)
- Archivo nuevo: completo, con su ruta como título.
- Archivo existente: edítalo directamente si tienes acceso. Si no, entrega solo los bloques
  que cambian e indica dónde van (si el archivo tiene menos de 80 líneas, entrégalo completo).
- No repitas código que no cambia ni expliques lo que ya está en este archivo.
- Termina con "Cómo probar" en máximo 5 líneas.
- Si falta un dato imprescindible, pregunta en una sola línea antes de programar.
