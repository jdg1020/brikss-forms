/**
 * Script para generar el Refresh Token de Google OAuth2
 *
 * Uso:
 *   1. Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el .env
 *   2. Ejecuta: node scripts/generate-token.js
 *   3. Se abrira una URL en la consola - copiala y abrela en tu navegador
 *   4. Inicia sesion y acepta los permisos
 *   5. Google te redirigira a localhost y el token se captura automaticamente
 */

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n  ERROR: Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el archivo .env antes de ejecutar este script.\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('\n========================================');
console.log('  Generador de Refresh Token - BRIKSS');
console.log('========================================\n');
console.log('  IMPORTANTE: Antes de continuar, asegurate de que en');
console.log('  Google Cloud Console > Credenciales > tu Client OAuth,');
console.log('  tengas esta URI de redireccionamiento autorizada:\n');
console.log(`  ${REDIRECT_URI}\n`);
console.log('  Luego abre esta URL en tu navegador:\n');
console.log(`  ${authUrl}\n`);
console.log('  Esperando autorizacion...\n');

// Servidor temporal para capturar el callback
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/oauth2callback') {
    const code = parsedUrl.query.code;

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Error</h1><p>No se recibio codigo de autorizacion.</p>');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1 style="color:#171735">Token generado exitosamente</h1>
          <p>Ya puedes cerrar esta ventana y volver a la terminal.</p>
        </body></html>
      `);

      console.log('\n========================================');
      console.log('  TOKEN GENERADO EXITOSAMENTE');
      console.log('========================================\n');
      console.log('  Pega esta linea en tu archivo .env:\n');
      console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      console.log('========================================\n');

      server.close();
      process.exit(0);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Error</h1><p>${err.message}</p>`);
      console.error('\n  ERROR al obtener el token:', err.message);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(PORT, () => {
  console.log(`  Servidor escuchando en http://localhost:${PORT}`);
});
