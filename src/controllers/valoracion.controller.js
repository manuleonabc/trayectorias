const cargoRepo = require('../repos/cargo.repo');
const cargoCursoRepo = require('../repos/cargoCurso.repo');
const inscripcionRepo = require('../repos/inscripcion.repo');
const cursadaAsignaturaRepo = require('../repos/cursadaAsignatura.repo');
const valoracionRepo = require('../repos/valoracion.repo');
const CursadaAsignatura = require('../models/CursadaAsignatura');
const hechoPor = require('../utils/hechoPor');
const { ciclosLectivosDisponibles } = require('./estudiante.controller');
const { resolverCargoActivo, resolverCursoPermitido } = require('./misCursos.controller');

// Los 6 periodos posibles (ver Valoracion.js) y que campos pide cada uno en el form - asi
// la vista no repite la logica de "que mostrar segun el periodo elegido".
const PERIODOS = [
    { clave: 'informe1C', etiqueta: 'Informe 1er cuatrimestre (mayo)' },
    { clave: 'nota1C', etiqueta: 'Nota 1er cuatrimestre' },
    { clave: 'informe2C', etiqueta: 'Informe 2do cuatrimestre (octubre)' },
    { clave: 'nota2C', etiqueta: 'Nota 2do cuatrimestre' },
    { clave: 'diciembre', etiqueta: 'Intensificación diciembre' },
    { clave: 'febrero', etiqueta: 'Intensificación febrero/marzo (cierre de ciclo)' }
];

const CONFIG_PERIODO = {
    informe1C: { valoraciones: ['TEA', 'TEP', 'TED'], nota: false, observacion: true, recupero: false },
    nota1C: { valoraciones: null, nota: true, notaMin: 1, notaMax: 10, observacion: false, recupero: false },
    informe2C: { valoraciones: ['TEA', 'TEP', 'TED'], nota: false, observacion: true, recupero: false },
    nota2C: { valoraciones: null, nota: true, notaMin: 1, notaMax: 10, observacion: false, recupero: true },
    diciembre: { valoraciones: ['AA', 'CCA', 'CSA'], nota: true, notaMin: 4, notaMax: 10, observacion: true, recupero: false },
    febrero: { valoraciones: ['AA', 'CCA', 'CSA'], nota: true, notaMin: 4, notaMax: 10, observacion: true, recupero: false }
};

const anioActual = () => new Date().getFullYear();

// Resuelve que Cargo se va a cargar y si quien esta cargando puede escribir observacion -
// unico guard de toda la seccion, usado tanto por GET (cargoObjetivoId = req.params.cargoId)
// como por POST (cargoObjetivoId = req.body.cargoId). Dos caminos:
//   - "Propio": sin cargoObjetivoId, o coincide con el cargo activo de la sesion - solo
//     valido si ese cargo es de un profesor (nivelAcceso 'profesor') sobre su propia
//     asignatura+curso. Con observacion (solo el profesor la carga, ver Valoracion.js).
//   - "Ajeno": cargoObjetivoId de OTRO cargo - solo valido si el cargo activo tiene
//     nivelAcceso 'total' (cualquier curso de su institucion) o 'preceptor' (solo los
//     cursos que tiene designados este año lectivo via CargoCurso). Sin observacion.
const resolverContexto = async (req, cargoObjetivoId) => {
    if (!req.session.cargoActivoId) return null;
    const cargoActivo = await cargoRepo.obtenerPorId(req.session.cargoActivoId);
    if (!cargoActivo || !cargoActivo.rolId) return null;

    if (!cargoObjetivoId || String(cargoObjetivoId) === String(cargoActivo._id)) {
        if (cargoActivo.rolId.nivelAcceso !== 'profesor') return null;
        if (!cargoActivo.asignaturaId || !cargoActivo.cursoId) return null;
        return { cargo: cargoActivo, puedeObservacion: true, esPropio: true };
    }

    if (!['total', 'preceptor'].includes(cargoActivo.rolId.nivelAcceso)) return null;
    const cargoObjetivo = await cargoRepo.obtenerPorId(cargoObjetivoId);
    if (!cargoObjetivo || !cargoObjetivo.asignaturaId || !cargoObjetivo.cursoId) return null;

    if (cargoActivo.rolId.nivelAcceso === 'total') {
        if (String(cargoObjetivo.institucionId._id) !== String(cargoActivo.institucionId._id)) return null;
    } else {
        const designado = await cargoCursoRepo.buscarDuplicado(cargoActivo._id, cargoObjetivo.cursoId._id, anioActual());
        if (!designado) return null;
    }
    return { cargo: cargoObjetivo, puedeObservacion: false, esPropio: false };
};

