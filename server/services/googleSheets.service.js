/**
 * Servicio de Google Sheets para BRIKSS Forms.
 *
 * Dos pestañas independientes en el mismo spreadsheet (GOOGLE_SHEET_ID):
 *   - "Arrendamiento": filas de Arrendador y Arrendatario.
 *   - "Compraventa":   filas de Vendedor y Comprador.
 * La columna "Tipo" distingue el sub-rol dentro de cada pestaña.
 *
 * Init y headers se ejecutan al boot del servidor (ver server/index.js) para
 * evitar race condition cuando llegan formularios paralelos antes de que
 * existan los encabezados.
 */

const { google } = require('googleapis');
const { withRetry } = require('../utils/retry');

// ---------------------------------------------------------------------------
// Pestaña "Arrendamiento" (Arrendador + Arrendatario) — 28 columnas A..AB
// ---------------------------------------------------------------------------

const SHEET_TAB_ARRENDAMIENTO = 'Arrendamiento';
const SHEET_RANGE_ARRENDAMIENTO_APPEND = `${SHEET_TAB_ARRENDAMIENTO}!A:AB`;
const SHEET_RANGE_ARRENDAMIENTO_HEADER_READ = `${SHEET_TAB_ARRENDAMIENTO}!A1:AB1`;
const SHEET_RANGE_ARRENDAMIENTO_HEADER_WRITE = `${SHEET_TAB_ARRENDAMIENTO}!A1`;

const SHEET_HEADERS_ARRENDAMIENTO = [
  'Fecha',                       // A
  'Tipo',                        // B  Arrendador | Arrendatario
  'ID Referencia',               // C
  'Nombre Completo',             // D
  'Cédula',                      // E
  'Teléfono',                    // F
  'Email',                       // G
  'Dirección Residencia',        // H
  'Estado Civil',                // I
  'Carpeta Drive',               // J
  'Documentos Subidos',          // K
  'Dirección del Inmueble',      // L  (solo Arrendador)
  'Matrícula Inmobiliaria',      // M  (solo Arrendador)
  'Tipo de Inmueble',            // N  (solo Arrendador)
  'Garaje',                      // O  (solo Arrendador)
  'Depósito (Inmueble)',         // P  (solo Arrendador)
  'Canon Mensual',               // Q  (solo Arrendador)
  'Día de Pago',                 // R  (solo Arrendador)
  'Forma de Pago',               // S  (solo Arrendador)
  'Servicios Incluidos',         // T  (solo Arrendador)
  'Administración',              // U  (solo Arrendador)
  'Depósito de Garantía',        // V  (solo Arrendador)
  'Contrato',                    // W  (solo Arrendador)
  'Restricciones',               // X  (solo Arrendador)
  'Observaciones',               // Y  (solo Arrendador)
  'Codeudor',                    // Z  (solo Arrendatario)
  'Nombre del Broker',           // AA
  'Código del Inmueble'          // AB
];

// ---------------------------------------------------------------------------
// Pestaña "Compraventa" (Vendedor + Comprador) — 21 columnas A..U
// ---------------------------------------------------------------------------

const SHEET_TAB_COMPRAVENTA = 'Compraventa';
const SHEET_RANGE_COMPRAVENTA_APPEND = `${SHEET_TAB_COMPRAVENTA}!A:U`;
const SHEET_RANGE_COMPRAVENTA_HEADER_READ = `${SHEET_TAB_COMPRAVENTA}!A1:U1`;
const SHEET_RANGE_COMPRAVENTA_HEADER_WRITE = `${SHEET_TAB_COMPRAVENTA}!A1`;

const SHEET_HEADERS_COMPRAVENTA = [
  'Fecha',                       // A
  'Tipo',                        // B  Vendedor | Comprador
  'ID Referencia',               // C
  'Nombre Completo',             // D
  'Cédula',                      // E
  'Celular',                     // F
  'Email',                       // G
  'Dirección Residencia',        // H  (solo Comprador)
  'Ciudad Residencia',           // I  (solo Comprador)
  'Estado Civil',                // J
  'Carpeta Drive',               // K
  'Documentos Subidos',          // L
  'Género',                      // M  (solo Comprador)
  'Forma de Pago',               // N  (solo Comprador)
  'Pagos Programados',           // O  (solo Comprador)
  'Edificio/Conjunto',           // P  (solo Vendedor)
  'Dirección Inmueble',          // Q  (solo Vendedor)
  'Estado Inmueble',             // R  (solo Vendedor)
  'Parqueadero / Depósito',      // S  (solo Vendedor)
  'Nombre del Broker',           // T
  'Código del Inmueble'          // U
];

