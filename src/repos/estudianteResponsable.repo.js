const EstudianteResponsable = require('../models/EstudianteResponsable');

class EstudianteResponsableRepo {
    async crear(datosVinculo) {
        const nuevoVinculo = new EstudianteResponsable(datosVinculo);
        return await nuevoVinculo.save();
    }

    async obtenerPorEstudiante(estudianteId) {
        return await EstudianteResponsable.find({ estudianteId })
            .sort({ createdAt: 1 })
            .populate('adultoResponsableId');
    }

    async buscarDuplicado(estudianteId, adultoResponsableId) {
        return await EstudianteResponsable.findOne({ estudianteId, adultoResponsableId });
    }

    async eliminar(id) {
        return await EstudianteResponsable.findByIdAndDelete(id);
    }

    // Para la baja real de un Estudiante (ver postEliminarEstudiante) - borra el vinculo,
    // nunca el AdultoResponsable en si (puede estar compartido con hermanos).
    async eliminarPorEstudiante(estudianteId) {
        return await EstudianteResponsable.deleteMany({ estudianteId });
    }
}

module.exports = new EstudianteResponsableRepo();
