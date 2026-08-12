const Curso = require('../models/Curso');

class CursoRepo {
    async crear(datosCurso) {
        const nuevoCurso = new Curso(datosCurso);
        return await nuevoCurso.save();
    }

    async obtenerTodos() {
        return await Curso.find({})
            .populate('institucionId')
            .populate('anioId')
            .populate('turnoId')
            .populate('orientacionId')
            .sort({ createdAt: -1 });
    }

    async obtenerPorInstitucion(institucionId) {
        return await Curso.find({ institucionId })
            .populate('institucionId')
            .populate('anioId')
            .populate('turnoId')
            .populate('orientacionId')
            .sort({ clave: 1 });
    }

    async obtenerPorId(id) {
        return await Curso.findById(id)
            .populate('institucionId')
            .populate('anioId')
            .populate('turnoId')
            .populate('orientacionId');
    }

    async obtenerPorClave(institucionId, clave) {
        return await Curso.findOne({ institucionId, clave })
            .populate('institucionId')
            .populate('anioId')
            .populate('turnoId')
            .populate('orientacionId');
    }

    // Un mismo año+division no puede repetirse dentro de la institucion, ni la clave.
    // exceptoId (edicion): excluye al propio curso, sino se auto-marcaria como duplicado
    // al guardar sin cambiar division/clave.
    async buscarDuplicado(institucionId, { anioId, division, clave }, exceptoId) {
        const filtro = {
            institucionId,
            $or: [{ anioId, division }, { clave }]
        };
        if (exceptoId) filtro._id = { $ne: exceptoId };
        return await Curso.findOne(filtro);
    }

    // Edicion acotada a proposito (ver admin/curso.controller.js::postEditarCurso): division,
    // turno y clave son organizativos/cosmeticos. anioId/orientacionId quedan afuera porque
    // los cargos de profesor ya generados (ver cargoRepo.generarParaCurso) dependen del plan
    // de estudio de ese año+orientacion - cambiarlos los dejaria desincronizados.
    async actualizar(id, { division, turnoId, clave }) {
        return await Curso.findByIdAndUpdate(id, { division, turnoId, clave }, { new: true, runValidators: true });
    }

    async eliminar(id) {
        return await Curso.findByIdAndDelete(id);
    }
}

module.exports = new CursoRepo();
