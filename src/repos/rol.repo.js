const Rol = require('../models/Rol');

class RolRepo {
    async crear(datosRol) {
        const nuevoRol = new Rol(datosRol);
        return await nuevoRol.save();
    }

    async obtenerTodos() {
        return await Rol.find({}).sort({ jerarquia: 1 });
    }

    async obtenerPorId(id) {
        return await Rol.findById(id);
    }

    async obtenerPorJerarquia(jerarquia) {
        return await Rol.findOne({ jerarquia });
    }

    async obtenerPorNivelAcceso(nivelAcceso) {
        return await Rol.findOne({ nivelAcceso });
    }

    async obtenerPorClave(clave) {
        return await Rol.findOne({ clave });
    }

    // Para roles que ya existian antes de que nivelAcceso existiera (quedaron en el
    // default 'ninguno', ver Rol.js) - sin esto no habia forma de corregirlos, solo de
    // crear roles nuevos ya clasificados. Mismo gap que ya se dio con Institucion.clave/
    // Cargo.clave/Turno.clave: un campo agregado despues, sin pantalla para completarlo en
    // los documentos viejos.
    async actualizar(id, datosRol) {
        return await Rol.findByIdAndUpdate(id, datosRol, { new: true, runValidators: true });
    }
}

module.exports = new RolRepo();
