const mongoose = require('mongoose');

// Grilla horaria de una institucion (ej: "Mañana", "Tarde"). Cada institucion define su propia
// grilla de modulos (horas de clase y recreos), los horarios no son iguales entre instituciones.
const turnoSchema = new mongoose.Schema(
    {
        institucionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institucion', required: true },
        nombre: { type: String, required: true, trim: true },
        // Identifica al turno en la URL (anidada bajo la institucion) en vez del id de
        // Mongo - solo necesita ser unica dentro de la institucion, no global.
        clave: { type: String, required: true, trim: true },
        modulos: [
            {
                nombre: { type: String, required: true, trim: true },
                horaInicio: { type: String, required: true, trim: true },
                horaFin: { type: String, required: true, trim: true },
                tipo: { type: String, enum: ['clase', 'recreo'], required: true }
            }
        ]
    },
    { timestamps: true }
);

turnoSchema.index({ institucionId: 1, clave: 1 }, { unique: true });

module.exports = mongoose.model('Turno', turnoSchema);
