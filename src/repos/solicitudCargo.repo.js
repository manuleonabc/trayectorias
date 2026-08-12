const SolicitudCargo = require('../models/SolicitudCargo');

const populateCargo = {
    path: 'cargoId',
    populate: ['institucionId', 'rolId']
};

class SolicitudCargoRepo {
    async crear(datosSolicitud) {
        const nuevaSolicitud = new SolicitudCargo(datosSolicitud);
        return await nuevaSolicitud.save();
    }

    async obtenerPorId(id) {
        return await SolicitudCargo.findById(id).populate('personaId').populate(populateCargo);
    }

    async obtenerPorPersona(personaId) {
        return await SolicitudCargo.find({ personaId }).sort({ createdAt: -1 }).populate(populateCargo);
    }

    async obtenerPendientesPorCargo(cargoId) {
        return await SolicitudCargo.find({ cargoId, estado: 'pendiente' })
            .sort({ createdAt: 1 })
            .populate('personaId');
    }

    // Vista global de gestion: todas las pendientes, de cualquier institucion.
    async obtenerTodasPendientes() {
        return await SolicitudCargo.find({ estado: 'pendiente' })
            .sort({ createdAt: 1 })
            .populate('personaId')
            .populate(populateCargo);
    }

    async buscarPendienteDuplicada(personaId, cargoId) {
        return await SolicitudCargo.findOne({ personaId, cargoId, estado: 'pendiente' });
    }

    async marcarResuelta(id, datos) {
        return await SolicitudCargo.findByIdAndUpdate(id, {
            estado: datos.estado,
            fechaResolucion: datos.fechaResolucion,
            resueltoPor: datos.resueltoPor,
            motivoRechazo: datos.motivoRechazo,
            designacionId: datos.designacionId
        }, { new: true });
    }

    // Al aprobar una solicitud (o al designar directo sin pasar por ninguna), las demas
    // solicitudes pendientes del mismo cargo quedarian huerfanas - el cargo ya no esta
    // vacante, y un segundo intento de aprobarlas volveria a fallar en altaBase sin que
    // nadie se entere. exceptoId evita auto-rechazar la que se acaba de aprobar.
    async rechazarPendientesDelCargo(cargoId, motivo, exceptoId) {
        const filtro = { cargoId, estado: 'pendiente' };
        if (exceptoId) filtro._id = { $ne: exceptoId };
        return await SolicitudCargo.updateMany(filtro, {
            estado: 'rechazada',
            motivoRechazo: motivo,
            fechaResolucion: new Date()
        });
    }
}

module.exports = new SolicitudCargoRepo();
