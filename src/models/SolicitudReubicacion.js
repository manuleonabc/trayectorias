const mongoose = require('mongoose');

// Pedido de mover a un estudiante de un curso a otro (pedido explicito del usuario: ningun
// movimiento entre cursos se hace de un solo lado). Dos sentidos, segun que lado lo pide:
// - 'enviar': lo pide el curso de ORIGEN (el estudiante se fue a otro curso) - confirma
//   el curso de DESTINO.
// - 'traer': lo pide el curso de DESTINO (llego un estudiante que esta en otro curso) -
//   confirma el curso de ORIGEN.
// Confirma el preceptor designado este año en el curso que confirma, o un jerarquico
// (nivelAcceso 'total') de esa institucion - si origen y destino son de instituciones
// distintas, solo jerarquicos (ver reubicacion.controller.js::puedeConfirmar). Mientras
// esta pendiente, el estudiante sigue en el curso de origen. Al aprobar se hace el
// movimiento real (inscribirExistenteEnCurso -> inscripcionRepo.matricular, que cierra la
// vigente y abre la nueva). Un estudiante sin inscripcion vigente este año no pasa por
// aca: no hay otro lado que confirme, se anota directo.
const solicitudReubicacionSchema = new mongoose.Schema(
    {
        estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
        // La vigente al momento de pedir - al aprobar se revalida que siga siendo la
        // vigente (si el estudiante se movio por otro lado mientras tanto, la solicitud
        // ya no aplica).
        inscripcionOrigenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inscripcion', required: true },
        cursoOrigenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
        cursoDestinoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
        sentido: { type: String, enum: ['enviar', 'traer'], required: true },
        // Fecha/motivo del movimiento (alta en destino = baja en origen, mismo dato).
        fecha: { type: Date, required: true },
        motivo: { type: String, required: true, trim: true },
        // N° del libro de matricula del DESTINO - lo carga quien este del lado del destino:
        // el solicitante si sentido es 'traer', quien confirma si es 'enviar'.
        numeroRegistro: { type: String, trim: true },
        estado: {
            type: String,
            enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada'],
            default: 'pendiente'
        },
        cargoSolicitanteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cargo', required: true },
        // Mismo criterio que Auditoria/Valoracion: nombre de usuario del mail (utils/hechoPor.js).
        solicitadoPor: { type: String, trim: true },
        resueltoPor: { type: String, trim: true },
        fechaResolucion: { type: Date, default: null },
        // Solo tiene sentido si estado === 'rechazada'.
        motivoRechazo: { type: String, trim: true }
    },
    { timestamps: true }
);

// Una sola solicitud pendiente por estudiante a la vez (parcial, mismo patron que
// SolicitudCargo) - el chequeo con flash prolijo va en el controller, esto es el backstop.
solicitudReubicacionSchema.index(
    { estudianteId: 1 },
    { unique: true, partialFilterExpression: { estado: 'pendiente' } }
);
solicitudReubicacionSchema.index({ cursoOrigenId: 1, estado: 1 });
solicitudReubicacionSchema.index({ cursoDestinoId: 1, estado: 1 });

module.exports = mongoose.model('SolicitudReubicacion', solicitudReubicacionSchema);