// ---------------------------------------------------------------------------
// Helpers de filas vacías
// ---------------------------------------------------------------------------

function emptyRowArrendamiento() {
  return Array(SHEET_HEADERS_ARRENDAMIENTO.length).fill('');
}

function emptyRowCompraventa() {
  return Array(SHEET_HEADERS_COMPRAVENTA.length).fill('');
}

// ---------------------------------------------------------------------------
// Helpers de formato (concatenan campos del formulario en strings legibles)
// ---------------------------------------------------------------------------

function fmtBoolean(value, { yes = 'Sí', no = 'No', detail = '' } = {}) {
  if (!value) return no;
  return detail ? `${yes} (${detail})` : yes;
}

function joinRestricciones(data) {
  const parts = [];
  if (data.noMascotas) parts.push('No mascotas');
  if (data.noModificaciones) parts.push('No modificaciones');
  if (data.noSubarriendo) parts.push('No subarriendo');
  return parts.join('; ');
}

function joinServiciosIncluidos(data) {
  const parts = [];
  if (data.serviciosIncluidosAgua) parts.push('Agua');
  if (data.serviciosIncluidosLuz) parts.push('Luz');
  if (data.serviciosIncluidosGas) parts.push('Gas');
  return parts.length ? parts.join(', ') : 'Ninguno';
}

function joinAdmin(data) {
  const modo = data.administracionIncluida || '';
  if (modo === 'Pago administración directamente al edificio' && data.valorAdministracion) {
    return `${modo} ($${data.valorAdministracion})`;
  }
  return modo;
}

function joinContrato(data) {
  const inicio = data.fechaInicio || '';
  const duracion = data.duracion ? `${data.duracion} meses` : '';
  const renov = `renovación auto: ${data.renovacionAuto ? 'Sí' : 'No'}`;
  return [inicio, duracion, renov].filter(Boolean).join(', ');
}

function joinDireccionInmuebleVend(data) {
  const parts = [data.direccion, data.numeroInmueble && `Apto/Casa ${data.numeroInmueble}`, data.ciudad];
  return parts.filter(Boolean).join(', ');
}

function joinParqDepo(data) {
  const parq = fmtBoolean(data.tieneParqueadero, { detail: data.numParqueadero });
  const depo = fmtBoolean(data.tieneDeposito, { detail: data.numDeposito });
  return `Parq: ${parq}; Dep: ${depo}`;
}

function joinPagos(pagos) {
  if (!Array.isArray(pagos) || pagos.length === 0) return '';
  return pagos
    .map(p => `${p.fecha || ''}: $${p.monto || ''}`)
    .join('; ');
}

