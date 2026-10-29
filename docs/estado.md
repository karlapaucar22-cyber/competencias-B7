# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S__ · Fecha: AAAA-MM-DD · Velocidad real: __ puntos
 
## Funciona
- Servidor base Express con módulos ES y API genérica (/api/:col y /api/:col/:id).
- Almacenamiento asíncrono seguro (almacen.js) con colas por archivo, escrituras atómicas (.tmp + rename), generación de IDs (3 letras + 6 dígitos) y respaldo diario rotativo (14 días).
- Sistema de permisos (permisos.js) y ganchos modulares (ganchos.js).
- Núcleo del navegador (publico/js/nucleo/): api.js, ui.js, util.js, menu.js y plantilla.js (encabezado, menú lateral responsivo y pie con año).
- Página principal (index.html) con catálogo de asignaturas, unidades y temas (según sesión y rol), buscador en tiempo real y visor modal de contenidos pedagógicos.
- Sistema de diseño en CSS (publico/css/): tokens.css, base.css (diseño general y responsivo < 768 px) y componentes.css.
- Autenticación servidor y cliente: sesiones, bitácora, sesion.js, bitacora.js, páginas de ingreso, registro de estudiantes y aviso de privacidad (LOPDP).
- Subida de archivos (POST /api/subidas con multer: imágenes, PDF y MP3 según rol), Mi perfil y Administración de usuarios.
- Acceso por grupo y distributivo (servidor/acceso.js), permisos de colecciones académicas y ganchos de filtrado/validación (asignaturas, distributivo, unidades, temas, glosario, progreso-temas).
- Datos de prueba y semilla (datos/semilla/ y servidor/semilla.js con npm run semilla) basados en la asignatura de posgrado de Neuroeducación y Desarrollo Cognitivo Musical.
- Módulos administrativos de Asignaturas (tarjetas, modal crear/editar, validación de eliminación sin grupos) y Distributivo (tabla, modal con buscador de estudiantes, casillas y contador) para rol admin.
- Editor de contenidos pedagógicos (paginas/editor-contenidos.html): selector de asignaturas permitidas, gestión de unidades (agregar, renombrar, reordenar con orden, alternar visibilidad) y gestión de temas (agregar en borrador, reordenar, alternar borrador/publicado y enlace a editor-tema.html).
- Editor de ficha de tema y glosario (paginas/editor-tema.html): edición completa de objetivos, resumen (con contador de palabras y formato básico), ejemplos, errores, preguntas guía, recursos (con subida api.subir), palabras clave, dificultad, fuentes, estado, aviso de cambios sin guardar y glosario con cálculo de 6 letras e indicador de apto para juegos.
- Contenidos y Estudiantes (P02.6): catalogo-actividades.js, asignaturas, asignatura, tema con recursos multimedia y progreso-temas.
- Noticias y Canciones (P03.1, P03.2): noticias con insignia no leídas, canciones con reproductor <audio>, LRC y ganchos.
- Gamificación y Ahorcado (P04.1-P04.3): motor en servidor, cliente, actividades.html y ahorcado.html (términos de 6 letras, globo SVG desinflable, teclado físico/pantalla, retroalimentación e intentos).

## Decisiones y cambios respecto a docs/contratos.md
- Ninguno. Implementado estrictamente según §A, §B, §C, §D y §E.

## Problemas conocidos
- Ninguno.

## Pendiente para el siguiente sprint
- Juego 1: Crucigrama educativo con retroalimentación y gamificación (P05.1).

## NeuroRitmo: Misión Cerebro Sonoro (adaptación a la Tarea 3)
- Módulo neuroritmo (página, CSS y JS) con ruta Inicio → Instrucciones → Mapa → Actividades → Retroalimentación → Resultados y Neuri (cerebro con audífonos) como avatar guía.
- M1 Detectives de la atención (simulador «Sala de estudio sonora» con 3 tareas, hipótesis y predicción, quiz situacional y tarjetas de argumento); M2 Laboratorio de la memoria (6 parejas volteables, canción con 4 huecos, caso y decisión aplicada); M3 Crea tu misión musical (4 bloques, secuencia ordenable, lista de cotejo, «Revisa mi borrador» y valoración docente con rúbrica).
- Corrección en el servidor (datos/config/neuroritmo.json), 100 por misión (60 + 40), desbloqueo con 70, mejor puntaje conservado, insignias, alertas, panel docente por concepto y certificado «Ruta NeuroRitmo completada».
- IA «Pregúntale a Neuri» (tarea neuri): pistas graduadas, «Explícame el error» y revisión del borrador; nunca da la respuesta ni califica; pistas predefinidas como respaldo.
- Recursos reales de la Tarea 2: screencast e infografía (Genially/Canva) y matriz de autodiagnóstico.
- Pruebas: pruebas/neuroritmo.test.js (13) + API extremo a extremo + interfaz en Edge (escritorio y 360 px).

## Design System global NeuroRitmo
- tokens.css: las variables --color-* toman la paleta NeuroRitmo (--nr-*); nuevos --color-accion, --color-fondo-*, --color-velo, --color-foco y degradados.
- base.css: encabezado con logotipo y franja de color, menú lateral claro por secciones con iconos (menu.js: icono y grupo), cajón móvil y pie petróleo.
- componentes.css: botones en píldora, tarjetas, formularios, tablas, alertas, modales, insignias, progreso y migas de pan (.migas-pan, ahora global).
- neuroritmo.css solo conserva los componentes propios del módulo.

## NR-00.2 · Punto de restauración y estado actual (26 de octubre de 2026, 18:05)
- Control de versiones: el proyecto NO usa Git (no existe .git y el comando git no está instalado), por lo que no es posible listar «cambios sin guardar» como en Git; todos los archivos están guardados en disco.
- Respaldo: NR-00.2_20261026-1805, en ..\RESPALDOS-B7\NR-00.2_20261026-1805 (carpeta hermana del proyecto).
  1205 archivos, 76,2 MB (incluye datos, node_modules, .env y Tareas). Verificado archivo por archivo con SHA-256: 1205/1205 coinciden.
  MANIFIESTO.sha256 (huella del manifiesto 85d8db62…129ee8) e INFORME.json dentro de la carpeta. Contiene .env con la clave de IA: no compartirlo.
  Restaurar: detener el servidor y copiar el contenido de proyecto/ sobre la carpeta del proyecto.
- Arranque: npm start (= node servidor/server.js, Node v24.20.0); en ejecución en http://localhost:3000. Pruebas: npm test.
- Validación en localhost: /index.html, /paginas/neuroritmo.html, /js/modulos/neuroritmo.js y /css/tokens.css → 200; /api/neuroritmo sin sesión → 401 (esperado).
  Validación funcional: ingresar como estudiante1@demo.ec (Demo12345) → menú NeuroRitmo → Comenzar aventura.
- Bloqueos conocidos (inventario NR-00.1): banco de preguntas con 4 preguntas (quiz y certificado de cumplimiento inalcanzables), audio de la canción de 12 bytes,
  paisaje-sonoro.mp3 inexistente, video de tem_000001 con enlace de relleno, matrícula en NeuroRitmo solo por distributivo (dis_000001),
  glosario insuficiente para ahorcado y parejas en varios temas. Las secciones anteriores de este archivo («Problemas conocidos: ninguno»,
  «Pendiente: crucigrama») quedaron desactualizadas.

