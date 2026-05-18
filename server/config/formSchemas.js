/**
 * Schemas de validacion para los flujos de formulario.
 * Define campos requeridos, opcionales, archivos requeridos y plantilla de carpeta.
 */

const PHONE = /^(\+?57)?\s?\d{10}$/;
const CEDULA = /^\d{6,10}$/;
// Email mas estricto: caracteres locales restringidos, dominio con TLD
// alfabetico de >=2 chars. Suficiente para rechazar 'a@b.c' o '@x.y'.
const EMAIL = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
// Texto general: letras (incluye tildes vía \p{L}), números, espacios,
// puntuación común inmobiliaria. Permite paréntesis y & para nombres de
// edificios y direcciones legítimas tipo "Cra 15 #98-42 (of 505) & Anexo".
const SAFE_TEXT = /^[\p{L}\p{N}\s.,#\-/&()áéíóúñÁÉÍÓÚÑ]+$/u;
// Montos en COP: enteros sin separadores (el cliente normaliza con readMoney).
const MONEY_INT = /^\d{1,12}$/;

const ESTADO_CIVIL = /^(Soltero\/a|Casado\/a|Viudo\/a|Union Libre)$/;
const TIPO_INMUEBLE = /^(Casa|Apartamento|Local|Oficina|Bodega)$/;
const FORMA_PAGO_ARRIENDO = /^(Consignacion|Transferencia|Efectivo)$/;
const ADMIN_MODO = /^(Administración paga al arrendador|Pago administración directamente al edificio)$/;

// Enums servidos por los <select> del frontend. Si el frontend cambia, este
// listado tiene que cambiar también — la validación es server-side.
const FORMA_PAGO_COMPRA = /^(Compra de Contado|Compra con leasing nuevo banco|Compra con leasing cesión banco vigente|Compra con crédito hipotecario)$/;
const ESTADO_INMUEBLE_VENTA = /^(Libre de deuda|Deuda hipotecaria|Leasing)$/;

/**
 * Schema base. Cada flujo declara:
 * - prefix: prefijo del refId (COMP, VEND, ARRD, ARRT)
 * - tipoFolder: subcarpeta en Drive (Compradores, Vendedores, Arrendadores, Arrendatarios)
 * - sheetType: etiqueta para Sheets
 * - required: campos siempre obligatorios { campo: { rule, max?, label } }
 * - optional: campos cuyo valor se mantiene si viene (no validados)
 * - files.required: nombres de archivos siempre obligatorios
 * - files.optional: nombres de archivos opcionales
 * - folderName(data, refId): retorna nombre de carpeta en Drive
 * - identifier(data): retorna texto descriptivo para logs
 */
const schemas = {
  comprador: {
    prefix: 'COMP',
    tipoFolder: 'Compradores',
    sheetType: 'Comprador',
    required: {
      nombreBroker: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Broker' },
      codigoInmueble: { rule: SAFE_TEXT, max: 60, label: 'Código del Inmueble' },
      nombre: { rule: SAFE_TEXT, max: 120, label: 'Nombre completo' },
      cedula: { rule: CEDULA, label: 'Cédula' },
      celular: { rule: PHONE, label: 'Celular' },
      email: { rule: EMAIL, max: 120, label: 'Email' },
      direccion: { rule: SAFE_TEXT, max: 200, label: 'Dirección de Residencia' },
      ciudad: { rule: SAFE_TEXT, max: 80, label: 'Ciudad' },
      estadoCivil: { rule: ESTADO_CIVIL, label: 'Estado Civil' },
      genero: { rule: /^(Femenino|Masculino|Otro)$/, label: 'Género' },
      formaPago: { rule: FORMA_PAGO_COMPRA, max: 80, label: 'Forma de Pago' }
    },
    optional: ['fechaFormulario', 'pagos'],
    files: {
      required: ['cedula'],
      optional: []
    },
    folderName: (data, refId) => `${data.nombre.trim()} - ${refId}`,
    identifier: (data) => data.nombre
  },

  vendedor: {
    prefix: 'VEND',
    tipoFolder: 'Vendedores',
    sheetType: 'Vendedor',
    required: {
      nombreBroker: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Broker' },
      codigoInmueble: { rule: SAFE_TEXT, max: 60, label: 'Código del Inmueble' },
      nombre: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Vendedor' },
      cedula: { rule: CEDULA, label: 'Cédula' },
      celular: { rule: PHONE, label: 'Celular' },
      email: { rule: EMAIL, max: 120, label: 'Email' },
      edificio: { rule: SAFE_TEXT, max: 120, label: 'Edificio o Conjunto' },
      numeroInmueble: { rule: SAFE_TEXT, max: 40, label: 'Número del inmueble' },
      direccion: { rule: SAFE_TEXT, max: 200, label: 'Dirección del Inmueble' },
      ciudad: { rule: SAFE_TEXT, max: 80, label: 'Ciudad' },
      estadoInmueble: { rule: ESTADO_INMUEBLE_VENTA, max: 40, label: 'Estado del Inmueble' },
      estadoCivil: { rule: ESTADO_CIVIL, label: 'Estado Civil' }
    },
    optional: [
      'fechaFormulario', 'tieneParqueadero', 'numParqueadero',
      'tieneDeposito', 'numDeposito'
    ],
    files: {
      required: ['tradicion', 'bancaria', 'cedula', 'rut'],
      optional: ['parqueadero', 'deposito']
    },
    folderName: (data, refId) => `${data.nombre.trim()} - ${refId}`,
    identifier: (data) => data.nombre
  },

  arrendador: {
    prefix: 'ARRD',
    tipoFolder: 'Arrendadores',
    sheetType: 'Arrendador',
    required: {
      nombreBroker: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Broker' },
      codigoInmueble: { rule: SAFE_TEXT, max: 60, label: 'Código del Inmueble' },
      nombre: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Arrendador' },
      cedula: { rule: CEDULA, label: 'Cédula' },
      direccion: { rule: SAFE_TEXT, max: 200, label: 'Dirección de Residencia' },
      telefono: { rule: PHONE, label: 'Teléfono' },
      email: { rule: EMAIL, max: 120, label: 'Email' },
      estadoCivil: { rule: ESTADO_CIVIL, label: 'Estado Civil' },
      inmuebleDireccion: { rule: SAFE_TEXT, max: 200, label: 'Dirección del Inmueble' },
      matricula: { rule: SAFE_TEXT, max: 80, label: 'Matrícula Inmobiliaria' },
      tipoInmueble: { rule: TIPO_INMUEBLE, label: 'Tipo de Inmueble' },
      canon: { rule: MONEY_INT, max: 12, label: 'Canon Mensual' },
      formaPagoArriendo: { rule: FORMA_PAGO_ARRIENDO, label: 'Forma de Pago del Arriendo' },
      administracionIncluida: { rule: ADMIN_MODO, label: 'Administración' },
      fechaInicio: { rule: /^\d{4}-\d{2}-\d{2}$/, label: 'Fecha de Inicio' },
      duracion: { rule: /^\d+$/, label: 'Duración (meses)' }
    },
    optional: [
      // Inmueble extra (garaje y depósito condicionales)
      'tieneGaraje', 'numGaraje',
      'tieneDeposito', 'numDeposito',
      // Economía
      'diaPago', 'incremento',
      'deposito',
      'serviciosIncluidosAgua', 'serviciosIncluidosLuz', 'serviciosIncluidosGas',
      'valorAdministracion',
      // Contrato
      'renovacionAuto',
      'noMascotas', 'noModificaciones', 'noSubarriendo',
      'observaciones'
    ],
    files: {
      required: ['cedula', 'tradicion', 'certificacionBancaria'],
      optional: []
    },
    folderName: (data, refId) => `${data.nombre.trim()} - ${refId}`,
    identifier: (data) => data.nombre
  },

  arrendatario: {
    prefix: 'ARRT',
    tipoFolder: 'Arrendatarios',
    sheetType: 'Arrendatario',
    required: {
      nombreBroker: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Broker' },
      codigoInmueble: { rule: SAFE_TEXT, max: 60, label: 'Código del Inmueble' },
      nombre: { rule: SAFE_TEXT, max: 120, label: 'Nombre del Arrendatario' },
      cedula: { rule: CEDULA, label: 'Cédula' },
      direccion: { rule: SAFE_TEXT, max: 200, label: 'Dirección de Residencia' },
      telefono: { rule: PHONE, label: 'Teléfono' },
      email: { rule: EMAIL, max: 120, label: 'Email' },
      estadoCivil: { rule: ESTADO_CIVIL, label: 'Estado Civil' }
    },
    optional: [
      'tieneCodeudor', 'codeudorNombre', 'codeudorCedula',
      'codeudorDireccion', 'codeudorTelefono', 'codeudorEmail'
    ],
    files: {
      required: ['cedula'],
      optional: ['cedulaCodeudor']
    },
    folderName: (data, refId) => `${data.nombre.trim()} - ${refId}`,
    identifier: (data) => data.nombre
  }
};

// Tope conservador para strings opcionales (observaciones, etc).
const OPTIONAL_STRING_MAX = 1000;
// Tope para arrays variables (pagos del comprador).
const PAGOS_MAX = 24;

/**
 * Valida un objeto data contra el schema especificado.
 * Retorna { valid: boolean, errors: [{ field, message }] }
 *
 * Adicional a las reglas declaradas:
 *  - Cualquier string en optional[] queda capado a OPTIONAL_STRING_MAX chars.
 *  - data.pagos (comprador) se valida estructuralmente si viene presente.
 */
function validate(data, schemaName) {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Schema desconocido: ${schemaName}`);

  const errors = [];

  for (const [field, spec] of Object.entries(schema.required)) {
    const value = data[field];

    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push({ field, message: `${spec.label} es obligatorio` });
      continue;
    }

    const str = String(value).trim();

    if (spec.max && str.length > spec.max) {
      errors.push({ field, message: `${spec.label} excede el largo máximo (${spec.max})` });
      continue;
    }

    if (spec.rule && !spec.rule.test(str)) {
      errors.push({ field, message: `${spec.label} tiene formato inválido` });
    }
  }

  // Cap defensivo a strings opcionales.
  for (const field of schema.optional || []) {
    const value = data[field];
    if (typeof value === 'string' && value.length > OPTIONAL_STRING_MAX) {
      errors.push({ field, message: `${field} excede el largo máximo (${OPTIONAL_STRING_MAX})` });
    }
  }

  // Validación específica de pagos[] del comprador.
  if (schemaName === 'comprador' && data.pagos !== undefined) {
    if (!Array.isArray(data.pagos)) {
      errors.push({ field: 'pagos', message: 'pagos debe ser una lista' });
    } else if (data.pagos.length > PAGOS_MAX) {
      errors.push({ field: 'pagos', message: `pagos excede el máximo (${PAGOS_MAX})` });
    } else {
      data.pagos.forEach((p, i) => {
        if (!p || typeof p !== 'object') {
          errors.push({ field: `pagos[${i}]`, message: 'pago inválido' });
          return;
        }
        if (p.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha))) {
          errors.push({ field: `pagos[${i}].fecha`, message: 'fecha inválida' });
        }
        if (p.monto !== undefined && p.monto !== '') {
          const n = Number(p.monto);
          if (!Number.isFinite(n) || n < 0 || n > 1e12) {
            errors.push({ field: `pagos[${i}].monto`, message: 'monto inválido' });
          }
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitiza una cadena para uso en nombres de archivo / carpeta de Drive.
 * Elimina caracteres peligrosos y comillas simples (anti-inyeccion en queries Drive).
 */
function sanitizeForDrive(input) {
  if (!input) return '';
  return String(input)
    .replace(/['"\\\/\n\r\t<>|*?:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

module.exports = { schemas, validate, sanitizeForDrive };
