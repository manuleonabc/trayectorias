const express = require('express');
const router = express.Router();
const cargoController = require('../controllers/cargo.controller');

router.get('/', cargoController.getSeleccionarCargo);
router.post('/', cargoController.postSeleccionarCargo);

module.exports = router;