const resolverPeriodo = (valor) => (PERIODOS.some((p) => p.clave === valor) ? valor : 'informe1C');

const getPorAsignatura = async (req, res) => {
    const contexto = await resolverContexto(req, req.params.cargoId);
    if (!contexto) return res.redirect('/estudiantes');
    const { cargo, puedeObservacion, esPropio } = contexto;

    const cicloLectivo = Number(req.query.cicloLectivo) || anioActual();
    const periodo = resolverPeriodo(req.query.periodo);
    const configBase = CONFIG_PERIODO[periodo];
    const config = { ...configBase, observacion: configBase.observacion && puedeObservacion };

    const inscripcionesVigentes = await inscripcionRepo.obtenerVigentesPorCurso(cargo.cursoId._id);

    // Para cada estudiante del curso, su CursadaAsignatura de ESTA materia (se crea sola
    // si todavia no existia - ej. un estudiante transferido despues de que ya se generaron
    // las cursadas por defecto al matricularlo) y la Valoracion de este periodo, si ya
    // habia una cargada (para mostrarla precargada en el form, no partir de cero cada vez).
    const filas = await Promise.all(inscripcionesVigentes.map(async (inscripcion) => {
        const estudiante = inscripcion.estudianteId;
        let cursada = await cursadaAsignaturaRepo.buscarDuplicado(estudiante._id, cargo.asignaturaId._id);
        if (!cursada) {
            cursada = await cursadaAsignaturaRepo.crear({ estudianteId: estudiante._id, asignaturaId: cargo.asignaturaId._id });
        }
        const valoracion = await valoracionRepo.obtenerUna(cursada._id, cicloLectivo, periodo);
        return { estudiante, cursada, valoracion };
    }));

    filas.sort((a, b) => a.estudiante.personaId.apellido.localeCompare(b.estudiante.personaId.apellido, 'es')
        || a.estudiante.personaId.nombre.localeCompare(b.estudiante.personaId.nombre, 'es'));

    // basePath: a donde apuntan el form de ciclo/periodo y el autoguardado - propio queda
    // en /valoraciones/asignatura, ajeno lleva el cargoId objetivo en la URL.
    const basePath = esPropio ? '/valoraciones/asignatura' : `/valoraciones/asignatura/${cargo._id}`;
    const volverA = esPropio ? null : `/mis-cursos/${cargo.cursoId.clave}`;

    res.render('pages/valoracionesAsignatura', {
        cargo, filas, cicloLectivo, periodo, periodos: PERIODOS, config,
        ciclosLectivos: ciclosLectivosDisponibles(), basePath, volverA
    });
};

