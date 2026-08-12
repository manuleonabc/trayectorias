const Asignatura = require('../models/Asignatura');

class AsignaturaRepo {
    async crear(datosFila) {
        const nuevaFila = new Asignatura(datosFila);
        return await nuevaFila.save();
    }

    // Filas sin orientacion: la plantilla del año (o el plan definitivo si es ciclo basico).
    async obtenerPlantilla(anioId) {
        return await Asignatura.find({ anioId, orientacionId: null }).sort({ orden: 1 });
    }

    async obtenerPorAnioYOrientacion(anioId, orientacionId) {
        return await Asignatura.find({ anioId, orientacionId }).sort({ orden: 1 });
    }

    async obtenerPorId(id) {
        return await Asignatura.findById(id);
    }

    // clave solo es unica dentro de (anioId, orientacionId) - nunca global.
    async obtenerPorClave(anioId, orientacionId, clave) {
        return await Asignatura.findOne({ anioId, orientacionId, clave });
    }

    async actualizar(id, datosFila) {
        return await Asignatura.findByIdAndUpdate(id, datosFila, { new: true });
    }

    // Clave, nombre, nombreCorto y orden no pueden repetirse dentro del mismo
    // (anioId, orientacionId) - la carga horaria es la unica excepcion. excluirId
    // se usa al editar, para no chocar contra la fila que se esta editando.
    async buscarDuplicado(anioId, orientacionId, { clave, nombre, nombreCorto, orden }, excluirId) {
        const filtro = {
            anioId,
            orientacionId,
            $or: [{ clave }, { nombre }, { nombreCorto }, { orden }]
        };
        if (excluirId) filtro._id = { $ne: excluirId };
        return await Asignatura.findOne(filtro);
    }

    // Ids de las orientaciones que ya tienen filas propias para este año.
    async obtenerOrientacionesUsadas(anioId) {
        return await Asignatura.find({ anioId, orientacionId: { $ne: null } }).distinct('orientacionId');
    }

    // Para no dejar filas huerfanas si se borra una orientacion en uso.
    async tieneFilas(orientacionId) {
        const cantidad = await Asignatura.countDocuments({ orientacionId });
        return cantidad > 0;
    }

    // Copia la plantilla del año como punto de partida de una orientacion nueva.
    async clonarPlantilla(anioId, orientacionId) {
        const plantilla = await this.obtenerPlantilla(anioId);
        if (plantilla.length === 0) return;

        const filasNuevas = plantilla.map((fila) => ({
            anioId,
            orientacionId,
            nombre: fila.nombre,
            nombreCorto: fila.nombreCorto,
            clave: fila.clave,
            cargaHoraria: fila.cargaHoraria,
            orden: fila.orden
        }));
        await Asignatura.insertMany(filasNuevas);
    }

    async eliminar(id) {
        return await Asignatura.findByIdAndDelete(id);
    }

    // Subir/bajar intercambian el orden con la fila vecina (mismo anioId + orientacionId).
    // Un intercambio entre dos valores que ya existen nunca puede crear un duplicado,
    // a diferencia de escribir un numero a mano - por eso no pasa por buscarDuplicado.
    async subir(id) {
        const fila = await Asignatura.findById(id);
        if (!fila) return;

        const anterior = await Asignatura.findOne({
            anioId: fila.anioId,
            orientacionId: fila.orientacionId,
            orden: { $lt: fila.orden }
        }).sort({ orden: -1 });
        if (!anterior) return;

        const ordenFila = fila.orden;
        fila.orden = anterior.orden;
        anterior.orden = ordenFila;
        await fila.save();
        await anterior.save();
    }

    async bajar(id) {
        const fila = await Asignatura.findById(id);
        if (!fila) return;

        const siguiente = await Asignatura.findOne({
            anioId: fila.anioId,
            orientacionId: fila.orientacionId,
            orden: { $gt: fila.orden }
        }).sort({ orden: 1 });
        if (!siguiente) return;

        const ordenFila = fila.orden;
        fila.orden = siguiente.orden;
        siguiente.orden = ordenFila;
        await fila.save();
        await siguiente.save();
    }
}

module.exports = new AsignaturaRepo();
