// Carga masiva de estudiantes desde src/data/registro.csv (planilla de Google Sheets
// exportada como CSV) a la institucion Escuela Secundaria N 62 La Matanza (clave
// 0069MS0062, unica institucion cargada en el sistema al momento de escribir esto).
//
// Uso:
//   node scripts/importarRegistro.js            -> dry run (no escribe nada, solo reporta)
//   node scripts/importarRegistro.js --commit    -> escribe de verdad
//
// Reglas de interpretacion de la planilla (columnas: Curso/N°, N° Registro, Viene de,
// Estudiante, dni, fecha nacimiento, naciolaidad [nacionalidad del estudiante], Tiutor
// [nombre del adulto responsable], nacionalidad [del adulto], Oficio [del adulto, sin
// campo equivalente en el modelo - se descarta], Domicilio, Telefono):
//
// - Un mismo DNI aparece varias veces en la planilla cuando el estudiante fue promocionado
//   de año o cambiado de division en años anteriores (la planilla es un registro
//   historico, no una foto de un solo ciclo lectivo). Solo se carga la ULTIMA aparicion de
//   cada DNI (la de mas abajo en el archivo = la mas reciente), como su cursada actual.
// - Filas cuyo DNI ya existe en la base (Persona.numeroDocumento) se saltean.
// - El domicilio de la planilla se guarda en Persona.domicilio del estudiante (no en el
//   adulto responsable) y EstudianteResponsable.convive queda en true - mismo criterio que
//   ya uso el alta manual de los primeros 12 estudiantes de este mismo curso (ver
//   consulta previa a la base).
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

const conectarDB = require('../src/config/db');
const Persona = require('../src/models/Persona');
const Institucion = require('../src/models/Institucion');
const Curso = require('../src/models/Curso');
const Anio = require('../src/models/Anio');
require('../src/models/Orientacion'); // registra el schema para el .populate('orientacionId')
const estudianteRepo = require('../src/repos/estudiante.repo');
const inscripcionRepo = require('../src/repos/inscripcion.repo');
const cursadaAsignaturaRepo = require('../src/repos/cursadaAsignatura.repo');
const adultoResponsableRepo = require('../src/repos/adultoResponsable.repo');
const estudianteResponsableRepo = require('../src/repos/estudianteResponsable.repo');
const { resolverMateriaIds } = require('../src/controllers/estudiante.controller');

const CSV_PATH = process.argv[2] && !process.argv[2].startsWith('--')
    ? process.argv[2]
    : path.join(__dirname, '..', 'src', 'data', 'registro.csv');
const COMMIT = process.argv.includes('--commit');
const INSTITUCION_CLAVE = '0069MS0062';
const CICLO_LECTIVO = new Date().getFullYear();
const MOTIVO_ALTA = 'Inscripción inicial';
const VINCULO_DEFAULT = 'Tutor';

// ---------- CSV parsing (maneja comillas con comas/saltos de linea adentro) ----------
function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* ignorar */ }
        else field += c;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

// ---------- Helpers de parseo de una fila ----------
const NACIONALIDAD_MAP = {
    ARG: 'Argentina', ARGENTINA: 'Argentina', ARGENTINO: 'Argentina',
    ARENTINO: 'Argentina', ARENTINA: 'Argentina', AREGENTINA: 'Argentina',
    BOL: 'Boliviano', BOLIVIA: 'Boliviano', BOLIVIANA: 'Boliviano', BOLIVIANO: 'Boliviano',
    PGY: 'Paraguayo', PAR: 'Paraguayo', PARAGUAY: 'Paraguayo', PARAGUAYA: 'Paraguayo', PARAGUAYO: 'Paraguayo',
    PER: 'Peruano', PERU: 'Peruano', PERUANA: 'Peruano', PERUANO: 'Peruano',
    CHILE: 'Chileno', CHILENA: 'Chileno', CHILENO: 'Chileno',
    URY: 'Uruguayo', URUGUAY: 'Uruguayo', URUGUAYA: 'Uruguayo', URUGUAYO: 'Uruguayo'
};

const mapearNacionalidad = (valor) => {
    const limpio = (valor || '').trim().toUpperCase();
    if (!limpio) return { nacionalidad: null, reconocida: true };
    if (NACIONALIDAD_MAP[limpio]) return { nacionalidad: NACIONALIDAD_MAP[limpio], reconocida: true };
    return { nacionalidad: null, reconocida: false };
};

// "23/10/2011" -> Date, tolera dia/mes de 1 digito. null si no matchea o es invalida.
const parsearFecha = (texto) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((texto || '').trim());
    if (!m) return null;
    const [, d, mo, y] = m;
    const fecha = new Date(Number(y), Number(mo) - 1, Number(d));
    if (Number.isNaN(fecha.getTime())) return null;
    return fecha;
};

