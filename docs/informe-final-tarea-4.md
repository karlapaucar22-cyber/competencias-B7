# Material base para el informe final · Tarea 4

**Proyecto:** NeuroRitmo Digital · Misión Cerebro Sonoro  
**Institución:** Universidad Estatal de Milagro  
**Estado del documento:** BORRADOR para revisión del equipo y del docente  
**Fuente de la consigna:** `Tareas/Tarea 4 GRUPAL Proyecto Áulico - 30PTS.pdf`  
**Extensión propuesta:** ocho páginas de cuerpo principal; las evidencias se remiten a anexos.

> Nota editorial: al maquetar en Word o PDF, conservar cada bloque “Página” en una sola página. Las capturas, prompts completos, matrices y registros de prueba pertenecen a los anexos y no al límite de ocho páginas.

## Página 1 de 8 · Contexto, necesidad y objetivo

NeuroRitmo Digital es una experiencia educativa web para estudiantes universitarios, guiada por Neuri, un cerebro con audífonos. El recorrido aborda la relación entre sonido, atención, memoria, autorregulación y decisiones pedagógicas mediante contenidos, recursos y tres misiones. El problema de partida no se formula como una regla universal sobre la música: distintas tareas, niveles de activación y diferencias individuales pueden producir resultados distintos. Por ello, la experiencia pide formular hipótesis, comparar condiciones y justificar decisiones.

**Objetivo general.** Integrar contenidos académicos, recursos multimedia, gamificación e inteligencia artificial en una plataforma accesible que permita analizar estrategias sonoras o de silencio, aplicar conceptos de atención y memoria, y diseñar una microactividad verificable para un grupo al final de una jornada cansada.

**Alcance comprobado.** La plataforma funciona en un entorno local con Node.js y navegador. Incluye Inicio, Explora y aprende, contenidos, mapa, M1, M2, M3, retroalimentación, progreso y certificado condicionado. El sistema **no está publicado** y no tiene URL pública. La canción autorizada de M2, la aprobación de contenidos y rúbricas, y el despliegue siguen pendientes; por eso no debe compartirse todavía con estudiantes reales.

---

## Página 2 de 8 · Integración de las Tareas 1–3

**Tarea 1 · Mapa digital.** Los archivos `Tareas/Tarea 1-MI MAPA DIGITAL.pdf` y `Tareas/BIBLIOGRAFIA/Tarea 1-MI MAPA DIGITAL-of.pdf` documentan el antecedente del ecosistema digital y las competencias que orientan la selección de herramientas. En el producto, esa visión se traduce en una ruta unificada: contenido, práctica, apoyo, comunidad, progreso y evidencia.

**Tarea 2 · Colección abierta de recursos.** `Tareas/TAREA 2 GRUPAL (ACD) COLECCIÓN ABIERTA DE RECURSOS EDUCATIVOS DIGITALES LA MÚSICA EN LA EDUCACIÓN MUSICA.pdf` aporta el tema “La Música en la Educación” y la colección de recursos. Dos recursos Genially tienen acceso verificable. La matriz se recuperó de las páginas 34–35 y cuenta con una adaptación interactiva; su exportación original independiente y la confirmación de autoría siguen pendientes. No se atribuyen licencias que no puedan comprobarse.

**Tarea 3 · Diseño gamificado.** `Tareas/TAREA 3-Grupal/Tarea 3-Grupal.pdf` y cuatro láminas de flujo definen NeuroRitmo, Neuri, el mapa y las misiones. La implementación convierte ese diseño en actividades persistentes: M1 analiza atención y condiciones sonoras; M2 trabaja memoria mediante seis parejas y deja preparada la canción; M3 permite construir, guardar, enviar y valorar una microactividad.

**Integración lograda.** El producto une la organización del ecosistema, la colección temática y el recorrido gamificado en una sola experiencia. La trazabilidad visual original se conserva en los anexos como evidencia de diseño, no como captura de ejecución.

---

## Página 3 de 8 · Arquitectura y protección de datos

La solución usa HTML5, CSS3 y JavaScript modular sin frameworks en el navegador; Node.js 20+, Express y módulos ES en el servidor; y archivos JSON/JSONL en `datos/`. `publico/index.html` monta la experiencia principal con `publico/js/modulos/neuroritmo.js`. Las páginas especializadas usan la plantilla común, el menú y los tokens de diseño globales.

**Flujo técnico:** navegador → `js/nucleo/api.js` → rutas Express → permisos y ganchos → archivos JSON/JSONL. Las actividades no calculan puntos definitivos en el cliente: el servidor valida respuestas, registra intentos y aplica reglas de gamificación. Las respuestas correctas y las credenciales de IA permanecen del lado servidor.