function joinCodeudor(data) {
  if (!data.tieneCodeudor) return 'No';
  const nombre = data.codeudorNombre || '';
  const cedula = data.codeudorCedula ? `CC ${data.codeudorCedula}` : '';
  const tel = data.codeudorTelefono ? `tel ${data.codeudorTelefono}` : '';
  const email = data.codeudorEmail ? `email ${data.codeudorEmail}` : '';
  const dir = data.codeudorDireccion ? `dir ${data.codeudorDireccion}` : '';
  const head = [nombre, cedula].filter(Boolean).join(' ');
  const tail = [tel, email, dir].filter(Boolean).join(' - ');
  return `Sí: ${[head, tail].filter(Boolean).join(' - ')}`.trim();
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.initialized = false;
    // Cada entrada: `${spreadsheetId}::${tabName}` → headers ya verificados.
    this.headersChecked = new Set();
    // Cache de spreadsheetIds cuya estructura de tabs ya inspeccionamos.
    this.tabsChecked = new Map();
  }

  init() {
    if (this.initialized) return;

    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!keyFile && !keyJson) {
      console.warn('[Sheets] Service Account no configurado. Los datos no se registraran en Sheets.');
      return;
    }

    try {
      const authOptions = { scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
      if (keyJson) authOptions.credentials = JSON.parse(keyJson);
      else authOptions.keyFile = keyFile;

      const auth = new google.auth.GoogleAuth(authOptions);
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      console.log('[Sheets] Servicio inicializado (Service Account)');
    } catch (err) {
      console.error('[Sheets] Error al inicializar:', err.message);
    }
  }

  /**
   * Garantiza que la pestaña existe; si no, la crea con `batchUpdate addSheet`.
   * Idempotente: cachea el listado de tabs por spreadsheet.
   */
  async ensureSheetTab(spreadsheetId, tabName) {
    let tabs = this.tabsChecked.get(spreadsheetId);
    if (!tabs) {
      const meta = await withRetry(() => this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(title,sheetId)'
      }), { label: 'sheets.getMeta' });
      tabs = new Set((meta.data.sheets || []).map(s => s.properties.title));
      this.tabsChecked.set(spreadsheetId, tabs);
    }
    if (tabs.has(tabName)) return;

    await withRetry(() => this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }]
      }
    }), { label: `sheets.addSheet(${tabName})` });
    tabs.add(tabName);
    console.log(`[Sheets] Pestaña creada: ${tabName}`);
  }

  /**
   * Si la fila 1 de la pestaña está vacía, escribe los headers. Idempotente.
   */
  async ensureTabHeaders(spreadsheetId, tabName, headers, headerReadRange, headerWriteRange) {
    const cacheKey = `${spreadsheetId}::${tabName}`;
    if (this.headersChecked.has(cacheKey)) return;

    const response = await withRetry(() => this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerReadRange
    }), { label: `sheets.getHeaders(${tabName})` });

    const existing = response.data.values;
    if (!existing || existing.length === 0 || existing[0].length === 0) {
      await withRetry(() => this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: headerWriteRange,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] }
      }), { label: `sheets.writeHeaders(${tabName})` });
      console.log(`[Sheets] Encabezados escritos en ${tabName}`);
    }
    this.headersChecked.add(cacheKey);
  }

  /**
   * Llamar al boot. Verifica/crea ambas pestañas y escribe headers si faltan.
   * Si la spreadsheet no esta configurada o no es accesible, loguea pero no
   * bloquea el arranque del servidor.
   */
  async ensureHeadersAtBoot() {
    this.init();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!this.sheets || !spreadsheetId) return;
    try {
      await this.ensureSheetTab(spreadsheetId, SHEET_TAB_ARRENDAMIENTO);
      await this.ensureTabHeaders(
        spreadsheetId,
        SHEET_TAB_ARRENDAMIENTO,
        SHEET_HEADERS_ARRENDAMIENTO,
        SHEET_RANGE_ARRENDAMIENTO_HEADER_READ,
        SHEET_RANGE_ARRENDAMIENTO_HEADER_WRITE
      );
      await this.ensureSheetTab(spreadsheetId, SHEET_TAB_COMPRAVENTA);
      await this.ensureTabHeaders(
        spreadsheetId,
        SHEET_TAB_COMPRAVENTA,
        SHEET_HEADERS_COMPRAVENTA,
        SHEET_RANGE_COMPRAVENTA_HEADER_READ,
        SHEET_RANGE_COMPRAVENTA_HEADER_WRITE
      );
    } catch (err) {
      console.warn('[Sheets] No se pudo inicializar headers al boot:', err.message);
    }
  }

  // Indices 0-based para la pestaña Arrendamiento.
  static COL_ARR = Object.freeze({
    FECHA: 0, TIPO: 1, REF_ID: 2, NOMBRE: 3, CEDULA: 4, TELEFONO: 5, EMAIL: 6,
    DIRECCION_RES: 7, ESTADO_CIVIL: 8, CARPETA: 9, DOCUMENTOS: 10,
    INMUEBLE_DIRECCION: 11, MATRICULA: 12, TIPO_INMUEBLE: 13,
    GARAJE: 14, DEPOSITO_INMUEBLE: 15,
    CANON: 16, DIA_PAGO: 17, FORMA_PAGO: 18,
    SERVICIOS: 19, ADMIN: 20, DEPOSITO_GARANTIA: 21, CONTRATO: 22,
    RESTRICCIONES: 23, OBSERVACIONES: 24, CODEUDOR: 25,
    BROKER: 26, CODIGO_INMUEBLE: 27
  });

  // Indices 0-based para la pestaña Compraventa.
  static COL_CV = Object.freeze({
    FECHA: 0, TIPO: 1, REF_ID: 2, NOMBRE: 3, CEDULA: 4, CELULAR: 5, EMAIL: 6,
    DIRECCION_RES: 7, CIUDAD_RES: 8, ESTADO_CIVIL: 9, CARPETA: 10, DOCUMENTOS: 11,
    GENERO: 12, FORMA_PAGO: 13, PAGOS: 14,
    EDIFICIO: 15, INMUEBLE_DIRECCION: 16, ESTADO_INMUEBLE: 17, PARQ_DEPO: 18,
    BROKER: 19, CODIGO_INMUEBLE: 20
  });

  // -------------------------------------------------------------------------
  // Hoja Compraventa
  // -------------------------------------------------------------------------

  async logComprador(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] (simulacion) Comprador: ${refId}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureSheetTab(spreadsheetId, SHEET_TAB_COMPRAVENTA);
    await this.ensureTabHeaders(
      spreadsheetId,
      SHEET_TAB_COMPRAVENTA,
      SHEET_HEADERS_COMPRAVENTA,
      SHEET_RANGE_COMPRAVENTA_HEADER_READ,
      SHEET_RANGE_COMPRAVENTA_HEADER_WRITE
    );

    const C = GoogleSheetsService.COL_CV;
    const row = emptyRowCompraventa();
    row[C.FECHA] = new Date().toLocaleString('es-CO');
    row[C.TIPO] = 'Comprador';
    row[C.REF_ID] = refId;
    row[C.NOMBRE] = data.nombre || '';
    row[C.CEDULA] = data.cedula || '';
    row[C.CELULAR] = data.celular || '';
    row[C.EMAIL] = data.email || '';
    row[C.DIRECCION_RES] = data.direccion || '';
    row[C.CIUDAD_RES] = data.ciudad || '';
    row[C.ESTADO_CIVIL] = data.estadoCivil || '';
    row[C.CARPETA] = driveFolderUrl || '';
    row[C.DOCUMENTOS] = 'cedula.pdf';
    row[C.GENERO] = data.genero || '';
    row[C.FORMA_PAGO] = data.formaPago || '';
    row[C.PAGOS] = joinPagos(data.pagos);
    row[C.BROKER] = data.nombreBroker || '';
    row[C.CODIGO_INMUEBLE] = data.codigoInmueble || '';

    return this._appendRow(spreadsheetId, row, refId, SHEET_RANGE_COMPRAVENTA_APPEND);
  }

  async logVendedor(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] (simulacion) Vendedor: ${refId}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureSheetTab(spreadsheetId, SHEET_TAB_COMPRAVENTA);
    await this.ensureTabHeaders(
      spreadsheetId,
      SHEET_TAB_COMPRAVENTA,
      SHEET_HEADERS_COMPRAVENTA,
      SHEET_RANGE_COMPRAVENTA_HEADER_READ,
      SHEET_RANGE_COMPRAVENTA_HEADER_WRITE
    );

    const C = GoogleSheetsService.COL_CV;
    const docs = ['cedula.pdf', 'tradicion.pdf', 'bancaria.pdf', 'rut.pdf'];
    if (data.tieneParqueadero) docs.push('parqueadero.pdf');
    if (data.tieneDeposito) docs.push('deposito.pdf');

    const row = emptyRowCompraventa();
    row[C.FECHA] = new Date().toLocaleString('es-CO');
    row[C.TIPO] = 'Vendedor';
    row[C.REF_ID] = refId;
    row[C.NOMBRE] = data.nombre || '';
    row[C.CEDULA] = data.cedula || '';
    row[C.CELULAR] = data.celular || '';
    row[C.EMAIL] = data.email || '';
    row[C.ESTADO_CIVIL] = data.estadoCivil || '';
    row[C.CARPETA] = driveFolderUrl || '';
    row[C.DOCUMENTOS] = docs.join(', ');
    row[C.EDIFICIO] = data.edificio || '';
    row[C.INMUEBLE_DIRECCION] = joinDireccionInmuebleVend(data);
    row[C.ESTADO_INMUEBLE] = data.estadoInmueble || '';
    row[C.PARQ_DEPO] = joinParqDepo(data);
    row[C.BROKER] = data.nombreBroker || '';
    row[C.CODIGO_INMUEBLE] = data.codigoInmueble || '';

    return this._appendRow(spreadsheetId, row, refId, SHEET_RANGE_COMPRAVENTA_APPEND);
  }

  // -------------------------------------------------------------------------
  // Hoja Arrendamiento
  // -------------------------------------------------------------------------

  async logArrendador(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] (simulacion) Arrendador: ${refId}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureSheetTab(spreadsheetId, SHEET_TAB_ARRENDAMIENTO);
    await this.ensureTabHeaders(
      spreadsheetId,
      SHEET_TAB_ARRENDAMIENTO,
      SHEET_HEADERS_ARRENDAMIENTO,
      SHEET_RANGE_ARRENDAMIENTO_HEADER_READ,
      SHEET_RANGE_ARRENDAMIENTO_HEADER_WRITE
    );

    const C = GoogleSheetsService.COL_ARR;
    const docs = ['cedula.pdf', 'tradicion.pdf', 'certificacionBancaria.pdf'];

    const row = emptyRowArrendamiento();
    row[C.FECHA] = new Date().toLocaleString('es-CO');
    row[C.TIPO] = 'Arrendador';
    row[C.REF_ID] = refId;
    row[C.NOMBRE] = data.nombre || '';
    row[C.CEDULA] = data.cedula || '';
    row[C.TELEFONO] = data.telefono || '';
    row[C.EMAIL] = data.email || '';
    row[C.DIRECCION_RES] = data.direccion || '';
    row[C.ESTADO_CIVIL] = data.estadoCivil || '';
    row[C.CARPETA] = driveFolderUrl || '';
    row[C.DOCUMENTOS] = docs.join(', ');
    row[C.INMUEBLE_DIRECCION] = data.inmuebleDireccion || '';
    row[C.MATRICULA] = data.matricula || '';
    row[C.TIPO_INMUEBLE] = data.tipoInmueble || '';
    row[C.GARAJE] = fmtBoolean(data.tieneGaraje, { detail: data.numGaraje });
    row[C.DEPOSITO_INMUEBLE] = fmtBoolean(data.tieneDeposito, { detail: data.numDeposito });
    row[C.CANON] = data.canon || '';
    row[C.DIA_PAGO] = data.diaPago || '';
    row[C.FORMA_PAGO] = data.formaPagoArriendo || '';
    row[C.SERVICIOS] = joinServiciosIncluidos(data);
    row[C.ADMIN] = joinAdmin(data);
    row[C.DEPOSITO_GARANTIA] = data.deposito || '';
    row[C.CONTRATO] = joinContrato(data);
    row[C.RESTRICCIONES] = joinRestricciones(data);
    row[C.OBSERVACIONES] = data.observaciones || '';
    row[C.BROKER] = data.nombreBroker || '';
    row[C.CODIGO_INMUEBLE] = data.codigoInmueble || '';

    return this._appendRow(spreadsheetId, row, refId, SHEET_RANGE_ARRENDAMIENTO_APPEND);
  }

  async logArrendatario(data, refId, driveFolderUrl) {
    this.init();
    if (!this.sheets) {
      console.log(`[Sheets] (simulacion) Arrendatario: ${refId}`);
      return { simulated: true };
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[Sheets] GOOGLE_SHEET_ID no configurado');
      return null;
    }

    await this.ensureSheetTab(spreadsheetId, SHEET_TAB_ARRENDAMIENTO);
    await this.ensureTabHeaders(
      spreadsheetId,
      SHEET_TAB_ARRENDAMIENTO,
      SHEET_HEADERS_ARRENDAMIENTO,
      SHEET_RANGE_ARRENDAMIENTO_HEADER_READ,
      SHEET_RANGE_ARRENDAMIENTO_HEADER_WRITE
    );

    const C = GoogleSheetsService.COL_ARR;
    const docs = ['cedula.pdf'];
    if (data.tieneCodeudor) docs.push('cedulaCodeudor.pdf');

    const row = emptyRowArrendamiento();
    row[C.FECHA] = new Date().toLocaleString('es-CO');
    row[C.TIPO] = 'Arrendatario';
    row[C.REF_ID] = refId;
    row[C.NOMBRE] = data.nombre || '';
    row[C.CEDULA] = data.cedula || '';
    row[C.TELEFONO] = data.telefono || '';
    row[C.EMAIL] = data.email || '';
    row[C.DIRECCION_RES] = data.direccion || '';
    row[C.ESTADO_CIVIL] = data.estadoCivil || '';
    row[C.CARPETA] = driveFolderUrl || '';
    row[C.DOCUMENTOS] = docs.join(', ');
    row[C.CODEUDOR] = joinCodeudor(data);
    row[C.BROKER] = data.nombreBroker || '';
    row[C.CODIGO_INMUEBLE] = data.codigoInmueble || '';

    return this._appendRow(spreadsheetId, row, refId, SHEET_RANGE_ARRENDAMIENTO_APPEND);
  }

  async _appendRow(spreadsheetId, row, refId, range) {
    const response = await withRetry(() => this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    }), { label: `sheets.append(${refId})` });

    console.log(`[Sheets] Fila agregada en ${range}: ${refId}`);
    return response.data;
  }
}

module.exports = new GoogleSheetsService();
