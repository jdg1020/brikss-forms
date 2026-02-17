/**
 * Servicio de Email para BRIKSS Forms
 * Envia emails de confirmacion usando Nodemailer
 */

const nodemailer = require('nodemailer');
const emailConfig = require('../config/email.config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Inicializar transportador de email
   */
  init() {
    if (this.initialized) return;

    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      console.warn('[Email] Credenciales de email no configuradas. Los emails no se enviaran.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth
    });

    this.initialized = true;
    console.log('[Email] Servicio de email inicializado');
  }

  /**
   * Generar template HTML del email de confirmacion
   */
  generateConfirmationHTML({ nombre, tipo, id, fecha }) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f7fafc; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #1a365d, #2a4a7f); color: white; padding: 2rem; text-align: center; }
    .header h1 { margin: 0; font-size: 1.8rem; letter-spacing: -0.02em; }
    .header p { margin: 0.5rem 0 0; opacity: 0.8; font-size: 0.9rem; }
    .content { padding: 2rem; }
    .content h2 { color: #1a365d; font-size: 1.3rem; margin-top: 0; }
    .content p { color: #4a5568; line-height: 1.7; }
    .details { background: #f7fafc; border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; border-left: 4px solid #ff6b35; }
    .details-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; }
    .details-row:last-child { border-bottom: none; }
    .details-label { color: #718096; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .details-value { color: #2d3748; font-weight: 600; }
    .button { display: inline-block; background: #ff6b35; color: white; padding: 0.875rem 2rem; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 1rem; margin-top: 1rem; }
    .footer { background: #1a365d; color: rgba(255,255,255,0.7); padding: 1.5rem 2rem; text-align: center; font-size: 0.8rem; }
    .footer a { color: #ff6b35; text-decoration: none; }
    .footer p { margin: 0.25rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>BRIKSS Inmobiliaria</h1>
      <p>Gestion Documental</p>
    </div>
    <div class="content">
      <h2>Documentos Recibidos Exitosamente</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Hemos recibido exitosamente tus documentos. Nuestro equipo los revisara y se pondra en contacto contigo a la brevedad.</p>
      <div class="details">
        <div class="details-row">
          <span class="details-label">Tipo de Tramite</span>
          <span class="details-value">${tipo}</span>
        </div>
        <div class="details-row">
          <span class="details-label">ID de Referencia</span>
          <span class="details-value">${id}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Fecha</span>
          <span class="details-value">${fecha}</span>
        </div>
      </div>
      <p>Guarda tu ID de referencia <strong>${id}</strong> para cualquier consulta futura.</p>
      <p style="text-align: center;">
        <a href="https://www.brikss.com" class="button" target="_blank">Visitar BRIKSS</a>
      </p>
    </div>
    <div class="footer">
      <p><strong>BRIKSS Inmobiliaria</strong></p>
      <p>+57 315 857 4462 | <a href="mailto:contacto@brikss.com">contacto@brikss.com</a></p>
      <p>Cra. 15 #98 42 of 505, Bogota</p>
      <p style="margin-top: 1rem;">&copy; 2025 BRIKSS. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Enviar email de confirmacion
   */
  async sendConfirmation({ to, nombre, tipo, id, fecha }) {
    this.init();

    if (!this.transporter) {
      console.log(`[Email] Simulacion de envio a ${to}:`);
      console.log(`  Tipo: ${tipo} | ID: ${id} | Nombre: ${nombre}`);
      return { simulated: true };
    }

    const htmlContent = this.generateConfirmationHTML({ nombre, tipo, id, fecha });

    const info = await this.transporter.sendMail({
      from: emailConfig.from,
      to,
      subject: `BRIKSS - Documentos Recibidos (${tipo}) - Ref: ${id}`,
      html: htmlContent,
      text: `Hola ${nombre},\n\nHemos recibido exitosamente tus documentos.\n\nTipo: ${tipo}\nID: ${id}\nFecha: ${fecha}\n\nNos pondremos en contacto pronto.\n\nBRIKSS Inmobiliaria\n+57 315 857 4462`
    });

    console.log(`[Email] Confirmacion enviada a ${to}: ${info.messageId}`);
    return info;
  }
}

module.exports = new EmailService();
