const cursoRepo = require('../../repos/curso.repo');
const institucionRepo = require('../../repos/institucion.repo');
const cargoRepo = require('../../repos/cargo.repo');
const asignaturaRepo = require('../../repos/asignatura.repo');
const anioRepo = require('../../repos/anio.repo');
const turnoRepo = require('../../repos/turno.repo');
const rolRepo = require('../../repos/rol.repo');
const estudianteRepo = require('../../repos/estudiante.repo');
const inscripcionRepo = require('../../repos/inscripcion.repo');
const designacionRepo = require('../../repos/designacion.repo');
const licenciaRepo = require('../../repos/licencia.repo');
const cargoCursoRepo = require('../../repos/cargoCurso.repo');
const auditoriaRepo = require('../../repos/auditoria.repo');
const {
    ciclosLectivosDisponibles, crearEstudianteEnCurso, inscribirExistenteEnCurso, calcularEstudiantesDisponibles
} = require('../../controllers/estudiante.controller');
const Orientacion = require('../../models/Orientacion');
const hechoPor = require('../../utils/hechoPor');
const fechaHoy = require('../../utils/fechaHoy');

// Convencion ya usada en el catalogo Rol: Profesor tiene jerarquia 100 (ver Rol.js). Se
// busca primero por esto (compatibilidad con instituciones que ya lo tienen asi), y si no
// hay ningun Rol con esa jerarquia exacta, se cae a buscar por nivelAcceso === 'profesor'
// (editable desde /admin/roles) - jerarquia es un numero libre que el admin puede haber
// puesto distinto de 100 sin darse cuenta de que rompia la generacion automatica de
// cargos al crear un curso.
const JERARQUIA_PROFESOR = 100;

const getCursos = async (req, res) => {
    const [institucion, cursos, anios, turnos, orientaciones] = await Promise.all([
        institucionRepo.obtenerPorId(req.session.institucionActivaId),
        cursoRepo.obtenerPorInstitucion(req.session.institucionActivaId),
        anioRepo.obtenerTodos(),
        turnoRepo.obtenerPorInstitucion(req.session.institucionActivaId),
        Orientacion.find({}).sort({ nombre: 1 })
    ]);

    const cantidadesCargos = await Promise.all(cursos.map((curso) => cargoRepo.contarPorCurso(curso._id)));
    const cursosConCantidad = cursos.map((curso, i) => ({ curso, cantidadCargos: cantidadesCargos[i] }));

    res.render('pages/admin/cursos', { institucion, cursosConCantidad, anios, turnos, orientaciones });
};

const postCurso = async (req, res) => {
    const institucionId = req.session.institucionActivaId;
    const { anioId, division, turnoId, orientacionId, clave } = req.body;

    const anio = await anioRepo.obtenerPorId(anioId);
    if (!anio) {
        req.flash('error', 'Año inválido.');
        return res.redirect('/admin/cursos');
    }
    if (anio.ciclo === 'superior' && !orientacionId) {
        req.flash('error', 'Este año es de ciclo superior: hay que elegir una orientación.');
        return res.redirect('/admin/cursos');
    }
    // El ciclo basico no se ramifica por orientacion (mismo criterio que Asignatura).
    const orientacionIdFinal = anio.ciclo === 'superior' ? orientacionId : null;

    const duplicado = await cursoRepo.buscarDuplicado(institucionId, { anioId, division, clave });
    if (duplicado) {
        req.flash('error', 'Ya existe un curso con ese año y división, o con esa clave, en esta institución.');
        return res.redirect('/admin/cursos');
    }

    const curso = await cursoRepo.crear({ institucionId, anioId, division, turnoId, orientacionId: orientacionIdFinal, clave });

    const rolProfesor = await rolRepo.obtenerPorJerarquia(JERARQUIA_PROFESOR) || await rolRepo.obtenerPorNivelAcceso('profesor');
    if (!rolProfesor) {
        req.flash('warning', 'Curso creado, pero no se generó ningún cargo: no encontré un Rol de Profesor. En /admin/roles, editá el rol correspondiente y ponele jerarquía 100 o nivel de acceso "Profesor".');
        return res.redirect('/admin/cursos');
    }

    const asignaturas = orientacionIdFinal
        ? await asignaturaRepo.obtenerPorAnioYOrientacion(anioId, orientacionIdFinal)
        : await asignaturaRepo.obtenerPlantilla(anioId);

    if (asignaturas.length === 0) {
        req.flash('warning', 'Curso creado, pero todavía no hay materias cargadas para este año/orientación en /admin/anios - no se generó ningún cargo.');
        return res.redirect('/admin/cursos');
    }

    try {
        await cargoRepo.generarParaCurso(curso, asignaturas, rolProfesor);
        req.flash('success', `Curso creado, con ${asignaturas.length} cargo(s) de profesor generados.`);
    } catch (error) {
        // No deberia pasar en uso normal (asignatura.clave-curso.clave ya es unica dentro
        // de la institucion porque Asignatura y Curso ya lo son cada uno por su lado), pero
        // el indice unico institucionId+clave de Cargo.js es la ultima palabra - si algo
        // raro lo viola, que se vea como flash prolijo y no como error sin capturar.
        req.flash('warning', `Curso creado, pero no se pudieron generar los cargos de profesor: ya existe un cargo con esa clave en esta institución (${error.message}).`);
    }
    res.redirect('/admin/cursos');
};

