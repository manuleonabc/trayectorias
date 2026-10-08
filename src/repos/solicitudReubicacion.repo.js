const SolicitudReubicacion = require('../models/SolicitudReubicacion');

const populateCurso = (path) => ({ path, populate: ['institucionId', 'anioId'] });

const populateCompleto = (query) => query
    .populate({ path: 'estudianteId', populate: 'personaId' })
    .populate(populateCurso('cursoOrigenId'))
    .populate(populateCurso('cursoDestinoId'));

// Que curso confirma cada sentido (ver SolicitudReubicacion.js): 'enviar' lo confirma el
// destino, 'traer' el origen.
const filtroConfirmaCurso = (cursoId) => ({
    $or: [{ sentido: 'enviar', cursoDestinoId: cursoId }, { sentido: 'traer', cursoOrigenId: cursoId }]
});
const filtroSolicitaCurso = (cursoId) => ({
    $or: [{ sentido: 'enviar', cursoOrigenId: cursoId }, { sentido: 'traer', cursoDestinoId: cursoId }]
});

class SolicitudReubicacionRepo {
    async crear(datos) {
        return await new SolicitudReubicacion(datos).save();
    }

    async obtenerPorId(id) {
        return await populateCompleto(SolicitudReubicacion.findById(id));
    }

    async obtenerPendientePorEstudiante(estudianteId) {
        return await SolicitudReubicacion.findOne({ estudianteId, estado: 'pendiente' });
    }

    // Para marcar en el buscador a quien ya tiene un pedido en curso - una sola consulta $in.
    async obtenerIdsConPendiente(estudianteIds) {
        const pendientes = await SolicitudReubicacion.find(
            { estudianteId: { $in: estudianteIds }, estado: 'pendiente' }, 'estudianteId'
        );
        return new Set(pendientes.map((s) => String(s.estudianteId)));
    }

    async obtenerPendientesParaConfirmar(cursoId) {
        return await populateCompleto(
            SolicitudReubicacion.find({ ...filtroConfirmaCurso(cursoId), estado: 'pendiente' }).sort({ createdAt: 1 })
        );
    }

    // Pendientes por curso confirmante, para el badge del listado de /mis-cursos - un Map
    // cursoId (String) -> cantidad, en una sola consulta.
    async contarPendientesPorCurso(cursoIds) {
        const pendientes = await SolicitudReubicacion.find({
            estado: 'pendiente',
            $or: [
                { sentido: 'enviar', cursoDestinoId: { $in: cursoIds } },
                { sentido: 'traer', cursoOrigenId: { $in: cursoIds } }
            ]
        }, 'sentido cursoOrigenId cursoDestinoId');
        const conteo = new Map();
        pendientes.forEach((s) => {
            const clave = String(s.sentido === 'enviar' ? s.cursoDestinoId : s.cursoOrigenId);
            conteo.set(clave, (conteo.get(clave) || 0) + 1);
        });
        return conteo;
    }

    // Las que pidio este curso: pendientes + las ultimas resueltas (para que quien pidio
    // vea que paso con su pedido).
    async obtenerEnviadas(cursoId, limite = 20) {
        return await populateCompleto(
            SolicitudReubicacion.find(filtroSolicitaCurso(cursoId)).sort({ createdAt: -1 }).limit(limite)
        );
    }

    // Cambio de estado atomico: solo si sigue pendiente (evita doble aprobacion por doble
    // click o dos personas confirmando a la vez). null si ya no estaba pendiente.
    async resolver(id, datos) {
        return await SolicitudReubicacion.findOneAndUpdate(
            { _id: id, estado: 'pendiente' },
            { ...datos, fechaResolucion: new Date() },
            { new: true }
        );
    }

    // Vuelta atras si el movimiento real fallo despues de marcarla aprobada - restaura el
    // N° de registro que tenia (el de 'traer' lo cargo el solicitante, no hay que perderlo).
    async volverAPendiente(id, numeroRegistroOriginal) {
        return await SolicitudReubicacion.findByIdAndUpdate(id, {
            estado: 'pendiente', fechaResolucion: null, numeroRegistro: numeroRegistroOriginal,
            $unset: { resueltoPor: 1 }
        });
    }
}

module.exports = new SolicitudReubicacionRepo();
