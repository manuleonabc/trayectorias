const express = require('express');
const router = express.Router();
const solicitudCargoController = require('../controllers/solicitudCargo.controller');

// Este router cuelga de /solicitudes-cargo con requireAuth solo (ver app.js) - pedir un
// cargo es una accion sobre uno mismo. Solo tiene sentido para cuentas tipo 'personal'
// (una institucion no tiene una Persona propia que pueda ocupar un Cargo) - mismo patron
// de guard local puntual que ya usan estudiante.router.js/admin/anio.router.js.
const requirePersonal = (req, res, next) => {
    if (req.user.tipo === 'personal') return next();
    res.redirect('/estudiantes');
};

router.get('/', requirePersonal, solicitudCargoController.getSolicitudesCargo);
router.post('/', requirePersonal, solicitudCargoController.postSolicitudCargo);

module.exports = router;
