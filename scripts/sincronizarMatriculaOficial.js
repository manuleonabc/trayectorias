// Deja la matricula vigente de la EES N 62 (clave 0069MS0062) igual a la planilla oficial
// consolidada (estudiantes_ees62_consolidado.csv, columnas: Escuela, Turno, Año, Sección,
// Orientación, Nombre_y_Apellido, DNI, Estado_Inscripción, Fecha_Inscripción,
// Fecha_Inicio_Estado). Pedido explicito del usuario (2026-10-08): "la base debe quedar
// como el documento" - todo vigente que no este en la planilla se da de baja (no se borra
// nada, queda en el historial), incluso duplicados con tutores cargados.
//
// Uso, desde la raiz del proyecto:
//   node scripts/sincronizarMatriculaOficial.js <ruta.csv>            -> dry run (no escribe)
//   node scripts/sincronizarMatriculaOficial.js <ruta.csv> --commit   -> escribe de verdad
//
// Que hace, por cada fila del CSV:
// - Estado distinto de BAJA: busca al estudiante por DNI; si no esta, por la tabla
//   CORRECCIONES_DNI (registros ya cargados con el DNI mal tipeado o sin DNI - se les
//   corrige el DNI, se deja el nombre que ya tenian porque el CSV trae caracteres rotos
//   como "MART?N"); si tampoco, lo da de alta con el nombre de ALTAS_NUEVAS. Despues se
//   asegura de que su vigente sea el curso de la planilla (si esta en otro, cambio de
//   curso via inscribirExistenteEnCurso - mismo camino que la app).
// - Estado BAJA: si tiene vigente, la cierra con Fecha_Inicio_Estado.
// - Al final: toda inscripcion vigente de la escuela que no haya quedado "reclamada" por
//   una fila del CSV se cierra con motivo "No figura en matrícula oficial".
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const conectarDB = require('../src/config/db');
const Persona = require('../src/models/Persona');
const Estudiante = require('../src/models/Estudiante');
const Inscripcion = require('../src/models/Inscripcion');
const Institucion = require('../src/models/Institucion');
const Curso = require('../src/models/Curso');
require('../src/models/Anio');
require('../src/models/Turno');
require('../src/models/Orientacion');
const estudianteRepo = require('../src/repos/estudiante.repo');
const inscripcionRepo = require('../src/repos/inscripcion.repo');
const cursadaAsignaturaRepo = require('../src/repos/cursadaAsignatura.repo');
const { resolverMateriaIds, inscribirExistenteEnCurso } = require('../src/controllers/estudiante.controller');

const CSV_PATH = process.argv[2];
const COMMIT = process.argv.includes('--commit');
const INSTITUCION_CLAVE = '0069MS0062';
const CICLO_LECTIVO = 2026;
const HOY = new Date('2026-10-08T00:00:00.000Z');
const MOTIVO_NO_FIGURA = 'No figura en matrícula oficial';

