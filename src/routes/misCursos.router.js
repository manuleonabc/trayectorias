const express = require('express');
const router = express.Router();
const misCursosController = require('../controllers/misCursos.controller');

router.get('/', misCursosController.getMisCursos);
router.get('/:cursoClave', misCursosController.getMisCursoDetalle);
// AJAX (ver /js/asignaturasDocentes.js) - antes de /:cursoClave/estudiantes, mismo nivel.
router.get('/:cursoClave/asignaturas', misCursosController.getAsignaturasDocentes);
router.post('/:cursoClave/estudiantes', misCursosController.postEstudianteNuevo);
router.post('/:cursoClave/estudiantes/existente', misCursosController.postInscribirExistente);

module.exports = router;
