# docs/guiones-prueba.md · Guiones de prueba de punta a punta

Casos para verificar la plataforma completa por rol, de forma transversal y de seguridad (60 casos).
Se basan en docs/contratos.md (§A–§E) y en lo implementado hasta el sprint 12.

## Preparación
- Servidor en marcha (`npm start`) con datos de `npm run semilla` y `.env` con `GEMINI_API_KEY` e `IA_MODELO`.
- Cuentas (clave `Demo12345`): `admin@demo.ec` · `docente1@demo.ec` (grupos de las dos asignaturas) ·
  `docente2@demo.ec` (sin grupos) · `estudiante1@demo.ec` a `estudiante6@demo.ec`.
- Los casos de API usan el token de `POST /api/auth/login` en `Authorization: Bearer <token>`.
- Antes de los casos que modifican datos, copia `datos/`; al terminar, restáurala.
- Prioridad: **Alta** = bloquea el uso o la seguridad · **Media** = función importante · **Baja** = comodidad.

## Estudiante

| ID | Rol | Pasos | Resultado esperado | Prioridad |
|---|---|---|---|---|
| E01 | Estudiante | Abrir Registrarse, completar datos y aceptar el aviso de privacidad.<br>Ingresar con la cuenta nueva. | Cuenta creada con rol estudiante y consentimiento con fecha; entra a Inicio con su nombre en el encabezado. | Alta |
| E02 | Estudiante | Mis asignaturas → asignatura → tema.<br>Pulsar "Marcar como revisado". | Ve objetivos, resumen y recursos; el botón pasa a "Revisado ✓" y el avance de la asignatura sube. | Alta |
| E03 | Estudiante | Desde el tema, jugar Ahorcado hasta adivinar una palabra. | Retroalimentación por letra, globo que se desinfla con los errores, resumen final y aviso de puntos ganados. | Alta |
| E04 | Estudiante | Jugar Encuentra la pareja hasta unir todas las tarjetas. | Cada par muestra retroalimentación; al final, resumen con aciertos y errores y registro del intento. | Media |
| E05 | Estudiante | Jugar Sopa de letras y marcar todas las palabras. | Las palabras encontradas quedan marcadas; resumen final con puntos. | Media |
| E06 | Estudiante | Jugar Crucigrama solo con teclado (flechas, letras, Retroceso). | Se puede completar sin mouse; las palabras correctas se validan y se registra el intento. | Media |
| E07 | Estudiante | Quiz de un tema: aprobar el nivel 1 (≥ 70 %).<br>Descargar el diploma del nivel. | El nivel 2 se desbloquea, el 3 sigue bloqueado; el diploma PDF incluye nombre, tema, nivel y código. | Alta |
| E08 | Estudiante | Abrir Mi progreso. | Gráficos con tabla alternativa: promedio, actividades, evolución semanal y temas revisados. | Media |
| E09 | Estudiante | Mi perfil → insignias y certificado de cumplimiento.<br>Si cumple, generar el certificado. | Lista de condiciones con estado; el PDF lleva un código que funciona en Verificar certificado. | Media |
| E10 | Estudiante | Tema → "Pregunta al tutor"; tocar un chip y responder.<br>Recargar la página. | Respuestas con una pregunta guía (≤ 700 caracteres); al recargar, la conversación empieza de cero. | Alta |
| E11 | Estudiante | Foros → asignatura → "Nuevo hilo"; responder en otro hilo.<br>Editar el propio mensaje antes de 15 minutos. | Hilo publicado; el autor del otro hilo recibe una notificación; la edición queda marcada "editado". | Alta |
| E12 | Estudiante | Mensajes → "Nueva conversación" con su docente.<br>Escribir con Mayús + Enter y enviar con Enter. | Mensaje enviado con salto de línea; el docente lo recibe en ≤ 4 s con la conversación abierta; aparece "✓ Visto" al leerlo. | Alta |
| E13 | Estudiante | Agenda → crear una tarea para ayer y un recordatorio "1 hora antes" para dentro de 30 min.<br>Abrir "Mi semana". | La tarea aparece en "Vencidos sin completar" y la pestaña muestra el contador; el recordatorio llega a la campana. | Media |
| E14 | Estudiante | Abrir la campana 🔔 y "Marcar todas como leídas". | El contador desaparece y las notificaciones quedan leídas; los enlaces llevan a su página. | Media |
| E15 | Estudiante | Simulaciones → "Iniciar" la de escenarios; elegir siempre la mejor opción. | Retroalimentación por decisión; informe "30 de 30"; intento registrado; repetirla no vuelve a dar puntos. | Alta |
| E16 | Estudiante | Abrir un juego de roles, conversar hasta el máximo de turnos. | Contador "Turno n de N"; al terminar, evaluación por criterio con comentario general y puntaje dentro de la rúbrica. | Alta |
| E17 | Estudiante | Abrir una noticia y una canción con letra sincronizada. | La noticia deja de contar como no leída; la letra se resalta al ritmo del audio. | Baja |
| E18 | Estudiante | Mi perfil → cambiar foto y contraseña; salir y entrar con la nueva clave. | Datos guardados; la clave anterior ya no funciona. | Media |

