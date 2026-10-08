const cursoRepo = require('../repos/curso.repo');
const estudianteRepo = require('../repos/estudiante.repo');
const inscripcionRepo = require('../repos/inscripcion.repo');
const solicitudReubicacionRepo = require('../repos/solicitudReubicacion.repo');
const { inscribirExistenteEnCurso } = require('./estudiante.controller');
const { resolverCargoActivo, resolverCursoPermitido } = require('./misCursos.controller');
const fechaHoy = require('../utils/fechaHoy');
const hechoPor = require('../utils/hechoPor');

// Reubicacion de estudiantes entre cursos (/mis-cursos/:cursoClave/reubicaciones) -
// reemplaza al viejo "Inscribir estudiante existente" (que listaba a TODOS los
// estudiantes del sistema en un <select> en cada visita al curso) y al "Reubicar" directo
// de la vista de edicion. Pedido explicito del usuario: ningun movimiento entre cursos se
// hace de un solo lado - se pide (enviar o traer) y lo confirma el otro curso (ver
// SolicitudReubicacion.js). Unica excepcion: un estudiante sin inscripcion vigente este
// año (ej. promociono y todavia no se anoto) se anota directo, no hay otro lado.

const anioActual = () => new Date().getFullYear();
const mismoId = (a, b) => String(a && a._id ? a._id : a) === String(b && b._id ? b._id : b);
const esJerarquico = (cargo) => cargo.rolId.nivelAcceso === 'total';

// Mismo guard que el resto de /mis-cursos - devuelve null si ya redirigio.
const resolverContexto = async (req, res) => {
    const cargo = await resolverCargoActivo(req);
    if (!cargo) { res.redirect('/estudiantes'); return null; }
    const curso = await resolverCursoPermitido(req, cargo);
    if (!curso) { res.redirect('/mis-cursos'); return null; }
    return { cargo, curso };
};

const cursoConfirmante = (solicitud) => (solicitud.sentido === 'enviar' ? solicitud.cursoDestinoId : solicitud.cursoOrigenId);
const cursoSolicitante = (solicitud) => (solicitud.sentido === 'enviar' ? solicitud.cursoOrigenId : solicitud.cursoDestinoId);

// Entre escuelas distintas solo pueden pedir/confirmar jerarquicos (pedido explicito del
// usuario) - dentro de la misma escuela alcanza con tener acceso al curso (preceptor
// designado o jerarquico, ya validado por resolverCursoPermitido).
const entreEscuelas = (cursoA, cursoB) => !mismoId(cursoA.institucionId, cursoB.institucionId);

// Situacion de un estudiante respecto de ESTE curso, para el buscador.
const estadoRespectoDe = (curso, vigente) => {
    if (!vigente || vigente.cicloLectivo !== anioActual()) return 'libre';
    if (mismoId(vigente.cursoId, curso)) return 'enEsteCurso';
    if (entreEscuelas(vigente.cursoId, curso)) return 'otraEscuela';
    return 'otroCurso';
};

const urlReubicaciones = (curso) => `/mis-cursos/${curso.clave}/reubicaciones`;

