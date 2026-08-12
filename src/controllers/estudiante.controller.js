const estudianteRepo = require('../repos/estudiante.repo');
const inscripcionRepo = require('../repos/inscripcion.repo');
const cursoRepo = require('../repos/curso.repo');
const institucionRepo = require('../repos/institucion.repo');
const cursadaAsignaturaRepo = require('../repos/cursadaAsignatura.repo');
const asignaturaRepo = require('../repos/asignatura.repo');
const adultoResponsableRepo = require('../repos/adultoResponsable.repo');
const estudianteResponsableRepo = require('../repos/estudianteResponsable.repo');
const auditoriaRepo = require('../repos/auditoria.repo');
const mongoose = require('mongoose');
const Persona = require('../models/Persona');
const Asignatura = require('../models/Asignatura');
const Anio = require('../models/Anio');
const aMayusculas = require('../utils/mayusculas');
const hechoPor = require('../utils/hechoPor');
const fechaHoy = require('../utils/fechaHoy');

// Materias del plan de estudio de un año/orientacion (basico = plantilla, sin orientacion).
const materiasDelAnio = (anio, orientacionId) => (anio.ciclo === 'superior'
    ? asignaturaRepo.obtenerPorAnioYOrientacion(anio._id, orientacionId)
    : asignaturaRepo.obtenerPlantilla(anio._id));

const formatearAsignatura = (asignatura) => ({ _id: asignatura._id, nombre: asignatura.nombre });

// El ciclo lectivo en curso + 5 años para atrás, para el select del form de alta.
const ciclosLectivosDisponibles = () => {
    const anioActual = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => anioActual - i);
};

// Dos listas paralelas (una fila del form = mismo indice en las dos) en vez de un array
// de objetos, porque asi es como llegan los inputs repetibles de un form HTML.
const construirTelefonos = (body) => {
    const descripciones = [].concat(body.telefonoDescripcion || []);
    const numeros = [].concat(body.telefonoNumero || []);
    return numeros
        .map((numero, i) => ({ descripcion: (descripciones[i] || '').trim() || undefined, numero: numero.trim() }))
        .filter((t) => t.numero);
};

const construirDomicilio = (body) => {
    const domicilio = {
        calle: body.domicilioCalle || undefined,
        numero: body.domicilioNumero || undefined,
        piso: body.domicilioPiso || undefined,
        depto: body.domicilioDepto || undefined,
        entreCalles: body.domicilioEntreCalles || undefined,
        provincia: body.domicilioProvincia || undefined,
        localidad: body.domicilioLocalidad || undefined,
        partido: body.domicilioPartido || undefined
    };
    return Object.values(domicilio).some(Boolean) ? domicilio : undefined;
};

// "Lugar de nacimiento" + "Nacionalidad" de la planilla - solo para Persona (la planilla
// no se lo pide a la persona responsable, esa solo tiene Nacionalidad suelta).
const construirNacimiento = (body) => {
    const nacimiento = {
        lugar: body.nacimientoLugar || undefined,
        nacionalidad: body.nacionalidad || undefined,
        provincia: body.nacimientoProvincia || undefined,
        distrito: body.nacimientoDistrito || undefined,
        localidad: body.nacimientoLocalidad || undefined
    };
    return Object.values(nacimiento).some(Boolean) ? nacimiento : undefined;
};

// Mismos campos de documento para Persona y AdultoResponsable (ver Persona.tipoDocumento).
const construirDatosDocumento = (body) => ({
    tipoDocumento: body.tipoDocumento || 'DNI',
    numeroDocumento: body.numeroDocumento || undefined,
    estadoDni: body.tipoDocumento === 'DNI' ? (body.estadoDni || undefined) : undefined,
    documentoExtranjeroTipo: body.tipoDocumento === 'Documento extranjero' ? (body.documentoExtranjeroTipo || undefined) : undefined
});

