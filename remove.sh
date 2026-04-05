#!/bin/bash
# =========================================
# CumpleBot — Desinstalación
# Autor: Diego Vargas
# Versión: 1.0
# =========================================

RESET="\e[0m"
ROJO="\e[31m"
VERDE="\e[32m"

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

# Función: Desinstalar todo
remove_all() {
  systemctl stop cumplebot.service &>/dev/null
  systemctl disable cumplebot.service &>/dev/null
  rm -f /etc/systemd/system/cumplebot.service
  systemctl daemon-reload &>/dev/null
  rm -rf /opt/cumplebot
  echo -e "${VERDE}[+] CumpleBot desinstalado correctamente.${RESET}"
}

# -----------------------------------------
# PROGRAMA
# -----------------------------------------

verification_root
remove_all
