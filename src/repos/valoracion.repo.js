const Valoracion = require('../models/Valoracion');
const CursadaAsignatura = require('../models/CursadaAsignatura');

class ValoracionRepo {
    async obtenerUna(cursadaAsignaturaId, cicloLectivo, periodo) {
        return await Valoracion.findOne({ cursadaAsignaturaId, cicloLectivo, periodo });
    }

    async obtenerPorCursadaYCiclo(cursadaAsignaturaId, cicloLectivo) {
        return await Valoracion.find({ cursadaAsignaturaId, cicloLectivo });
    }

    // Bulk fetch para la matriz "por curso" (ver valoracion.controller.js::getPorCurso) -
    // una sola consulta para todas las celdas de la matriz en vez de una por celda.
    async obtenerPorCursadasYPeriodo(cursadaAsignaturaIds, cicloLectivo, periodo) {
        return await Valoracion.find({ cursadaAsignaturaId: { $in: cursadaAsignaturaIds }, cicloLectivo, periodo });
    }

    // Guarda o actualiza la fila de este periodo puntual - recargar el mismo periodo pisa
    // lo que ya habia (upsert), nunca duplica (ver el indice unico del modelo:
    // cursadaAsignaturaId+cicloLectivo+periodo).
    async guardar({ cursadaAsignaturaId, cicloLectivo, periodo, valoracion, nota, recuperoSaberesC1, observacion, hechoPor }) {
        return await Valoracion.findOneAndUpdate(
            { cursadaAsignaturaId, cicloLectivo, periodo },
            { valoracion, nota, recuperoSaberesC1: !!recuperoSaberesC1, observacion, hechoPor },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        );
    }

    // Revisa si, con las Valoracion cargadas hasta ahora para esta CursadaAsignatura en
    // este cicloLectivo, corresponde marcarla aprobada - y si es asi, escribe
    // aprobada/fechaAprobacion/notaFinal en la CursadaAsignatura (solo entonces, nunca
    // antes - CursadaAsignatura no sabe nada de este regimen, ver el modelo). No hace nada
    // si ya estaba aprobada (no pisa una aprobacion ya registrada por una carga posterior,
    // ej. una correccion de una nota que ya no cambia nada).
    //
    // 3 escenarios de aprobacion (Nuevo Regimen Academico, Res. 1650/24):
    //   1. nota1C >= 7 y nota2C >= 7 -> nota final = promedio de ambas.
    //   2. nota2C >= 7 con recuperoSaberesC1 marcado (aunque nota1C < 7) -> misma formula
    //      de promedio (si no hay nota1C cargada, la final es directamente nota2C).
    //   3. diciembre o febrero con valoracion 'AA' y una nota cargada -> esa nota, tal
    //      cual, es la nota final (nunca se promedia con las de cuatrimestre).
    async actualizarAprobacionSiCorresponde(cursadaAsignaturaId, cicloLectivo) {
        const cursada = await CursadaAsignatura.findById(cursadaAsignaturaId);
        if (!cursada || cursada.aprobada) return;

        const valoraciones = await this.obtenerPorCursadaYCiclo(cursadaAsignaturaId, cicloLectivo);
        const porPeriodo = {};
        valoraciones.forEach((v) => { porPeriodo[v.periodo] = v; });

        const nota1C = porPeriodo.nota1C ? porPeriodo.nota1C.nota : null;
        const nota2C = porPeriodo.nota2C ? porPeriodo.nota2C.nota : null;

        const aprobarPorCuatrimestres = (fechaAprobacion) => {
            const notaFinal = nota1C != null ? (nota1C + nota2C) / 2 : nota2C;
            cursada.aprobada = true;
            cursada.fechaAprobacion = fechaAprobacion;
            cursada.notaFinal = notaFinal;
        };

        if (nota1C != null && nota1C >= 7 && nota2C != null && nota2C >= 7) {
            aprobarPorCuatrimestres(porPeriodo.nota2C.createdAt);
            return await cursada.save();
        }

        if (nota2C != null && nota2C >= 7 && porPeriodo.nota2C.recuperoSaberesC1) {
            aprobarPorCuatrimestres(porPeriodo.nota2C.createdAt);
            return await cursada.save();
        }

        for (const periodoIntensificacion of ['diciembre', 'febrero']) {
            const v = porPeriodo[periodoIntensificacion];
            if (v && v.valoracion === 'AA' && v.nota != null) {
                cursada.aprobada = true;
                cursada.fechaAprobacion = v.createdAt;
                cursada.notaFinal = v.nota;
                return await cursada.save();
            }
        }
    }
}

module.exports = new ValoracionRepo();
