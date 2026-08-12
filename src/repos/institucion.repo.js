const Institucion = require('../models/Institucion');

class InstitucionRepo {
    async obtenerTodos() {
        return await Institucion.find({}).sort({ nombre: 1 });
    }

    async obtenerPorId(id) {
        return await Institucion.findById(id);
    }

    // Para Usuario.alcance.tipo === 'institucion' - las instituciones puntuales que un
    // admin restringido puede gestionar (ver /seleccionar-institucion).
    async obtenerPorIds(ids) {
        return await Institucion.find({ _id: { $in: ids } }).sort({ nombre: 1 });
    }

    async obtenerPorClave(clave) {
        return await Institucion.findOne({ clave });
    }

    // El cue es el identificador de la institucion en si misma en las URLs (siempre
    // esta, a diferencia de clave, que es justo el campo que se esta editando aca).
    async obtenerPorCue(cue) {
        return await Institucion.findOne({ cue });
    }

    async actualizarClave(cue, clave) {
        return await Institucion.findOneAndUpdate({ cue }, { clave }, { new: true });
    }
}

module.exports = new InstitucionRepo();
