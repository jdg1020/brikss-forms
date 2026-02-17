/**
 * Rutas para el flujo de COMPRADOR
 */

const express = require('express');
const router = express.Router();
const {
  processComprador,
  uploadComprador
} = require('../controllers/upload.controller');

// POST /api/comprador - Enviar formulario de comprador
router.post('/', uploadComprador, processComprador);

module.exports = router;
