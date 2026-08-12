const express = require('express');
const router = express.Router();
const solicitudCargoController = require('../../controllers/admin/solicitudCargo.controller');

router.get('/', solicitudCargoController.getSolicitudesCargoAdmin);
router.post('/:id/aprobar', solicitudCargoController.postAprobarSolicitud);
router.post('/:id/rechazar', solicitudCargoController.postRechazarSolicitud);

module.exports = router;
