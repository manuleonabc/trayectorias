const cargoRepo = require('../repos/cargo.repo');
const cursoRepo = require('../repos/curso.repo');
const cargoCursoRepo = require('../repos/cargoCurso.repo');
const inscripcionRepo = require('../repos/inscripcion.repo');
const designacionRepo = require('../repos/designacion.repo');
const solicitudReubicacionRepo = require('../repos/solicitudReubicacion.repo');
const { ciclosLectivosDisponibles, crearEstudianteEnCurso } = require('./estudiante.controller');
const fechaHoy = require('../utils/fechaHoy');

// "Mis cursos" - para nivelAcceso 'total' (jerarquicos/EMATP, ven todos los cursos de su
// institucion) y 'preceptor' (solo los que tiene designados via CargoCurso, ver Rol.js).
// Guard de toda esta seccion: sin cargo activo, o con un Rol de otro nivelAcceso, no entra.
const resolverCargoActivo = async (req) => {
    if (!req.session.cargoActivoId) return null;
    const cargo = await cargoRepo.obtenerPorId(req.session.cargoActivoId);
    if (!cargo || !cargo.rolId) return null;
    if (!['total', 'preceptor'].includes(cargo.rolId.nivelAcceso)) return null;
    return cargo;
};

const anioActual = () => new Date().getFullYear();

const getMisCursos = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.redirect('/estudiantes');

    let cursos;
    if (cargo.rolId.nivelAcceso === 'total') {
        cursos = await cursoRepo.obtenerPorInstitucion(cargo.institucionId._id);
    } else {
        // cargoCursoRepo solo populea cursoId "plano" (le alcanza a cargoDetalle.ejs, que
        // solo pide curso.clave) - aca hace falta anioId/turnoId/orientacionId tambien, asi
        // que se re-resuelve cada curso con el populate completo de cursoRepo.
        const cargoCursos = await cargoCursoRepo.obtenerPorCargo(cargo._id);
        const clavesCursos = cargoCursos
            .filter((cc) => cc.anioLectivo === anioActual())
            .map((cc) => cc.cursoId._id);
        cursos = await Promise.all(clavesCursos.map((cursoId) => cursoRepo.obtenerPorId(cursoId)));
    }

    // Reubicaciones esperando confirmacion de cada curso (ver reubicacion.controller.js) -
    // badge en el listado, para que no haga falta entrar curso por curso a buscarlas.
    const pendientesPorCurso = await solicitudReubicacionRepo.contarPendientesPorCurso(cursos.map((c) => c._id));

    res.render('pages/misCursos', { cargo, cursos, pendientesPorCurso, anioActual: anioActual() });
};

// Resuelve un curso solo si esta dentro de lo que puede ver el cargo activo (mismo
// criterio que getMisCursos) - nunca confia en que la clave de la URL alcance por si sola,
// sino un preceptor podria escribir la clave de un curso ajeno a mano.
const resolverCursoPermitido = async (req, cargo) => {
    const curso = await cursoRepo.obtenerPorClave(cargo.institucionId._id, req.params.cursoClave);
    if (!curso) return null;
    if (cargo.rolId.nivelAcceso === 'total') return curso;

    const designado = await cargoCursoRepo.buscarDuplicado(cargo._id, curso._id, anioActual());
    return designado ? curso : null;
};

const getMisCursoDetalle = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.redirect('/estudiantes');

    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.redirect('/mis-cursos');

    const [inscripcionesVigentes, siguienteNumeroRegistro, pendientesPorCurso] = await Promise.all([
        inscripcionRepo.obtenerVigentesPorCurso(curso._id),
        inscripcionRepo.obtenerSiguienteNumeroRegistro(cargo.institucionId._id),
        solicitudReubicacionRepo.contarPendientesPorCurso([curso._id])
    ]);

    res.render('pages/misCursoDetalle', {
        curso, inscripcionesVigentes, reubicacionesPendientes: pendientesPorCurso.get(String(curso._id)) || 0,
        ciclosLectivos: ciclosLectivosDisponibles(), fechaHoy: fechaHoy(), siguienteNumeroRegistro
    });
};

// AJAX (ver /js/asignaturasDocentes.js) - lista de asignaturas del curso con quien esta
// designado hoy en cada una, para la seccion "Asignaturas y docentes" al final de
// misCursoDetalle.ejs. Solo lectura, siempre JSON, nunca redirige/flashea.
const getAsignaturasDocentes = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.status(403).json({ error: 'No autorizado.' });
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.status(404).json({ error: 'Curso no encontrado.' });

    const cargosDelCurso = await cargoRepo.obtenerPorCurso(curso._id);
    const asignaturas = await Promise.all(cargosDelCurso.map(async (cargoAsignatura) => {
        const { base, suplentesVigentes } = await designacionRepo.obtenerCadenaPorCargo(cargoAsignatura._id);
        const suplente = suplentesVigentes.length ? suplentesVigentes[suplentesVigentes.length - 1] : null;
        return {
            cargoId: cargoAsignatura._id,
            asignatura: cargoAsignatura.asignaturaId ? cargoAsignatura.asignaturaId.nombre : '—',
            cargaHoraria: cargoAsignatura.asignaturaId ? cargoAsignatura.asignaturaId.cargaHoraria : null,
            titular: base ? {
                nombre: base.personaId.nombre, apellido: base.personaId.apellido, situacionRevista: base.situacionRevista
            } : null,
            suplente: suplente ? { nombre: suplente.personaId.nombre, apellido: suplente.personaId.apellido } : null
        };
    }));

    res.json({ asignaturas });
};

