const designacionRepo = require('../repos/designacion.repo');
const { fijarCargoActivo } = require('../utils/cargoActivo');

const getSeleccionarCargo = async (req, res) => {
    const designaciones = await designacionRepo.obtenerActivasPorPersona(req.user.entidadId);
    res.render('pages/seleccionarCargo', { designaciones });
};

const postSeleccionarCargo = async (req, res) => {
    const destino = await fijarCargoActivo(req, req.body.cargoId);
    res.redirect(destino);
};

module.exports = { getSeleccionarCargo, postSeleccionarCargo };