// Arma los datos de Persona desde el form de alta - lo usan tanto /estudiantes como
// /admin/cursos/:id/estudiantes, mismo formulario reusado en los dos lugares.
const construirDatosPersona = (body) => ({
    ...construirDatosDocumento(body),
    cuil: body.cuil || undefined,
    apellido: body.apellido,
    nombre: body.nombre,
    fecha_nacimiento: body.fechaNacimiento ? new Date(body.fechaNacimiento) : undefined,
    genero: body.genero || undefined,
    nacimiento: construirNacimiento(body),
    domicilio: construirDomicilio(body),
    telefonos: construirTelefonos(body)
});

// Un estudiante indocumentado no tiene numeroDocumento/cuil para el chequeo de arriba -
// esto es solo un aviso (nunca bloquea el alta): mismo apellido+nombre+fecha de
// nacimiento probablemente sea la misma persona cargada dos veces, pero tambien puede
// ser una coincidencia real, asi que queda a criterio de quien carga.
const buscarDuplicadoIndocumentado = (datosPersona) => {
    if (datosPersona.numeroDocumento || datosPersona.cuil || !datosPersona.fecha_nacimiento) return null;
    return Persona.findOne({
        apellido: aMayusculas(datosPersona.apellido),
        nombre: aMayusculas(datosPersona.nombre),
        fecha_nacimiento: datosPersona.fecha_nacimiento
    });
};

// Chequeo en vivo mientras se carga el numero de documento en el alta de un estudiante
// nuevo (ver /js/verificarDocumento.js) - no se usa en el alta de persona responsable,
// ahi reusar un AdultoResponsable con el mismo documento es el comportamiento esperado,
// no un error (ver postResponsable). Distingue "ya existe pero no es estudiante" (ej. un
// agente con ese documento) de "ya existe un estudiante", porque solo en el segundo caso
// hay una ficha (/estudiantes/:clave) a la que linkear.
const getVerificarDocumento = async (req, res) => {
    const numeroDocumento = (req.query.numeroDocumento || '').trim();
    if (!numeroDocumento) return res.json({ existe: false });

    const persona = await Persona.findOne({ numeroDocumento });
    if (!persona) return res.json({ existe: false });

    const estudiante = await estudianteRepo.obtenerPorNumeroDocumento(numeroDocumento);
    res.json({
        existe: true,
        esEstudiante: !!estudiante,
        clave: estudiante ? numeroDocumento : null,
        nombreCompleto: `${persona.apellido}, ${persona.nombre}`
    });
};

