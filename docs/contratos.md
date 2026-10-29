# docs/contratos.md · Contratos del proyecto (v1)
Firmas públicas acordadas. Se implementan tal cual; los cambios se anotan en docs/estado.md.

## §A. Núcleo del navegador (publico/js/nucleo/)
api.js
  listar(col, filtros = {})       GET    /api/:col?campo=valor   → Array
  obtener(col, id)                GET    /api/:col/:id           → Object
  crear(col, datos)               POST   /api/:col               → Object con id
  actualizar(col, id, cambios)    PUT    /api/:col/:id           → Object (fusiona campos)
  eliminar(col, id)               DELETE /api/:col/:id
  llamar(metodo, ruta, cuerpo)    cualquier ruta /api/...        → JSON
  subir(archivo)                  POST   /api/subidas (campo "archivo") → { url }
  ia(tarea, datos)                POST   /api/ia/:tarea          → JSON
  · Envía "Authorization: Bearer <token>" (sessionStorage "token").
  · 401 → borra la sesión y abre /paginas/ingreso.html. Otro error → throw Error(mensaje)
    con err.estado = código HTTP (p. ej., 429 por límite diario).
ui.js        aviso(texto, tipo = "info" | "exito" | "error") · confirmar(texto) → Promise<bool>
             modal({ titulo, contenido, acciones }) → Promise<valor | null>
             cargando(bool) · escapar(texto) · limpiar(html)
util.js      normalizar(texto) · barajar(lista) · fechaLarga(iso) · fechaRelativa(iso)
             parametro(nombre) · formatoBasico(texto) → HTML seguro
menu.js      MENU = [{ texto, href, roles }]
             roles: publico | sesion | estudiante | docente | admin
plantilla.js montarPlantilla({ titulo, roles }) → encabezado, menú filtrado y pie; exige rol
             actualizarContadorMensajes(total?) → contador junto a "Mensajes" (sin total consulta
             /api/mensajes/no-leidos; se repite cada 60 s con la campana)
menu-adaptable.js  montarMenuAdaptable({ menu, boton, botonCerrar, usuario }) · escritorio recorre
             expandido → contraido → oculto → expandido; móvil usa cajón temporal cerrado por defecto
             · preferencia por cuenta en localStorage `menu.vista:<usuarioId>` · Escape y botón interno cierran
sesion.js    registrar(datos) · iniciar(correo, clave) · cerrar() · token() · exigirRol(roles)
             usuarioActual() → { id, nombre, apellido, rol } | null
bitacora.js  registrarEvento(tipo, recurso)
catalogo-actividades.js  ACTIVIDADES = [{ id, texto, descripcion, href }]  (href sin parámetros)
             incluye { id: "tutor", href: "/paginas/tutor.html" } (solo estudiantes; no se vincula en la agenda)
             y { id: "simulador", href: "/paginas/simulaciones.html" } (sus intentos usan actividad "simulacion")
avance.js    calcularAvance(asignaturaId, cache?) → { total, revisados, porcentaje }
escenarios.js  validarEscenario(sim) → [{ escena | null, mensaje }] (para publicar: destinos existentes,
             2 a 4 opciones o ninguna, puntos enteros −10 a 10, consecuencia, alcanzables, ≥ 1 final, sin
             ciclos) · mejorPuntaje(sim) · mapaEscenario(sim) → { raiz, sueltas }  (también lo usa el servidor)
             validarRol(sim) → errores (personaje completo, rúbrica de 3 a 5 criterios con puntos 1 a 20,
             maxTurnos 4 a 12)
selector-tema.js  obtenerTemaActividad() → Promise<tema>  (usa ?temaId= o muestra un selector)
retroalimentacion.js  mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema })
             mostrarResumen({ titulo, aciertos, errores, recomendaciones, enlaceTema })
               → Promise<"repetir" | "salir">
gamificacion.js  registrarIntento({ actividad, temaId, nivel, puntaje, maximo, errores,
               duracionSeg, detalle }) → { puntosGanados, puntosTotales, insigniasNuevas }
             mostrarLogros(resultado)
             logrosDe(usuarioId = "yo") → { puntos, insignias, nivelQuiz }
pdf.js       generarDiploma({ tipo: "cumplimiento" | "nivel-quiz", temaId, nivel }) → { codigo }
notificaciones.js  montarCampana() · noLeidas() → número · alConsultar(fn) (fn se ejecuta en cada
             consulta periódica de la campana)
avatar.js    montarAvatar() · decir(texto, { soloVoz? }) · vozActiva() → bool
             cambiarEstado("reposo" | "hablando" | "pensando" | "celebrando")
             · globo + voz con speechSynthesis (es-* preferida) solo si el usuario la activa
             · localStorage "avatar.voz" ("activa" | "silencio", por defecto silencio) y "avatar.oculto"
             · plantilla.js lo monta si la página tiene [data-avatar="<instrucciones>"] y llama a decir()

## §B. Servidor (servidor/) · todas las funciones de datos son async
almacen.js   leer(col) · escribir(col, lista) · agregar(col, reg) → reg (asigna id y fecha)
             actualizar(col, id, cambios) → reg · eliminar(col, id)
             buscar(col, filtro) → Array · anexarLinea(archivo, obj)
             leerLineas(archivo) → Array · leerConfig(nombre) → Object
             escribirConfig(nombre, objeto)   (atómica, datos/config/<nombre>.json)
             · col admite subcarpeta ("mensajes/con_000001"). Id: 3 letras + "_" + 6 dígitos.
