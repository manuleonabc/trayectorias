const express = require('express');
const router = express.Router();
const institucionController = require('../../controllers/admin/institucion.controller');

router.get('/', institucionController.getInstituciones);
router.get('/:cue/editar', institucionController.getEditarInstitucion);
router.post('/:cue', institucionController.postEditarInstitucion);

module.exports = router;
