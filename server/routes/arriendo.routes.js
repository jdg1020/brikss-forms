/**
 * Rutas para el flujo de ARRIENDO
 */

const express = require('express');
const router = express.Router();
const {
  processArriendo,
  uploadArriendo
} = require('../controllers/upload.controller');

// POST /api/arriendo - Enviar formulario de arriendo
router.post('/', uploadArriendo, processArriendo);

module.exports = router;
