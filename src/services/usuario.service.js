const usuarioRepo = require('../repos/usuario.repo');
const personaService = require('./personaService');
const institucionService = require('./institucionService');

class UsuarioService {
    
    async verificarPermiso(email) {
        try {
            // En Mongo, le pedimos a la DB que busque solo ese email. 
            // Es instantáneo, sin importar si hay 10 o 1.000.000 de filas.
            const usuario = await usuarioRepo.buscarPorEmail(email);
            
            if (!usuario) return null;

            // Retornamos el objeto completo (ya no es un array f[6])
            return usuario;
        } catch (error) {
            console.error('Error en verificarPermiso:', error);
            throw error;
        }
    }

    async postUsuario(datos, usuarioGoogle) {
    try {
        let entidadId;

        if (usuarioGoogle.tipo === 'institucion') {
            const nuevaInstitucion = await institucionService.postInstitucion(datos, usuarioGoogle);
            entidadId = nuevaInstitucion._id;
        } else {
            const nuevaPersona = await personaService.postPersona(datos, usuarioGoogle);
            entidadId = nuevaPersona._id;
        }

        const nuevoUsuario = await usuarioRepo.postUsuario({
            email:     usuarioGoogle.email,
            tipo:      usuarioGoogle.tipo || 'personal',
            estado:    usuarioGoogle.estadoInicial || 'pendiente',
            rol:       usuarioGoogle.rolInicial || 'usuario',
            alcance:   usuarioGoogle.alcanceInicial,
            entidadId: entidadId,
            tipoModel: usuarioGoogle.tipoModel || 'Persona',
        });

        return nuevoUsuario;
    } catch (error) {
        console.error('Error al dar de alta en Mongo:', error);
        throw error;
    }
}

// Función genérica para obtener pendientes según el modelo (Persona o Ciie)
    async getSolicitudesPorTipo(tipoModel) {
        try {
            // Le pedimos al repo que busque por estado y por el modelo de referencia
            return await usuarioRepo.getPendientesPorModelo(tipoModel);
        } catch (error) {
            console.error(`Error al obtener pendientes de ${tipoModel}:`, error);
            throw error;
        }
    }

    // O bien, funciones directas si preferís claridad absoluta
    // async obtenerCiiesPendientes() {
    //     return await this.obtenerSolicitudesPorTipo('Ciie');
    // }

    // async obtenerPersonasPendientes() {
    //     return await this.obtenerSolicitudesPorTipo('Persona');
    // }

    async getPorModelo(tipoModel) {
        try {
            return await  usuarioRepo.getPorModelo(tipoModel);
        } catch (error) {
            console.error('Error al listar las instituciones:', error)
            throw error}
        }
    
    // async putEstadoUsuario(clave, nuevoEstado) {
    //     try {
    //         const usuarioActualizado = await usuarioRepo.actualizarEstado(clave, nuevoEstado);
    //         if (!usuarioActualizado) throw new Error('Usuario no encontrado');
    //         return usuarioActualizado;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    async putEstadoUsuario(identificador, nuevoEstado, tipo) {
    if (tipo === 'Persona') {
        return await usuarioRepo.putEstadoUsuarioPersona(identificador, nuevoEstado);
    } else {
        return await usuarioRepo.putEstadoUsuarioCiie(identificador, nuevoEstado);
    }
}
}

module.exports = new UsuarioService();