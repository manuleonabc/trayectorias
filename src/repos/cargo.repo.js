const Cargo = require('../models/Cargo');

class CargoRepo {
    async crear(datosCargo) {
        const nuevoCargo = new Cargo(datosCargo);
        return await nuevoCargo.save();
    }

    // Para cargos que existian antes de que Cargo.clave existiera (no tienen una todavia)
    // - unico lugar donde se edita a mano, ver admin/cargo.controller.js::postEditarCargo.
    async actualizarClave(id, clave) {
        return await Cargo.findByIdAndUpdate(id, { clave }, { new: true });
    }

    async obtenerPorId(id) {
        return await Cargo.findById(id)
            .populate('institucionId')
            .populate('turnoId')
            .populate('rolId')
            .populate('asignaturaId')
            .populate('cursoId');
    }

    async obtenerPorClave(institucionId, clave) {
        return await Cargo.findOne({ institucionId, clave })
            .populate('institucionId')
            .populate('turnoId')
            .populate('rolId')
            .populate('asignaturaId')
            .populate('cursoId');
    }

    async obtenerPorInstitucion(institucionId) {
        return await Cargo.find({ institucionId })
            .populate('institucionId')
            .populate('turnoId')
            .populate('rolId')
            .populate('asignaturaId')
            .populate('cursoId')
            .sort({ createdAt: -1 });
    }

    async obtenerTodos() {
        return await Cargo.find({})
            .populate('institucionId')
            .populate('turnoId')
            .populate('rolId')
            .populate('asignaturaId')
            .sort({ createdAt: -1 });
    }

    // Uno por cada Asignatura del plan de estudio del curso - sin asignaturas no hay
    // nada que generar. El indice unico (cursoId, asignaturaId) evita duplicados si esto
    // se llegara a correr dos veces para el mismo curso.
    async contarPorCurso(cursoId) {
        return await Cargo.countDocuments({ cursoId });
    }

    // Los cargos de profesor de un curso, con su asignatura y rol - para mostrar "materias
    // y docentes" en cursoDetalle.ejs (quien esta designado se resuelve aparte, con
    // designacionRepo.obtenerActivaPorCargo, mismo patron que admin/cargo.controller.js).
    // Se ordena en JS por Asignatura.orden porque Mongo no puede ordenar por un campo de
    // un populate.
    async obtenerPorCurso(cursoId) {
        const cargos = await Cargo.find({ cursoId })
            .populate('rolId')
            .populate('turnoId')
            .populate('asignaturaId');
        return cargos.sort((a, b) => (a.asignaturaId ? a.asignaturaId.orden : 0) - (b.asignaturaId ? b.asignaturaId.orden : 0));
    }

    // Para la eliminacion de un Curso (ver admin/curso.controller.js::postEliminarCurso) -
    // los ids se necesitan antes de borrar (para cascadear sus Designacion/Licencia).
    async obtenerIdsPorCurso(cursoId) {
        const cargos = await Cargo.find({ cursoId }, '_id');
        return cargos.map((c) => c._id);
    }

    // Borra los cargos de profesor de un curso - nunca los de otro tipo (preceptor, etc,
    // que no tienen cursoId fijo, ver Cargo.js), y solo se llama despues de haber
    // cascadeado sus Designacion/Licencia (sino quedarian huerfanas).
    async eliminarPorCurso(cursoId) {
        return await Cargo.deleteMany({ cursoId });
    }

    // La clave de un cargo de profesor sale sola: asignatura+curso, siempre unica dentro
    // de la institucion porque la asignatura ya es distinta en cada fila del curso (no
    // hace falta el rol como prefijo - curso+asignatura ya identifica que es de profesor).
    async generarParaCurso(curso, asignaturas, rol) {
        if (asignaturas.length === 0) return [];
        const nuevosCargos = asignaturas.map((asignatura) => ({
            institucionId: curso.institucionId,
            rolId: rol._id,
            turnoId: curso.turnoId,
            cursoId: curso._id,
            asignaturaId: asignatura._id,
            clave: `${asignatura.clave}-${curso.clave}`
        }));
        return await Cargo.insertMany(nuevosCargos);
    }
}

module.exports = new CargoRepo();
