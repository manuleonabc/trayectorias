// repos/usuarioRepo.js
const Usuario = require('../models/Usuario'); // El modelo que definimos antes
//const Ciie = require('../models/Ciie'); // <--

class UsuarioRepo {
    // Reemplaza a 'obtenerTodasLasFilas'
    async obtenerTodos() {
        // En Mongo no hay rangos, solo pedimos la colección completa
        return await Usuario.find({}).populate('perfilId'); 
    }

    async buscarPorEmail(email) {
        // La 'i' al final significa "case-insensitive" (ignora mayúsculas/minúsculas)
        return await Usuario.findOne({ email: new RegExp(`^${email}$`, 'i') });
    }

    // Reemplaza a 'insertarFila'
    async postUsuario(datosUsuario) {
        // En lugar de pasar un array [valor1, valor2], pasamos un objeto { email: '...', rol: '...' }
        const nuevoUsuario = new Usuario(datosUsuario);
        return await nuevoUsuario.save();
    }

    
}

module.exports = new UsuarioRepo();