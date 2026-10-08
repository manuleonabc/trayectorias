const Inscripcion = require('../models/Inscripcion');
const Curso = require('../models/Curso');

const populateCurso = {
    path: 'cursoId',
    populate: ['institucionId', 'anioId', 'turnoId', 'orientacionId']
};

// Numero inicial de un numeroRegistro (texto libre, ej "45 bis") - null si esta vacio o no
// arranca con digitos.
const numeroDeRegistro = (inscripcion) => {
    if (!inscripcion.numeroRegistro) return null;
    const match = /^(\d+)/.exec(inscripcion.numeroRegistro);
    return match ? parseInt(match[1], 10) : null;
};

// Orden por defecto de "estudiantes inscriptos en un curso": primero por N° de registro
// (numerico - refleja el orden del libro de matricula en papel), los que no tienen uno
// cargado quedan al final; a igualdad, o entre los que no tienen registro, por apellido y
// despues nombre. Pedido explicito del usuario: subir/bajar una fila (ver
// subirRegistro/bajarRegistro mas abajo) reasigna directamente el N° de registro con la
// fila vecina - no hay un "orden" separado, el numero del libro ES el orden.
const compararPorRegistroYApellido = (a, b) => {
    const numA = numeroDeRegistro(a);
    const numB = numeroDeRegistro(b);
    if (numA != null && numB != null && numA !== numB) return numA - numB;
    if (numA != null && numB == null) return -1;
    if (numA == null && numB != null) return 1;
    return a.estudianteId.personaId.apellido.localeCompare(b.estudianteId.personaId.apellido, 'es')
        || a.estudianteId.personaId.nombre.localeCompare(b.estudianteId.personaId.nombre, 'es');
};

class InscripcionRepo {
    // session opcional - ver matricular() y crearEstudianteEnCurso en
    // estudiante.controller.js (alta atomica de Persona+Estudiante+Inscripcion+CursadaAsignatura).
    async crear(datosInscripcion, session) {
        const nuevaInscripcion = new Inscripcion(datosInscripcion);
        return await nuevaInscripcion.save({ session });
    }

    async obtenerVigentePorEstudiante(estudianteId) {
        return await Inscripcion.findOne({ estudianteId, fechaBaja: null }).populate(populateCurso);
    }

    // Bulk fetch para listados grandes (ver getEstudiantes en estudiante.controller.js) -
    // en vez de una consulta por estudiante (N+1, se nota fuerte con cientos de
    // estudiantes), una sola consulta con $in trae todas las vigentes de una vez. Devuelve
    // un Map por estudianteId (String) para lookup O(1) al armar la lista.
    async obtenerVigentesPorEstudiantes(estudianteIds) {
        const vigentes = await Inscripcion.find({ estudianteId: { $in: estudianteIds }, fechaBaja: null })
            .populate(populateCurso);
        return new Map(vigentes.map((i) => [String(i.estudianteId), i]));
    }

    async obtenerHistorialPorEstudiante(estudianteId) {
        return await Inscripcion.find({ estudianteId }).sort({ fechaAlta: -1 }).populate(populateCurso);
    }

    async obtenerVigentesPorCurso(cursoId) {
        const inscripciones = await Inscripcion.find({ cursoId, fechaBaja: null })
            .populate({ path: 'estudianteId', populate: 'personaId' });
        return inscripciones.sort(compararPorRegistroYApellido);
    }

    async obtenerPorId(id) {
        return await Inscripcion.findById(id);
    }

    // Intercambia el N° de registro entre dos inscripciones vecinas - devuelve [actual,
    // vecino] en ese orden fijo, para que el llamador (ver misCursos.controller.js) sepa
    // cual es cual al armar la respuesta AJAX.
    async intercambiarRegistro(actual, vecino) {
        const registroActual = actual.numeroRegistro;
        actual.numeroRegistro = vecino.numeroRegistro;
        vecino.numeroRegistro = registroActual;
        await Promise.all([actual.save(), vecino.save()]);
        return [actual, vecino];
    }

