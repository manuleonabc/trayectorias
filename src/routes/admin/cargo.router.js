const express = require('express');
const router = express.Router();
const cargoController = require('../../controllers/admin/cargo.controller');

router.get('/', cargoController.getCargos);
router.post('/', cargoController.postCargo);
router.get('/:id/editar', cargoController.getEditarCargo);
router.post('/:id', cargoController.postEditarCargo);

module.exports = router;
