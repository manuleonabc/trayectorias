const Institucion = require('../models/Institucion');

class InstitucionService {
    async postInstitucion(datos, usuarioGoogle) {
        const nuevaInstitucion = new Institucion({
            cue:       datos.cue,
            clave:     usuarioGoogle.clave || null,
            nombre:    datos.nombre || `${usuarioGoogle.nombre} ${usuarioGoogle.apellido}`,
            nivel:     datos.nivel || null,
            modalidad: datos.modalidad || null,
            numero:    datos.numero || null,
            partido:   datos.partido || 'La Matanza',
            domicilio: datos.domicilio || null,
            telefono:  datos.telefono || null,
            email:     usuarioGoogle.email
        });
        return await nuevaInstitucion.save();
    }
}

module.exports = new InstitucionService();
