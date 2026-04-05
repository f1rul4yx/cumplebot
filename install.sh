#!/bin/bash
# =========================================
# CumpleBot — Instalación
# Autor: Diego Vargas
# Versión: 1.0
# =========================================

RESET="\e[0m"
ROJO="\e[31m"
VERDE="\e[32m"
AMARILLO="\e[33m"
AZUL="\e[34m"

APP_DIR="/opt/cumplebot"

# -----------------------------------------
# FUNCIONES DEFINIDAS
# -----------------------------------------

# Función: Comprobación root
verification_root() {
  if [[ "$EUID" -ne 0 ]]; then
    echo -e "${ROJO}[-] Este script se debe ejecutar con permisos de root.${RESET}"
    exit 1
  fi
}

# Función: Comprobar configuración
check_config() {
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [[ ! -f "$SCRIPT_DIR/config/.env" ]]; then
    echo -e "${ROJO}[-] No se encontró config/.env${RESET}"
    echo -e "${AMARILLO}[!] Copia config/.env.example a config/.env y edítalo antes de instalar.${RESET}"
    exit 1
  fi
}

# Función: Instalar Node.js 20
install_nodejs() {
  if command -v node &>/dev/null; then
    echo -e "${AZUL}[i] Node.js ya está instalado.${RESET}"
  else
    echo -e "${AMARILLO}[!] Instalando Node.js 20...${RESET}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install nodejs -y
    echo -e "${VERDE}[+] Node.js instalado.${RESET}"
  fi
}

# Función: Instalar Chromium
install_chromium() {
  if command -v chromium-browser &>/dev/null || command -v chromium &>/dev/null; then
    echo -e "${AZUL}[i] Chromium ya está instalado.${RESET}"
  else
    echo -e "${AMARILLO}[!] Instalando Chromium y dependencias...${RESET}"
    apt install chromium fonts-liberation libgbm1 libasound2 libatk-bridge2.0-0 libdrm2 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 -y
    echo -e "${VERDE}[+] Chromium instalado.${RESET}"
  fi
}

# Función: Copiar archivos
copy_files() {
  echo -e "${AZUL}[i] Copiando archivos a $APP_DIR...${RESET}"
  mkdir -p "$APP_DIR/data"
  cp -r "$SCRIPT_DIR/scripts" "$APP_DIR/"
  cp -r "$SCRIPT_DIR/public" "$APP_DIR/"
  cp -r "$SCRIPT_DIR/config" "$APP_DIR/"
  cp "$SCRIPT_DIR/package.json" "$APP_DIR/"
}

# Función: Instalar dependencias npm
install_deps() {
  echo -e "${AZUL}[i] Instalando dependencias npm...${RESET}"
  cd "$APP_DIR"
  export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
  NPM_BIN=$(which npm 2>/dev/null || echo "/usr/bin/npm")
  if [[ ! -x "$NPM_BIN" ]]; then
    echo -e "${ROJO}[-] npm no encontrado. Instalando...${RESET}"
    apt install npm -y
    NPM_BIN=$(which npm)
  fi
  "$NPM_BIN" install --production
  echo -e "${VERDE}[+] Dependencias instaladas.${RESET}"
}

# Función: Detectar ruta de Chromium
detect_chromium() {
  CHROMIUM_PATH=$(grep "^CHROMIUM_PATH=" "$APP_DIR/config/.env" | cut -d'=' -f2)
  if [[ -z "$CHROMIUM_PATH" ]]; then
    CHROMIUM_PATH=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || echo "/usr/bin/chromium")
    sed -i "s|^CHROMIUM_PATH=.*|CHROMIUM_PATH=$CHROMIUM_PATH|" "$APP_DIR/config/.env"
    echo -e "${AZUL}[i] Chromium detectado en: $CHROMIUM_PATH${RESET}"
  fi
}

# Función: Crear servicio systemd
create_service() {
  echo -e "${AZUL}[i] Creando servicio systemd...${RESET}"

  source "$APP_DIR/config/.env"

  cat > /etc/systemd/system/cumplebot.service << EOF
[Unit]
Description=CumpleBot — Felicitaciones WhatsApp
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
Environment=PUPPETEER_EXECUTABLE_PATH=${CHROMIUM_PATH}
ExecStart=/usr/bin/node scripts/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable cumplebot --now
}

# -----------------------------------------
# PROGRAMA
# -----------------------------------------

verification_root
check_config
install_nodejs
install_chromium
copy_files
install_deps
detect_chromium
create_service

IP=$(hostname -I | awk '{print $1}')
PORT=$(grep "^PORT=" "$APP_DIR/config/.env" | cut -d'=' -f2)
PORT=${PORT:-3000}

echo ""
echo -e "${VERDE}=========================================${RESET}"
echo -e "${VERDE}  [+] CumpleBot instalado correctamente  ${RESET}"
echo -e "${VERDE}=========================================${RESET}"
echo ""
echo -e "  ${AZUL}[i] Accede a: http://${IP}:${PORT}${RESET}"
echo ""
echo -e "  Comandos útiles:"
echo -e "    systemctl status cumplebot"
echo -e "    systemctl restart cumplebot"
echo -e "    journalctl -u cumplebot -f"
echo ""
