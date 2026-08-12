const express = require('express');
const router = express.Router({ mergeParams: true });
const cargoController = require('../../controllers/admin/cargo.controller');

router.get('/:cargoClave', cargoController.getCargoDetalle);
router.post('/:cargoClave/designaciones', cargoController.postDesignacionBase);
router.post('/:cargoClave/suplentes', cargoController.postSuplente);
router.post('/:cargoClave/designaciones/:designacionId/baja', cargoController.postBaja);
router.post('/:cargoClave/cursos', cargoController.postCursoCargo);
router.post('/:cargoClave/cursos/:cargoCursoId/eliminar', cargoController.postQuitarCursoCargo);

module.exports = router;