permisos.js  puede(usuario, accion "leer" | "escribir", col, registro) → boolean
ganchos.js   carga servidor/ganchos/<col>.js → { filtrarLista(lista, usuario),
             antesDeGuardar(datos, usuario, anterior),
             despuesDeGuardar(reg, usuario, anterior) }
             aplicar(col, nombre, ...args) · un gancho rechaza con Error y propiedad estado
acceso.js    gruposDe(usuario) · asignaturasDe(usuario) · asignaturaDeTema(temaId)
             puedeEditarAsignatura(usuario, asignaturaId) · estudiantesDe(docenteId)
             docentesDe(estudianteId)
auth.js      cargarUsuario (pone req.usuario) · exigirRol(...roles)
gamificacion.js  procesarIntento(usuario, intento) → { puntosGanados, puntosTotales,
             insigniasNuevas }   (lo usan /api/intentos, el quiz y los foros)
notificar.js notificar(usuarioId, { tipo, mensaje, enlace })
alertas.js   evaluarAlertas(intento, usuario) · evaluarInactividad(grupoId) (también evalúa "vencidas":
             fecha-limite del grupo con actividad y tema, vencida hace > diasGracia días, sin intento
             posterior a la creación del evento; una alerta por estudiante + tema)
             limiteDe(evento) · vencidasSinIntento(eventos, intentos, diasGracia, ahora)
ia.js        ejecutarTarea(tarea, datos, usuario, { formato: "json" | "texto" }) → resultado
             Google Gemini, REST generateContent con fetch nativo (60 s) · configuracion() solo desde
             .env: GEMINI_API_KEY, IA_MODELO, IA_MODELO_ALTERNO (opcional) · configuracionPublica()
             generar({ sistema, usuario, formato, historial, temperatura }, config) → { texto, modelo, tokens }
             (historial [{ rol: "usuario" | "modelo", texto }]; un preparador lo devuelve en "historial";
             si "historial" es texto, no se envía como turnos: rellena {{historial}} de la plantilla)
             tutor.txt (Anexo B): {{asignatura}} {{nivel}} {{tema}} {{contenido}} {{historial}} {{pregunta}}
preparadores/generar-escenario.js  { temaId, situacion (≤ 800), escenas (5 a 10) } → { asignatura, nivel,
             tema, contenido, situacion, escenas } · 403 sin puedeEditarAsignatura · salida (esquemas-ia):
             { titulo, escenaInicial, escenas[{ id, texto, imagen, opciones[≤ 4]{ texto, destino, puntos −10..10,
             consecuencia } }] } · el editor la carga como borrador y la valida con escenarios.js (no guarda)
preparadores/rol-simulacion.js  { simulacionId, historial: [{ rol: "estudiante" | "personaje", texto ≤ 1.000 }] }
             → { personaje, contexto, objetivo, historial (texto "Estudiante: …" / "<Personaje>: …"), mensaje }
             (plantillas del Anexo B.4–B.6; evaluar-rol devuelve "puntos" por criterio) · 404 si no es visible o no
             es modo rol · 400 si supera maxTurnos (un turno = mensaje del estudiante)
preparadores/evaluar-rol.js  { simulacionId, historial } → { personaje, objetivo, rubrica, transcripcion }
             (últimos maxTurnos turnos; ≥ 1 mensaje del estudiante) · el simulador acota cada criterio a sus
             puntos de la rúbrica antes de registrarIntento({ actividad: "simulacion", detalle: { simulacionId, modo: "rol" } })
preparadores/tutor.js  { temaId, contexto: { misionId?, itemId?, actividad? }, historial } → { asignatura,
             nivel, tema, contenido (objetivos, resumen, ejemplos, errores frecuentes, preguntas guía,
             ≤ 30 términos aprobados), contexto verificado contra la configuración NeuroRitmo, apoyo (1–3),
             historial (texto), pregunta } · 404 tema inexistente o no publicado (estudiante) · 403 asignatura ajena
             temperatura 0,4; 0,7 en tutor y rol-simulacion (solo si el modelo la admite: models.get)
             json: primer bloque JSON → esquemas-ia; si falla, 1 reintento con "Responde SOLO con JSON
             válido."; si vuelve a fallar → 502 "La IA no devolvió un formato válido"
             restantesHoy(usuario, tarea): generar-* → limiteIADiario; tutor, rol-simulacion y
             evaluar-rol → limiteTutorDiario (429 amable) · consumo-ia.jsonl solo con conteos de caracteres
             (si el principal falla por modelo, cuota o servicio, usa modeloAlterno)
             listarModelos() · probar() ("Responde solo: OK") · rellenar() · separar() · extraerJson()
esquemas-ia.js  validarSalida(tarea, salida) → salida normalizada; 502 si no cumple los campos obligatorios
rutas/<grupo>.js         export default Router; se monta en /api antes de la API genérica
preparadores/<tarea>.js  export default async (cuerpo, usuario) → datos para la plantilla
prompts/<tarea>.txt      plantilla con {{claves}}; "### USUARIO" separa sistema y usuario