La persistencia incluye intentos, partidas, borradores, entregas, logros, sesiones y bitácoras. El acceso se controla por rol —estudiante, docente y administrador— y por asignación de grupo. La API genérica no expone colecciones internas de NeuroRitmo. El texto aportado por usuarios se escapa o sanitiza antes de mostrarse.

La preparación de producción contempla VPS, una instancia de Node/PM2, Nginx, HTTPS, cortafuegos, respaldo diario y secretos en `.env`. Este diseño está documentado en `docs/despliegue.md`, pero su existencia no equivale a un despliegue realizado.

---

## Página 4 de 8 · Componentes funcionales

- **Inicio y Neuri:** presenta el propósito, reglas, objetivo y progresión; la voz del navegador está apagada por defecto y siempre existe transcripción.
- **Explora y aprende:** organiza unidad, tema, dos subtemas, objetivos y tarjetas de recursos. Los faltantes se rotulan “Recurso pendiente de publicación”.
- **Autodiagnóstico musical:** conserva la matriz original y permite registrar hábitos, atención, memoria y autorregulación, guardar y recuperar respuestas y recibir retroalimentación orientativa sin calificación.
- **Misión 1:** tres casos con hipótesis, silencio/música, volumen, ejecución y comparación; termina con un quiz situacional, tarjetas de argumento y justificación propia.
- **Misión 2:** exactamente seis conceptos emparejados con definiciones o ejemplos, explicación por pareja, registro de confusiones y recuperación del progreso. La interfaz de canción y cuatro huecos está preparada, pero bloqueada hasta recibir audio, letra, autoría y licencia.
- **Misión 3:** diseñador de 5–10 minutos con objetivo, recurso sonoro o silencio, secuencia y comprobación. Admite autoguardado, revisión, envío, devolución y valoración docente mediante rúbrica.
- **Seguimiento:** mapa, resultados, mejores puntajes, insignias, alertas de apoyo y certificado condicionado a las tres misiones, 240/300 y validación docente de M3.

La navegación conserva regreso a contenidos y mapa. Las actividades usan retroalimentación y registro de intentos; los reintentos conservan la mejor nota. El estudiante no puede autocalificarse ni emitir su certificado antes de cumplir las condiciones del servidor.

---

## Página 5 de 8 · Inteligencia artificial y supervisión

Neuri actúa como tutor socrático y apoyo formativo desde todas las pantallas. Reconoce el tema, la misión y el ítem visible, conserva el diálogo privado del estudiante al navegar y ofrece tres niveles de pistas progresivas. Sus intervenciones se limitan a 2–4 frases y una pregunta orientadora para evitar soluciones directas, reiteraciones y explicaciones innecesariamente técnicas. El navegador envía datos mediante la API; las instrucciones viven en `servidor/prompts/`. El servidor contrasta el contexto con la configuración docente, limita el uso diario, llama al proveedor configurado y filtra la respuesta. La clave de Gemini y el nombre del modelo se leen únicamente desde variables de entorno.

En M1, la ayuda de IA se habilita desde el segundo intento; en M2 puede orientar con pistas o ejemplos; en M3 revisa el borrador con una fortaleza y dos aspectos de mejora. No debe revelar respuestas, palabras faltantes, puntajes ni decisiones de aprobación. Si falta configuración, se alcanza el límite o falla el proveedor, se muestran pistas docentes identificadas como no generadas por IA.

Los prompts reales `servidor/prompts/neuri.txt` y `servidor/prompts/neuri-borrador.txt` exigen español de Ecuador, uso exclusivo de la base docente, resistencia a instrucciones incluidas en textos estudiantiles y distinción entre posibilidad pedagógica y ley universal. La interfaz recuerda que las respuestas generadas deben contrastarse con el material del curso.

**Límite de la evidencia:** la captura anexa demuestra la interfaz local de tutor y sus avisos; no se presenta como una consulta nueva al proveedor. La validación docente de una muestra de respuestas sigue pendiente.

---

## Página 6 de 8 · Multimedia, accesibilidad y experiencia móvil

El recurso multimedia funcional principal es Neuri: SVG y animaciones CSS del proyecto, transcripción visible y controles para activar, pausar/reanudar y repetir la voz sintética del navegador. En Explora y aprende se muestran dos recursos Genially verificados y la adaptación interactiva de la matriz; los archivos realmente ausentes conservan su estado pendiente. Las láminas entregadas en Tarea 3 se conservan como evidencia del diseño. No existe locución grabada ni animación audiovisual autorizada adjunta.

La canción principal registrada sí dispone de un MP3 reproducible, letra/LRC, autoría y licencia `CC BY-SA` declarada. No se usa en los huecos de M2 porque su letra no desarrolla las cuatro fases de la memoria; esa actividad conserva el estado pendiente hasta recibir material específico autorizado. La antigua ruta ausente `paisaje-sonoro.mp3` fue retirada: la interfaz marca el audio como pendiente y ofrece contenido alternativo sin fingir reproducción.

