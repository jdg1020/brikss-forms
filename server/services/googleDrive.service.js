/**
 * Servicio de Google Drive para BRIKSS Forms.
 *
 * Autenticacion: Service Account (misma credencial que Sheets).
 * La carpeta de destino (GOOGLE_DRIVE_FOLDER_ID) debe estar compartida con el
 * email de la Service Account como Editor. Si esta en una unidad compartida
 * (Shared Drive), tambien funciona — usamos supportsAllDrives.
 *
 * Politica de fallos:
 *   - Sin credenciales y NODE_ENV !== production: modo simulacion (saveLocally).
 *   - Sin credenciales en produccion: throws (init falla loud).
 *   - Llamada a Drive falla en runtime: throws (el controller devuelve 503).
 *
 * No hay fallback silencioso a disco — uploads/ es efimero en Render free
 * y guardar ahi creando una falsa sensacion de exito provoca perdida de
 * documentos legales.
 */

const { google } = require('googleapis');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

const { sanitizeForDrive } = require('../config/formSchemas');
const { withRetry } = require('../utils/retry');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const DRIVE_COMMON = { supportsAllDrives: true };

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initialized = false;
    this.simulated = false;
  }

  init() {
    if (this.initialized) return;

    const isProd = process.env.NODE_ENV === 'production';

    const fallbackToSim = (msg) => {
      if (isProd) {
        const err = new Error(msg);
        err.code = 'DRIVE_NOT_CONFIGURED';
        throw err;
      }
      console.warn(`[Drive] ${msg} — modo simulación (saveLocally) en desarrollo`);
      this.simulated = true;
      this.initialized = true;
    };

    // Preferimos OAuth2 con refresh token si está configurado.
    // Razón: las Service Accounts NO tienen cuota propia y no pueden subir a
    // "Mi unidad" personal — solo a Shared Drives. OAuth permite que los
    // archivos los cree el usuario humano (consumiendo su quota personal).
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (clientId && clientSecret && refreshToken) {
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth2.setCredentials({ refresh_token: refreshToken });
      this.drive = google.drive({ version: 'v3', auth: oauth2 });
      this.initialized = true;
      console.log('[Drive] Servicio inicializado (OAuth2 refresh_token) — modo real, subiendo a Drive');
      return;
    }

    // Fallback: Service Account. Funciona para Shared Drives (Unidades
    // compartidas) pero NO para carpetas en "Mi unidad" personal.
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!keyFile && !keyJson) {
      return fallbackToSim('Sin credenciales OAuth ni Service Account');
    }

    if (!keyJson && keyFile) {
      try {
        const stat = fs.statSync(keyFile);
        if (!stat.isFile()) {
          return fallbackToSim(`GOOGLE_SERVICE_ACCOUNT_KEY_FILE no apunta a un archivo: ${keyFile}`);
        }
      } catch (err) {
        return fallbackToSim(`GOOGLE_SERVICE_ACCOUNT_KEY_FILE no existe: ${keyFile}`);
      }
    }

    const authOptions = { scopes: SCOPES };
    if (keyJson) {
      authOptions.credentials = JSON.parse(keyJson);
    } else {
      authOptions.keyFile = keyFile;
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    this.drive = google.drive({ version: 'v3', auth });
    this.initialized = true;
    console.log('[Drive] Servicio inicializado (Service Account) — modo real, subiendo a Drive (requiere Shared Drive)');
  }

  _escapeQuery(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  async createFolder(name, parentId) {
    const safeName = sanitizeForDrive(name);
    const response = await withRetry(() => this.drive.files.create({
      ...DRIVE_COMMON,
      requestBody: {
        name: safeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : []
      },
      fields: 'id, name'
    }), { label: 'drive.createFolder' });
    return response.data;
  }

  async findOrCreateFolder(name, parentId) {
    const safeName = sanitizeForDrive(name);
    const escapedName = this._escapeQuery(safeName);
    const escapedParent = parentId ? this._escapeQuery(parentId) : null;

    const queryParts = [
      `name='${escapedName}'`,
      `mimeType='application/vnd.google-apps.folder'`,
      'trashed=false'
    ];
    if (escapedParent) queryParts.push(`'${escapedParent}' in parents`);

    const list = await withRetry(() => this.drive.files.list({
      ...DRIVE_COMMON,
      includeItemsFromAllDrives: true,
      q: queryParts.join(' and '),
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 1
    }), { label: 'drive.findFolder' });

    if (list.data.files && list.data.files.length > 0) {
      return list.data.files[0];
    }
    return this.createFolder(safeName, parentId);
  }

  async uploadFile(filePath, fileName, folderId, mimeType = 'application/pdf') {
    const response = await withRetry(() => this.drive.files.create({
      ...DRIVE_COMMON,
      requestBody: {
        name: sanitizeForDrive(fileName),
        parents: folderId ? [folderId] : []
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath)
      },
      fields: 'id, name, webViewLink'
    }), { label: `drive.upload(${fileName})` });
    return response.data;
  }

  async uploadJsonData(data, fileName, folderId) {
    const jsonString = JSON.stringify(data, null, 2);
    const response = await withRetry(() => this.drive.files.create({
      ...DRIVE_COMMON,
      requestBody: {
        name: sanitizeForDrive(fileName),
        mimeType: 'application/json',
        parents: folderId ? [folderId] : []
      },
      media: {
        mimeType: 'application/json',
        body: Readable.from([jsonString])
      },
      fields: 'id, name'
    }), { label: `drive.uploadJson(${fileName})` });
    return response.data;
  }

  /**
   * Sube todos los archivos de un formulario a Drive.
   * Estructura: GOOGLE_DRIVE_FOLDER_ID / [tipo] / [expediente] / archivos
   *
   * En modo simulacion (sin credenciales en dev) delega a saveLocally.
   * Si cualquier subida real falla tras los reintentos, propaga el error —
   * el controller lo traduce a 503.
   */
  async uploadFormFiles(tipoFolder, expedienteName, formData, files) {
    this.init();

    if (this.simulated) {
      return this.saveLocally(tipoFolder, expedienteName, formData, files);
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const tipoFolderObj = await this.findOrCreateFolder(tipoFolder, rootFolderId);
    if (!tipoFolderObj) throw new Error(`No se pudo crear/encontrar la carpeta ${tipoFolder}`);

    const expedienteFolder = await this.createFolder(expedienteName, tipoFolderObj.id);
    if (!expedienteFolder) throw new Error('No se pudo crear la carpeta del expediente');

    const fileEntries = Object.entries(files || {})
      .map(([fieldName, fileArray]) => {
        const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
        return file && file.path ? { fieldName, file } : null;
      })
      .filter(Boolean);

    // Si CUALQUIER subida falla, lo propagamos. uploadFormFiles no debe
    // devolver "exito parcial" — el formulario se considera fallido.
    const uploadResults = await Promise.all(
      fileEntries.map(({ fieldName, file }) =>
        this.uploadFile(file.path, `${fieldName}.pdf`, expedienteFolder.id)
          .then(uploaded => ({ fieldName, uploaded }))
      )
    );

    const archivosSubidos = uploadResults.map(({ fieldName, uploaded }) => ({
      campo: fieldName,
      archivo: uploaded.name,
      driveId: uploaded.id,
      link: uploaded.webViewLink
    }));

    const metadata = {
      fechaCreacion: new Date().toISOString(),
      tipo: tipoFolder,
      expediente: expedienteName,
      archivosSubidos
    };

    await Promise.all([
      this.uploadJsonData(formData, 'formulario.json', expedienteFolder.id),
      this.uploadJsonData(metadata, 'metadata.json', expedienteFolder.id)
    ]);

    return { folderId: expedienteFolder.id, metadata };
  }

  /**
   * Solo se usa en desarrollo cuando no hay credenciales.
   * NO se invoca como fallback de errores — esos se propagan.
   */
  saveLocally(tipoFolder, expedienteName, formData, files) {
    const safeTipo = sanitizeForDrive(tipoFolder);
    const safeExp = sanitizeForDrive(expedienteName);
    const localDir = path.join(__dirname, '..', '..', 'uploads', safeTipo, safeExp);
    fs.mkdirSync(localDir, { recursive: true });

    fs.writeFileSync(
      path.join(localDir, 'formulario.json'),
      JSON.stringify(formData, null, 2)
    );

    const metadata = {
      fechaCreacion: new Date().toISOString(),
      tipo: tipoFolder,
      expediente: expedienteName,
      archivosSubidos: [],
      almacenamiento: 'local'
    };

    for (const [fieldName, fileArray] of Object.entries(files || {})) {
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
      if (file && file.path) {
        const destPath = path.join(localDir, `${fieldName}.pdf`);
        fs.copyFileSync(file.path, destPath);
        metadata.archivosSubidos.push({
          campo: fieldName,
          archivo: `${fieldName}.pdf`,
          rutaLocal: destPath
        });
      }
    }

    fs.writeFileSync(
      path.join(localDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`[Drive] (simulacion) Archivos guardados localmente en: ${localDir}`);
    return { folderId: null, metadata, simulated: true };
  }
}

module.exports = new GoogleDriveService();
