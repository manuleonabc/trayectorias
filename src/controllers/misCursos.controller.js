const cargoRepo = require('../repos/cargo.repo');
const cursoRepo = require('../repos/curso.repo');
const cargoCursoRepo = require('../repos/cargoCurso.repo');
const inscripcionRepo = require('../repos/inscripcion.repo');
const estudianteRepo = require('../repos/estudiante.repo');
const designacionRepo = require('../repos/designacion.repo');
const {
    ciclosLectivosDisponibles, crearEstudianteEnCurso, inscribirExistenteEnCurso, calcularEstudiantesDisponibles
} = require('./estudiante.controller');
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

    res.render('pages/misCursos', { cargo, cursos, anioActual: anioActual() });
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

    const [inscripcionesVigentes, todosLosEstudiantes, siguienteNumeroRegistro] = await Promise.all([
        inscripcionRepo.obtenerVigentesPorCurso(curso._id),
        estudianteRepo.obtenerTodos(),
        inscripcionRepo.obtenerSiguienteNumeroRegistro(cargo.institucionId._id)
    ]);

    // "anioActualInscripcion" para no chocar con la funcion anioActual() de mas arriba
    // (año lectivo de CargoCurso, un concepto distinto).
    const { estudiantesLibres, estudiantesEnOtroCurso, anioActual: anioActualInscripcion } =
        await calcularEstudiantesDisponibles(inscripcionesVigentes, todosLosEstudiantes);

    res.render('pages/misCursoDetalle', {
        curso, inscripcionesVigentes, estudiantesLibres, estudiantesEnOtroCurso, anioActual: anioActualInscripcion,
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

const postInscribirExistente = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) return res.redirect('/estudiantes');
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) return res.redirect('/mis-cursos');

    const resultado = await inscribirExistenteEnCurso(curso, req.body);
    if (resultado.error) {
        req.flash('error', resultado.error);
        return res.redirect(`/mis-cursos/${curso.clave}`);
    }
    req.flash('success', 'Estudiante inscripto.');
    res.redirect(`/mis-cursos/${curso.clave}`);
};

module.exports = {
    getMisCursos, getMisCursoDetalle, getAsignaturasDocentes, postEstudianteNuevo, postInscribirExistente,
    // Reusados por valoracion.controller.js (carga "por curso") - mismo guard exacto de
    // que curso puede ver/tocar un cargo con nivelAcceso 'total'/'preceptor'.
    resolverCargoActivo, resolverCursoPermitido
};
