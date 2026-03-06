#!/bin/bash
set -euxo pipefail
exec > >(tee /var/log/lavajato-bootstrap.log | logger -t lavajato-bootstrap -s 2>/dev/console) 2>&1

APP_DIR=/opt/lavajato
REPO_URL=https://github.com/dmitrymarcelo/LavaJato.git
BRANCH=main

echo "[1/8] Instalando dependencias do host"
dnf update -y
dnf install -y git nginx nodejs npm

echo "[2/8] Preparando diretorio da aplicacao"
mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

if [ ! -d app ]; then
  git clone "${REPO_URL}" app
fi

cd app
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[3/8] Instalando dependencias do projeto"
npm ci

echo "[4/8] Gerando build de producao"
npm run build

echo "[5/8] Publicando arquivos estaticos"
rm -rf /usr/share/nginx/html/*
cp -r dist/* /usr/share/nginx/html/

echo "[6/8] Configurando Nginx para SPA"
cat >/etc/nginx/conf.d/lavajato.conf <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

rm -f /etc/nginx/conf.d/default.conf || true

echo "[7/8] Habilitando servicos"
systemctl enable nginx
systemctl restart nginx

echo "[8/8] Finalizando"
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: ${TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Aplicacao publicada em http://${PUBLIC_IP}/"