// Particulas que se pegan al primer apellido cuando no hay coma ("DEL PADRE VILLABA...").
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);

// Separa "Estudiante"/"Tiutor" en { apellido, nombre, incierto }. Prioridad: si hay coma,
// se corta ahi (formato mas confiable). Si no, se asume que el primer token (mas
// particulas conocidas pegadas) es el apellido - falla en apellidos compuestos sin
// particula reconocible (ej. "PERALTA MARTINEZ"), esos quedan marcados incierto:true
// para revisar a mano despues (ver "Editar estudiante" en la ficha).
const separarNombre = (textoOriginal) => {
    const texto = (textoOriginal || '').replace(/\s+/g, ' ').trim();
    if (!texto) return null;
    if (texto.includes(',')) {
        const [apellido, nombre] = texto.split(',').map((s) => s.trim());
        return { apellido, nombre: nombre || '', incierto: !nombre };
    }
    const palabras = texto.split(' ');
    if (palabras.length === 1) return { apellido: palabras[0], nombre: '', incierto: true };
    let corte = 1;
    while (corte < palabras.length - 1 && PARTICULAS.has(palabras[corte - 1].toUpperCase())) corte++;
    return {
        apellido: palabras.slice(0, corte).join(' '),
        nombre: palabras.slice(corte).join(' '),
        incierto: palabras.length > 2
    };
};

// "int. Russo 6661 - G. Catán" -> { calle, numero, localidad }. Separador " - " o "/".
const LOCALIDAD_MAP = [
    [/g\.?\s*catan|gonzalez catan|gonz[aá]lez cat[aá]n/i, 'González Catán'],
    [/g\.?\s*laferrere|gregorio de laferrere|laferrere/i, 'Gregorio de Laferrere']
];
const mapearLocalidad = (texto) => {
    for (const [regex, valor] of LOCALIDAD_MAP) if (regex.test(texto)) return valor;
    return texto.trim() || undefined;
};
const parsearDomicilio = (texto) => {
    const limpio = (texto || '').trim();
    if (!limpio) return undefined;
    const partes = limpio.split(/\s*[-/]\s*/);
    const calleNumero = partes[0].trim();
    const resto = partes.slice(1).join(' - ').trim();
    const m = /^(.*?)\s+(\d+[a-zA-Z]?|s\/n)$/i.exec(calleNumero);
    const calle = m ? m[1].trim() : calleNumero;
    const numero = m ? m[2].trim() : undefined;
    return {
        calle: calle || undefined,
        numero,
        provincia: 'Buenos Aires',
        partido: 'La Matanza',
        localidad: resto ? mapearLocalidad(resto) : undefined
    };
};

