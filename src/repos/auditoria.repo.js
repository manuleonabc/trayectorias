const Auditoria = require('../models/Auditoria');

class AuditoriaRepo {
    async registrar({ accion, descripcion, hechoPor }) {
        return await Auditoria.create({ accion, descripcion, hechoPor });
    }
}

module.exports = new AuditoriaRepo();
