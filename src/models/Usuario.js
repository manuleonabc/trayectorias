// models/Usuario.js
const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true }, // Aquí entran las cuentas @abc.gob.ar
    tipo: { 
        type: String, 
        enum: ['institucion', 'personal'], 
        required: true 
    },
    entidadId: { //puede ser una persona o una institucion, dependiendo del tipo
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'tipoModel'
    },
    tipoModel: {
        type: String,
        required: true,
        enum: ['Persona', 'Institucion']
    },
        rol: { 
        type: String, 
        enum: ['usuario','observador', 'admin'], 
        default: 'usuario' 
    },
    estado: {
    type: String,
    required: true,
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente'
},
    // Solo tiene sentido cuando rol === 'admin': que instituciones puede administrar.
    // tipo 'distrito' = sin restriccion, tipo 'escuela' = limitado a 'instituciones'.
    alcance: {
        tipo: { type: String, enum: ['distrito', 'institucion'], default: null },
        instituciones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Institucion' }]
    },
    // Solo tiene sentido cuando rol === 'admin' - eje independiente de alcance (alcance es
    // CUANTAS instituciones administra, esto es QUE puede hacer). 'total' habilita baja
    // real de estudiante y crear Anio/Asignatura (estructura curricular de todo el
    // distrito) - 'gestion' (default) puede todo lo demas administrativo, incluido crear
    // Curso (es interno de cada institucion, no tan "duro" como Anio/Asignatura).
    nivelPoder: { type: String, enum: ['total', 'gestion'], default: 'gestion' }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', UsuarioSchema);