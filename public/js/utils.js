/**
 * BRIKSS Forms - Utilidades compartidas
 * Validaciones, toast notifications, upload zones, y navegacion de formularios
 */

/* ── Validaciones ─────────────────────────────────────────── */
const Validators = {
  cedula: (value) => /^\d{6,10}$/.test(value.replace(/\s/g, '')),
  celular: (value) => /^\+?57\s?\d{3}\s?\d{3}\s?\d{4}$/.test(value.replace(/\s/g, '')),
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  required: (value) => value !== null && value !== undefined && String(value).trim().length > 0,
  minLength: (value, min) => String(value).trim().length >= min,
  maxLength: (value, max) => String(value).trim().length <= max,
  number: (value) => /^\d+$/.test(value),
  money: (value) => /^\d{1,3}(\.\d{3})*$/.test(value) || /^\d+$/.test(value.replace(/[.,\s]/g, '')),
  futureDate: (value) => {
    const date = new Date(value);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return date >= tomorrow;
  },
  pdf: (file) => {
    if (!file) return false;
    const isPdf = file.type === 'application/pdf';
    const maxSize = 10 * 1024 * 1024; // 10MB
    return isPdf && file.size <= maxSize;
  }
};

// Mensajes de error en espanol
const ErrorMessages = {
  cedula: 'Ingresa un numero de cedula valido (6-10 digitos)',
  celular: 'Formato: +57 315 857 4462',
  email: 'Ingresa un correo electronico valido',
  required: 'Este campo es obligatorio',
  minLength: (min) => `Minimo ${min} caracteres`,
  futureDate: 'La fecha debe ser posterior a hoy',
  pdfType: 'Solo se permiten archivos PDF',
  pdfSize: 'El archivo no puede exceder 10MB',
  money: 'Ingresa un monto valido'
};

/* ── Validacion de campos en tiempo real ──────────────────── */
function setupValidation(input, validationType) {
  input.addEventListener('blur', () => validateField(input, validationType));
  input.addEventListener('input', () => {
    if (input.classList.contains('is-invalid')) {
      validateField(input, validationType);
    }
  });
}

function validateField(input, validationType) {
  const value = input.value;
  let isValid = true;
  let errorMsg = '';

  if (input.hasAttribute('required') || input.dataset.required === 'true') {
    if (!Validators.required(value)) {
      isValid = false;
      errorMsg = ErrorMessages.required;
    }
  }

  if (isValid && value.trim() !== '') {
    switch (validationType) {
      case 'cedula':
        isValid = Validators.cedula(value);
        errorMsg = ErrorMessages.cedula;
        break;
      case 'celular':
        isValid = Validators.celular(value);
        errorMsg = ErrorMessages.celular;
        break;
      case 'email':
        isValid = Validators.email(value);
        errorMsg = ErrorMessages.email;
        break;
      case 'futureDate':
        isValid = Validators.futureDate(value);
        errorMsg = ErrorMessages.futureDate;
        break;
      case 'money':
        isValid = Validators.money(value);
        errorMsg = ErrorMessages.money;
        break;
    }
  }

  toggleFieldState(input, isValid, errorMsg);
  return isValid;
}

function toggleFieldState(input, isValid, errorMsg) {
  const errorEl = input.parentElement.querySelector('.form-error');
  input.classList.remove('is-valid', 'is-invalid');

  if (!isValid) {
    input.classList.add('is-invalid');
    if (errorEl) {
      errorEl.textContent = errorMsg;
      errorEl.classList.add('visible');
    }
    input.setAttribute('aria-invalid', 'true');
  } else if (input.value.trim() !== '') {
    input.classList.add('is-valid');
    if (errorEl) {
      errorEl.classList.remove('visible');
    }
    input.removeAttribute('aria-invalid');
  }
}

