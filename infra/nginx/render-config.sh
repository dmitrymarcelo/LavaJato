#!/bin/sh
set -eu

APP_DOMAIN="${APP_DOMAIN:-localhost}"
TEMPLATE_DIR="/etc/nginx/templates"
TARGET_FILE="/etc/nginx/conf.d/default.conf"
CERT_DIR="/etc/letsencrypt/live/${APP_DOMAIN}"

if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
  envsubst '${APP_DOMAIN}' < "${TEMPLATE_DIR}/https.conf.template" > "${TARGET_FILE}"
else
  envsubst '${APP_DOMAIN}' < "${TEMPLATE_DIR}/http.conf.template" > "${TARGET_FILE}"
fi
