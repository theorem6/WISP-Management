#!/bin/bash
# Update Backend Services from GitHub
# This script pulls latest code from GitHub and restarts services
# Run with: sudo bash scripts/deployment/update-backend-from-git.sh

set -e

REPO_DIR="/opt/lte-pci-mapper"
BACKEND_DIR="$REPO_DIR/backend-services"

echo "🔄 Updating backend from GitHub..."
echo ""

# GitHub token for private repository access (required – set in env or .env)
# Do not commit tokens. Use: export GITHUB_TOKEN=ghp_... or add to /opt/lte-pci-mapper/.env
if [ -z "$GITHUB_TOKEN" ]; then
  if [ -f "$REPO_DIR/.env" ]; then
    source "$REPO_DIR/.env" 2>/dev/null || true
  fi
fi
if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN is not set. Set it in the environment or in $REPO_DIR/.env"
  echo "   Example: export GITHUB_TOKEN=ghp_xxxxxxxx"
  exit 1
fi
GIT_REPO_URL="https://${GITHUB_TOKEN}@github.com/theorem6/WISP-Management.git"

# Check if repo exists
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "📥 Initializing git repository..."
  cd "$REPO_DIR"
  git init
  # Use HTTPS URL with token for private repository
  git remote add origin "$GIT_REPO_URL" 2>/dev/null || git remote set-url origin "$GIT_REPO_URL"
  git config user.name "GCE Server"
  git config user.email "server@wisptools.io"
  # Add all existing files
  git add -A
  git commit -m "Initial commit from server" || true
  echo "✅ Git repository initialized"
fi

echo "📥 Pulling latest code from GitHub..."
cd "$REPO_DIR"

# Ensure remote is using HTTPS with token
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$CURRENT_REMOTE" != *"${GITHUB_TOKEN}@github.com"* ]]; then
  echo "🔄 Updating remote to use HTTPS with token..."
  git remote set-url origin "$GIT_REPO_URL"
fi

# Configure Git to not prompt for credentials
export GIT_TERMINAL_PROMPT=0
git config --global credential.helper ''

git fetch origin main || {
  echo "⚠️  Could not fetch from GitHub (may require token authentication)"
  echo "📋 Current code will be used. To sync manually:"
  echo "   1. Check GITHUB_TOKEN environment variable is set"
  echo "   2. Commit current changes: git add -A && git commit -m 'Server state'"
  echo "   3. Pull from GitHub: git pull origin main"
  exit 0
}

# Try to merge/pull
git pull origin main --no-edit || {
  echo "⚠️  Pull failed, resetting to GitHub state..."
  git fetch origin main
  git reset --hard origin/main
}

echo "✅ Code updated from GitHub"
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ Backend directory not found: $BACKEND_DIR"
  exit 1
fi

# Install dependencies if package.json changed
echo "📦 Checking for dependency updates..."
cd "$BACKEND_DIR"
if [ -f "package.json" ]; then
  npm install --production --silent || {
    echo "⚠️  npm install had warnings, but continuing..."
  }
fi

echo ""
echo "🔧 Checking nginx configuration for ISO downloads..."

# Check if SSL cert exists and nginx needs updating
if [ -f /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem ]; then
  echo "  - SSL certificate found"
  
  # Check if nginx config has /downloads/ location properly configured
  if ! grep -q "location /downloads/" /etc/nginx/sites-enabled/* 2>/dev/null; then
    echo "  - Updating nginx config for ISO downloads..."
    
    # Run the fix script if it exists
    if [ -f "$BACKEND_DIR/scripts/fix-nginx-ssl.sh" ]; then
      bash "$BACKEND_DIR/scripts/fix-nginx-ssl.sh" || echo "⚠️  nginx config update had issues, continuing..."
    else
      echo "  - Fix script not found, manually checking config..."
      # Check if the proper config exists
      if [ -f "$BACKEND_DIR/scripts/nginx-ssl-config.conf" ]; then
        cp "$BACKEND_DIR/scripts/nginx-ssl-config.conf" /etc/nginx/sites-available/hss.wisptools.io
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null
        ln -sf /etc/nginx/sites-available/hss.wisptools.io /etc/nginx/sites-enabled/
        nginx -t && systemctl reload nginx
        echo "  ✅ nginx config updated"
      fi
    fi
  else
    echo "  ✅ nginx already configured for downloads"
  fi
else
  echo "  ⚠️  SSL certificate not found - ISO downloads may not work over HTTPS"
fi

echo ""
echo "🔄 Restarting backend services..."

# Restart EPC API (port 3002)
if pm2 list | grep -q "epc-api"; then
  echo "  - Restarting epc-api..."
  pm2 restart epc-api --update-env
else
  echo "  - Starting epc-api..."
  cd "$BACKEND_DIR"
  PORT=3002 pm2 start min-epc-server.js --name epc-api
fi

# Restart HSS API (port 3001)
if pm2 list | grep -q "hss-api"; then
  echo "  - Restarting hss-api..."
  pm2 restart hss-api --update-env
fi

# Restart Main API (port 3000) if exists
if pm2 list | grep -q "main-api"; then
  echo "  - Restarting main-api..."
  pm2 restart main-api --update-env
fi

echo ""
echo "✅ Backend services updated and restarted"
echo ""
echo "📊 Service status:"
pm2 status
echo ""
echo "📝 Latest commit:"
cd "$REPO_DIR"
git log -1 --oneline
echo ""
echo "✅ Deployment complete!"

