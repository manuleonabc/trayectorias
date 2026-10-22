// Carga el informe y la nota del 1er cuatrimestre (ciclo 2026) de las materias de un año y
// los tutores, desde una planilla docente por año (estudiantes_asignaturas_tutores*.csv,
// columnas: Curso, Estudiante, DNI, Tutor, Telefono Tutor, "1° Inf - <materia>" por materia
// = informe1C TEA/TEP/TED, "1° Cuatr - <materia>" por materia = nota1C 1-10).
//
// Decisiones del usuario (2026-10-08, para 1°; "lo mismo" para 2°):
// - Solo alumnos con inscripcion vigente en ese año (la matricula ya se alineo con la
//   oficial, ver sincronizarMatriculaOficial.js) - los que figuran en la planilla docente
//   pero no en la oficial se ignoran.
// - Si ya habia una valoracion para ese periodo, se pisa con la de la planilla.
// - Tutores: los cargados por importarRegistro.js quedaron corridos una fila en varios
//   cursos (cada alumno con el tutor del siguiente). Se reemplaza el vinculo por el de la
//   planilla (reusando el AdultoResponsable si ya existe con el mismo nombre) y se borran
//   los adultos que queden sin ningun alumno. --sin-tutores excluye cursos cuya columna de
//   tutores no es confiable (en 1°, 1°5° era una copia de la de 1°4°).
//
// Uso, desde la raiz del proyecto:
//   node scripts/importarNotasTutores.js <ruta.csv> --anio=1° [--sin-tutores=1°5°]            -> dry run
//   node scripts/importarNotasTutores.js <ruta.csv> --anio=1° [--sin-tutores=1°5°] --commit   -> escribe
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const conectarDB = require('../src/config/db');
const Anio = require('../src/models/Anio');
const Curso = require('../src/models/Curso');
const Asignatura = require('../src/models/Asignatura');
const Inscripcion = require('../src/models/Inscripcion');
const CursadaAsignatura = require('../src/models/CursadaAsignatura');
const Valoracion = require('../src/models/Valoracion');
const AdultoResponsable = require('../src/models/AdultoResponsable');
const EstudianteResponsable = require('../src/models/EstudianteResponsable');
require('../src/models/Estudiante');
require('../src/models/Persona');

const CSV_PATH = process.argv[2];
const COMMIT = process.argv.includes('--commit');
const CICLO_LECTIVO = 2026;
const HECHO_POR = 'importacion';
const argumento = (nombre) => (process.argv.find((a) => a.startsWith(`--${nombre}=`)) || '').split('=')[1];
const ANIO_CLAVE = argumento('anio');
const CURSOS_SIN_TUTORES = new Set((argumento('sin-tutores') || '').split(',').filter(Boolean));
const TUTOR_INVALIDO = /pas[oó] a turno/i;

// Mismo parser que importarRegistro.js (comillas con comas adentro).
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
        else if (c !== '\r') field += c;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}

const tokens = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z ]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
const comunes = (a, b) => { const sb = new Set(b); return a.filter((w) => sb.has(w)).length; };
const mismoNombre = (a, b) => { const ta = tokens(a), tb = tokens(b); return ta.length === tb.length && comunes(ta, tb) === ta.length; };
// Para el adulto que el alumno YA tiene vinculado: alcanza con que un nombre contenga al otro
// ("BRITEZ CANDIDA" ~ "Britez Almada, Candida", "FERREYRA ESTEFANIA SOLEDAD" ~ "Ferreyra,
// Estefania S.") - asi no se reemplaza un tutor correcto por una variante de escritura. Para
// buscar entre TODOS los adultos se sigue usando mismoNombre (estricto): nombres comunes de
// 2 palabras podrian ser otra persona.
const contenido = (a, b) => {
    const ta = tokens(a), tb = tokens(b);
    const [chico, grande] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    return chico.length >= 2 && comunes(chico, grande) === chico.length;
};