## §C. Rutas especiales (con sesión, salvo indicación)
Genérica  GET|POST /api/:col · GET|PUT|DELETE /api/:col/:id   (permisos.json + ganchos)
Auth      POST /api/auth/registro · POST /api/auth/login (sin sesión) · POST /api/auth/logout
          GET /api/auth/yo · PUT /api/auth/perfil · POST /api/auth/clave
Admin     POST /api/admin/usuarios/:id/restablecer
Archivos  POST /api/subidas · POST /api/eventos
Gamif.    POST /api/intentos · GET /api/logros/:usuarioId ("yo" permitido)
          · POST /api/intentos rechaza (403) "quiz" y "foro": los registra solo el servidor
            (/api/quiz/finalizar y el gancho de foros-respuestas)
Certif.   GET /api/certificados/estado · POST /api/certificados
          GET /api/certificados/verificar/:codigo (sin sesión)
Resumen   GET /api/resumen/estudiante/:id ("yo") · GET /api/resumen/grupo/:grupoId
          · promedio = media de puntaje/maximo×10 (1 decimal, sin "tema-revisado"; null sin datos)
          · ultimaConexion = último evento de la bitácora; tiempoMin = suma de pausas ≤ 30 min entre eventos
          · evolucion: semanas desde el lunes (hora de Ecuador); grupo: solo temas de su asignatura
          GET /api/resumen/tutor/:grupoId (docente del grupo o admin) → { porTema: [{ temaId, titulo,
          consultas }], porEstudiante: [{ id, nombre, consultas }] } (estudiantes del grupo, temas de su asignatura)
Notif.    GET /api/notificaciones → { notificaciones (30 más recientes), noLeidas } · POST /api/notificaciones
          (docente → estudiantes de sus grupos; admin → cualquiera; enlace solo rutas internas "/…")
          POST /api/notificaciones/:id/leida · POST /api/notificaciones/leidas
Alertas   GET /api/alertas?grupoId= → { alertas, mensajesApoyo }  (alertas con nombre del estudiante y tema)
          PUT /api/alertas/:id { estado: "activa" | "atendida" } (único campo editable; no se crean ni borran por API)
IA        POST /api/ia/:tarea   tareas: generar-glosario, generar-preguntas, generar-escenario,
          tutor, rol-simulacion, evaluar-rol · GET /api/ia/prueba (admin)
          GET /api/ia/configuracion (admin; clave enmascarada) · GET /api/ia/modelos (admin)
          · generar-* solo docente y admin · texto → { respuesta } · sin preparador → 404
          GET /api/ia/restantes?tarea= → { restantes, limite } (null sin límite)
Tutor     POST /api/ia/tutor { temaId, contexto?: { misionId?, itemId?, actividad? },
          historial: [{ rol: "estudiante" | "tutor", texto ≤ 1.000 }] } → { respuesta ≤ 90 palabras,
          2–4 frases y exactamente una pregunta orientadora } · usa los 10 últimos; el último es la pregunta
          del estudiante · ofrece pistas progresivas con apoyo 1–3 sin revelar soluciones · el servidor deriva
          misión, ítem y concepto de la configuración real, no confía en rótulos enviados por el cliente
          · límite ajustes.limiteTutorDiario · la conversación vive por usuario en sessionStorage;
          el servidor solo cuenta mensajes en consultas-tutor y no escribe intentos ni calificaciones
Quiz      GET /api/quiz/estado?temaId= · POST /api/quiz/iniciar · POST /api/quiz/responder
          POST /api/quiz/finalizar
Foros     GET /api/foros-hilos/:id · GET /api/foros-respuestas/:id (con las reglas de filtrarLista;
          la API genérica por id no las aplica). Listado, alta y edición por la API genérica + ganchos.
Participantes  GET /api/participantes/:asignaturaId (estudiante o docente integrante) →
          { asignatura: { nombre }, docente: { nombre, foto } | null,
          estudiantes: [{ nombre, foto }], totalEstudiantes }
          · deriva la lista del distributivo · 403 fuera de la asignatura · nunca devuelve contacto ni ids
Agenda    GET /api/agenda/recordatorios → [{ id, eventoId, titulo, tipo, mensaje, enlace, minutos }]
          (eventos propios y de mis grupos con inicio − minutos ya alcanzado y no avisado; una notificación
          tipo "agenda" por evento; marca avisados[usuarioId]; no avisa eventos ya pasados)
          GET /api/agenda/:id (con las reglas de filtrarLista)
Simulac.  GET /api/simulaciones/:id (con las reglas de filtrarLista; listado y escritura por la API genérica)
Conten.   GET /api/temas/:id · GET /api/unidades/:id · GET /api/noticias/:id (con las reglas de filtrarLista:
          404 para borradores, unidades ocultas o asignaturas ajenas según el rol)
