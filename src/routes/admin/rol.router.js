const express = require('express');
const router = express.Router();
const rolController = require('../../controllers/admin/rol.controller');

router.get('/', rolController.getRoles);
router.post('/', rolController.postRol);
router.get('/:clave/editar', rolController.getEditarRol);
router.post('/:clave', rolController.postEditarRol);

module.exports = router;
