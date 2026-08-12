const express = require('express');
const router = express.Router();
const anioController = require('../../controllers/admin/anio.controller');

// Este router ya cuelga de requireAdmin entero (ver app.js, que ademas ya exige
// modoGestion activo) - esto angosta mas todavia las rutas que tocan la estructura
// curricular del distrito (crear Anio/Asignatura, agregar una orientacion, editar una
// fila), reservadas al admin de mayor nivel. Mismo patron que el requireAdmin local ya
// existente en estudiante.router.js (duplicado a proposito, sin importar de app.js).
const requireNivelPoderTotal = (req, res, next) => {
    if (req.user.nivelPoder === 'total') return next();
    res.redirect('/admin/anios');
};

router.get('/', anioController.getAnios);
router.post('/', requireNivelPoderTotal, anioController.postAnio);
router.get('/:clave', anioController.getAnioDetalle);
router.post('/:clave/plantilla', requireNivelPoderTotal, anioController.postFilaPlantilla);
router.post('/:clave/orientaciones', requireNivelPoderTotal, anioController.postOrientacionParaAnio);

// Filas de la plantilla (sin orientacion).
router.get('/:clave/filas/:filaClave/editar', anioController.getEditarFila);
router.post('/:clave/filas/:filaClave', requireNivelPoderTotal, anioController.postEditarFila);
router.post('/:clave/filas/:filaClave/subir', anioController.postSubir);
router.post('/:clave/filas/:filaClave/bajar', anioController.postBajar);

// Una orientacion de este año, y sus filas.
router.get('/:clave/orientaciones/:orientacionClave', anioController.getOrientacionDetalle);
router.post('/:clave/orientaciones/:orientacionClave/filas', requireNivelPoderTotal, anioController.postFilaOrientacion);
router.get('/:clave/orientaciones/:orientacionClave/filas/:filaClave/editar', anioController.getEditarFila);
router.post('/:clave/orientaciones/:orientacionClave/filas/:filaClave', requireNivelPoderTotal, anioController.postEditarFila);
router.post('/:clave/orientaciones/:orientacionClave/filas/:filaClave/ajustar', anioController.postAjustar);
router.post('/:clave/orientaciones/:orientacionClave/filas/:filaClave/quitar', anioController.postQuitar);
router.post('/:clave/orientaciones/:orientacionClave/filas/:filaClave/subir', anioController.postSubir);
router.post('/:clave/orientaciones/:orientacionClave/filas/:filaClave/bajar', anioController.postBajar);

module.exports = router;
