const mongoose = require('mongoose');

// Configuracion institucional principal de cada institucion.
const esquemaInstitucion = new mongoose.Schema(
    {
        cue: { type: String, required: true, unique: true, trim: true },
        clave: { type: String, unique: true, sparse: true, trim: true },
        nombre: { type: String, required: true, trim: true },
        nivel: { type: String, enum: ['primaria', 'secundaria', 'secundaria-tecnica'] },
        modalidad: { type: String, trim: true },
        numero: { type: String, trim: true },
        partido: { type: String, default: 'La Matanza', trim: true },
        domicilio: { type: String, trim: true },
        telefono: { type: String, trim: true },
        email: { type: String, trim: true },
        directorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personal' },
        tipoCalificacionActivoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TipoCalificacion'
        },
        tiposCalificacionesUsados: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TipoCalificacion'
        }],
        activo: { type: Boolean, default: true }
    },
    { timestamps: true, collection: 'instituciones' }
);

module.exports = mongoose.model('Institucion', esquemaInstitucion);