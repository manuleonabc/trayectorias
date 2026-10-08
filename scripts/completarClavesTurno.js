// Migracion puntual: completa la clave de los turnos creados antes de que Turno tuviera el
// campo "clave" (ver Turno.js) - sin clave no se puede entrar a su detalle por URL, y el
// indice unico { institucionId, clave } no se puede crear (todos cuentan como clave: null
// dentro de la misma institucion). La clave se deriva del nombre, mismo formato que sugiere
// el form de alta (admin/turnos.ejs, "Ej: manana"): minusculas, sin acentos, guiones.
//
// Correr una sola vez, desde la raiz del proyecto: node scripts/completarClavesTurno.js
// Idempotente: solo toca turnos que todavia no tienen clave.
require('dotenv').config();
const mongoose = require('mongoose');
const conectarDB = require('../src/config/db');
const Turno = require('../src/models/Turno');

const aClave = (nombre) => nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
    await conectarDB();

    const sinClave = await Turno.find({ $or: [{ clave: { $exists: false } }, { clave: null }, { clave: '' }] });
    console.log(`Encontrados ${sinClave.length} turnos sin clave.`);

    for (const turno of sinClave) {
        const base = aClave(turno.nombre);
        let clave = base;
        let n = 2;
        while (await Turno.exists({ institucionId: turno.institucionId, clave, _id: { $ne: turno._id } })) {
            clave = `${base}-${n++}`;
        }
        await Turno.updateOne({ _id: turno._id }, { $set: { clave } });
        console.log(`  ${turno.nombre} -> ${clave}`);
    }

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
