const mongoose = require('mongoose');

// Catalogo de roles de cargo (Director/a, Preceptor/a, Profesor/a, etc.).
// nombre, nombreCorto y clave son unicos (no puede haber dos roles con el mismo
// nombre/nombreCorto/clave). jerarquia y cargaHoraria NO son unicos a proposito:
// varios roles pueden compartir jerarquia (ej. Director/a y Director/a2, mismo
// rango, distinta carga horaria) o carga horaria (varios roles de 4.5hs).
const rolSchema = new mongoose.Schema(
    {
        nombre: { type: String, required: true, unique: true, trim: true },
        nombreCorto: { type: String, required: true, unique: true, trim: true },
        clave: { type: String, required: true, unique: true, trim: true },
        // Fija por rol, pero opcional: roles como Profesor no tienen una carga horaria
        // propia, depende de las asignaturas/cursos que termine teniendo. El caso
        // "director puede ser 8 o 4.5hs" se resuelve con dos roles distintos
        // (ej. Director/a y Director/a2), no con un valor variable aca.
        cargaHoraria: { type: Number },
        // Orden de la jerarquia de planta (Director 1, Vicedirector 2, Secretario 3...).
        // Con huecos grandes (ej. Profesor 100) para poder insertar roles nuevos en el
        // medio sin renumerar todo. Escala chica, se edita a mano, sin necesidad de
        // subir/bajar como en Asignatura.
        jerarquia: { type: Number, required: true },
        // Que puede hacer alguien con este cargo activo en /estudiantes (ver
        // designacion.repo.js/cargoActivoId - el uso real todavia no esta implementado,
        // esto solo deja el dato cargado). "profesor" = solo su asignatura/curso propios
        // (Cargo.asignaturaId/cursoId), "preceptor" = sus cursos (CargoCurso), "total" =
        // todo lo de estudiantes salvo crear Curso/Anio/Asignatura y salvo baja real (eso
        // es de Usuario.nivelPoder, no de esto). Default "ninguno" a proposito (fail
        // closed, mismo criterio que alcance.tipo en Usuario): los roles ya cargados
        // quedan sin clasificar hasta hacerlo a mano. Enum abierto a sumar valores para
        // cargos nuevos sin rediseñar nada.
        nivelAcceso: {
            type: String,
            enum: ['total', 'preceptor', 'profesor', 'ninguno'],
            default: 'ninguno'
        }
    },
    // Nombre explicito: la pluralizacion automatica de Mongoose da 'rols', no 'roles'.
    { timestamps: true, collection: 'roles' }
);

module.exports = mongoose.model('Rol', rolSchema);