    // Sube/baja una inscripcion en la lista de un curso reasignando su N° de registro con
    // el de la fila vecina (pedido explicito del usuario: el numero del libro ES el orden,
    // no un campo separado) - null si ya esta en la punta y no hay vecino con quien
    // intercambiar.
    async subirRegistro(cursoId, inscripcionId) {
        const vigentes = await this.obtenerVigentesPorCurso(cursoId);
        const idx = vigentes.findIndex((i) => String(i._id) === String(inscripcionId));
        if (idx <= 0) return null;
        return this.intercambiarRegistro(vigentes[idx], vigentes[idx - 1]);
    }

    async bajarRegistro(cursoId, inscripcionId) {
        const vigentes = await this.obtenerVigentesPorCurso(cursoId);
        const idx = vigentes.findIndex((i) => String(i._id) === String(inscripcionId));
        if (idx === -1 || idx >= vigentes.length - 1) return null;
        return this.intercambiarRegistro(vigentes[idx], vigentes[idx + 1]);
    }

    // Vigente O historica (sin filtrar fechaBaja) - guard para no poder eliminar un Curso
    // que tuvo alguna vez estudiantes matriculados, aunque hoy no le quede ninguno vigente
    // (perderian ese tramo de su trayectoria si el curso desaparece).
    async existeAlgunaPorCurso(cursoId) {
        return await Inscripcion.exists({ cursoId });
    }

    // Matricula a un curso: si el estudiante ya tenia una vigente (en este curso, otro
    // curso de la misma institucion, u otra institucion), la cierra con el mismo
    // motivo/fecha antes de abrir la nueva - cubre alta inicial y cambio de curso/escuela
    // con la misma operacion. session opcional, mismo motivo que en crear().
    async matricular({ estudianteId, cursoId, cicloLectivo, fecha, motivo, numeroRegistro, procedencia }, session) {
        const vigente = await Inscripcion.findOne({ estudianteId, fechaBaja: null }).session(session);
        if (vigente) {
            vigente.fechaBaja = fecha;
            vigente.motivoBaja = motivo;
            await vigente.save({ session });
        }
        return await this.crear({
            estudianteId,
            cursoId,
            cicloLectivo,
            fechaAlta: fecha,
            motivoAlta: motivo,
            numeroRegistro: numeroRegistro || undefined,
            procedencia: procedencia || undefined
        }, session);
    }

    // Sugerencia de "N° de registro" al matricular: el consecutivo al mas alto ya usado en
    // el libro de matricula de esta institucion (numeroRegistro es texto libre - "45 bis",
    // etc - asi que se toma el numero inicial de cada uno con una regex y se ignoran los
    // que no arrancan con digitos). Es solo una sugerencia precargada en el form, se puede
    // editar/borrar - no hay garantia de que el libro real este sin huecos ni duplicados.
    async obtenerSiguienteNumeroRegistro(institucionId) {
        const cursos = await Curso.find({ institucionId }, '_id');
        const inscripciones = await Inscripcion.find(
            { cursoId: { $in: cursos.map((c) => c._id) }, numeroRegistro: { $nin: [null, ''] } },
            'numeroRegistro'
        );

        let mayor = 0;
        inscripciones.forEach((i) => {
            const match = /^(\d+)/.exec(i.numeroRegistro);
            if (match) mayor = Math.max(mayor, parseInt(match[1], 10));
        });

        return String(mayor + 1);
    }

    // Edita los datos propios de la inscripcion vigente (fecha/motivo de alta, N° de
    // registro, procedencia) - nunca el curso en si (eso es un cambio de curso/escuela,
    // ver matricular()) ni el ciclo lectivo.
    async actualizar(id, { fechaAlta, motivoAlta, numeroRegistro, procedencia }) {
        return await Inscripcion.findByIdAndUpdate(
            id,
            { fechaAlta, motivoAlta, numeroRegistro: numeroRegistro || undefined, procedencia: procedencia || undefined },
            { new: true }
        );
    }

    async darDeBaja(id, { fecha, motivo }) {
        return await Inscripcion.findByIdAndUpdate(
            id,
            { fechaBaja: fecha, motivoBaja: motivo },
            { new: true }
        );
    }

    // Para la baja real de un Estudiante (ver postEliminarEstudiante) - borra las filas,
    // nunca el Curso en si.
    async eliminarPorEstudiante(estudianteId) {
        return await Inscripcion.deleteMany({ estudianteId });
    }
}

module.exports = new InscripcionRepo();
