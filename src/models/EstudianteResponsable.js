const mongoose = require('mongoose');

// Vinculo entre un Estudiante y un AdultoResponsable - el mismo adulto puede estar
// vinculado a varios estudiantes (hermanos), por eso esto es una relacion aparte y no
// un campo embebido en Estudiante ni en AdultoResponsable.
const estudianteResponsableSchema = new mongoose.Schema(
    {
        estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
        adultoResponsableId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdultoResponsable', required: true },
        vinculo: { type: String, enum: ['Madre', 'Padre', 'Tutor', 'Tutora', 'Otro'], required: true },
        // Si convive, la planilla oficial no pide domicilio aparte (se asume el mismo que
        // el del estudiante) - por eso el domicilio vive en AdultoResponsable, no aca:
        // si no convive, ahi es donde se completa.
        convive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

estudianteResponsableSchema.index({ estudianteId: 1, adultoResponsableId: 1 }, { unique: true });

module.exports = mongoose.model('EstudianteResponsable', estudianteResponsableSchema);
