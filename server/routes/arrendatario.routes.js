/**
 * Rutas para el flujo de ARRENDATARIO (inquilino).
 */

const express = require('express');
const router = express.Router();
const {
  processArrendatario,
  uploadArrendatario
} = require('../controllers/upload.controller');

// POST /api/arrendatario
router.post('/', uploadArrendatario, processArrendatario);

module.exports = router;
