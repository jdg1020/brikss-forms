/**
 * BRIKSS Forms - Servidor Express
 * Punto de entrada principal del servidor
 */

const fs = require('fs');
const path = require('path');

// Carga de .env: prioridad a BRIKSS_ENV_PATH (apuntando a credenciales fuera
// del repo), luego al .env local del proyecto.
const envCandidates = [
  process.env.BRIKSS_ENV_PATH,
  path.join(__dirname, '..', '.env')
].filter(Boolean);

const envPath = envCandidates.find(p => fs.existsSync(p));
require('dotenv').config(envPath ? { path: envPath } : undefined);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const compradorRoutes = require('./routes/comprador.routes');
const vendedorRoutes = require('./routes/vendedor.routes');
const arrendadorRoutes = require('./routes/arrendador.routes');
const arrendatarioRoutes = require('./routes/arrendatario.routes');
const googleSheetsService = require('./services/googleSheets.service');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // 'unsafe-inline' en style-src es necesario por estilos inline mínimos
      // del template (display:flex en confirmacion, etc.).
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': ["'self'", 'data:', 'https:'],
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"]
    }
  },
  // HSTS: 1 año, incluye subdominios, listo para hsts-preload.org.
  // Render termina TLS upstream; con trust proxy=1 helmet detecta el origen
  // como HTTPS y emite el header en respuestas reales.
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !isProd) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  methods: ['GET', 'POST'],
  credentials: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Healthcheck DEBE estar antes del rate-limiter: Render hace ping cada ~30s
// y bajo el limite global tumbaría rápidamente la cuota legitima.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'BRIKSS Forms'
  });
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' }
});

app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: isProd ? '1d' : 0,
  dotfiles: 'deny'
}));

app.use('/api/comprador', compradorRoutes);
app.use('/api/vendedor', vendedorRoutes);
app.use('/api/arrendador', arrendadorRoutes);
app.use('/api/arrendatario', arrendatarioRoutes);

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  if (!isProd) console.error(err.stack);

  if (err.message && err.message.startsWith('CORS bloqueado')) {
    return res.status(403).json({ success: false, message: 'Origen no autorizado' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Archivo demasiado grande (máximo 10MB)' });
  }

  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ success: false, message: err.message });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: isProd ? 'Error interno del servidor' : (err.message || 'Error interno del servidor'),
    ...(isProd ? {} : { stack: err.stack })
  });
});

const server = app.listen(PORT, async () => {
  console.log(`\n  BRIKSS Forms Server`);
  console.log(`  -------------------`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Modo:    ${isProd ? 'production' : 'development'}`);
  console.log(`  Estado:  Activo\n`);

  // Pre-crear los headers del Sheet para evitar race condition con
  // formularios paralelos (ver diagnostico, hallazgo Medio #3).
  await googleSheetsService.ensureHeadersAtBoot();
});

// Render manda SIGTERM al hacer redeploy o autoscale. Cerramos limpio para
// no dejar requests en vuelo a Drive/Sheets ni archivos huérfanos en uploads/.
function shutdown(signal) {
  console.log(`[Shutdown] ${signal} recibido, cerrando server...`);
  server.close((err) => {
    if (err) {
      console.error('[Shutdown] Error cerrando server:', err.message);
      process.exit(1);
    }
    console.log('[Shutdown] Server cerrado.');
    process.exit(0);
  });
  // Hard kill si no cierra en 15s (Render espera 30s antes de SIGKILL).
  setTimeout(() => {
    console.error('[Shutdown] Timeout, forzando exit.');
    process.exit(1);
  }, 15000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
