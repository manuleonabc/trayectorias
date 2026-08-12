const mongoose = require('mongoose');

// Una materia puntual dentro de un contexto curricular (año + orientacion), no un
// catalogo generico: el nombre y la clave se cargan directo aca, porque "Matematica
// de 1ro" no es la misma entidad que "Matematica" de otro año.
//
// orientacionId null = plantilla del año (o el plan definitivo si el año es ciclo basico).
// Al agregar una orientacion a un año superior, estas filas se clonan como punto de
// partida para esa combinacion especifica, quedando totalmente independientes desde ahi
// (se puede reordenar o quitar sin afectar la plantilla ni otras orientaciones).
const asignaturaSchema = new mongoose.Schema(
    {
        anioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Anio', required: true },
        orientacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Orientacion', default: null },
        nombre: { type: String, required: true, trim: true },
        nombreCorto: { type: String, required: true, trim: true },
        clave: { type: String, required: true, trim: true },
        cargaHoraria: { type: Number, required: true },
        orden: { type: Number, required: true }
    },
    { timestamps: true, collection: 'asignaturas' }
);

module.exports = mongoose.model('Asignatura', asignaturaSchema);
