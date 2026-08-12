const AdultoResponsable = require('../models/AdultoResponsable');

class AdultoResponsableRepo {
    async crear(datosAdulto) {
        const nuevoAdulto = new AdultoResponsable(datosAdulto);
        return await nuevoAdulto.save();
    }

    async obtenerPorNumeroDocumento(numeroDocumento) {
        return await AdultoResponsable.findOne({ numeroDocumento });
    }

    async obtenerPorId(id) {
        return await AdultoResponsable.findById(id);
    }
}

module.exports = new AdultoResponsableRepo();