Mensajes  GET /api/mensajes/contactos · GET|POST /api/mensajes/conversaciones
          GET /api/mensajes/no-leidos · GET /api/mensajes/:convId?desde=&antes=
          POST /api/mensajes/:convId · POST /api/mensajes/:convId/leido
          POST /api/mensajes/difusion · POST /api/mensajes/bloquear
          DELETE /api/mensajes/bloquear/:usuarioId
          GET /api/mensajes/reporte/:reporteId (admin) · POST /api/mensajes/ocultar (admin)
          · contactos → [{ id, nombre, apellido, rol, foto }] (sin bloqueos en ningún sentido)
          · conversaciones → [{ id, otro, ultimo, noLeidos, bloqueado, bloqueadoPorMi, fecha }]; POST { con }
            → 201 creada | 200 existente (solo con contactos) · no-leidos → { total }
          · GET :convId → { mensajes (≤ 50, antiguo → nuevo, sin ocultos), hayMas, leidoHastaOtro };
            ?desde= los siguientes · ?antes= los anteriores · POST :convId { texto ≤ 2.000 } → 201 mensaje
            (403 con bloqueo · 429 si > 30 por minuto) · POST :convId/leido → { ok, leidoHasta }
          · difusion (docente del grupo) → { total, enviados[{ usuarioId, conversacionId }], omitidos[] }
          · reporte/:id → { reporte, conversacion, mensaje, anteriores (5) } · ocultar { referenciaId }

## §D. Colecciones (datos/<col>.json) · todas con id y fecha (ISO)
usuarios          nombre, apellido, correo, claveHash, rol, activo, foto,
                  consentimiento{aceptado, fecha}
sesiones          token, usuarioId, expira
bitacora.jsonl    usuarioId, tipo, recurso, fecha
asignaturas       nombre, descripcion, nivel
distributivo      asignaturaId, paralelo, periodo, docenteId, estudiantes[]
unidades          asignaturaId, titulo, orden, visible
temas             unidadId, titulo, orden, objetivos[], resumen, ejemplos[],
                  erroresFrecuentes[], preguntasGuia[], recursos[{tipo, titulo, url}],
                  palabrasClave[], dificultad, fuentes, estado(borrador|publicado)
glosario          temaId, termino, definicion, pista, retroalimentacion,
                  origen(docente|ia), estado(aprobado)
progreso-temas    usuarioId, temaId
noticias          titulo, resumen, cuerpo, imagen, categoria, temaId, destacada,
                  estado(borrador|publicado), autorId, fechaPublicacion
lecturas-noticias usuarioId, noticiaId
canciones         titulo, temaId, audio, letra, lrc, autoria, licencia
insignias         nombre, descripcion, icono, condicion{tipo, ...}
intentos          usuarioId, actividad, temaId, nivel, puntaje, maximo, errores,
                  duracionSeg, detalle, puntos
logros            usuarioId, puntos, insignias[{id, fecha}], nivelQuiz{temaId: n}
certificados      codigo, usuarioId, tipo, detalle, nombreCompleto
notificaciones    usuarioId, tipo, mensaje, enlace, leida, remitente (solo "mensaje-docente")
                  tipos: noticia · mensaje-docente · banco-insuficiente · alerta · foro · agenda
alertas           estudianteId, docenteId, grupoId, regla, temaId, detalle,
                  estado(activa|atendida), fechaAtendida, atendidaPor
                  reglas: promedioBajo · fallosQuiz (temaId) · inactividad · una activa por estudiante+regla(+tema)
consumo-ia.jsonl  usuarioId, tarea, entrada, salida, ok, fecha   (entrada y salida = nº de caracteres)
preguntas         temaId, nivel(1-5), tipo(opcion|vf|completar), enunciado, opciones[],
                  correcta(índice | true/false | texto), retroalimentacion, origen, estado
quiz-sesiones     usuarioId, temaId, nivel, preguntasIds[], respuestas{}, inicio, finalizada
foros-hilos       asignaturaId, temaId, titulo, texto, autorId, fijado, cerrado, oculto,
                  ultimoMovimiento, autorNombre, autorRol, editado
foros-respuestas  hiloId, texto, respuestaAId(null|id de propuesta ajena), autorId,
                  destacada, oculta, autorNombre, autorRol, editado
                  (autorNombre/autorRol se fijan al crear: los estudiantes no pueden leer usuarios)
reportes          tipo(foro|mensaje), referenciaId, motivo, reportadoPor,
                  estado(pendiente|resuelto), coleccion(foros-hilos|foros-respuestas|mensajes),
                  (tipo "mensaje": referenciaId "<convId>/<mensajeId>", solo un participante y no el autor)
                  resolucion(ocultado|descartado), resueltoPor, fechaResolucion
                  (coleccion es necesaria: hilos y respuestas comparten el prefijo de id "for_")
agenda            titulo, tipo(tarea|reunion|fecha-limite|recordatorio), inicio, fin,
                  todoElDia, propietarioId, grupoId, actividad, temaId,
                  recordatorios[minutos], avisados{usuarioId: [minutos]},
                  estadoPlanificacion(confirmado|propuesta|pendiente-confirmacion), responsable, enlace
                  (inicio/fin: ISO; con todoElDia "AAAA-MM-DD" y fin inclusivo · recordatorios ⊂ [1440, 60]
                  · grupoId, actividad y temaId solo docente/admin · avisados lo gestiona el servidor y se
                  reinicia si cambian inicio o recordatorios · responsable y enlace son visibles; enlace solo
                  admite rutas internas y los hitos académicos solo los configura docente/admin)
