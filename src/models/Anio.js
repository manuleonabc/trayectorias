const mongoose = require('mongoose');

// Catalogo de años (1ro a 6to). El ciclo decide si el plan de estudio se ramifica
// por orientacion (superior) o es una unica lista fija (basico).
const anioSchema = new mongoose.Schema(
    {
        clave: { type: String, required: true, unique: true, trim: true },
        nombre: { type: String, required: true, trim: true },
        ciclo: { type: String, enum: ['basico', 'superior'], required: true },
        // Orden numerico absoluto (1..6) para saber si un año es anterior o posterior a
        // otro - lo necesita la trayectoria para ofrecer materias atrasadas sin permitir
        // adelantar. sparse (mismo motivo que Cargo.cupof): los Anio ya creados antes de
        // este campo no lo tienen, y sparse evita que varios "sin grado" choquen entre si
        // mientras se completan a mano.
        grado: { type: Number, unique: true, sparse: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Anio', anioSchema);
