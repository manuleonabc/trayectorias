const Anio = require('../models/Anio');

class AnioRepo {
    async crear(datosAnio) {
        const nuevoAnio = new Anio(datosAnio);
        return await nuevoAnio.save();
    }

    async obtenerTodos() {
        return await Anio.find({}).sort({ clave: 1 });
    }

    async obtenerPorId(id) {
        return await Anio.findById(id);
    }

    async obtenerPorClave(clave) {
        return await Anio.findOne({ clave });
    }
}

module.exports = new AnioRepo();
