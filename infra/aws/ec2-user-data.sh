#!/bin/bash
set -euxo pipefail
exec > >(tee /var/log/lavajato-bootstrap.log | logger -t lavajato-bootstrap -s 2>/dev/console) 2>&1

APP_DIR=/opt/lavajato
REPO_URL=https://github.com/dmitrymarcelo/LavaJato.git
BRANCH=main

echo "[1/7] Instalando dependencias do host"
dnf update -y
dnf install -y docker git
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL https://github.com/docker/compose/releases/download/v2.39.4/docker-compose-linux-x86_64 \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "[2/7] Preparando diretorio da aplicacao"
mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

if [ ! -d app ]; then
  git clone "${REPO_URL}" app
fi

cd app
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[3/7] Subindo PostgreSQL + API + Frontend"
docker compose down || true
docker compose up -d --build

echo "[4/7] Aguardando inicializacao"
sleep 45

echo "[5/7] Estado dos containers"
docker compose ps

echo "[6/7] Health checks"
curl -I http://localhost/ || true
curl -I http://localhost/api/health || true

echo "[7/7] Finalizando"
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Aplicacao publicada em http://${PUBLIC_IP}/"