## NR-01.1 · NeuroRitmo Digital como identidad global (26 de octubre de 2026)
- Nombre visible de la plataforma: «NeuroRitmo Digital» (NOMBRE en plantilla.js, títulos de todas las páginas, guía de estilos, privacidad, aviso de agenda y ajustes.json → nombrePlataforma). Los identificadores técnicos de despliegue (PM2 «ecosistema», nginx-ecosistema.conf) no cambian.
- Inicio (/ e /index.html) = experiencia NeuroRitmo con Neuri: bienvenida, instrucciones, mapa, actividades, retroalimentación, resultados y panel docente (#panel). Sin sesión muestra la portada pública (GET /api/neuroritmo/presentacion, sin ítems ni respuestas) e invita a ingresar o registrarse.
- /paginas/neuroritmo.html redirige a /index.html conservando la consulta y la sección (?grupoId=…#panel). Las notificaciones nuevas enlazan a /index.html.
- Menú: se quitó la pestaña redundante «NeuroRitmo»; «Inicio» (icono Neuri) cubre su función. El catálogo de temas y las noticias destacadas del antiguo Inicio pasaron a «Explorar temas» (paginas/explorar.html). Se retiraron inicio.js e inicio.css (respaldo NR-01.1_antes_20261026-1812).
- Roles, sesiones y permisos sin cambios. Reglas del proyecto actualizadas en AGENTS.md (Producto) y docs/contratos.md (§F).

## NR-01.2 · Menú global por rol (26 de octubre de 2026)
- Ruta de aprendizaje (estudiante, en orden): Inicio · Explora y aprende · Mapa de misiones (/index.html#mapa) · Actividades · Canciones · Pregúntale a Neuri (/paginas/tutor.html) · Mi progreso · Certificado (/index.html#resultados).
- Fuera de la ruta: Más para aprender (Mis asignaturas, Simulaciones), Comunidad (Noticias, Foros, Agenda, Mensajes) y Mi cuenta (Mi perfil, Verificar certificado). No se suprimió ninguna opción.
- Docencia (docente y admin): Editor de contenidos · Banco de preguntas · Seguimiento (panel-docente.html) · Validación de Misión 3 (/index.html#panel). Administración sin cambios.
- plantilla.js marca la opción activa según la ruta y el #hash (se actualiza en hashchange) y cierra el menú móvil al elegir una opción; el menú móvil queda por encima del avatar flotante.
- El tutor IA se presenta como «Pregúntale a Neuri» (título, rótulo y avatar); su lógica, prompt y permisos (solo estudiante) no cambian. Permisos de páginas y servidor sin cambios.

## NR-01.3 · Identidad visual global verificada (26 de octubre de 2026)
- tokens.css centraliza todos los colores: no quedan valores literales en base.css, componentes.css ni css/modulos/ (nuevos tokens --color-velo-claro, --color-superficie-translucida, --color-borde-inverso, --color-realce-inverso y --color-fondo-video).
- Se definieron alias para 19 variables que los módulos usaban sin existir (--linea-*, --texto-*, --sombra-s/m/l, --espacio-xxl, --tamano-4xl, --color-alerta, --color-peligro); el navegador ignoraba esas declaraciones (sombras, interlineados, tamaños y colores de estado del ahorcado).
- Correcciones de contraste AA: etiqueta «Nuevo» de noticias (petróleo sobre amarillo), separador del encabezado y antetítulo de la portada sobre el degradado celeste→menta (--nr-azul).
- Coherencia editor/estudiante: campos de listas y recursos del editor de temas con el mismo estilo de campo; título del ahorcado con el color y tamaño de los títulos.
- Auditoría automática (44 páginas, 4 roles): 2803 textos con contraste AA, foco visible en 868/868 elementos con Tab, 360 px sin desbordamiento, sin errores de consola; botones, tarjetas, campos, tablas y menú activo idénticos en todas las páginas.

## NR-01.4 · Recorrido del storyboard (27 de octubre de 2026)
- El Inicio sigue las ocho funciones del storyboard de la Tarea 3 como vistas del mismo módulo (sin módulos nuevos): Bienvenida (#inicio) · Instrucciones · Mapa de misiones · Actividad · Retroalimentación · Progreso (#progreso, nueva) · Resultados · Reiniciar o cancelar (#reiniciar, nueva; antes era un modal en Resultados).
- Cada vista termina con «Anterior / Siguiente» y «Paso n de 8» (visitante: 3 pasos; docente: Bienvenida, Instrucciones, Mapa y Panel). En una actividad en curso solo se ofrece volver al mapa.
- Progreso: medidor por misión, meta 70/100 marcada e insignia obtenida o pendiente. Reiniciar o cancelar: repetir o reiniciar el intento de una misión, volver a la bienvenida (sin borrar puntajes ni insignias) o cancelar y volver a la vista anterior.
- Instrucciones muestra «Antes de empezar»: objetivo, tiempo estimado (nuevo campo duracion de neuroritmo.json: «60 a 75 min», de la Tarea 3), normas y sonido silenciado por defecto con la canción como texto.
- No se generó contenido nuevo de misiones; las vistas reutilizan barraProgreso, medidorCircular, neuriDice, insigniasHtml y abrirMision.

## NR-01.5 · Comprobación integral de identidad (27 de octubre de 2026)
- Rastreo automático por rol siguiendo menú y enlaces internos (estudiante 25 páginas, docente 29, admin 38, visitante 5): ninguna página muestra «Ecosistema Educativo», colores de la paleta UNEMI anterior ni un título sin «NeuroRitmo Digital», salvo la guía de estilos (ver pendientes). Sin errores de consola.
- Raíz y cinco páginas representativas verificadas (título, marca enlazada al Inicio, logotipo ♪, pie, fondo, menú «Ruta de aprendizaje»): /, ahorcado (actividad), canciones, mi-progreso, editor-tema (editor), panel-docente y validación M3 (docente).
- Corregido: título de los hilos del foro (añade «NeuroRitmo Digital»), «Explora y aprende» con título, encabezado y texto inicial coherentes con el menú, subtítulo del editor de noticias y comentarios de código con el nombre anterior.
- Navegación: «Privacidad» en Mi cuenta (todos los perfiles; antes inaccesible con sesión) y «Guía de estilos» en Administración (admin), con la marca de la guía enlazada al Inicio.
- Recursos internos alcanzables solo desde su módulo (por función y rol, sin pestaña propia): juegos y quiz desde Actividades; tema y asignatura desde Explora y aprende / Mis asignaturas; noticia desde Noticias; hilo desde Foros; simulador desde Simulaciones; editores de tema, canción, noticia y simulación desde Editor de contenidos, Canciones, Noticias y Simulaciones.

### Rutas que aún faltan o quedan fuera (sin declarar completitud)
- /paginas/guia-estilos.html: identidad NeuroRitmo y accesible para admin, pero es una página independiente sin el encabezado ni el menú comunes (no usa plantilla.js). Pendiente decidir si se migra a la plantilla.
- /paginas/prueba-datos.html: página de prueba del primer sprint; no funciona (colección «prueba» sin permisos → 403) y no está en la navegación. Pendiente decidir si se corrige o se retira.
- /paginas/neuroritmo.html: solo redirige al Inicio (intencionado).
- Fuera de alcance por rol (intencionado): ingreso y registro solo sin sesión; tutor, mi-progreso y quiz solo estudiante (y admin); páginas de docencia y administración según su rol.

## NR-02.1 · Asignatura y unidad «La Música en la Educación» (27 de octubre de 2026)
- Asignatura: ya existía «FUNDAMENTOS DE NEUROEDUCACIÓN Y DESARROLLO COGNITIVO MUSICAL» (asi_000001); se reutiliza (crear asignaturas es exclusivo del admin).
- Unidad «La Música en la Educación»: no existía; creada por API con la sesión de docente1 (usu_000002) → uni_000007, asignaturaId asi_000001, orden 3, visible:false (oculta hasta que tenga temas; el docente la muestra desde el Editor de contenidos). Script idempotente: busca por título normalizado y reutiliza el id; la segunda ejecución no crea nada.
- Sin cambios en uni_000001 (temas 1.1 y 1.2) ni uni_000002 (misiones); la nueva unidad aún no tiene temas.
- ganchos/unidades.js: título obligatorio al crear (400); sin títulos duplicados por asignatura, sin distinguir tildes ni mayúsculas (409); al editar exige permiso sobre la asignatura de origen y la de destino; al eliminar exige permiso sobre la asignatura (antes cualquier docente podía eliminar unidades de cualquier asignatura).
- Verificado: el docente edita por API y desde el Editor (mostrar/ocultar); el estudiante recibe 403 al crear, editar o eliminar, y no ve la unidad oculta (404 por id); un docente ajeno recibe 403.

## NR-02.2 · Tema y subtemas de «La Música en la Educación» (27 de octubre de 2026)
- Tema oficial único: «Fundamentos de Neuroeducación y Desarrollo Cognitivo Musical» (tem_000012), orden 1 y estado publicado, asociado a uni_000007.
- El contrato de `temas` no define subtemas. Los apartados 1.1 «Procesamiento cerebral y funciones ejecutivas en la escucha y práctica musical» y 1.2 «Impacto socioemocional y autorregulación a través de las artes» se representan como secciones identificadas dentro del resumen del tema; no se crearon temas oficiales adicionales.
- Objetivo: justificar la estrategia sonora o el silencio según las demandas de la tarea, considerando atención, memoria de trabajo, control inhibitorio y autorregulación.
- La unidad permanece oculta; su publicación para estudiantes sigue siendo una decisión explícita del docente desde el Editor de contenidos.
- Complemento (sesión de verificación): el script idempotente reutilizó tem_000012 sin reemplazar su contenido y solo completó `recursos`, que estaba vacío, con los recursos reales de Tarea 2: «1.1 · Neurociencia Sonora…» (Genially 6aca29b16ddf6a28c8dadcaf) y «1.2 · Mapeo Socioemocional…» (Genially 6ac9441095a03db4389b6f2f).
- ganchos/temas.js: título obligatorio al crear (400); sin títulos duplicados por unidad, sin distinguir tildes ni mayúsculas (409); al editar y al eliminar exige permiso sobre la asignatura de origen. Antes, cualquier docente podía eliminar temas de cualquier asignatura.
- Verificado (25 comprobaciones): un solo tema en uni_000007; ningún tema extra 1.1/1.2. El docente edita por API y desde el Editor, y guardar sin cambios conserva el contenido. La vista muestra las secciones, el objetivo y los enlaces. El estudiante recibe 403 al crear, editar o eliminar y 404 al leer el tema, y el Editor lo redirige. Un docente ajeno recibe 403. npm test: 135 pasan, 0 fallan y 2 se omiten.
- Pendiente de decisión: uni_000001 conserva tem_000001 y tem_000002, con títulos casi iguales a los subtemas y con glosario, preguntas, canción, simulación e intentos asociados. No se movieron ni se borraron.

## NR-02.3 · Lección del subtema 1.1 (27 de octubre de 2026)
- `tem_000012` contiene la lección 1.1 con meta de aprendizaje, explicación sustentada, vocabulario, caso de lectura/estudio, cuatro precauciones de interpretación, dos preguntas de reflexión, fuentes y repaso directo en `/index.html#mision-m1`.
- Afirmaciones y referencias proceden exclusivamente de «NeuroRitmo: Misión Cerebro Sonoro. Proyecto académico final», apartados A.4 y B.1, y de sus referencias entregadas: Diamond (2013), Kämpfe et al. (2011), Meneses Granados (2019) y Vasilev et al. (2018). Se conservaron los dos recursos Genially añadidos en NR-02.2.
- El contenido evita reglas universales: distingue efectos promedio de predicción individual y preferencia o motivación de evidencia de comprensión. No se añadieron autores ni enlaces externos ajenos a los documentos.
- Estado cambiado a `borrador` porque el documento fuente exige aprobación docente de la corrección científica y la redacción final. La unidad `uni_000007` continúa oculta.
- El visor de tema ahora presenta el estado BORRADOR y muestra los campos existentes `erroresFrecuentes`, `preguntasGuia` y `fuentes`; los enlaces internos navegan en la misma pestaña.
- Verificado: docente lee el tema (200), estudiante recibe 404 y no lo obtiene en la lista; el destino de Misión 1 responde 200. No se probó lectura estudiantil porque no está publicado. `npm test`: 135 pasan, 0 fallan y 2 se omiten.

## NR-02.4 · Lección del subtema 1.2 (27 de octubre de 2026)
- Creada mediante la API autenticada del editor y el almacenamiento seguro como `tem_000013`, orden 2 de `uni_000007`: «1.2 · Impacto socioemocional y autorregulación a través de las artes».
- Incluye objetivo, introducción, relación entre sonido y experiencia emocional, estrés percibido, estrategias de autorregulación, diferencias individuales, tres ejemplos académicos, dos preguntas de reflexión y un caso para justificar música suave, pausa sonora o silencio.
- La explicación no atribuye mejoras universales de concentración, memoria o rendimiento. Se fundamenta solo en Kämpfe et al. (2011), de Witte et al. (2020) y los apartados 2, A.4, B.1/M1-I3 y B.3 del proyecto académico entregado.
- Recursos: infografía Genially 1.2 ya disponible, Misión 1 (`/index.html#mision-m1`) y Misión 3 (`/index.html#mision-m3`).
- Estado `borrador` hasta revisión docente; la unidad permanece oculta. No se modificó `tem_000012` ni otra lección.
- Verificado: editor docente, tema y ambos destinos responden 200; estudiante recibe 404 y no ve el tema en la lista. JSON y JavaScript válidos. `npm test`: 135 pasan, 0 fallan y 2 se omiten.

## NR-02.5 · Fichas e inventario de recursos reales (27 de octubre de 2026)
- `docs/fuentes-neuroritmo.md` consolida siete fichas sin duplicados: cinco recursos didácticos, matriz de autodiagnóstico e índice navegable. Cada ficha registra título, autoría, tipo, subtema, objetivo, duración/uso, URL o archivo, licencia/atribución y estado de acceso.
- Verificación externa: Genially 1.1 y 1.2, Padlet, índice Netlify, carpeta específica Drive y BandLab responden 200; los dos enlaces Canva responden 403; NotebookLM y la carpeta general Drive exigen iniciar sesión.
- La matriz solo existe dentro de las páginas 34–35 del informe de Tarea 2. Su archivo y autoría independiente quedan pendientes de entrega/confirmación. El micropódcast y la lección DUA también quedan pendientes de archivo o enlace público.
- La licencia CC BY-NC-SA 4.0 se registra como declarada por el informe, no como verificada en cada plataforma. El índice muestra © 2026 UNEMI y no una licencia CC comprobable.
- Corregida la duplicación: `datos/config/neuroritmo.json` ya no usa la URL del screencast para la matriz; queda con URL vacía y estado `pendiente`. Inicio y Misión 3 muestran «Pendiente de entrega» sin bloquear la actividad.
- Se documenta la inconsistencia del informe: cuatro formatos en la matriz 3.1, pero cinco recursos en las fichas y el índice. `npm test`: 136 pasan, 0 fallan y 2 se omiten (138 pruebas).

## NR-02.6 · Explora y aprende integrado con NeuroRitmo (27 de octubre de 2026)
- `paginas/explorar.html` conserva el catálogo general y añade al inicio la ruta académica NeuroRitmo: presentación, unidad «La Música en la Educación», tema, duración, objetivo general y subtemas 1.1/1.2 con sus objetivos.
- Cada subtema enlaza con las misiones que lo aplican. La vista de la lección solo aparece cuando el rol puede leer el tema; los borradores muestran «Lección en revisión» para estudiantes.
- Tres tarjetas reutilizan los recursos configurados: screencast, infografía y matriz. Todas explican su utilidad; los recursos verificables abren en otra pestaña y la matriz muestra «Recurso pendiente de publicación» sin enlace.
- La retroalimentación vacía, la de Misión 1/2 y la de Misión 3 incluyen «Volver a contenidos» hacia `/paginas/explorar.html#ruta-academica`.
- Se usaron tarjetas, botones, insignias y alertas globales; el CSS del módulo solo organiza la composición responsive.
- Verificado en Chrome con emulación 360 px: `scrollWidth = innerWidth = 360`, dos subtemas, tres recursos, cero enlaces vacíos y enlaces M1/M3 presentes. Evaluaciones y calificaciones sin cambios. `npm test`: 136 pasan, 0 fallan y 2 se omiten.

## NR-02.7 · Consistencia, aprobación y publicación de contenidos (27 de octubre de 2026)
- Jerarquía verificada (sin huérfanos): asi_000001 → grupo dis_000001 (docente usu_000002, 6 estudiantes) → uni_000007 «La Música en la Educación» (oculta) → tem_000012 (subtema 1.1, borrador) y tem_000013 (subtema 1.2, borrador). Todos los temas publicados tienen resumen, objetivos y recursos completos. Genially 1.1 y 1.2 responden 200; las rutas internas de misiones existen.
- Huecos corregidos (comprobados antes de corregir):
  - `GET /api/glosario/:id` devolvía al estudiante términos de un tema en borrador (200). Ahora asignaturas, glosario y canciones por id aplican filtrarLista (404), como temas, unidades y noticias.
  - Un docente ajeno podía eliminar términos de glosario (200) y canciones de otra asignatura. Ahora recibe 403.
  - El estudiante veía simulaciones publicadas de temas en borrador o de unidades ocultas. Ahora se ocultan.
  - El Editor del tema mostraba el tipo de recurso «actividad» como «Lectura»: al guardar lo habría convertido. Se añadió la opción «Actividad».
- Publicación: el docente del grupo publica o despublica desde el Editor de contenidos y el Editor del tema. El servidor rechaza publicar (400) sin resumen, sin objetivos o con recursos sin título o enlace válido. Nunca cambia un estado por sí mismo.
- No se publicó ni modificó ningún contenido: tem_000012, tem_000013 y uni_000007 quedan idénticos.
- Pruebas:
  - `pruebas/contenidos.test.js`: 21 pruebas unitarias de publicación, permisos y visibilidad. `npm test`: 157 pasan, 0 fallan y 2 se omiten (159 en total).
  - Prueba de extremo a extremo, por HTTP y en el navegador, con docente1 y estudiante1: 28 de 28. Incluye el acceso del estudiante a borradores (404 por API, sin contenido por URL, «Lección en revisión» en Explorar) y un estudiante fuera del grupo (no ve temas publicados ni la asignatura).
- Disponible para estudiantes: asi_000001 con uni_000001 y uni_000002 (tem_000001 a tem_000005 publicados) y asi_000002. La ruta «La Música en la Educación» aparece en Explorar con los subtemas «Lección en revisión», recursos Genially y misiones.
- Requiere validación académica antes de publicar:
  1. Corrección científica y redacción final de tem_000012 y tem_000013 (marcados como BORRADOR por el documento fuente).
  2. Estructura: tem_000012 se titula como el tema «Fundamentos…», pero contiene la lección 1.1, mientras que 1.2 se titula «1.2 · …». Además, tem_000012 conserva el recurso de la infografía 1.2, añadido en NR-02.2.
  3. Mostrar uni_000007 a los estudiantes (decisión del docente).
  4. Papel de tem_000001 y tem_000002 (uni_000001), con títulos casi iguales a 1.1 y 1.2 y con un video de relleno y un audio inexistente.
  5. Pendientes de recursos de `docs/fuentes-neuroritmo.md`: matriz, micropódcast, lección DUA y licencias.
- Datos residuales no tocados: `progreso-temas` prg_1 y prg_2 apuntan a temas y usuarios inexistentes (tem_m1, tem_l1); ya estaban en respaldos anteriores.

## NR-02.8 · Recorrido integral con cuenta estudiante nueva (27 de octubre de 2026)
- Cuenta creada por el registro público y matriculada por la API administrativa normal: `usu_000010`, `estudiante.nr028.curl@demo.ec`, rol estudiante, grupo `dis_000001`. La API de NeuroRitmo reconoce el rol y no devuelve `sinGrupo`; no se iniciaron misiones ni se alteraron puntos.
- Corrección de navegación demostrable: las tarjetas 1.1 y 1.2 de Explora ahora despliegan una explicación y un ejemplo académico sustentados en las lecciones existentes. Si el tema no es legible para el rol, ya no promete acceso al iniciar sesión: muestra «Lección completa pendiente de aprobación docente».
- Recorrido aprobado en Chrome headless: Inicio con Neuri y objetivo → menú «Explora y aprende» → unidad «La Música en la Educación» → tema general → dos explicaciones desplegables → dos Genially con URL real y matriz pendiente sin enlace → mapa con tres misiones. La retroalimentación ofrece «Volver a contenidos».
- Sesión comprobada entre Inicio y Explora. A 360 × 740 px, Inicio/mapa y Explora no generan desbordamiento horizontal; el menú móvil abre, actualiza `aria-expanded` y conserva «Explora y aprende». Cero excepciones JavaScript en el recorrido.
- Visibilidad segura: la cuenta ve `asi_000001`, pero la API no expone `uni_000007`, `tem_000012` ni `tem_000013`; continúan respectivamente oculta y en borrador. Explora ofrece solo una síntesis marcada como pendiente, no presenta las lecciones como publicadas.
- No se puede certificar que **todas** las tarjetas del catálogo completo tengan recursos reales: `tem_000001` aún enlaza `https://youtu.be/ejemplo-neurosonoro` y `tem_000002` anuncia `/recursos/subidas/paisaje-sonoro.mp3`, archivo inexistente. Son otras lecciones y no se modificaron.
- Pendientes exactos: aprobación científica/redaccional de `tem_000012` y `tem_000013`; decisión docente de mostrar `uni_000007`; entrega y confirmación de autoría de la matriz; carga o sustitución validada del video y MP3 anteriores. También siguen pendientes el micropódcast, la lección DUA y la verificación de licencias documentados en `docs/fuentes-neuroritmo.md`.
- Evidencia automatizada reproducible: `pruebas/nr-02.8-e2e.mjs`. Sintaxis JavaScript válida; `npm test`: 157 pasan, 0 fallan y 2 se omiten (159 en total). No se modificaron juegos, evaluaciones, calificaciones ni servidor.

## NR-03.1 · Mapa de tres estaciones con bloqueo en el servidor (27 de octubre de 2026)
- El mapa del Inicio (`#mapa`) muestra tres estaciones con el progreso real de cada estudiante (mejor puntaje e intentos desde `GET /api/neuroritmo`):
  - Atención · Rol: Explorador (M1);
  - Memoria · Rol: Investigador (M2);
  - Integración pedagógica · Rol: Diseñador (M3).
- Estados visibles: Disponible, Bloqueada, Completada y Pendiente de validación (M3 enviada y sin valorar), además de «Devuelta con sugerencias» cuando el docente devuelve M3.
- Reglas: M1 empieza disponible; M2 exige 70/100 en M1 y M3 exige 70/100 en M2. La cadena es estricta: antes, un puntaje de M2 registrado con M1 sin aprobar habría desbloqueado M3. M3 solo cuenta como completada con validación docente.
- Servidor: `exigirDesbloqueada` recalcula el estado en cada petición. Iniciar, responder, pista y finalizar, y también Neuri (`/api/ia/neuri`), responden 403 si la misión está bloqueada. Antes, responder, pista y finalizar solo comprobaban que existiera una partida en curso.
- Cada tarjeta enlaza con actividades existentes: la misión, la lección de su tema (`tema.html?id=`) y la práctica del vocabulario (`ahorcado.html?temaId=`).
- Pruebas:
  - Unitarias: 4 pruebas nuevas en `pruebas/neuroritmo.test.js` (umbral exacto 69/70, cadena estricta, estado inicial, pendiente y validación). `npm test`: 161 pasan, 0 fallan y 2 se omiten.
  - Extremo a extremo con estudiante6, 37 de 37:
    - acceso directo a M2 y M3 por API y por URL (403, aviso de bloqueo, sin partidas creadas), también con una partida de M2 inyectada en los datos;
    - avance legítimo: M1 con 10/100 mantiene M2 bloqueada; M1 con 100 la desbloquea; M2 con 100 desbloquea M3;
    - estado pendiente de validación, enlaces de las tarjetas, 360 px y sin errores de consola.
  - La regresión de la interfaz NeuroRitmo pasa. Los datos del estudiante se restauraron.

## NR-03.2 · Actividad principal de M1 con simulador (27 de octubre de 2026)
- M1 reutiliza el motor compartido de NeuroRitmo: la interfaz construye una configuración y el servidor la normaliza con `claveSimulador`, corrige con el banco protegido y guarda hipótesis, tipo de sonido, volumen y predicción en la partida.
- Tres rutas: lectura comprensiva de un artículo; orden y formato de referencias como tarea mecánica; repaso previo a un examen oral con tensión 4/5. En cada caso se puede editar la hipótesis, alternar silencio, música instrumental suave o canción con letra, elegir volumen bajo/medio cuando corresponde y predecir el resultado antes de ejecutar.
- La devolución muestra un registro explícito de la hipótesis, la configuración ejecutada y la predicción; compara la predicción con el resultado del modelo y presenta la retroalimentación como «Explicación docente».
- Precaución visible antes y después de ejecutar: es un modelo educativo, no un predictor individual. Las opciones son representaciones silenciosas y no reproducen audio; la voz de Neuri permanece desactivada por defecto.
- Prueba de navegador con `usu_000010`: se cambió de instrumental/medio a silencio antes de ejecutar el caso 1 y se recorrieron los tres casos. Se guardaron las tres configuraciones y sus hipótesis; no se finalizó el intento ni se generó puntaje global. Cero elementos multimedia y cero excepciones JavaScript.
- Evidencia: `pruebas/nr-03.2-e2e.mjs` y dos pruebas unitarias nuevas para las tres rutas, variables, ausencia de audio, registro y explicaciones. `npm test`: 163 pasan, 0 fallan y 2 se omiten (165 en total).

## NR-03.3 · Quiz situacional y evidencia razonada de M1 (27 de octubre de 2026)
- M1 conserva exactamente cuatro ítems: tres casos del simulador y un quiz situacional. El cuarto distingue atención selectiva, memoria de trabajo, control inhibitorio y regulación de la activación mediante un caso que exige mantener y usar resultados mentalmente.
- La versión pública del banco entrega solo `id` y `texto` de cada alternativa; puntos, opción correcta y retroalimentación permanecen en `datos/config/neuroritmo.json` y la corrección se ejecuta en el servidor.
- El cierre exige exactamente dos tarjetas distintas del banco y una explicación propia de al menos 10 palabras. La interfaz aclara los tres componentes esperados: demanda de la tarea, diferencias individuales y comprobación del efecto; 20 palabras otorgan el puntaje completo de redacción.
- Se extrajo `validarJustificacion` en la ruta de NeuroRitmo para que la misma validación protegida rechace tarjetas inexistentes, una sola tarjeta, duplicados y texto insuficiente antes de puntuar o escribir evidencia.
- Evidencia individual: la partida almacena las cuatro respuestas, las dos tarjetas, el razonamiento íntegro y sus puntos. El intento de gamificación referencia esa evidencia mediante `detalle.partidaId`.
- Prueba real con `usu_000010`: una tarjeta sola → 400; dos tarjetas sin razonamiento suficiente → 400; respuesta «Memoria de trabajo» y justificación válida → 100/100. La partida `neu_000001` y el intento `int_000069` comparten el mismo `partidaId`. Cero excepciones JavaScript.
- Evidencia reproducible: `pruebas/nr-03.3-e2e.mjs`. Tres pruebas unitarias nuevas cubren estructura/protección del banco, corrección de las cuatro opciones y rechazo de evidencia incompleta. `npm test`: 166 pasan, 0 fallan y 2 se omiten (168 en total).

## NR-03.4 · Puntuación, retroalimentación y reintentos de M1 (27 de octubre de 2026)
- M1 usa el motor de intentos existente: cada cierre llama a `procesarIntento`, que registra el intento, conserva la mejor nota y otorga la insignia.
- Puntuación:
  - Decisiones: 60 puntos, 15 por cada uno de los cuatro ítems según la tabla de `neuroritmo.json`, que sigue la Tarea 3.
  - Justificación: 40 puntos. Las dos tarjetas valen hasta 30, con los puntos definidos por el docente.
  - Explicación escrita: hasta 10 puntos por los tres criterios del Reto 1 de la Tarea 3: demanda de la tarea (4), preferencias y diferencias individuales (3) y cómo comprobaría el efecto (3). Antes se otorgaban por número de palabras.
- Retroalimentación inmediata por ítem: concepto aplicado, error a revisar (vacío si el ítem obtuvo 15/15), ampliación, enlace al recurso de la Tarea 2 y sugerencia. El cierre muestra qué criterios de la explicación se cumplieron.
- Reintentos ilimitados; se conserva la mejor nota. La insignia «Observador atencional» se otorga con al menos 70/100, una sola vez. Neuri (IA) responde 403 en el primer intento y queda disponible desde el segundo. Sus usos se registran en `detalle.usosIa` y no restan puntos.
- Requiere validación docente: los indicadores y los puntos de los tres criterios (`justificacion.validacionDocente.estado = "pendiente"`) y los textos genéricos de «error a revisar» y «sugerencia». La detección por indicadores es orientativa: la valoración definitiva de textos libres corresponde al docente.
- Pruebas:
  - Unitarias: 7 nuevas en `pruebas/neuroritmo.test.js`. `npm test`: 173 pasan, 0 fallan y 2 se omiten.
  - Extremo a extremo con estudiante5, 28 de 28:
    - 69 (39 + 30 + 0): no aprueba, no recibe la insignia y M2 sigue bloqueada;
    - 70 (60 + 0 + 10) en el 2.º intento con una consulta real a Neuri (200; `usosIa` 1, sin descuento): aprueba, recibe la insignia y desbloquea M2;
    - 100: la mejor nota pasa de 70 a 100; un 69 posterior mantiene 100 en 4 intentos;
    - en la interfaz, la retroalimentación en cuatro partes y el cierre con los criterios (85/100), a 360 px y sin errores de consola.
  - Las regresiones de la interfaz NeuroRitmo y del mapa (NR-03.1) pasan. Los datos se restauraron.

## NR-04.1 · Seis parejas de conceptos en Misión 2 (27 de octubre de 2026)
- Se conserva el módulo de parejas como primer ítem de M2, sin sustituirlo por ahorcado, sopa de letras ni crucigrama. Contiene exactamente: codificación, consolidación, recuperación, repetición espaciada, memoria de trabajo y pista de recuperación, cada uno con su definición o ejemplo docente existente.
- Las doce tarjetas son botones nativos y admiten clic, teclado y eventos táctiles. Mantienen foco visible y un área mínima superior a 44 px.
- Cada acierto deja visible la definición correspondiente en «Explicaciones de las parejas formadas» y la anuncia a tecnologías de asistencia.
- Cada fallo incrementa el total y registra una confusión para los conceptos representados por las dos tarjetas elegidas. El servidor acepta únicamente identificadores de los seis pares y cantidades enteras seguras; guarda el resumen por concepto dentro de la respuesta individual.
- El estado parcial —parejas formadas, fallos y confusiones— se guarda por `partidaId` e ítem en almacenamiento local. Una recarga restaura las tarjetas completadas, sus explicaciones y el contador, sin revelar las parejas pendientes.
- Penalización gradual existente conservada: 0–2 fallos = 15, 3–4 = 12, 5–6 = 9 y 7 o más = 6 puntos; nunca reduce el ítem a cero solo por ensayo.
- Prueba real con `usu_000010`: confusión Codificación/Consolidación mediante clic, Codificación resuelta con teclado, recarga intermedia, Consolidación resuelta con eventos táctiles y cuatro parejas restantes con clic. Resultado guardado en `neu_000004`: 1 fallo, `p1:1`, `p2:1`, 15/15; M2 continúa en el segundo ítem y no se cerró la misión.
- Evidencia: `pruebas/nr-04.1-e2e.mjs` y dos pruebas unitarias nuevas.

## NR-04.2 · Canción educativa de Misión 2 (27 de octubre de 2026)

- Auditoría de recursos: el único MP3 catalogado contiene `ID3 simulado`, pesa 12 bytes y corresponde a «El Ritmo de la Corteza Cerebral», no a las fases de la memoria. No se usa como reproducción real.
- El ítem muestra «Pendiente de integrar audio y letra autorizados» y no publica audio, transcripción, banco ni respuestas mientras falte la entrega verificable. El servidor rechaza respuestas al ítem pendiente.
- La interfaz publicada queda preparada para reproductor HTML5 silenciado al inicio, escuchar/repetir por acción expresa, transcripción con cuatro huecos, persistencia parcial y feedback seguro palabra a palabra. Al activarla exigirá audio, letra, autoría y licencia verificables.

## NR-05.1 · Diseñador interactivo de Misión 3 (27 de octubre de 2026)

- Cuatro bloques editables: objetivo observable; recurso sonoro o silencio con letra, volumen y duración; instrucciones con secuencia reordenable; comprobación del aprendizaje e indicador de autorregulación. La justificación separada exige atención, recuperación, emoción/autorregulación y diferencias individuales.
- Cliente y servidor exigen secuencia de 5 a 10 minutos, entre 4 y 6 pasos, cierre verificable, campos mínimos y fundamentos explícitos. El navegador ya no permite enviar con puntos pendientes de la lista de cotejo.
- Prueba Chrome móvil a 360 × 800: cuatro bloques y cinco accesos internos operables, secuencia de referencia de 9 minutos, 10/10 criterios, todos los campos activos requeridos, sin desbordamiento horizontal y sin excepciones. El progreso se simuló solo en el navegador; no se crearon notas ni entregas.

## NR-04.3 · Ítems 3 y 4 de Misión 2: Diagnóstico con justificación y propuesta de ritmo (27 de octubre de 2026)
- Ítem 3 desarrollado con análisis del caso de Andrés: selección de opciones de diagnóstico, campo obligatorio de justificación pedagógica (mínimo 6 palabras) con contador en vivo y persistencia en almacenamiento local (`partidaId` + ítem).
- Ítem 4 desarrollado con propuesta aplicada de ritmo o canción breve: selección de la alternativa pedagógica defendible, campo de justificación de la propuesta con contador en vivo y validación de que la melodía se use como pista de recuperación sin sustituir la comprensión conceptual.
- Retroalimentación inmediata enriquecida: exposición del indicador de logro por concepto («✔ Logrado (15/15)», «⚠ En desarrollo (9/15)», «✖ Por reforzar (0/15)»), registro visible del texto redactado por el estudiante y enlace directo tanto al recurso multimedia como a la página del tema en «Explora y aprende» (`/paginas/tema.html?id=tem_000004`).
- Registro en el sistema existente: `resumenItems` y `detalle.items` en `intentos` almacenan `concepto`, `demostrado`, `indicador` y `puntos` por ítem.
- Pruebas: 8 pruebas unitarias nuevas en `pruebas/nr-04.3-casos.test.js`. `npm test`: 188 pasan, 0 fallan y 2 se omiten (190 en total).

## NR-04.4 · Puntuación de M2: 60 actividades + 40 justificación (27 de octubre de 2026)
- M2 suma 100: 60 por las cuatro actividades (parejas, canción, caso y decisión aplicada) y 40 por la justificación (dos tarjetas, 30, y explicación escrita, 10). El servidor corrige cada actividad sobre 15 y la escala al máximo que le asigna la distribución (`corregirItem(item, valor, maximo)`).
- **Distribución propuesta, no tomada de la Tarea 3.** La Tarea 3 solo fija 60 + 40; el reparto de los 60 es una propuesta del equipo: 15 por actividad, con la razón de cada valor en `datos/config/neuroritmo.json` (`misiones[m2].distribucion`, estado `propuesta`). Solo los ítems 3 y 4 coinciden con los 15 por ítem que la tabla B.1 da al quiz situacional.
- El panel docente (`#panel`) expone la propuesta con su origen y sus razones. El docente de la asignatura (o admin) puede aprobarla tal cual o ajustarla (enteros de 5 a 30 que sumen 60) una sola vez; queda registrado quién y cuándo, y la propuesta original si hubo ajustes. Otro docente o un estudiante reciben 403.
- Mientras no se apruebe, las partidas se puntúan con los valores propuestos y el estudiante ve «Distribución propuesta… pendiente de aprobación». Los intentos ya finalizados conservan su puntaje si después se aprueba un reparto distinto.
- Se conserva el mejor intento. El cierre muestra la retroalimentación por concepto (puntos, estado, error a revisar y recurso). «Guardián de la memoria» se otorga con 70/100 o más (una vez), y M3 sigue bloqueada (también por API, 403) si M2 es menor a 70.
- El indicador de logro de cada ítem muestra los puntos reales (antes decía siempre 9/15 en desarrollo).
- Pruebas: 6 unitarias nuevas en `pruebas/neuroritmo.test.js` (`npm test`: 194 pasan, 0 fallan y 2 se omiten). Prueba de extremo a extremo con estudiante6 y docente1/docente2: 36/36 correctas (69 → M3 bloqueada y sin insignia; 70 → insignia y M3; 100; 69 posterior conserva 100; aprobación con ajuste 10/20/15/15 escala parejas a 8/10 y canción a 20/20). Datos y configuración restaurados: la distribución queda como **propuesta**.
- **Requiere validación académica:** aprobar o ajustar el reparto de los 60 puntos desde el panel docente antes de usar la ruta con estudiantes.

## NR-05.2 · Borrador y versiones de la Misión 3 (27 de octubre de 2026)
- El borrador de la microactividad se guarda en el servidor (`datos/neuroritmo-borradores.json`, uno por estudiante, solo accesible por el servidor): autoguardado 1,2 s después de cada cambio, al ocultar la pestaña y con «Guardar borrador». Se dejó de usar el almacenamiento del navegador, que era compartido entre cuentas del mismo equipo, y se borra el borrador antiguo que pudiera quedar.
- El estudiante edita, agrega, quita y reordena bloques («Subir»/«Bajar»), y confirma el envío en un diálogo. Mientras la versión está enviada o en revisión no puede modificarse (409).
- Cada entrega registra fecha, versión, etapa (enviado → en revisión → devuelto | aprobado; el estado «borrador» es el borrador guardado), historial de etapas con fecha y autor, y evidencias (lista de cotejo, minutos, palabras de la justificación, guardados del borrador, pistas, consultas a Neuri y tiempo).
- No hay calificación automática: la entrega se crea sin puntaje ni criterios y M3 solo suma cuando el docente la valida con la rúbrica. El docente puede marcarla «en revisión» desde el panel.
- Al devolverla, la versión anterior queda intacta con su comentario; el nuevo borrador parte de ella y la versión siguiente se enlaza con `versionAnterior`. El estudiante ve su historial de versiones y el panel docente muestra la versión devuelta y el comentario junto a la nueva.
- Acceso: las rutas de borrador solo operan sobre el usuario de la sesión; otro estudiante, otro docente o la API genérica reciben 403.
- Pruebas: 5 unitarias nuevas (`npm test`: 200 pasan, 0 fallan y 2 se omiten). Prueba de extremo a extremo (estudiante3, estudiante4, docente1 y docente2): 52/52 correctas, incluidas la recarga del navegador, el cierre e inicio de sesión con dos cuentas en el mismo navegador y el acceso cruzado. Datos restaurados.
- **Observación:** con la canción de M2 pendiente de audio autorizado (NR-04.2) ningún estudiante sin M2 aprobada puede terminarla ni llegar a M3; para probar M3 se sembró un intento M2 aprobado como dato de prueba, ya eliminado.

## NR-05.3 · «Revisa mi borrador» con IA en la Misión 3 (27 de octubre de 2026)
- El botón usa una tarea de IA propia (`neuri-borrador`: preparador, plantilla y esquema), dentro del límite diario del tutor y con la clave solo en el servidor.
- Al modelo llegan únicamente el contenido de la microactividad y los criterios del docente (rúbrica y lista de cotejo). El servidor descarta cualquier campo ajeno al diseño y reemplaza correos, números largos y el nombre o apellido del estudiante por «[omitido]».
- La respuesta se valida: exactamente una fortaleza y dos aspectos de mejora, cada uno sobre objetivo, viabilidad, diversidad individual o comprobación del aprendizaje. Se rechazan (502) las salidas que mencionan puntos, notas o aprobación, o que proponen textos largos para copiar. La interfaz la presenta como «Revisión de Neuri (IA generativa)» y aclara que no reescribe ni asigna puntos.
- Sin servicio de IA (proveedor caído, sin configuración o límite diario) se muestran las pistas docentes predefinidas con el aviso «no generadas por IA».
- Registro sin textos: cada solicitud queda en la partida (`solicitudes` con fecha y conteo `ia.diseno`), su resultado en `consumo-ia.jsonl` (`ok`) y la pista de respaldo en `pistas`.
- Pruebas: 5 unitarias nuevas en `pruebas/neuri-borrador.test.js` (`npm test`: 205 pasan, 0 fallan y 2 se omiten). Prueba de extremo a extremo con estudiante3: 17/17 con el proveedor real (dos consultas reales a Gemini) y 11/11 con el servidor iniciado con una clave inválida de prueba (502, sin exponer la clave, respaldo docente en la interfaz). Datos restaurados.
- **Requiere validación docente:** los textos de las pistas predefinidas de M3 y una muestra de las revisiones de la IA.

## NR-05.4 · Rúbrica de cuatro criterios para la Misión 3 (27 de octubre de 2026)
- La Tarea 3 alude a una rúbrica de cuatro criterios (60 producto + 40 justificación) sin desarrollar su lista. Los cuatro criterios existentes quedan como **propuesta provisional del equipo de desarrollo**, marcada así en la configuración y en el panel; no se presentan como definitivos.
- El panel docente permite al docente de la asignatura editar nombre, descripción o niveles, tipo (producto o justificación) y máximo de cada criterio, guardar como propuesta y aprobar con confirmación. Reglas: exactamente cuatro criterios; producto 60 y justificación 40. Editar una rúbrica aprobada la devuelve a «propuesta» hasta reaprobarla; cada cambio queda en el historial con versión, fecha y autor.
- Calificar exige la rúbrica aprobada (409 si no), la misma versión que vio el docente (409) y confirmación explícita (diálogo con el resumen y `confirmado: true`). Solo el docente del grupo puede puntuar producto (hasta 60) y justificación (hasta 40), devolver o validar; el estudiante, otro docente y el admin reciben 403. Validar sigue exigiendo 24/40 en la justificación.
- Cada valoración guarda producto, justificación, puntaje, la copia de la rúbrica aplicada y una entrada de historial con los subtotales y el autor. Las valoraciones anteriores no cambian si después se edita la rúbrica.
- Bloqueos verificados: el estudiante no puede calificarse, registrar un intento M3 validado ni editar su entrega por la API genérica, y no obtiene el certificado sin la validación docente.
- Pruebas: 5 unitarias nuevas en `pruebas/rubrica-m3.test.js` (`npm test`: 210 pasan, 0 fallan y 2 se omiten). Prueba de extremo a extremo (estudiante3, docente1, docente2 y admin): 41/41, incluida la interfaz a 360 px. Datos restaurados; la rúbrica queda como **propuesta** (versión 0).
- **Requiere validación académica:** el equipo docente debe definir y aprobar los cuatro criterios desde el panel antes de calificar la Misión 3.

## NR-06.1 · Reglas de NeuroRitmo centralizadas en la gamificación (27 de octubre de 2026)
- Fuente única: `datos/config/reglas-gamificacion.json` → `neuroritmo` (3 misiones × 100, 60 decisión/producto + 40 justificación, aprobación 70 por misión, logro 240/300, justificación mínima de M3 24/40, mejor nota en reintentos, sin descuento por pistas, mejora mínima 15 con revisión de la retroalimentación y 15 palabras para Eco colaborativo). Se quitaron los duplicados de `neuroritmo.json` (aprobación, logro, justificación mínima y umbral de la alerta), de la tabla de puntos genérica y de `mejorPuntaje`, y el mínimo fijo de las insignias.
- Servidor, alertas, rúbrica de M3 y distribución de M2 leen estas reglas; las vistas reciben `experiencia.reglas` y ya no fijan 300 puntos en el código. Las reglas se validan al leerlas (decisión + justificación = puntos por misión; el descuento por pistas se fuerza a 0).
- El motor de gamificación trata NeuroRitmo aparte del quiz de cinco niveles: sin bono, actividades únicas, aprobado de quiz, máximo diario ni nivel; suma solo la mejora sobre la mejor nota de cada misión.
- Insignias: Observador atencional, Guardián de la memoria y Diseñador NeuroRítmico con la aprobación central (M3 solo validada por el docente). Mente en ajuste exige mejorar al menos 15 puntos sobre el intento anterior **habiendo revisado la retroalimentación** (abrir la del intento anterior, pedir pistas o consultar a Neuri). Eco colaborativo exige una respuesta de al menos 15 palabras en un hilo de otra persona de la Galería NeuroRitmo.
- En un reintento de M1 o M2 el estudiante ve la retroalimentación del intento anterior por concepto; abrirla queda registrado.
- Pruebas: 7 unitarias nuevas en `pruebas/reglas-neuroritmo.test.js` y 2 actualizadas (`npm test`: 217 pasan, 0 fallan y 2 se omiten). Prueba de extremo a extremo con estudiante4 y el motor real: 32/32 (69 → 90 sin revisión no da Mente en ajuste; 75 conserva 90; 100 tras revisar sí la da; pistas sin descuento; puntos = mejor nota; foro corto, en hilo propio y aporte real; M3 validada con 69 y con 80). Datos restaurados.
- Observación: M2 sigue sin poder completarse por la API (canción pendiente de audio, NR-04.2); las pruebas sembraron su resultado y la regresión del mapa (`probar-nr031`) falla en ese paso por la misma causa.

## NR-06.2 · «Pregúntale a Neuri» con IA real en las misiones (27 de octubre de 2026)
- Tres niveles de ayuda con botones propios: pregunta orientadora, pista conceptual y ejemplo paralelo (además de las tres pistas docentes predefinidas).
- Uso progresivo configurable en `neuroritmo.json → ia` y aplicado en el servidor: M1 desde el segundo intento (niveles y «Explícame el error»); M2 pistas y ejemplos (sin «Explícame el error»); M3 solo «Revisa mi borrador» (NR-05.3). La interfaz muestra los mismos permisos.
- Respuestas breves y basadas en la base docente (plantilla existente). El servidor controla la salida: más de 110 palabras, «la respuesta correcta…», «opción b», el texto de la opción con puntaje completo, las palabras faltantes de la canción, fracciones o puntajes y calificaciones se rechazan; se reintenta una vez y, si persiste, se responde 502 y entra el respaldo docente.
- La clave sigue solo en el servidor (`.env`); el navegador envía datos, nunca instrucciones ni claves. Límite diario compartido con el tutor (429 con mensaje). Sin IA (uso no habilitado, límite o proveedor caído), se muestran las pistas docentes rotuladas «no generadas por IA».
- Registro: cada solicitud queda en la partida (tipo, ítem, nivel, fecha, sin textos), su resultado en `consumo-ia.jsonl` y la pista de respaldo en `pistas`.
- Pruebas: 6 unitarias nuevas en `pruebas/neuri-niveles.test.js` (`npm test`: 223 pasan, 0 fallan y 2 se omiten). Extremo a extremo con estudiante5: 17/17 con una consulta real a Gemini (pista conceptual, 69 palabras, sin revelar la opción ni calificar) y el límite diario, y 7/7 con caída simulada (clave inválida de prueba: 502 sin exponer la clave y respaldo docente rotulado). Datos y ajustes restaurados.
- **Requiere validación docente:** revisar una muestra de las respuestas de Neuri y la redacción de las pistas predefinidas.

## NR-06.3 · Neuri como guía funcional y multimedia (27 de octubre de 2026)

- Se reutiliza el Neuri real del proyecto: el SVG de cerebro con audífonos y sus animaciones CSS, ambos definidos en `publico/js/nucleo/avatar.js` y `publico/css/componentes.css`. No se les atribuye una licencia externa que no conste en los archivos entregados.
- Neuri presenta Inicio y cada misión, recuerda las reglas, anuncia la transición al siguiente ítem o a la justificación y ofrece mensajes de cierre, progreso y resultados. Cada intervención de NeuroRitmo deja una transcripción visible y repetible.
- La voz sintética del navegador continúa apagada por defecto. Solo se inicia por decisión de la persona; incluye controles visibles para silenciar, pausar/reanudar y repetir, y se cancela al ocultar la guía.
- Auditoría multimedia: `neuroritmo-mision-cerebro-sonoro.png` es una lámina verificable del storyboard y no sustituye al avatar interactivo; no hay locución ni animación audiovisual autorizada adjunta. El único MP3 sigue siendo el marcador inválido de 12 bytes documentado en NR-04.2, por lo que no se reproduce ni se presenta como canción real.
- Prueba Chrome a 360 × 800: voz inicialmente silenciada, transcripción presente, pausa y reanudación operables, recordatorio de reglas y transición al mapa, sin desbordamiento horizontal ni excepciones. Las tres verificaciones unitarias del guía también pasan; la suite base conserva 223 aprobadas y 2 omitidas.
- **Pendiente del equipo:** entregar, si desea voz grabada, canción o animación audiovisual, el archivo reproducible junto con autoría, permiso/licencia y transcripción. Hasta entonces se mantienen únicamente el SVG/CSS del proyecto y la voz optativa del navegador.

## NR-06.4 · NeuroRitmo en los paneles de estudiante y docente, con alertas de apoyo (27 de octubre de 2026)
- **Estudiante («Mi progreso»):** nueva sección NeuroRitmo con la mejor nota, intentos y estado de cada misión (bloqueo con su motivo y plazo sugerido por el docente), las cinco insignias (obtenidas y pendientes) y los conceptos a reforzar (último intento de M1/M2 y comentario de M3 devuelta). Los datos vienen solo de `GET /api/neuroritmo` y son del propio estudiante.
- **Docente (panel docente):** la sección NeuroRitmo ya no es solo un enlace: muestra por estudiante la mejor nota, intentos y estado de cada misión; resultados por concepto; justificaciones de M3 pendientes y propuestas por revisar o en revisión; alertas de apoyo activas; y el formulario de plazos por misión. La valoración con rúbrica sigue en el panel de NeuroRitmo del Inicio.
- **Alertas de acompañamiento:** misión bajo 70 tras dos intentos (`misionBaja`, ya existente, ahora con el umbral central) y nueva `misionRetrasada` cuando pasa el plazo que el docente definió sin superar la misión (sin plazo se mantiene `misionPendiente` a los 5 días). Redacción de apoyo («una conversación breve o un plan para el siguiente paso puede ayudarle a avanzar»), aviso al docente y mensaje sugerido; no se duplican. El mensaje de NeuroRitmo vive en `neuroritmo.json` para no alterar el Anexo A.
- **Restricciones en el servidor:** panel y plazos solo para el docente del grupo (el admin puede consultar, no definir plazos); estudiantes y otros docentes reciben 403; plazos y alertas no se exponen por la API genérica; el estudiante no consulta datos de otros.
- Pruebas: 3 unitarias nuevas (`npm test`: 228 pasan, 0 fallan y 2 se omiten). Extremo a extremo con estudiante6, estudiante4, docente1, docente2 y admin: 37/37, con dos alertas reales (69 y 54 en M1 → `misionBaja`; plazo de M1 vencido → `misionRetrasada`, sin duplicarse ni afectar a quien superó M1) y ambas vistas a 360 px. Datos restaurados.

## NR-06.5 · Certificado PDF «Ruta NeuroRitmo completada» (27 de octubre de 2026)
- Requisito combinado obligatorio en el servidor (`estadoRuta.condiciones`, cinco requisitos con valor actual y requerido): M1 ≥ 70, M2 ≥ 70, M3 ≥ 70 validados por el docente, total ≥ 240/300 y M3 validada con la rúbrica. Los valores salen de `reglas-gamificacion.json → neuroritmo`.
- Si falta algo, `POST /api/certificados` responde 403 con lo que falta y no crea ningún registro ni documento; la vista de resultados muestra los cinco requisitos, el botón deshabilitado y «Te falta: …».
- Si procede, el certificado guarda nombre, fecha, misiones con su puntaje, insignias y puntuación total, más una huella de integridad (SHA-256). El PDF (jsPDF del servicio existente) muestra título, nombre, misiones, puntuación por misión y total, insignias, fecha, código y huella. La verificación pública (`verificar.html`) muestra la puntuación y comprueba que la huella coincide; si alguien altera el registro, lo indica.
- Pruebas: 6 unitarias en `pruebas/certificado-neuroritmo.test.js` (70+70+70=210 no procede; 80+80+80=240 validada procede; 240 sin validación no procede; M3 validada con 69 no procede; huella) y 1 ajustada (`npm test`: 234 pasan, 0 fallan y 2 se omiten). Extremo a extremo: 19/19, con M3 validada por docente1 con el flujo real, descarga real del PDF, verificación pública e integridad. M1 y M2 se sembraron (la canción de M2 sigue pendiente de audio). Datos y rúbrica restaurados.

## NR-07.1 · Recorrido integral con cuenta estudiante (27 de octubre de 2026)

- Recorrido ejecutado con `estudiante6@demo.ec`, rol estudiante distinto de la cuenta docente: Inicio y objetivos → Explora y aprende → unidad → dos subtemas → recursos → mapa → M1 y reintento → M2 → M3 → resultados y certificado.
- Sin defectos de producto observados: cero enlaces internos rotos, ambos Genially respondieron HTTP 200, cero excepciones de navegador, botones críticos operables y puntuación consistente. M1 obtuvo 100 y luego 85, conservó 100 y desbloqueó M2; las parejas conservaron su estado tras recargar y registraron 15/15.
- Bloqueo esperado: M2 no puede completarse porque la canción, letra, autoría y licencia siguen pendientes. La interfaz no finge audio ni ofrece un botón de respuesta y el servidor rechaza el ítem. Para comprobar M3 se añadió un resultado M2 exclusivamente temporal; el borrador persistió tras recargar y el envío quedó pendiente de valoración docente.
- El certificado permaneció deshabilitado y el servidor respondió 403 mientras M3 no estuviera puntuada y validada. Todos los datos, sesiones, entregas, notificaciones y archivos temporales de la prueba fueron restaurados o eliminados.
- Evidencia reproducible: `pruebas/nr-07.1-recorrido.mjs`. No se modificaron módulos del producto porque no se reprodujo ningún defecto corregible.

## NR-07.2 · Auditoría de seguridad y accesibilidad de los archivos modificados (27 de octubre de 2026)
- Alcance: servidor (rutas neuroritmo, certificados, alertas, ia; gamificacion, alertas, ia, esquemas-ia; preparadores neuri y neuri-borrador; ganchos temas, glosario, canciones, simulaciones y foros-respuestas; rutas/contenidos) y vistas (Inicio NeuroRitmo, mi-progreso, panel-docente, verificar, nucleo/neuroritmo y pdf).
- Resultado: **sin defectos confirmados que requieran cambios de código**. Verificado automáticamente con estudiante, docente1, docente2, admin y visitante:
  - Acceso a datos: colecciones internas (partidas, entregas, borradores, plazos, consultas, sesiones) negadas a todos los roles por la API genérica; lectura por id de intentos, logros y progreso de otro usuario negada; alertas de otro grupo negadas; usuarios solo admin.
  - Edición: el estudiante no edita intentos, logros, temas ni su rol, ni registra intentos de NeuroRitmo; un docente sin la asignatura no edita temas ni la rúbrica; el admin no define plazos.
  - URLs protegidas: panel docente, admin-ia, editor y distributivo redirigen o bloquean según el rol; `#panel` no se muestra al estudiante; sin sesión se va al ingreso (un primer aviso fue un falso positivo de tiempos).
  - Credenciales: `.env`, `datos/`, `servidor/` y `package.json` no se sirven; la clave de IA solo aparece enmascarada para el admin; no hay claves en `publico/` ni `datos/`.
  - Contenido de usuario: las plantillas HTML usan `esc()`, `util.formatoBasico()`, `textContent` o `ui.confirmar` (que escapa); `neuriDice()` escapa.
  - Accesibilidad e interfaz: 17 vistas por rol a 360 px sin desbordamiento, sin controles sin etiqueta, botones sin nombre, imágenes sin alt ni `tabindex` positivo y sin errores JS; contraste AA y foco visible con Tab en 7 vistas clave; sin audio automático (la voz de Neuri es opcional y el texto siempre se muestra).
- Pruebas manuales pendientes: lector de pantalla real (NVDA/TalkBack) en parejas, simulador, diseñador y rúbrica; recorrido completo solo con teclado de las misiones y los diálogos; dispositivos reales (Android/iOS), zoom al 200 % y modo de alto contraste; Firefox, Edge, Safari y Brave; audio y transcripción de la canción cuando exista el archivo autorizado; voz de Neuri en distintos sistemas; PDF en lectores e impresión con nombres largos o con tildes; revisión docente de una muestra de respuestas de la IA; edición del borrador de M3 en dos pestañas y sesión que expira durante el autoguardado.

## NR-07.3 · Revisión docente final preparada (27 de octubre de 2026)

- Dictamen previo: **NO APTO todavía para abrir la ruta completa a estudiantes**. La unidad `uni_000007` sigue oculta; `tem_000012` y `tem_000013` siguen en borrador; la canción de M2 está pendiente; la distribución M2 y la rúbrica M3 siguen como propuestas.
- `docs/revision-docente-final-neuroritmo.md` consolida la revisión de textos, objetivos, subtemas, simuladores, seis parejas, canción, preguntas, pistas IA, rúbrica, citas, fichas, licencias y archivos ausentes, con lista de aprobaciones humanas obligatorias.
- Se corrigieron únicamente tres rótulos de recursos en los temas borrador: ahora indican autoría y aclaran que la licencia CC BY-NC-SA 4.0 fue declarada en el informe, no verificada en Genially.
- No se aprobó ni publicó ningún material. La apertura queda condicionada a validación científica/redaccional, revisión de puntajes y rúbrica, entrega de recursos, verificación bibliográfica y confirmación de autoría/licencias.

## NR-07.4 · Prueba piloto controlada (27 de octubre de 2026)
Ejecutada en el navegador (Edge sin ventana, 360 px) con **estudiante2** y **docente1**, guiada por `piloto-nr074.mjs`. Resultado: **25 de 27 pasos correctos y 2 fallas**; hubo una intervención de datos para poder continuar. Datos y rúbrica restaurados después.

| Fase | Paso | Resultado |
|---|---|---|
| Estudiante | Abre «Explora y aprende» y encuentra una lección | **Falla**: no aparece ninguna lección para el estudiante (ver mejora 2) |
| Estudiante | Lee el tema de la Misión 1 y lo marca como revisado | Correcto |
| Seguridad | Saltar a M2 y M3 por URL sin superar la anterior | Correcto: vista bloqueada y API 403 |
| Seguridad | Descargar el certificado antes del logro | Correcto: botón deshabilitado y API 403 |
| Estudiante | Completa M1 (simulador, quiz y justificación) | Correcto: 100/100 |
| Estudiante | M2 · juego de parejas | Correcto: 15/15 |
| Estudiante | M2 · canción educativa | **Falla bloqueante**: «Pendiente de integrar audio y letra autorizados» (NR-04.2); M2 no puede completarse |
| Intervención | Se sembró M2 = 100 como dato de prueba para seguir con M3 | No representa un recorrido real |
| Estudiante | Diseña la M3, reordena bloques, autoguardado y envío con confirmación | Correcto |
| Seguridad | Entrega sin puntaje automático; intento de aprobar su propia tarea | Correcto: 403 en calificar y en registrar intento |
| Docente | Consulta el progreso del grupo en el panel docente | Correcto |
| Docente | Calificación bloqueada con la rúbrica propuesta; la aprueba solo para el piloto | Correcto |
| Docente | Inicia la revisión y devuelve con comentario | Correcto |
| Estudiante | Ve el comentario y la versión 1; reenvía la versión 2 | Correcto |
| Docente | Ve la versión devuelta junto a la nueva y valida con 80/100 | Correcto |
| Estudiante | Descarga el certificado tras cumplir los requisitos | Correcto (PDF generado) |
| Interfaz | Sin desbordamiento a 360 px ni errores de JavaScript | Correcto |

**Mejoras detectadas (por prioridad)**
1. **Bloqueante:** integrar el audio y la letra autorizados de la canción de M2, o decidir con el docente cómo puntuar ese ítem mientras tanto. Sin esto ningún estudiante nuevo puede completar M2, M3 ni obtener el certificado.
2. «Explora y aprende» no muestra lecciones al estudiante: los subtemas 1.1 y 1.2 siguen en borrador en una unidad oculta (pendiente de validación académica), y los temas publicados de las misiones solo se alcanzan desde el mapa («📖 Repasar la lección»). Publicar los subtemas validados o enlazar desde el catálogo los temas de las misiones.
3. El equipo docente debe aprobar la rúbrica de M3 (hoy es una propuesta) y la distribución de puntos de M2 antes de un piloto con estudiantes reales.
4. Pendiente de un piloto humano: claridad de las consignas, tiempo real por misión, comprensión de la retroalimentación y de las pistas, y uso de Neuri (no medibles con la prueba automatizada).

## NR-07.5 · Preparación del despliegue (27 de octubre de 2026)
- **No publicado. No existe URL pública todavía.** Publicar requiere el servidor (VPS Ubuntu), el dominio y el acceso por SSH del equipo, que no están disponibles desde este entorno. No se inventaron enlaces ni credenciales.
- Destino: se reutiliza la preparación existente (P13.3) en `docs/despliegue.md`: VPS con Node.js ≥ 20, PM2 (una instancia), Nginx como proxy con HTTPS (Certbot), cortafuegos 22/80/443, `.env` con `GEMINI_API_KEY` solo en el servidor (permisos 600) y respaldo diario de `datos/` y las subidas. En un VPS el disco es persistente; un hosting estático (GitHub Pages, Netlify) **no** ejecuta el backend Express y no sirve.
- Agregado: `despliegue/exportar-contenidos.mjs` y el paso 7.1 de la guía (los contenidos de NeuroRitmo no viajaban: el paso 7 solo creaba insignias y el administrador); `pruebas/humo-despliegue.mjs` y el paso 14 (verificación de la URL, persistencia y registro de resultados) y dos puntos más en la lista final. Se probaron y se revirtieron cambios para PaaS (`PORT`, `DIR_DATOS`) porque la guía usa VPS y una prueba existente fija `PUERTO`.
- Validación local en modo producción: humo 28/29 y persistencia 2/2 tras reiniciar (sesión y progreso conservados); archivos `.env`, `datos/`, `servidor/`, `package.json` y `node_modules/` no se sirven; roles y clave enmascarada correctos; el exportador no incluye usuarios ni campos de autoría.
- **Problemas que bloquean la publicación:**
  1. Las cuentas de demostración aceptan la clave conocida `Demo12345` (falla de humo esperada en local): en producción no se ejecuta la semilla y se crean cuentas reales (pasos 7 y 7.1).
  2. El tema publicado `tem_000002` enlaza `/recursos/subidas/paisaje-sonoro.mp3`, que no existe: subir el audio autorizado o quitar el recurso.
  3. La canción de M2 sigue pendiente de audio autorizado: ningún estudiante nuevo puede completar M2 (piloto NR-07.4).
  4. Rúbrica de M3 y distribución de M2 aún como propuesta.
- **Pendiente tras publicar:** completar la tabla del paso 14 de la guía (humo, persistencia, incógnito, otro dispositivo y red, multimedia y acceso de estudiante) con la URL real.

## NR-07.6 · Material para el informe final de Tarea 4 (27 de octubre de 2026)

- Se preparó `docs/informe-final-tarea-4.md` como **BORRADOR** de ocho páginas: contexto, objetivo, integración de Tareas 1–3, arquitectura, componentes, IA, multimedia, pruebas, URL, reflexión conjunta de 288 palabras y decisión de cierre. La consigna primaria está en `Tareas/Tarea 4 GRUPAL Proyecto Áulico - 30PTS.pdf`.
- Se organizaron anexos en `docs/evidencias/nr-07.6/`: índice, prompts con procedencia y cinco capturas nuevas de ejecución local (Inicio/ecosistema, recursos, M1, tutor IA y mapa móvil a 360 × 800). Se obtuvieron con Chrome, servidor local y una cuenta estudiante; `sesiones.json` y `bitacora.jsonl` fueron restaurados.
- Las cuatro láminas de Tarea 3 y el storyboard se clasificaron como evidencia documental de diseño, no como capturas del sistema. No se inventaron capturas de vibecoding, consultas nuevas de IA ni publicación.
- Verificación actual: `npm test` → 236 pruebas, 234 aprobadas, 0 fallidas y 2 omitidas. La captura E04 acredita la interfaz de IA y sus avisos, no una ejecución nueva del proveedor.
- **URL:** solo desarrollo local (`http://localhost:3000/` con el servidor iniciado). No existe URL pública y el sistema permanece **NO APTO** para compartir con estudiantes.
- **Pendientes antes de compartir:** tres capturas auténticas de vibecoding; canción autorizada de M2; resolver `paisaje-sonoro.mp3`; aprobar unidad, subtemas, distribución M2 y rúbrica M3; validar textos, respuestas IA, citas, autorías y licencias; pruebas humanas de accesibilidad y móvil físico; desplegar con HTTPS y completar humo, persistencia, incógnito y otra red sobre la URL real.

## NR-08.1 · Ajuste de textos visibles en Inicio (27 de octubre de 2026)

- El encabezado estudiantil «Recursos del curso (Tarea 2)» ahora se muestra como «Recursos del curso».
- La mención «informe de Tarea 2» de la ficha de la matriz se presenta como «informe de la colección del curso» únicamente en la interfaz. El valor académico original de `datos/config/neuroritmo.json` y las referencias técnicas se conservaron intactos.
- No cambiaron fichas, contenidos, archivos, enlaces, menú ni navegación. Verificación real en Chrome: 3 fichas y 3 enlaces tanto a 1366 × 900 como a 360 × 800, sin «Tarea 2» visible ni desbordamiento horizontal. Evidencia reproducible: `pruebas/nr-08.1-inicio-e2e.mjs`.

## NR-08.2 · Unificación de la canción principal (27 de octubre de 2026)

- Se identificó el registro docente real `can_000001`, «El Ritmo de la Corteza Cerebral», y su archivo existente `d62f8072f4ff3ae1d593aa33239b09f5.mp3` (6.310.121 bytes). No se duplicaron registros ni archivos.
- El mismo registro y URL se muestran en Inicio, Explora y aprende, Canciones y la matriz de autodiagnóstico. Se mantienen reproducción/pausa, volumen, silencio inicial y transcripción; la matriz ya no ofrece canciones genéricas adicionales.
- Misión 2 conserva su actividad en estado **PENDIENTE**: la letra principal no cubre codificación, consolidación, recuperación y repetición espaciada, por lo que no se inventaron huecos ni se fingió compatibilidad.
- Verificación: `npm test` → 239 pruebas, 237 aprobadas, 0 fallidas y 2 omitidas. `pruebas/nr-08.2-cancion-e2e.mjs` confirmó el mismo MP3 (262,032 s) en las tres vistas, reproducción y pausa, nueve líneas LRC y catálogo a 360 px sin desbordamiento.

## NR-08.3 · Recursos multimedia funcionales (27 de octubre de 2026)

- Auditoría: `tem_000001` usaba `youtu.be/ejemplo-neurosonoro`, identificador ficticio sin archivo recuperable; `tem_000002` usaba `paisaje-sonoro.mp3`, ausente en todas las carpetas y respaldos. No se crearon archivos audiovisuales simulados.
- Se recuperó el screencast original `https://view.genially.com/6aca29b16ddf6a28c8dadcaf` y se comprobó por HTTPS (`200 OK`, HTML). La lectura PDF de SciELO también respondió `200 OK` con `application/pdf`. El archivo de video local y el paisaje sonoro se muestran como **Pendiente de integración**; no generan `iframe`, `video` o `audio` vacíos.
- Se añadió `recurso-neurociencia.html`, módulo alternativo con explicación prudente, diagrama HTML/CSS, tres casos navegables y accesos a Explora, Misión 1 y el mapa. Las fichas de tema también incluyen regreso a Explora y a las misiones.
- Verificación: `npm test` → 242 pruebas, 240 aprobadas, 0 fallidas y 2 omitidas. Con `estudiante6@demo.ec`, `pruebas/nr-08.3-multimedia-e2e.mjs` validó ambos temas y el interactivo a 360 px, sin desbordamiento, excepciones de consola ni fallos de red internos.

## NR-08.5 · Tutor socrático transversal de Neuri (27 de octubre de 2026)

- Se reutilizó el servicio de IA existente (`POST /api/ia/:tarea`, `servidor/ia.js`, límite `limiteTutorDiario`, registro en `consumo-ia` y control de salida de `esquemas-ia.js`) con la tarea nueva `neuri-actividad` (preparador y plantilla). No hay chatbot nuevo ni ruta nueva. La clave sigue solo en el `.env` del servidor y el navegador envía únicamente identificadores y el estado mínimo del juego.
- Ahorcado, Encuentra la pareja, Sopa de letras, Crucigrama, Quiz por niveles y Simulador de escenarios muestran a los estudiantes el panel compartido `js/nucleo/ayuda-neuri.js`. Tiene dos acciones:
  - «Necesito una pista» avanza por los tres niveles: pregunta orientadora, pista conceptual y ejemplo paralelo.
  - «Explícame el error» solo responde cuando hay un error real: letras falladas, pareja incorrecta, selección sin palabra, palabra comprobada como incorrecta, respuesta fallada del quiz o decisión desfavorable.
- **Separación de las misiones:** el panel indica «no cuenta para las misiones de NeuroRitmo». El preparador no lee ni escribe `neuroritmo-partidas` y rechaza actividades como `m1`.
- **Sin filtración de respuestas:** el servidor toma la solución de sus propios datos y la prohíbe en la salida. Si la IA la menciona, se reintenta una vez y luego responde 502 (pista predefinida). Lo prohibido es:
  - la palabra oculta, incluso deletreada;
  - el inicio de la definición o de la opción correcta, aunque cambie la puntuación;
  - la mejor decisión del simulador y su posición («la primera opción»).
- **Corrección durante la prueba:** en «Explícame el error» de la pareja, la IA nombró el concepto dueño de la definición elegida, lo que revelaba indirectamente otra pareja. Ahora el modelo no recibe ese nombre y el nombre queda prohibido en la respuesta.
- **Sin IA:** si el proveedor falla, se agota el límite diario o no hay conexión, se muestra una «Pista predefinida (sin IA)» con el motivo. Los docentes no ven el panel y el servidor les responde 403.
- **Verificación:**
  - `npm test`: 249 pruebas, 247 aprobadas, 0 fallidas y 2 omitidas; incluye `pruebas/neuri-actividad.test.js` (7 pruebas).
  - Navegador con la IA real (Gemini), estudiante1: 15 respuestas en las seis actividades, sin revelar la solución.
  - Permisos: sin sesión 401, docente 403, `m1` 400, tema en borrador 404, sesión de quiz ajena 404.
  - La clave no aparece en ninguna respuesta; `consumo-ia` solo guarda `{usuarioId, tarea, entrada, salida, ok, fecha}`; las partidas de las misiones no cambiaron.
  - Caída simulada (clave inválida): pistas predefinidas rotuladas en los seis juegos. Sin conexión: también rotuladas.
  - A 360 px: sin desbordamiento horizontal y botones accesibles con teclado. Los datos se restauraron al terminar.
- **Observación:** el motor existente revisa el límite diario antes de los permisos y cuenta también las consultas fallidas. Con el límite agotado, una petición inválida responde 429 en vez de 400 o 404. No se cambió porque es comportamiento previo compartido con el tutor.
- **Pendiente manual:** revisión pedagógica por el docente de las pistas predefinidas y de una muestra de respuestas de la IA, y prueba con lector de pantalla.

## NR-08.8 · Foro pedagógico de la Tarea 3 (27 de octubre de 2026)

- Se reutilizó el único hilo `for_000001`, **Galería NeuroRitmo**, vinculado a `tem_000005`; no se creó ni duplicó otro foro. La consigna presenta la pregunta sobre atención, memoria y autorregulación, solicita una microactividad de 5 a 10 minutos, decisiones pedagógicas y un comentario constructivo.
- La participación se declara opcional. El texto aclara que borradores y entregas privadas de Misión 3 no se copian ni publican automáticamente y pide evitar datos personales. El acceso desde M3 también se rotula como opcional.
- Se conserva la autorización y moderación existente: visibilidad por asignatura, edición propia durante 15 minutos, cierre/fijado/ocultación por docente o administrador, reportes y ocultación de respuestas. El nuevo `respuestaAId` solo acepta una propuesta visible de otra persona en el mismo hilo.
- **Eco colaborativo:** ahora requiere evidencia verificable de dos aportes de al menos 15 palabras en la Galería: una propuesta propia y un comentario dirigido a una propuesta ajena. No suma puntos; la pertinencia y el respeto continúan sujetos a moderación.
- Verificación: `npm test` → 252 pruebas, 250 aprobadas, 0 fallidas y 2 omitidas. `pruebas/nr-08.8-foro-e2e.mjs` usó dos cuentas estudiante para publicar y comentar desde la interfaz; confirmó una sola Galería, la insignia solo después de ambos aportes, cero errores de consola y ausencia de cambios en borradores o entregas privadas. Todos los datos de prueba se restauraron.

## NR-08.9 · Agenda académica y atribución docente (27 de octubre de 2026)

- Se configuraron seis hitos de NeuroRitmo. Solo «Presentación e instrucciones» está confirmado para el 4 de noviembre de 2026, sin inventar una hora no proporcionada; revisión de contenidos, M1, M2 y M3 son propuestas editables, y la retroalimentación queda pendiente de confirmación docente. Los hitos no confirmados no generan recordatorios automáticos.
- La Agenda declara y aplica `America/Guayaquil` (UTC−5), abre en noviembre de 2026 y enlaza a Instrucciones, Explora y aprende, las tres misiones y Resultados. Si el CDN de FullCalendar no responde, muestra una vista mensual accesible con los mismos datos y acciones.
- El campo visible «Docente responsable» usa **Karla Paucar**. No se modificaron usuarios, credenciales, nombres legales, distributivo ni autorías históricas; el propietario técnico existente conserva los permisos de edición del grupo.
- Verificación: `npm test` → 256 pruebas, 254 aprobadas, 0 fallidas y 2 omitidas. `pruebas/nr-08.9-agenda-e2e.mjs` comprobó estudiante a 360 px y docente a 1366 px, navegador forzado a otra zona horaria, seis enlaces, bloqueo de edición estudiantil, edición docente, ausencia de desbordamiento y cero errores de consola. Los datos se restauraron.

## NR-08.3A · Matriz de Autodiagnóstico Musical (28 de octubre de 2026)

- Se recuperó el contenido original de las páginas 34–35 del informe de Tarea 2: escala de 1 a 4, dos actividades académicas y ocho criterios de observación. La exportación original independiente y la confirmación de autoría siguen pendientes; la adaptación no se presenta como el archivo original.
- La ruta `/paginas/autodiagnostico-musical.html` añade ocho preguntas sobre hábitos musicales, atención/control inhibitorio, memoria/comprobación y autorregulación. Permite guardar y recuperar un registro propio y entrega retroalimentación descriptiva, no diagnóstica ni calificativa.
- Solo ofrece silencio o la canción principal real `can_000001`; el reproductor inicia silenciado y conserva transcripción. La página enlaza las tres misiones y el mapa sin alterar sus puntajes, intentos o desbloqueos.
- La colección `autodiagnosticos-musicales` es de uso exclusivo del servidor. Las rutas propias exigen rol estudiante, matrícula en NeuroRitmo y aíslan los registros por usuario; la API genérica responde 403.
- Verificación: `npm test` → 260 pruebas, 258 aprobadas, 0 fallidas y 2 omitidas. `pruebas/nr-08.3a-autodiagnostico-e2e.mjs` comprobó con `estudiante6@demo.ec` acceso desde Explora, ocho respuestas, guardado, recarga, privacidad frente a otra cuenta, el mismo MP3 principal, cero cambios en `intentos.json`, cero errores de consola y ausencia de desbordamiento a 360 × 800. Los datos se restauraron.

## NR-08.3B · Neuri desplegable en toda la plataforma (28 de octubre de 2026)

- La plantilla común monta una sola instancia de Neuri en todas las pantallas. Se reutilizaron `avatar.js` y sus funciones de tutor; no se creó otro asistente ni se cambiaron las ayudas socráticas de las actividades.
- El panel permite abrir, minimizar, ocultar y volver a mostrar a Neuri. Conserva entre páginas la preferencia de voz y el estado abierto/minimizado/oculto, y mantiene la última transcripción durante la sesión. Una instalación sin preferencia inicia con voz apagada y panel minimizado.
- En computador, el panel abierto reserva una columna real y no cubre el contenido. En móvil limita su altura, reserva espacio inferior y mantiene controles de al menos 40 px, sin desbordamiento horizontal. Escape minimiza el panel y el foco vuelve al control correspondiente.
- `pruebas/nr-08.3b-neuri-global-e2e.mjs` verificó 16 páginas accesibles para estudiante, una sola instancia, persistencia al navegar, abrir/minimizar/ocultar/mostrar, voz y transcripción, vista de 1366 × 900 y móvil de 360 × 800; no hubo cruces con controles, errores de consola ni pérdida de navegación. La prueba heredada `ejecutar-nr-06.3-e2e.mjs` también pasó.
- Suite general: 262 pruebas, 259 aprobadas, 1 fallida y 2 omitidas. La única falla es previa/externa a NR-08.3B: `agenda-neuroritmo.test.js` espera que `usu_000003` (Karla) sea docente, pero el archivo actual la registra como admin tras una modificación reciente desde Administración de usuarios. Se preservó el dato existente y no se alteraron cuentas ni roles para forzar la prueba.

## NR-08.3C · Tutor socrático centrado en el estudiante (28 de octubre de 2026)

- El panel global de Neuri incorpora un único chat para estudiantes. Identifica el tema, la misión M1–M3, el ítem visible y la actividad; el servidor contrasta esos identificadores con la configuración real antes de construir el contexto docente.
- Las respuestas se limitan a 2–4 frases breves, un máximo de 90 palabras y exactamente una pregunta orientadora. Tres niveles de apoyo ofrecen pistas progresivas ante dudas o reiteraciones sin revelar soluciones, puntajes ni decisiones de aprobación.
- El historial se conserva al navegar y se comparte con la página dedicada del tutor. Se guarda en `sessionStorage` bajo una clave separada por usuario, se limita a 40 mensajes y solo se envían los 10 más recientes. El servidor registra conteos de uso, no el texto del diálogo, y no modifica intentos ni calificaciones.
- Se retiró el segundo chat que aparecía en Asignatura; el botón existente abre ahora el tutor global. La interfaz conserva la voz opcional, el contexto visible, sugerencias de inicio y la acción «Nueva conversación».
- `pruebas/nr-08.3c-tutor-global-e2e.mjs` verificó M1, M2 y M3 con dudas reales, crecimiento del historial (1/3/5 mensajes enviados), persistencia de seis mensajes, aislamiento entre dos estudiantes, una sola instancia, vista móvil de 360 × 800, cero desbordamiento y cero errores de consola. La salida del proveedor se interceptó solo para hacer determinista la prueba; las solicitudes completas atravesaron el contrato real. `intentos.json` permaneció idéntico y los datos temporales se restauraron.
- Suite general actual: 272 pruebas, 270 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.8A · Foro general de NeuroRitmo Digital (28 de octubre de 2026)

- Se incorporó un único hilo fijado «Foro general: Neuroeducación, música y aprendizaje» para la asignatura `asi_000001`. Su consigna plantea la influencia de la música en atención, memoria y autorregulación emocional, invita a compartir ejemplos educativos y recuerda considerar tareas, diferencias individuales, silencio y moderación.
- El hilo no depende de un tema específico: aparece primero al entrar a Foros y permanece visible al filtrar por tema. «Galería NeuroRitmo» se conserva sin duplicados como foro complementario de Misión 3.
- Se reutilizaron los permisos existentes: solo integrantes de la asignatura pueden verlo y participar; estudiantes publican y responden, mientras docentes y administradores conservan las acciones de orientación, destacado, cierre, ocultamiento y moderación. Karla Paucar figura como docente responsable del hilo.
- Fuera de la Galería, la acción dirigida usa «Responder a esta participación» y permite ampliar una idea, preguntar o sugerir. El registro servidor conserva autoría, vínculo con la participación respondida, fecha y evidencia de actividad; no altera misiones ni calificaciones.
- `pruebas/nr-08.8-foro-e2e.mjs` comprobó con dos estudiantes la carga automática de los dos hilos, permanencia del foro general con filtro, publicación, respuesta dirigida, persistencia, permisos y cero errores de consola. Los seis registros temporales de la prueba y las sesiones se restauraron al finalizar.
- Suite general: 269 pruebas, 267 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.11 · Menú lateral desplegable y adaptable (28 de octubre de 2026)

- La plantilla común conserva todas las opciones, orden, enlaces y filtros por rol, pero el menú deja de ocupar permanentemente su ancho completo. En escritorio el control recorre tres estados: expandido, contraído a 72 px con solo íconos y oculto; desde oculto vuelve a mostrarse expandido.
- Cada enlace conserva `aria-label` y `title` con su nombre cuando el texto queda visualmente oculto. La preferencia se guarda por identificador de cuenta en `localStorage`, se recupera al cambiar de sección o volver a ingresar y no se comparte entre usuarios.
- En pantallas de hasta 767 px se usa un cajón cerrado por defecto, con botón interno de 44 × 44 px, cierre mediante el disparador, selección de enlace, clic exterior o Escape. Mientras está abierto, Neuri queda temporalmente fuera de interacción y reaparece al cerrar.
- Los estados contraído y oculto modifican la cuadrícula para reservar 72 px o 0 px respectivamente; no se superponen al contenido. El menú móvil se limita al ancho disponible y no crea desbordamiento horizontal.
- `pruebas/nr-08.11-menu-adaptable-e2e.mjs` verificó con una cuenta estudiante escritorio de 1366 × 900, tableta de 800 × 900 y celular de 360 × 800: ciclo completo, persistencia entre Inicio, Explora y Foros, etiquetas accesibles, cierre móvil, convivencia con Neuri y cero errores de consola. La prueba heredada de Neuri volvió a recorrer 16 páginas sin regresiones.
- Suite general: 272 pruebas, 270 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.12 · Participantes de la asignatura (28 de octubre de 2026)

- El menú estudiantil incorpora «Participantes» dentro de Comunidad. La página `/paginas/participantes.html` organiza el directorio en Docente y Estudiantes, ofrece búsqueda por nombre, contador y avatares; cuando no existe foto usa iniciales derivadas del nombre real.
- La ruta privada `GET /api/participantes/:asignaturaId` construye cada respuesta desde `distributivo.json` y `usuarios.json`. Solo admite a estudiantes o docentes integrantes de esa asignatura; una cuenta ajena recibe 403. Devuelve exclusivamente nombre y foto autorizada, sin identificadores, correos, teléfonos, credenciales ni otros datos personales.
- Se corrigió `dis_000001` para que su docente sea la cuenta real `usu_000003`, Karla Paucar, en los datos vigentes y la semilla. No se modificaron usuarios, credenciales ni las matrículas estudiantiles: permanecen siete inscripciones vigentes y seis en la semilla base.
- `pruebas/nr-08.12-participantes-e2e.mjs` verificó menú, docente, siete estudiantes, ocho avatares, búsqueda «Michelle», contador, privacidad, bloqueo 403, escritorio de 1366 × 900 y móvil de 360 × 800 sin desbordamiento ni errores de consola. Sesiones y bitácora se restauraron al finalizar.
- Suite general: 275 pruebas, 273 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.13 · Retiro del acceso a la matriz de autodiagnóstico (28 de octubre de 2026)

- Se retiró la tarjeta «Matriz de autodiagnóstico musical» de «Explora y aprende», de los recursos de Inicio y del acceso auxiliar de Misión 3. No se borraron su página, módulo, API, configuración ni registros.
- Las tarjetas restantes usan una cuadrícula adaptable con `auto-fit`: se distribuyen en tres columnas en computador y una en celular, sin reservar columnas vacías. La canción principal conserva su acceso propio.
- `pruebas/nr-08.3a-autodiagnostico-e2e.mjs` verificó con perfil estudiante tres recursos restantes, títulos y enlaces presentes, enlace interno con respuesta correcta, enlaces externos HTTPS, tres columnas a 1366 px, una columna a 360 px, cero desbordamiento y cero errores de consola. También confirmó que la ruta directa conservada de la matriz sigue operativa.
- Suite general: 277 pruebas, 275 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.15 · Menú lateral expandible por proximidad (28 de octubre de 2026)

- En escritorio, el menú contraído se expande al acercar el cursor a su borde, al colocarlo encima o al enfocar uno de sus controles; al retirar cursor y foco vuelve a mostrar únicamente los íconos. La transición modifica la columna de la cuadrícula, por lo que no cubre el contenido.
- El nuevo control «Mantener menú expandido» fija o libera el estado y conserva la preferencia por cuenta. Se mantienen los estados previos, todas las opciones y sus permisos. Los nombres admiten salto de línea y se muestran completos.
- En móvil se conserva el cajón mediante botón, cierre interno, clic exterior o Escape. Mientras está abierto, Neuri queda temporalmente fuera de interacción y reaparece al cerrarlo.
- `pruebas/nr-08.11-menu-adaptable-e2e.mjs` verificó con estudiante la expansión automática, retirada, fijación persistente, nombres completos, navegación, separación respecto del contenido y Neuri, tableta de 800 px y móvil de 360 px, sin desbordamientos ni errores de consola.
- Suite general: 278 pruebas, 276 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.14 · Activación y corrección de la IA de Neuri (28 de octubre de 2026)

- Causa comprobada del mensaje «La tarea de IA \"neuri-actividad\" no está disponible»: el proceso del puerto 3000 fue iniciado antes de incorporar el preparador y los preparadores solo se descubrían al arrancar. Además, una falla al importar un preparador podía interrumpir el registro de los siguientes.
- `servidor/ia.js` carga ahora cada preparador de forma aislada y vuelve a buscar una tarea ausente al solicitarla. Un error de un módulo ya no desactiva otros tutores y los detalles internos no se exponen al estudiante. Es necesario reiniciar el proceso ya iniciado para que ejecute este código actualizado.
- El panel compartido activa la pista predefinida rotulada «sin IA» si la tarea técnica no está disponible, además de los respaldos existentes para falta de conexión, cuota o proveedor. Los errores pedagógicos válidos —por ejemplo, pedir explicación antes de responder— siguen mostrándose como avisos y no se confunden con una caída del servicio.
- Se unificó el control socrático de actividades y misiones: 2–4 frases, máximo 90 palabras y exactamente una pregunta orientadora, sin opciones, palabras, decisiones correctas, puntajes ni aprobación. M1 conserva IA desde el segundo intento, M2 sus pistas progresivas y M3 la revisión formativa del borrador.
- La configuración vigente tiene `GEMINI_API_KEY`, `IA_MODELO` y modelo alterno en `.env`; ninguna clave llega al navegador. Una solicitud real a `POST /api/ia/neuri-actividad` respondió mediante Gemini en 2,9 s con 49 palabras y una pregunta. Sesiones y consumo de prueba se restauraron.
- `pruebas/nr-08.14-neuri-e2e.mjs` recorrió como estudiante Ahorcado, Parejas, Quiz y Simulador con proveedor deshabilitado de forma controlada: los cuatro botones respondieron con respaldo, sin 404 ni errores de consola. Las pruebas unitarias cubren las seis actividades, permisos, protección de soluciones y las tareas de M1–M3.
- Suite general: 281 pruebas, 279 aprobadas, 0 fallidas y 2 omitidas.

## NR-08.16 · Participantes visibles desde el perfil estudiante (28 de octubre de 2026)

- Se verificaron los registros vigentes y el distributivo de `asi_000001`. Karla Paucar permanece como docente; Antonella Chica, Michelle Cruzatti, Margareth Llive, Mirka Peralta, Juan Pérez, Aidee Tipanluisa y Prueba NR028 ya estaban matriculados. Se incorporó al distributivo a Felipe Arévalo, cuya cuenta existente tiene rol estudiante; no se crearon ni modificaron usuarios, credenciales o permisos.
- La API privada devuelve ahora exclusivamente `nombre`, `foto` autorizada y `rol` académico. La vista separa Docente y Estudiantes, muestra nueve avatares —iniciales cuando no existe imagen—, ocho estudiantes, buscador y contador, sin correos, teléfonos, contraseñas ni controles administrativos.
- Se conserva la ortografía del registro existente «Margareth Llive»; no se cambió el nombre legal por la variante «Margareth Ilive» de la solicitud sin una modificación verificada del usuario fuente.
- `pruebas/nr-08.12-participantes-e2e.mjs` verificó con estudiante la lista completa, roles, contador, búsqueda, bloqueo 403, escritorio y móvil a 360 px sin desbordamiento ni errores de consola. La suite general permanece en 281 pruebas: 279 aprobadas, 0 fallidas y 2 omitidas.
## NR-09.1 — Sincronización con Render (28 de octubre de 2026)

- Diagnóstico previo en `https://competencias-b7-776n.onrender.com`: 9 usuarios, 2 asignaturas, 2 grupos, 6 unidades, 11 temas y 0 preguntas. Las tres misiones, dos foros, canción, simulación, video y audio sí respondían.
- Diferencias frente al proyecto local: faltaban Prueba NR028, la matrícula de Felipe y Prueba en NeuroRitmo, el rol estudiantil de Felipe, 1 unidad, 3 temas y 34 preguntas.
- Respaldo previo autorizado: `datos/respaldos/produccion-2026-10-29T02-20-46-720Z/` (ignorado por Git; contiene solo colecciones que la API administrativa permite consultar y no incluye claves ni tokens).
- Se preparó una fusión idempotente por identificador: conserva registros existentes, agrega ausentes, une matrículas sin duplicarlas y aplica una sola vez la corrección versionada de usuarios.
- Prueba aislada: 10 usuarios, 7 unidades, 14 temas, 34 preguntas, Karla Paucar como docente y 8 estudiantes visibles. El progreso sobrevivió a un reinicio y a un segundo checkout usando el mismo disco.
- Producción verificada en el commit `985b78c994bc`: 10 usuarios, 2 asignaturas, 2 grupos, 7 unidades, 14 temas administrativos, 34 preguntas, 3 misiones y 8 estudiantes en NeuroRitmo.
- Recorrido Chrome con `usu_000009`: 2 asignaturas, 12 temas publicados (2 permanecen protegidos por estado/visibilidad), 2 subtemas, 2 foros, 3 tarjetas de misión y Participantes adaptable a 360 px, sin errores de consola.
- Estado: **SINCRONIZACIÓN DE CONTENIDOS VERIFICADA; PERSISTENCIA E IA PENDIENTES**. Render reporta almacenamiento `efimero` y Gemini devuelve 503 porque falta `GEMINI_API_KEY`. No se declara NR-09.1 completa hasta configurar un disco persistente con `DISCO=/var/data` y comprobar un nuevo despliegue real.
