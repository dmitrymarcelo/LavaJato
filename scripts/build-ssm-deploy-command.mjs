const deploySha = process.env.DEPLOY_SHA || process.env.GITHUB_SHA;

if (!deploySha) {
  throw new Error('DEPLOY_SHA ou GITHUB_SHA deve estar definido para gerar o payload do deploy.');
}

const deployScript = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  `DEPLOY_SHA="${deploySha}"`,
  'cd /opt/lavajato/app',
  'git checkout -- HANDOFF.md || true',
  'rm -f AGENTS.md SKILLS.md',
  'git fetch origin',
  'git checkout main',
  'git pull --ff-only origin main',
  'CURRENT_SHA="$(git rev-parse HEAD)"',
  'echo "Repository SHA: ${CURRENT_SHA}"',
  'if [ "${CURRENT_SHA}" != "${DEPLOY_SHA}" ]; then',
  '  echo "Repository SHA mismatch. Expected ${DEPLOY_SHA}, got ${CURRENT_SHA}."',
  '  exit 1',
  'fi',
  'TOKEN="$(curl -fsS -X PUT \'http://169.254.169.254/latest/api/token\' -H \'X-aws-ec2-metadata-token-ttl-seconds: 21600\')"',
  'PUBLIC_IP="$(curl -fsSH "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4)"',
  'APP_DOMAIN="${PUBLIC_IP//./-}.sslip.io"',
  'HTTPS_CERT_EMAIL="${HTTPS_CERT_EMAIL:-ops@${APP_DOMAIN}}"',
  'echo "Canonical HTTPS domain: ${APP_DOMAIN}"',
  'mkdir -p /opt/lavajato/runtime',
  'mkdir -p .runtime/letsencrypt/conf .runtime/letsencrypt/www',
  'cp HANDOFF.md /opt/lavajato/runtime/HANDOFF_AWS.md',
  'cp AGENTS.md /opt/lavajato/runtime/AGENTS_AWS.md',
  'cp SKILLS.md /opt/lavajato/runtime/SKILLS_AWS.md',
  'export APP_BUILD_SHA="${DEPLOY_SHA}"',
  'export APP_DOMAIN',
  'docker compose build api web',
  'docker compose up -d --force-recreate api web',
  'docker compose run --rm certbot certonly --webroot --webroot-path /var/www/certbot --non-interactive --agree-tos --keep-until-expiring --cert-name "${APP_DOMAIN}" --email "${HTTPS_CERT_EMAIL}" -d "${APP_DOMAIN}"',
  'docker compose exec -T web /usr/local/bin/render-nginx-config.sh',
  'docker compose exec -T web nginx -s reload',
  'install -m 755 infra/aws/renew-https.sh /usr/local/bin/lavajato-renew-https.sh',
  'cat <<CRON >/etc/cron.d/lavajato-https-renew',
  'SHELL=/bin/bash',
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'HTTPS_CERT_EMAIL=${HTTPS_CERT_EMAIL}',
  '17 3 * * * root /usr/local/bin/lavajato-renew-https.sh >> /var/log/lavajato-https-renew.log 2>&1',
  'CRON',
  'chmod 644 /etc/cron.d/lavajato-https-renew',
  'systemctl enable --now crond || true',
  'for attempt in $(seq 1 18); do',
  '  if curl -fsS --resolve "${APP_DOMAIN}:443:127.0.0.1" "https://${APP_DOMAIN}/" | grep -F "app-build-sha" | grep -F "${DEPLOY_SHA}" > /dev/null; then',
  '    echo "Frontend serving deployed SHA ${DEPLOY_SHA} over HTTPS."',
  '    break',
  '  fi',
  '  if [ "${attempt}" -eq 18 ]; then',
  '    echo "Frontend did not serve deployed SHA ${DEPLOY_SHA} over HTTPS after deploy."',
  '    curl -kfsS --resolve "${APP_DOMAIN}:443:127.0.0.1" "https://${APP_DOMAIN}/" || true',
  '    exit 1',
  '  fi',
  '  sleep 5',
  'done',
  'docker compose ps',
  'curl -fsS --resolve "${APP_DOMAIN}:443:127.0.0.1" "https://${APP_DOMAIN}/api/health"',
].join('\n');

const commandPayload = {
  commands: [
    `cat <<'SCRIPT' >/tmp/lavajato-deploy.sh\n${deployScript}\nSCRIPT`,
    'bash /tmp/lavajato-deploy.sh',
  ],
};

process.stdout.write(JSON.stringify(commandPayload));
