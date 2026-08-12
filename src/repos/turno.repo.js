const Turno = require('../models/Turno');

class TurnoRepo {
    async crear(datosTurno) {
        const nuevoTurno = new Turno(datosTurno);
        return await nuevoTurno.save();
    }

    async obtenerPorInstitucion(institucionId) {
        return await Turno.find({ institucionId }).populate('institucionId');
    }

    async obtenerPorId(id) {
        return await Turno.findById(id).populate('institucionId');
    }

    async obtenerPorClave(institucionId, clave) {
        return await Turno.findOne({ institucionId, clave }).populate('institucionId');
    }

    async obtenerTodos() {
        return await Turno.find({}).populate('institucionId');
    }

    async agregarModulo(id, modulo) {
        return await Turno.findByIdAndUpdate(
            id,
            { $push: { modulos: modulo } },
            { new: true }
        );
    }
}

module.exports = new TurnoRepo();
