/**
 * Validacion de archivos PDF por magic bytes.
 * Un PDF valido empieza con la firma "%PDF-" (0x25 0x50 0x44 0x46 0x2D).
 */

const fs = require('fs');

const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF-

/**
 * Verifica que el archivo en filePath comience con la firma PDF.
 * Lanza si no es un PDF real (independiente del mimetype enviado por el cliente).
 */
function assertPdf(filePath, label = 'archivo') {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    const bytesRead = fs.readSync(fd, buf, 0, 5, 0);
    if (bytesRead < 5 || !buf.equals(PDF_SIGNATURE)) {
      const err = new Error(`El ${label} no es un PDF válido`);
      err.statusCode = 400;
      throw err;
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = { assertPdf };
