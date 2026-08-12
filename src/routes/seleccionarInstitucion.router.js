const express = require('express');
const router = express.Router();
const seleccionarInstitucionController = require('../controllers/seleccionarInstitucion.controller');

router.get('/', seleccionarInstitucionController.getSeleccionarInstitucion);
router.post('/', seleccionarInstitucionController.postSeleccionarInstitucion);

module.exports = router;
