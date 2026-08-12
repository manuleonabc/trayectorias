// Migracion puntual: recalcula la clave de los cargos de profesor ya existentes al nuevo
// formato "asignatura.clave-curso.clave" (antes era "rol.clave-curso.clave-asignatura.clave"
// - ver cargoRepo.generarParaCurso). Los cargos NUEVOS ya se generan con el formato nuevo
// solos, esto es solo para los que quedaron con el viejo.
//
// Correr una sola vez, desde la raiz del proyecto: node scripts/renombrarClavesProfesor.js
// Idempotente: si se corre dos veces, la segunda vez no cambia nada (ya estan al dia).
require('dotenv').config();
const conectarDB = require('../src/config/db');
const Cargo = require('../src/models/Cargo');
// Se requieren aunque no se usen directo - populate() necesita que el modelo ya este
// registrado en mongoose (mongoose.model(...) se ejecuta al importar el archivo), sino
// tira MissingSchemaError.
require('../src/models/Asignatura');
require('../src/models/Curso');

async function main() {
    await conectarDB();

    // Cargo de profesor = tiene cursoId Y asignaturaId (el resto de los cargos no tienen
    // ninguno de los dos, ver Cargo.js).
    const cargos = await Cargo.find({ cursoId: { $ne: null }, asignaturaId: { $ne: null } })
        .populate('asignaturaId')
        .populate('cursoId');

    console.log(`Encontrados ${cargos.length} cargos de profesor.`);

    let renombrados = 0;
    let sinCambios = 0;
    let errores = 0;

    for (const cargo of cargos) {
        if (!cargo.asignaturaId || !cargo.cursoId) {
            console.warn(`SALTEADO ${cargo._id}: referencia a asignatura o curso rota (no se encontro el documento).`);
            errores++;
            continue;
        }

        const claveVieja = cargo.clave;
        const claveNueva = `${cargo.asignaturaId.clave}-${cargo.cursoId.clave}`;

        if (claveVieja === claveNueva) {
            sinCambios++;
            continue;
        }

        try {
            cargo.clave = claveNueva;
            await cargo.save();
            console.log(`OK: "${claveVieja}" -> "${claveNueva}"`);
            renombrados++;
        } catch (error) {
            console.error(`ERROR en cargo ${cargo._id} ("${claveVieja}" -> "${claveNueva}"): ${error.message}`);
            errores++;
        }
    }

    console.log(`\nListo. Renombrados: ${renombrados} | Ya estaban al día: ${sinCambios} | Errores: ${errores}`);
    process.exit(errores > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
});