// DNI de la planilla -> legajo del registro existente que es esa misma persona (DNI con
// 1-3 digitos distintos o sin DNI, mismo nombre y casi siempre mismo curso). Revisado a
// mano el 2026-10-08 - en los duplicados sin DNI (importacion corrida dos veces) se toma
// el legajo mas bajo; la otra copia queda sin reclamar y se da de baja.
const CORRECCIONES_DNI = {
    50610554: '0069MS0062-9', // MOLINA FLORES IVAN (50610559)
    53445918: '0069MS0062-17', // DIAZ DEMIAN (sin DNI)
    53130265: '0069MS0062-24', // MARTINEZ ZOE PILAR (33609401)
    52779247: '0069MS0062-130', // GUTIERREZ TAHIEL DARIO (52799247)
    51246511: '0069MS0062-140', // LUNA MATIAS FABIAN (sin DNI)
    52590079: '0069MS0062-160', // BARRIENTOS ROMAN (52590679)
    51246666: '0069MS0062-173', // MENDIETA LUCAS (51246660)
    50390063: '0069MS0062-275', // GODOY ALEXIS (sin DNI)
    50277268: '0069MS0062-312', // GAITAN FRANCO LISANDRO D. (50277260)
    50138473: '0069MS0062-324', // DIAZ ZOE VALENTINA (50138475)
    51126958: '0069MS0062-339', // ALGARIN VENIALGO AXEL (51126956)
    50687665: '0069MS0062-347', // GUILLEN FACUNDO (50687811)
    49934809: '0069MS0062-361', // LIVORSI BAUTISTA JOAQUIN (49434809)
    50488386: '0069MS0062-389', // FRANCO ALEXIS LUCAS (50448386)
    49607565: '0069MS0062-400', // BENITEZ AXEL URIEL (49607656)
    48679309: '0069MS0062-449', // FERRARIS KIARA MORENA (48479309)
    50289753: '0069MS0062-511', // FRANCO DURE THIAGO MARTIN (50209753)
    48984710: '0069MS0062-536', // AQUINO HECTOR MARTIN (48964710)
    49232780: '0069MS0062-555', // REINOSO JOAQUIN (49232700)
    45595027: '0069MS0062-591', // ESPINDOLA ZAIRA BELEN (49595027)
    49120537: '0069MS0062-599', // RODRIGUEZ MAMANI JASON (94120537)
    48921694: '0069MS0062-602', // TORRES ANA ARACELI (48921697)
    48835737: '0069MS0062-618', // SOSA DYLAN (sin DNI, mismo curso 6°4°-Soc)
    49073726: '0069MS0062-625', // GARCIA ZELADA EZEQUIEL NAIM (49073729)
    19114407: '0069MS0062-631', // LARREA MICHAEL FABIAN (49114407)
    54364505: '0069MS0062-661', // FLORES OBREGON IARA (54365505)
    53673954: '0069MS0062-689', // LIVORSI MORENA LUJAN (sin DNI)
    52622957: '0069MS0062-785', // SALINAS THIAGO ADRIEL (52622987)
    52779388: '0069MS0062-788', // TRINIDAD DEL VALLE SOFIA AYELEN (52779386)
    52394487: '0069MS0062-803', // ALE BARRIOS GERALDINE BELEN (sin DNI)
    49361432: '0069MS0062-804', // LUQUE FACUNDO LEONEL (49361431)
    13011901: '0069MS0062-858' // CARDENAS DIEGO JOSUE (sin DNI)
};

// Altas sin ningun registro previo - la planilla no separa apellido de nombre, el corte
// es a mano (corregible despues desde "Editar estudiante").
const ALTAS_NUEVAS = {
    53386568: ['GIMENEZ', 'VALENTINO GAEL ARIEL'],
    53329426: ['HUAMAN SALAS', 'MASSIMO EDWIN'],
    52925510: ['OCAMPO VELA', 'CINDY LUZ'],
    52779382: ['HERRERA CABRERA', 'LUCAS VALENTIN'],
    52093943: ['RECALDE', 'NAYLA MAGALI'],
    52411694: ['PINTOS', 'ALMA NICOLE'],
    49534487: ['SANFRINI', 'FABRIZIO INDIO'],
    48499926: ['VERSARA', 'NICOLAS ARIEL'],
    48523383: ['MONZON', 'GONZALO NEHUEN']
};

const GRADO = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' };
const TURNO = { 'MAÑANA': 'Mañana', TARDE: 'Tarde', VESPERTINO: 'Vespertino' };
const ORIENTACION = {
    'Bachiller Ciclo Básico': null,
    'Bachiller en Comunicación': 'Comunicación',
    'Bachiller en Ciencias Sociales': 'Ciencias Sociales',
    'Bachiller en Arte - Música': 'Arte - Música'
};

const fechaCsv = (texto) => new Date(`${texto}T00:00:00.000Z`);
// Nunca cerrar una inscripcion con fecha anterior a su propia alta.
const fechaCierre = (fecha, vigente) => (fecha < vigente.fechaAlta ? HOY : fecha);

