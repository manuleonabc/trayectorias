const express = require('express');
const router = express.Router();
const orientacionController = require('../../controllers/admin/orientacion.controller');

router.get('/', orientacionController.getOrientaciones);
router.post('/', orientacionController.postOrientacion);
router.get('/:clave/editar', orientacionController.getEditarOrientacion);
router.post('/:clave', orientacionController.postEditarOrientacion);
router.post('/:clave/eliminar', orientacionController.postEliminarOrientacion);

module.exports = router;