/* ── Validar paso completo ────────────────────────────────── */
function validateStep(stepEl) {
  let allValid = true;
  const inputs = stepEl.querySelectorAll('[data-validate]');

  inputs.forEach(input => {
    const type = input.dataset.validate;
    const isValid = validateField(input, type);
    if (!isValid && input.hasAttribute('required')) {
      allValid = false;
    }
  });

  // Validar selects requeridos
  const selects = stepEl.querySelectorAll('select[required]');
  selects.forEach(select => {
    if (!select.value) {
      allValid = false;
      select.classList.add('is-invalid');
    }
  });

  // Validar radios requeridos
  const radioGroups = stepEl.querySelectorAll('[data-radio-required]');
  radioGroups.forEach(group => {
    const name = group.dataset.radioRequired;
    const checked = stepEl.querySelector(`input[name="${name}"]:checked`);
    if (!checked) {
      allValid = false;
      group.classList.add('is-invalid');
    }
  });

  return allValid;
}

/* ── Toast Notifications ──────────────────────────────────── */
function getOrCreateToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = 'info', duration = 4000) {
  const container = getOrCreateToastContainer();
  const icons = {
    success: '\u2714',
    error: '\u2716',
    info: '\u2139',
    warning: '\u26A0'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/* ── Upload Zone (Drag & Drop) ────────────────────────────── */
function setupUploadZone(zoneEl, options = {}) {
  const input = zoneEl.querySelector('input[type="file"]');
  const fileInfo = zoneEl.querySelector('.upload-zone__file-info');
  const fileName = zoneEl.querySelector('.file-name');
  const fileSize = zoneEl.querySelector('.file-size');
  const removeBtn = zoneEl.querySelector('.upload-zone__remove');
  const fieldName = options.fieldName || input.name || 'file';

  // Prevenir comportamiento por defecto de drag
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    zoneEl.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Estilos de dragover
  ['dragenter', 'dragover'].forEach(event => {
    zoneEl.addEventListener(event, () => zoneEl.classList.add('dragover'));
  });

  ['dragleave', 'drop'].forEach(event => {
    zoneEl.addEventListener(event, () => zoneEl.classList.remove('dragover'));
  });

  // Manejar drop
  zoneEl.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  // Manejar seleccion de archivo
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      handleFile(input.files[0]);
    }
  });

  // Boton eliminar
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearFile();
    });
  }

  function handleFile(file) {
    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      zoneEl.classList.add('has-error');
      zoneEl.classList.remove('has-file');
      showToast(ErrorMessages.pdfType, 'error');
      return;
    }

    // Validar tamano (10MB)
    if (file.size > 10 * 1024 * 1024) {
      zoneEl.classList.add('has-error');
      zoneEl.classList.remove('has-file');
      showToast(ErrorMessages.pdfSize, 'error');
      return;
    }

    // Archivo valido
    zoneEl.classList.remove('has-error');
    zoneEl.classList.add('has-file');

    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);

    // Almacenar referencia al archivo
    zoneEl._file = file;

    showToast(`Archivo "${file.name}" cargado correctamente`, 'success');

    if (options.onFile) options.onFile(file);
  }

  function clearFile() {
    input.value = '';
    zoneEl.classList.remove('has-file', 'has-error');
    zoneEl._file = null;
    if (options.onClear) options.onClear();
  }

  return { handleFile, clearFile, getFile: () => zoneEl._file };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ── Navegacion entre pasos del formulario ────────────────── */
class FormWizard {
  constructor(options) {
    this.formEl = document.getElementById(options.formId);
    this.steps = this.formEl.querySelectorAll('.form-step');
    this.progressSteps = document.querySelectorAll('.progress-bar__step');
    this.progressLabels = document.querySelectorAll('.progress-bar__label');
    this.progressFill = document.querySelector('.progress-bar__fill');
    this.currentStep = 0;
    this.totalSteps = this.steps.length;
    this.onSubmit = options.onSubmit || (() => {});

    this.updateUI();
  }

