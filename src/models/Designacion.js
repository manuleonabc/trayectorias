const mongoose = require('mongoose');

// Historial de quien ocupa un Cargo y con que situacion de revista. Cargo ya no tiene
// personaId/estado propios porque esta relacion no es 1:1 estatica: normalmente hay una
// sola Designacion vigente (fechaBaja null) por cargo, pero mientras alguien tiene un
// suplente cubriendolo, ambas relaciones quedan vigentes a la vez (la cubierta y la del
// suplente activo) - y un suplente puede a su vez tener su propio suplente.
//
// No hay un campo "activa"/"en licencia": se deduce por historial. Entre las vigentes de
// un mismo cargo, la de fechaAlta mas reciente es quien esta activo hoy; las anteriores
// estan cubiertas por un suplente. Tampoco hay un campo que diga a quien reemplaza cada
// suplente - se deduce del orden cronologico de las vigentes de ese cargo (ver
// designacion.repo.js), asi si cambia un eslabon de la cadena no hace falta reescribir
// los que dependen de el.
const designacionSchema = new mongoose.Schema(
    {
        cargoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cargo', required: true },
        personaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Persona', required: true },
        situacionRevista: {
            type: String,
            enum: ['titular', 'provisional', 'interino', 'suplente'],
            required: true
        },
        fechaAlta: { type: Date, required: true },
        // null = vigente. Cuando se cierra es definitivo (no es lo mismo que una licencia,
        // que no toca esta relacion - ver Licencia).
        fechaBaja: { type: Date, default: null },
        motivoBaja: { type: String, trim: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Designacion', designacionSchema);
