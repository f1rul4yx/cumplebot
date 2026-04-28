# cumplebot

Servicio web para enviar felicitaciones de cumpleaños automáticas por WhatsApp.

## Uso

```bash
docker compose up -d
```

Accede a `http://TU_IP:3000` e inicia sesión (usuario `admin`, contraseña `cumplebot` por defecto).

Ve a la sección **WhatsApp**, escanea el QR con tu móvil y empieza a añadir contactos.

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `AUTH_USER` | `admin` | Usuario de acceso |
| `AUTH_PASS` | `cumplebot` | Contraseña de acceso |
| `TZ` | `Europe/Madrid` | Zona horaria |
| `DEFAULT_COUNTRY_CODE` | `34` | Prefijo telefónico sin `+` |
| `PORT` | `3000` | Puerto del servidor |

## Construcción de la imagen

```bash
docker build -t f1rul4yx/cumplebot:latest ./build
docker push f1rul4yx/cumplebot:latest
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