  next() {
    // Validar paso actual antes de avanzar
    if (!validateStep(this.steps[this.currentStep])) {
      showToast('Por favor completa todos los campos requeridos', 'warning');
      return false;
    }

    if (this.currentStep < this.totalSteps - 1) {
      this.steps[this.currentStep].classList.remove('active');
      this.currentStep++;
      this.steps[this.currentStep].classList.add('active');
      this.updateUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    return false;
  }

  prev() {
    if (this.currentStep > 0) {
      this.steps[this.currentStep].classList.remove('active');
      this.currentStep--;
      this.steps[this.currentStep].classList.add('active');
      this.updateUI();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    return false;
  }

  goToStep(index) {
    if (index >= 0 && index < this.totalSteps) {
      this.steps[this.currentStep].classList.remove('active');
      this.currentStep = index;
      this.steps[this.currentStep].classList.add('active');
      this.updateUI();
    }
  }

  updateUI() {
    // Actualizar barra de progreso
    const fillPercentage = this.totalSteps > 1
      ? (this.currentStep / (this.totalSteps - 1)) * 100
      : 100;

    if (this.progressFill) {
      this.progressFill.style.width = fillPercentage + '%';
    }

    this.progressSteps.forEach((step, i) => {
      step.classList.remove('active', 'completed');
      if (i < this.currentStep) {
        step.classList.add('completed');
        step.innerHTML = '\u2714';
      } else if (i === this.currentStep) {
        step.classList.add('active');
        step.textContent = i + 1;
      } else {
        step.textContent = i + 1;
      }
    });

    this.progressLabels.forEach((label, i) => {
      label.classList.remove('active', 'completed');
      if (i < this.currentStep) label.classList.add('completed');
      else if (i === this.currentStep) label.classList.add('active');
    });
  }

  async submit() {
    // Validar ultimo paso
    if (!validateStep(this.steps[this.currentStep])) {
      showToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    try {
      showLoading('Subiendo documentos...', 'Esto puede tomar unos segundos');
      await this.onSubmit();
    } catch (error) {
      hideLoading();
      showToast('Error al enviar los documentos: ' + error.message, 'error');
    }
  }
}

/* ── Loading Overlay ──────────────────────────────────────── */
function showLoading(title = 'Procesando...', subtitle = '') {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-title">${title}</p>
        <small class="loading-subtitle">${subtitle}</small>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.loading-title').textContent = title;
    overlay.querySelector('.loading-subtitle').textContent = subtitle;
  }
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.classList.remove('active');
}

/* ── Pagina de confirmacion ───────────────────────────────── */
function showConfirmation(data) {
  const formCard = document.querySelector('.form-card');
  if (!formCard) return;

  formCard.innerHTML = `
    <div class="confirmation">
      <div class="confirmation__icon">\u2714\uFE0F</div>
      <h2>Documentos Enviados Exitosamente</h2>
      <p>Hemos recibido tu informacion. Nos pondremos en contacto contigo pronto.</p>
      <dl class="confirmation__details">
        <dt>Tipo de Tramite</dt>
        <dd>${data.tipo || ''}</dd>
        <dt>ID de Referencia</dt>
        <dd>${data.id || ''}</dd>
        <dt>Nombre</dt>
        <dd>${data.nombre || ''}</dd>
        <dt>Fecha de Envio</dt>
        <dd>${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
      </dl>
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="/" class="btn btn-primary">Volver al Inicio</a>
        <button onclick="window.print()" class="btn btn-secondary">Imprimir Copia</button>
      </div>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Utilidades generales ─────────────────────────────────── */
// Fecha actual formateada
function getTodayFormatted() {
  return new Date().toISOString().split('T')[0];
}

// Fecha minima (manana)
function getTomorrowFormatted() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Formatear como moneda COP
function formatCurrency(input) {
  input.addEventListener('input', () => {
    let value = input.value.replace(/\D/g, '');
    if (value) {
      value = parseInt(value, 10).toLocaleString('es-CO');
      input.value = value;
    }
  });
}

// Generar ID unico para la referencia
function generateRefId(prefix) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `${prefix}-${date}-${seq}`;
}

// Crear FormData con todos los datos y archivos
function buildFormData(data, files) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  for (const [key, file] of Object.entries(files)) {
    if (file) formData.append(key, file);
  }
  return formData;
}

// Enviar formulario al servidor
async function submitForm(endpoint, formData) {
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Error del servidor' }));
    throw new Error(err.message || 'Error al enviar los datos');
  }

  return response.json();
}

/* ── Inicializacion de validaciones automaticas ───────────── */
function initAutoValidation() {
  document.querySelectorAll('[data-validate]').forEach(input => {
    setupValidation(input, input.dataset.validate);
  });
}

/* ── Menu movil ───────────────────────────────────────────── */
function toggleMenu() {
  const nav = document.querySelector('.header__nav');
  const btn = document.querySelector('.header__menu-toggle');
  const isOpen = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen);
}
