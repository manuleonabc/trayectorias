const mongoose = require('mongoose');

// Registro minimo de "quien hizo que" para las acciones sensibles/irreversibles del
// sistema (baja real de Estudiante, eliminar Curso, altas/bajas de Designacion) - el resto
// del CRUD (editar clave de un Turno, crear una Orientacion, etc.) no se audita, no aporta
// mucho y ensuciaria cada modelo. hechoPor es el nombre de usuario del mail (antes del @),
// no un _id de Usuario - pedido explicitamente asi, mas legible para leer el registro a
// mano. No hay pantalla para verlo todavia, se consulta directo en Mongo.
const auditoriaSchema = new mongoose.Schema(
    {
        accion: {
            type: String,
            enum: ['eliminar_estudiante', 'eliminar_curso', 'alta_designacion', 'baja_designacion'],
            required: true
        },
        descripcion: { type: String, required: true, trim: true },
        hechoPor: { type: String, required: true, trim: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Auditoria', auditoriaSchema);
