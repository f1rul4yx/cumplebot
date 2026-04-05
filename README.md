# cumplebot

Servicio web para enviar felicitaciones de cumpleaños automáticas por WhatsApp.

## Requisitos

- Node.js 20+
- Chromium (para whatsapp-web.js)

## Instalación

```bash
git clone https://github.com/f1rul4yx/cumplebot.git
cd cumplebot
cp config/.env.example config/.env
sudo ./install.sh
```

Editar `config/.env` con los datos de tu entorno antes de instalar:

```
PORT=3000
TZ=Europe/Madrid
AUTH_USER=admin
AUTH_PASS=cumplebot
DEFAULT_COUNTRY_CODE=34
```

## Uso

Accede a `http://TU_IP:3000` e inicia sesión con las credenciales de `config/.env`.

Ve a la sección **WhatsApp**, escanea el QR con tu móvil y empieza a añadir contactos.

## Desinstalación

```bash
sudo ./remove.sh
```

## Funcionalidades

- Dashboard con cumpleaños de hoy y próximos 30 días
- Gestión de contactos con mensajes personalizados
- Grupos para organizar contactos
- Plantillas de mensaje con variable `{nombre}`
- Recordatorios configurables (X días antes)
- Historial de mensajes enviados
- Hora de envío configurable
- Envío de prueba para verificar la conexión
- Autenticación por contraseña
- Interfaz responsive
