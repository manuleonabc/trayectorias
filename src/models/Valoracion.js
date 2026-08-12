const mongoose = require('mongoose');

// Registro puntual del Nuevo Regimen Academico (Res. 1650/24), para UNA ronda anual
// (cicloLectivo) de UNA CursadaAsignatura (que es unica para siempre por estudiante+
// asignatura, nunca se duplica - ni al recursar, ver el comentario en CursadaAsignatura.js).
// Por eso cicloLectivo vive ACA y no en CursadaAsignatura: la misma relacion puede
// acumular rondas de varios años (2024, 2025, 2026...) hasta que finalmente se aprueba -
// sea porque recursa (esa ronda tiene informe1C/nota1C/informe2C/nota2C de nuevo, cursada
// completa) o porque sigue intensificando lo pendiente sin recursar (esa ronda solo tiene
// diciembre/febrero, sin volver a cursar el año completo - la distincion sale sola de que
// periodos tiene cargados esa ronda, no hace falta un flag aparte).
//
// Cuando una carga aca implica que la materia quedo aprobada, algo aparte (no este modelo)
// escribe aprobada/fechaAprobacion/notaFinal en la CursadaAsignatura correspondiente.
//
// periodo (6 instancias posibles por ronda/cicloLectivo, a lo sumo una fila por cada uno -
// ver el indice unico):
//   - informe1C / informe2C: valoracion preliminar a mitad de cuatrimestre (mayo/octubre) -
//     solo valoracion (TEA/TEP/TED) + observacion opcional, sin nota.
//   - nota1C / nota2C: cierre de cada cuatrimestre - solo nota (1-10), sin valoracion.
//     nota2C ademas puede llevar recuperoSaberesC1 (ver mas abajo).
//   - diciembre: primera instancia de intensificacion - valoracion (AA/CCA/CSA) +
//     observacion opcional; nota (4-10) solo si valoracion es AA.
//   - febrero: cierre del ciclo lectivo - valoracion (AA/CCA/CSA) + observacion opcional;
//     ACA la nota (4-10) es obligatoria siempre, haya aprobado o no (a diferencia de
//     diciembre) - es el registro administrativo de cierre de año.
const valoracionSchema = new mongoose.Schema(
    {
        cursadaAsignaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CursadaAsignatura', required: true },
        cicloLectivo: { type: Number, required: true },
        periodo: {
            type: String,
            enum: ['informe1C', 'nota1C', 'informe2C', 'nota2C', 'diciembre', 'febrero'],
            required: true
        },
        // TEA/TEP/TED en informe1C/informe2C; AA/CCA/CSA en diciembre/febrero; sin uso en
        // nota1C/nota2C (ahi no hay valoracion, solo la nota numerica del cuatrimestre).
        valoracion: { type: String, enum: ['TEA', 'TEP', 'TED', 'AA', 'CCA', 'CSA'] },
        // Nota de ESTE periodo puntual - no confundir con CursadaAsignatura.notaFinal (el
        // resultado final de la materia, que se escribe aparte solo cuando aprueba).
        nota: { type: Number, min: 1, max: 10 },
        // Solo tiene sentido en periodo 'nota2C': el docente confirma que ademas de
        // aprobar el segundo cuatrimestre, el estudiante recupero los saberes que debia
        // del primero - sin este flag explicito no hay forma de distinguir "aprobo C2 y
        // recupero C1" de "aprobo C2 pero sigue debiendo C1" (en ambos casos C1<7, C2>=7).
        recuperoSaberesC1: { type: Boolean, default: false },
        // Solo la carga un profesor (preceptor/EMATP/jerarquicos solo cargan valoracion).
        observacion: { type: String, trim: true },
        // Nombre de usuario del mail (antes del @) de quien cargo esto - mismo criterio
        // que auditoria, ver utils/hechoPor.js.
        hechoPor: { type: String, trim: true, required: true }
    },
    { timestamps: true }
);

// Una sola fila por periodo dentro de la misma ronda (cursadaAsignaturaId+cicloLectivo) -
// recargar el mismo periodo actualiza esta fila, no crea una nueva. Distinto cicloLectivo
// para la misma CursadaAsignatura = otra ronda (recursando o intensificando de largo).
valoracionSchema.index({ cursadaAsignaturaId: 1, cicloLectivo: 1, periodo: 1 }, { unique: true });

module.exports = mongoose.model('Valoracion', valoracionSchema);