const postEstudianteNuevo = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.redirect('/estudiantes');
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.redirect('/mis-cursos');

    const resultado = await crearEstudianteEnCurso(curso, req.body);
    if (resultado.error) {
        req.flash('error', resultado.error);
        return res.redirect(`/mis-cursos/${curso.clave}`);
    }
    if (resultado.warning) req.flash('warning', resultado.warning);
    req.flash('success', 'Estudiante agregado.');
    res.redirect(`/mis-cursos/${curso.clave}`);
};

// Vista de edicion de la lista de inscriptos (desvincular, reubicar, reordenar) - separada
// de misCursoDetalle a proposito (pedido explicito), solo las acciones sobre los ya
// inscriptos. "Reubicar" no mueve directo: crea una solicitud que confirma el curso de
// destino (ver reubicacion.controller.js::postSolicitarEnviar). Mismo guard que el
// resto de la seccion (resolverCargoActivo + resolverCursoPermitido) - quien puede ver esta
// pantalla es exactamente quien puede editarla, no hace falta un chequeo aparte.
const getMisCursoEditar = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.redirect('/estudiantes');
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.redirect('/mis-cursos');

    const [inscripcionesVigentes, cursosDeLaInstitucion] = await Promise.all([
        inscripcionRepo.obtenerVigentesPorCurso(curso._id),
        cursoRepo.obtenerPorInstitucion(cargo.institucionId._id)
    ]);
    const otrosCursos = cursosDeLaInstitucion.filter((c) => String(c._id) !== String(curso._id));

    res.render('pages/misCursoEditar', {
        curso, inscripcionesVigentes, otrosCursos, fechaHoy: fechaHoy()
    });
};

// Confirma que la inscripcion sobre la que se quiere actuar sea realmente de ESTE curso -
// nunca confiar en que el :inscripcionId de la URL alcance solo, sino un preceptor podria
// mandar a mano el id de una inscripcion de otro curso ajeno.
const resolverInscripcionDelCurso = async (curso, inscripcionId) => {
    const inscripcion = await inscripcionRepo.obtenerPorId(inscripcionId);
    if (!inscripcion || String(inscripcion.cursoId) !== String(curso._id)) return null;
    return inscripcion;
};

const postDesvincularEstudiante = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.redirect('/estudiantes');
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.redirect('/mis-cursos');

    const inscripcion = await resolverInscripcionDelCurso(curso, req.params.inscripcionId);
    if (!inscripcion) {
        req.flash('error', 'Esa inscripción no pertenece a este curso.');
        return res.redirect(`/mis-cursos/${curso.clave}/editar`);
    }

    const { fechaBaja, motivoBaja } = req.body;
    await inscripcionRepo.darDeBaja(inscripcion._id, { fecha: new Date(fechaBaja), motivo: motivoBaja });
    req.flash('success', 'Estudiante desvinculado del curso.');
    res.redirect(`/mis-cursos/${curso.clave}/editar`);
};

// Formatea las dos inscripciones afectadas por un intercambio de N° de registro para la
// respuesta AJAX (ver public/js/misCursoEditarOrden.js) - siempre en el orden
// [actual (la que se clickeo), vecino], nunca el documento entero (alcanza con lo que el
// cliente necesita para actualizar las dos filas).
const formatearIntercambio = ([actual, vecino]) => [
    { inscripcionId: String(actual._id), numeroRegistro: actual.numeroRegistro || '' },
    { inscripcionId: String(vecino._id), numeroRegistro: vecino.numeroRegistro || '' }
];

// Subir/bajar en la vista de edicion son la unica excepcion de escritura por AJAX de esta
// seccion (pedido explicito del usuario, para no refrescar toda la pagina en cada click) -
// responden siempre JSON, nunca redirigen/flashean. Mismo guard que el resto (cargo activo
// + curso permitido + la inscripcion tiene que ser de ESTE curso).
const postSubirRegistro = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.status(403).json({ ok: false, error: 'No autorizado.' });
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.status(404).json({ ok: false, error: 'Curso no encontrado.' });

    const inscripcion = await resolverInscripcionDelCurso(curso, req.params.inscripcionId);
    if (!inscripcion) return res.status(404).json({ ok: false, error: 'Esa inscripción no pertenece a este curso.' });

    const resultado = await inscripcionRepo.subirRegistro(curso._id, inscripcion._id);
    if (!resultado) return res.json({ ok: true, cambio: false });
    res.json({ ok: true, cambio: true, actualizadas: formatearIntercambio(resultado) });
};

const postBajarRegistro = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.status(403).json({ ok: false, error: 'No autorizado.' });
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.status(404).json({ ok: false, error: 'Curso no encontrado.' });

    const inscripcion = await resolverInscripcionDelCurso(curso, req.params.inscripcionId);
    if (!inscripcion) return res.status(404).json({ ok: false, error: 'Esa inscripción no pertenece a este curso.' });

    const resultado = await inscripcionRepo.bajarRegistro(curso._id, inscripcion._id);
    if (!resultado) return res.json({ ok: true, cambio: false });
    res.json({ ok: true, cambio: true, actualizadas: formatearIntercambio(resultado) });
};

module.exports = {
    getMisCursos, getMisCursoDetalle, getAsignaturasDocentes, postEstudianteNuevo,
    getMisCursoEditar, postDesvincularEstudiante, postSubirRegistro, postBajarRegistro,
    // Reusados por valoracion.controller.js (carga "por curso") - mismo guard exacto de
    // que curso puede ver/tocar un cargo con nivelAcceso 'total'/'preceptor'.
    resolverCargoActivo, resolverCursoPermitido
};
