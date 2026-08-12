const CargoCurso = require('../models/CargoCurso');

class CargoCursoRepo {
    async crear(datosCargoCurso) {
        const nuevo = new CargoCurso(datosCargoCurso);
        return await nuevo.save();
    }

    async obtenerPorCargo(cargoId) {
        return await CargoCurso.find({ cargoId }).sort({ anioLectivo: -1 }).populate('cursoId');
    }

    async buscarDuplicado(cargoId, cursoId, anioLectivo) {
        return await CargoCurso.findOne({ cargoId, cursoId, anioLectivo });
    }

    async eliminar(id) {
        return await CargoCurso.findByIdAndDelete(id);
    }

    // Para la eliminacion de un Curso (ver admin/curso.controller.js::postEliminarCurso) -
    // borra los vinculos de preceptor con ESTE curso, nunca el Cargo de preceptor en si
    // (que puede seguir cubriendo otros cursos).
    async eliminarPorCurso(cursoId) {
        return await CargoCurso.deleteMany({ cursoId });
    }
}

module.exports = new CargoCursoRepo();
