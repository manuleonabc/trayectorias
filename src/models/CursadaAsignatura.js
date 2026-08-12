const mongoose = require('mongoose');

// Relacion durable estudiante-materia: UNICA para siempre (nunca se duplica, ni siquiera
// si el estudiante recursa) - independiente del regimen de evaluacion vigente ese año.
// aprobada/fechaAprobacion/notaFinal son el resultado final, se escriben (a mano por ahora,
// o mas adelante automaticamente) solo cuando el estudiante finalmente aprueba - sin
// importar en que ciclo lectivo haya pasado eso. El detalle año a año (informes, notas de
// cuatrimestre, intensificacion - incluye recursado, que tampoco crea una fila nueva aca)
// vive en Valoracion, que sí tiene su propio cicloLectivo y referencia a esta fila via
// cursadaAsignaturaId - ver Valoracion.js.
const cursadaAsignaturaSchema = new mongoose.Schema(
    {
        estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
        asignaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asignatura', required: true },
        aprobada: { type: Boolean, default: false },
        fechaAprobacion: { type: Date, default: null },
        notaFinal: { type: Number, min: 1, max: 10, default: null }
    },
    { timestamps: true }
);

cursadaAsignaturaSchema.index({ estudianteId: 1, asignaturaId: 1 }, { unique: true });

module.exports = mongoose.model('CursadaAsignatura', cursadaAsignaturaSchema);
