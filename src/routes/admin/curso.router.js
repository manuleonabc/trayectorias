const express = require('express');
const router = express.Router();
const cursoController = require('../../controllers/admin/curso.controller');

router.get('/', cursoController.getCursos);
router.post('/', cursoController.postCurso);

module.exports = router;