const getReubicaciones = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const { cargo, curso } = ctx;
    const q = (req.query.q || '').trim();

    const [paraConfirmar, enviadas, inscripcionesVigentes, cursosDeLaInstitucion, siguienteNumeroRegistro, encontrados] =
        await Promise.all([
            solicitudReubicacionRepo.obtenerPendientesParaConfirmar(curso._id),
            solicitudReubicacionRepo.obtenerEnviadas(curso._id),
            inscripcionRepo.obtenerVigentesPorCurso(curso._id),
            cursoRepo.obtenerPorInstitucion(cargo.institucionId._id),
            inscripcionRepo.obtenerSiguienteNumeroRegistro(cargo.institucionId._id),
            q ? estudianteRepo.buscar(q) : Promise.resolve([])
        ]);

    let resultados = [];
    if (encontrados.length > 0) {
        const ids = encontrados.map((e) => e._id);
        const [vigentesPorEstudiante, conPendiente] = await Promise.all([
            inscripcionRepo.obtenerVigentesPorEstudiantes(ids),
            solicitudReubicacionRepo.obtenerIdsConPendiente(ids)
        ]);
        resultados = encontrados.map((estudiante) => {
            const vigente = vigentesPorEstudiante.get(String(estudiante._id)) || null;
            return {
                estudiante,
                vigente,
                estado: estadoRespectoDe(curso, vigente),
                tienePendiente: conPendiente.has(String(estudiante._id))
            };
        });
    }

    res.render('pages/misCursoReubicaciones', {
        curso, q, resultados, paraConfirmar, enviadas, inscripcionesVigentes,
        otrosCursos: cursosDeLaInstitucion.filter((c) => !mismoId(c, curso)),
        esJerarquico: esJerarquico(cargo),
        cursoConfirmante, cursoSolicitante, entreEscuelas,
        fechaHoy: fechaHoy(), siguienteNumeroRegistro
    });
};

// Anotar directo: solo si no tiene inscripcion vigente ESTE año (revalidado aca, nunca se
// confia en que el boton solo aparezca para "libres").
const postAnotar = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const { curso } = ctx;
    const volver = `${urlReubicaciones(curso)}?q=${encodeURIComponent(req.body.q || '')}`;

    const estudiante = await estudianteRepo.obtenerPorId(req.body.estudianteId).catch(() => null);
    if (!estudiante) {
        req.flash('error', 'Estudiante no encontrado.');
        return res.redirect(volver);
    }
    const vigente = await inscripcionRepo.obtenerVigentePorEstudiante(estudiante._id);
    if (estadoRespectoDe(curso, vigente) !== 'libre') {
        req.flash('error', 'Ese estudiante ya tiene una inscripción vigente este año - hay que pedir la reubicación.');
        return res.redirect(volver);
    }

    const resultado = await inscribirExistenteEnCurso(curso, {
        estudianteId: estudiante._id,
        cicloLectivo: anioActual(),
        fechaAlta: fechaHoy(),
        motivoAlta: 'Inscripción',
        numeroRegistro: req.body.numeroRegistro
    });
    if (resultado.error) {
        req.flash('error', resultado.error);
        return res.redirect(volver);
    }
    req.flash('success', `${estudiante.personaId.apellido}, ${estudiante.personaId.nombre} quedó inscripto en ${curso.clave}.`);
    res.redirect(`/mis-cursos/${curso.clave}`);
};

// "Traer": el estudiante esta este año en otro curso y viene a ESTE - lo confirma el curso
// de origen.
const postSolicitarTraer = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const { cargo, curso } = ctx;
    const volver = `${urlReubicaciones(curso)}?q=${encodeURIComponent(req.body.q || '')}`;

    const vigente = await inscripcionRepo.obtenerVigentePorEstudiante(req.body.estudianteId).catch(() => null);
    const estado = estadoRespectoDe(curso, vigente);
    if (estado === 'libre' || estado === 'enEsteCurso') {
        req.flash('error', estado === 'libre'
            ? 'Ese estudiante no está en ningún curso este año - se anota directo, sin solicitud.'
            : 'Ese estudiante ya está inscripto en este curso.');
        return res.redirect(volver);
    }
    if (estado === 'otraEscuela' && !esJerarquico(cargo)) {
        req.flash('error', 'El estudiante está en otra escuela - la reubicación entre escuelas la pide un directivo.');
        return res.redirect(volver);
    }
    if (await solicitudReubicacionRepo.obtenerPendientePorEstudiante(vigente.estudianteId)) {
        req.flash('error', 'Ese estudiante ya tiene una solicitud de reubicación pendiente.');
        return res.redirect(volver);
    }

    await solicitudReubicacionRepo.crear({
        estudianteId: vigente.estudianteId,
        inscripcionOrigenId: vigente._id,
        cursoOrigenId: vigente.cursoId._id,
        cursoDestinoId: curso._id,
        sentido: 'traer',
        fecha: new Date(req.body.fecha),
        motivo: req.body.motivo,
        numeroRegistro: req.body.numeroRegistro || undefined,
        cargoSolicitanteId: cargo._id,
        solicitadoPor: hechoPor(req)
    });
    req.flash('success', `Solicitud enviada - queda pendiente hasta que la confirme ${vigente.cursoId.clave}.`);
    res.redirect(urlReubicaciones(curso));
};

