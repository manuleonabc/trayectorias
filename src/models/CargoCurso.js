const mongoose = require('mongoose');

// A que curso(s) cubre un cargo de preceptor/ematp, por ano lectivo - a diferencia del
// cargo de profesor (que queda fijo a su curso+asignatura desde que se genera, ver
// Cargo.cursoId/asignaturaId), esta asignacion se redefine cada ano segun conveniencia
// de la conduccion. No es una relacion de alta/baja con fecha: cada ano se agrega una
// fila nueva (o varias, un cargo puede cubrir mas de un curso), la de anios anteriores
// queda como historial y no se edita.
const cargoCursoSchema = new mongoose.Schema(
    {
        cargoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cargo', required: true },
        cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
        anioLectivo: { type: Number, required: true }
    },
    { timestamps: true }
);

cargoCursoSchema.index({ cargoId: 1, cursoId: 1, anioLectivo: 1 }, { unique: true });

module.exports = mongoose.model('CargoCurso', cargoCursoSchema);
