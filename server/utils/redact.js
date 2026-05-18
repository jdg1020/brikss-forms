/**
 * Redaccion ligera de PII para logs.
 * No es criptografia: solo evita imprimir emails completos en stdout (visible en
 * dashboards de hosting).
 */

function redactEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.length > 1 ? local[0] : '*';
  return `${head}***@${domain}`;
}

module.exports = { redactEmail };