## Docente

| ID | Rol | Pasos | Resultado esperado | Prioridad |
|---|---|---|---|---|
| D01 | Docente | Contenidos → agregar unidad y tema en borrador.<br>Publicar el tema. | El estudiante no ve el tema en borrador; lo ve al publicarlo. | Alta |
| D02 | Docente | Editor de tema: completar la ficha, subir un recurso y agregar términos al glosario. | Cambios guardados; aviso de cambios sin guardar al salir; términos de 6 letras marcados como aptos para juegos. | Alta |
| D03 | Docente | Glosario → "Generar con IA"; aprobar algunos términos. | Sugerencias en revisión; solo los aprobados aparecen en los juegos. | Media |
| D04 | Docente | Banco de preguntas → generar con IA un nivel; aprobar 10 preguntas. | El contador del nivel llega a 10 (sin aviso de banco insuficiente); los estudiantes pueden iniciar ese nivel. | Alta |
| D05 | Docente | Panel docente → elegir grupo; ordenar la tabla; "Exportar CSV". | Resumen, tabla ordenable y gráfico por tema; el CSV abre en Excel con tildes correctas. | Alta |
| D06 | Docente | En un estudiante con ⚠, abrir alertas, enviar un mensaje de apoyo y marcar "atendida". | El estudiante recibe la notificación; la alerta deja de estar activa. | Media |
| D07 | Docente | Panel docente → tarjeta "Uso del tutor". | Barras con los 5 temas más consultados y tabla por estudiante; sin textos de conversaciones. | Media |
| D08 | Docente | Foros → en un hilo: Fijar, Cerrar y Ocultar; destacar una respuesta. | Fijado primero en la lista; cerrado sin formulario de respuesta; oculto invisible para estudiantes. | Alta |
| D09 | Docente | Mensajes → "📣 Mensaje al curso" a un grupo. | Cada estudiante lo recibe en su conversación; se informan los omitidos por bloqueo. | Media |
| D10 | Docente | Agenda → "Fecha límite" de grupo con actividad y tema.<br>Como estudiante, hacer esa actividad. | El estudiante ve ✓ en el evento; pasada la fecha + días de gracia, quien no la hizo genera la alerta "Actividad vencida". | Alta |
| D11 | Docente | Simulaciones → Nueva (escenarios): escenas, opciones y un final; publicar con un error y luego corregir. | Lista de errores con enlace a cada escena; tras corregir, se publica y la vista previa no registra intentos. | Alta |
| D12 | Docente | En el editor, "Generar borrador con IA" con una situación y 6 escenas. | Se cargan 6 escenas como borrador sin guardar, con mapa y validación; se guarda solo al pulsar "Guardar". | Media |
| D13 | Docente | Nueva simulación en modo rol: personaje, rúbrica de 3 criterios y 6 turnos; publicar. | Exige personaje completo, 3 a 5 criterios y 4 a 12 turnos; queda disponible para los estudiantes. | Media |
| D14 | Docente | Panel docente → pulsar el nombre de un estudiante. | Detalle con sus últimos intentos (actividad, tema y nota); solo de estudiantes de sus grupos. | Baja |

