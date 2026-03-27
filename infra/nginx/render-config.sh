#!/bin/sh
set -eu

APP_HOST="${APP_HOST:-localhost}"
APP_CERT_NAME="${APP_CERT_NAME:-${APP_HOST}}"
TEMPLATE_DIR="/opt/lavajato/nginx"
TARGET_FILE="/etc/nginx/conf.d/default.conf"
CERT_DIR="/etc/letsencrypt/live/${APP_CERT_NAME}"

rm -f /etc/nginx/conf.d/*.conf

if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
  envsubst '${APP_HOST} ${APP_CERT_NAME}' < "${TEMPLATE_DIR}/https.conf.template" > "${TARGET_FILE}"
else
  envsubst '${APP_HOST} ${APP_CERT_NAME}' < "${TEMPLATE_DIR}/http.conf.template" > "${TARGET_FILE}"
fi