async function main() {
    if (!CSV_PATH) throw new Error('Uso: node scripts/sincronizarMatriculaOficial.js <ruta.csv> [--commit]');
    await conectarDB();

    const institucion = await Institucion.findOne({ clave: INSTITUCION_CLAVE });
    const cursos = await Curso.find({ institucionId: institucion._id }).populate('anioId turnoId orientacionId institucionId');
    const cursoIds = cursos.map((c) => c._id);

    const filas = fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1)
        .filter(Boolean).map((l, i) => {
            const [, turno, anio, seccion, orientacion, nombre, dni, estado, fechaInscripcion, fechaEstado] = l.split(',');
            return { linea: i + 2, turno, anio, seccion, orientacion, nombre, dni: dni.trim(), estado, fechaInscripcion, fechaEstado };
        });

    const resolverCurso = (f) => {
        const division = `${f.seccion.split(' - ')[0].trim()}°`;
        const curso = cursos.find((c) => c.anioId.clave === GRADO[f.anio] && c.division.trim() === division);
        if (!curso) throw new Error(`linea ${f.linea}: curso ${f.anio} ${division} no existe`);
        if (curso.turnoId.nombre !== TURNO[f.turno] || (curso.orientacionId?.nombre || null) !== ORIENTACION[f.orientacion]) {
            throw new Error(`linea ${f.linea}: turno/orientacion de ${curso.clave} no coincide con la planilla`);
        }
        return curso;
    };

    const vigentes = await Inscripcion.find({ cursoId: { $in: cursoIds }, fechaBaja: null })
        .populate({ path: 'estudianteId', populate: 'personaId' });
    const vigentePorEstudiante = new Map(vigentes.map((i) => [String(i.estudianteId._id), i]));
    const reclamadas = new Set();

    const plan = { ok: 0, dni: [], mover: [], alta: [], baja: [], noFigura: [] };
    const etiqueta = (e) => `${e.personaId.apellido} ${e.personaId.nombre} (${e.personaId.numeroDocumento || 'sin DNI'}, ${e.legajo})`;

    for (const f of filas) {
        const curso = resolverCurso(f);
        let estudiante = null;
        const persona = await Persona.findOne({ numeroDocumento: f.dni });
        if (persona) estudiante = await Estudiante.findOne({ personaId: persona._id }).populate('personaId');

        if (f.estado === 'BAJA') {
            const vigente = estudiante && await Inscripcion.findOne({ estudianteId: estudiante._id, fechaBaja: null });
            if (vigente) {
                reclamadas.add(String(vigente._id));
                plan.baja.push({ vigente, fecha: fechaCierre(fechaCsv(f.fechaEstado), vigente), texto: `${etiqueta(estudiante)} baja ${f.fechaEstado}` });
            }
            continue;
        }

        if (!estudiante && CORRECCIONES_DNI[f.dni]) {
            estudiante = await Estudiante.findOne({ legajo: CORRECCIONES_DNI[f.dni] }).populate('personaId');
            if (!estudiante) throw new Error(`linea ${f.linea}: legajo ${CORRECCIONES_DNI[f.dni]} no existe`);
            plan.dni.push({ persona: estudiante.personaId, dni: f.dni, texto: `${etiqueta(estudiante)} -> DNI ${f.dni}` });
        }
        if (!estudiante) {
            if (!ALTAS_NUEVAS[f.dni]) throw new Error(`linea ${f.linea}: ${f.nombre} (${f.dni}) sin registro y sin corte de nombre en ALTAS_NUEVAS`);
            const [apellido, nombre] = ALTAS_NUEVAS[f.dni];
            plan.alta.push({ apellido, nombre, dni: f.dni, curso, fecha: fechaCsv(f.fechaInscripcion), texto: `${apellido}, ${nombre} (${f.dni}) en ${curso.clave} desde ${f.fechaInscripcion}` });
            continue;
        }

        const vigente = vigentePorEstudiante.get(String(estudiante._id))
            || await Inscripcion.findOne({ estudianteId: estudiante._id, fechaBaja: null });
        if (vigente && String(vigente.cursoId) === String(curso._id)) {
            reclamadas.add(String(vigente._id));
            plan.ok++;
            continue;
        }
        if (vigente) reclamadas.add(String(vigente._id));
        const fecha = vigente ? fechaCierre(fechaCsv(f.fechaEstado), vigente) : fechaCsv(f.fechaEstado);
        plan.mover.push({ estudiante, curso, fecha, texto: `${etiqueta(estudiante)} ${vigente ? 'de ' + cursos.find((c) => String(c._id) === String(vigente.cursoId)).clave : 'sin vigente'} -> ${curso.clave} (${fecha.toISOString().slice(0, 10)})` });
    }

    vigentes.filter((i) => !reclamadas.has(String(i._id))).forEach((i) => {
        const curso = cursos.find((c) => String(c._id) === String(i.cursoId));
        plan.noFigura.push({ vigente: i, texto: `${etiqueta(i.estudianteId)} en ${curso.clave}` });
    });

    console.log(`\n=== ${COMMIT ? 'COMMIT' : 'DRY RUN (no se escribe nada)'} ===`);
    console.log(`Filas CSV: ${filas.length} | ya correctos: ${plan.ok}`);
    for (const k of ['dni', 'mover', 'alta', 'baja', 'noFigura']) {
        console.log(`\n-- ${k}: ${plan[k].length}`);
        plan[k].forEach((p) => console.log(`   ${p.texto}`));
    }

    if (!COMMIT) {
        await mongoose.disconnect();
        return;
    }

    let errores = 0;
    const intentar = async (texto, fn) => {
        try { await fn(); } catch (e) { errores++; console.error(`ERROR ${texto}: ${e.message}`); }
    };

    // Primero las bajas: liberan el lugar antes de los cambios de curso.
    for (const p of plan.baja) {
        await intentar(p.texto, () => inscripcionRepo.darDeBaja(p.vigente._id, { fecha: p.fecha, motivo: 'Baja' }));
    }
    for (const p of plan.noFigura) {
        await intentar(p.texto, () => inscripcionRepo.darDeBaja(p.vigente._id, { fecha: HOY, motivo: MOTIVO_NO_FIGURA }));
    }
    for (const p of plan.dni) {
        await intentar(p.texto, () => Persona.updateOne({ _id: p.persona._id }, { $set: { numeroDocumento: p.dni, tipoDocumento: 'DNI' } }));
    }
    for (const p of plan.mover) {
        await intentar(p.texto, async () => {
            const r = await inscribirExistenteEnCurso(p.curso, {
                estudianteId: p.estudiante._id, cicloLectivo: CICLO_LECTIVO,
                fechaAlta: p.fecha, motivoAlta: 'Cambio de curso'
            });
            if (r.error) throw new Error(r.error);
        });
    }
    for (const p of plan.alta) {
        await intentar(p.texto, async () => {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    const [persona] = await Persona.create([{ apellido: p.apellido, nombre: p.nombre, numeroDocumento: p.dni, tipoDocumento: 'DNI' }], { session });
                    const legajo = await estudianteRepo.generarLegajo(INSTITUCION_CLAVE, session);
                    const estudiante = await estudianteRepo.crear(persona._id, legajo, session);
                    await inscripcionRepo.matricular({
                        estudianteId: estudiante._id, cursoId: p.curso._id, cicloLectivo: CICLO_LECTIVO,
                        fecha: p.fecha, motivo: 'Inscripción inicial'
                    }, session);
                    await cursadaAsignaturaRepo.crearVarias(estudiante._id, await resolverMateriaIds(null, p.curso), session);
                });
            } finally {
                await session.endSession();
            }
        });
    }

    console.log(`\nCommit terminado. Errores: ${errores}.`);
    await mongoose.disconnect();
    if (errores) process.exitCode = 1;
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
