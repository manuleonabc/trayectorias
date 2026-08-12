const express = require('express');
// mergeParams para heredar :institucionClave del router que monta este (ver app.js).
const router = express.Router({ mergeParams: true });
const turnoController = require('../../controllers/admin/turno.controller');

router.get('/:turnoClave', turnoController.getTurnoDetalle);
router.post('/:turnoClave/modulos', turnoController.postModulo);

module.exports = router;