conversaciones    participantes[], ultimo{texto, fecha, autorId}, leidoHasta{usuarioId: fecha}
mensajes/<convId> autorId, texto, oculto, ocultoPor, fechaOculto
                  (conversaciones, mensajes y bloqueos: permisos "servidor"; solo por /api/mensajes/…)
bloqueos          usuarioId, bloqueadoId
consultas-tutor   usuarioId, temaId, dia, mensajes
                  (mensajes = número de mensajes enviados al tutor; uno por usuario + tema + día; sin textos)
simulaciones      temaId, titulo, modo(escenarios|rol), estado, escenaInicial,
                  escenas[{id, texto, imagen,
                           opciones[{texto, destino, puntos, consecuencia}]}],
                  personaje{nombre, descripcion, contexto, objetivo},
                  rubrica[{criterio, descripcion, puntos}], maxTurnos, autorId
                  (estado borrador|publicado; estudiantes: solo publicadas de sus asignaturas; escribir:
                  puedeEditarAsignatura del tema · al publicar en modo escenarios: escena inicial existente,
                  destinos válidos y al menos un final = escena sin opciones · intento: actividad "simulacion",
                  maximo = puntaje del mejor camino, detalle { simulacionId, recorrido })

unidades (gancho)        crear: título obligatorio (400) y único por asignatura sin tildes ni mayúsculas (409);
                         editar: permiso sobre asignatura de origen y destino (403); eliminar: permiso sobre su asignatura (403)
temas (gancho)           crear: título obligatorio (400) y único por unidad sin tildes ni mayúsculas (409);
                         editar y eliminar: permiso sobre la asignatura de origen y la de destino (403);
                         publicar (estado publicado): faltasParaPublicar(tema) vacía → resumen, ≥1 objetivo y
                         recursos con título y url http(s) o ruta interna; si no, 400. Nunca cambia el estado solo
temas (subtemas)         sin entidad propia: cada subtema es un tema de la unidad (1.1 → tem_000012, 1.2 →
                         tem_000013); el tema «Fundamentos…» se presenta en explorar.js (SUBTEMAS_NEURORITMO)
recursos[].tipo          lectura | video | pdf | imagen | audio | enlace | actividad (ruta interna, p. ej. una misión)
glosario, canciones      editar y eliminar: permiso sobre la asignatura del tema de origen (403)
simulaciones (estudiante) solo publicadas cuyo tema esté publicado y en unidad visible de sus asignaturas
GET por id filtrado      asignaturas, unidades, temas, glosario, canciones, noticias (rutas/contenidos.js) y
                         simulaciones (rutas/simulaciones.js): lo que filtrarLista oculta responde 404

## §E. Configuración (datos/config/)
permisos.json            { "<col>": { "leer": [...], "escribir": [...] } }
                         valores: publico, sesion, estudiante, docente, admin, propio, servidor
ajustes.json             nombrePlataforma, maxSubidaMB, limiteIADiario, limiteTutorDiario,
                         chatEntreEstudiantes, alertasAdmin
reglas-gamificacion.json puntos, bonoSinErrores, unicas, requiereAprobado, maxDiario,
                         limiteIntentosHora, quiz{...}, certificado{...}   (Anexo A)
reglas-alertas.json      promedioBajo, fallosQuiz, inactividad, vencidas, mensajesApoyo[]
(IA)                     sin archivo de configuración: clave y modelo solo en .env (GEMINI_API_KEY,
                         IA_MODELO, IA_MODELO_ALTERNO); la API nunca devuelve la clave
reglas-gamificacion.json además: puntos.neuroritmo = 100 y mejorPuntaje { "neuroritmo": ["detalle.mision"] }
                         (solo suma la mejora sobre el mejor intento de la misma clave, sin bono)
neuroritmo.json          titulo, asignaturaId, narrativa, objetivo, duracion, reglasJuego[], aprobacion (70),
                         logroTotal (240), justificacionValidaM3 (24), alertas { misionBaja, misionPendiente },
                         galeria { titulo, temaId }, recursos { screencast, infografia, matriz } (Tarea 2),
                         misiones[] (M1 y M2 con items[] y justificacion{ tarjetas[] }; M3 con caso,
                         recursosSonoros[], bloques[], rubrica[] de 4 criterios). Las respuestas solo viven aquí.

## §F. NeuroRitmo: Misión Cerebro Sonoro (Tarea 3)
Página           index.html (Inicio, raíz) · css/modulos/neuroritmo.css · js/modulos/neuroritmo.js
                 paginas/neuroritmo.html: redirección a /index.html conservando ?consulta y #sección
                 paginas/explorar.html · css/modulos/explorar.css · js/modulos/explorar.js: catálogo de temas
                 y noticias destacadas (antiguo Inicio)
                 Storyboard (8 vistas por hash, con Anterior/Siguiente): #inicio (Bienvenida) #instrucciones #mapa
                 #actividad (#mision-m1..m3) #retroalimentacion #progreso #resultados #reiniciar; docente: #panel
                 Avatar Neuri: data-avatar + data-personaje="neuri".
