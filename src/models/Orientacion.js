const mongoose = require('mongoose');

// Catalogo de orientaciones del ciclo superior (4to a 6to año). El plan de
// estudios de cada orientacion es igual en toda la provincia (no varia por institucion).
const orientacionSchema = new mongoose.Schema(
    {
        nombre: { type: String, required: true, unique: true, trim: true },
        nombreCorto: { type: String, required: true, trim: true },
        clave: { type: String, required: true, unique: true, trim: true }
    },
    // Nombre explicito: la pluralizacion automatica de Mongoose ('orientacions')
    // choca con una coleccion vieja de otro intento que se dejo sin usar a proposito.
    { timestamps: true, collection: 'orientaciones' }
);

module.exports = mongoose.model('Orientacion', orientacionSchema);
