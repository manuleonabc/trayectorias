const CursadaAsignatura = require('../models/CursadaAsignatura');

class CursadaAsignaturaRepo {
    async crear(datosCursada) {
        const nuevaCursada = new CursadaAsignatura(datosCursada);
        return await nuevaCursada.save();
    }

    async obtenerPorEstudiante(estudianteId) {
        return await CursadaAsignatura.find({ estudianteId })
            .sort({ createdAt: -1 })
            .populate({ path: 'asignaturaId', populate: 'anioId' });
    }

    async buscarDuplicado(estudianteId, asignaturaId) {
        return await CursadaAsignatura.findOne({ estudianteId, asignaturaId });
    }

    // Ids de las materias que un estudiante ya tiene aprobadas - las que no se le vuelven
    // a ofrecer al armar el checklist de una inscripcion.
    async obtenerAsignaturasAprobadas(estudianteId) {
        return await CursadaAsignatura.find({ estudianteId, aprobada: true }).distinct('asignaturaId');
    }

    // Para el alta con checklist: asegura que exista una CursadaAsignatura por cada
    // asignaturaId marcado - a diferencia de antes, NO crea una fila nueva si el
    // estudiante ya tenia una para esa materia (la relacion es unica para siempre, ver
    // CursadaAsignatura.js - un año nuevo de la misma materia pendiente, recursada o no,
    // se registra con una Valoracion nueva contra la MISMA fila, no con otra fila). session
    // opcional (ver crearEstudianteEnCurso en estudiante.controller.js).
    async crearVarias(estudianteId, asignaturaIds, session) {
        const ids = [].concat(asignaturaIds || []).filter(Boolean);
        if (ids.length === 0) return [];

        const existentes = await CursadaAsignatura.find(
            { estudianteId, asignaturaId: { $in: ids } },
            'asignaturaId'
        ).session(session);
        const yaExisten = new Set(existentes.map((c) => String(c.asignaturaId)));

        const nuevas = ids
            .filter((asignaturaId) => !yaExisten.has(String(asignaturaId)))
            .map((asignaturaId) => ({ estudianteId, asignaturaId }));
        if (nuevas.length === 0) return [];

        try {
            // ordered:false + el indice unico de respaldo: si de todos modos hay una
            // carrera (dos altas casi simultaneas para la misma materia), que no aborte
            // las demas - mismo criterio que ya tenia esto antes del cambio.
            return await CursadaAsignatura.insertMany(nuevas, { ordered: false, session });
        } catch (error) {
            return [];
        }
    }

    // Bulk fetch para la matriz "por curso" (ver valoracion.controller.js::getPorCurso) -
    // en vez de N*M consultas individuales (una por estudiante x asignatura), una sola
    // consulta trae todas las CursadaAsignatura de ese grupo de estudiantes+asignaturas.
    async obtenerPorEstudiantesYAsignaturas(estudianteIds, asignaturaIds) {
        return await CursadaAsignatura.find({
            estudianteId: { $in: estudianteIds },
            asignaturaId: { $in: asignaturaIds }
        });
    }

    // Para la baja real de un Estudiante (ver postEliminarEstudiante) - borra las filas,
    // nunca la Asignatura en si.
    async eliminarPorEstudiante(estudianteId) {
        return await CursadaAsignatura.deleteMany({ estudianteId });
    }

    // Para destildar materias del checklist de "Materias asignadas" de la cursada actual
    // (ver getCursadaEditar/postCursadaMaterias en estudiante.controller.js) - nunca borra
    // una ya aprobada, es un registro permanente.
    async eliminarVariasSiNoAprobadas(estudianteId, asignaturaIds) {
        const ids = [].concat(asignaturaIds || []).filter(Boolean);
        if (ids.length === 0) return;
        return await CursadaAsignatura.deleteMany({ estudianteId, asignaturaId: { $in: ids }, aprobada: false });
    }

    async marcarAprobada(id, { fechaAprobacion, notaFinal }) {
        return await CursadaAsignatura.findByIdAndUpdate(
            id,
            { aprobada: true, fechaAprobacion, notaFinal },
            { new: true }
        );
    }
}

module.exports = new CursadaAsignaturaRepo();
