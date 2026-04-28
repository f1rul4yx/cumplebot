# cumplebot

Servicio web para enviar felicitaciones de cumpleaños automáticas por WhatsApp.

## Qué es

Panel web que se conecta a WhatsApp para enviar mensajes de cumpleaños de forma automática. Gestiona contactos, grupos y plantillas de mensaje, y los envía a la hora configurada.

## Instalación

```bash
git clone https://github.com/f1rul4yx/cumplebot.git
cd cumplebot
```

Las variables de entorno se configuran en el `docker-compose.yml`:

| Variable | Por defecto | Descripción |
|---|---|---|
| `AUTH_USER` | `admin` | Usuario de acceso |
| `AUTH_PASS` | `cumplebot` | Contraseña de acceso |
| `TZ` | `Europe/Madrid` | Zona horaria |
| `DEFAULT_COUNTRY_CODE` | `34` | Prefijo telefónico sin `+` |
| `PORT` | `3000` | Puerto del servidor |

## Uso

```bash
docker compose up -d
```

Accede a `http://TU_IP:3000` e inicia sesión (usuario `admin`, contraseña `cumplebot` por defecto).

Ve a la sección **WhatsApp**, escanea el QR con tu móvil y empieza a añadir contactos.

```bash
docker compose down       # Parar
docker compose restart    # Reiniciar
docker compose logs -f    # Ver logs
```

## Build

```bash
docker build -t f1rul4yx/cumplebot:latest ./build
docker push f1rul4yx/cumplebot:latest
```
