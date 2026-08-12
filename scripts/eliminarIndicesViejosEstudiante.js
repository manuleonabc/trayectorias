// Migracion puntual: borra indices viejos en la coleccion "estudiantes" que quedaron de una
// version anterior del modelo (antes tenia nombre/apellido/dni/curso propios directo en
// Estudiante - ver Estudiante.js, hoy solo tiene personaId+legajo, los datos personales
// viven en Persona). Mongoose nunca borra indices que ya no estan en el schema actual, solo
// crea los que faltan - estos quedan pegados en Mongo para siempre hasta que alguien los
// borre a mano.
//
// Sintoma real que motivo este script: "MongoServerError: E11000 duplicate key ... index:
// dni_1 dup key: { dni: null }" al dar de alta un segundo estudiante - el indice unico (no
// sparse) sobre "dni" trata a cualquier documento sin ese campo como dni:null, y solo deja
// que UN documento tenga ese valor.
//
// Correr una sola vez, desde la raiz del proyecto: node scripts/eliminarIndicesViejosEstudiante.js
// Idempotente: si ya no quedan indices viejos, no hace nada.
require('dotenv').config();
const conectarDB = require('../src/config/db');
const mongoose = require('mongoose');
require('../src/models/Estudiante');

// Los unicos indices que el schema actual de Estudiante necesita, ademas de _id.
const INDICES_VIGENTES = new Set(['_id_', 'personaId_1', 'legajo_1']);

async function main() {
    await conectarDB();

    const coleccion = mongoose.connection.collection('estudiantes');
    const indices = await coleccion.indexes();
    console.log('Indices encontrados:', indices.map((i) => i.name).join(', '));

    const aBorrar = indices.filter((i) => !INDICES_VIGENTES.has(i.name));

    if (aBorrar.length === 0) {
        console.log('No hay indices viejos para borrar - ya esta al dia.');
    }

    for (const indice of aBorrar) {
        try {
            await coleccion.dropIndex(indice.name);
            console.log(`OK: borrado el indice "${indice.name}"`);
        } catch (error) {
            console.error(`ERROR al borrar el indice "${indice.name}": ${error.message}`);
        }
    }

    console.log('\nListo.');
    process.exit(0);
}

main().catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
});