// Alta de estudiante nuevo, con el curso ya resuelto por el llamador - compartido por
// admin/curso.controller.js (institucion activa de un admin en modo gestion) y
// misCursos.controller.js (curso propio de un docente con nivelAcceso 'total'/'preceptor',
// ver Fase 3 en la skill). Devuelve { error } si no se pudo crear, o { warning } (opcional)
// si se creo pero hay un posible duplicado indocumentado a revisar - nunca lanza, el
// llamador decide como floppear el flash y a donde redirigir.
const crearEstudianteEnCurso = async (curso, body) => {
    const { cicloLectivo, fechaAlta, motivoAlta, numeroRegistro, procedencia, materiaIds } = body;
    const datosPersona = construirDatosPersona(body);

    const condicionesDuplicado = [];
    if (datosPersona.numeroDocumento) condicionesDuplicado.push({ numeroDocumento: datosPersona.numeroDocumento });
    if (datosPersona.cuil) condicionesDuplicado.push({ cuil: datosPersona.cuil });
    const duplicado = condicionesDuplicado.length
        ? await Persona.findOne({ $or: condicionesDuplicado })
        : null;
    if (duplicado) return { error: 'Ya existe una persona registrada con ese número de documento o CUIL.' };

    const posibleDuplicado = await buscarDuplicadoIndocumentado(datosPersona);
    const materiaIdsFinal = await resolverMateriaIds(materiaIds, curso);

    // Todo el alta (Persona + Estudiante + Inscripcion + CursadaAsignatura) va en una sola
    // transaccion Mongo: si algo falla a mitad de camino (bug real que motivo esto - un
    // indice viejo en Mongo rompia justo despues de crear la Persona, y esta quedaba
    // "huerfana", sin Estudiante, sin poder recrearse por el chequeo de duplicados ni
    // aparecer en "inscribir existente" - ver scripts/completarEstudianteHuerfano.js para
    // el caso que ya haya quedado asi de una corrida anterior), no debe quedar nada guardado.
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const [persona] = await Persona.create([datosPersona], { session });
            const legajo = await estudianteRepo.generarLegajo(curso.institucionId.clave || curso.institucionId.cue, session);
            const estudiante = await estudianteRepo.crear(persona._id, legajo, session);
            await inscripcionRepo.matricular({
                estudianteId: estudiante._id,
                cursoId: curso._id,
                cicloLectivo: Number(cicloLectivo),
                fecha: new Date(fechaAlta),
                motivo: motivoAlta,
                numeroRegistro,
                procedencia
            }, session);
            await cursadaAsignaturaRepo.crearVarias(estudiante._id, materiaIdsFinal, session);
        });
    } catch (error) {
        // El mensaje al usuario es generico a proposito (no exponer detalles internos de
        // Mongo), pero el error real queda en la consola del servidor - sin esto, un fallo
        // aca es indiagnosticable a distancia (paso real: asi se encontro que faltaba
        // correr scripts/eliminarIndicesViejosEstudiante.js la primera vez).
        console.error('Error en el alta transaccional de estudiante:', error);
        return { error: 'No se pudo completar el alta - no se guardó nada. Probá de nuevo, y si sigue fallando avisá al administrador.' };
    } finally {
        await session.endSession();
    }

    return posibleDuplicado
        ? { warning: 'Ya existía una persona sin documento con el mismo apellido, nombre y fecha de nacimiento - verificá que no sea un duplicado.' }
        : {};
};

// Inscribe a un estudiante que ya existe en `curso` - mismo criterio de reuso que arriba,
// tambien atomico (Inscripcion.matricular ya hace 2 escrituras por si sola si habia que
// cerrar una vigente anterior - sin transaccion, un fallo a mitad podia dejar la vieja
// cerrada sin abrir la nueva).
const inscribirExistenteEnCurso = async (curso, body) => {
    const { estudianteId, cicloLectivo, fechaAlta, motivoAlta, numeroRegistro, procedencia, materiaIds } = body;
    const materiaIdsFinal = await resolverMateriaIds(materiaIds, curso, estudianteId);

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            await inscripcionRepo.matricular({
                estudianteId,
                cursoId: curso._id,
                cicloLectivo: Number(cicloLectivo),
                fecha: new Date(fechaAlta),
                motivo: motivoAlta,
                numeroRegistro,
                procedencia
            }, session);
            await cursadaAsignaturaRepo.crearVarias(estudianteId, materiaIdsFinal, session);
        });
    } catch (error) {
        console.error('Error en la inscripcion transaccional de estudiante existente:', error);
        return { error: 'No se pudo completar la inscripción - no se guardó nada. Probá de nuevo.' };
    } finally {
        await session.endSession();
    }
    return {};
};