// "Enviar": un estudiante de ESTE curso se fue a otro curso de la misma escuela - lo
// confirma el curso de destino. Se llama desde la vista de reubicaciones y desde el boton
// "Reubicar" de la vista de edicion (volverA = 'editar').
const postSolicitarEnviar = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const { cargo, curso } = ctx;
    const volver = req.body.volverA === 'editar' ? `/mis-cursos/${curso.clave}/editar` : urlReubicaciones(curso);

    const inscripcion = await inscripcionRepo.obtenerPorId(req.body.inscripcionId).catch(() => null);
    if (!inscripcion || !mismoId(inscripcion.cursoId, curso) || inscripcion.fechaBaja) {
        req.flash('error', 'Esa inscripción no pertenece a este curso.');
        return res.redirect(volver);
    }
    const cursoDestino = await cursoRepo.obtenerPorId(req.body.cursoDestinoId).catch(() => null);
    if (!cursoDestino || mismoId(cursoDestino, curso) || entreEscuelas(cursoDestino, curso)) {
        req.flash('error', 'Curso de destino inválido.');
        return res.redirect(volver);
    }
    if (await solicitudReubicacionRepo.obtenerPendientePorEstudiante(inscripcion.estudianteId)) {
        req.flash('error', 'Ese estudiante ya tiene una solicitud de reubicación pendiente.');
        return res.redirect(volver);
    }

    await solicitudReubicacionRepo.crear({
        estudianteId: inscripcion.estudianteId,
        inscripcionOrigenId: inscripcion._id,
        cursoOrigenId: curso._id,
        cursoDestinoId: cursoDestino._id,
        sentido: 'enviar',
        fecha: new Date(req.body.fecha),
        motivo: req.body.motivo,
        cargoSolicitanteId: cargo._id,
        solicitadoPor: hechoPor(req)
    });
    req.flash('success', `Solicitud enviada - queda pendiente hasta que la confirme ${cursoDestino.clave}.`);
    res.redirect(volver);
};

// Carga la solicitud y valida que ESTE curso sea el que tiene que confirmarla (y, entre
// escuelas, que quien confirma sea jerarquico). Devuelve null si ya flasheo+redirigio.
const resolverSolicitudAConfirmar = async (req, res, { cargo, curso }) => {
    const solicitud = await solicitudReubicacionRepo.obtenerPorId(req.params.solicitudId).catch(() => null);
    if (!solicitud || solicitud.estado !== 'pendiente' || !mismoId(cursoConfirmante(solicitud), curso)) {
        req.flash('error', 'Esa solicitud no existe o ya fue resuelta.');
        res.redirect(urlReubicaciones(curso));
        return null;
    }
    if (entreEscuelas(solicitud.cursoOrigenId, solicitud.cursoDestinoId) && !esJerarquico(cargo)) {
        req.flash('error', 'Las reubicaciones entre escuelas las confirma un directivo.');
        res.redirect(urlReubicaciones(curso));
        return null;
    }
    return solicitud;
};

