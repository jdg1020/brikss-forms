/**
 * Controlador de carga de archivos y procesamiento de formularios
 * Maneja la recepcion de datos y archivos PDF de los tres flujos
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const googleDriveService = require('../services/googleDrive.service');
const googleSheetsService = require('../services/googleSheets.service');
const emailService = require('../services/email.service');

// Configuracion de multer para archivos temporales
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Generar ID de referencia
function generateRefId(prefix) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `${prefix}-${date}-${seq}`;
}

// Generar URL de carpeta en Drive
function getDriveFolderUrl(folderId) {
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';
}

// Limpiar archivos temporales
function cleanupFiles(files) {
  if (!files) return;
  const fileList = Array.isArray(files) ? files : Object.values(files).flat();
  fileList.forEach(file => {
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
}

/**
 * Procesar formulario de COMPRADOR
 */
async function processComprador(req, res, next) {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const refId = generateRefId('COMP');

    // Validaciones basicas del servidor
    if (!data.nombre || !data.cedula || !data.email) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: nombre, cedula, email'
      });
    }

    if (!req.files || !req.files.cedula || req.files.cedula.length === 0) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Es obligatorio adjuntar la cedula del comprador'
      });
    }

    // Nombre de carpeta: "Nombre Completo - COMP-20260226-001"
    const folderName = `${data.nombre.trim()} - ${refId}`;

    // Subir a Google Drive
    let driveResult = null;
    try {
      driveResult = await googleDriveService.uploadFormFiles(
        'Compradores',
        folderName,
        data,
        req.files
      );
    } catch (driveError) {
      console.warn('[Drive] No se pudo subir a Google Drive:', driveError.message);
    }

    // Registrar en Google Sheets
    const driveFolderUrl = driveResult && driveResult.folderId
      ? getDriveFolderUrl(driveResult.folderId)
      : '';
    try {
      await googleSheetsService.logComprador(data, refId, driveFolderUrl);
    } catch (sheetsError) {
      console.warn('[Sheets] No se pudo registrar en Sheets:', sheetsError.message);
    }

    // Enviar email de confirmacion
    try {
      await emailService.sendConfirmation({
        to: data.email,
        nombre: data.nombre,
        tipo: 'Comprador',
        id: refId,
        fecha: new Date().toLocaleDateString('es-CO')
      });
    } catch (emailError) {
      console.warn('[Email] No se pudo enviar confirmacion:', emailError.message);
    }

    // Limpiar archivos temporales
    cleanupFiles(req.files);

    res.json({
      success: true,
      id: refId,
      message: 'Formulario de comprador recibido exitosamente',
      driveUploaded: !!driveResult
    });
  } catch (error) {
    cleanupFiles(req.files);
    next(error);
  }
}

/**
 * Procesar formulario de VENDEDOR
 */
async function processVendedor(req, res, next) {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const refId = generateRefId('VEND');

    if (!data.nombre || !data.cedula || !data.email) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: nombre, cedula, email'
      });
    }

    const requiredFiles = ['tradicion', 'bancaria', 'cedula', 'rut'];
    const missingFiles = requiredFiles.filter(
      name => !req.files || !req.files[name] || req.files[name].length === 0
    );

    if (missingFiles.length > 0) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: `Faltan documentos obligatorios: ${missingFiles.join(', ')}`
      });
    }

    // Nombre de carpeta: "Nombre Completo - VEND-20260226-001"
    const folderName = `${data.nombre.trim()} - ${refId}`;

    let driveResult = null;
    try {
      driveResult = await googleDriveService.uploadFormFiles(
        'Vendedores',
        folderName,
        data,
        req.files
      );
    } catch (driveError) {
      console.warn('[Drive] No se pudo subir a Google Drive:', driveError.message);
    }

    // Registrar en Google Sheets
    const driveFolderUrl = driveResult && driveResult.folderId
      ? getDriveFolderUrl(driveResult.folderId)
      : '';
    try {
      await googleSheetsService.logVendedor(data, refId, driveFolderUrl);
    } catch (sheetsError) {
      console.warn('[Sheets] No se pudo registrar en Sheets:', sheetsError.message);
    }

    try {
      await emailService.sendConfirmation({
        to: data.email,
        nombre: data.nombre,
        tipo: 'Vendedor',
        id: refId,
        fecha: new Date().toLocaleDateString('es-CO')
      });
    } catch (emailError) {
      console.warn('[Email] No se pudo enviar confirmacion:', emailError.message);
    }

    cleanupFiles(req.files);

    res.json({
      success: true,
      id: refId,
      message: 'Formulario de vendedor recibido exitosamente',
      driveUploaded: !!driveResult
    });
  } catch (error) {
    cleanupFiles(req.files);
    next(error);
  }
}