// Para "Inscribir estudiante existente" en un curso: separa a los candidatos (todos los
// estudiantes que hoy no estan vigentes EN ESTE curso) en dos grupos, segun tengan o no una
// inscripcion vigente en ESTE MISMO ciclo lectivo en otro curso:
// - "libres": sin vigente este año en ningun lado (nunca se inscribio, o su vigente es de
//   un año anterior y todavia no se cerro - el caso normal de "empieza el año, hay que
//   re-anotar a los que promocionaron" no es un cambio de nada, se anota directo sin pedir
//   mas datos).
// - "en otro curso": tienen una vigente de ESTE año en otro curso/institucion - un cambio
//   real a mitad de año, amerita avisar donde estan y pedir el resto de los datos de la
//   inscripcion (motivo, etc) antes de transferirlos.
const calcularEstudiantesDisponibles = async (inscripcionesVigentesDelCurso, todosLosEstudiantes) => {
    const idsYaInscriptos = new Set(inscripcionesVigentesDelCurso.map((i) => String(i.estudianteId._id)));
    const candidatos = todosLosEstudiantes.filter((e) => !idsYaInscriptos.has(String(e._id)));

    const anioActual = new Date().getFullYear();
    const vigentes = await Promise.all(candidatos.map((e) => inscripcionRepo.obtenerVigentePorEstudiante(e._id)));

    const estudiantesLibres = [];
    const estudiantesEnOtroCurso = [];
    candidatos.forEach((estudiante, i) => {
        const vigente = vigentes[i];
        if (vigente && vigente.cicloLectivo === anioActual) {
            estudiantesEnOtroCurso.push({ estudiante, vigente });
        } else {
            estudiantesLibres.push(estudiante);
        }
    });

    return { estudiantesLibres, estudiantesEnOtroCurso, anioActual };
};

const getEstudiantes = async (req, res) => {
    const [estudiantes, cursos] = await Promise.all([
        estudianteRepo.obtenerTodos(),
        cursoRepo.obtenerTodos()
    ]);

    const inscripciones = await Promise.all(
        estudiantes.map((estudiante) => inscripcionRepo.obtenerVigentePorEstudiante(estudiante._id))
    );
    const estudiantesConInscripcion = estudiantes.map((estudiante, i) => ({ estudiante, inscripcion: inscripciones[i] }));

    res.render('pages/estudiantes', {
        estudiantesConInscripcion, cursos, ciclosLectivos: ciclosLectivosDisponibles(), fechaHoy: fechaHoy()
    });
};

const postEstudiante = async (req, res) => {
    const curso = await cursoRepo.obtenerPorId(req.body.cursoId);
    if (!curso) {
        req.flash('error', 'Curso inválido.');
        return res.redirect('/estudiantes');
    }

    const resultado = await crearEstudianteEnCurso(curso, req.body);
    if (resultado.error) {
        req.flash('error', resultado.error);
        return res.redirect('/estudiantes');
    }
    if (resultado.warning) req.flash('warning', resultado.warning);
    req.flash('success', 'Estudiante agregado.');
    res.redirect('/estudiantes');
};

// Para el checklist de materias al matricular: las del plan de estudio del curso (menos
// las que el estudiante ya tiene aprobadas) mas las atrasadas de años anteriores (menos
// las aprobadas) - nunca de años posteriores, no se puede adelantar. Sin estudianteId
// (estudiante nuevo, todavia no existe) no hay historial que filtrar ni atrasadas que
// ofrecer, solo el plan de estudio completo del año.
const obtenerAprobadasSet = async (estudianteId) => {
    if (!estudianteId) return new Set();
    const aprobadas = await cursadaAsignaturaRepo.obtenerAsignaturasAprobadas(estudianteId);
    return new Set(aprobadas.map(String));
};

// El plan de estudio del año/orientacion del curso, menos lo ya aprobado - mismo calculo
// que usa el checklist de materias para "precargadas", reusado tambien como default
// automatico (ver resolverMateriaIds) cuando nunca se abrio el checklist.
const materiasPrecargadas = async (curso, aprobadasSet) => {
    const orientacionId = curso.orientacionId ? curso.orientacionId._id : null;
    const delAnio = await materiasDelAnio(curso.anioId, orientacionId);
    return delAnio.filter((a) => !aprobadasSet.has(String(a._id)));
};

