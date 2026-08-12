const cargoRepo = require('../repos/cargo.repo');
const designacionRepo = require('../repos/designacion.repo');
const { compararCargos } = require('../utils/ordenCargos');

// Directorio de cargos de la propia institucion, solo lectura - version reducida del
// listado de admin/cargo.controller.js::getCargos (mismo orden, sin alta/edicion/
// designacion) para cargos con nivelAcceso 'total' (jerarquicos/EMATP, ver Rol.js).
const getMisCargos = async (req, res) => {
    if (!req.session.cargoActivoId) return res.redirect('/estudiantes');

    const cargoActivo = await cargoRepo.obtenerPorId(req.session.cargoActivoId);
    if (!cargoActivo || !cargoActivo.rolId || cargoActivo.rolId.nivelAcceso !== 'total') {
        return res.redirect('/estudiantes');
    }

    const cargos = await cargoRepo.obtenerPorInstitucion(cargoActivo.institucionId._id);
    const activas = await Promise.all(cargos.map((cargo) => designacionRepo.obtenerActivaPorCargo(cargo._id)));
    const cargosConActiva = cargos.map((cargo, i) => ({ cargo, activa: activas[i] })).sort(compararCargos);

    res.render('pages/misCargos', { institucion: cargoActivo.institucionId, cargosConActiva });
};

module.exports = { getMisCargos };
