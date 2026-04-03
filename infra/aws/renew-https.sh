#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/lavajato/app"
cd "${APP_ROOT}"

TOKEN="$(curl -fsS -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')"
PUBLIC_IP="$(curl -fsSH "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4)"
APP_HOST="$(printf '%s' "${PUBLIC_IP}" | tr '.' '-').sslip.io"
APP_CERT_NAME="${APP_HOST}"
HTTPS_CERT_EMAIL="${HTTPS_CERT_EMAIL:-}"

mkdir -p .runtime/letsencrypt/conf .runtime/letsencrypt/www
export APP_HOST
export APP_CERT_NAME

CERTBOT_RENEW_ARGS=(--keep-until-expiring)
CURRENT_CERT_PATH=".runtime/letsencrypt/conf/live/${APP_CERT_NAME}/cert.pem"
if [ ! -f "${CURRENT_CERT_PATH}" ] || ! openssl x509 -checkend 86400 -noout -in "${CURRENT_CERT_PATH}" >/dev/null 2>&1; then
  CERTBOT_RENEW_ARGS=(--force-renewal)
fi

CERTBOT_CONTACT_ARGS=()
if printf '%s' "${HTTPS_CERT_EMAIL}" | grep -Eq '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'; then
  CERTBOT_CONTACT_ARGS=(--email "${HTTPS_CERT_EMAIL}")
else
  CERTBOT_CONTACT_ARGS=(--register-unsafely-without-email)
fi

docker compose up -d web >/dev/null
docker compose exec -T web nginx -t
docker compose run --rm certbot certonly \
  --preferred-profile shortlived \
  --webroot \
  --webroot-path /var/www/certbot \
  --non-interactive \
  --agree-tos \
  --cert-name "${APP_CERT_NAME}" \
  "${CERTBOT_RENEW_ARGS[@]}" \
  "${CERTBOT_CONTACT_ARGS[@]}" \
  -d "${APP_HOST}"

docker compose exec -T web /usr/local/bin/render-nginx-config.sh
docker compose exec -T web nginx -t
docker compose exec -T web nginx -s reload