// Si no se tildo nada en el checklist (nunca se abrio el modal - el caso normal, un
// estudiante suele cursar todas las materias del año), se anota por defecto en TODAS las
// del plan de estudio del año/orientacion (menos las ya aprobadas, si es un estudiante
// existente). El checklist pasa a ser para EDITAR ese default en los casos en que no
// cursa todas las asignaturas, no para elegir desde cero cada vez.
const resolverMateriaIds = async (materiaIds, curso, estudianteId) => {
    const ids = [].concat(materiaIds || []).filter(Boolean);
    if (ids.length > 0) return ids;
    const aprobadasSet = await obtenerAprobadasSet(estudianteId);
    const precargadas = await materiasPrecargadas(curso, aprobadasSet);
    return precargadas.map((a) => a._id);
};

const getMateriasSugeridas = async (req, res) => {
    const institucion = await institucionRepo.obtenerPorClave(req.params.institucionClave);
    if (!institucion) return res.status(404).json({ error: 'Institución no encontrada' });

    const curso = await cursoRepo.obtenerPorClave(institucion._id, req.params.cursoClave);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

    const { estudianteId } = req.query;
    const orientacionId = curso.orientacionId ? curso.orientacionId._id : null;
    const aprobadasSet = await obtenerAprobadasSet(estudianteId);

    const precargadas = await materiasPrecargadas(curso, aprobadasSet);

    let atrasadas = [];
    if (estudianteId && curso.anioId.grado != null) {
        const aniosAnteriores = await Anio.find({ grado: { $lt: curso.anioId.grado } });
        const listas = await Promise.all(
            aniosAnteriores.map((anio) => materiasDelAnio(anio, orientacionId))
        );
        atrasadas = listas.flat().filter((a) => !aprobadasSet.has(String(a._id)));
    }

    res.json({
        precargadas: precargadas.map(formatearAsignatura),
        atrasadas: atrasadas.map(formatearAsignatura)
    });
};

const getEstudianteDetalle = async (req, res) => {
    const estudiante = await estudianteRepo.obtenerPorClave(req.params.clave);
    if (!estudiante) return res.redirect('/estudiantes');

    const [historial, cursadas, asignaturas, responsables] = await Promise.all([
        inscripcionRepo.obtenerHistorialPorEstudiante(estudiante._id),
        cursadaAsignaturaRepo.obtenerPorEstudiante(estudiante._id),
        Asignatura.find({}).populate('anioId').populate('orientacionId'),
        estudianteResponsableRepo.obtenerPorEstudiante(estudiante._id)
    ]);
    const vigente = historial.find((i) => !i.fechaBaja) || null;

    asignaturas.sort((a, b) => {
        const claveAnioA = a.anioId ? a.anioId.clave : '';
        const claveAnioB = b.anioId ? b.anioId.clave : '';
        return claveAnioA.localeCompare(claveAnioB) || a.nombre.localeCompare(b.nombre);
    });

    // Las materias cursadas ya no tienen un ciclo lectivo propio (CursadaAsignatura es
    // unica para siempre por estudiante+asignatura, ver el modelo) - se muestran aparte,
    // en orden de año/materia, sin agrupar por año.
    cursadas.sort((a, b) => {
        const claveAnioA = a.asignaturaId.anioId ? a.asignaturaId.anioId.clave : '';
        const claveAnioB = b.asignaturaId.anioId ? b.asignaturaId.anioId.clave : '';
        return claveAnioA.localeCompare(claveAnioB) || a.asignaturaId.nombre.localeCompare(b.asignaturaId.nombre);
    });
    const materiasEnCurso = cursadas.filter((c) => !c.aprobada);

    // La trayectoria agrupa las inscripciones por ciclo lectivo (eso si sigue siendo por
    // año - cada Inscripcion es a un curso concreto de un año concreto).
    const ciclosLectivosConDatos = [...new Set(historial.map((i) => i.cicloLectivo))].sort((a, b) => b - a);
    const trayectoria = ciclosLectivosConDatos.map((cicloLectivo) => ({
        cicloLectivo,
        inscripciones: historial.filter((i) => i.cicloLectivo === cicloLectivo)
    }));

    res.render('pages/estudianteDetalle', {
        estudiante, vigente, trayectoria, cursadas, materiasEnCurso, asignaturas, responsables
    });
};

