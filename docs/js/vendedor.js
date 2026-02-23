/**
 * BRIKSS Forms - Vendedor (Version Estatica con EmailJS)
 * Inicializacion y logica especifica del formulario de vendedor
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Fechas ──────────────────────────────────────────── */
  const fechaFormulario = document.getElementById('fechaFormulario');
  fechaFormulario.value = getTodayFormatted();

  /* ── 2. Validacion automatica ───────────────────────────── */
  initAutoValidation();

  /* ── 3. Upload Zones ────────────────────────────────────── */
  const uploadZones = {};
  const zoneIds = [
    'uploadTradicion',
    'uploadBancaria',
    'uploadCedula',
    'uploadRut',
    'uploadPazSalvo',
    'uploadParqueadero',
    'uploadDeposito'
  ];

  zoneIds.forEach(id => {
    const zoneEl = document.getElementById(id);
    if (zoneEl) {
      uploadZones[id] = setupUploadZone(zoneEl, { fieldName: id });
    }
  });

  /* ── 4. Form Wizard ──────────────────────────────────────── */
  const wizard = new FormWizard({
    formId: 'vendedorForm',
    onSubmit: handleSubmit
  });

  /* ── 5. Botones de navegacion ───────────────────────────── */
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') {
        wizard.next();
      } else if (action === 'prev') {
        wizard.prev();
      } else if (action === 'submit') {
        wizard.submit();
      }
    });
  });

  /* ── 6. Radio button styling ────────────────────────────── */
  document.querySelectorAll('.radio-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const groupName = radio.getAttribute('name');
      document.querySelectorAll(`.radio-option input[name="${groupName}"]`).forEach(r => {
        r.closest('.radio-option').classList.remove('selected');
      });
      radio.closest('.radio-option').classList.add('selected');

      const radioGroup = radio.closest('[data-radio-required]');
      if (radioGroup) {
        radioGroup.classList.remove('is-invalid');
      }
    });
  });

  /* ── 7. Secciones condicionales ─────────────────────────── */
  const tieneParqueadero = document.getElementById('tieneParqueadero');
  const tieneDeposito = document.getElementById('tieneDeposito');

  if (tieneParqueadero) {
    tieneParqueadero.addEventListener('change', () => {
      const section = tieneParqueadero.closest('.form-group').querySelector('.conditional-section');
      if (section) {
        section.classList.toggle('visible', tieneParqueadero.checked);
      }
      tieneParqueadero.closest('.checkbox-option').classList.toggle('selected', tieneParqueadero.checked);
    });
  }

  if (tieneDeposito) {
    tieneDeposito.addEventListener('change', () => {
      const section = tieneDeposito.closest('.form-group').querySelector('.conditional-section');
      if (section) {
        section.classList.toggle('visible', tieneDeposito.checked);
      }
      tieneDeposito.closest('.checkbox-option').classList.toggle('selected', tieneDeposito.checked);
    });
  }

  /* ── 8. Submit handler ──────────────────────────────────── */
  async function handleSubmit() {
    // Validar archivos requeridos
    const requiredUploads = {
      uploadTradicion: 'Certificado de Tradicion y Libertad',
      uploadBancaria: 'Certificacion Bancaria',
      uploadCedula: 'Cedula del Vendedor',
      uploadRut: 'RUT',
      uploadPazSalvo: 'Paz y Salvo de Administracion'
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
      hideLoading();
      showToast(`Faltan documentos obligatorios: ${missingFiles.join(', ')}`, 'error', 6000);
      throw new Error('Documentos requeridos faltantes');
    }

    // Recopilar datos del formulario
    const estadoCivilRadio = document.querySelector('input[name="estadoCivil"]:checked');
    const refId = generateRefId('VEND');

    const data = {
      refId: refId,
      tipo: 'Vendedor',
      fechaFormulario: fechaFormulario.value,
      nombre: document.getElementById('nombre').value.trim(),
      cedula: document.getElementById('cedula').value.trim(),
      celular: document.getElementById('celular').value.trim(),
      email: document.getElementById('email').value.trim(),
      edificio: document.getElementById('edificio').value.trim(),
      numeroInmueble: document.getElementById('numeroInmueble').value.trim(),
      direccion: document.getElementById('direccion').value.trim(),
      ciudad: document.getElementById('ciudad').value.trim(),
      estadoInmueble: document.getElementById('estadoInmueble').value,
      estadoCivil: estadoCivilRadio ? estadoCivilRadio.value : '',
      tieneParqueadero: tieneParqueadero.checked,
      numParqueadero: tieneParqueadero.checked ? document.getElementById('numParqueadero').value.trim() : '',
      tieneDeposito: tieneDeposito.checked,
      numDeposito: tieneDeposito.checked ? document.getElementById('numDeposito').value.trim() : ''
    };

    // Lista de archivos adjuntos
    const filesList = [];
    const allUploads = {
      uploadTradicion: 'Certificado Tradicion',
      uploadBancaria: 'Certificacion Bancaria',
      uploadCedula: 'Cedula Vendedor',
      uploadRut: 'RUT',
      uploadPazSalvo: 'Paz y Salvo',
      uploadParqueadero: 'Parqueadero',
      uploadDeposito: 'Deposito'
    };

    for (const [zoneId, label] of Object.entries(allUploads)) {
      const zone = uploadZones[zoneId];
      if (zone && zone.getFile()) {
        filesList.push({
          label: label,
          name: zone.getFile().name,
          size: formatFileSize(zone.getFile().size)
        });
      }
    }

    try {
      const result = await sendFormViaEmail({
        formType: 'Vendedor',
        data: data,
        filesList: filesList,
        clientEmail: data.email,
        clientName: data.nombre
      });

      hideLoading();
      showToast('Documentos enviados exitosamente', 'success');
      showConfirmation({
        tipo: 'Vendedor',
        id: result.id,
        nombre: data.nombre
      });
    } catch (error) {
      hideLoading();
      showToast('Error al enviar: ' + error.message, 'error');
    }
  }

});
