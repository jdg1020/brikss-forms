/**
 * BRIKSS Forms - Comprador
 * Inicializacion y logica del formulario de comprador
 */

document.addEventListener('DOMContentLoaded', () => {
  const fechaFormularioInput = document.getElementById('fechaFormulario');
  const uploadCedula = document.getElementById('uploadCedula');

  fechaFormularioInput.value = getTodayFormatted();
  initAutoValidation();
  setupUploadZone(uploadCedula);

  const wizard = new FormWizard({
    formId: 'compradorForm',
    onSubmit: handleSubmit
  });

  // ── Pagos dinamicos ─────────────────────────────────────────
  const formaPagoSelect = document.getElementById('formaPago');
  const pagosContainer = document.getElementById('pagosContainer');
  const btnAgregarPago = document.getElementById('btnAgregarPago');
  let pagoCount = 1;

  initPagoRow(pagosContainer.querySelector('.pago-row'));

  formaPagoSelect.addEventListener('change', () => {
    const isContado = formaPagoSelect.value === 'Compra de Contado';
    btnAgregarPago.style.display = isContado ? 'none' : 'block';
    if (isContado) {
      // Si el usuario había agregado pagos extra y cambia a Contado, dejamos
      // sólo el primero para evitar enviar pagos huérfanos al server.
      const extras = pagosContainer.querySelectorAll('.pago-row:not(:first-child)');
      extras.forEach(row => row.remove());
      pagoCount = 1;
    }
  });

  btnAgregarPago.addEventListener('click', () => {
    pagoCount++;
    const newRow = document.createElement('div');
    newRow.className = 'pago-row';
    newRow.dataset.pago = pagoCount;
    newRow.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <p class="section-title"><span class="section-title__icon">&#128176;</span> Pago ${pagoCount}</p>
        <button type="button" class="upload-zone__remove pago-row__remove" aria-label="Eliminar pago" style="font-size:1.5rem;color:var(--brikss-error, #e53e3e);">&times;</button>
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

  // Event delegation: maneja eliminacion de cualquier .pago-row sin inline onclick (CSP-friendly).
  pagosContainer.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.pago-row__remove');
    if (removeBtn) {
      const row = removeBtn.closest('.pago-row');
      if (row) row.remove();
    }
  });

  function initPagoRow(row) {
    const fechaInput = row.querySelector('.pago-fecha');
    const montoInput = row.querySelector('.pago-monto');
    fechaInput.min = getTomorrowFormatted();
    setupValidation(fechaInput, 'futureDate');
    formatCurrency(montoInput);
    setupValidation(montoInput, 'money');
  }

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') wizard.next();
      else if (action === 'prev') wizard.prev();
      else if (action === 'submit') wizard.submit();
    });
  });

  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const groupName = radio.name;
      document.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
        r.closest('.radio-option').classList.remove('selected');
      });
      radio.closest('.radio-option').classList.add('selected');

      const radioGroup = radio.closest('[data-radio-required]');
      if (radioGroup) {
        radioGroup.classList.remove('is-invalid');
      }
    });
  });

  async function handleSubmit() {
    if (!uploadCedula._file) {
      throw new Error('Debes adjuntar la cedula del comprador en formato PDF');
    }

    const estadoCivilRadio = document.querySelector('input[name="estadoCivil"]:checked');
    const generoRadio = document.querySelector('input[name="genero"]:checked');

    const data = {
      fechaFormulario: document.getElementById('fechaFormulario').value,
      nombreBroker: document.getElementById('nombreBroker').value.trim(),
      codigoInmueble: document.getElementById('codigoInmueble').value.trim(),
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

    document.querySelectorAll('.pago-row').forEach((row, i) => {
      const montoStr = String(row.querySelector('.pago-monto').value || '').replace(/\D/g, '');
      data.pagos.push({
        numero: i + 1,
        fecha: row.querySelector('.pago-fecha').value,
        monto: montoStr ? parseInt(montoStr, 10) : 0
      });
    });

    const formData = buildFormData(data, {
      cedula: uploadCedula._file
    });

    const result = await submitForm('/api/comprador', formData);
    hideLoading();
    showConfirmation({
      tipo: 'Comprador',
      id: result.id,
      nombre: data.nombre
    });
  }
});
