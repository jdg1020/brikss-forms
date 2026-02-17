/**
 * BRIKSS Forms - Comprador
 * Inicializacion y logica del formulario de comprador
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Referencias a elementos del DOM ────────────────────────
  const fechaFormularioInput = document.getElementById('fechaFormulario');
  const uploadCedula = document.getElementById('uploadCedula');

  // ── 1. Configurar fecha del formulario (hoy, solo lectura) ─
  fechaFormularioInput.value = getTodayFormatted();

  // ── 2. Inicializar validaciones automaticas ────────────────
  initAutoValidation();

  // ── 3. Configurar zona de carga de cedula ──────────────────
  setupUploadZone(uploadCedula);

  // ── 4. Crear instancia del wizard de formulario ────────────
  const wizard = new FormWizard({
    formId: 'compradorForm',
    onSubmit: handleSubmit
  });

  // ── Pagos dinamicos ─────────────────────────────────────────
  const formaPagoSelect = document.getElementById('formaPago');
  const pagosContainer = document.getElementById('pagosContainer');
  const btnAgregarPago = document.getElementById('btnAgregarPago');
  let pagoCount = 1;

  // Inicializar primer pago
  initPagoRow(pagosContainer.querySelector('.pago-row'));

  // Mostrar/ocultar boton agregar segun forma de pago
  formaPagoSelect.addEventListener('change', () => {
    const isContado = formaPagoSelect.value === 'Compra de Contado';
    btnAgregarPago.style.display = isContado ? 'none' : 'block';
  });

  // Agregar nuevo pago
  btnAgregarPago.addEventListener('click', () => {
    pagoCount++;
    const newRow = document.createElement('div');
    newRow.className = 'pago-row';
    newRow.dataset.pago = pagoCount;
    newRow.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <p class="section-title"><span class="section-title__icon">&#128176;</span> Pago ${pagoCount}</p>
        <button type="button" class="upload-zone__remove" onclick="this.closest('.pago-row').remove()" aria-label="Eliminar pago" style="font-size:1.5rem;color:var(--brikss-error, #e53e3e);">&times;</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha de Pago <span class="required">*</span></label>
          <input type="date" class="form-input pago-fecha" required data-validate="futureDate">
          <div class="form-error" role="alert"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Monto <span class="required">*</span></label>
          <input type="text" class="form-input pago-monto" required data-validate="money" placeholder="$ 0">
          <div class="form-hint">COP</div>
          <div class="form-error" role="alert"></div>
        </div>
      </div>
    `;
    pagosContainer.appendChild(newRow);
    initPagoRow(newRow);
    showToast('Pago ' + pagoCount + ' agregado', 'info');
  });

  function initPagoRow(row) {
    const fechaInput = row.querySelector('.pago-fecha');
    const montoInput = row.querySelector('.pago-monto');
    fechaInput.min = getTomorrowFormatted();
    setupValidation(fechaInput, 'futureDate');
    formatCurrency(montoInput);
    setupValidation(montoInput, 'money');
  }

  // ── 5. Conectar botones de navegacion ──────────────────────
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') wizard.next();
      else if (action === 'prev') wizard.prev();
      else if (action === 'submit') wizard.submit();
    });
  });

  // ── 6. Estilos de seleccion en radio buttons ──────────────
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      // Limpiar seleccion previa del mismo grupo
      const groupName = radio.name;
      document.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
        r.closest('.radio-option').classList.remove('selected');
      });
      // Marcar opcion seleccionada
      radio.closest('.radio-option').classList.add('selected');

      // Quitar estado invalido del grupo si lo tenia
      const radioGroup = radio.closest('[data-radio-required]');
      if (radioGroup) {
        radioGroup.classList.remove('is-invalid');
      }
    });
  });

  // ── Funcion de envio del formulario ────────────────────────
  async function handleSubmit() {
    // Validar que se haya subido la cedula
    if (!uploadCedula._file) {
      hideLoading();
      showToast('Debes adjuntar la cedula del comprador en formato PDF', 'error');
      return;
    }

    // Recopilar datos del formulario
    const estadoCivilRadio = document.querySelector('input[name="estadoCivil"]:checked');
    const generoRadio = document.querySelector('input[name="genero"]:checked');

    const data = {
      fechaFormulario: document.getElementById('fechaFormulario').value,
      nombre: document.getElementById('nombre').value.trim(),
      cedula: document.getElementById('cedula').value.trim(),
      celular: document.getElementById('celular').value.trim(),
      email: document.getElementById('email').value.trim(),
      direccion: document.getElementById('direccion').value.trim(),
      ciudad: document.getElementById('ciudad').value.trim(),
      estadoCivil: estadoCivilRadio ? estadoCivilRadio.value : '',
      genero: generoRadio ? generoRadio.value : '',
      formaPago: document.getElementById('formaPago').value,
      pagos: []
    };

    // Recopilar todos los pagos
    document.querySelectorAll('.pago-row').forEach((row, i) => {
      data.pagos.push({
        numero: i + 1,
        fecha: row.querySelector('.pago-fecha').value,
        monto: row.querySelector('.pago-monto').value
      });
    });

    // Construir FormData con archivos adjuntos
    const formData = buildFormData(data, {
      cedula: uploadCedula._file
    });

    try {
      const result = await submitForm('/api/comprador', formData);
      hideLoading();
      showConfirmation({
        tipo: 'Comprador',
        id: result.id,
        nombre: data.nombre
      });
    } catch (error) {
      hideLoading();
      showToast('Error al enviar los documentos: ' + error.message, 'error');
    }
  }
});
