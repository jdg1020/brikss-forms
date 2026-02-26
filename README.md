# BRIKSS Forms

Sistema de gestion documental para BRIKSS Inmobiliaria. Permite a compradores, vendedores y arrendatarios subir sus documentos de forma facil y rapida.

## Caracteristicas

- **3 flujos completos**: Comprador (3 pasos), Vendedor (6 pasos), Arriendo (6 pasos)
- **Drag & Drop** para archivos PDF
- **Validacion en tiempo real** de todos los campos
- **Subida a Google Drive** automatica con estructura de carpetas
- **Registro centralizado en Google Sheets** de todos los formularios
- **Emails de confirmacion** HTML estilizados
- **Diseno responsive** mobile-first
- **Accesibilidad** con ARIA labels y navegacion por teclado

## Requisitos

- Node.js 18+
- npm o yarn

## Instalacion

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd brikss-forms

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
# (ver secciones de configuracion abajo)

# Iniciar en modo desarrollo
npm run dev

# O en modo produccion
npm start
```

El servidor estara disponible en `http://localhost:3000`

## Configuracion de Google APIs (Drive + Sheets)

Se usa una **Cuenta de Servicio (Service Account)** para conectar con Google Drive y Sheets. Este metodo no expira y no requiere flujo OAuth interactivo.

### Paso 1: Crear proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Haz clic en **Seleccionar proyecto** > **Nuevo proyecto**
3. Nombre: `BRIKSS Forms` > **Crear**
4. Asegurate de que el proyecto quede seleccionado en la barra superior

### Paso 2: Habilitar las APIs necesarias

1. Ve al menu hamburguesa > **APIs y servicios** > **Biblioteca**
2. Busca y habilita estas dos APIs:
   - **Google Drive API** — clic en **Habilitar**
   - **Google Sheets API** — clic en **Habilitar**

### Paso 3: Crear Cuenta de Servicio

1. Ve a **APIs y servicios** > **Credenciales**
2. Haz clic en **Crear credenciales** > **Cuenta de servicio**
3. Nombre: `brikss-forms-server`
4. Haz clic en **Crear y continuar**
5. En **Rol**, puedes dejarlo vacio (no necesita roles de proyecto) > **Continuar** > **Listo**

### Paso 4: Descargar clave JSON

1. En la lista de cuentas de servicio, haz clic en la que acabas de crear
2. Ve a la pestana **Claves**
3. Haz clic en **Agregar clave** > **Crear clave nueva**
4. Formato: **JSON** > **Crear**
5. Se descargara un archivo `.json` — **guardalo como `service-account.json`** en la raiz del proyecto (`brikss-forms/service-account.json`)

> **IMPORTANTE**: Este archivo contiene credenciales privadas. Nunca lo subas a Git. Ya esta incluido en `.gitignore`.

### Paso 5: Crear carpeta raiz en Google Drive

