/**
 * Controlador unificado de carga de archivos y procesamiento de formularios.
 * Procesa los 3 flujos (comprador, vendedor, arriendo) con un solo pipeline parametrizado.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { customAlphabet } = require('nanoid');

const googleDriveService = require('../services/googleDrive.service');
const googleSheetsService = require('../services/googleSheets.service');
const emailService = require('../services/email.service');
const { schemas, validate, sanitizeForDrive } = require('../config/formSchemas');
const { assertPdf } = require('../utils/pdfValidator');

const REF_ID_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateSeq = customAlphabet(REF_ID_ALPHABET, 6);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeOriginal = path.basename(file.originalname).replace(/[^\w.\-]/g, '_').slice(0, 60);
    const uniqueName = `${Date.now()}-${generateSeq()}-${safeOriginal}`;
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
  limits: { fileSize: 10 * 1024 * 1024, files: 8 }
});

function generateRefId(prefix) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `${prefix}-${date}-${generateSeq()}`;
}

function getDriveFolderUrl(folderId) {
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';
}

function cleanupFiles(files) {
  if (!files) return;
  const fileList = Array.isArray(files) ? files : Object.values(files).flat();
  fileList.forEach(file => {
    if (file && file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
    }
  });
}

/**
 * Pipeline generico para procesar un formulario.
 * @param {string} schemaName - nombre del schema (comprador, vendedor, arriendo)
 */
function buildProcessor(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Schema desconocido: ${schemaName}`);

  return async function process(req, res, next) {
    try {
      let data;
      try {
        // Reviver descarta __proto__/constructor/prototype: defensa anti
        // prototype-pollution antes de pasar el objeto a validate() y a
        // los services de Drive/Sheets (que iteran sobre claves).
        data = JSON.parse(req.body.data || '{}', (key, value) => {
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
          return value;
        });
      } catch (parseErr) {
        cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Payload inválido (JSON malformado)'
        });
      }

      const { valid, errors } = validate(data, schemaName);
      if (!valid) {
        cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: 'Datos inválidos',
          errors
        });
      }

      const missingFiles = schema.files.required.filter(
        name => !req.files || !req.files[name] || req.files[name].length === 0
      );
      if (missingFiles.length > 0) {
        cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: `Faltan documentos obligatorios: ${missingFiles.join(', ')}`
        });
      }

      try {
        for (const fileArray of Object.values(req.files || {})) {
          for (const file of fileArray) {
            assertPdf(file.path, file.fieldname);
          }
        }
      } catch (pdfErr) {
        cleanupFiles(req.files);
        return res.status(400).json({
          success: false,
          message: pdfErr.message || 'Archivo PDF inválido'
        });
      }

      const refId = generateRefId(schema.prefix);
      const folderName = sanitizeForDrive(schema.folderName(data, refId));

      // Drive es bloqueante: si falla, devolvemos 503 y NO ejecutamos Sheets ni
      // Email. La lectura comercial es: si los documentos no quedaron guardados,
      // el formulario NO se proceso — el usuario debe reintentar.
      let driveResult;
      try {
        driveResult = await googleDriveService.uploadFormFiles(
          schema.tipoFolder,
          folderName,
          data,
          req.files
        );
      } catch (driveError) {
        console.error(`[Drive] Fallo subida (${schemaName}) ${refId}:`, driveError.message);
        cleanupFiles(req.files);
        return res.status(503).json({
          success: false,
          code: 'DRIVE_UNAVAILABLE',
          message: 'No pudimos guardar tus documentos en este momento. Por favor vuelve a cargarlos e intenta nuevamente en unos minutos.'
        });
      }

      const driveFolderUrl = driveResult && driveResult.folderId
        ? getDriveFolderUrl(driveResult.folderId)
        : '';

      // Sheets y Email son best-effort: el documento ya esta en Drive, no
      // queremos forzar al usuario a re-subirlo si solo fallo el registro.
      try {
        const logger = googleSheetsService[`log${capitalize(schemaName)}`];
        if (logger) await logger.call(googleSheetsService, data, refId, driveFolderUrl);
      } catch (sheetsError) {
        console.warn(`[Sheets] Fallo registro (${schemaName}) ${refId}:`, sheetsError.message);
      }

      const recipients = collectEmails(data, schemaName);
      for (const recipient of recipients) {
        try {
          await emailService.sendConfirmation({
            to: recipient.email,
            nombre: recipient.nombre,
            tipo: schema.sheetType,
            id: refId,
            fecha: new Date().toLocaleDateString('es-CO')
          });
        } catch (emailError) {
          console.warn(`[Email] Fallo envio (${refId}):`, emailError.message);
        }
      }

      res.json({
        success: true,
        id: refId,
        message: `Formulario de ${schema.sheetType.toLowerCase()} recibido exitosamente`,
        driveUploaded: !!(driveResult && driveResult.folderId),
        driveFolderUrl
      });
    } catch (error) {
      next(error);
    } finally {
      cleanupFiles(req.files);
    }
  };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function collectEmails(data, _schemaName) {
  // Notificación interna: cada submisión envía el correo al equipo Brikss,
  // no al cliente que llenó el formulario. Configurable vía env var; default
  // a negocios.brikss@gmail.com.
  const internalRecipient = process.env.INTERNAL_NOTIFICATION_EMAIL || 'negocios.brikss@gmail.com';
  return [{ email: internalRecipient, nombre: data.nombre || 'Cliente' }];
}

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

const uploadArrendador = upload.fields([
  { name: 'cedula', maxCount: 1 },
  { name: 'tradicion', maxCount: 1 },
  { name: 'certificacionBancaria', maxCount: 1 }
]);

const uploadArrendatario = upload.fields([
  { name: 'cedula', maxCount: 1 },
  { name: 'cedulaCodeudor', maxCount: 1 }
]);

module.exports = {
  processComprador: buildProcessor('comprador'),
  processVendedor: buildProcessor('vendedor'),
  processArrendador: buildProcessor('arrendador'),
  processArrendatario: buildProcessor('arrendatario'),
  uploadComprador,
  uploadVendedor,
  uploadArrendador,
  uploadArrendatario
};
