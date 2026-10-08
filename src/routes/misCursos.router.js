const express = require('express');
const router = express.Router();
const misCursosController = require('../controllers/misCursos.controller');
const reubicacionController = require('../controllers/reubicacion.controller');

router.get('/', misCursosController.getMisCursos);
router.get('/:cursoClave', misCursosController.getMisCursoDetalle);
router.get('/:cursoClave/editar', misCursosController.getMisCursoEditar);
// AJAX (ver /js/asignaturasDocentes.js) - antes de /:cursoClave/estudiantes, mismo nivel.
router.get('/:cursoClave/asignaturas', misCursosController.getAsignaturasDocentes);
router.post('/:cursoClave/estudiantes', misCursosController.postEstudianteNuevo);
// Reubicacion entre cursos (ver reubicacion.controller.js) - anotar directo a quien no
// esta en ningun curso este año, o pedir enviar/traer y que el otro curso lo confirme.
router.get('/:cursoClave/reubicaciones', reubicacionController.getReubicaciones);
router.post('/:cursoClave/reubicaciones/anotar', reubicacionController.postAnotar);
router.post('/:cursoClave/reubicaciones/traer', reubicacionController.postSolicitarTraer);
router.post('/:cursoClave/reubicaciones/enviar', reubicacionController.postSolicitarEnviar);
router.post('/:cursoClave/reubicaciones/:solicitudId/aprobar', reubicacionController.postAprobar);
router.post('/:cursoClave/reubicaciones/:solicitudId/rechazar', reubicacionController.postRechazar);
router.post('/:cursoClave/reubicaciones/:solicitudId/cancelar', reubicacionController.postCancelar);
router.post('/:cursoClave/estudiantes/:inscripcionId/desvincular', misCursosController.postDesvincularEstudiante);
// AJAX (ver public/js/misCursoEditarOrden.js) - unica excepcion de escritura de esta
// seccion, para no refrescar toda la pagina en cada click de subir/bajar.
router.post('/:cursoClave/estudiantes/:inscripcionId/subir', misCursosController.postSubirRegistro);
router.post('/:cursoClave/estudiantes/:inscripcionId/bajar', misCursosController.postBajarRegistro);

module.exports = router;
