/**
 * Configuracion de email para BRIKSS Forms
 */

module.exports = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || ''
  },
  from: process.env.EMAIL_FROM || '"BRIKSS Inmobiliaria" <notifications@brikss.com>'
};
