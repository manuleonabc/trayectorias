const mongoose = require('mongoose');
const aMayusculas = require('../utils/mayusculas');

// Un adulto responsable (madre, padre, tutor/a, etc) - entidad propia y no un Persona
// mas: no siempre tiene DNI argentino (puede ser extranjero), y sobre todo puede repetirse
// entre hermanos que asisten a la misma institucion - se busca por numeroDocumento antes
// de crear uno nuevo (ver estudiante.controller.js), asi dos hijos del mismo adulto
// comparten el mismo registro en vez de duplicarlo. El vinculo con cada estudiante
// (madre/padre/tutor, convive o no) vive en EstudianteResponsable, no aca, porque es
// propio de esa relacion.
const adultoResponsableSchema = new mongoose.Schema(
    {
        // Mismas categorias que la planilla de inscripcion usa tambien para la persona
        // responsable (ver Persona.tipoDocumento).
        tipoDocumento: {
            type: String,
            enum: ['DNI', 'CPI', 'Documento extranjero', 'Sin documento'],
            default: 'DNI'
        },
        numeroDocumento: { type: String, unique: true, sparse: true, trim: true },
        estadoDni: {
            type: String,
            enum: ['Tiene el DNI físico', 'En trámite', 'No tiene el DNI físico y no está en trámite']
        },
        documentoExtranjeroTipo: { type: String, set: aMayusculas, trim: true },
        apellido: { type: String, required: true, set: aMayusculas, trim: true },
        nombre: { type: String, required: true, set: aMayusculas, trim: true },
        nacionalidad: { type: String, set: aMayusculas, trim: true },
        // No se mayusculiza: un email se guarda tal cual se escribe.
        correoElectronico: { type: String, trim: true },
        domicilio: {
            calle: { type: String, set: aMayusculas, trim: true },
            numero: { type: String, set: aMayusculas, trim: true },
            piso: { type: String, set: aMayusculas, trim: true },
            depto: { type: String, set: aMayusculas, trim: true },
            entreCalles: { type: String, set: aMayusculas, trim: true },
            provincia: { type: String, set: aMayusculas, trim: true },
            localidad: { type: String, set: aMayusculas, trim: true },
            partido: { type: String, set: aMayusculas, trim: true }
        },
        telefonos: [{
            descripcion: { type: String, set: aMayusculas, trim: true },
            numero: { type: String, required: true, trim: true }
        }]
    },
    { timestamps: true }
);

module.exports = mongoose.model('AdultoResponsable', adultoResponsableSchema);
