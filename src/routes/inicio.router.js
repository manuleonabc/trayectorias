const express = require('express');
const router = express.Router();
const inicioController = require('../controllers/inicio.controller');

router.get('/', inicioController.getInicio);

module.exports = router;
