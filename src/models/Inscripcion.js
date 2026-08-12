const mongoose = require('mongoose');

// Matricula de un estudiante a un Curso, por ciclo lectivo. Con fechaAlta/fechaBaja y
// motivo en ambas puntas, mismo patron que Designacion: cambio de escuela o de curso
// dentro de la misma escuela se modela cerrando la vigente y abriendo una nueva a otro
// Curso (que puede ser de otra institucion) - no editando la que ya existe. Solo puede
// haber una vigente (fechaBaja null) por estudiante a la vez, sin nada analogo al
// suplente de Designacion.
const inscripcionSchema = new mongoose.Schema(
    {
        estudianteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estudiante', required: true },
        cursoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso', required: true },
        cicloLectivo: { type: Number, required: true },
        fechaAlta: { type: Date, required: true },
        motivoAlta: { type: String, required: true, trim: true },
        // "Viene de" - opcional, texto libre (ej: "Escuela N° 15", "Otra provincia"). Solo
        // tiene sentido en el alta (de donde llega), no en la baja - por eso no tiene su
        // contraparte del lado de fechaBaja/motivoBaja.
        procedencia: { type: String, trim: true },
        // Numero de orden en el libro de matricula en papel de la institucion (que sigue
        // existiendo en paralelo - no se borra ni se renumera, solo se agrega). Va aca y no
        // en Estudiante porque el libro es propio de cada institucion: si el estudiante se
        // transfiere a otra escuela, tiene un numero distinto en el libro de la nueva. Texto
        // libre en vez de Number (puede haber correcciones/inserciones tipo "45 bis" en el
        // libro real) y opcional, se carga a mano al matricular - no se genera ni se valida
        // unicidad desde el sistema, es una transcripcion de lo que ya esta escrito en papel.
        numeroRegistro: { type: String, trim: true },
        fechaBaja: { type: Date, default: null },
        motivoBaja: { type: String, trim: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Inscripcion', inscripcionSchema);
