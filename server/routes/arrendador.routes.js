/**
 * Rutas para el flujo de ARRENDADOR (propietario que pone el inmueble en arriendo).
 */

const express = require('express');
const router = express.Router();
const {
  processArrendador,
  uploadArrendador
} = require('../controllers/upload.controller');

// POST /api/arrendador
router.post('/', uploadArrendador, processArrendador);

module.exports = router;
