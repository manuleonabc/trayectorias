const express = require('express');
const router = express.Router();
const usuarioController = require('../../controllers/admin/usuario.controller');

router.get('/', usuarioController.getUsuarios);
router.post('/:id/aprobar', usuarioController.postAprobar);
router.post('/:id/rechazar', usuarioController.postRechazar);

module.exports = router;