Núcleo           js/nucleo/neuroritmo.js (compartido con el servidor): MISIONES, contarPalabras, claveSimulador,
                 puntosParejas, puntosCancion, puntuarJustificacion, revisarDiseno, minutosSecuencia, estadoRuta
                 estadoRuta: abierta | bloqueada | aprobada | pendiente | devuelta (en el mapa: Disponible,
                 Bloqueada, Completada, Pendiente de validación, Devuelta). Cadena estricta: M2 exige ≥ aprobacion
                 (70) en M1 y M3 en M2 desbloqueada; M3 solo «aprobada» con validación docente
Avatar global    plantilla.js monta una sola instancia de Neuri en todas las páginas; avatar.js conserva en
                 localStorage `avatar.voz` y `avatar.vista` (abierto|minimizado|oculto), y en sessionStorage
                 `avatar.texto`. El panel ofrece abrir, minimizar, ocultar/mostrar, activar/silenciar, pausar,
                 reanudar y repetir; inicia minimizado y la voz permanece apagada mientras no exista preferencia.
Tutor global     tutor-neuri-global.js se monta dentro de la instancia global solo para estudiantes, excepto en
                 tutor.html, que reutiliza el mismo historial. Detecta tema, misión, ítem y actividad de la vista;
                 historial-tutor.js guarda como máximo 40 mensajes en `neuri.tutor:<usuarioId>` y envía los 10
                 últimos. El cambio de pantalla conserva el diálogo y actualiza el rótulo de contexto.
