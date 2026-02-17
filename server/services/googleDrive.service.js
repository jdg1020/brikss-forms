/**
 * Servicio de Google Drive para BRIKSS Forms
 * Sube archivos y datos de formularios a Google Drive
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initialized = false;
  }

  /**
   * Inicializar cliente de Google Drive con credenciales OAuth2
   */
  init() {
    if (this.initialized) return;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.warn('[Drive] Credenciales de Google Drive no configuradas. Los archivos se guardaran solo localmente.');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
    this.initialized = true;
    console.log('[Drive] Servicio de Google Drive inicializado');
  }

  /**
   * Crear una carpeta en Google Drive
   */
  async createFolder(name, parentId) {
    if (!this.drive) return null;

    const response = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : []
      },
      fields: 'id, name'
    });

    return response.data;
  }

  /**
   * Buscar o crear carpeta por nombre dentro de un padre
   */
  async findOrCreateFolder(name, parentId) {
    if (!this.drive) return null;

    // Buscar si existe
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
    const list = await this.drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (list.data.files && list.data.files.length > 0) {
      return list.data.files[0];
    }

    return this.createFolder(name, parentId);
  }

  /**
   * Subir un archivo a Google Drive
   */
  async uploadFile(filePath, fileName, folderId, mimeType = 'application/pdf') {
    if (!this.drive) return null;

    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : []
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath)
      },
      fields: 'id, name, webViewLink'
    });

    return response.data;
  }

  /**
   * Subir datos JSON como archivo a Google Drive
   */
  async uploadJsonData(data, fileName, folderId) {
    if (!this.drive) return null;

    const { Readable } = require('stream');
    const jsonString = JSON.stringify(data, null, 2);
    const stream = Readable.from([jsonString]);

    const response = await this.drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/json',
        parents: folderId ? [folderId] : []
      },
      media: {
        mimeType: 'application/json',
        body: stream
      },
      fields: 'id, name'
    });

    return response.data;
  }

  /**
   * Subir todos los archivos de un formulario
   * Estructura: BRIKSS Forms / [tipo] / [carpeta_expediente] / archivos
   */
  async uploadFormFiles(tipoFolder, expedienteName, formData, files) {
    this.init();

    if (!this.drive) {
      console.warn('[Drive] Servicio no disponible, guardando localmente');
      return this.saveLocally(tipoFolder, expedienteName, formData, files);
    }

    const rootFolderId = process.env.DRIVE_FOLDER_ID;

    // Crear/buscar carpeta del tipo (Compradores, Vendedores, Arriendos)
    const tipoFolderObj = await this.findOrCreateFolder(tipoFolder, rootFolderId);
    if (!tipoFolderObj) throw new Error('No se pudo crear la carpeta del tipo');

    // Crear carpeta del expediente
    const expedienteFolder = await this.createFolder(expedienteName, tipoFolderObj.id);
    if (!expedienteFolder) throw new Error('No se pudo crear la carpeta del expediente');

    // Subir datos del formulario como JSON
    await this.uploadJsonData(formData, 'formulario.json', expedienteFolder.id);

    // Subir metadata
    const metadata = {
      fechaCreacion: new Date().toISOString(),
      tipo: tipoFolder,
      expediente: expedienteName,
      archivosSubidos: []
    };

    // Subir cada archivo PDF
    for (const [fieldName, fileArray] of Object.entries(files)) {
      const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
      if (file && file.path) {
        const uploadedFile = await this.uploadFile(
          file.path,
          `${fieldName}.pdf`,
          expedienteFolder.id
        );
        if (uploadedFile) {
          metadata.archivosSubidos.push({
            campo: fieldName,
            archivo: uploadedFile.name,
            driveId: uploadedFile.id,
            link: uploadedFile.webViewLink
          });
        }
      }
    }

    // Subir metadata
    await this.uploadJsonData(metadata, 'metadata.json', expedienteFolder.id);

    return { folderId: expedienteFolder.id, metadata };
  }

  /**
   * Guardar archivos localmente cuando Drive no esta disponible
   */
  saveLocally(tipoFolder, expedienteName, formData, files) {
    const localDir = path.join(__dirname, '..', '..', 'uploads', tipoFolder, expedienteName);
    fs.mkdirSync(localDir, { recursive: true });

    // Guardar datos del formulario
    fs.writeFileSync(
      path.join(localDir, 'formulario.json'),
      JSON.stringify(formData, null, 2)
    );

    // Copiar archivos
    const metadata = {
      fechaCreacion: new Date().toISOString(),
      tipo: tipoFolder,
      expediente: expedienteName,
      archivosSubidos: [],
      almacenamiento: 'local'
    };

    for (const [fieldName, fileArray] of Object.entries(files)) {
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

    console.log(`[Drive] Archivos guardados localmente en: ${localDir}`);
    return { localDir, metadata };
  }
}

module.exports = new GoogleDriveService();