La interfaz fue diseñada desde 360 px, con etiquetas, texto alternativo, foco visible, contraste y operación por mouse, teclado y pantalla táctil. En las pruebas automatizadas no hubo desbordamiento horizontal en vistas críticas y el audio permaneció desactivado inicialmente. Aún se requieren pruebas humanas con lector de pantalla, navegación completa solo con teclado, zoom al 200 %, dispositivos Android/iOS reales y varios navegadores.

Las capturas anexas muestran recursos y móvil desde una sesión estudiantil local real. No sustituyen las pruebas pendientes en dispositivos físicos.

---

## Página 7 de 8 · Pruebas, resultados y URL

El 28 de octubre de 2026 se ejecutó `npm test`: **281 pruebas, 279 aprobadas, 0 fallidas y 2 omitidas**; las omisiones corresponden a herramientas no instaladas en este equipo. El recorrido integral documentado con una cuenta estudiante distinta de la docente verificó navegación, enlaces internos, recursos, M1 con reintento, persistencia de parejas, borrador y envío de M3, control de roles y bloqueo correcto del certificado. Las pruebas específicas comprobaron conservación privada de la matriz sin accesos visibles, canción principal única, tutor contextual en M1–M3, generación real mediante Gemini, respaldo de Neuri en actividades, historial aislado por estudiante, foro general, menú adaptable con expansión por proximidad y directorio privado de Karla Paucar y ocho estudiantes en escritorio y móvil a 360 px.

El piloto controlado registró 25 de 27 pasos correctos. Sus dos fallas fueron materiales pendientes: los subtemas no son visibles para estudiantes porque continúan en borrador dentro de una unidad oculta, y la canción autorizada de M2 no existe. Para continuar el piloto se sembró temporalmente M2; ese tramo no representa un recorrido estudiantil real y los datos fueron restaurados.

Las cinco capturas generadas para este informe usan Chrome, servidor local y la cuenta `estudiante6@demo.ec`; sesiones y bitácora se restauraron después. El script reproducible es `pruebas/capturar-nr-07.6.mjs`.

**URL de desarrollo comprobada:** `http://localhost:3000/` (solo cuando el servidor está iniciado).  
**URL pública:** pendiente; la plataforma no está publicada.  
**Decisión:** no compartir todavía con estudiantes.

---

## Página 8 de 8 · Reflexión conjunta y decisión de cierre

### Reflexión conjunta (288 palabras)

Como equipo, comprendimos que integrar tecnología educativa no consiste en acumular herramientas, sino en articularlas alrededor de una decisión pedagógica verificable. Las Tareas 1–3 nos permitieron pasar del reconocimiento del ecosistema digital y la selección de recursos a una experiencia gamificada con contenidos, práctica, retroalimentación y seguimiento. Durante la implementación descubrimos que una idea visualmente atractiva necesita reglas explícitas, estados persistentes, permisos y criterios de evaluación para convertirse en una plataforma utilizable.

El trabajo con música exigió especial cuidado. Evitamos presentar preferencias personales como leyes universales y planteamos que el efecto de una condición sonora depende de la demanda de la tarea, el volumen, la activación y las diferencias individuales. Esta precaución cambió el simulador: en vez de prometer mejoras, invita a formular hipótesis, comparar condiciones y registrar evidencia. También confirmó que el silencio es una alternativa válida y no la ausencia de una propuesta.

La inteligencia artificial aportó preguntas y revisión formativa, pero no reemplaza al docente. Mantener los prompts en el servidor, limitar respuestas, impedir que revele soluciones y ofrecer respaldo docente fueron decisiones tan importantes como la generación misma. Del mismo modo, la accesibilidad no se redujo al diseño móvil: incorporamos transcripción, controles de audio, navegación por teclado y mensajes comprensibles, aunque reconocemos que faltan pruebas humanas con tecnologías de apoyo.

La principal lección fue no confundir preparación con publicación. Las pruebas locales demuestran avances reales, pero la canción autorizada, algunas aprobaciones académicas, las licencias y la URL pública siguen pendientes. Documentar esos límites fortalece el proyecto porque evita mostrar como terminado lo que aún requiere responsabilidad humana. Antes de abrir NeuroRitmo, acordamos completar los recursos, aprobar contenidos y rúbricas, realizar un piloto humano y verificar el despliegue desde otra red y un dispositivo real.

**Pendientes obligatorios antes de compartir:** completar las evidencias de vibecoding; integrar la canción autorizada; corregir o retirar el audio ausente; aprobar unidad, subtemas, distribución M2 y rúbrica M3; validar textos, IA, citas y licencias; ejecutar pruebas humanas; publicar y completar el humo de la URL real.

**Anexos:** consultar `docs/evidencias/nr-07.6/indice-evidencias.md` y `docs/evidencias/nr-07.6/prompts-representativos.md`.
