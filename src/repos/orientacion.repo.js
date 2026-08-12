const Orientacion = require('../models/Orientacion');

class OrientacionRepo {
    async crear(datosOrientacion) {
        const nuevaOrientacion = new Orientacion(datosOrientacion);
        return await nuevaOrientacion.save();
    }

    async obtenerTodos() {
        return await Orientacion.find({}).sort({ nombre: 1 });
    }

    async obtenerPorId(id) {
        return await Orientacion.findById(id);
    }

    async obtenerPorClave(clave) {
        return await Orientacion.findOne({ clave });
    }

    async actualizar(id, datosOrientacion) {
        return await Orientacion.findByIdAndUpdate(id, datosOrientacion, { new: true });
    }

    async eliminar(id) {
        return await Orientacion.findByIdAndDelete(id);
    }
}

module.exports = new OrientacionRepo();
