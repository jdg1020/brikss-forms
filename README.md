# BRIKSS Forms

Sistema de gestion documental para BRIKSS Inmobiliaria. Permite a compradores, vendedores y arrendatarios subir sus documentos de forma facil y rapida.

## Caracteristicas

- **3 flujos completos**: Comprador (3 pasos), Vendedor (8 pasos), Arriendo (6 pasos)
- **Drag & Drop** para archivos PDF
- **Validacion en tiempo real** de todos los campos
- **Subida a Google Drive** automatica con estructura de carpetas
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

## Configuracion de Google Drive API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Drive API**
4. Ve a **Credenciales** > **Crear credenciales** > **ID de cliente OAuth 2.0**
5. Tipo: Aplicacion web
6. URI de redireccionamiento: `http://localhost:3000/oauth2callback`
7. Copia el Client ID y Client Secret al archivo `.env`

### Obtener el Refresh Token

```bash
# Usa el OAuth Playground de Google:
# https://developers.google.com/oauthplayground/

# 1. Configura el engranaje (settings) con tu Client ID y Secret
# 2. En Step 1, selecciona "Drive API v3" > todos los scopes
# 3. Autoriza y obtiene el refresh token en Step 2
# 4. Copia el refresh token al .env
```

### Crear la carpeta raiz en Drive

1. Crea una carpeta "BRIKSS Forms" en tu Google Drive
2. Copia el ID de la carpeta (de la URL) al campo `DRIVE_FOLDER_ID` en `.env`

> Si no configuras Google Drive, los archivos se guardan localmente en `uploads/`

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
│   ├── vendedor.html          # Flujo vendedor (8 pasos)
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
│   ├── services/              # Servicios (Drive, Email)
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
│   └── COMP-20260217-001_Juan_Perez/
│       ├── formulario.json
│       ├── cedula.pdf
│       └── metadata.json
├── Vendedores/
│   └── VEND-20260217-001_Maria_Lopez/
│       ├── formulario.json
│       ├── cedula.pdf
│       ├── certificado_tradicion.pdf
│       ├── certificacion_bancaria.pdf
│       ├── rut.pdf
│       ├── paz_salvo.pdf
│       └── metadata.json
└── Arriendos/
    └── ARR-20260217-001_Pedro-Ana/
        ├── formulario.json
        ├── cedula_arrendador.pdf
        ├── cedula_arrendatario.pdf
        ├── certificado_tradicion.pdf
        └── metadata.json
```

## Licencia

Propiedad de BRIKSS Inmobiliaria. Todos los derechos reservados.
