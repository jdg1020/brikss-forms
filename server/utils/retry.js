/**
 * Reintento con backoff exponencial para llamadas HTTP a Google APIs.
 * Solo reintenta en errores transitorios (red, rate limit, 5xx).
 */

const TRANSIENT_HTTP_CODES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_NET_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'
]);

function isTransient(err) {
  if (!err) return false;
  const status = err.code || err.status || (err.response && err.response.status);
  if (typeof status === 'number' && TRANSIENT_HTTP_CODES.has(status)) return true;
  if (typeof status === 'string' && TRANSIENT_NET_CODES.has(status)) return true;
  return false;
}

async function withRetry(fn, { attempts = 3, baseMs = 500, label = 'op' } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isTransient(err)) throw err;
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 100);
      console.warn(`[retry] ${label} fallo (intento ${i + 1}/${attempts}): ${err.message}. Reintentando en ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

module.exports = { withRetry, isTransient };
