// Sincroniza la base con los modelos actuales: crea las colecciones e indices que falten
// (por ejemplo, al agregar un modelo nuevo como SolicitudReubicacion, cuyo indice unico
// parcial "una sola pendiente por estudiante" tiene que existir en Mongo para funcionar
// como backstop). NO borra nada: los indices que estan en Mongo pero ya no en el schema
// solo se informan (para borrarlos, ver el patron de scripts/eliminarIndicesViejosEstudiante.js).
//
// Correr desde la raiz del proyecto: node scripts/sincronizarIndices.js
// Idempotente: si ya esta todo al dia, no cambia nada.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const conectarDB = require('../src/config/db');

const dirModelos = path.join(__dirname, '../src/models');
fs.readdirSync(dirModelos).filter((f) => f.endsWith('.js')).forEach((f) => require(path.join(dirModelos, f)));

async function main() {
    await conectarDB();

    // Un modelo que falla (ej: datos viejos que violan un indice unico nuevo) no frena al
    // resto - se informa y el script termina con codigo de error.
    let fallidos = 0;
    for (const nombre of mongoose.modelNames()) {
        const Modelo = mongoose.model(nombre);
        try {
            await Modelo.createCollection();
            const antes = await Modelo.diffIndexes();
            await Modelo.createIndexes();
            const creados = antes.toCreate.map((i) => JSON.stringify(i));
            const sobrantes = antes.toDrop;
            console.log(`${nombre}: ${creados.length ? 'creados ' + creados.join(', ') : 'al dia'}`
                + (sobrantes.length ? ` | sobrantes (no se borran): ${sobrantes.join(', ')}` : ''));
        } catch (err) {
            fallidos++;
            console.error(`${nombre}: ERROR - ${err.message}`);
        }
    }
    if (fallidos) process.exitCode = 1;

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
