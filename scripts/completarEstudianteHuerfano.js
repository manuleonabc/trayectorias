// Repara el caso puntual descripto por el usuario: un alta de estudiante que fallo a mitad
// de camino (por el bug del indice viejo "dni_1", ver
// scripts/eliminarIndicesViejosEstudiante.js) dejo una Persona guardada pero SIN su
// Estudiante correspondiente - no se puede recrear desde la UI (el chequeo de duplicados la
// encuentra por su numero de documento) ni aparece en "Inscribir estudiante existente"
// (esa lista sale de Estudiante, no de Persona). Este script completa lo que falto: crea el
// Estudiante que le hubiera correspondido, con un legajo generado igual que en el alta
// normal. Despues de correrlo, el estudiante va a aparecer en "Inscribir estudiante
// existente" en el curso que corresponda, listo para matricular normalmente.
//
// Uso, desde la raiz del proyecto:
//   node scripts/completarEstudianteHuerfano.js <numeroDocumento> <claveDeLaInstitucion>
//
// La clave de institucion es la misma que se ve en /admin/instituciones o en la URL de
// /admin/instituciones/:institucionClave/cursos - hace falta porque el legajo se arma como
// "{institucionClave}-{numero}", y esa informacion no quedo guardada en ningun lado (la
// Persona no sabe a que institucion la estaban por inscribir).
require('dotenv').config();
const conectarDB = require('../src/config/db');
const Persona = require('../src/models/Persona');
const Estudiante = require('../src/models/Estudiante');
const Institucion = require('../src/models/Institucion');

async function main() {
    const [numeroDocumento, institucionClave] = process.argv.slice(2);
    if (!numeroDocumento || !institucionClave) {
        console.error('Uso: node scripts/completarEstudianteHuerfano.js <numeroDocumento> <claveDeLaInstitucion>');
        process.exit(1);
    }

    await conectarDB();

    const persona = await Persona.findOne({ numeroDocumento });
    if (!persona) {
        console.error(`No se encontro ninguna Persona con numeroDocumento "${numeroDocumento}".`);
        process.exit(1);
    }
    console.log(`Persona encontrada: ${persona.apellido}, ${persona.nombre} (${persona._id}).`);

    const yaExiste = await Estudiante.findOne({ personaId: persona._id });
    if (yaExiste) {
        console.log(`Ya tiene un Estudiante con legajo "${yaExiste.legajo}" - no hace falta hacer nada.`);
        process.exit(0);
    }

    const institucion = await Institucion.findOne({ clave: institucionClave });
    if (!institucion) {
        console.error(`No se encontro ninguna Institucion con clave "${institucionClave}".`);
        process.exit(1);
    }

    const prefijo = `${institucion.clave}-`;
    const cantidad = await Estudiante.countDocuments({ legajo: new RegExp('^' + prefijo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    const legajo = `${prefijo}${cantidad + 1}`;

    const estudiante = await Estudiante.create({ personaId: persona._id, legajo });
    console.log(`\nOK: Estudiante creado con legajo "${estudiante.legajo}".`);
    console.log('Ahora podés matricularlo desde "Inscribir estudiante existente" en el curso que corresponda.');
    process.exit(0);
}

main().catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
});