// Matriz "por curso": todas las asignaturas x todos los estudiantes vigentes, para un
// periodo/ciclo elegido - para nivelAcceso 'total'/'preceptor' (mismo guard exacto que
// /mis-cursos, reusado de ahi - ver resolverCargoActivo/resolverCursoPermitido). Nunca
// tiene observacion (eso sigue siendo exclusivo del profesor cargando su propia materia
// desde /valoraciones/asignatura). Cada celda se guarda con el mismo
// POST /valoraciones/asignatura/fila de siempre (manda su propio cargoId, ver
// resolverContexto) - no hace falta un endpoint de guardado aparte.
const getPorCurso = async (req, res) => {
    const cargoActivo = await resolverCargoActivo(req);
    if (!cargoActivo) return res.redirect('/estudiantes');
    const curso = await resolverCursoPermitido(req, cargoActivo);
    if (!curso) return res.redirect('/mis-cursos');

    const cicloLectivo = Number(req.query.cicloLectivo) || anioActual();
    const periodo = resolverPeriodo(req.query.periodo);
    const configBase = CONFIG_PERIODO[periodo];
    const config = { ...configBase, observacion: false };

    const [cargosDelCurso, inscripcionesVigentes] = await Promise.all([
        cargoRepo.obtenerPorCurso(curso._id),
        inscripcionRepo.obtenerVigentesPorCurso(curso._id)
    ]);

    const estudiantes = inscripcionesVigentes.map((i) => i.estudianteId);
    const asignaturaIds = cargosDelCurso.map((c) => c.asignaturaId._id);
    const estudianteIds = estudiantes.map((e) => e._id);

    // Asegura que exista una CursadaAsignatura por cada estudiante x asignatura de este
    // curso (find-or-create, ver cursadaAsignaturaRepo.crearVarias) antes de armar la
    // matriz - un estudiante recien transferido puede no tenerlas todas todavia.
    await Promise.all(estudiantes.map((estudiante) => cursadaAsignaturaRepo.crearVarias(estudiante._id, asignaturaIds)));

    // Bulk fetch (2 consultas, no N*M) para armar la matriz en memoria.
    const cursadas = await cursadaAsignaturaRepo.obtenerPorEstudiantesYAsignaturas(estudianteIds, asignaturaIds);
    const cursadaPorPar = {};
    cursadas.forEach((c) => { cursadaPorPar[`${c.estudianteId}_${c.asignaturaId}`] = c; });

    const valoraciones = await valoracionRepo.obtenerPorCursadasYPeriodo(cursadas.map((c) => c._id), cicloLectivo, periodo);
    const valoracionPorCursada = {};
    valoraciones.forEach((v) => { valoracionPorCursada[v.cursadaAsignaturaId] = v; });

    const matriz = estudiantes.map((estudiante) => ({
        estudiante,
        celdas: cargosDelCurso.map((cargoAsignatura) => {
            const cursada = cursadaPorPar[`${estudiante._id}_${cargoAsignatura.asignaturaId._id}`];
            const valoracion = cursada ? valoracionPorCursada[cursada._id] : null;
            return { cargoId: cargoAsignatura._id, cursada, valoracion };
        })
    }));

    matriz.sort((a, b) => a.estudiante.personaId.apellido.localeCompare(b.estudiante.personaId.apellido, 'es')
        || a.estudiante.personaId.nombre.localeCompare(b.estudiante.personaId.nombre, 'es'));

    res.render('pages/valoracionesCurso', {
        curso, cargosDelCurso, matriz, cicloLectivo, periodo, periodos: PERIODOS, config,
        ciclosLectivos: ciclosLectivosDisponibles()
    });
};

// Autoguardado por fila (ver /js/valoracionesAutosave.js) - AJAX, unica excepcion de
// escritura del proyecto (todo el resto de los guardados van por POST+redirect+flash). Se
// manda la fila COMPLETA (no solo el campo que cambio) cada vez que se toca cualquier
// input de esa fila, porque una Valoracion es un solo documento por periodo con varios
// campos juntos - mandar solo el campo tocado pisaria los demas con undefined en el
// upsert. Devuelve JSON, nunca redirige ni flashea (lo consume el JS, no una navegacion).
const postGuardarFila = async (req, res) => {
    const { cargoId, cursadaAsignaturaId, cicloLectivo, periodo, valoracion, nota, recuperoSaberesC1, observacion } = req.body;

    const contexto = await resolverContexto(req, cargoId);
    if (!contexto) return res.status(403).json({ ok: false, error: 'No autorizado.' });
    const { cargo, puedeObservacion } = contexto;

    if (resolverPeriodo(periodo) !== periodo) {
        return res.status(400).json({ ok: false, error: 'Período inválido.' });
    }

    // No confiar en que el cursadaAsignaturaId que manda el cliente sea realmente de la
    // asignatura de este cargo - sin este chequeo, alguien podria mandar el id de la
    // cursada de OTRA materia (ajena) manipulando el pedido a mano.
    const cursada = await CursadaAsignatura.findById(cursadaAsignaturaId);
    if (!cursada || String(cursada.asignaturaId) !== String(cargo.asignaturaId._id)) {
        return res.status(403).json({ ok: false, error: 'No autorizado.' });
    }

    try {
        await valoracionRepo.guardar({
            cursadaAsignaturaId,
            cicloLectivo: Number(cicloLectivo),
            periodo,
            valoracion: valoracion || undefined,
            nota: nota ? Number(nota) : undefined,
            recuperoSaberesC1: !!recuperoSaberesC1,
            // Se ignora del lado del servidor si quien carga no tiene permiso de
            // observacion (preceptor/EMATP/jerarquicos) - aunque el campo ni deberia estar
            // visible en su pantalla, no se confia solo en eso.
            observacion: puedeObservacion ? (observacion || undefined) : undefined,
            hechoPor: hechoPor(req)
        });
        await valoracionRepo.actualizarAprobacionSiCorresponde(cursadaAsignaturaId, Number(cicloLectivo));
        res.json({ ok: true });
    } catch (error) {
        console.error('Error al autoguardar una valoracion:', error);
        res.status(500).json({ ok: false, error: 'No se pudo guardar.' });
    }
};

module.exports = { getPorAsignatura, getPorCurso, postGuardarFila };