## Administración y público

| ID | Rol | Pasos | Resultado esperado | Prioridad |
|---|---|---|---|---|
| A01 | Admin | Una persona se registra; en Usuarios cambiar su rol a Docente y pulsar "Restablecer clave".<br>Desmarcar su casilla "activo". | Entra como docente con la clave temporal; al desactivarla, su sesión deja de funcionar (401). | Alta |
| A02 | Admin | Asignaturas → crear, editar e intentar eliminar una asignatura con grupos. | Crea y edita; la eliminación con grupos se bloquea con un mensaje claro. | Alta |
| A03 | Admin | Distributivo → crear un grupo con docente y estudiantes (buscador y casillas). | Los estudiantes ven la asignatura y el docente la ve en su panel. | Alta |
| A04 | Admin | Inteligencia artificial → "Probar conexión" y "Ver modelos". | Estado del proveedor con la clave enmascarada; prueba "OK"; la clave nunca aparece completa. | Media |
| A05 | Admin | Reportes → en un reporte de foro: "Ocultar contenido"; en otro: "Descartar". | El contenido oculto desaparece para estudiantes y el reporte queda resuelto; descartar no oculta. | Alta |
| A06 | Admin | Reportes → reporte de mensaje: revisar el contexto y "Desactivar usuario". | Se ven el mensaje y los 5 anteriores; tras confirmar, el autor queda inactivo y el reporte sigue pendiente. | Alta |
| A07 | Admin | Panel docente → elegir cualquier grupo. | Ve el resumen de todos los grupos, sin ser su docente. | Baja |
| A08 | Público | Sin sesión, Verificar certificado con un código válido y otro inventado. | Válido: nombre, tipo y fecha; inventado: "no encontrado". | Media |

## Transversales

| ID | Rol | Pasos | Resultado esperado | Prioridad |
|---|---|---|---|---|
| T01 | Todos | Como estudiante, abrir `/paginas/admin-usuarios.html` y `/paginas/editor-simulacion.html`. | Redirección a Inicio sin mostrar datos; el menú no muestra opciones de otros roles. | Alta |
| T02 | Todos | Borrar el token de sessionStorage (o esperar a que expire) y usar cualquier página. | La API responde 401 y se abre la página de ingreso. | Alta |
| T03 | Todos | Con el celular (o 360 px): recorrer Inicio, un juego, Mensajes, Agenda y el Simulador. | Sin desplazamiento horizontal; menú ☰; Mensajes en una columna con "Volver"; Agenda en vista lista. | Alta |
| T04 | Todos | Recorrer con Tab un juego, un modal y el menú de un hilo; cerrar con Escape. | Foco siempre visible y en orden lógico; los modales atrapan el foco y lo devuelven al cerrar. | Alta |
| T05 | Todos | Quitar `GEMINI_API_KEY` de `.env`, reiniciar y usar el tutor y "Generar con IA". | Mensaje amable "La IA no está configurada…" (503); el resto de la plataforma funciona. | Alta |
| T06 | Todos | Con un `IA_MODELO` inexistente y un `IA_MODELO_ALTERNO` válido, usar el tutor. | Responde con el modelo alterno; sin alterno: mensaje claro de modelo no disponible. | Media |
| T07 | Estudiante | Bajar `limiteTutorDiario` a 2 en ajustes y enviar 3 mensajes al tutor. | El tercero muestra el mensaje amable de límite diario (429) y el campo se desactiva. | Media |
| T08 | Todos | Activar "reducir movimiento" en el sistema y abrir un juego con el avatar. | Sin animaciones; el avatar cambia de pose sin moverse; voz silenciada por defecto y "Ocultar" se recuerda. | Baja |
| T09 | Todos | Abrir la plataforma en dos pestañas con un recordatorio de agenda pendiente. | Una sola notificación del recordatorio aunque ambas pestañas consulten. | Baja |
| T10 | Todos | Revisar `datos/respaldos/` tras usar la plataforma un día nuevo. | Existe la copia del día y se conservan como máximo 14 días. | Baja |

