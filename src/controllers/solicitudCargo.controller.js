const cargoRepo = require('../repos/cargo.repo');
const designacionRepo = require('../repos/designacion.repo');
const solicitudCargoRepo = require('../repos/solicitudCargo.repo');

// Cargos vacantes: mismo patron que admin/cargo.controller.js::getCargos (traer todos y
// resolver la activa de cada uno), filtrando los que dan null.
const getSolicitudesCargo = async (req, res) => {
    const cargos = await cargoRepo.obtenerTodos();
    const activas = await Promise.all(cargos.map((cargo) => designacionRepo.obtenerActivaPorCargo(cargo._id)));
    const vacantes = cargos.filter((cargo, i) => !activas[i]);

    const misSolicitudes = await solicitudCargoRepo.obtenerPorPersona(req.user.entidadId);

    res.render('pages/solicitarCargo', { vacantes, misSolicitudes });
};

const postSolicitudCargo = async (req, res) => {
    const { cargoId, mensaje } = req.body;

    const cargo = await cargoRepo.obtenerPorId(cargoId);
    if (!cargo) {
        req.flash('error', 'Cargo inválido.');
        return res.redirect('/solicitudes-cargo');
    }

    const activa = await designacionRepo.obtenerActivaPorCargo(cargoId);
    if (activa) {
        req.flash('error', 'Ese cargo ya no está vacante.');
        return res.redirect('/solicitudes-cargo');
    }

    const duplicada = await solicitudCargoRepo.buscarPendienteDuplicada(req.user.entidadId, cargoId);
    if (duplicada) {
        req.flash('error', 'Ya tenés una solicitud pendiente para ese cargo.');
        return res.redirect('/solicitudes-cargo');
    }

    await solicitudCargoRepo.crear({ cargoId, personaId: req.user.entidadId, mensaje: mensaje || undefined });
    req.flash('success', 'Solicitud enviada.');
    res.redirect('/solicitudes-cargo');
};

module.exports = { getSolicitudesCargo, postSolicitudCargo };
