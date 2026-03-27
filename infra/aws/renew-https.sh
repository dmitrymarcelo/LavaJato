#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/lavajato/app"
cd "${APP_ROOT}"

TOKEN="$(curl -fsS -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')"
PUBLIC_IP="$(curl -fsSH "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4)"
APP_DOMAIN="${PUBLIC_IP//./-}.sslip.io"
HTTPS_CERT_EMAIL="${HTTPS_CERT_EMAIL:-ops@${APP_DOMAIN}}"

mkdir -p .runtime/letsencrypt/conf .runtime/letsencrypt/www
export APP_DOMAIN

docker compose up -d web >/dev/null
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --non-interactive \
  --agree-tos \
  --keep-until-expiring \
  --cert-name "${APP_DOMAIN}" \
  --email "${HTTPS_CERT_EMAIL}" \
  -d "${APP_DOMAIN}"

docker compose exec -T web /usr/local/bin/render-nginx-config.sh
docker compose exec -T web nginx -s reload
