/**
 * BRIKSS Forms - Servidor Express
 * Punto de entrada principal del servidor
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const compradorRoutes = require('./routes/comprador.routes');
const vendedorRoutes = require('./routes/vendedor.routes');
const arriendoRoutes = require('./routes/arriendo.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estaticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas API
app.use('/api/comprador', compradorRoutes);
app.use('/api/vendedor', vendedorRoutes);
app.use('/api/arriendo', arriendoRoutes);

// Ruta de salud
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'BRIKSS Forms'
  });
});

// Manejo de errores global
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';
  res.status(statusCode).json({
    success: false,
    message: isDev ? (err.message || 'Error interno del servidor') : 'Error interno del servidor',
    ...(isDev && { stack: err.stack })
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n  BRIKSS Forms Server`);
  console.log(`  -------------------`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Estado:  Activo\n`);
});

module.exports = app;
