const mongoose = require('mongoose');
require('dotenv').config();

// Abre conexion con MongoDB y propaga error para abortar el arranque del servidor.
const conectarDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB conectado');
    } catch (error) {
        console.error('Error de conexion:', error.message);
        throw error;
    }
};

module.exports = conectarDB;