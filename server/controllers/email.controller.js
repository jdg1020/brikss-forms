/**
 * Controlador de email
 * Funcionalidad adicional para reenvio y verificacion de emails
 */

const emailService = require('../services/email.service');

/**
 * Reenviar email de confirmacion
 */
async function resendConfirmation(req, res, next) {
  try {
    const { email, nombre, tipo, id } = req.body;

    if (!email || !nombre || !tipo || !id) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos: email, nombre, tipo, id'
      });
    }

    await emailService.sendConfirmation({
      to: email,
      nombre,
      tipo,
      id,
      fecha: new Date().toLocaleDateString('es-CO')
    });

    res.json({
      success: true,
      message: 'Email de confirmacion reenviado'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { resendConfirmation };
