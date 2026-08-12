const mongoose = require('mongoose');

// Periodo de ausencia temporal de quien sostiene una Designacion (licencia medica, por
// estudio, etc). No toca fechaBaja de la Designacion - la relacion sigue vigente, solo
// deja de ser la activa mientras dure. Una Designacion puede tener varias Licencias a lo
// largo de su vida, por eso es una coleccion aparte y no un campo de Designacion. Dar de
// alta un suplente requiere una Licencia (existente o cargada en el momento) para la
// designacion que va a cubrir - ver designacion.repo.js.
const licenciaSchema = new mongoose.Schema(
    {
        designacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designacion', required: true },
        motivo: { type: String, required: true, trim: true },
        fechaInicio: { type: Date, required: true },
        // null = en curso.
        fechaFin: { type: Date, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Licencia', licenciaSchema);
