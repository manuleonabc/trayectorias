const mongoose = require('mongoose');

// Un curso es un grupo concreto de estudiantes dentro de una institucion (ej: "4to A,
// Turno Mañana, Cs. Sociales"). orientacionId solo aplica si el año es de ciclo superior
// (null = ciclo basico, mismo criterio que Asignatura.orientacionId) - de ahi sale que
// plan de estudio (lista de Asignatura) le corresponde para generar los cargos de profesor.
const cursoSchema = new mongoose.Schema(
    {
        institucionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institucion', required: true },
        anioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anio', required: true },
        division: { type: String, required: true, trim: true },
        turnoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turno', required: true },
        orientacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Orientacion', default: null },
        clave: { type: String, required: true, trim: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Curso', cursoSchema);
