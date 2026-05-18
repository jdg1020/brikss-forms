/**
 * BRIKSS Forms - Arrendatario (inquilino)
 * Logica del formulario de 3 pasos del arrendatario.
 */

document.addEventListener('DOMContentLoaded', () => {

  initAutoValidation();

  const uploadZones = {};
  ['uploadCedula', 'uploadCedulaCodeudor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) uploadZones[id] = setupUploadZone(el, { fieldName: id });
  });

  const wizard = new FormWizard({
    formId: 'arrendatarioForm',
    onSubmit: handleSubmit
  });

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'next') wizard.next();
      else if (action === 'prev') wizard.prev();
      else if (action === 'submit') wizard.submit();
    });
  });

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

  // Seccion condicional del codeudor
  const tieneCodeudorCheckbox = document.getElementById('tieneCodeudor');
  const codeudorSection = document.getElementById('codeudorSection');

  if (tieneCodeudorCheckbox && codeudorSection) {
    tieneCodeudorCheckbox.addEventListener('change', () => {
      if (tieneCodeudorCheckbox.checked) {
        codeudorSection.classList.add('visible');
      } else {
        codeudorSection.classList.remove('visible');
        codeudorSection.querySelectorAll('input').forEach(input => {
          input.value = '';
          input.classList.remove('is-valid', 'is-invalid');
        });
      }
    });
  }

  async function handleSubmit() {
    const fileCedula = uploadZones.uploadCedula && uploadZones.uploadCedula.getFile();
    if (!fileCedula) {
      const zoneEl = document.getElementById('uploadCedula');
      if (zoneEl) zoneEl.classList.add('has-error');
      throw new Error('Debes adjuntar la cedula del arrendatario en formato PDF');
    }

    const form = document.getElementById('arrendatarioForm');
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

    const tieneCodeudor = checked('tieneCodeudor');

    const data = {
      nombreBroker: get('nombreBroker'),
      codigoInmueble: get('codigoInmueble'),
      nombre: get('nombre'),
      cedula: get('cedula'),
      telefono: get('telefono'),
      email: get('email'),
      direccion: get('direccion'),
      estadoCivil: radio('estadoCivil'),
      tieneCodeudor,
      codeudorNombre: tieneCodeudor ? get('codeudorNombre') : '',
      codeudorCedula: tieneCodeudor ? get('codeudorCedula') : '',
      codeudorDireccion: tieneCodeudor ? get('codeudorDireccion') : '',
      codeudorTelefono: tieneCodeudor ? get('codeudorTelefono') : '',
      codeudorEmail: tieneCodeudor ? get('codeudorEmail') : ''
    };

    const files = { cedula: fileCedula };
    const codeudorFile = uploadZones.uploadCedulaCodeudor && uploadZones.uploadCedulaCodeudor.getFile();
    if (tieneCodeudor && codeudorFile) {
      files.cedulaCodeudor = codeudorFile;
    }

    const formData = buildFormData(data, files);
    const result = await submitForm('/api/arrendatario', formData);
    hideLoading();
    showConfirmation({
      tipo: 'Arrendatario',
      id: result.id,
      nombre: data.nombre
    });
  }
});