## Seguridad

| ID | Rol | Pasos | Resultado esperado | Prioridad |
|---|---|---|---|---|
| S01 | Estudiante | `GET /api/logros/<id de otro>` y `GET /api/resumen/estudiante/<id de otro>`. | 403 en ambos. | Alta |
| S02 | Estudiante | `GET /api/intentos?usuarioId=<otro>`; `GET /api/usuarios`, `/api/sesiones` y `/api/consultas-tutor`. | Intentos: solo los propios (lista vacía para el otro); el resto, 403. | Alta |
| S03 | Estudiante y admin | `GET /api/mensajes/<convId de otros>` y `GET /api/simulaciones/<id de un borrador>`. | 403 en la conversación (también para el admin) y 404 en el borrador. | Alta |
| S04 | Docente2 | `PUT /api/temas/tem_000001`, `POST /api/unidades` y `POST /api/glosario` en una asignatura que no dicta. | 403 "No tienes permisos…" y sin cambios en los datos. | Alta |
| S05 | Estudiante | `PUT /api/auth/perfil` con `{ "rol": "admin" }` y `PUT /api/usuarios/<su id>` con el mismo cuerpo. | El rol sigue siendo estudiante (`GET /api/auth/yo`); el segundo, 403. | Alta |
| S06 | Estudiante | Crear un hilo y una respuesta con `<script>alert(1)</script>` y `<img src=x onerror=alert(1)>`. | Se muestran como texto; no se ejecuta nada (también en Reportes del admin). | Alta |
| S07 | Estudiante | Enviar un mensaje con `<script>alert(1)</script>` y `javascript:alert(1)`. | Ambos como texto; solo los enlaces http(s) se vuelven enlace (`rel="noopener"`). | Alta |
| S08 | Estudiante | `POST /api/quiz/iniciar` con nivel 3 sin aprobar el 2.<br>`POST /api/intentos` con `{ "actividad": "quiz", "nivel": 5, "detalle": { "aprobado": true } }` y con `"actividad": "foro"`. | 403 en los tres; `nivelQuiz` y puntos sin cambios en `GET /api/logros/yo`. | Alta |
| S09 | Estudiante | `POST /api/intentos` con `"puntos": 9999`; con `puntaje` > `maximo`; con una actividad inventada; `POST /api/logros`. | Ignora `puntos` (los calcula el servidor); 400, 400 y 403. | Alta |
| S10 | Estudiante | Enviar 15 intentos perfectos de Ahorcado seguidos y más de 60 en una hora. | Solo los primeros hasta `maxDiario` (10) dan puntos; pasado el límite por hora, 429. | Media |

## Hallazgos al preparar los guiones (2026-10-26)
- **S08 corregido (2026-10-26):** `POST /api/intentos` aceptaba la actividad "quiz" con `detalle.aprobado: true`
  (un estudiante saltaba al nivel 5, ganaba 55 puntos y 5 insignias y cumplía la condición del certificado) y
  también "foro" (puntos sin participar). Ahora ambas responden 403; el quiz las registra con `/api/quiz/finalizar`
  y el foro al publicar una respuesta.
- **Inicio (P13.2) corregido:** enlaces `javascript:` en recursos, catálogo frágil ante datos mal formados,
  accesibilidad del buscador y lectura por id de temas, unidades y noticias sin aplicar los filtros.
- **Límite de diseño (S10):** los juegos califican en el navegador, así que una petición manual puede declarar un
  puntaje perfecto. El servidor lo acota con `puntaje ≤ maximo`, `maxDiario`, `unicas` y 60 intentos por hora.
