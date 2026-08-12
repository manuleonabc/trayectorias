const Licencia = require('../models/Licencia');

class LicenciaRepo {
    async crear(datosLicencia) {
        const nuevaLicencia = new Licencia(datosLicencia);
        return await nuevaLicencia.save();
    }

    async obtenerPorDesignacion(designacionId) {
        return await Licencia.find({ designacionId }).sort({ fechaInicio: -1 });
    }

    async obtenerVigentePorDesignacion(designacionId) {
        return await Licencia.findOne({ designacionId, fechaFin: null });
    }

    // Para la eliminacion de un Curso (ver admin/curso.controller.js::postEliminarCurso) -
    // al borrar en cascada los Cargo de profesor generados para ese curso, sus Designacion
    // tambien se borran, y estas licencias quedarian huerfanas sin este paso.
    async eliminarPorDesignaciones(designacionIds) {
        return await Licencia.deleteMany({ designacionId: { $in: designacionIds } });
    }
}

module.exports = new LicenciaRepo();
