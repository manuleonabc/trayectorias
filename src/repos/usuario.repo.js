// repos/usuarioRepo.js
const Usuario = require('../models/Usuario'); // El modelo que definimos antes
const Persona = require('../models/Persona');
//const Ciie = require('../models/Ciie'); // <--

class UsuarioRepo {
    // Reemplaza a 'obtenerTodasLasFilas'
    async obtenerTodos() {
        // En Mongo no hay rangos, solo pedimos la colección completa. El campo se llama
        // entidadId (ver Usuario.js) - populate('perfilId') no hacia nada, ese path no
        // existe en el schema.
        return await Usuario.find({}).populate('entidadId');
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

    async obtenerPorId(id) {
        return await Usuario.findById(id);
    }

    // Para /admin/usuarios - las cuentas nuevas (Usuario.estado default 'pendiente', ver
    // el modelo) que un admin todavia tiene que aprobar o rechazar antes de que puedan
    // entrar (ver el chequeo de estado en auth.router.js).
    async obtenerPendientes() {
        return await Usuario.find({ estado: 'pendiente' }).sort({ createdAt: 1 }).populate('entidadId');
    }

    // Ya resueltas (aprobadas o rechazadas) - se muestran aparte, de solo lectura, para
    // tener contexto de a quien ya se le decidio algo sin mezclarlas con las pendientes.
    async obtenerResueltos() {
        return await Usuario.find({ estado: { $ne: 'pendiente' } }).sort({ updatedAt: -1 }).populate('entidadId');
    }

    async actualizarEstado(id, estado) {
        return await Usuario.findByIdAndUpdate(id, { estado }, { new: true });
    }

    // Solo las Persona que tienen su propia cuenta de Usuario (agentes con mail
    // @abc.gob.ar) - Persona es un modelo compartido con Estudiante, que NUNCA tiene
    // Usuario propio, asi que un Persona.find({}) sin filtrar tambien trae estudiantes.
    // Usado para el selector de "Designar" de un Cargo (ver admin/cargo.controller.js).
    async obtenerPersonasConCuenta() {
        const entidadIds = await Usuario.find({ tipoModel: 'Persona' }).distinct('entidadId');
        return await Persona.find({ _id: { $in: entidadIds } }).sort({ apellido: 1 });
    }
}

module.exports = new UsuarioRepo();