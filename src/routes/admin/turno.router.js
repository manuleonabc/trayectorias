const express = require('express');
const router = express.Router();
const turnoController = require('../../controllers/admin/turno.controller');

router.get('/', turnoController.getTurnos);
router.post('/', turnoController.postTurno);

module.exports = router;