// Edicion de los datos propios de la Persona de un estudiante (documento, nombre,
// nacimiento, domicilio, telefonos) - no toca Inscripcion/CursadaAsignatura/Estudiante,
// solo Persona. El chequeo de duplicados excluye a la propia persona (_id: { $ne: ... }),
// sino editar sin cambiar el documento se auto-marcaria como duplicado.
const postEditarEstudiante = async (req, res) => {
    const estudiante = await estudianteRepo.obtenerPorClave(req.params.clave);
    if (!estudiante) return res.redirect('/estudiantes');

    const datosPersona = construirDatosPersona(req.body);

    const condicionesDuplicado = [];
    if (datosPersona.numeroDocumento) condicionesDuplicado.push({ numeroDocumento: datosPersona.numeroDocumento });
    if (datosPersona.cuil) condicionesDuplicado.push({ cuil: datosPersona.cuil });
    const duplicado = condicionesDuplicado.length
        ? await Persona.findOne({ $or: condicionesDuplicado, _id: { $ne: estudiante.personaId._id } })
        : null;
    if (duplicado) {
        req.flash('error', 'Ya existe otra persona registrada con ese número de documento o CUIL.');
        return res.redirect(`/estudiantes/${req.params.clave}`);
    }

    await Persona.findByIdAndUpdate(estudiante.personaId._id, datosPersona, { runValidators: true });

    req.flash('success', 'Estudiante actualizado.');
    res.redirect(`/estudiantes/${datosPersona.numeroDocumento || estudiante.legajo}`);
};

// Baja REAL (borrado fisico) de un estudiante - a diferencia de todo el resto del sistema
// (Designacion/Inscripcion/Licencia usan baja logica con fecha, nunca se borra), esto es
// definitivo y a proposito solo para admin (ver requireAdmin en el router). Confirmacion
// doble: el form solo se puede enviar si el usuario tipeo la clave exacta del estudiante
// (ver /js/confirmarEliminacion.js), y aca se revalida server-side por si acaso. Borra en
// cascada todo lo que es propio de ESTA relacion (Inscripcion, CursadaAsignatura,
// EstudianteResponsable, la Persona) pero nunca lo del otro lado de una relacion (Curso,
// Asignatura, AdultoResponsable siguen existiendo - a un AdultoResponsable se le puede
// haber ido un hijo, pero puede tener otros).
const postEliminarEstudiante = async (req, res) => {
    const estudiante = await estudianteRepo.obtenerPorClave(req.params.clave);
    if (!estudiante) return res.redirect('/estudiantes');

    const claveConfirmacion = (req.body.claveConfirmacion || '').trim();
    if (claveConfirmacion !== req.params.clave) {
        req.flash('error', 'La clave ingresada no coincide con la del estudiante - no se eliminó nada.');
        return res.redirect(`/estudiantes/${req.params.clave}`);
    }

    const nombreCompleto = `${estudiante.personaId.apellido}, ${estudiante.personaId.nombre}`;
    const personaId = estudiante.personaId._id;

    await Promise.all([
        cursadaAsignaturaRepo.eliminarPorEstudiante(estudiante._id),
        inscripcionRepo.eliminarPorEstudiante(estudiante._id),
        estudianteResponsableRepo.eliminarPorEstudiante(estudiante._id)
    ]);
    await estudianteRepo.eliminar(estudiante._id);
    await Persona.findByIdAndDelete(personaId);

    await auditoriaRepo.registrar({
        accion: 'eliminar_estudiante',
        descripcion: `${nombreCompleto} (clave ${req.params.clave})`,
        hechoPor: hechoPor(req)
    });

    req.flash('success', `${nombreCompleto} eliminado definitivamente, junto con sus inscripciones, materias cursadas y vínculos con personas responsables.`);
    res.redirect('/estudiantes');
};

