const mongoose = require('mongoose');

// Un estudiante es una Persona (mismo patron que Cargo.personaId) - los datos propios
// (nombre, dni, etc) viven en Persona, no aca. No tiene institucionId ni curso propios:
// se derivan de su Inscripcion vigente (ver inscripcion.repo.js), para no arrastrar un
// campo que se desactualice si alguien se olvida de sincronizarlo a mano - mismo criterio
// que "activa" en Designacion.
const estudianteSchema = new mongoose.Schema(
    {
        personaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Persona', required: true, unique: true },
        // "{clave de la institucion que lo inscribe}-{numero incremental en esa
        // institucion}", asignado una sola vez al dar de alta (no cambia si despues se
        // transfiere de escuela). Sirve de clave en la URL cuando la Persona no tiene DNI
        // - ver estudiante.repo.js. Se genera solo, nunca se carga a mano.
        legajo: { type: String, required: true, unique: true, trim: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Estudiante', estudianteSchema);
