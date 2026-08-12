const mongoose = require('mongoose');

// Un cargo es un puesto de la planta organica funcional, identificado por su CUPOF.
// Existe aunque nadie lo ocupe. Quien lo ocupa y con que situacion de revista vive en
// Designacion (historial), no aca - ver Designacion.
const cargoSchema = new mongoose.Schema(
    {
        // String, no Number: son ~6 digitos pero es un codigo administrativo, no una
        // cantidad (no se suma ni se ordena) - String evita perder ceros a la izquierda.
        // required:false a proposito, no siempre se conoce al crear el cargo - sparse:true
        // para que varios cargos sin cupof no choquen entre si (unicidad solo entre los
        // que SI tienen un valor real).
        cupof: { type: String, unique: true, sparse: true, trim: true },
        // Identifica al cargo en la URL (anidada bajo la institucion) en vez del id de
        // Mongo - solo unica dentro de la institucion. Sugerida como la clave del Rol
        // (o rol+curso+asignatura para los de profesor, ver cargo.repo.js) pero editable
        // a mano si hace falta desambiguar (ej. dos preceptores en la misma institucion).
        clave: { type: String, required: true, trim: true },
        institucionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institucion', required: true },
        rolId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rol', required: true },
        // La carga horaria vive en Rol, no aca (es fija por rol - ver Rol.cargaHoraria) -
        // salvo para los cargos de profesor (ver cursoId/asignaturaId abajo), que no
        // tienen carga horaria propia en ningun lado: siempre es la de su Asignatura.
        // Los cargos jerarquicos (director/vice/secretario) suelen alternar turno segun
        // conveniencia institucional, por eso no es obligatorio.
        turnoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turno' },
        // Solo para cargos de profesor, generados automaticamente al crear un Curso (uno
        // por cada Asignatura del plan de estudio de ese año/orientacion) - un cargo asi
        // no puede existir sin su Asignatura. El resto de los cargos (director, preceptor,
        // etc) no usan estos dos campos. Indice unico compuesto mas abajo: un mismo curso
        // no puede tener dos cargos para la misma asignatura.
        cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
        asignaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asignatura' }
    },
    { timestamps: true }
);

// sparse: en los cargos que no son de profesor, cursoId/asignaturaId estan ausentes en
// los dos a la vez (nunca uno solo) - el indice los deja afuera y no chocan entre si.
cargoSchema.index({ cursoId: 1, asignaturaId: 1 }, { unique: true, sparse: true });
cargoSchema.index({ institucionId: 1, clave: 1 }, { unique: true });

module.exports = mongoose.model('Cargo', cargoSchema);