Mapa (#mapa)     estaciones Atención/Explorador, Memoria/Investigador, Integración pedagógica/Diseñador; cada
                 tarjeta: estado, mejor puntaje, botón de la misión y enlaces a tema.html?id= y ahorcado.html?temaId=
                 avatar.js: montarAvatar({ personaje: "lumi" | "neuri" }), figuraNeuri()
Rutas            GET  /api/neuroritmo/presentacion (sin sesión) → { experiencia } solo narrativa, reglas, recursos y estaciones
                 GET  /api/neuroritmo → { experiencia (sin respuestas), rol, galeriaHiloId, progreso? }
                 GET  /api/autodiagnostico-musical → { registro?, cancionPrincipal? } (solo estudiante matriculado;
                      devuelve únicamente el registro propio y la canción principal saneada)
                 PUT  /api/autodiagnostico-musical { contexto: lectura|problemas,
                      condicion: silencio|cancion-principal, respuestas{ preguntaId: 1..4 }, observacion? }
                      → { registro } (solo estudiante matriculado; el servidor valida las ocho respuestas,
                      calcula la retroalimentación orientativa y conserva un registro por estudiante)
                 POST /api/neuroritmo/:mision/iniciar { nueva? } → partida (estudiante; 403 si bloqueada)
                 responder → retro { nivel, concepto, explicacion, revisar ("" si 15/15), sugerencia,
                 complemento?, recurso, … } (corregirItem)
                 justificacion de M1: tarjetas (30) + criterios[{ id, texto, puntos, indicadores[] }] (10) y
                 validacionDocente { estado, nota }; puntuarJustificacion devuelve criterios[{ id, texto, puntos,
                 cumple }]. Pública: criterios[{ id, texto, maximo }] sin indicadores. Sin criterios (M2): por palabras
                 iniciar, responder, pista, finalizar y POST /api/ia/neuri: 403 si la misión está bloqueada
                 (exigirDesbloqueada, recalculado con el progreso real en cada petición)
                 POST /api/neuroritmo/:mision/responder { item, valor } → { puntos, maximo, retro } (409 si repite)
                 POST /api/neuroritmo/:mision/pista { item, nivel 1..3 } → { nivel, tipo, pista } (en orden)
                 POST /api/neuroritmo/:mision/finalizar  M1/M2 { tarjetas[2], texto } → puntaje 60+40 e intento
                                                         M3 { diseño de 4 bloques } → entrega "pendiente"
                 GET  /api/neuroritmo/grupos · GET /api/neuroritmo/panel?grupoId= (docente del grupo o admin)
                 Borrador de M3 (solo el propio; 403 si M3 bloqueada o sin grupo):
                 GET    /api/neuroritmo/m3/borrador → { borrador{ diseno, fecha, guardados, basadoEn } | null,
                        entregas[ versiones propias con etapa, comentario y diseño ] }; sin borrador y con la
                        última versión devuelta, propone partir de ella (basadoEn)
                 PUT    /api/neuroritmo/m3/borrador { diseno, basadoEn? } → { fecha, guardados } (incompleto vale;
                        409 si hay una versión enviada o en revisión) · DELETE /api/neuroritmo/m3/borrador
                 Etapas (etapaEntrega): enviado (pendiente) → en-revision (pendiente + revisionInicio) →
                        devuelto (devuelta) | aprobado (validada). Solo el docente asigna puntaje
                 POST /api/neuroritmo/entregas/:id/revision (docente del grupo o admin) → etapa en-revision (409 si no
                        está «enviado»)
                 Rúbrica M3: config misiones[m3].rubrica[{ id c1..c4, criterio, descripcion, tipo: producto |
                        justificacion, maximo }] (producto suma 60, justificación 40; reglas.errorRubrica y
                        subtotalesRubrica) y rubricaConfig { estado: propuesta|aprobada, version, fuente, aprobadaPor,
                        fechaAprobacion, historial[{ accion, version, fecha, por }] }. Pública: rubrica + rubricaEstado
                 GET  /api/neuroritmo/rubrica (docente o admin) · PUT /api/neuroritmo/rubrica { criterios, aprobar?,
                        confirmado? } solo el docente de la asignatura; guardar → propuesta; aprobar exige confirmado
                        y sube la versión
                 POST /api/neuroritmo/entregas/:id/calificar { criterios{c1..c4}, decision, comentario, confirmado: true,
                        rubricaVersion } solo el docente del grupo (estudiante y admin 403); 409 si la rúbrica no está
                        aprobada o cambió de versión; guarda producto, justificacion, puntaje, copia de la rúbrica y
                        una entrada en historial con los subtotales
                      validada exige c4 ≥ 24 → intento M3 { validada: true }; devuelta exige comentario
                 Distribución de los 60 puntos (M2): config misiones[m2].distribucion { estado: propuesta|aprobada,
                      fuente, valores{ i1..i4 }, razones{}, propuestaOriginal?, aprobadaPor, fechaAprobacion };
                      sin ella, 15 por ítem. corregirItem(item, valor, maximo) escala la corrección base (sobre 15)
                      con reglas.ponderar; reglas.pesosItems(mision), reglas.errorDistribucion (5 a 30, suma 60).
                      Pública: distribucion { estado, valores, fuente }; finalizar devuelve distribucion (estado)
                      e items[{ concepto, recurso, puntos, maximo, revisar, indicador }]
                 GET  /api/neuroritmo/distribucion (docente o admin) → { estado, fuente, items[{ id, titulo, valor,
                      propuesto, razon }], puedeAprobar, aprobadaPor, fechaAprobacion, ajustada }
                 POST /api/neuroritmo/distribucion { valores } (docente de la asignatura o admin; 403 otros, 400 si
                      no suma 60, 409 si ya aprobada). Los intentos finalizados conservan su puntaje
                 POST /api/ia/neuri { mision, item, modo: pista|error|borrador, nivel?, justificacion?, borrador? }
                      → { respuesta ≤ 700 } · límite limiteTutorDiario · M1 solo desde el 2.º intento (403)
                 Política de Neuri: neuroritmo.json → ia { niveles[3] (pregunta orientadora, pista conceptual,
                      ejemplo paralelo), misiones{ m1: desdeIntento 2, modos pista|error; m2: pista; m3: borrador },
                      maxPalabras 110 }; exigirPolitica (preparadores/neuri.js) → 400/403. Pública: experiencia.ia.
                      neuri registra partida.solicitudes[{ tipo, item, nivel?, fecha }]. Salida controlada
                      (esquemas-ia.js validarTexto: breve, sin «respuesta correcta», opción, palabras faltantes,
                      fracciones, puntaje ni calificación; un reintento y luego 502). Los preparadores pueden
                      devolver __control (no llega al modelo). Sin IA (403 de uso, 429, 5xx): pista docente rotulada
                 POST /api/ia/neuri-borrador { borrador } (estudiante con M3 desbloqueada y diseño abierto; 409 sin
                      partida, 400 vacío) → { fortaleza{ aspecto, texto }, mejoras[2] } con aspecto objetivo |
                      viabilidad | diversidad | comprobacion. Al modelo: microactividad saneada (limpiarDiseno +
                      anonimizar: sin nombre, correo ni números largos), lista de cotejo y criterios de la rúbrica.
                      El esquema rechaza puntajes y reescrituras (502). Registra partida.solicitudes[{ tipo, fecha }]
                      e ia.diseno; consumo-ia guarda ok. Sin servicio: el navegador usa las pistas docentes
                      (/api/neuroritmo/m3/pista) y lo indica como «no generadas por IA»
                 POST /api/ia/neuri-actividad { actividad, modo: pista|error, nivel?, … } (solo estudiante; 403 otros
                      roles) → { respuesta }. Actividades complementarias, separadas de las misiones (no lee ni
                      escribe neuroritmo-partidas): ahorcado|pareja|sopa-letras|crucigrama { temaId, terminoId,
                      otroId? (pareja), acertadas?/erradas? (ahorcado), seleccion? (sopa), intento? (crucigrama) };
                      quiz { sesionId, preguntaId } (sesión propia; pista sin responder, error tras fallar);
                      simulador { simulacionId, escena, opcion? } (solo modo escenarios, visibilidad de la colección).
                      Niveles = AYUDAS de neuri.js. __control.prohibidos: palabra oculta, definición, opción o
                      decisión correcta y su posición; validarTexto('neuri-actividad') también detecta citas con
                      otra puntuación y palabras deletreadas. Límite: limiteTutorDiario. Navegador:
                      js/nucleo/ayuda-neuri.js montarAyudaNeuri({ actividad, antesDe, contexto }) → { reiniciar };
                      sin servicio, límite o conexión: pista predefinida rotulada «sin IA»
                 POST /api/certificados { tipo: "neuroritmo" }: requisito combinado obligatorio = estadoRuta.condiciones
                      (cinco: m1, m2, m3 ≥ aprobación [M3 solo validada], total ≥ logroTotal, validacion M3).
                      Falta algo → 403 { error "Falta: …", requisitos } y no se crea registro. Si procede guarda
                      { puntuacion{ m1, m2, m3, total, maximo, aprobacion, logroTotal }, misiones[{ id, titulo,
                      puntaje, maximo }], insignias[nombres], huella (SHA-256 de código, nombre, fecha, puntuación,
                      misiones e insignias; 16 hex) }. GET /api/certificados/estado?tipo=neuroritmo → { condiciones,
                      cumple, total, maximo }. GET /api/certificados/verificar/:codigo añade puntuacion, misiones,
                      insignias, huella e integro (huella recalculada)
                 POST /api/intentos rechaza "neuroritmo" (403): lo registra solo el servidor
Colecciones      neuroritmo-partidas { usuarioId, mision, numero, estado: en-curso|finalizada|abandonada,
                   respuestas{ item: { valor, puntos, maximo, retro } }, pistas{ item: nivel }, ia{ item: n },
                   justificacion?, puntaje?, entregaId? }                         (solo servidor)
                 neuroritmo-entregas { usuarioId, grupoId, partidaId, diseno, cotejo, estado: pendiente|validada|
                   devuelta, version, versionAnterior (devuelta previa, que se conserva intacta), evidencias{ cotejo[],
                   minutos, palabrasJustificacion, guardadosBorrador, pistas, usosIa, segundos },
                   historial[{ etapa, fecha, por }], revisionInicio?, criterios?, puntaje?, comentario?, docenteId?,
                   fechaRevision? } (solo servidor)
                 neuroritmo-borradores { usuarioId, diseno, fechaActualizacion, guardados, basadoEn } (solo servidor;
                   uno por estudiante, se elimina al enviar)
                 autodiagnosticos-musicales { usuarioId, contexto, condicion, respuestas, observacion,
                   cancionId?, resultado{ promedioGeneral, dimensiones, nivel, mensaje }, fechaActualizacion }
                   (solo servidor; un registro propio por estudiante; no crea intentos, puntos ni insignias)
                 intentos: actividad "neuroritmo", temaId de la misión, maximo 100,
                   detalle { mision, decision, justificacion, pistas, usosIa, partidaId | entregaId, validada? }
Reglas           Fuente única: datos/config/reglas-gamificacion.json → neuroritmo { misiones, puntosPorMision 100,
                 decision 60, justificacion 40, aprobacion 70, logroTotal 240, justificacionMinimaM3 24,
                 conservarMejorIntento, descuentoPorPista 0 (forzado), mejoraMinima 15, mejoraRequiereRetro,
                 ecoPalabrasMinimas 15 }. nucleo: normalizarReglas, combinarReglas(experiencia, gamificacion) →
                 experiencia.reglas + atajos aprobacion/logroTotal/justificacionValidaM3; leerExperiencia() ya
                 combina y guardarExperiencia() no reescribe las reglas en neuroritmo.json. Pública: experiencia.reglas.
                 procesarIntento("neuroritmo") no usa puntos genéricos, bono, únicas, requiereAprobado, maxDiario
                 ni nivel de quiz; suma solo la mejora sobre la mejor nota de la misión.
                 POST /api/neuroritmo/:mision/retro-revisada (M1/M2, desde el 2.º intento) → partida.retroRevisada;
                 progreso.retroAnterior[mision] { numero, puntaje, items[{ concepto, puntos, maximo, revisar, recurso }] };
                 intento.detalle { numero, retroRevisada (abrió la retro anterior, usó pistas o Neuri) }
Insignias        observador-atencional, guardian-memoria, disenador-neuroritmico ("mision"; mínimo = aprobacion
                 central; m3 solo con validada), mente-en-ajuste ("mejora": +mejoraMinima sobre el intento anterior
                 de la misión con detalle.retroRevisada), eco-colaborativo ("aporteForo": respuesta en un hilo
                 ajeno del tema de la Galería con ≥ ecoPalabrasMinimas palabras); grupo "neuroritmo".
                 Las respuestas de foro registran detalle { hiloId, temaId, palabras, hiloAjeno } (sin el texto).
Alertas          misionBaja (2 intentos bajo la aprobación central), misionRetrasada (plazo docente vencido sin
                 superar la misión; la primera en esa situación) y misionPendiente (sin plazo: 5 días) → panel
                 docente. evaluarMisionPendiente(grupo) se ejecuta al abrir /api/neuroritmo/panel y con
                 evaluarInactividad. Mensajes de apoyo: Anexo A + neuroritmo.json → alertas.mensajesApoyo
Plazos           neuroritmo-plazos { grupoId, plazos{ m1?, m2?, m3? AAAA-MM-DD }, docenteId, fechaActualizacion }
                 (solo servidor). GET /api/neuroritmo/plazos?grupoId= (docente del grupo o admin) ·
                 PUT /api/neuroritmo/plazos { grupoId, plazos } (solo el docente del grupo; orden no decreciente)
Paneles          GET /api/neuroritmo → progreso { …, insigniasRuta[{ id, nombre, icono, descripcion, obtenida }],
                 reforzar[{ mision, concepto, recurso?, detalle? }] (conceptosPorReforzar), plazos } solo del usuario.
                 /api/neuroritmo/panel añade plazos, alertas activas de NeuroRitmo y estudiantes[].alertas.
                 Vistas: mi-progreso.html (sección NeuroRitmo) y panel-docente.html (sección NeuroRitmo)
