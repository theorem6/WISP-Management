#!/usr/bin/env bash
# First-time packages + nginx HTTP reverse proxy for HSS backend (Node on 3001/3002).
# Run on the GCE VM as the SSH user (not necessarily root). TLS: certbot after DNS points here.
set -euo pipefail

if [[ ${EUID:-0} -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
export DEBIAN_FRONTEND=noninteractive

$SUDO apt-get update -qq
$SUDO apt-get install -y curl ca-certificates gnupg nginx

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null || echo v0)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  $SUDO npm install -g pm2
fi

BACKEND_DIR=/opt/lte-pci-mapper/backend-services
$SUDO mkdir -p "$BACKEND_DIR" /var/www/html
$SUDO chown -R "$(whoami):$(whoami)" /opt/lte-pci-mapper

$SUDO tee /etc/nginx/sites-available/hss-backend >/dev/null <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name hss.wisptools.io _;
    client_max_body_size 32m;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:3001/health;
    }

    location / {
        return 204;
    }
}
NGINX

$SUDO ln -sf /etc/nginx/sites-available/hss-backend /etc/nginx/sites-enabled/hss-backend
$SUDO rm -f /etc/nginx/sites-enabled/default
$SUDO nginx -t
$SUDO systemctl enable nginx
$SUDO systemctl reload nginx

echo "Bootstrap OK. Backend dir: $BACKEND_DIR - copy .env with MONGODB_URI, then deploy."
