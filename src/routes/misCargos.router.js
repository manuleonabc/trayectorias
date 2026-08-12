const express = require('express');
const router = express.Router();
const misCargosController = require('../controllers/misCargos.controller');

router.get('/', misCargosController.getMisCargos);

module.exports = router;