const postBajaInscripcion = async (req, res) => {
    const { fechaBaja, motivoBaja } = req.body;
    await inscripcionRepo.darDeBaja(req.params.inscripcionId, {
        fecha: new Date(fechaBaja),
        motivo: motivoBaja
    });
    req.flash('success', 'Baja registrada.');
    res.redirect(`/estudiantes/${req.params.clave}`);
};

const postCursada = async (req, res) => {
    const estudiante = await estudianteRepo.obtenerPorClave(req.params.clave);
    if (!estudiante) return res.redirect('/estudiantes');

    const { asignaturaId } = req.body;

    const duplicado = await cursadaAsignaturaRepo.buscarDuplicado(estudiante._id, asignaturaId);
    if (duplicado) {
        req.flash('error', 'Ese estudiante ya tiene esa materia cargada.');
        return res.redirect(`/estudiantes/${req.params.clave}`);
    }

    await cursadaAsignaturaRepo.crear({ estudianteId: estudiante._id, asignaturaId });
    req.flash('success', 'Materia agregada.');
    res.redirect(`/estudiantes/${req.params.clave}`);
};

const postAprobarCursada = async (req, res) => {
    const { fechaAprobacion, notaFinal } = req.body;
    await cursadaAsignaturaRepo.marcarAprobada(req.params.cursadaId, {
        fechaAprobacion: new Date(fechaAprobacion),
        notaFinal: Number(notaFinal)
    });
    req.flash('success', 'Materia marcada como aprobada.');
    res.redirect(`/estudiantes/${req.params.clave}`);
};

// Si ya hay un AdultoResponsable con ese numero de documento (ej. un hermano ya lo cargo
// antes), se reusa en vez de duplicarlo - solo se crea uno nuevo si no tiene numero
// (CPI/extranjero sin dato/indocumentado) o si no existia todavia.
const postResponsable = async (req, res) => {
    const estudiante = await estudianteRepo.obtenerPorClave(req.params.clave);
    if (!estudiante) return res.redirect('/estudiantes');

    const { apellido, nombre, nacionalidad, correoElectronico, vinculo, convive } = req.body;
    const datosDocumento = construirDatosDocumento(req.body);

    let adulto = datosDocumento.numeroDocumento
        ? await adultoResponsableRepo.obtenerPorNumeroDocumento(datosDocumento.numeroDocumento)
        : null;
    if (!adulto) {
        adulto = await adultoResponsableRepo.crear({
            ...datosDocumento,
            apellido,
            nombre,
            nacionalidad: nacionalidad || undefined,
            correoElectronico: correoElectronico || undefined,
            domicilio: construirDomicilio(req.body),
            telefonos: construirTelefonos(req.body)
        });
    }

    const duplicado = await estudianteResponsableRepo.buscarDuplicado(estudiante._id, adulto._id);
    if (duplicado) {
        req.flash('error', 'Esa persona ya está cargada como responsable de este estudiante.');
        return res.redirect(`/estudiantes/${req.params.clave}`);
    }

    await estudianteResponsableRepo.crear({
        estudianteId: estudiante._id,
        adultoResponsableId: adulto._id,
        vinculo,
        convive: convive === 'si'
    });

    req.flash('success', 'Persona responsable agregada.');
    res.redirect(`/estudiantes/${req.params.clave}`);
};

const postQuitarResponsable = async (req, res) => {
    await estudianteResponsableRepo.eliminar(req.params.estudianteResponsableId);
    req.flash('success', 'Vínculo quitado.');
    res.redirect(`/estudiantes/${req.params.clave}`);
};

module.exports = {
    getEstudiantes, postEstudiante, getEstudianteDetalle, postBajaInscripcion,
    postCursada, postAprobarCursada, getMateriasSugeridas, ciclosLectivosDisponibles,
    construirDatosPersona, postResponsable, postQuitarResponsable, buscarDuplicadoIndocumentado,
    getVerificarDocumento, postEditarEstudiante, resolverMateriaIds, postEliminarEstudiante,
    crearEstudianteEnCurso, inscribirExistenteEnCurso, calcularEstudiantesDisponibles
};
