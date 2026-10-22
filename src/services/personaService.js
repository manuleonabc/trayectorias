const Persona = require('../models/Persona');

const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

class PersonaService {
    async postPersona(datos, usuarioGoogle) {
        const numeroDocumento = soloDigitos(datos.dni) || undefined;

        // Si gestion ya lo habia cargado como docente provisorio (para poder designarlo
        // antes de su alta, ver Persona.provisoria), se completa esa misma Persona en vez
        // de crear otra - asi conserva las designaciones que ya tiene.
        const provisoria = numeroDocumento
            ? await Persona.findOne({ numeroDocumento, provisoria: true })
            : null;
        if (provisoria) {
            provisoria.cuil = datos.cuil || provisoria.cuil;
            provisoria.apellido = usuarioGoogle.apellido || datos.apellido || provisoria.apellido;
            provisoria.nombre = usuarioGoogle.nombre || datos.nombre || provisoria.nombre;
            if (datos.fecha_nacimiento) provisoria.fecha_nacimiento = datos.fecha_nacimiento;
            if (datos.genero) provisoria.genero = datos.genero;
            provisoria.provisoria = undefined;
            return await provisoria.save();
        }

        const nuevaPersona = new Persona({
            cuil:             datos.cuil,
            numeroDocumento,
            apellido:         usuarioGoogle.apellido || datos.apellido,
            nombre:           usuarioGoogle.nombre   || datos.nombre,
            fecha_nacimiento: datos.fecha_nacimiento || null,
            genero:           datos.genero           || null
        });
        return await nuevaPersona.save();
    }
}

module.exports = new PersonaService();
