const mongoose = require('mongoose');

// Un docente/agente pide ocupar un Cargo vacante puntual (no "quiero un Rol en tal
// institucion" en general - siempre es un Cargo ya creado y sin designacion activa). Un
// admin la aprueba (crea la Designacion en el mismo paso, ver designacionCargo.controller.js
// - postAprobarSolicitud) o la rechaza. No reemplaza el alta manual de Designacion que ya
// existe en cargoDetalle.ejs - es un canal alternativo para que el pedido salga del
// docente en vez de que gestion tenga que saber de antemano quien quiere que cargo.
const solicitudCargoSchema = new mongoose.Schema(
    {
        cargoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cargo', required: true },
        // Sale de req.user.entidadId al crear la solicitud, nunca se elige a mano.
        personaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Persona', required: true },
        estado: {
            type: String,
            enum: ['pendiente', 'aprobada', 'rechazada'],
            default: 'pendiente'
        },
        // Nota libre del solicitante, opcional - mismo criterio que motivoLicencia/
        // motivoBaja (texto libre en vez de estructurado).
        mensaje: { type: String, trim: true },
        fechaResolucion: { type: Date, default: null },
        // Que admin la aprobo/rechazo - a diferencia de Designacion/Licencia (registros
        // administrativos objetivos), aca es una decision discrecional, vale la auditoria.
        resueltoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
        // Solo tiene sentido si estado === 'rechazada'.
        motivoRechazo: { type: String, trim: true },
        // Se completa solo si estado === 'aprobada' - la Designacion que se creo en el
        // mismo paso de aprobar.
        designacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designacion', default: null }
    },
    { timestamps: true }
);

// Red de seguridad contra doble-submit: la misma persona no puede tener dos solicitudes
// PENDIENTES para el mismo cargo a la vez (parcial: una vez resuelta - aprobada o
// rechazada - volver a pedir el mismo cargo es valido, ej. despues de un rechazo). El
// chequeo real para el usuario (con flash prolijo) va en el controller
// (solicitudCargoRepo.buscarPendienteDuplicada) - esto es el backstop.
solicitudCargoSchema.index(
    { personaId: 1, cargoId: 1 },
    { unique: true, partialFilterExpression: { estado: 'pendiente' } }
);
// Para listar pendientes por cargo y para el auto-rechazo de solicitudes hermanas al
// aprobar una (ver postDesignacionBase/postAprobarSolicitud).
solicitudCargoSchema.index({ cargoId: 1, estado: 1 });

module.exports = mongoose.model('SolicitudCargo', solicitudCargoSchema);
