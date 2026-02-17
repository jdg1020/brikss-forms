/**
 * Rutas para el flujo de VENDEDOR
 */

const express = require('express');
const router = express.Router();
const {
  processVendedor,
  uploadVendedor
} = require('../controllers/upload.controller');

// POST /api/vendedor - Enviar formulario de vendedor
router.post('/', uploadVendedor, processVendedor);

module.exports = router;