// "Chaca Condori, Nieves" -> coma; "ROBERTO Myriam Eliana" -> palabras en mayusculas al
// principio = apellido; si no, primera palabra apellido (mismo criterio que importarRegistro).
const separarTutor = (texto) => {
    const t = texto.replace(/\s+/g, ' ').trim();
    if (t.includes(',')) { const [ap, no] = t.split(',').map((s) => s.trim()); return { apellido: ap, nombre: no || ap }; }
    const palabras = t.split(' ');
    const esMayus = (w) => /[A-ZÁÉÍÓÚÑ]/.test(w) && w === w.toUpperCase();
    if (palabras.some((w) => !esMayus(w)) && esMayus(palabras[0])) {
        let corte = 0;
        while (corte < palabras.length - 1 && esMayus(palabras[corte])) corte++;
        return { apellido: palabras.slice(0, corte).join(' '), nombre: palabras.slice(corte).join(' ') };
    }
    return { apellido: palabras[0], nombre: palabras.slice(1).join(' ') || palabras[0] };
};
// Descarta numeros truncos (ej. "11") - menos de 8 digitos no es un telefono marcable.
const telefonos = (texto) => (texto || '').split('/').map((s) => s.trim()).filter((s) => s.replace(/\D/g, '').length >= 8);

async function main() {
    if (!CSV_PATH || !ANIO_CLAVE) throw new Error('Uso: node scripts/importarNotasTutores.js <ruta.csv> --anio=1° [--sin-tutores=1°5°] [--commit]');
    await conectarDB();

    const anio = await Anio.findOne({ clave: ANIO_CLAVE });
    if (!anio) throw new Error(`Año ${ANIO_CLAVE} no existe`);
    const asignaturas = await Asignatura.find({ anioId: anio._id, orientacionId: null });
    const cursos = await Curso.find({ anioId: anio._id });
    const vigentes = await Inscripcion.find({ cursoId: { $in: cursos.map((c) => c._id) }, fechaBaja: null })
        .populate({ path: 'estudianteId', populate: 'personaId' }).populate('cursoId');
    const nombreDe = (i) => `${i.estudianteId.personaId.apellido} ${i.estudianteId.personaId.nombre}`;

    const [encabezado, ...filas] = parseCSV(fs.readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, ''));
    const columnas = encabezado.slice(5).map((h) => {
        const [, tipo, materia] = /^1° (Inf|Cuatr) - (.+)$/.exec(h.trim());
        // Sin tildes/espacios/guiones: la planilla dice "Fisicoquímica", la base "Físico - Química".
        const plano = (s) => s.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
        const asignatura = asignaturas.find((a) => plano(a.nombre) === plano(materia));
        if (!asignatura) throw new Error(`Materia "${materia}" no existe en ${ANIO_CLAVE}`);
        return { periodo: tipo === 'Inf' ? 'informe1C' : 'nota1C', asignatura };
    });

    const reporte = { ignoradas: [], conflictos: [], invalidos: [] };
    // estudianteId -> { inscripcion, valores: Map("asignaturaId|periodo" -> valor), tutor }
    const porEstudiante = new Map();

    for (const f of filas.filter((r) => r.some((c) => c.trim()))) {
        const [curso, nombre, dni, tutor, tel] = f.map((c) => (c || '').trim());
        // Por DNI solo si el nombre tambien coincide (la fila de Gimenez trae el DNI de Huaman).
        let insc = vigentes.find((i) => dni && i.estudianteId.personaId.numeroDocumento === dni
            && comunes(tokens(nombre), tokens(nombreDe(i))) >= 2);
        if (!insc) {
            const cands = vigentes.filter((i) => comunes(tokens(nombre), tokens(nombreDe(i))) >= Math.min(3, tokens(nombre).length));
            if (cands.length === 1) [insc] = cands;
        }
        if (!insc) {
            // Ultimo intento: 2 palabras en comun + mismo curso, unico candidato (ej. "Aguilera
            // Ferreira, Zoe" vs "AGUILERA FERRERIRA ZOE DE LOS A." en la base).
            const cands = vigentes.filter((i) => i.cursoId.clave === curso && comunes(tokens(nombre), tokens(nombreDe(i))) >= 2);
            if (cands.length === 1) [insc] = cands;
        }
        if (!insc) { reporte.ignoradas.push(`${curso} ${nombre} (${dni || 'sin DNI'})`); continue; }

        const clave = String(insc.estudianteId._id);
        const acc = porEstudiante.get(clave) || { insc, valores: new Map(), tutor: null };
        porEstudiante.set(clave, acc);
        const dniPertenece = !dni || insc.estudianteId.personaId.numeroDocumento === dni;

        columnas.forEach((col, k) => {
            const crudo = (f[5 + k] || '').trim().toUpperCase();
            if (!crudo) return;
            let valor;
            if (col.periodo === 'informe1C') {
                if (!['TEA', 'TEP', 'TED'].includes(crudo)) return reporte.invalidos.push(`${nombre} ${col.asignatura.nombre}: "${crudo}"`);
                valor = crudo;
            } else {
                valor = Number(crudo);
                if (!Number.isInteger(valor) || valor < 1 || valor > 10) return reporte.invalidos.push(`${nombre} ${col.asignatura.nombre}: "${crudo}"`);
            }
            const k2 = `${col.asignatura._id}|${col.periodo}`;
            const previo = acc.valores.get(k2);
            if (previo !== undefined && previo !== valor) {
                reporte.conflictos.push(`${nombreDe(insc)} ${col.asignatura.nombre} ${col.periodo}: ${previo} vs ${valor} (fila ${curso}) - queda la del curso actual`);
                if (curso !== insc.cursoId.clave) return;
            }
            acc.valores.set(k2, valor);
        });

        // Tutor = el propio alumno (ej. "Silcan Sebastian" con tutor "SILCAN SEBASTIÁN"): error de carga, se saltea.
        const tutorEsElAlumno = tutor && (contenido(tutor, nombre) || contenido(tutor, nombreDe(insc)));
        if (tutor && !TUTOR_INVALIDO.test(tutor) && !CURSOS_SIN_TUTORES.has(curso) && dniPertenece && !tutorEsElAlumno) {
            acc.tutor = { texto: tutor, telefonos: telefonos(tel), curso };
        }
    }

    // ---------- Plan de notas ----------
    const planNotas = { nuevas: 0, iguales: 0, pisadas: [] };
    const operacionesNotas = [];
    for (const { insc, valores } of porEstudiante.values()) {
        for (const [k, valor] of valores) {
            const [asignaturaId, periodo] = k.split('|');
            const cursada = await CursadaAsignatura.findOne({ estudianteId: insc.estudianteId._id, asignaturaId });
            const existente = cursada && await Valoracion.findOne({ cursadaAsignaturaId: cursada._id, cicloLectivo: CICLO_LECTIVO, periodo });
            const actual = existente && (periodo === 'informe1C' ? existente.valoracion : existente.nota);
            if (actual === valor) { planNotas.iguales++; continue; }
            if (existente) planNotas.pisadas.push(`${nombreDe(insc)} ${asignaturas.find((a) => String(a._id) === asignaturaId).nombre} ${periodo}: ${actual} -> ${valor}`);
            else planNotas.nuevas++;
            operacionesNotas.push({ estudianteId: insc.estudianteId._id, asignaturaId, periodo, valor });
        }
    }

    // ---------- Plan de tutores ----------
    const adultos = await AdultoResponsable.find();
    const planTutores = { yaCorrecto: 0, cambios: [] };
    for (const { insc, tutor } of porEstudiante.values()) {
        if (!tutor) continue;
        const vinculos = await EstudianteResponsable.find({ estudianteId: insc.estudianteId._id }).populate('adultoResponsableId');
        const correcto = vinculos.find((v) => contenido(`${v.adultoResponsableId.apellido} ${v.adultoResponsableId.nombre}`, tutor.texto));
        const sobrantes = vinculos.filter((v) => v !== correcto);
        if (correcto && sobrantes.length === 0) { planTutores.yaCorrecto++; continue; }
        const adultoExistente = correcto ? correcto.adultoResponsableId
            : adultos.find((a) => mismoNombre(`${a.apellido} ${a.nombre}`, tutor.texto));
        planTutores.cambios.push({
            insc, tutor, correcto, sobrantes, adultoExistente,
            texto: `${insc.cursoId.clave} ${nombreDe(insc)}: ${sobrantes.map((v) => `quita "${v.adultoResponsableId.apellido} ${v.adultoResponsableId.nombre}"`).join(', ') || '-'}`
                + `${correcto ? '' : ` | ${adultoExistente ? 'vincula existente' : 'crea'} "${tutor.texto}" ${tutor.telefonos.join('/')}`}`
        });
    }

    console.log(`\n=== ${COMMIT ? 'COMMIT' : 'DRY RUN (no se escribe nada)'} ===`);
    console.log(`Alumnos de ${ANIO_CLAVE} con datos: ${porEstudiante.size} de ${vigentes.length} vigentes`);
    const sinFila = vigentes.filter((i) => !porEstudiante.has(String(i.estudianteId._id)));
    console.log(`Vigentes sin fila: ${sinFila.map(nombreDe).join(', ') || '-'}`);
    console.log(`\n-- filas ignoradas (no vigentes en ${ANIO_CLAVE}): ${reporte.ignoradas.length}`);
    reporte.ignoradas.forEach((x) => console.log(`   ${x}`));
    console.log(`\n-- valores invalidos (no se cargan): ${reporte.invalidos.length}`);
    reporte.invalidos.forEach((x) => console.log(`   ${x}`));
    console.log(`\n-- conflictos entre filas repetidas: ${reporte.conflictos.length}`);
    reporte.conflictos.forEach((x) => console.log(`   ${x}`));
    console.log(`\n-- notas: ${planNotas.nuevas} nuevas, ${planNotas.iguales} ya iguales, ${planNotas.pisadas.length} pisadas`);
    planNotas.pisadas.forEach((x) => console.log(`   ${x}`));
    console.log(`\n-- tutores: ${planTutores.yaCorrecto} ya correctos, ${planTutores.cambios.length} a corregir`);
    planTutores.cambios.forEach((c) => console.log(`   ${c.texto}`));

    if (!COMMIT) { await mongoose.disconnect(); return; }

    let errores = 0;
    for (const op of operacionesNotas) {
        try {
            let cursada = await CursadaAsignatura.findOne({ estudianteId: op.estudianteId, asignaturaId: op.asignaturaId });
            if (!cursada) cursada = await CursadaAsignatura.create({ estudianteId: op.estudianteId, asignaturaId: op.asignaturaId });
            const campos = op.periodo === 'informe1C' ? { valoracion: op.valor } : { nota: op.valor };
            await Valoracion.findOneAndUpdate(
                { cursadaAsignaturaId: cursada._id, cicloLectivo: CICLO_LECTIVO, periodo: op.periodo },
                { $set: { ...campos, hechoPor: HECHO_POR } },
                { upsert: true, runValidators: true }
            );
        } catch (e) { errores++; console.error(`ERROR nota ${op.estudianteId} ${op.periodo}: ${e.message}`); }
    }

    const posiblesHuerfanos = new Set();
    for (const c of planTutores.cambios) {
        try {
            for (const v of c.sobrantes) {
                await EstudianteResponsable.deleteOne({ _id: v._id });
                posiblesHuerfanos.add(String(v.adultoResponsableId._id));
            }
            if (c.correcto) continue;
            let adulto = c.adultoExistente;
            if (!adulto) {
                adulto = await AdultoResponsable.create({ ...separarTutor(c.tutor.texto), telefonos: c.tutor.telefonos.map((numero) => ({ numero })) });
                adultos.push(adulto);
            } else {
                const ya = new Set(adulto.telefonos.map((t) => t.numero.replace(/\D/g, '')));
                const nuevos = c.tutor.telefonos.filter((t) => !ya.has(t.replace(/\D/g, '')));
                if (nuevos.length) await AdultoResponsable.updateOne({ _id: adulto._id }, { $push: { telefonos: { $each: nuevos.map((numero) => ({ numero })) } } });
            }
            await EstudianteResponsable.updateOne(
                { estudianteId: c.insc.estudianteId._id, adultoResponsableId: adulto._id },
                { $setOnInsert: { vinculo: 'Tutor', convive: true } },
                { upsert: true }
            );
        } catch (e) { errores++; console.error(`ERROR tutor ${c.texto}: ${e.message}`); }
    }
    let borrados = 0;
    for (const id of posiblesHuerfanos) {
        if (!(await EstudianteResponsable.exists({ adultoResponsableId: id }))) {
            await AdultoResponsable.deleteOne({ _id: id });
            borrados++;
        }
    }

    console.log(`\nCommit terminado. Adultos sin alumnos borrados: ${borrados}. Errores: ${errores}.`);
    await mongoose.disconnect();
    if (errores) process.exitCode = 1;
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
