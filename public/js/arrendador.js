/**
 * BRIKSS Forms - Arrendador (propietario)
 * Logica del formulario de 5 pasos del arrendador.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Validacion automatica ─────────────────────────────────
  initAutoValidation();

  // ── 2. Upload zones ──────────────────────────────────────────
  const uploadZones = {};
  ['uploadCedula', 'uploadTradicion', 'uploadCertificacionBancaria'].forEach(id => {
    const el = document.getElementById(id);
    if (el) uploadZones[id] = setupUploadZone(el, { fieldName: id });
  });

  // ── 3. Formato moneda ────────────────────────────────────────
  const moneyInputs = ['canon', 'deposito', 'valorAdministracion'];
  moneyInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) formatCurrency(el);
  });

  // ── 4. FormWizard ────────────────────────────────────────────
  const wizard = new FormWizard({
    formId: 'arrendadorForm',
    onSubmit: handleSubmit
  });

  // ── 5. Botones de navegacion ─────────────────────────────────
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') wizard.next();
      else if (action === 'prev') wizard.prev();
      else if (action === 'submit') wizard.submit();
    });
  });

  // ── 6. Estilos de radio y checkbox seleccionados ─────────────
  document.querySelectorAll('.radio-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const groupName = radio.name;
      document.querySelectorAll(`.radio-option input[name="${groupName}"]`).forEach(r => {
        r.closest('.radio-option').classList.remove('selected');
      });
      radio.closest('.radio-option').classList.add('selected');
      const radioGroup = radio.closest('[data-radio-required]');
      if (radioGroup) radioGroup.classList.remove('is-invalid');
    });
  });

  document.querySelectorAll('.checkbox-option input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      checkbox.closest('.checkbox-option').classList.toggle('selected', checkbox.checked);
    });
  });

  // ── 7. Secciones condicionales (Garaje, Deposito) ────────────
  setupConditional('tieneGaraje');
  setupConditional('tieneDeposito');

  function setupConditional(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    if (!checkbox) return;
    checkbox.addEventListener('change', () => {
      const section = checkbox.closest('.form-group').querySelector('.conditional-section');
      if (section) section.classList.toggle('visible', checkbox.checked);
    });
  }

  // ── 8. Submit handler ────────────────────────────────────────
  async function handleSubmit() {
    const requiredUploads = {
      uploadCedula: 'Cedula del Arrendador',
      uploadTradicion: 'Certificado de Tradicion y Libertad',
      uploadCertificacionBancaria: 'Certificacion Bancaria'
    };

    const missingFiles = [];
    for (const [zoneId, label] of Object.entries(requiredUploads)) {
      const zone = uploadZones[zoneId];
      if (!zone || !zone.getFile()) {
        missingFiles.push(label);
        const zoneEl = document.getElementById(zoneId);
        if (zoneEl) zoneEl.classList.add('has-error');
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`Faltan documentos obligatorios: ${missingFiles.join(', ')}`);
    }

    const form = document.getElementById('arrendadorForm');
    const get = (id) => {
      const el = document.getElementById(id);
      return el ? (el.value || '').trim() : '';
    };
    const checked = (id) => {
      const el = document.getElementById(id);
      return el ? !!el.checked : false;
    };
    const radio = (name) => {
      const r = form.querySelector(`input[name="${name}"]:checked`);
      return r ? r.value : '';
    };

    const data = {
      // Datos personales del arrendador
      nombreBroker: get('nombreBroker'),
      codigoInmueble: get('codigoInmueble'),
      nombre: get('nombre'),
      cedula: get('cedula'),
      telefono: get('telefono'),
      email: get('email'),
      direccion: get('direccion'),
      estadoCivil: radio('estadoCivil'),

      // Inmueble
      inmuebleDireccion: get('inmuebleDireccion'),
      matricula: get('matricula'),
      tipoInmueble: get('tipoInmueble'),
      tieneGaraje: checked('tieneGaraje'),
      numGaraje: checked('tieneGaraje') ? get('numGaraje') : '',
      tieneDeposito: checked('tieneDeposito'),
      numDeposito: checked('tieneDeposito') ? get('numDeposito') : '',

      // Economía (montos en COP, normalizados a entero plano)
      canon: readMoney('canon'),
      diaPago: get('diaPago'),
      formaPagoArriendo: radio('formaPagoArriendo'),
      incremento: get('incremento') || 'IPC',
      deposito: readMoney('deposito'),
      serviciosIncluidosAgua: checked('serviciosIncluidosAgua'),
      serviciosIncluidosLuz: checked('serviciosIncluidosLuz'),
      serviciosIncluidosGas: checked('serviciosIncluidosGas'),
      administracionIncluida: radio('administracionIncluida'),
      valorAdministracion: readMoney('valorAdministracion'),

      // Contrato
      fechaInicio: get('fechaInicio'),
      duracion: get('duracion'),
      renovacionAuto: checked('renovacionAuto'),
      noMascotas: checked('noMascotas'),
      noModificaciones: checked('noModificaciones'),
      noSubarriendo: checked('noSubarriendo'),
      observaciones: get('observaciones')
    };

    const files = {
      cedula: uploadZones.uploadCedula.getFile(),
      tradicion: uploadZones.uploadTradicion.getFile(),
      certificacionBancaria: uploadZones.uploadCertificacionBancaria.getFile()
    };

    const formData = buildFormData(data, files);
    const result = await submitForm('/api/arrendador', formData);
    hideLoading();
    showConfirmation({
      tipo: 'Arrendador',
      id: result.id,
      nombre: data.nombre
    });
  }
});