async function main() {
    await conectarDB();

    const institucion = await Institucion.findOne({ clave: INSTITUCION_CLAVE });
    if (!institucion) throw new Error(`No se encontro la institucion ${INSTITUCION_CLAVE}`);

    const cursos = await Curso.find({ institucionId: institucion._id }).populate('anioId').populate('orientacionId');
    const cursoPorClaveAnioDivision = new Map();
    cursos.forEach((c) => {
        const key = `${c.anioId.clave.trim()}|${c.division.trim()}`;
        cursoPorClaveAnioDivision.set(key, c);
    });

    const fs = require('fs');
    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parseCSV(raw);
    const data = rows.slice(1)
        .map((r, i) => ({ r, linea: i + 2 }))
        .filter(({ r }) => r.some((c) => c && c.trim()));

    const yaEnDB = new Set(
        (await Persona.find({ numeroDocumento: { $ne: null } }, 'numeroDocumento')).map((p) => p.numeroDocumento)
    );

    // DNIs que en la planilla corresponden a mas de una persona distinta (transcripcion
    // erronea del libro - no se puede resolver solo, se saltea y se reporta EL/LOS DOS
    // lados). Un DNI repetido es sospechoso solo si NINGUNA palabra del nombre se repite
    // entre las apariciones (mismo apellido/nombre parcial = misma persona con distinto
    // nivel de detalle en cada fila, no un conflicto real) - se calcula ANTES de colapsar
    // por "ultima aparicion" para no perder de vista ninguna de las dos personas.
    const palabrasPorDni = new Map();
    data.forEach(({ r }) => {
        const dni = (r[4] || '').trim();
        if (!dni) return;
        const palabras = new Set((r[3] || '').toUpperCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean));
        (palabrasPorDni.get(dni) || palabrasPorDni.set(dni, []).get(dni)).push(palabras);
    });
    const dniConflictivos = new Set();
    palabrasPorDni.forEach((listaDeSets, dni) => {
        if (listaDeSets.length < 2) return;
        const primero = listaDeSets[0];
        const comparteAlgunaPalabra = (a, b) => [...a].some((p) => b.has(p));
        const todasComparten = listaDeSets.every((s) => comparteAlgunaPalabra(primero, s));
        if (!todasComparten) dniConflictivos.add(dni);
    });

    const reporte = { ok: [], warn: [], skipYaCargado: [], skipConflictoDni: [], error: [] };
    data.forEach(({ r, linea }) => {
        const dni = (r[4] || '').trim();
        if (dni && dniConflictivos.has(dni)) {
            reporte.skipConflictoDni.push({ linea, dni, nombre: r[3], curso: (r[0] || '').trim() });
        }
    });

    // Solo la ultima aparicion de cada DNI no-conflictivo (la planilla es un registro
    // multi-año, no una foto de un solo ciclo lectivo - se toma la mas reciente como
    // cursada actual). Los DNI conflictivos quedan afuera por completo (ya reportados).
    const ultimaPorDni = new Map();
    const sinDni = [];
    data.forEach(({ r, linea }) => {
        const dni = (r[4] || '').trim();
        if (dni && dniConflictivos.has(dni)) return;
        if (dni) ultimaPorDni.set(dni, { r, linea });
        else sinDni.push({ r, linea });
    });
    const filasAProcesar = [...ultimaPorDni.values(), ...sinDni].sort((a, b) => a.linea - b.linea);

    for (const { r, linea } of filasAProcesar) {
        const [cursoRaw, numeroRegistro, viene, estudianteRaw, dniRaw, fechaRaw, nacEstRaw, tutorRaw, nacTutorRaw, , domicilioRaw, telefonoRaw] = r;
        const dni = (dniRaw || '').trim();
        const cursoClave = (cursoRaw || '').replace(/-\d+\s*$/, '').replace(/-\s*$/, '').trim();
        const motivosWarn = [];

        if (dni && yaEnDB.has(dni)) {
            reporte.skipYaCargado.push({ linea, dni, nombre: estudianteRaw });
            continue;
        }

        const m = /^(\d°)(\d°)$/.exec(cursoClave);
        const curso = m ? cursoPorClaveAnioDivision.get(`${m[1]}|${m[2]}`) : null;
        if (!curso) {
            reporte.error.push({ linea, motivo: `curso "${cursoClave}" no resuelto`, nombre: estudianteRaw });
            continue;
        }

        const nombreSplit = separarNombre(estudianteRaw);
        if (!nombreSplit || !nombreSplit.apellido) {
            reporte.error.push({ linea, motivo: 'sin nombre de estudiante', curso: cursoClave });
            continue;
        }
        if (nombreSplit.incierto) motivosWarn.push('apellido/nombre incierto (sin coma, revisar)');

        const fecha = parsearFecha(fechaRaw);
        if ((fechaRaw || '').trim() && !fecha) motivosWarn.push(`fecha de nacimiento no parseable: "${fechaRaw}"`);

        const { nacionalidad, reconocida } = mapearNacionalidad(nacEstRaw);
        if (!reconocida) motivosWarn.push(`nacionalidad de estudiante no reconocida: "${nacEstRaw}" (posible nota en la planilla)`);

        const domicilio = parsearDomicilio(domicilioRaw);

        let responsable = null;
        if ((tutorRaw || '').trim()) {
            const tutorSplit = separarNombre(tutorRaw);
            const { nacionalidad: nacTutor } = mapearNacionalidad(nacTutorRaw);
            const telefono = (telefonoRaw || '').trim();
            responsable = {
                apellido: tutorSplit ? tutorSplit.apellido : tutorRaw.trim(),
                nombre: tutorSplit ? tutorSplit.nombre : '',
                nacionalidad: nacTutor || undefined,
                telefonos: telefono ? [{ numero: telefono }] : []
            };
        }

        const fila = {
            linea, curso, cursoClave,
            apellido: nombreSplit.apellido,
            nombre: nombreSplit.nombre,
            numeroDocumento: dni || undefined,
            fecha_nacimiento: fecha || undefined,
            nacimiento: nacionalidad ? { lugar: nacionalidad === 'Argentina' ? 'Argentina' : 'Extranjero', nacionalidad } : undefined,
            domicilio,
            numeroRegistro: (numeroRegistro || '').trim() || undefined,
            procedencia: (viene || '').trim() || undefined,
            responsable
        };

        (motivosWarn.length > 0 ? reporte.warn : reporte.ok).push({ ...fila, motivosWarn });
    }

    // ---------- Reporte ----------
    console.log(`\n=== Dry run: ${COMMIT ? 'COMMIT (escribiendo)' : 'solo reporte, no se escribe nada'} ===`);
    console.log(`Filas con datos en el CSV: ${data.length}`);
    console.log(`Ya cargados (mismo DNI en la base): ${reporte.skipYaCargado.length}`);
    console.log(`DNI conflictivo entre 2 personas distintas (salteados, requieren revision): ${reporte.skipConflictoDni.length}`);
    reporte.skipConflictoDni.forEach((f) => console.log(`  linea ${f.linea}: DNI ${f.dni} - "${f.nombre}" (curso ${f.curso})`));
    console.log(`Filas con error (no importables tal cual): ${reporte.error.length}`);
    reporte.error.slice(0, 30).forEach((f) => console.log(`  linea ${f.linea}: ${f.motivo} - "${f.nombre || ''}"`));
    console.log(`Importables sin advertencias: ${reporte.ok.length}`);
    console.log(`Importables CON advertencia (se cargan igual, pero conviene repasar despues): ${reporte.warn.length}`);
    const conteoMotivos = {};
    reporte.warn.forEach((f) => f.motivosWarn.forEach((mo) => { conteoMotivos[mo.split(':')[0]] = (conteoMotivos[mo.split(':')[0]] || 0) + 1; }));
    console.log('  Motivos:', JSON.stringify(conteoMotivos, null, 1));
    if (process.argv.includes('--muestra')) {
        console.log('\n--- Muestra de filas con advertencia (primeras 20) ---');
        reporte.warn.slice(0, 20).forEach((f) => console.log(`  linea ${f.linea}: "${f.apellido}" / "${f.nombre}" - ${f.motivosWarn.join('; ')}`));
        console.log('\n--- Fila(s) con nacionalidad no reconocida ---');
        reporte.warn.filter((f) => f.motivosWarn.some((mo) => mo.includes('nacionalidad'))).forEach((f) => console.log(`  linea ${f.linea}: "${f.apellido}, ${f.nombre}" - ${f.motivosWarn.join('; ')}`));
    }

    if (!COMMIT) {
        console.log('\nDry run terminado, no se escribio nada. Correr con --commit para importar de verdad.');
        await mongoose.disconnect();
        return;
    }

    // ---------- Commit real ----------
    let creados = 0, errores = 0;
    for (const fila of [...reporte.ok, ...reporte.warn]) {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const [persona] = await Persona.create([{
                    apellido: fila.apellido,
                    nombre: fila.nombre,
                    numeroDocumento: fila.numeroDocumento,
                    fecha_nacimiento: fila.fecha_nacimiento,
                    nacimiento: fila.nacimiento,
                    domicilio: fila.domicilio
                }], { session });
                const legajo = await estudianteRepo.generarLegajo(institucion.clave, session);
                const estudiante = await estudianteRepo.crear(persona._id, legajo, session);
                await inscripcionRepo.matricular({
                    estudianteId: estudiante._id,
                    cursoId: fila.curso._id,
                    cicloLectivo: CICLO_LECTIVO,
                    fecha: new Date(),
                    motivo: MOTIVO_ALTA,
                    numeroRegistro: fila.numeroRegistro,
                    procedencia: fila.procedencia
                }, session);
                const materiaIds = await resolverMateriaIds(null, fila.curso);
                await cursadaAsignaturaRepo.crearVarias(estudiante._id, materiaIds, session);

                if (fila.responsable && fila.responsable.apellido) {
                    // Sin DNI del adulto en la planilla no hay forma de deduplicar contra
                    // un hermano ya cargado (a diferencia de postResponsable) - se crea
                    // siempre uno nuevo, numeroDocumento queda sin definir (sparse, no
                    // choca con otros sin documento).
                    const adulto = await adultoResponsableRepo.crear({
                        apellido: fila.responsable.apellido,
                        nombre: fila.responsable.nombre || fila.responsable.apellido,
                        nacionalidad: fila.responsable.nacionalidad,
                        telefonos: fila.responsable.telefonos
                    });
                    await estudianteResponsableRepo.crear({
                        estudianteId: estudiante._id,
                        adultoResponsableId: adulto._id,
                        vinculo: VINCULO_DEFAULT,
                        convive: true
                    });
                }
            });
            creados++;
        } catch (error) {
            errores++;
            console.error(`ERROR linea ${fila.linea} (${fila.apellido}, ${fila.nombre}):`, error.message);
        } finally {
            await session.endSession();
        }
    }
    console.log(`\nCommit terminado. Creados: ${creados}. Errores: ${errores}.`);
    await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
