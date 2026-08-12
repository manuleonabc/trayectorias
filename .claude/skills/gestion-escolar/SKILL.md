---
name: gestion-escolar
description: Contexto de dominio y arquitectura del proyecto Trayectorias, sistema de gestion de trayectorias educativas para escuelas del distrito La Matanza (cuentas @abc.gob.ar). Usar al trabajar en rutas, controllers, services, repos o modelos (Usuario, Persona, Institucion, Estudiante, Inscripcion, CursadaAsignatura, AdultoResponsable, Cargo, Designacion, Licencia, CargoCurso, SolicitudCargo, Curso, Rol, Turno, Anio, Orientacion, Asignatura), en el login con Google, en el sistema de permisos (nivelAcceso, nivelPoder, modo gestion, institucion/cargo activos), en el panel de admin (/admin/*), en el esquema de claves-no-ids de las URLs, en el alta/aprobacion de instituciones y agentes, o en los datos de nacimiento/domicilio con Georef.
user-invocable: true
---

# Trayectorias — sistema de gestion escolar (La Matanza)

Stack: Node/Express 5 + EJS (Bootstrap 5, tema oscuro, + Bootstrap Icons) +
Mongoose/MongoDB Atlas + Passport (Google OAuth2, dominio restringido a
`@abc.gob.ar`). Sin build step, JS del lado del cliente minimo y vanilla
(ver "AJAX" mas abajo — es la unica excepcion consciente, junto con los
`fetch` a la API de Georef para nacimiento/domicilio).

## Estado actual y proximo paso (al 2026-08-10)

Todo lo que se describe aca fue implementado a lo largo de varias sesiones
largas. **Importante**: por una limitacion de red del entorno del
asistente, no se pudo probar nada de esto contra la base real de Mongo
Atlas ni contra Google OAuth via HTTP — se valido con `node --check`,
compilando/renderizando los `.ejs` con `ejs`, y con `validateSync()` de
Mongoose sobre instancias en memoria (sin guardar). El usuario si pudo
probar varias cosas en su propio entorno (y asi se encontraron bugs reales,
ver "Bugs encontrados en uso real" mas abajo) — pero no asumas que algo
esta 100% verificado en runtime real hasta que se confirme.

**El proyecto se subio a git por primera vez el 2026-08-10** (nunca antes
habia sido commiteado en este repo) — ver "Seguridad" mas abajo para el
cuidado de siempre con la raiz del repo.

Funcional (en el sentido de "el codigo esta"): login con Google (con modo
gestion real, ver permisos), alta/aprobacion de instituciones y agentes,
panel de admin completo (`Rol`, `Cargo` con edicion de clave, `Turno`+modulos,
`Orientacion`, `Anio`+`Asignatura`, `Institucion`, `Curso`), el sistema de
`Designacion`/`Licencia`, `CargoCurso`, `SolicitudCargo` (pedir/aprobar un
cargo vacante), todo el modulo de `Estudiante` (alta, edicion, baja real,
`Inscripcion` con `numeroRegistro`, `CursadaAsignatura`, `AdultoResponsable`),
nacimiento/domicilio con selects encadenados contra Georef, un primer nivel
de sistema de permisos (`nivelAcceso`, `nivelPoder`, modo gestion,
institucion activa), y un primer recorte real de Fase 3: el **aterrizaje
post-login segun `nivelAcceso`** (dashboard de 3 bloques para jerarquicos/
EMATP en `/inicio`, cursos designados para preceptor en `/mis-cursos`,
directorio de cargos de solo lectura en `/mis-cargos`) — ver "Landing segun
nivelAcceso" mas abajo. El resto de Fase 3 (que `nivelAcceso` filtre algo
**dentro** de `/estudiantes`) sigue sin tocar.

**Lo que sigue, en orden de lo mas charlado a lo menos:**
- **Resto de Fase 3**: `/estudiantes` en si sigue 100% abierto a cualquier
  autenticado, sin importar el cargo activo — lo unico implementado hasta
  ahora es A DONDE aterriza cada quien despues de loguearse (ver "Landing
  segun nivelAcceso"), no que pueda hacer una vez adentro de `/estudiantes`.
- **Regimen academico / `Valoracion`** (Nuevo Regimen Academico, Res.
  1650/24): modelo, repo (incluida la logica que escribe
  `aprobada`/`fechaAprobacion`/`notaFinal` en `CursadaAsignatura` cuando
  corresponde) y la primera pantalla de carga (**por asignatura**, la del
  profesor, en `/valoraciones/asignatura`) **ya construidos** — ver
  "Regimen academico y `Valoracion`" mas abajo para el diseño completo.
  **Todavia sin construir**: las otras 2 pantallas de carga (por curso y
  por estudiante, para preceptor/EMATP/jerarquicos) y el "resumen" por
  estudiante (pantalla aparte, deliberadamente no incluida en la carga).
- **Datos de salud e inclusion/alimentario/complementaria** de la planilla
  de inscripcion: deliberadamente no encarados todavia.
- **Migracion de datos viejos**: varios campos nuevos son `required` (o
  necesarios para que funcione una pantalla) pero los documentos ya
  existentes en Mongo (creados antes del campo) no lo tienen. Ver
  "Migraciones pendientes" mas abajo — algunas ya tienen script/pantalla
  para resolverlas (`Cargo.clave`, `Institucion.clave`), otras siguen sin
  resolver (`Anio.grado`, `Turno.clave` en turnos viejos).
- Observador-Familia (ver boletin): no resuelto, necesita un vinculo con
  `Estudiante` que no esta diseñado todavia.
- No hay `/dashboard` real generico — `/estudiantes` sigue siendo la
  landing provisoria para cualquiera que no sea admin en modo gestion (que
  ahora aterriza distinto, ver permisos).
- Extender `tipoDocumento`/`numeroDocumento`/`estadoDni` tambien a los
  campos especificos de `AdultoResponsable` mas alla de lo ya hecho, si
  aparecen casos reales de LC/LE u otros documentos historicos.

Todo el detalle, razones y decisiones de diseño de cada punto estan en las
secciones de abajo — este resumen es solo para orientarse rapido.

## Dominio

Sistema de seguimiento y acompañamiento de trayectorias educativas para
instituciones del distrito de La Matanza (provincia de Buenos Aires). Solo
inician sesion cuentas Google del dominio `abc.gob.ar`; el resto queda
rechazado en `src/config/passport.js`.

## Sistema de permisos — dos ejes, mas modo gestion + institucion/cargo activos

Diseñado y parcialmente implementado a lo largo de una conversacion larga,
con aprobacion explicita del usuario en cada punto. Estado real: **los
campos y el flujo de sesion estan, el enforcement sobre `/estudiantes`
todavia no** (esa es la Fase 3 pendiente, ver arriba).

### Los dos ejes de permisos

1. **`Rol.nivelAcceso`** (nuevo campo en el catalogo de cargos, no en
   `Usuario`): `'total' | 'preceptor' | 'profesor' | 'ninguno'`, default
   `'ninguno'` (fail-closed a proposito — los ~5 `Rol` ya cargados en Mongo
   quedaron sin clasificar hasta hacerlo a mano en `/admin/roles`, que ya
   tiene el `<select>` en el form de alta y una columna en el listado).
   Pensado para determinar que puede hacer un docente segun su `Cargo`
   activo:
   - `profesor`: solo su asignatura/curso propios (`Cargo.cursoId`/
     `asignaturaId`).
   - `preceptor`: sus cursos (via `CargoCurso`).
   - `total`: todo lo de estudiantes salvo crear `Curso`/`Anio`/`Asignatura`
     y salvo baja real (eso es del otro eje).
   - **Nada de esto se lee todavia en ningun controller de `/estudiantes`**
     — es la Fase 3 pendiente.
2. **`Usuario.nivelPoder`** (nuevo campo, solo tiene sentido si
   `rol === 'admin'`, mismo criterio que `alcance`): `'total' | 'gestion'`,
   default `'gestion'`. Eje independiente de `alcance` (`alcance` = CUANTAS
   instituciones administra, `nivelPoder` = QUE puede hacer). `'total'`
   habilita: baja real de estudiante (`postEliminarEstudiante`) y las
   rutas de plan de estudios en `/admin/anios` (crear `Anio`, crear
   materia — plantilla u orientacion —, agregar una orientacion a un año,
   editar una fila existente; ver `requireNivelPoderTotal` local en
   `src/routes/admin/anio.router.js`). `POST /admin/cursos` **se queda en
   `'gestion'`** a proposito (confirmado explicitamente: un `Curso` es
   interno de cada institucion, a diferencia de `Anio`/`Asignatura` que es
   estructura curricular de todo el distrito).

### Modo gestion (sesion, `req.session.modoGestion`)

El switch "Ingresar como Gestión / Admin" de `index.ejs` (antes decorativo,
ver "Bugs encontrados" mas abajo) ahora esta conectado:

- `GET /auth/google` guarda `req.session.modoGestionSolicitado =
  req.query.admin === 'true'` **antes** de redirigir a Google.
- En el callback (`/auth/google/callback`), **siempre revalidado contra
  `req.user.rol` ya autenticado por Passport** (nunca contra lo que pidio
  el cliente): `req.session.modoGestion = req.user.rol === 'admin' &&
  req.session.modoGestionSolicitado === true`.
- Si un admin **no** activa el switch, entra con su cargo docente normal
  (si tiene uno) — sus poderes de admin quedan inactivos para esa sesion,
  aunque `Usuario.rol` siga siendo `'admin'` en Mongo.
- Todos los gates de admin ahora exigen ademas `req.session.modoGestion`:
  el `requireAdmin` global de `app.js` (protege todo `/admin/*`), el de
  baja real en `estudiante.router.js`, y por herencia el de plan de
  estudios (que ya cuelga del router de `/admin/anios`, gateado por el
  `requireAdmin` global).
- **Hay codigo muerto e inseguro relacionado, no reactivar tal cual**:
  `src/controllers/auth.controller.js` + `src/services/auth.service.js`
  implementaban una version de esto que confiaba en `?admin=true/false`
  de la URL para decidir el `rol` directamente (`role: isAdmin ? 'admin' :
  'user'`) — una escalada de privilegios si alguna vez se conecta a una
  ruta. Nunca estuvo montado en ningun router activo.

### Institucion activa (sesion, solo para modo gestion)

Mismo patron que "Selector de cargo" (ver abajo) pero para institucion,
usado unicamente por admins en modo gestion:

- `req.session.institucionActivaId` + `institucionActivaNombre` (el nombre
  se guarda junto con el id al elegir — asi el nav puede mostrarlo sin un
  query a Mongo en cada request, ver `res.locals.institucionActiva` en
  `app.js`).
- En el callback de login, si `modoGestion` es `true`, se **saltea por
  completo** la rama de designaciones/cargo (son caminos alternativos — un
  admin gestionando no necesita su cargo docente activo) y en cambio
  resuelve instituciones disponibles segun `Usuario.alcance` (que ahora
  **si se usa**, primera vez en el proyecto): `alcance.tipo === 'institucion'`
  → solo `alcance.instituciones` (`institucionRepo.obtenerPorIds`);
  cualquier otro caso (incluido `alcance` sin configurar, que es el estado
  de todo admin real hoy) → todas las instituciones (fail-open, para no
  dejar bloqueado a nadie que nunca configuro ese campo a mano).
  - 0 instituciones disponibles → flash de aviso, redirect a `/`.
  - 1 → se fija sola en sesion, entra directo a `/estudiantes`.
  - 2+ → redirect a `/seleccionar-institucion`
    ([src/controllers/seleccionarInstitucion.controller.js](../../../src/controllers/seleccionarInstitucion.controller.js),
    calco de `/seleccionar-cargo`).
- **Filtra de verdad** (confirmado: filtro real, obligatorio, no opcional)
  los listados Y los forms de alta de `/admin/cursos`, `/admin/cargos`,
  `/admin/turnos` — `getCursos`/`getCargos`/`getTurnos` usan
  `...Repo.obtenerPorInstitucion(req.session.institucionActivaId)` en vez
  de `obtenerTodos()`, y los `postCurso`/`postCargo`/`postTurno` toman el
  `institucionId` de la sesion, no del body (cierra un vector menor donde
  antes se confiaba en el `<select>` del form). **No se filtra**
  `/admin/instituciones` (administra el catalogo de instituciones en si,
  no tiene sentido "enfocarla") ni `/admin/roles`/`/admin/anios`/
  `/admin/orientaciones` (catalogos globales del distrito, ninguno tiene
  `institucionId`).
- Nav (`src/views/partials/nav.ejs`): badge "Modo gestión — <institucion>"
  + link "Cambiar institución" (`/seleccionar-institucion`), visibles solo
  si `usuario.rol === 'admin' && modoGestion`. Todos los links de
  `/admin/*` en el nav tambien quedaron gateados por `modoGestion` ademas
  de `rol === 'admin'` (antes solo miraban el rol, lo que era confuso: se
  veian aunque las rutas ya estuvieran bloqueadas).

### Selector de cargo al iniciar sesion (docente, sin modo gestion)

Sin cambios en la logica de siempre (ver mas abajo, seccion propia), pero
con un agregado: ahora hay un link "Cambiar de cargo" en el nav
(`/seleccionar-cargo`, visible si `usuario.tipo === 'personal' &&
!modoGestion`) — antes la ruta ya funcionaba pero no habia forma de
volver a ella sin desloguearse. Util para el caso real que motivo esto:
una misma persona con mas de un cargo (ej. EMATP a la mañana, Profesor a
la tarde) puede cambiar de cual esta usando dentro de la misma sesion. El
"con cual cargo se elige entrar" (una sola designacion, `/seleccionar-cargo`,
o este link) siempre pasa por `utils/cargoActivo.js::fijarCargoActivo` — ver
"Landing segun nivelAcceso" mas abajo para a donde redirige cada caso.

## Auditoria — quien hizo una accion sensible

`src/models/Auditoria.js` + `src/repos/auditoria.repo.js`: registro minimo
de "quien hizo que" **solo** para las acciones sensibles/irreversibles del
sistema — el resto del CRUD (editar la clave de un `Turno`, crear una
`Orientacion`, etc.) explicitamente **no** se audita, no aporta mucho y
ensuciaria cada modelo con un campo que casi nunca importa. Decision
tomada tras una consulta directa del usuario ("¿queda guardado quién hace
el CRUD?") — la respuesta fue que no, y se pidio agregarlo puntualmente.

- Campos: `accion` (`enum`: `eliminar_estudiante` | `eliminar_curso` |
  `alta_designacion` | `baja_designacion`), `descripcion` (texto libre,
  human-readable — nombre de la persona/entidad afectada), `hechoPor`.
  `createdAt` (via `timestamps: true`) hace de "cuando".
- **`hechoPor` es el nombre de usuario del mail, no un `_id` de `Usuario`**
  (`utils/hechoPor.js::hechoPor(req)` → `req.user.email.split('@')[0]`,
  mismo dato que ya se muestra en `nav.ejs`) — pedido explicito del
  usuario, mas legible que un ObjectId al leer el registro a mano.
- Puntos donde se llama a `auditoriaRepo.registrar(...)`:
  `estudiante.controller.js::postEliminarEstudiante`,
  `admin/curso.controller.js::postEliminarCurso`,
  `admin/cargo.controller.js::postDesignacionBase`/`postSuplente`
  (`alta_designacion`) y `postBaja` (`baja_designacion` — el `Persona.findById`
  para el nombre en `postBaja` se resuelve **antes** de `darDeBaja`, via
  `designacionRepo.obtenerPorId` que ya viene con `personaId` poblado).
- **No hay pantalla para verlo todavia** — se consulta directo en Mongo. Si
  hace falta una vista, es un listado simple (`Auditoria.find().sort({
  createdAt: -1 })`), sin filtros ni paginacion pedidos todavia.

## Landing segun nivelAcceso — `/inicio`, `/mis-cursos`, `/mis-cargos`

Primer recorte real de la Fase 3 pendiente (ver "Estado actual" arriba): a
donde aterriza un docente despues de elegir cargo (login directo,
`/seleccionar-cargo`, o "Cambiar de cargo") ahora depende del
`Rol.nivelAcceso` de ese cargo, en vez de ir siempre a `/estudiantes`. Nace
del pedido original de un dashboard especifico para EMATP (3 bloques:
Estudiantes/Curso/Docentes) que habia quedado bloqueado esperando la
`clave` exacta del Rol "EMATP" — la resolucion fue **no** hardcodear ningun
Rol puntual y en cambio ramificar por `nivelAcceso` (que ya existia,
cargado a mano por Rol desde `/admin/roles`), asi "jerarquicos" (Director,
Vicedirector, Secretario) y EMATP comparten pantalla sin que el codigo
necesite saber cual Rol es cual — alcanza con que el admin les haya puesto
`nivelAcceso: 'total'` a todos.

- **`utils/cargoActivo.js::fijarCargoActivo(req, cargoId)`**: unico punto
  que fija `cargoActivoId` en sesion (llamado desde el callback de login
  con una sola designacion, y desde `postSeleccionarCargo`). Ademas
  cachea `req.session.nivelAccesoActivo` (el `nivelAcceso` del `Rol` de
  ese cargo, resuelto una sola vez aca) y devuelve a donde redirigir:
  - `'total'` → `/inicio` (dashboard de 3 bloques).
  - `'preceptor'` → `/mis-cursos` (directo a la lista de cursos designados,
    sin pasar por `/inicio` — un preceptor no tiene bloque "Docentes").
  - Cualquier otro caso (`'profesor'`/`'ninguno'`) → `/estudiantes`, sin
    cambios (todavia no hay pantalla especial para esos niveles).
  - `nivelAccesoActivo` se expone en `res.locals` (`app.js`, sin query a
    Mongo por request, mismo criterio que `institucionActiva`) para que
    `nav.ejs` decida que links de docente mostrar. Al entrar en **modo
    gestion**, el callback de login borra `cargoActivoId`/
    `nivelAccesoActivo` de la sesion explicitamente — sin esto, un admin
    que en un login anterior (misma cookie) hubiera entrado con un cargo
    de nivelAcceso `'total'` seguiria viendo esos links de docente
    mezclados con los de admin (`keepSessionInfo` en el login permite que
    sobreviva sesion vieja entre logins, ver el bug de Passport mas abajo).
- **`GET /inicio`** (`inicio.controller.js`, guard propio ademas de
  `requireAuth`: sin `cargoActivoId`, o con un Rol que no sea `nivelAcceso:
  'total'`, redirige a `/estudiantes`): 3 tarjetas-link — Estudiantes
  (`/estudiantes`, sin cambios), Curso (`/mis-cursos`), Docentes
  (`/mis-cargos`).
- **`GET /mis-cursos`** + **`GET /mis-cursos/:cursoClave`** + los dos POST
  de matriculacion (`misCursos.controller.js`, mismo guard: `nivelAcceso`
  tiene que ser `'total'` o `'preceptor'`, sino redirige a `/estudiantes`):
  - `'total'`: ve **todos** los cursos de su institucion
    (`cursoRepo.obtenerPorInstitucion`, misma institucion que
    `cargo.institucionId`, no hay concepto de "institucion activa" para
    docentes — a diferencia de un admin en modo gestion, un docente tiene
    una sola institucion, la de su cargo).
  - `'preceptor'`: solo los que tiene designados **este año lectivo** via
    `CargoCurso` (`cargoCursoRepo.obtenerPorCargo` + filtro
    `anioLectivo === añoActual`) — re-resueltos con
    `cursoRepo.obtenerPorId` en vez de usar el populate "plano" que ya
    trae `cargoCursoRepo` (ese le alcanza a `admin/cargoDetalle.ejs`, que
    solo pide `curso.clave`, pero esta pantalla tambien necesita
    `anioId`/`turnoId`/`orientacionId` poblados).
  - **`resolverCursoPermitido`**: revalida en cada request que el
    `cursoClave` de la URL este dentro de lo que ese cargo puede ver (todos
    los de la institucion para `'total'`, solo los designados-este-año
    para `'preceptor'`) — nunca confia en que la clave alcance sola, sino
    un preceptor podria escribir a mano la clave de un curso ajeno.
  - La planilla del curso (`pages/misCursoDetalle.ejs`) es una copia
    adaptada de `admin/cursoDetalle.ejs` (mismas acciones: matricular
    nuevo, inscribir existente, ver inscriptos — confirmado explicitamente
    que un docente con `nivelAcceso: 'total'`/`'preceptor'` puede hacer
    todo eso, no es de solo lectura) con las URLs de los forms apuntando a
    `/mis-cursos/...` en vez de `/admin/instituciones/.../cursos/...`.
  - **`crearEstudianteEnCurso(curso, body)`** e
    **`inscribirExistenteEnCurso(curso, body)`** (extraidas a
    `estudiante.controller.js`, exportadas): la logica de matricular que
    antes estaba duplicada en `admin/curso.controller.js` ahora es
    compartida entre ese controller y `misCursos.controller.js` (mismo
    criterio de factorizacion que ya usaba el proyecto para
    `resolverMateriaIds`/`buscarDuplicadoIndocumentado`/
    `construirDatosPersona`) — devuelven `{ error }` o `{ warning }` en vez
    de flashear directo, para que cada controller decida su propio
    mensaje/redirect.
- **`GET /mis-cargos`** (`misCargos.controller.js`, guard: `nivelAcceso`
  tiene que ser `'total'`): directorio de los cargos de la institucion,
  **de solo lectura** (confirmado explicitamente: sin alta, sin designar,
  sin dar de baja, sin editar clave — todo eso sigue siendo exclusivo de
  `/admin/cargos`) — mismo orden (`utils/ordenCargos.js::compararCargos`,
  extraido de `admin/cargo.controller.js` para no duplicarlo) y mismas
  columnas que el listado de admin, menos la columna de acciones.
- Routers nuevos montados en `app.js`: `/inicio`, `/mis-cursos`,
  `/mis-cargos` (los tres con `requireAuth` solamente — el guard real de
  "tenes el nivelAcceso correcto" vive en cada controller, no en un
  middleware compartido, porque cada uno redirige distinto segun el caso).
- `nav.ejs`: "Inicio"/"Curso"/"Docentes" si `nivelAccesoActivo === 'total'`,
  "Mis cursos" si `=== 'preceptor'` — "Estudiantes" sigue siempre visible
  para cualquier autenticado, sin cambios.

### Bug encontrado en uso real: Passport regenera la sesion al loguearse

`node_modules/passport/lib/sessionmanager.js` (Passport 0.7+) llama a
`req.session.regenerate(...)` en `logIn` — buena practica contra session
fixation, pero **descarta cualquier dato guardado en la sesion antes del
login** (en este caso, `modoGestionSolicitado`, seteado en `GET
/auth/google` un paso antes de que Google redirija de vuelta al callback).
Sintoma real: tildar o no el switch de "Ingresar como Gestión" daba
exactamente el mismo resultado, siempre `modoGestion: false`. La solucion
es la opcion que Passport ya provee para este caso exacto: pasar
`{ keepSessionInfo: true }` a `passport.authenticate('google', {...})` en
el callback (`src/routes/auth.router.js`) — hace que, al regenerar, se
mergee la sesion vieja de vuelta en vez de descartarla. **Importante para
el futuro**: cualquier otro dato que se necesite guardar en sesion *antes*
del login real (entre `GET /auth/google` y el callback) tiene el mismo
riesgo si se toca ese archivo de nuevo.

## SolicitudCargo — pedir y aprobar un cargo vacante

([src/models/SolicitudCargo.js](../../../src/models/SolicitudCargo.js) +
[src/repos/solicitudCargo.repo.js](../../../src/repos/solicitudCargo.repo.js)):
un docente/agente pide ocupar un `Cargo` **vacante puntual** (no "quiero un
Rol en tal institucion" en general — elige de una lista de cargos ya
creados y sin designacion activa), y un admin lo aprueba (crea la
`Designacion` en el mismo paso) o lo rechaza.

- Campos: `cargoId`, `personaId` (sale de `req.user.entidadId`, nunca se
  elige a mano), `estado` (`pendiente`|`aprobada`|`rechazada`, default
  `pendiente`), `mensaje` opcional, `fechaResolucion`, `resueltoPor` (ref
  `Usuario`, para auditoria — a diferencia de `Designacion`/`Licencia`,
  aca si importa quien tomo la decision porque es discrecional),
  `motivoRechazo`, `designacionId` (se completa solo al aprobar). Indice
  unico **parcial** `{ personaId, cargoId }` solo si `estado: 'pendiente'`
  — primer indice parcial del proyecto, extension natural del mismo
  patron de duplicados ya usado en otros lados (`EstudianteResponsable`,
  `CargoCurso`), la duplicacion solo importa mientras esta pendiente.
- Docente: `GET`/`POST /solicitudes-cargo`
  ([src/controllers/solicitudCargo.controller.js](../../../src/controllers/solicitudCargo.controller.js)),
  fuera de `/admin`, solo `requireAuth` + guard local `tipo === 'personal'`
  (mismo patron de guard puntual ya usado en otros routers). Muestra
  cargos vacantes (mismo calculo que `admin/cargo.controller.js::getCargos`:
  `cargoRepo.obtenerTodos()` + resolver `activa` con
  `designacionRepo.obtenerActivaPorCargo` por cada uno, filtrando los
  `null`) y "Mis solicitudes" con su estado.
- Admin: **dos puntos de entrada al mismo par de rutas** (sin logica
  duplicada) — vista global `/admin/solicitudes-cargo` (todas las
  pendientes de cualquier institucion, para *descubrir* que hay algo
  pendiente) y una card embebida en `cargoDetalle.ejs` ("Solicitudes
  pendientes de este cargo", visible junto al card "Designar" cuando el
  cargo esta vacante). `POST /admin/solicitudes-cargo/:id/aprobar` y
  `.../rechazar`
  ([src/controllers/admin/solicitudCargo.controller.js](../../../src/controllers/admin/solicitudCargo.controller.js)).
  - **Aprobar**: intenta `designacionRepo.altaBase(...)` **primero** (con
    su chequeo de "¿sigue vacante?" ya incluido); solo si eso resuelve
    bien se marca la solicitud como `aprobada` y se auto-rechazan las
    demas solicitudes pendientes del mismo cargo (`motivo`: "El cargo fue
    cubierto por otra persona.") — sino quedarian huerfanas para siempre.
    Si `altaBase` tira (alguien se adelanto), la solicitud **sigue
    pendiente**, no queda en un estado inconsistente.
  - `postDesignacionBase` (el alta manual de siempre, sin pasar por
    ninguna solicitud) tambien llama al mismo auto-rechazo tras un alta
    exitosa — mismo problema, otro origen.
- **No confundir con `usuario.service.js::getSolicitudesPorTipo`**: es
  codigo **muerto y roto** (llama a metodos de `usuario.repo.js` que no
  existen, tiraria `TypeError`; el archivo esta ademas `untracked` en git),
  pensado para aprobar la **cuenta** de `Usuario` al darse de alta
  (`Usuario.estado`), no para pedir un `Cargo` puntual. Sin relacion con
  `SolicitudCargo`, no reactivar ni calcar.

## Nacimiento y domicilio — selects encadenados contra Georef

Dos partials reusables, mismo patron los dos: cascada Provincia → Distrito
→ Localidad contra la API de Georef (`https://apis.datos.gob.ar/georef`,
sin API key), con un JS vanilla que resuelve cada nivel por `fetch` cuando
cambia el anterior.

- **`partials/nacimientoFields.ejs`** + **`/js/nacimiento.js`**
  (`initNacimiento(...)`): si "Lugar de nacimiento" es Argentina, provincia/
  distrito/localidad se cargan encadenados; si no, el campo
  `nacimiento.localidad` pasa a ser un input de texto libre (mismo campo
  del modelo, dos usos distintos segun `lugar`). "Nacionalidad" es un
  `<select>` separado (ver "Catalogo de paises" abajo), no parte de la
  cascada geografica.
- **`partials/domicilioFields.ejs`** + **`/js/domicilio.js`**
  (`initDomicilio(...)`): mismo patron, con **Buenos Aires**/**La Matanza**
  como default de Provincia/Distrito (la mayoria de los estudiantes son
  del distrito, pero se puede cambiar). "Calle" es un input de texto con
  autocompletado via `<datalist>` (tambien contra Georef, `/calles`,
  filtrado por el distrito elegido) que **no restringe** — deja escribir
  una calle que no este en la lista.
- Los dos partials aceptan dos locals opcionales, para poder reusarse en
  modo **edicion** (ver "Edicion de estudiante" abajo):
  - `persona`: si se pasa, precarga los campos "planos" (nacionalidad,
    calle, numero, etc.) con los valores actuales en vez de arrancar
    vacio. Los selects encadenados (que dependen de un `fetch`, no se
    pueden precargar server-side) se resuelven pasandole a
    `initNacimiento`/`initDomicilio` un `provinciaInicial`/`distritoInicial`/
    `localidadInicial` (calculados en el `<script>` de la pagina que los
    llama, a partir de ese mismo `persona`).
  - `idSufijo`: para cuando una misma pagina incluye el partial **mas de
    una vez** (ej. `estudianteDetalle.ejs`, que tiene el form de "Agregar
    responsable" Y el de "Editar estudiante") — sufija todos los `id` del
    partial (nunca los `name`, esos se mandan igual en cada `<form>` por
    separado) para que no choquen los `document.querySelector(...)` de
    cada `init*(...)`. Default `''` (sin sufijo, retrocompatible con el
    uso de una sola instancia por pagina).
- **Catalogo de paises** ([src/data/paisesNacionalidad.js](../../../src/data/paisesNacionalidad.js)):
  197 paises vendorizados **a mano** (no se descarga en vivo, y
  deliberadamente no se conecto el `<script>` de un gist de GitHub que el
  usuario habia encontrado — riesgo de confianza en contenido de terceros
  sin control de version). Cada entrada: `nombre` (pais), `nacionalidad`
  (gentilicio en español, sacado de los anexos de gentilicios de
  Wikipedia), `clave` (codigo de 3 letras, ISO 3166-1 alfa-3 en casi todos
  los casos). El `<select>` de Nacionalidad (`partials/nacionalidadSelect.ejs`)
  se muestra y ordena por el **gentilicio**, no por el nombre del pais —
  es lo que efectivamente se guarda. Excepcion a proposito: Argentina usa
  `nacionalidad: 'Argentina'` (no "Argentino"), para coincidir con el
  auto-completado de `nacimiento.js` cuando el lugar elegido es Argentina.
  `paises` esta disponible como global en `res.locals` (seteado una vez en
  `app.js`, es un catalogo estatico que no cambia por request).

## Duplicados de Persona/Estudiante

Tres mecanismos independientes, en capas:

1. **Bloqueo duro** por `numeroDocumento`/`cuil` (`Persona.findOne`) en
   `postEstudiante`/`postEstudianteNuevo` — si ya existe, flash de error,
   no se crea nada. En `postEditarEstudiante` el mismo chequeo excluye a
   la propia persona (`_id: { $ne: ... }`), sino editar sin cambiar el
   documento se auto-marcaria como duplicado.
2. **Aviso suave** (`buscarDuplicadoIndocumentado`, en
   `estudiante.controller.js`) solo para estudiantes **sin** documento:
   compara apellido+nombre+fecha_nacimiento contra `Persona` existentes.
   **No bloquea** — el estudiante se crea igual, solo se agrega un flash
   `warning` aparte del de éxito, para que quien carga revise si es un
   duplicado real.
3. **Chequeo en vivo mientras se tipea** el numero de documento
   (`GET /estudiantes/verificar-documento`,
   [src/controllers/estudiante.controller.js](../../../src/controllers/estudiante.controller.js)
   + `/js/verificarDocumento.js`, debounce 400ms, minimo 6 caracteres).
   Distingue "ya existe un **estudiante**" (con boton a su ficha,
   `/estudiantes/<clave>`) de "ya existe una **persona no-estudiante**"
   (ej. un agente, sin boton — no hay ficha de estudiante a la que ir).
   Solo en el alta de **estudiante** — explicitamente **no** en el alta de
   responsable (ahi reusar un `AdultoResponsable` con el mismo documento
   es el comportamiento esperado, no un error) ni en la **edicion** (evita
   el falso positivo de compararse contra uno mismo).

Para `AdultoResponsable`, el "duplicado" por documento es al reves: si ya
existe uno con ese `numeroDocumento`, se **reusa** en vez de crear otro
(dos hermanos comparten el mismo adulto responsable) — ver `postResponsable`.
No hay ningun aviso de duplicado por nombre para responsables sin
documento (a diferencia de estudiantes) — quedo fuera de alcance a
proposito cuando se pregunto.

## Edicion y baja real de estudiante

- **Edicion** (`postEditarEstudiante`): un form colapsable en
  `estudianteDetalle.ejs` (boton "Editar" junto a "Volver a estudiantes"),
  que reusa los mismos partials del alta (`documentoFields`,
  `nacimientoFields`, `domicilioFields`) precargados con `persona` +
  `idSufijo: 'Editar'` (ver arriba). Solo toca `Persona` — no
  `Inscripcion`/`CursadaAsignatura`/`Estudiante`.
- **Baja real** (`postEliminarEstudiante`): la **unica** baja fisica de
  todo el sistema — todo lo demas (`Designacion`, `Inscripcion` al cambiar
  de curso, `Licencia`) sigue usando baja logica con fecha. Gateada por
  `rol === 'admin' && nivelPoder === 'total' && modoGestion` (guard local
  en `estudiante.router.js`, no en todo el router). Requiere escribir la
  **clave exacta** del estudiante en un modal de confirmacion (JS
  deshabilita el boton hasta que coincide; el servidor **revalida** la
  misma condicion, nunca confia solo en el JS). Borra en cascada
  `Inscripcion`, `CursadaAsignatura`, `EstudianteResponsable` (los
  vinculos) y la `Persona`/`Estudiante` — **nunca** el otro lado de una
  relacion (`Curso`, `Asignatura`, `AdultoResponsable` siguen existiendo,
  un `AdultoResponsable` puede tener otros hijos vinculados).
- El form de alta en `/estudiantes` esta **colapsado por defecto** detras
  de un boton "+" (Bootstrap `collapse` nativo, sin JS propio) — se
  auto-expande solo si hay un flash de error (`mensajes.error`, para
  reintentar sin perder contexto). **Mismo patron en
  `cursoDetalle.ejs`/`misCursoDetalle.ejs`**, con una diferencia: el boton
  toggle ("+ Agregar") vive en el header de arriba de la pagina (linea del
  titulo del curso + "Volver"), no en el header de la propia card "Agregar
  estudiante nuevo" — pedido explicito del usuario, para tenerlo a mano
  junto con las demas acciones del curso.

## Materias por defecto al matricular

Antes, si no se abria el checklist de materias (modal "Elegir/Editar
materias"), no se anotaba en ninguna. Ahora, `resolverMateriaIds`
(`estudiante.controller.js`, reusado por `postEstudiante`/
`postEstudianteNuevo`/`postInscribirExistente`): si no se tildo nada en el
form, se anota **por defecto en todas las materias** del plan de estudio
del año/orientacion (menos las ya aprobadas, si es un estudiante
existente — mismo calculo que ya usaba el checklist para "precargadas",
factorizado en `materiasPrecargadas`). El checklist (renombrado "Editar
materias") pasa a ser para el caso de **excepcion**: sacar materias que no
cursa, o sumar atrasadas.

## Inscribir estudiante existente — anotar directo vs. transferir con aviso

Pedido explicito del usuario: al inscribir un estudiante que ya existe en
un curso (`cursoDetalle.ejs`/`misCursoDetalle.ejs`), separar dos casos que
antes se mezclaban en un solo dropdown+form con los mismos campos para
todos.

- **`estudiante.controller.js::calcularEstudiantesDisponibles(inscripcionesVigentesDelCurso, todosLosEstudiantes)`**:
  de los estudiantes que no estan vigentes **en este curso**, separa segun
  tengan o no una inscripcion vigente (`fechaBaja: null`) en **este mismo
  `cicloLectivo`** (`new Date().getFullYear()`) en **otro** curso:
  - `estudiantesLibres`: sin vigente este año en ningun lado (nunca se
    inscribio, o su vigente es de un año **anterior** y todavia no se
    cerro — el caso normal de "arranca el año, hay que re-anotar a los
    que promocionaron", que no es un cambio de nada real).
  - `estudiantesEnOtroCurso`: `{ estudiante, vigente }` — tienen una
    vigente de **este mismo año** en otro curso/institucion, un cambio
    real a mitad de año.
  - Se llama desde `admin/curso.controller.js::getCursoDetalle` y
    `misCursos.controller.js::getMisCursoDetalle` (mismo criterio de
    reuso que `crearEstudianteEnCurso`/`inscribirExistenteEnCurso`) —
    reemplaza el viejo `estudiantesDisponibles` (que solo excluia a los
    vigentes en el curso actual, sin distinguir estos dos casos).
- **UI resultante en la card "Inscribir estudiante existente"**:
  - `estudiantesLibres` → un `<select>` + input de **N° de registro**
    (precargado con `siguienteNumeroRegistro`, ver "Inscripcion" mas abajo
    — este si queda visible/editable, a diferencia del resto: no tiene un
    default razonable posible, es un dato que hay que transcribir del
    libro fisico cada vez) + boton **"Anotar"**.
    `cicloLectivo`/`fechaAlta`/`motivoAlta` van como `<input type="hidden">`
    con los defaults (`anioActual`, `fechaHoy`, `"Inscripción"`) — sin
    campo visible, a diferencia de `numeroRegistro`. Ni `procedencia` ni
    el checklist de materias — quedan con su default automatico
    (`resolverMateriaIds` sin `materiaIds` en el body, ver seccion
    anterior).
  - `estudiantesEnOtroCurso` → tabla con "Actualmente en: `<curso>` —
    `<institucion>`" y un boton **"Transferir"** por fila que abre un
    **modal unico compartido** (`#modalTransferir`) — se completa con los
    `data-estudiante-id`/`data-estudiante-nombre`/`data-curso-actual` del
    boton que lo abrio, via el evento `show.bs.modal` de Bootstrap
    (`evento.relatedTarget.dataset`). Este modal si tiene el form completo
    de siempre (ciclo/fecha/motivo/numeroRegistro/procedencia) porque cierra
    una inscripcion real en otro lado — amerita mas cuidado. **No** tiene
    checklist de materias propio (se saco a proposito, mismo default
    automatico que el resto) — evita anidar el modal de materias dentro de
    este modal (Bootstrap 5 no maneja bien modales anidados/apilados).
  - El backend no cambio nada: las dos rutas (`POST .../estudiantes/existente`)
    siguen siendo la misma, `inscribirExistenteEnCurso` no distingue estos
    casos — la diferencia es puramente que datos manda cada form (visibles
    vs. ocultos-con-default).

## Cargo — clave, edicion, orden de listado

- **`Cargo.clave` para cargos de profesor** (auto-generados al crear un
  `Curso`, ver `cargoRepo.generarParaCurso`): formato **`asignatura.clave-curso.clave`**
  (ej. `mate-4A`). Antes era `rol.clave-curso.clave-asignatura.clave` — se
  saco el prefijo del rol por redundante (un cargo con `cursoId`+
  `asignaturaId` ya es de profesor por definicion) y se acorto. Sigue
  siendo unica dentro de la institucion (misma garantia de antes: cada
  asignatura ya es unica dentro de su curso). `postCurso` envuelve la
  generacion en `try/catch` — si el indice unico `{institucionId, clave}`
  de `Cargo` se violara igual (no deberia, en uso normal), el curso queda
  creado y se avisa con flash en vez de tirar un error sin capturar.
- **`GET`/`POST /admin/cargos/:id/editar`** (nuevo,
  `getEditarCargo`/`postEditarCargo` en
  [src/controllers/admin/cargo.controller.js](../../../src/controllers/admin/cargo.controller.js)):
  para cargos **viejos** que quedaron sin `clave` (mismo problema que ya
  existia con `Institucion.clave` — campo agregado despues del alta
  original de varios documentos). Identificada por el **`_id` de Mongo**,
  no por `clave` (es justo el campo que puede faltar — mismo motivo por
  el que `Institucion` usa `cue` para este mismo caso, ver mas abajo).
  Link "Editar clave" en cada fila de `/admin/cargos`, ademas del
  "Gestionar" que ya existia (que solo aparece si institucion+cargo ya
  tienen clave).
- **`scripts/renombrarClavesProfesor.js`** (nuevo, corrido una vez por el
  usuario): migra los cargos de profesor ya existentes al formato nuevo de
  clave. Primer archivo de una convencion nueva — carpeta `scripts/` en la
  raiz para migraciones puntuales, corridas a mano (`node scripts/x.js`),
  reusando `conectarDB` de `src/config/db.js`. **Gotcha real encontrado**:
  si un script hace `.populate(...)` de un modelo que no importo en
  ningun lado, Mongoose tira `MissingSchemaError` — hay que `require(...)`
  ese modelo igual aunque no se use la variable directamente (registra el
  schema por efecto secundario).
- El listado de `/admin/cargos` ahora se **ordena** por `Rol.jerarquia`
  ascendente (menor = mas alto rango) y, dentro de la misma jerarquia,
  alfabetico por nombre de turno (los cargos sin turno fijo al final de su
  grupo). Se agrego tambien una columna "Curso" (clave del curso, solo
  para cargos de profesor).

## Inscripcion — numero de registro del libro en papel, procedencia, defaults del form

`Inscripcion.numeroRegistro` (`String`, `trim`, opcional, **sin** indice
unico — es una transcripcion a mano del libro de matricula fisico de cada
institucion, que puede tener correcciones/inserciones tipo "45 bis", no
tiene sentido forzar unicidad desde el sistema). Vive en `Inscripcion`, no
en `Estudiante` — el libro es propio de cada institucion, si el estudiante
se transfiere a otra escuela tiene un numero distinto en el libro de la
nueva. Se carga en los 3 puntos de matriculacion (alta nueva x2, inscribir
existente) y se muestra en la tabla de inscriptos de un curso y en la
ficha del estudiante (situacion actual + historial por ciclo lectivo).

En `admin/cursoDetalle.ejs` y `misCursoDetalle.ejs` (donde la institucion
ya esta fija por la URL/el cargo — no en `estudiantes.ejs`, ahi el curso
recien se elige en el form, no hay institucion fija de antemano para
sugerir nada) los 3 inputs de `numeroRegistro` de esa pagina (alta nueva,
"Anotar" directo, modal "Transferir") vienen precargados con
`inscripcionRepo.obtenerSiguienteNumeroRegistro(institucionId)` — el
consecutivo al mas alto numero ya usado en el libro de esa institucion
(toma el numero inicial de cada `numeroRegistro` con una regex, ignora los
que no arrancan con digitos, ej. si hay "45 bis" y "46", sugiere 47). Es
**solo una sugerencia editable**, no una garantia de correlatividad real
(el libro fisico puede tener huecos, saltos o correcciones) — pedido
explicito del usuario para no tener que ir a contar a mano cual es el
siguiente numero cada vez.

`inscripcionRepo.obtenerVigentesPorCurso` **ordena por defecto** por
`numeroRegistro` (numerico, mismo parseo que arriba — los que no tienen
uno cargado quedan al final) y, a igualdad o entre los que no tienen
registro, por apellido y despues nombre — refleja el orden del libro de
matricula en papel, pedido explicito del usuario. Es solo el orden
inicial: la tabla "Estudiantes inscriptos" (`cursoDetalle.ejs`/
`misCursoDetalle.ejs`) tiene ademas buscador + columnas clickeables para
reordenar del lado del cliente, ver `/js/tablaControl.js` mas abajo.

`Inscripcion.procedencia` (mismo criterio: `String`, `trim`, opcional, sin
contraparte del lado de la baja) — "Viene de" en el form, texto libre (ej.
"Escuela N° 15", "Otra provincia") para donde llegaba el estudiante al
matricularse. Mismos 3 puntos de carga que `numeroRegistro`, mismo lugar de
exhibicion en `estudianteDetalle.ejs` (no se agrego a la tabla de
inscriptos de un curso, a diferencia de `numeroRegistro` — es un dato mas
de trayectoria personal que de "quien esta hoy en este curso").

En los 5 forms de matriculacion (`estudiantes.ejs` x1, `admin/cursoDetalle.ejs`
y `misCursoDetalle.ejs` x2 cada uno — alta nueva + inscribir existente), la
**Fecha de alta** viene precargada con la fecha de hoy
(`utils/fechaHoy.js::fechaHoy()` — server-side, en hora local, no
`toISOString()` que corre la fecha si el servidor no esta en UTC) y el
**Motivo de alta** viene precargado como valor editable, no solo
`placeholder`: `"Inscripción inicial"` en los forms de alta nueva,
`"Cambio de curso"` en los de inscribir existente.

## Alta de estudiante — atomica (transaccion Mongo), no parcial

Bug real encontrado en uso (a partir del gotcha de indices viejos, ver
seccion siguiente): `crearEstudianteEnCurso`/`inscribirExistenteEnCurso`
(`estudiante.controller.js`) hacian varios `save()`/`insertMany()`
seguidos (`Persona` → `Estudiante` → `Inscripcion` → `CursadaAsignatura`)
sin ninguna atomicidad — si un paso fallaba a mitad de camino, lo anterior
ya quedaba guardado. Sintoma real: la `Persona` se creaba pero el
`Estudiante` no (el `save()` de `Estudiante` era el que fallaba, por el
indice viejo `dni_1`) — la `Persona` quedaba "huerfana": no se podia
recrear (el chequeo de duplicados por documento la encontraba) ni
aparecia en "Inscribir estudiante existente" (esa lista sale de
`Estudiante`, no de `Persona`). El preceptor quedaba completamente
trabado con ese estudiante puntual.

Arreglado envolviendo toda la secuencia de escritura en una transaccion
Mongo real (`session.withTransaction(async () => {...})`, via
`mongoose.startSession()` — MongoDB Atlas, incluso en el tier gratuito,
corre como replica set y soporta transacciones multi-documento): si
**cualquier** paso falla, no queda nada guardado. Patron:

- `crearEstudianteEnCurso`/`inscribirExistenteEnCurso` ya **no lanzan** si
  la transaccion falla — capturan el error y devuelven
  `{ error: '...' }` (mismo contrato que ya tenian para el chequeo de
  duplicados), para que el llamador lo flashee igual que cualquier otro
  error de validacion. `postInscribirExistente` (en `admin/curso.controller.js`
  y `misCursos.controller.js`) ahora **si** revisa ese `resultado.error`
  (antes ignoraba el valor de retorno, no habia nada que revisar).
- Todos los repos que participan de esta secuencia aceptan un `session`
  opcional como ultimo parametro (`estudianteRepo.crear`/`generarLegajo`,
  `inscripcionRepo.crear`/`matricular`, `cursadaAsignaturaRepo.crearVarias`)
  — pasar `undefined` (no pasar nada) se comporta exactamente igual que
  antes, asi que ningun otro llamador existente se rompe.
- **`postEstudiante`** (alta desde `/estudiantes`, la landing generica) ya
  no duplica esta logica — ahora resuelve el `curso` desde `cursoId` y
  delega en `crearEstudianteEnCurso`, mismo criterio de factorizacion que
  ya se uso para no mantener la misma logica critica en dos lugares (y
  ahora la transaccion vive en un solo sitio).
- **`resolverMateriaIds`** (el calculo de que materias precargar) se sigue
  llamando **antes** de abrir la transaccion — es una lectura de estado
  que ya existe (aprobadas previas), no necesita atomicidad con la
  escritura.
- **`scripts/completarEstudianteHuerfano.js`**: repara a mano el caso
  puntual que ya haya quedado "huerfano" de una corrida anterior (antes de
  este fix) — busca la `Persona` por `numeroDocumento`, y si no tiene
  `Estudiante`, se lo crea con un legajo generado igual que en el alta
  normal (pide la clave de la institucion por parametro, ya que no quedo
  guardada en ningun lado del intento fallido). Uso:
  `node scripts/completarEstudianteHuerfano.js <numeroDocumento> <institucionClave>`.

## Indices viejos en Mongo — gotcha real, puede repetirse en otras colecciones

Bug real encontrado en uso: al dar de alta un segundo estudiante,
`MongoServerError: E11000 duplicate key ... index: dni_1 dup key: { dni: null }`.
Causa: `Estudiante` tenia un campo `dni` propio en una version vieja del
modelo (antes de separarse en `Persona`+`Estudiante`, ver el comentario en
`Estudiante.js`), con un indice **unico y no sparse**. Mongoose **nunca
borra indices que ya no estan en el schema actual** — solo crea los que
faltan — asi que el indice viejo se queda pegado en Mongo para siempre. Sin
el campo `dni` en ningun documento nuevo, Mongo trata a todos como
`dni: null`, y el indice unico solo deja que **uno** tenga ese valor — el
segundo alta rompe.

Solucion: `scripts/eliminarIndicesViejosEstudiante.js` (correr una vez,
`node scripts/eliminarIndicesViejosEstudiante.js`) — lista los indices
reales de la coleccion `estudiantes` en Mongo y borra cualquiera que no
sea `_id_`, `personaId_1` o `legajo_1` (los unicos que el schema actual
necesita). Idempotente.

**Esto puede repetirse en cualquier otra coleccion que haya cambiado de
schema** (varios modelos de este proyecto fueron reescritos a fondo en
algun momento — `Persona` renombro `dni` a `numeroDocumento`, por ejemplo).
Si aparece el mismo tipo de error (`E11000 ... dup key: { <campo> : null }`
sobre un campo que ya no existe en el schema actual), el patron de
diagnostico y arreglo es el mismo: listar los indices reales de esa
coleccion (`db.<coleccion>.getIndexes()` en Mongo, o
`coleccion.indexes()` via el driver, como hace este script) y borrar los
que no correspondan al schema vigente.

## `trim: true` en todos los modelos

Todos los campos `String` de texto libre (no `enum`, esos vienen de un
`<select>` y no lo necesitan) en **todos** los modelos del proyecto tienen
`trim: true` — se agrego de punta a punta en una sola pasada (`Persona`,
`AdultoResponsable`, `Usuario`, `Designacion`, `Curso`, `Estudiante`,
`Turno`, `Institucion`, `Anio`, `Asignatura`, `Orientacion`, `Rol`,
`Inscripcion`, `Licencia`, `Cargo`, `SolicitudCargo`). Es un setter de
Mongoose (se aplica al guardar, sin tocar controllers/forms) — convive sin
problema con el `set: aMayusculas` que ya tenian varios campos de texto
(el orden entre ambos no importa, ninguno de los dos afecta al otro). El
unico `.trim()` manual que existia antes (`construirTelefonos`, en
`estudiante.controller.js`) quedo como esta — es redundante ahora pero
inofensivo.

## El esquema de claves en las URLs (no ObjectIds de Mongo)

Pedido explicito del usuario, aplicado a **todo** el panel de admin y a
`/estudiantes`: ninguna URL debe mostrar un `_id` de Mongo. La regla, por
tipo de entidad:

- **Catalogos globales con clave propia unica** (`Rol`, `Orientacion`,
  `Anio`): usan directamente su `clave` (`/admin/orientaciones/:clave`,
  `/admin/anios/:clave`, y anidado `/admin/anios/:clave/orientaciones/:orientacionClave`,
  `.../filas/:filaClave`). `Rol` no tiene rutas `:id` (solo alta+listado),
  no necesito conversion.
- **Entidades cuya clave solo es unica *dentro* de una institucion**
  (`Curso`, `Turno`, `Cargo`): quedan anidadas bajo
  `/admin/instituciones/:institucionClave/{cursos,turnos,cargos}/:clave`
  (routers separados: `institucionCurso.router.js`, `institucionTurno.router.js`,
  `institucionCargo.router.js`, montados en `app.js` con `express.Router({ mergeParams: true })`
  para heredar `:institucionClave`). El **listado y el alta** de cada una
  siguen siendo flat (`/admin/cursos`, `/admin/turnos`, `/admin/cargos`, sin
  institucion en la URL) — solo el *detalle* esta anidado.
  - `Turno.clave` y `Cargo.clave` son campos que se agregaron
    especificamente para esto (antes no existian). `Cargo.clave` se
    sugiere sola: `rol.clave` para cargos comunes (editable a mano si hay
    que desambiguar, ej. dos preceptores), o `asignatura.clave-curso.clave`
    para los cargos de profesor auto-generados — ver "Cargo" arriba para
    el formato exacto y la pantalla de edicion para los que quedaron sin
    clave.
  - **`Institucion` necesita su propia `clave`** para que esto funcione.
    Se gestiona desde `/admin/instituciones` (listado por `cue` + editar
    `clave` en `/admin/instituciones/:cue/editar`). Esa pantalla en si se
    identifica por `cue` (no por `clave` — es justamente el campo que se
    esta por completar, no puede ser su propia clave de bootstrap) —
    **mismo criterio que se repitio despues para `/admin/cargos/:id/editar`**
    (identificado por `_id`, no por `clave`, mismo motivo).
- **`Estudiante`**: usa el `numeroDocumento` de su `Persona` si lo tiene, o
  su propio `legajo` si no (indocumentado) — ver `estudianteRepo.obtenerPorClave`.
  Las rutas son genericas (`/estudiantes/:clave`, nunca `:dni`), asi no
  importa cual de los dos resolvio.
- **Sub-recursos historicos sin identidad natural** (`Designacion`,
  `Licencia`, `Inscripcion`, `CursadaAsignatura`, `CargoCurso`,
  `EstudianteResponsable`, `SolicitudCargo`): siguen usando su `_id` de
  Mongo en la URL a proposito — son registros de una relacion/evento, no
  catalogos, no tiene sentido inventarles una clave humana.
- **Valores de `<select>` dentro del body de un form** (no en la URL, ej.
  `personaId`, `asignaturaId`, `orientacionId` al agregar una orientacion a
  un año): se dejaron como ObjectId sin tocar — el pedido del usuario era
  especificamente sobre URLs, no sobre todo el sistema.

`Anio.grado` (`Number`, `unique`, `sparse`) se agrego para esto mismo: para
saber si un año es anterior/posterior a otro (necesario para el checklist
de materias atrasadas de un estudiante) hacia falta un orden numerico
explicito, `clave` (string tipo "4°") no alcanza. **Los 6 `Anio`
existentes no tienen `grado` cargado** — sigue pendiente de completar a
mano (`/admin/anios` ya tiene el campo en el form de alta, pero editar uno
existente no tiene pantalla todavia).

## AJAX — las excepciones conscientes, no el patron general

El proyecto es casi 100% forms tradicionales (POST + redirect + flash).
Los usos de `fetch()`, todos de **lectura** salvo el ultimo:

- Checklist de materias al matricular un estudiante:
  `GET /estudiantes/materias-sugeridas/:institucionClave/:cursoClave?estudianteId=...`
  (en `estudiante.controller.js`, `getMateriasSugeridas`) devuelve JSON con
  `precargadas` (plan de estudio del año, menos las ya `aprobada` en
  `CursadaAsignatura`) y `atrasadas` (mismo criterio, años con `grado`
  menor — nunca posterior). Se usa desde `/js/materiasSugeridas.js`
  (`initMateriasSugeridas(...)`), el **guardado** sigue siendo el POST
  tradicional del form que contiene el modal, no un segundo `fetch`. Ver
  "Materias por defecto al matricular" arriba para el default nuevo
  cuando no se abre el modal.
- Nacimiento y domicilio contra la API de Georef (ver seccion propia
  arriba) — `/js/nacimiento.js`, `/js/domicilio.js`.
- `GET /estudiantes/verificar-documento` — chequeo en vivo de duplicados
  (ver "Duplicados" arriba) — `/js/verificarDocumento.js`.
- **`POST /valoraciones/asignatura/fila`** (`/js/valoracionesAutosave.js`)
  — la **unica excepcion de escritura** por AJAX de todo el proyecto,
  pedido explicito del usuario (autoguardado por fila al cargar
  valoraciones, con indicador de guardado/error — ver "Regimen academico y
  `Valoracion`" mas abajo para el detalle completo). Devuelve JSON, nunca
  redirige ni flashea.

Decision explicita, repetida cada vez que se agrego una de estas: usar
AJAX solo donde de verdad hace falta reactividad (lectura reactiva, o —
la unica vez, con pedido explicito — guardado inmediato sin perder el
patron de validacion server-side), nunca como reemplazo generalizado del
patron POST+redirect+flash del resto del proyecto.

Otro JS reusable, mismo criterio (vanilla, sin libreria):
- `/js/telefonos.js` (`initTelefonos(...)`): filas repetibles de telefono
  (descripcion + numero) en los forms de `Persona`/`AdultoResponsable`,
  incluido el form de edicion de estudiante (pre-renderiza las filas
  existentes server-side, la funcion solo maneja agregar/quitar mas).
- `/js/tipoDocumento.js` (`initTipoDocumento(...)`): muestra/oculta los
  subcampos de documento segun el `<select>` de tipo. Usa el partial
  `partials/documentoFields.ejs` (acepta `persona` + `idSufijo`, mismo
  criterio que `nacimientoFields`/`domicilioFields` — ver arriba).
- `/js/tablaControl.js` (`initTablaControl({ tabla, buscador })`): buscador
  (filtra filas por texto, sin distinguir mayus/minus) + orden por columna
  (clickeando un `<th data-orden="texto"|"numero">` reordena las `<tr>` del
  `<tbody>` en el DOM, alternando ascendente/descendente, con un icono de
  caret). Sin AJAX — opera sobre filas que el servidor ya renderizo, no
  hace falta pedir nada de nuevo. Si una celda necesita un valor de orden
  distinto al texto visible, se le pone `data-valor="..."` a la `<td>` (ej.
  la columna de N° de registro usa esto para ordenar numericamente aunque
  el texto visible sea `"45 bis"` o `"—"`). Usado en la tabla "Estudiantes
  inscriptos" de `cursoDetalle.ejs`/`misCursoDetalle.ejs` — generico,
  pensado para reusarse en cualquier otra tabla que lo necesite.

## Entidades principales

- **Usuario** ([src/models/Usuario.js](../../../src/models/Usuario.js)): la
  cuenta de login. No tiene nombre propio: apunta a una `Persona` o a una
  `Institucion` via `entidadId` (ref dinamica segun `tipoModel`). Campos
  clave: `tipo` (`institucion` | `personal`), `rol` (`usuario` |
  `observador` | `admin`), `estado` (`pendiente` | `aprobado` |
  `rechazado`), `alcance` (solo relevante si `rol === 'admin'` — que
  instituciones puede administrar, `tipo: 'distrito'|'institucion'` +
  `instituciones[]`, **ahora si se usa**, ver "Sistema de permisos"),
  `nivelPoder` (idem, ver permisos). `tipo` y `rol` son conceptos
  separados a proposito, no mezclarlos.
- **Institucion** ([src/models/Institucion.js](../../../src/models/Institucion.js)):
  identificada por `cue` (unico, 9 digitos) y tambien por `clave` (usada
  en las URLs anidadas y ahora tambien para filtrar por institucion
  activa — gestionable desde `/admin/instituciones`). Coleccion Mongo
  explicita `instituciones`.
- **Persona** ([src/models/Persona.js](../../../src/models/Persona.js)):
  agentes/personal **y** estudiantes comparten este modelo (`Estudiante` la
  referencia via `personaId`, ver mas abajo).
  - `cuil` y `numeroDocumento` son **opcionales** (`unique + sparse`, no
    `required`) — un estudiante puede ser indocumentado. `numeroDocumento`
    **se llamaba `dni`**, se renombro porque ya no siempre es un DNI (puede
    ser numero de documento extranjero). El campo del form de alta de
    **docentes** (`formAgente.ejs`, flujo `/alta`) sigue llamandose `dni`
    a proposito — no se toco esa pantalla — pero `personaService.js` lo
    mapea a `numeroDocumento` al guardar, sino se perdia el dato en
    silencio (Mongoose ignora campos no declarados en el schema).
  - `tipoDocumento` (`enum`: `DNI` | `CPI` | `Documento extranjero` | `Sin documento`,
    default `DNI`) + `estadoDni` (solo tiene sentido si `tipoDocumento === 'DNI'`)
    + `documentoExtranjeroTipo` (texto libre, solo si `tipoDocumento === 'Documento extranjero'`)
    — mapea 1 a 1 la seccion "¿Posee DNI argentino?" de la planilla de
    inscripcion oficial. `AdultoResponsable` tiene el mismo trio de
    campos.
  - `genero`: `enum` con las 7 categorias oficiales de la planilla. Un
    `<select>`, no checkboxes.
  - `nacimiento` (`lugar`, `nacionalidad`, `provincia`, `distrito`,
    `localidad`) y `domicilio` (`calle`, `numero`, `piso`, `depto`,
    `entreCalles`, `localidad`, `partido`) — ver "Nacimiento y domicilio"
    arriba para como se cargan hoy (selects encadenados contra Georef,
    ya no texto libre suelto). `telefonos` (array de
    `{ descripcion, numero }`). Mismas formas se repiten en
    `AdultoResponsable`.
  - **Mayusculas automaticas**: `apellido`, `nombre`, los campos de texto
    de `domicilio`/`nacimiento`, `telefonos.descripcion` y
    `documentoExtranjeroTipo` tienen un `set` de Mongoose
    (`src/utils/mayusculas.js`, funcion generica `aMayusculas`) que
    convierte a mayusculas al guardar. **No** se aplica a
    `numeroDocumento`/`cuil` (codigos, no texto), a `genero`/`nacimiento.lugar`
    (enums de valores exactos) ni a `correoElectronico`.
- **Estudiante** ([src/models/Estudiante.js](../../../src/models/Estudiante.js)):
  Solo dos campos: `personaId` (ref `Persona`, `required + unique`)
  y `legajo` (`String`, `required + unique`, **generado solo, nunca a
  mano**: `{clave de la institucion que lo inscribe}-{numero incremental
  dentro de esa institucion}` — `estudianteRepo.generarLegajo`). Sirve de
  respaldo en la URL cuando la `Persona` no tiene `numeroDocumento`. **No**
  tiene `institucionId` propio: se deriva de su `Inscripcion` vigente.
- **Inscripcion** ([src/models/Inscripcion.js](../../../src/models/Inscripcion.js) +
  [src/repos/inscripcion.repo.js](../../../src/repos/inscripcion.repo.js)):
  la matricula de un `Estudiante` a un `Curso`, por `cicloLectivo`. Mismo
  patron que `Designacion`: `fechaAlta`/`motivoAlta` + `fechaBaja`/
  `motivoBaja` (`null` = vigente), solo una **vigente por estudiante**.
  `numeroRegistro` (ver seccion propia arriba). El metodo clave es
  `inscripcionRepo.matricular({ estudianteId, cursoId, cicloLectivo, fecha, motivo, numeroRegistro })`:
  si ya habia una vigente, la cierra antes de abrir la nueva — cubre alta
  inicial y cambio de curso/escuela con una sola operacion.
- **CursadaAsignatura** ([src/models/CursadaAsignatura.js](../../../src/models/CursadaAsignatura.js) +
  [src/repos/cursadaAsignatura.repo.js](../../../src/repos/cursadaAsignatura.repo.js)):
  relacion estudiante-materia, **unica para siempre** (indice unico
  `estudianteId`+`asignaturaId`, **sin** `cicloLectivo` — cambio de diseño
  explicito del usuario, ver "Regimen academico y Valoracion" mas abajo:
  nunca se duplica, ni siquiera si el estudiante recursa). Campos:
  `estudianteId`, `asignaturaId`, y el resultado durable —
  `aprobada`/`fechaAprobacion`/`notaFinal`, que solo se escribe (a mano por
  ahora) cuando el estudiante **finalmente aprueba**, sin importar en que
  año. **Independiente del regimen de evaluacion vigente** — el detalle
  año a año (informes, notas de cuatrimestre, intensificacion) vive
  aparte, en `Valoracion`, que si tiene su propio `cicloLectivo`.
  `cursadaAsignaturaRepo.crearVarias` (llamado al matricular) hace
  **find-or-create**: si el estudiante ya tiene una fila para esa materia
  (aprobada o no), no crea otra. Ver "Materias por defecto" arriba para
  como se decide que materias ofrecer.
- **AdultoResponsable** + **EstudianteResponsable**
  ([src/models/AdultoResponsable.js](../../../src/models/AdultoResponsable.js) +
  [src/models/EstudianteResponsable.js](../../../src/models/EstudianteResponsable.js)):
  madre/padre/tutor/a de un estudiante. `AdultoResponsable` es una entidad
  **propia** — puede **repetirse entre hermanos** (se reusa por
  `numeroDocumento` en vez de duplicarse, ver `postResponsable`). El
  vinculo puntual (`vinculo`, `convive`) vive en `EstudianteResponsable`.
  El form de alta de responsable en `estudianteDetalle.ejs` tambien usa
  `documentoFields`/`nacionalidadSelect`/`domicilioFields` (sin `idSufijo`,
  es la unica instancia de esos en esa pagina — el sufijo lo usa la OTRA
  instancia, la del form de editar estudiante).
- **Designacion** + **Licencia**
  ([src/models/Designacion.js](../../../src/models/Designacion.js) +
  [src/models/Licencia.js](../../../src/models/Licencia.js) +
  [src/repos/designacion.repo.js](../../../src/repos/designacion.repo.js)):
  **quien ocupa un `Cargo`** — `Cargo` no tiene `personaId`/`estado`
  propios.
  - `situacionRevista`: `titular` | `provisional` | `interino` | `suplente`.
    `fechaAlta`/`fechaBaja`+`motivoBaja` (mismo patron que `Inscripcion`).
  - Solo puede haber **una vigente sin suplente** (la "base") por cargo a
    la vez — para dar de alta un `suplente` tiene que haber una base
    vigente, y requiere una `Licencia` que respalde a quien esta cubriendo.
  - **No se guarda "quien reemplaza a quien" ni "activo/en licencia"** —
    se deduce siempre por consulta (`designacionRepo.obtenerCadenaPorCargo`):
    separa la `base` de los `suplentesVigentes`, y el activo hoy es el
    suplente vigente con `fechaAlta` **mas reciente, comparado solo entre
    suplentes** — nunca contra la fecha de la base (bug real encontrado y
    corregido: comparar contra la base rompia el orden cuando un suplente
    "asciende" a `provisional`).
  - `darDeBaja(id)`: si la designacion cerrada era la base y habia
    suplentes vigentes, el inmediato se **cierra y se reabre** como
    `provisional` (nunca se edita in-place). El resto de la cadena no se
    toca — al recalcularse por consulta, queda apuntando bien solo.
  - `altaBase({ cargoId, personaId, situacionRevista, fechaAlta })` y
    `altaSuplente({ cargoId, personaId, fechaAlta, licenciaId, licencia })`
    son los dos puntos de entrada para crear una designacion — reusados
    tal cual por `SolicitudCargo` al aprobar (ver arriba).
- **CargoCurso** ([src/models/CargoCurso.js](../../../src/models/CargoCurso.js) +
  [src/repos/cargoCurso.repo.js](../../../src/repos/cargoCurso.repo.js)):
  que `Curso`(s) tiene a cargo un `Cargo` de **preceptor/ematp**, por
  `anioLectivo`. Se gestiona desde el detalle de cada `Cargo`, sub-seccion
  "Cursos a cargo" (no aparece para cargos de profesor). `obtenerPorCargo(cargoId)`
  trae **todos** los años sin filtrar — si en la Fase 3 de permisos hace
  falta "los cursos a cargo en el año actual", ese metodo filtrado todavia
  no existe, hay que agregarlo.
- **Curso** ([src/models/Curso.js](../../../src/models/Curso.js) +
  [src/repos/curso.repo.js](../../../src/repos/curso.repo.js)): `institucionId`,
  `anioId`, `division`, `turnoId` (**obligatorio**), `orientacionId`
  (opcional, `null` = ciclo basico), `clave` (unica **dentro de la
  institucion**, auto-sugerida via JS). Al crearlo, genera
  automaticamente un `Cargo` de profesor por cada fila de `Asignatura` del
  plan de estudio (`cargoRepo.generarParaCurso`, ver "Cargo" arriba para
  el formato de clave). **Es un molde fijo, reutilizado año a año** — no
  se recrea un `Curso` nuevo por ciclo lectivo.
  `cursoRepo.obtenerPorInstitucion(institucionId)` **ahora si se usa**
  (antes existia sin uso, y le faltaba `.populate('institucionId')` — se
  agrego al conectarlo a la institucion activa, ver "Sistema de permisos").
  **CRUD completo desde `cursoDetalle.ejs`** (`/admin/instituciones/:c/cursos/:c`):
  - Card **"Asignaturas y docentes"** (`cargoRepo.obtenerPorCurso`, ordenada
    por `Asignatura.orden` — Mongo no puede ordenar por un campo de un
    populate, se ordena en JS): lista los cargos de profesor del curso con
    quien esta designado hoy en cada uno (`designacionRepo.obtenerActivaPorCargo`,
    mismo patron que el listado de `/admin/cargos`) o "Vacante", con un link
    "Gestionar" a la ficha de ese `Cargo` para designar/dar de baja.
  - `GET`/`POST .../editar`: edicion **acotada a proposito** — solo
    `division`/`turnoId`/`clave` (organizativos). `anioId`/`orientacionId`
    quedan afuera: cambiarlos dejaria desincronizados los cargos de
    profesor ya generados (dependen del plan de estudio del año+orientacion
    original) — confirmado explicitamente, para tocarlos hay que eliminar
    el curso y crear uno nuevo.
  - `POST .../eliminar`: baja real, **bloqueada si el curso tuvo alguna vez
    estudiantes inscriptos** (`inscripcionRepo.existeAlgunaPorCurso` — vigente
    o historico, sin filtrar `fechaBaja`, para no perder ningun tramo de
    trayectoria) — confirmado explicitamente sobre la alternativa de
    cascadear tambien las inscripciones. Si esta vacio, cascadea en orden:
    `Licencia` → `Designacion` → `Cargo` (los de profesor generados para
    este curso, con todo su historial) → `CargoCurso` (vinculos de
    preceptor con **este** curso, nunca el `Cargo` de preceptor en si, que
    puede seguir cubriendo otros) → el `Curso`. Mismo criterio de "cascadear
    solo la relacion, nunca el otro lado" que la baja real de `Estudiante`.
    Modal de confirmacion simple (sin tipear la clave, a diferencia de
    `Estudiante`) — el guard de inscripciones ya protege lo irreversible de
    verdad.
- **Cargo** ([src/models/Cargo.js](../../../src/models/Cargo.js)): un puesto
  de la planta organica funcional. `cupof` (`String`, `unique + sparse`,
  `required: false`). No tiene `personaId`/`estado` (ver `Designacion`).
  `clave` (ver "Cargo" arriba para el formato y la pantalla de edicion) y,
  solo para cargos de profesor, `cursoId` + `asignaturaId` (indice unico
  compuesto `sparse`). `rolId` referencia el catalogo `Rol`. No tiene
  `cargaHoraria` propia. `turnoId` opcional.
  `cargoRepo.obtenerPorInstitucion(institucionId)` **ahora si se usa**
  (mismo caso que `Curso` — le faltaba populate de varios campos, se
  arreglo al conectarla a la institucion activa).
- **Rol** ([src/models/Rol.js](../../../src/models/Rol.js)): catalogo de
  roles de cargo. `nombre`/`nombreCorto`/`clave` unicos, `jerarquia`
  (`Number`, **no** unico, menor = mas alto rango, huecos grandes a
  proposito, **ahora tambien usada para ordenar el listado de `/admin/cargos`**)
  y `cargaHoraria` (`Number` opcional). Suma `nivelAcceso` — ver "Sistema
  de permisos" arriba. **Convencion activa y en uso real**: `jerarquia: 100`
  = Profesor — `admin/curso.controller.js::postCurso` busca el Rol de
  Profesor por esta jerarquia exacta para autogenerar los cargos al crear
  un curso (ver "Cargo" mas abajo). **Fragilidad conocida**: `jerarquia` es
  un numero libre que el admin tipea al crear el Rol — si el Rol de
  Profesor real no quedo con jerarquia exactamente 100 (nunca fue
  obligatorio, solo un ejemplo sugerido en el form), la busqueda no
  encuentra nada y el curso se crea **sin ningun cargo**, con solo un flash
  `warning` (facil de pasar por alto, el mensaje principal sigue siendo
  "Curso creado" en verde) — no hay excepcion ni error visible. Por eso la
  busqueda ahora tiene un segundo intento: si no hay Rol con `jerarquia:
  100`, cae a buscar por `nivelAcceso === 'profesor'`
  (`rolRepo.obtenerPorNivelAcceso`, editable desde `/admin/roles` → Editar,
  ver "Sistema de permisos"). Si un curso quedo creado sin cargos por este
  motivo, no hay forma de regenerarlos desde la UI todavia — hay que
  recrear el curso (bloqueado si ya tiene inscripciones, ver "Curso" mas
  abajo) o generarlos a mano.
- **Turno** ([src/models/Turno.js](../../../src/models/Turno.js)): grilla
  horaria de una institucion, con `modulos` embebidos. `clave` (`unique`
  compuesto con `institucionId`) — los turnos ya existentes al momento de
  agregar el campo no lo tienen cargado, sin pantalla de edicion todavia
  (mismo tipo de gap que ya se resolvio para `Institucion`/`Cargo`).
- **Anio** ([src/models/Anio.js](../../../src/models/Anio.js)): catalogo de
  años (`clave`, `nombre`, `ciclo`: `basico`|`superior`). `grado`
  (`Number`, `unique`, `sparse`) — los 6 registros existentes no lo
  tienen, sigue pendiente.
- **Orientacion** ([src/models/Orientacion.js](../../../src/models/Orientacion.js)):
  catalogo global (`nombre`, `nombreCorto`, `clave`, todos unicos) — el
  registro viejo "Comunicación" no tiene `nombreCorto`/`clave`, quedo
  **inalcanzable** desde que las rutas de edicion pasaron a usar `clave`.
- **Asignatura** ([src/models/Asignatura.js](../../../src/models/Asignatura.js)):
  fila puntual de plan de estudio (`anioId` + `orientacionId` opcional +
  `nombre` + `nombreCorto` + `clave` + `cargaHoraria` + `orden`). `clave`
  solo es unica dentro de `(anioId, orientacionId)`.
- **SolicitudCargo**: ver seccion propia arriba.

**Colecciones viejas en Mongo, de un intento anterior del usuario a este
mismo problema — dejadas sin usar a proposito:** `grados`, `orientacions`,
`curso` (sin `s`, no confundir con el `Curso` actual). El codigo actual no
las lee.

## Regimen academico y `Valoracion` — Nuevo Regimen Academico (Res. 1650/24)

Diseñado en detalle en una conversacion larga (el usuario comparti la
normativa real, no un resumen generico). **Modelo `Valoracion` ya
construido** ([src/models/Valoracion.js](../../../src/models/Valoracion.js)) —
el resto (repo, permisos, pantallas de carga) **todavia no**. Esta seccion
documenta el diseño completo para que la proxima sesion pueda seguir sin
tener que re-derivarlo.

### Por que `CursadaAsignatura` cambio de unica-por-año a unica-para-siempre

Este fue el cambio de diseño mas grande de toda la conversacion. Primer
intento: `Valoracion` colgada de una `CursadaAsignatura` unica por
`estudianteId`+`asignaturaId`+`cicloLectivo` (como estaba antes) — se
rompia apenas un estudiante seguia intensificando una materia **el año
siguiente sin recursar**: el `periodo` (`diciembre`/`febrero`) solo podia
tener una fila por `CursadaAsignatura`, y si sigue debiendo en el segundo
año necesita otra ronda de diciembre/febrero, que chocaria contra la
primera. Solucion: `CursadaAsignatura` pasa a ser unica para siempre
(`estudianteId`+`asignaturaId`, sin `cicloLectivo`) y `Valoracion` es la
que lleva su propio `cicloLectivo` — asi la misma relacion acumula rondas
de varios años (2024, 2025, 2026...) sin chocar entre si, hasta que
finalmente se aprueba. **Bonus no buscado**: esto distingue "recursa" de
"sigue intensificando sin recursar" sin necesitar un campo aparte —
confirmado explicitamente por el usuario ("si debe recursar, lo unico
nuevo es la Valoracion"): si un `cicloLectivo` tiene `informe1C`/`nota1C`/
`informe2C`/`nota2C` cargados, esta recursando (cursada completa de
nuevo); si ese año solo tiene `diciembre`/`febrero`, sigue intensificando
lo pendiente sin recursar.

### El regimen, explicado

Dos cuatrimestres por año, nota entera 1-10, se aprueba con **7+**. Si el
primer cuatrimestre queda debajo de 7 pero el docente confirma que se
recuperaron esos saberes durante el segundo (ver `recuperoSaberesC1` mas
abajo) y el segundo aprueba, la materia igual se acredita. Si no se llega
a aprobar en el año, hay dos instancias de intensificacion — **diciembre**
(se aprueba con **4+**) y **febrero/marzo** (cierre del ciclo lectivo,
tambien 4+). Hasta 4 materias pendientes, el estudiante sigue al año
siguiente intensificando (sin recursar); con 5 o mas, interviene el EDTE
(Equipo de Definicion de Trayectorias Educativas) y decide, **materia por
materia**, cuales de esas se intensifican (maximo 4) y cuales se recursan
completas.

### `Valoracion` ([src/models/Valoracion.js](../../../src/models/Valoracion.js))

Una fila por `cursadaAsignaturaId` + `cicloLectivo` + `periodo` (indice
unico compuesto — recargar el mismo periodo actualiza, no duplica).
`periodo`, seis instancias posibles por ronda/año:

| `periodo` | Cuando | `valoracion` | `nota` |
|---|---|---|---|
| `informe1C` | mitad 1er cuatrimestre (mayo) | TEA/TEP/TED | — |
| `nota1C` | cierre 1er cuatrimestre | — | 1-10 |
| `informe2C` | mitad 2do cuatrimestre (octubre) | TEA/TEP/TED | — |
| `nota2C` | cierre 2do cuatrimestre | — | 1-10 |
| `diciembre` | 1ra intensificacion | AA/CCA/CSA | 4-10, **solo si `valoracion` es AA** |
| `febrero` | cierre de ciclo lectivo | AA/CCA/CSA | 4-10, **siempre**, apruebe o no (registro administrativo de cierre) |

- **`recuperoSaberesC1`** (booleano, solo tiene sentido en `nota2C`): el
  docente marca explicitamente si, ademas de aprobar el 2do cuatrimestre,
  recupero lo que debia del 1ro — sin este flag no hay forma de distinguir
  "aprobo C2 y recupero C1" de "aprobo C2 pero sigue debiendo C1" (mismo
  `nota1C < 7`, `nota2C >= 7` en los dos casos).
- **`observacion`** (texto libre, opcional): **solo la carga un
  profesor** — preceptor/EMATP/jerarquicos cargan unicamente `valoracion`
  (sin observacion), confirmado explicitamente.
- **`hechoPor`**: mismo criterio que auditoria, nombre de usuario del mail
  (ver `utils/hechoPor.js`), no un `_id` de `Usuario`.
- **`CursadaAsignatura` no sabe nada de este regimen** (queda generica a
  proposito, ver arriba) — cuando una `Valoracion` implica aprobacion,
  `valoracionRepo.actualizarAprobacionSiCorresponde` escribe
  `aprobada`/`fechaAprobacion`/`notaFinal` en la `CursadaAsignatura`
  correspondiente — y **solo en esos casos**, nunca en un cierre de
  febrero sin aprobar (ahi la nota de cierre queda solo en `Valoracion`,
  como registro administrativo, sin tocar la relacion). No hace nada si la
  `CursadaAsignatura` ya estaba `aprobada` (no pisa una aprobacion ya
  registrada por una recarga/correccion posterior).

### `valoracion.repo.js` — construido

([src/repos/valoracion.repo.js](../../../src/repos/valoracion.repo.js)):

- `guardar({...})`: `findOneAndUpdate` con `upsert: true` sobre
  `cursadaAsignaturaId+cicloLectivo+periodo` — recargar el mismo periodo
  pisa lo anterior, nunca duplica (mismo criterio que el indice unico del
  modelo).
- `actualizarAprobacionSiCorresponde(cursadaAsignaturaId, cicloLectivo)`:
  revisa las 3 formulas de aprobacion sobre las `Valoracion` de esa ronda:
  1. `nota1C >= 7` y `nota2C >= 7` → nota final = **promedio** de ambas.
  2. `nota2C >= 7` con `recuperoSaberesC1` (aunque `nota1C < 7`) → mismo
     promedio (o directamente `nota2C` si no hay `nota1C` cargada).
  3. `diciembre` o `febrero` con `valoracion: 'AA'` y una `nota` cargada →
     esa nota, tal cual, **nunca se promedia** con las de cuatrimestre.

  `fechaAprobacion` se toma del `createdAt` de la `Valoracion` que
  disparo la aprobacion — simplificacion consciente (no hay un campo de
  "fecha del evento" propio todavia).

### Permisos y pantalla "por asignatura" — construida, ya generalizada

Profesor, preceptor, EMATP y jerarquicos pueden cargar `Valoracion` — pero
**el profesor solo en su propia asignatura** (la de su `Cargo.asignaturaId`)
y **con observacion**; preceptor/EMATP/jerarquicos en **cualquier
asignatura del curso**, pero **sin observacion**, solo `valoracion`. En la
practica el dia a dia lo hacen sobre todo profesor y preceptor, EMATP/
jerarquicos quedan como respaldo — pero los 4 tienen el permiso.

De los 3 modos de acceso acordados (**por asignatura**, **por curso** y
**por estudiante**), "por asignatura" ya esta construido **y generalizado**
— cubre tanto al profesor (su propia materia) como a preceptor/EMATP/
jerarquicos (cualquier materia del curso, sin observacion) con la misma
pantalla. Ya no hace falta una pantalla "por curso" aparte para poder
cargar cualquier asignatura — la matriz panoramica (todas las asignaturas
x todos los estudiantes en una sola vista, como la planilla original que
compartio el usuario) sigue sin construir, pero el acceso puntual "entrar
a cargar la nota de tal materia de este curso" ya funciona para los 4
roles.

- **`resolverContexto(req, cargoObjetivoId)`**
  ([src/controllers/valoracion.controller.js](../../../src/controllers/valoracion.controller.js)) —
  unico guard de toda la seccion, usado por `GET`/`POST` por igual:
  - **Sin `cargoObjetivoId`, o coincide con el cargo activo de la sesion**
    ("propio"): valido solo si ese cargo es de un profesor
    (`Rol.nivelAcceso === 'profesor'`) sobre su propia `asignaturaId`+
    `cursoId` — devuelve `{ cargo: cargoActivo, puedeObservacion: true,
    esPropio: true }`.
  - **`cargoObjetivoId` de OTRO cargo** ("ajeno"): valido solo si el cargo
    activo tiene `nivelAcceso` `'total'` (cualquier curso de su
    institucion) o `'preceptor'` (solo los cursos que tiene designados
    **este año lectivo** via `CargoCurso`, mismo chequeo que
    `misCursos.controller.js::resolverCursoPermitido`) — devuelve
    `{ cargo: cargoObjetivo, puedeObservacion: false, esPropio: false }`.
- **`GET`/`GET /:cargoId`/`POST .../fila`** en `/valoraciones/asignatura`
  ([src/routes/valoracion.router.js](../../../src/routes/valoracion.router.js),
  montado con solo `requireAuth` — el guard real es
  `resolverContexto`). Sin `:cargoId` = propio (nav "Valoraciones",
  visible solo si `nivelAccesoActivo === 'profesor'`); con `:cargoId` = se
  llega desde el boton "Agregar calificación" de la seccion "Asignaturas y
  docentes" de `misCursoDetalle.ejs` (ver mas abajo). El `POST .../fila`
  (autoguardado) recibe el `cargoId` en el body (mandado por el JS, ver
  abajo) y usa el mismo `resolverContexto` para autorizar y decidir si
  `observacion` se guarda o se ignora server-side (nunca confia solo en
  que el campo este oculto del lado del cliente).
- **`CONFIG_PERIODO`** decide que campos pide cada periodo
  (`valoraciones`, `nota` + rango, `recupero`, `observacion`); el
  controller lo combina con `puedeObservacion` (`config.observacion =
  configBase.observacion && puedeObservacion`) antes de mandarlo a la
  vista — asi la vista nunca decide sola quien puede cargar observacion.
- **Selector de ciclo lectivo y periodo, dinamico** (pedido explicito):
  dos `<select>` en un form `GET` que recarga la pagina — sin JS, un
  periodo a la vez, nunca la planilla completa. El form apunta a
  `basePath` (`/valoraciones/asignatura` si es propio,
  `/valoraciones/asignatura/:cargoId` si es ajeno).
- **La tabla** lista los estudiantes con `Inscripcion` vigente en el curso
  del cargo (`inscripcionRepo.obtenerVigentesPorCurso`). Para cada uno,
  resuelve (o crea sobre la marcha, si faltaba) su `CursadaAsignatura` de
  esa materia, y busca si ya hay una `Valoracion` cargada para el
  periodo/ciclo elegidos (para precargar el form, no partir de cero en
  cada recarga).
- **"Volver al curso"** (`volverA`, solo en modo ajeno) — link de vuelta a
  `/mis-cursos/:cursoClave`. En modo propio no hay boton de volver (el
  profesor llega ahi por el nav, no desde un curso puntual).
- **Autoguardado por fila via AJAX** (pedido explicito del usuario) — **la
  unica excepcion de ESCRITURA por AJAX de todo el proyecto** (todo el
  resto de los guardados van por POST+redirect+flash; las excepciones
  anteriores — Georef, checklist de materias, verificar documento — son
  todas de **lectura**). No hay boton "Guardar": al tocar cualquier campo
  de la fila de un estudiante (`change` en selects/checkbox, `blur` en
  inputs de texto/numero — ver `/js/valoracionesAutosave.js`,
  `initValoracionesAutosave`), se manda la fila **completa** (no solo el
  campo tocado, mas el `cargoId` de la pantalla) a
  `POST /valoraciones/asignatura/fila` — porque una `Valoracion` es un
  solo documento con varios campos juntos, mandar de a uno pisaria los
  demas con vacio en el upsert del servidor. Cada fila tiene un indicador
  (`data-indicador`, un ícono oculto por defecto): tilde verde que aparece
  y se borra solo a los ~2.5s si guardo bien, triangulo de alerta amarillo
  que **no se borra solo** si fallo (pedido explicito — un error no debe
  pasar desapercibido, queda hasta el proximo intento). Una fila sin nada
  cargado (se entro y salio de un campo sin escribir) no dispara ningun
  pedido. `postGuardarFila` revalida server-side que la `CursadaAsignatura`
  recibida sea realmente de la asignatura del cargo resuelto (no confia en
  el id que manda el cliente sin chequear).

### "Asignaturas y docentes" en `misCursoDetalle.ejs` — cargada por AJAX

Pedido explicito del usuario, agregado al final de la vista de un curso
puntual (`/mis-cursos/:cursoClave`, preceptor/EMATP/jerarquicos):

- **`GET /mis-cursos/:cursoClave/asignaturas`**
  (`misCursos.controller.js::getAsignaturasDocentes`, mismo guard que el
  resto de esa seccion — `resolverCargoActivo`+`resolverCursoPermitido`)
  devuelve JSON con, por cada `Cargo` de profesor del curso
  (`cargoRepo.obtenerPorCurso`): asignatura, carga horaria, titular
  (`designacionRepo.obtenerCadenaPorCargo` → `base`) y suplente actual (el
  ultimo de `suplentesVigentes`, si hay).
- **`/js/asignaturasDocentes.js`** (`initAsignaturasDocentes({ contenedor,
  boton, url })`): **no se dispara solo** al entrar a la pagina — pedido
  explicito del usuario ("no me sirve de nada que el ajax se dispare
  solo") — recien pide el JSON cuando se aprieta el boton "Ver
  asignaturas y docentes" (dentro del mismo contenedor; al click se
  deshabilita, muestra "Cargando...", y al resolver se reemplaza por la
  tabla o un mensaje de error) y arma la tabla en el cliente. Dos botones
  por fila:
  - **"Ver detalles"**: toggle client-side puro (todos los datos ya
    vinieron en la misma respuesta, no hace falta un segundo pedido) —
    despliega una fila oculta con titular, suplente (si tiene) y carga
    horaria. Pedido explicito: sin navegar a ningun lado.
  - **"Agregar calificación"**: link directo a
    `/valoraciones/asignatura/:cargoId` (modo "ajeno" de la seccion
    anterior — sin observacion).
  - Escapa nombres con un helper (`escapar`, via `textContent`) antes de
    insertarlos como HTML — los nombres vienen de `Persona`, no son
    confiables al 100% para insertar crudos con `innerHTML`.
- **Header de `misCursoDetalle.ejs` reordenado** (pedido explicito): el
  boton "+ Agregar" (alta de estudiante) se saco de la linea del titulo
  del curso — volvio a vivir en el `card-header` de la propia card
  "Agregar estudiante nuevo" (mismo patron que `estudiantes.ejs`), porque
  se confundia con los otros botones de esa linea. En su lugar, la linea
  del titulo tiene **"Calificaciones"** (link a
  `/valoraciones/curso/:cursoClave`, ver mas abajo) y "Volver a mis
  cursos".

### "Por curso" — matriz asignaturas x estudiantes — construida

Pedido explicito del usuario (con esta prioridad sobre el "resumen" y la
vista "por estudiante", que siguen sin construir). Para nivelAcceso
`'total'`/`'preceptor'`, todas las asignaturas del curso x todos los
estudiantes vigentes, un periodo/ciclo a la vez.

- **`GET /valoraciones/curso/:cursoClave`**
  (`valoracion.controller.js::getPorCurso`) reusa el guard exacto de
  `/mis-cursos` — `resolverCargoActivo`/`resolverCursoPermitido`,
  **exportados desde `misCursos.controller.js`** e importados aca (mismo
  patron que `estudiante.controller.js` exportando helpers compartidos)
  en vez de duplicar la logica de "que curso puede ver este cargo". Nunca
  hay `observacion` en esta pantalla (`config.observacion` se fuerza a
  `false`) — sigue siendo exclusiva del profesor cargando su propia
  materia desde `/valoraciones/asignatura`.
- **Sin N×M consultas individuales**: en vez de resolver cada celda
  (estudiante × asignatura) con su propia query (lo que en un curso de 30
  estudiantes x 10 materias serian 300 idas y vueltas a Mongo), se hace en
  bloque — `cursadaAsignaturaRepo.obtenerPorEstudiantesYAsignaturas`
  y `valoracionRepo.obtenerPorCursadasYPeriodo` (ambos nuevos, `$in`
  sobre listas de ids) traen todo de una vez, y la matriz se arma en
  memoria con diccionarios `estudianteId_asignaturaId` / `cursadaAsignaturaId`.
  Antes de armar la matriz, igual se asegura (find-or-create, mismo
  `cursadaAsignaturaRepo.crearVarias` de siempre) que exista una
  `CursadaAsignatura` por cada par — un estudiante recien transferido
  puede no tenerlas todas.
- **Autoguardado por CELDA, no por fila** — `/js/valoracionesMatrizAutosave.js`
  (`initValoracionesMatrizAutosave`), archivo separado de
  `valoracionesAutosave.js` (no una generalizacion del mismo) porque cada
  celda tiene su **propio `cargoId`** (varia por columna/asignatura,
  a diferencia de "por asignatura" donde todas las filas comparten un
  solo cargo) — el `data-cargo-id`+`data-cursada-id` viven en el `<td>`,
  no en el `<tr>`. Postea al **mismo** `POST /valoraciones/asignatura/fila`
  de siempre (`resolverContexto` ya sabe resolver "ajeno" para cualquier
  `cargoId` que preceptor/total tenga permitido) — no hizo falta un
  endpoint de guardado nuevo. Mismos indicadores por celda (tilde verde
  que se borra solo / triangulo amarillo que no).
- Encabezados de columna usan `Asignatura.nombreCorto` (con el nombre
  completo en `title`, tooltip) para no hacer la tabla excesivamente
  ancha — envuelta en `table-responsive`, `container-fluid` en vez de
  `container` (mas ancho disponible que el resto de las paginas).

### Explicitamente fuera de esta vuelta

- El "resumen" por estudiante (3 categorias: todas aprobadas / ≤4
  pendientes / 5+ pendientes) — confirmado que **no** debe aparecer en la
  pantalla de carga de valoraciones (es una alerta temprana, no algo que
  se mira al cierre), va en una pantalla aparte, todavia sin nombre mas
  alla de "resumen".
- La pantalla "por estudiante" (ver todas las materias de un estudiante
  puntual desde la mirada de preceptor/EMATP/jerarquicos) — diseñada, sin
  construir.
- Como se representa exactamente que una materia siga intensificando el
  año siguiente **sin recursar completo** a nivel de matriculacion (¿se
  crea o no una nueva `Inscripcion`/participacion ese año para una materia
  que no cursa regularmente?) — es una decision de matriculacion, no de
  carga de valoraciones, no bloquea la pantalla del profesor.

## Trayectoria del estudiante — vista calculada, no un modelo

**No existe `Trayectoria.js`** — se calcula al vuelo en
`getEstudianteDetalle` ([estudiante.controller.js](../../../src/controllers/estudiante.controller.js)).
La pagina `estudianteDetalle.ejs` tiene dos secciones separadas, ya no una
sola "trayectoria por año" mezclada (cambio directo del cambio de
`CursadaAsignatura` de arriba):
- **"Materias"**: lista plana de `CursadaAsignatura` (`cursadas`), **sin
  agrupar por año** (ya no tienen uno propio) — ordenada por año/nombre de
  asignatura, con su estado (`aprobada`/pendiente), `notaFinal` y
  `fechaAprobacion`. El form "Agregar materia" (`postCursada`) tampoco
  pide `cicloLectivo` — la relacion es unica sin importar el año.
- **"Trayectoria"**: agrupa `Inscripcion` (`historial`) por `cicloLectivo`
  — eso si sigue siendo por año, cada `Inscripcion` es a un curso concreto
  de un año concreto.
- `materiasEnCurso` (usado en "Situacion actual"): `cursadas.filter(c =>
  !c.aprobada)` — todas las materias pendientes, sin importar el año,
  calculado una vez en el controller y pasado ya resuelto a la vista.

Decision explicita, discutida varias veces: guardar una "Trayectoria"
aparte duplicaria datos que ya viven en `Inscripcion`/`CursadaAsignatura`/
`Valoracion`, con riesgo de desincronizacion, ademas de perder la
capacidad de tener **mas de un** registro de `Inscripcion` dentro del
mismo `cicloLectivo` (cambio de curso/escuela a mitad de año).

## Panel de admin

`src/routes/admin/*.router.js` + `src/controllers/admin/*.controller.js` +
`src/views/pages/admin/*.ejs`. Protegido con `requireAuth` + `requireAdmin`
([src/app.js](../../../src/app.js)) — `requireAdmin` ahora exige ademas
`req.session.modoGestion` (ver "Sistema de permisos"). Rutas registradas:

- `/admin/roles` — alta+listado de `Rol` (con `nivelAcceso`), sin
  editar/eliminar todavia.
- `/admin/cargos` — listado+alta de `Cargo`, **filtrado por institucion
  activa**, ordenado por jerarquia+turno (ver "Cargo" arriba); detalle en
  `/admin/instituciones/:institucionClave/cargos/:cargoClave`
  (`institucionCargo.router.js`): designar titular/suplente, dar de baja,
  "Cursos a cargo", solicitudes pendientes de ese cargo. Edicion de clave
  en `/admin/cargos/:id/editar`.
- `/admin/turnos` — listado+alta de `Turno`, **filtrado por institucion
  activa**; detalle en `/admin/instituciones/:institucionClave/turnos/:turnoClave`.
- `/admin/orientaciones` — CRUD completo de `Orientacion`, por `:clave`,
  sin filtro por institucion (catalogo global).
- `/admin/anios` — alta+listado de `Anio` y `Asignatura`, sin filtro por
  institucion (catalogo global). Las rutas de creacion/edicion (crear
  `Anio`, crear materia, agregar orientacion, editar fila) requieren
  `nivelPoder === 'total'` (ver "Sistema de permisos").
- `/admin/cursos` — listado+alta de `Curso`, **filtrado por institucion
  activa** (con auto-generacion de cargos de profesor, sigue en
  `nivelPoder: 'gestion'`); detalle en
  `/admin/instituciones/:institucionClave/cursos/:cursoClave`.
- `/admin/instituciones` — listado (por `cue`) + editar `clave`.
- `/admin/solicitudes-cargo` — listado global de `SolicitudCargo`
  pendientes, aprobar/rechazar.

Y fuera de `/admin`: `/estudiantes` (accesible a cualquier `usuario`
autenticado, no solo admin), `/estudiantes/:clave` (ficha completa, con
edicion y baja real), `/seleccionar-cargo` y `/solicitudes-cargo` (para
docentes), `/seleccionar-institucion` (para admin en modo gestion).

## Flujo de autenticacion, alta y admin

1. Login real: `GET /auth/google` → guarda `modoGestionSolicitado` en
   sesion → Passport, estrategia en
   [src/config/passport.js](../../../src/config/passport.js) (`hd === 'abc.gob.ar'`).
2. Usuario no encontrado en Mongo → `/alta` (`formInstitucion.ejs` o
   `formAgente.ejs`) → crea `Institucion`/`Persona` + `Usuario`
   (`estado: 'pendiente'`).
3. Un admin aprueba (a mano en Mongo — `usuarioService.putEstadoUsuario`
   existe pero no esta conectado a ninguna ruta, ver "Cosas en WIP") antes
   de poder entrar a rutas protegidas.
4. Callback (`GET /auth/google/callback`, con `keepSessionInfo: true` —
   ver el bug de Passport arriba): fija `modoGestion`, y branch segun eso
   — modo gestion resuelve institucion activa (ver permisos), si no,
   resuelve designaciones/cargo activo (ver abajo).
5. **Promover a admin / nivelPoder / alcance**: a mano contra Mongo, no
   hay pantalla para ninguno de los tres. Admin actual: `manuleon@abc.gob.ar`.
6. **Sesion cacheada**: `req.user` no se re-lee de Mongo en cada request —
   cambios de rol/estado/alcance/nivelPoder no se notan hasta re-loguear.
   Passport serializa el **objeto completo** en sesion (`serializeUser`/
   `deserializeUser` son passthrough, no solo un id) — otro motivo por el
   que no hay refresco automatico.

### Selector de cargo al iniciar sesion (docente, sin modo gestion)

`routes/auth.router.js`, si **no** esta en modo gestion y
`req.user.tipo === 'personal'`, resuelve cuantas `Designacion` **activas**
tiene esa `Persona` via `designacionRepo.obtenerActivasPorPersona`:
- 0 → flash de aviso y redirect a `/`, **salvo `rol === 'admin'`** (puede
  entrar sin cargo propio).
- 1 → `req.session.cargoActivoId = designaciones[0].cargoId._id`, entra a
  `/estudiantes`.
- 2+ → redirect a `/seleccionar-cargo`.

Las instituciones (`tipo: 'institucion'`) no tienen cargos, entran directo.
Link "Cambiar de cargo" en el nav para volver a elegir sin desloguearse
(ver "Sistema de permisos" arriba). **Todavia no implementado**: que
`cargoActivoId` se use para algo en rutas protegidas (Fase 3), `/dashboard`
real generico.

## Arquitectura en capas

`routes → controllers → services → repos → models`. Los repos son la unica
capa que toca Mongoose directamente. La logica de negocio (validaciones,
cascadas, calculos) **vive en el repo**, no en una capa `service` separada
— mismo patron ya establecido por `asignaturaRepo.subir`/`bajar`/
`buscarDuplicado`, y seguido despues por `designacionRepo`,
`inscripcionRepo`, `solicitudCargoRepo`, etc. Los `services/*.js` viejos
(`usuarioService`, `institucionService`, `personaService`) siguen
existiendo para el flujo de alta/login, no se tocaron mas alla de lo
necesario para no romperlos.

`src/utils/` — por ahora solo `mayusculas.js`.

`src/data/` — catalogos estaticos vendorizados a mano (por ahora,
`paisesNacionalidad.js` — ver "Nacimiento y domicilio").

`scripts/` — migraciones puntuales corridas a mano por el usuario (ver
"Cargo" arriba para el gotcha de `MissingSchemaError` con `.populate()`).

La convencion de nombres de archivo sigue sin ser uniforme. Segui el patron
del archivo mas cercano al que estas tocando.

## Cosas en WIP / no conectadas — no asumir que funcionan

- [src/controllers/auth.controller.js](../../../src/controllers/auth.controller.js) /
  [src/services/auth.service.js](../../../src/services/auth.service.js): flujo de
  login alternativo, codigo muerto **e inseguro** (ver "Sistema de
  permisos" arriba — el motivo exacto por el que no se debe reactivar).
- [src/services/usuario.service.js](../../../src/services/usuario.service.js)
  (`getSolicitudesPorTipo` y relacionados): tambien codigo muerto, y
  **roto** (llama a metodos de `usuario.repo.js` que no existen) — no
  confundir con `SolicitudCargo`, es para la aprobacion de la cuenta de
  `Usuario`, no de un `Cargo`.
- Comentarios `// const Ciie = ...` en `usuario.repo.js`: resto de otro
  dominio (proyectos hermanos `artic`/`articulacion`), no reintroducir.
- Datos de salud, inclusion, educacion complementaria, servicio
  alimentario de la planilla de inscripcion: sin encarar.
- `Valoracion` (regimen academico): pantalla "por asignatura" (profesor)
  construida; faltan "por curso" y "por estudiante"
  (preceptor/EMATP/jerarquicos) y el "resumen" — ver "Regimen academico y
  `Valoracion`".
- Resto de Fase 3 de permisos: filtrar que puede hacer un docente **dentro**
  de `/estudiantes` segun `nivelAcceso`/cargo activo — sigue sin tocar (lo
  unico implementado es a donde aterriza cada quien, ver "Landing segun
  nivelAcceso").

## Vistas

EJS con Bootstrap 5 (`data-bs-theme="dark"`) + **Bootstrap Icons** (CDN) —
CDN directo, sin build step. Mensajes flash centralizados en
[src/views/partials/msj.ejs](../../../src/views/partials/msj.ejs)
(`error`/`info`/`success`/`warning`, todos ya conectados).

Partials reusables: `partials/modalMaterias.ejs` (checklist de materias),
`partials/documentoFields.ejs`, `partials/nacimientoFields.ejs`,
`partials/nacionalidadSelect.ejs`, `partials/domicilioFields.ejs` (los
ultimos cuatro aceptan `persona`/`idSufijo` opcionales, ver secciones
propias arriba).

**Mobile-first real**: los forms de estudiante/responsable
(`estudiantes.ejs`, `admin/cursoDetalle.ejs`, `estudianteDetalle.ejs`) usan
clases `col-12 col-sm-* col-md-*` explicitas y las tablas van envueltas en
`.table-responsive`. Si agregas un form nuevo en esta zona, segui ese
patron en vez del `col-md-*` suelto que todavia usan algunas pantallas de
admin mas viejas.

## Seguridad

`.env` (Mongo Atlas, secreto de OAuth de Google, `SESSION_SECRET`) esta en
`.gitignore` (confirmado, correcto) — nunca lo commitees. El repo git
tiene su raiz en `C:\Users\manul` (todo el home), no en `trayectorias/` —
**`trayectorias/` se subio a git por primera vez el 2026-08-10** (127
archivos, nunca habia sido commiteado antes en este repo). Sigue el mismo
cuidado de siempre: escopa cualquier `git status`/`git add`/`git diff` a
`trayectorias/` (o `.` estando parado ahi) — corridas sin path desde la
raiz del repo traen ruido de los proyectos hermanos (`artic`,
`articulacion`, con cambios propios sin relacion) y hasta intentan listar
carpetas de sistema de Windows sin permiso.