/**
 * Procesar formulario de ARRIENDO
 */
async function processArriendo(req, res, next) {
  try {
    const data = JSON.parse(req.body.data || '{}');
    const refId = generateRefId('ARR');

    if (!data.arrendadorNombre || !data.arrendatarioNombre) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Faltan nombres del arrendador y/o arrendatario'
      });
    }

    const requiredFiles = ['cedulaArrendador', 'cedulaArrendatario', 'tradicion'];
    const missingFiles = requiredFiles.filter(
      name => !req.files || !req.files[name] || req.files[name].length === 0
    );

    if (missingFiles.length > 0) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: `Faltan documentos obligatorios: ${missingFiles.join(', ')}`
      });
    }

    // Nombre de carpeta: "Arrendador - Arrendatario - ARR-20260226-001"
    const folderName = `${data.arrendadorNombre.trim()} - ${data.arrendatarioNombre.trim()} - ${refId}`;

    let driveResult = null;
    try {
      driveResult = await googleDriveService.uploadFormFiles(
        'Arriendos',
        folderName,
        data,
        req.files
      );
    } catch (driveError) {
      console.warn('[Drive] No se pudo subir a Google Drive:', driveError.message);
    }

    // Registrar en Google Sheets
    const driveFolderUrl = driveResult && driveResult.folderId
      ? getDriveFolderUrl(driveResult.folderId)
      : '';
    try {
      await googleSheetsService.logArriendo(data, refId, driveFolderUrl);
    } catch (sheetsError) {
      console.warn('[Sheets] No se pudo registrar en Sheets:', sheetsError.message);
    }

    // Enviar email a ambas partes
    const emails = [data.arrendadorEmail, data.arrendatarioEmail].filter(Boolean);
    for (const email of emails) {
      try {
        await emailService.sendConfirmation({
          to: email,
          nombre: email === data.arrendadorEmail
            ? data.arrendadorNombre
            : data.arrendatarioNombre,
          tipo: 'Arriendo',
          id: refId,
          fecha: new Date().toLocaleDateString('es-CO')
        });
      } catch (emailError) {
        console.warn('[Email] No se pudo enviar a', email, ':', emailError.message);
      }
    }

    cleanupFiles(req.files);

    res.json({
      success: true,
      id: refId,
      message: 'Formulario de arriendo recibido exitosamente',
      driveUploaded: !!driveResult
    });
  } catch (error) {
    cleanupFiles(req.files);
    next(error);
  }
}

// Middleware de multer para cada flujo
const uploadComprador = upload.fields([
  { name: 'cedula', maxCount: 1 }
]);

const uploadVendedor = upload.fields([
  { name: 'tradicion', maxCount: 1 },
  { name: 'bancaria', maxCount: 1 },
  { name: 'cedula', maxCount: 1 },
  { name: 'rut', maxCount: 1 },
  { name: 'parqueadero', maxCount: 1 },
  { name: 'deposito', maxCount: 1 }
]);

const uploadArriendo = upload.fields([
  { name: 'cedulaArrendador', maxCount: 1 },
  { name: 'cedulaArrendatario', maxCount: 1 },
  { name: 'tradicion', maxCount: 1 },
  { name: 'cedulaCodeudor', maxCount: 1 }
]);

module.exports = {
  processComprador,
  processVendedor,
  processArriendo,
  uploadComprador,
  uploadVendedor,
  uploadArriendo
};
