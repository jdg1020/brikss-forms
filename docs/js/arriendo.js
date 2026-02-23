/**
 * BRIKSS Forms - Arriendo (Version Estatica con EmailJS)
 * Logica del formulario de arriendo de 6 pasos
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Inicializar validaciones automaticas ──────────────
  initAutoValidation();

  // ── 2. Configurar zonas de carga de archivos ─────────────
  const uploadCedulaArrendador = setupUploadZone(
    document.getElementById('uploadCedulaArrendador'),
    { fieldName: 'cedulaArrendador' }
  );

  const uploadCedulaArrendatario = setupUploadZone(
    document.getElementById('uploadCedulaArrendatario'),
    { fieldName: 'cedulaArrendatario' }
  );

  const uploadTradicion = setupUploadZone(
    document.getElementById('uploadTradicion'),
    { fieldName: 'tradicion' }
  );

  const uploadCedulaCodeudor = setupUploadZone(
    document.getElementById('uploadCedulaCodeudor'),
    { fieldName: 'cedulaCodeudor' }
  );

  // ── 3. Formato de moneda en campos financieros ───────────
  const canonInput = document.getElementById('canon');
  const depositoInput = document.getElementById('deposito');
  const clausulaPenalInput = document.getElementById('clausulaPenal');

  if (canonInput) formatCurrency(canonInput);
  if (depositoInput) formatCurrency(depositoInput);
  if (clausulaPenalInput) formatCurrency(clausulaPenalInput);

  // ── 4. Crear el FormWizard ───────────────────────────────
  const wizard = new FormWizard({
    formId: 'arriendoForm',
    onSubmit: handleSubmit
  });

  // ── 5. Botones de navegacion ─────────────────────────────
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnSubmit = document.getElementById('btnSubmit');

  function updateNavButtons() {
    const isFirst = wizard.currentStep === 0;
    const isLast = wizard.currentStep === wizard.totalSteps - 1;

    btnPrev.style.display = isFirst ? 'none' : '';
    btnNext.style.display = isLast ? 'none' : '';
    btnSubmit.style.display = isLast ? '' : 'none';
  }

  btnNext.addEventListener('click', () => {
    if (wizard.next()) {
      updateNavButtons();
    }
  });

  btnPrev.addEventListener('click', () => {
    if (wizard.prev()) {
      updateNavButtons();
    }
  });

  btnSubmit.addEventListener('click', () => {
    wizard.submit();
  });

  updateNavButtons();

  // ── 6. Estilos de radio y checkbox seleccionados ─────────
  document.querySelectorAll('.radio-option input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const groupName = radio.name;
      document.querySelectorAll(`.radio-option input[name="${groupName}"]`).forEach(r => {
        r.closest('.radio-option').classList.remove('selected');
      });
      radio.closest('.radio-option').classList.add('selected');

      const group = radio.closest('[data-radio-required]');
      if (group) {
        group.classList.remove('is-invalid');
      }
    });
  });

  document.querySelectorAll('.checkbox-option input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      checkbox.closest('.checkbox-option').classList.toggle('selected', checkbox.checked);
    });
  });

  // ── 7. Seccion condicional del codeudor ──────────────────
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

  // ── 8. Envio del formulario ──────────────────────────────
  async function handleSubmit() {
    // Validar archivos requeridos
    const fileCedulaArrendador = uploadCedulaArrendador.getFile();
    const fileCedulaArrendatario = uploadCedulaArrendatario.getFile();
    const fileTradicion = uploadTradicion.getFile();

    const missingFiles = [];
    if (!fileCedulaArrendador) missingFiles.push('Cedula Arrendador');
    if (!fileCedulaArrendatario) missingFiles.push('Cedula Arrendatario');
    if (!fileTradicion) missingFiles.push('Certificado Tradicion y Libertad');

    if (missingFiles.length > 0) {
      hideLoading();
      showToast('Faltan documentos requeridos: ' + missingFiles.join(', '), 'error', 5000);
      throw new Error('Documentos requeridos faltantes');
    }

    // Recopilar datos de todos los pasos
    const form = document.getElementById('arriendoForm');
    const arrendadorNombre = document.getElementById('arrendadorNombre').value.trim();
    const arrendatarioNombre = document.getElementById('arrendatarioNombre').value.trim();
    const refId = generateRefId('ARR');

    const data = {
      refId: refId,
      tipo: 'Arriendo',

      // Arrendador
      arrendadorNombre: arrendadorNombre,
      arrendadorCedula: document.getElementById('arrendadorCedula').value.trim(),
      arrendadorDireccion: document.getElementById('arrendadorDireccion').value.trim(),
      arrendadorTelefono: document.getElementById('arrendadorTelefono').value.trim(),
      arrendadorEmail: document.getElementById('arrendadorEmail').value.trim(),
      arrendadorEstadoCivil: (form.querySelector('input[name="arrendadorEstadoCivil"]:checked') || {}).value || '',

      // Arrendatario
      arrendatarioNombre: arrendatarioNombre,
      arrendatarioCedula: document.getElementById('arrendatarioCedula').value.trim(),
      arrendatarioDireccion: document.getElementById('arrendatarioDireccion').value.trim(),
      arrendatarioTelefono: document.getElementById('arrendatarioTelefono').value.trim(),
      arrendatarioEmail: document.getElementById('arrendatarioEmail').value.trim(),
      arrendatarioEstadoCivil: (form.querySelector('input[name="arrendatarioEstadoCivil"]:checked') || {}).value || '',

      // Inmueble
      inmuebleDireccion: document.getElementById('inmuebleDireccion').value.trim(),
      matricula: document.getElementById('matricula').value.trim(),
      estrato: document.getElementById('estrato').value,
      tipoInmueble: document.getElementById('tipoInmueble').value,
      area: document.getElementById('area').value,
      habitaciones: document.getElementById('habitaciones').value,
      banos: document.getElementById('banos').value,
      garajes: document.getElementById('garajes').value,
      inventario: document.getElementById('inventario').value.trim(),
      usoDestinado: (form.querySelector('input[name="usoDestinado"]:checked') || {}).value || '',

      // Economia
      canon: document.getElementById('canon').value.trim(),
      diaPago: document.getElementById('diaPago').value,
      formaPagoArriendo: (form.querySelector('input[name="formaPagoArriendo"]:checked') || {}).value || '',
      incremento: document.getElementById('incremento').value,
      deposito: document.getElementById('deposito').value.trim(),
      serviciosPaga: (form.querySelector('input[name="serviciosPaga"]:checked') || {}).value || '',
      adminPaga: (form.querySelector('input[name="adminPaga"]:checked') || {}).value || '',

      // Contrato
      fechaInicio: document.getElementById('fechaInicio').value,
      duracion: document.getElementById('duracion').value,
      renovacionAuto: document.getElementById('renovacionAuto').checked,
      causalesTerminacion: document.getElementById('causalesTerminacion').value.trim(),
      clausulaPenal: document.getElementById('clausulaPenal').value.trim(),
      noMascotas: document.getElementById('noMascotas').checked,
      noModificaciones: document.getElementById('noModificaciones').checked,
      noSubarriendo: document.getElementById('noSubarriendo').checked,

      // Codeudor
      tieneCodeudor: document.getElementById('tieneCodeudor').checked,
      codeudorNombre: document.getElementById('codeudorNombre').value.trim(),
      codeudorCedula: document.getElementById('codeudorCedula').value.trim(),
      codeudorDireccion: document.getElementById('codeudorDireccion').value.trim(),
      codeudorTelefono: document.getElementById('codeudorTelefono').value.trim(),
      codeudorEmail: document.getElementById('codeudorEmail').value.trim()
    };

    // Lista de archivos
    const filesList = [];
    if (fileCedulaArrendador) {
      filesList.push({
        label: 'Cedula Arrendador',
        name: fileCedulaArrendador.name,
        size: formatFileSize(fileCedulaArrendador.size)
      });
    }
    if (fileCedulaArrendatario) {
      filesList.push({
        label: 'Cedula Arrendatario',
        name: fileCedulaArrendatario.name,
        size: formatFileSize(fileCedulaArrendatario.size)
      });
    }
    if (fileTradicion) {
      filesList.push({
        label: 'Certificado Tradicion',
        name: fileTradicion.name,
        size: formatFileSize(fileTradicion.size)
      });
    }
    const fileCedulaCodeudor = uploadCedulaCodeudor.getFile();
    if (fileCedulaCodeudor) {
      filesList.push({
        label: 'Cedula Codeudor',
        name: fileCedulaCodeudor.name,
        size: formatFileSize(fileCedulaCodeudor.size)
      });
    }

    try {
      const result = await sendFormViaEmail({
        formType: 'Arriendo',
        data: data,
        filesList: filesList,
        clientEmail: data.arrendadorEmail,
        clientName: arrendadorNombre + ' / ' + arrendatarioNombre
      });

      hideLoading();
      showConfirmation({
        tipo: 'Arriendo',
        id: result.id,
        nombre: arrendadorNombre + ' / ' + arrendatarioNombre
      });
    } catch (error) {
      hideLoading();
      showToast('Error al enviar: ' + error.message, 'error');
    }
  }

});