1. Ve a [Google Drive](https://drive.google.com/)
2. Crea una carpeta llamada **"BRIKSS Forms"**
3. Abre la carpeta
4. **Comparte la carpeta** con el email de la cuenta de servicio:
   - Haz clic derecho > **Compartir**
   - Pega el email de la cuenta de servicio (tiene formato `brikss-forms-server@tu-proyecto.iam.gserviceaccount.com`)
   - Dale permisos de **Editor**
5. En la URL veras: `https://drive.google.com/drive/folders/XXXXXXXXX`
6. Copia el ID (la parte `XXXXXXXXX`) al campo `GOOGLE_DRIVE_FOLDER_ID` en `.env`

### Paso 6: Crear el Google Sheet centralizado

1. Ve a [Google Sheets](https://sheets.google.com/) y crea un nuevo spreadsheet
2. Nombralo **"BRIKSS Forms - Registro"**
3. **Comparte el spreadsheet** con el email de la cuenta de servicio:
   - Haz clic en **Compartir**
   - Pega el mismo email de la cuenta de servicio
   - Dale permisos de **Editor**
4. En la URL veras: `https://docs.google.com/spreadsheets/d/XXXXXXXXX/edit`
5. Copia el ID (la parte `XXXXXXXXX`) al campo `GOOGLE_SHEET_ID` en `.env`
6. Los encabezados se crearan automaticamente al recibir el primer formulario

### Paso 7: Configurar el archivo .env

```bash
cp .env.example .env
```

Abre `.env` y llena estos campos:

```
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json
GOOGLE_DRIVE_FOLDER_ID=id_carpeta_brikss_forms
GOOGLE_SHEET_ID=id_spreadsheet_aqui
```

> Si no configuras las credenciales de Google, los archivos se guardan localmente en `uploads/` y los datos se imprimen en la consola del servidor.

## Configuracion de Email

### Gmail con App Password

1. Ve a [Google Account > App Passwords](https://myaccount.google.com/apppasswords)
2. Genera una contrasena de aplicacion para "Correo"
3. Copia la contrasena generada al campo `EMAIL_PASSWORD` en `.env`
4. Configura `EMAIL_USER` con tu email de Gmail

> Si no configuras el email, se simulara el envio en la consola del servidor.

## Estructura del Proyecto

```
brikss-forms/
├── public/                    # Archivos estaticos (frontend)
│   ├── index.html             # Pagina principal
│   ├── comprador.html         # Flujo comprador (3 pasos)
│   ├── vendedor.html          # Flujo vendedor (6 pasos)
│   ├── arriendo.html          # Flujo arriendo (6 pasos)
│   ├── css/styles.css         # Estilos BRIKSS
│   ├── js/
│   │   ├── utils.js           # Utilidades compartidas
│   │   ├── comprador.js       # Logica comprador
│   │   ├── vendedor.js        # Logica vendedor
│   │   └── arriendo.js        # Logica arriendo
│   └── assets/                # Logo y recursos
├── server/
│   ├── index.js               # Servidor Express
│   ├── routes/                # Rutas API
│   ├── controllers/           # Controladores
│   ├── services/              # Servicios (Drive, Sheets, Email)
│   └── config/                # Configuraciones
├── uploads/                   # Archivos temporales
├── package.json
├── .env.example
└── README.md
```

## API Endpoints

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/comprador` | Enviar formulario de comprador |
| POST | `/api/vendedor` | Enviar formulario de vendedor |
| POST | `/api/arriendo` | Enviar formulario de arriendo |
| GET | `/api/health` | Verificar estado del servidor |

## Estructura en Google Drive

```
BRIKSS Forms/
├── Compradores/
│   └── Juan Perez - COMP-20260226-001/
│       ├── formulario.json
│       ├── cedula.pdf
│       └── metadata.json
├── Vendedores/
│   └── Maria Lopez - VEND-20260226-001/
│       ├── formulario.json
│       ├── tradicion.pdf
│       ├── bancaria.pdf
│       ├── cedula.pdf
│       ├── rut.pdf
│       └── metadata.json
└── Arriendos/
    └── Pedro Garcia - Ana Torres - ARR-20260226-001/
        ├── formulario.json
        ├── cedulaArrendador.pdf
        ├── cedulaArrendatario.pdf
        ├── tradicion.pdf
        └── metadata.json
```

## Google Sheets - Registro Centralizado

Todos los formularios se registran en un solo Google Sheet con las siguientes columnas:

| Columna | Descripcion |
|---------|-------------|
| Fecha | Fecha y hora del envio |
| Tipo | Comprador, Vendedor o Arriendo |
| ID Referencia | COMP-20260226-001, VEND-..., ARR-... |
| Nombre Completo | Nombre de quien envia |
| Cedula, Celular, Email | Datos de contacto |
| Datos del inmueble | Direccion, ciudad, edificio, etc. |
| Datos de arriendo | Arrendador, arrendatario, canon, duracion |
| Carpeta Drive | Link directo a la carpeta en Google Drive |
| Documentos Subidos | Lista de PDFs recibidos |

## Licencia

Propiedad de BRIKSS Inmobiliaria. Todos los derechos reservados.
