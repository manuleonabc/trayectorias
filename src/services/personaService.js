const Persona = require('../models/Persona');

class PersonaService {
    async postPersona(datos, usuarioGoogle) {
        const nuevaPersona = new Persona({
            cuil:             datos.cuil,
            numeroDocumento:  datos.dni,
            apellido:         usuarioGoogle.apellido || datos.apellido,
            nombre:           usuarioGoogle.nombre   || datos.nombre,
            fecha_nacimiento: datos.fecha_nacimiento || null,
            genero:           datos.genero           || null
        });
        return await nuevaPersona.save();
    }
}

module.exports = new PersonaService();