// Resuelve institucion+curso desde los dos segmentos de clave de la URL anidada
// (/admin/instituciones/:institucionClave/cursos/:cursoClave).
const resolverCurso = async (req) => {
    const institucion = await institucionRepo.obtenerPorClave(req.params.institucionClave);
    if (!institucion) return null;
    return await cursoRepo.obtenerPorClave(institucion._id, req.params.cursoClave);
};

const urlCurso = (req) => `/admin/instituciones/${req.params.institucionClave}/cursos/${req.params.cursoClave}`;

const getCursoDetalle = async (req, res) => {
    const curso = await resolverCurso(req);
    if (!curso) return res.redirect('/admin/cursos');

    const [inscripcionesVigentes, todosLosEstudiantes, cargosDelCurso, siguienteNumeroRegistro] = await Promise.all([
        inscripcionRepo.obtenerVigentesPorCurso(curso._id),
        estudianteRepo.obtenerTodos(),
        cargoRepo.obtenerPorCurso(curso._id),
        inscripcionRepo.obtenerSiguienteNumeroRegistro(curso.institucionId._id)
    ]);

    // Para "inscribir existente": separados en libres (se anotan directo) y en-otro-curso-
    // este-año (hay que avisar donde estan y pedir el resto de los datos) - ver
    // calcularEstudiantesDisponibles.
    const { estudiantesLibres, estudiantesEnOtroCurso, anioActual } =
        await calcularEstudiantesDisponibles(inscripcionesVigentes, todosLosEstudiantes);

    // Quien esta designado hoy en cada cargo de profesor de este curso (o nadie, vacante).
    const activas = await Promise.all(cargosDelCurso.map((cargo) => designacionRepo.obtenerActivaPorCargo(cargo._id)));
    const cargosConActiva = cargosDelCurso.map((cargo, i) => ({ cargo, activa: activas[i] }));

    res.render('pages/admin/cursoDetalle', {
        curso, inscripcionesVigentes, estudiantesLibres, estudiantesEnOtroCurso, anioActual, cargosConActiva,
        ciclosLectivos: ciclosLectivosDisponibles(), fechaHoy: fechaHoy(), siguienteNumeroRegistro
    });
};

// Edicion acotada a proposito: division, turno y clave (ver cursoRepo.actualizar) - anioId/
// orientacionId no se pueden tocar aca, dejarian desincronizados los cargos de profesor ya
// generados (dependen del plan de estudio de ese año+orientacion original).
const getEditarCurso = async (req, res) => {
    const curso = await resolverCurso(req);
    if (!curso) return res.redirect('/admin/cursos');

    const turnos = await turnoRepo.obtenerPorInstitucion(curso.institucionId._id);
    res.render('pages/admin/cursoEditar', { curso, turnos });
};

