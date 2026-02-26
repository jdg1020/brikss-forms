/**
 * Servicio de Google Sheets para BRIKSS Forms
 * Registra todos los formularios en un solo Google Sheet centralizado
 */

const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.initialized = false;
  }

  /**
   * Inicializar cliente de Google Sheets con Service Account
   * Soporta: archivo JSON local (GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
   *          o JSON inline como env var (GOOGLE_SERVICE_ACCOUNT_KEY)
   */
  init() {
    if (this.initialized) return;

    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!keyFile && !keyJson) {
      console.warn('[Sheets] Service Account no configurado. Los datos no se registraran en Sheets.');
      return;
    }

    try {
      const authOptions = {
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      };

      if (keyJson) {
        // Produccion: credenciales como variable de entorno (JSON string)
        authOptions.credentials = JSON.parse(keyJson);
      } else {
        // Local: archivo JSON
        authOptions.keyFile = keyFile;
      }

      const auth = new google.auth.GoogleAuth(authOptions);
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      console.log('[Sheets] Servicio de Google Sheets inicializado (Service Account)');
    } catch (err) {
      console.error('[Sheets] Error al inicializar con Service Account:', err.message);
    }
  }

  /**
   * Verificar si el sheet tiene encabezados, si no, crearlos
   */
  async ensureHeaders(spreadsheetId) {
    if (!this.sheets) return;

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:Z1'
    });

    const headers = response.data.values;
    if (!headers || headers.length === 0 || headers[0].length === 0) {
      // Crear encabezados
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'Fecha',
            'Tipo',
            'ID Referencia',
            'Nombre Completo',
            'Cedula',
            'Celular',
            'Email',
            'Direccion Inmueble',
            'Ciudad',
            'Estado Civil',
            'Genero',
            'Edificio/Conjunto',
            'Numero Inmueble',
            'Estado Inmueble',
            'Forma de Pago',
            'Fecha de Pago',
            'Monto',
            'Arrendador Nombre',
            'Arrendador Cedula',
            'Arrendador Email',
            'Arrendatario Nombre',
            'Arrendatario Cedula',
            'Arrendatario Email',
            'Canon Mensual',
            'Duracion (meses)',
            'Carpeta Drive',
            'Documentos Subidos'
          ]]
        }
      });
      console.log('[Sheets] Encabezados creados en el spreadsheet');
    }
  }

  /**
   * Registrar formulario de COMPRADOR en el Sheet
   */
  async logComprador(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] Simulacion - Comprador: ${refId} | ${data.nombre}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureHeaders(spreadsheetId);

    const pagos = data.pagos || [];
    const fechasPago = pagos.map(p => p.fecha).join('; ');
    const montosPago = pagos.map(p => p.monto).join('; ');

    const row = [
      new Date().toLocaleString('es-CO'),
      'Comprador',
      refId,
      data.nombre || '',
      data.cedula || '',
      data.celular || '',
      data.email || '',
      data.direccion || '',
      data.ciudad || '',
      data.estadoCivil || '',
      data.genero || '',
      '', // edificio
      '', // numero inmueble
      '', // estado inmueble
      data.formaPago || '',
      fechasPago,
      montosPago,
      '', // arrendador nombre
      '', // arrendador cedula
      '', // arrendador email
      '', // arrendatario nombre
      '', // arrendatario cedula
      '', // arrendatario email
      '', // canon
      '', // duracion
      driveFolderUrl || '',
      'cedula.pdf'
    ];

    return this._appendRow(spreadsheetId, row);
  }

  /**
   * Registrar formulario de VENDEDOR en el Sheet
   */
  async logVendedor(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] Simulacion - Vendedor: ${refId} | ${data.nombre}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureHeaders(spreadsheetId);

    const docs = ['tradicion', 'bancaria', 'cedula', 'rut'];
    if (data.tieneParqueadero) docs.push('parqueadero');
    if (data.tieneDeposito) docs.push('deposito');

    const row = [
      new Date().toLocaleString('es-CO'),
      'Vendedor',
      refId,
      data.nombre || '',
      data.cedula || '',
      data.celular || '',
      data.email || '',
      data.direccion || '',
      data.ciudad || '',
      data.estadoCivil || '',
      '', // genero
      data.edificio || '',
      data.numeroInmueble || '',
      data.estadoInmueble || '',
      '', // forma de pago
      '', // fecha pago
      '', // monto
      '', // arrendador nombre
      '', // arrendador cedula
      '', // arrendador email
      '', // arrendatario nombre
      '', // arrendatario cedula
      '', // arrendatario email
      '', // canon
      '', // duracion
      driveFolderUrl || '',
      docs.join(', ')
    ];

    return this._appendRow(spreadsheetId, row);
  }

  /**
   * Registrar formulario de ARRIENDO en el Sheet
   */
  async logArriendo(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] Simulacion - Arriendo: ${refId} | ${data.arrendadorNombre} / ${data.arrendatarioNombre}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureHeaders(spreadsheetId);

    const docs = ['cedulaArrendador', 'cedulaArrendatario', 'tradicion'];
    if (data.tieneCodeudor) docs.push('cedulaCodeudor');

    const row = [
      new Date().toLocaleString('es-CO'),
      'Arriendo',
      refId,
      `${data.arrendadorNombre || ''} / ${data.arrendatarioNombre || ''}`,
      '', // cedula individual
      '', // celular
      '', // email
      data.inmuebleDireccion || '',
      '', // ciudad
      '', // estado civil
      '', // genero
      '', // edificio
      '', // numero inmueble
      '', // estado inmueble
      data.formaPagoArriendo || '',
      '', // fecha pago
      '', // monto
      data.arrendadorNombre || '',
      data.arrendadorCedula || '',
      data.arrendadorEmail || '',
      data.arrendatarioNombre || '',
      data.arrendatarioCedula || '',
      data.arrendatarioEmail || '',
      data.canon || '',
      data.duracion || '',
      driveFolderUrl || '',
      docs.join(', ')
    ];

    return this._appendRow(spreadsheetId, row);
  }

  /**
   * Agregar una fila al final del spreadsheet
   */
  async _appendRow(spreadsheetId, row) {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A:Z',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    console.log(`[Sheets] Fila agregada: ${row[1]} - ${row[3]}`);
    return response.data;
  }
}

module.exports = new GoogleSheetsService();
