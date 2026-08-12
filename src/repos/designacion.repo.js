const Designacion = require('../models/Designacion');
const licenciaRepo = require('./licencia.repo');

class DesignacionRepo {
    async crear(datosDesignacion) {
        const nuevaDesignacion = new Designacion(datosDesignacion);
        return await nuevaDesignacion.save();
    }

    async obtenerPorId(id) {
        return await Designacion.findById(id).populate('personaId');
    }

    // Vigentes de un cargo, de mas vieja a mas nueva.
    async obtenerVigentesPorCargo(cargoId) {
        return await Designacion.find({ cargoId, fechaBaja: null })
            .sort({ fechaAlta: 1 })
            .populate('personaId');
    }

    // Solo puede haber una vigente que no sea suplente (la base: titular/provisional/
    // interino) - el resto de las vigentes son la cadena de suplentes por encima de ella.
    // Separarlas importa: cuando se promueve un suplente a base (ver darDeBaja), su
    // fechaAlta se reescribe a la fecha de la promocion, que puede caer DESPUES de la
    // fechaAlta de un suplente mas nuevo que ya existiera por encima. Comparar fechas
    // entre TODAS las vigentes por igual rompe el orden en ese caso - las fechas de los
    // suplentes nunca se reescriben (solo salen del pool cuando se promueven), asi que
    // comparar solo entre ellos es lo unico confiable para saber quien esta mas arriba.
    async obtenerCadenaPorCargo(cargoId) {
        const vigentes = await this.obtenerVigentesPorCargo(cargoId);
        const base = vigentes.find((d) => d.situacionRevista !== 'suplente') || null;
        const suplentesVigentes = vigentes.filter((d) => d.situacionRevista === 'suplente');
        return { base, suplentesVigentes };
    }

    // El suplente vigente mas nuevo es quien ejerce el cargo hoy; si no hay ninguno,
    // ejerce la base. Las demas vigentes (si hay) estan cubiertas.
    async obtenerActivaPorCargo(cargoId) {
        const { base, suplentesVigentes } = await this.obtenerCadenaPorCargo(cargoId);
        return suplentesVigentes.length ? suplentesVigentes[suplentesVigentes.length - 1] : base;
    }

    async obtenerHistorialPorCargo(cargoId) {
        return await Designacion.find({ cargoId }).sort({ fechaAlta: -1 }).populate('personaId');
    }

    // Para la eliminacion de un Curso (ver admin/curso.controller.js::postEliminarCurso):
    // los ids de todas las designaciones (vigentes o no) de un lote de cargos - se
    // necesitan antes de borrarlas, para poder borrar tambien sus Licencia (ver
    // licenciaRepo.eliminarPorDesignaciones).
    async obtenerIdsPorCargos(cargoIds) {
        const designaciones = await Designacion.find({ cargoId: { $in: cargoIds } }, '_id');
        return designaciones.map((d) => d._id);
    }

    async eliminarPorCargos(cargoIds) {
        return await Designacion.deleteMany({ cargoId: { $in: cargoIds } });
    }

    // Para el selector de cargo al iniciar sesion: solo las designaciones donde esta
    // persona es quien ejerce hoy, no las que tiene pero estan cubiertas por un suplente.
    async obtenerActivasPorPersona(personaId) {
        const vigentes = await Designacion.find({ personaId, fechaBaja: null })
            .populate({ path: 'cargoId', populate: ['institucionId', 'turnoId', 'rolId'] });

        const activas = [];
        for (const designacion of vigentes) {
            const activaDelCargo = await this.obtenerActivaPorCargo(designacion.cargoId._id);
            if (activaDelCargo && String(activaDelCargo._id) === String(designacion._id)) {
                activas.push(designacion);
            }
        }
        return activas;
    }

    // Alta como titular/provisional/interino: solo si el cargo no tiene ninguna
    // designacion vigente (no hay a quien reemplazar sin darlo de baja antes).
    async altaBase({ cargoId, personaId, situacionRevista, fechaAlta }) {
        const activa = await this.obtenerActivaPorCargo(cargoId);
        if (activa) throw new Error('Este cargo ya tiene una designacion vigente.');
        return await this.crear({ cargoId, personaId, situacionRevista, fechaAlta });
    }

    // Alta como suplente: solo si el cargo ya tiene una designacion activa, y siempre
    // con una licencia (nueva o ya cargada) que respalde la vigente que se va a cubrir.
    async altaSuplente({ cargoId, personaId, fechaAlta, licenciaId, licencia }) {
        const activa = await this.obtenerActivaPorCargo(cargoId);
        if (!activa) throw new Error('Este cargo no tiene una designacion vigente para suplir.');

        let licenciaUsada;
        if (licenciaId) {
            licenciaUsada = await licenciaRepo.obtenerVigentePorDesignacion(activa._id);
            if (!licenciaUsada || String(licenciaUsada._id) !== String(licenciaId)) {
                throw new Error('La licencia elegida no es una licencia vigente de esa designacion.');
            }
        } else {
            licenciaUsada = await licenciaRepo.crear({
                designacionId: activa._id,
                motivo: licencia.motivo,
                fechaInicio: licencia.fechaInicio || fechaAlta,
                fechaFin: null
            });
        }

        const suplente = await this.crear({ cargoId, personaId, situacionRevista: 'suplente', fechaAlta });
        return { suplente, licencia: licenciaUsada };
    }

    // Baja definitiva de una designacion. Si era la base de una cadena vigente (no un
    // suplente), el suplente inmediato pasa a provisional (se cierra esa designacion y se
    // abre una nueva, con la misma fecha) - el resto de la cadena no se toca: a quien
    // reemplaza cada suplente se deduce del orden cronologico de las vigentes del cargo,
    // asi que se recalcula solo la proxima vez que se consulte, sin reescribir nada mas.
    async darDeBaja(id, { fecha, motivoBaja }) {
        const designacion = await Designacion.findById(id);
        if (!designacion) return null;

        designacion.fechaBaja = fecha;
        designacion.motivoBaja = motivoBaja;
        await designacion.save();

        if (designacion.situacionRevista !== 'suplente') {
            const { suplentesVigentes } = await this.obtenerCadenaPorCargo(designacion.cargoId);
            if (suplentesVigentes.length > 0) {
                const siguiente = await Designacion.findById(suplentesVigentes[0]._id);
                siguiente.fechaBaja = fecha;
                await siguiente.save();
                await this.crear({
                    cargoId: siguiente.cargoId,
                    personaId: siguiente.personaId,
                    situacionRevista: 'provisional',
                    fechaAlta: fecha
                });
            }
        }

        return designacion;
    }
}

module.exports = new DesignacionRepo();
