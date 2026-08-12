const express = require('express');
const router = express.Router({ mergeParams: true });
const cursoController = require('../../controllers/admin/curso.controller');

router.get('/:cursoClave', cursoController.getCursoDetalle);
router.get('/:cursoClave/editar', cursoController.getEditarCurso);
router.post('/:cursoClave/editar', cursoController.postEditarCurso);
router.post('/:cursoClave/eliminar', cursoController.postEliminarCurso);
router.post('/:cursoClave/estudiantes', cursoController.postEstudianteNuevo);
router.post('/:cursoClave/estudiantes/existente', cursoController.postInscribirExistente);

module.exports = router;