const postAprobar = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const { curso } = ctx;
    const solicitud = await resolverSolicitudAConfirmar(req, res, ctx);
    if (!solicitud) return;

    // Si el estudiante se movio por otro lado mientras la solicitud estaba pendiente, ya
    // no aplica - se cierra sola en vez de mover desde un curso donde ya no esta.
    const vigente = await inscripcionRepo.obtenerVigentePorEstudiante(solicitud.estudianteId._id);
    if (!vigente || !mismoId(vigente, solicitud.inscripcionOrigenId)) {
        await solicitudReubicacionRepo.resolver(solicitud._id, {
            estado: 'rechazada', motivoRechazo: 'El estudiante ya no está en el curso de origen.', resueltoPor: hechoPor(req)
        });
        req.flash('error', 'El estudiante ya no está en el curso de origen - la solicitud se cerró.');
        return res.redirect(urlReubicaciones(curso));
    }

    // El N° de registro es del libro del destino: en 'enviar' lo carga quien confirma (el
    // destino), en 'traer' ya vino cargado por quien pidio.
    const numeroRegistroOriginal = solicitud.numeroRegistro;
    const numeroRegistro = solicitud.sentido === 'enviar' ? (req.body.numeroRegistro || undefined) : numeroRegistroOriginal;

    // Primero se marca aprobada de forma atomica (solo si sigue pendiente) - evita que dos
    // confirmaciones simultaneas muevan dos veces. Si el movimiento falla, vuelve a pendiente.
    const marcada = await solicitudReubicacionRepo.resolver(solicitud._id, {
        estado: 'aprobada', resueltoPor: hechoPor(req), numeroRegistro
    });
    if (!marcada) {
        req.flash('error', 'Esa solicitud ya fue resuelta.');
        return res.redirect(urlReubicaciones(curso));
    }

    const origen = solicitud.cursoOrigenId;
    const cursoDestino = await cursoRepo.obtenerPorId(solicitud.cursoDestinoId._id);
    const resultado = await inscribirExistenteEnCurso(cursoDestino, {
        estudianteId: solicitud.estudianteId._id,
        cicloLectivo: anioActual(),
        fechaAlta: solicitud.fecha,
        motivoAlta: solicitud.motivo,
        numeroRegistro,
        procedencia: `${origen.clave} — ${origen.institucionId.nombre}`
    });
    if (resultado.error) {
        await solicitudReubicacionRepo.volverAPendiente(solicitud._id, numeroRegistroOriginal);
        req.flash('error', resultado.error);
        return res.redirect(urlReubicaciones(curso));
    }

    const persona = solicitud.estudianteId.personaId;
    req.flash('success', `${persona.apellido}, ${persona.nombre} pasó de ${origen.clave} a ${cursoDestino.clave}.`);
    res.redirect(urlReubicaciones(curso));
};

const postRechazar = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const solicitud = await resolverSolicitudAConfirmar(req, res, ctx);
    if (!solicitud) return;

    await solicitudReubicacionRepo.resolver(solicitud._id, {
        estado: 'rechazada', motivoRechazo: req.body.motivoRechazo || undefined, resueltoPor: hechoPor(req)
    });
    req.flash('success', 'Solicitud rechazada.');
    res.redirect(urlReubicaciones(ctx.curso));
};

// Cancelar: solo desde el curso que pidio, mientras siga pendiente.
const postCancelar = async (req, res) => {
    const ctx = await resolverContexto(req, res);
    if (!ctx) return;
    const { curso } = ctx;
    const solicitud = await solicitudReubicacionRepo.obtenerPorId(req.params.solicitudId).catch(() => null);
    if (!solicitud || solicitud.estado !== 'pendiente' || !mismoId(cursoSolicitante(solicitud), curso)) {
        req.flash('error', 'Esa solicitud no existe o ya fue resuelta.');
        return res.redirect(urlReubicaciones(curso));
    }
    await solicitudReubicacionRepo.resolver(solicitud._id, { estado: 'cancelada', resueltoPor: hechoPor(req) });
    req.flash('success', 'Solicitud cancelada.');
    res.redirect(urlReubicaciones(curso));
};

module.exports = {
    getReubicaciones, postAnotar, postSolicitarTraer, postSolicitarEnviar, postAprobar, postRechazar, postCancelar
};