const postEditarCurso = async (req, res) => {
    const curso = await resolverCurso(req);
    if (!curso) return res.redirect('/admin/cursos');

    const { division, turnoId, clave } = req.body;

    const duplicado = await cursoRepo.buscarDuplicado(
        curso.institucionId._id,
        { anioId: curso.anioId._id, division, clave },
        curso._id
    );
    if (duplicado) {
        req.flash('error', 'Ya existe otro curso con esa división o esa clave en esta institución.');
        return res.redirect(`${urlCurso(req)}/editar`);
    }

    await cursoRepo.actualizar(curso._id, { division, turnoId, clave });
    req.flash('success', 'Curso actualizado.');
    res.redirect(`/admin/instituciones/${req.params.institucionClave}/cursos/${clave}`);
};

// Baja real del Curso - bloqueada si alguna vez tuvo estudiantes inscriptos (vigente o
// historico, ver inscripcionRepo.existeAlgunaPorCurso), para no perder ese tramo de la
// trayectoria de nadie. Si esta vacio, cascadea: Licencia -> Designacion -> Cargo (los de
// profesor generados para este curso, con su historial completo) -> CargoCurso (vinculos
// de preceptor con este curso, nunca el Cargo de preceptor en si) -> el Curso.
const postEliminarCurso = async (req, res) => {
    const curso = await resolverCurso(req);
    if (!curso) return res.redirect('/admin/cursos');

    const tieneInscripciones = await inscripcionRepo.existeAlgunaPorCurso(curso._id);
    if (tieneInscripciones) {
        req.flash('error', 'Este curso tiene estudiantes inscriptos (actuales o históricos) - no se puede eliminar. Pasalos a otro curso primero.');
        return res.redirect(urlCurso(req));
    }

    const cargoIds = await cargoRepo.obtenerIdsPorCurso(curso._id);
    const designacionIds = await designacionRepo.obtenerIdsPorCargos(cargoIds);
    await licenciaRepo.eliminarPorDesignaciones(designacionIds);
    await designacionRepo.eliminarPorCargos(cargoIds);
    await cargoRepo.eliminarPorCurso(curso._id);
    await cargoCursoRepo.eliminarPorCurso(curso._id);
    await cursoRepo.eliminar(curso._id);

    await auditoriaRepo.registrar({
        accion: 'eliminar_curso',
        descripcion: `${curso.clave} (${curso.institucionId.nombre})`,
        hechoPor: hechoPor(req)
    });

    req.flash('success', 'Curso eliminado, junto con sus cargos de profesor.');
    res.redirect('/admin/cursos');
};

// Alta de un estudiante nuevo, con el curso ya fijo (viene de la URL, no se re-elige).
const postEstudianteNuevo = async (req, res) => {
    const curso = await resolverCurso(req);
    if (!curso) return res.redirect('/admin/cursos');

    const resultado = await crearEstudianteEnCurso(curso, req.body);
    if (resultado.error) {
        req.flash('error', resultado.error);
        return res.redirect(urlCurso(req));
    }
    if (resultado.warning) req.flash('warning', resultado.warning);
    req.flash('success', 'Estudiante agregado.');
    res.redirect(urlCurso(req));
};

// Mueve a un estudiante que ya existe a este curso - cierra su inscripcion vigente
// (a este mismo curso u otro, incluso de otra institucion) y abre una nueva aca.
const postInscribirExistente = async (req, res) => {
    const curso = await resolverCurso(req);
    if (!curso) return res.redirect('/admin/cursos');

    const resultado = await inscribirExistenteEnCurso(curso, req.body);
    if (resultado.error) {
        req.flash('error', resultado.error);
        return res.redirect(urlCurso(req));
    }
    req.flash('success', 'Estudiante inscripto.');
    res.redirect(urlCurso(req));
};

module.exports = {
    getCursos, postCurso, getCursoDetalle, getEditarCurso, postEditarCurso, postEliminarCurso,
    postEstudianteNuevo, postInscribirExistente
};
