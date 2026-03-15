#!/bin/bash
# =============================================================================
# WISPTools - Single-Machine Installation
# =============================================================================
# Runs the full backend (main-api + epc-api) on one Linux server.
# Use for: dev, staging, or small production where one VM runs everything.
#
# Prerequisites: Ubuntu 20.04/22.04 or Debian 11+ (root or sudo).
# MongoDB: Use MongoDB Atlas (set MONGODB_URI in .env) or install locally.
#
# Usage:
#   sudo bash scripts/install/single-machine.sh [install_dir]
#   Default install_dir: /opt/lte-pci-mapper
#
# After install: copy backend-services/.env.example to backend-services/.env
# and set MONGODB_URI, INTERNAL_API_KEY, and optional FIREBASE_* / API_BASE_URL.
# Then: cd backend-services && pm2 start ecosystem.config.js && pm2 save
# =============================================================================

set -e

INSTALL_DIR="${1:-/opt/lte-pci-mapper}"
REPO_URL="${WISPTOOLS_REPO_URL:-https://github.com/theorem6/WISP-Management.git}"
NODE_VERSION="${NODE_VERSION:-20}"

echo "═══════════════════════════════════════════════════════════"
echo "  WISPTools - Single-Machine Installation"
echo "  Install directory: $INSTALL_DIR"
echo "═══════════════════════════════════════════════════════════"
echo ""

# -----------------------------------------------------------------------------
# 1. System dependencies
# -----------------------------------------------------------------------------
echo "[1/5] Installing system dependencies..."
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq curl git ca-certificates build-essential
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl git ca-certificates
else
  echo "Unsupported package manager (apt-get or yum required)."
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Node.js (LTS)
# -----------------------------------------------------------------------------
echo "[2/5] Installing Node.js ${NODE_VERSION}..."
NEED_NODE=0
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
else
  VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  [ -z "$VER" ] && NEED_NODE=1
  [ -n "$VER" ] && [ "$VER" -lt 18 ] && NEED_NODE=1
  [ "$NEED_NODE" -eq 0 ] && echo "  Node.js $(node -v) already installed."
fi
if [ "$NEED_NODE" -eq 1 ]; then
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      ubuntu|debian)
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
        apt-get install -y nodejs
        ;;
      *)
        echo "  Add NodeSource for your OS: https://nodejs.org/en/download/package-manager/"
        exit 1
        ;;
    esac
  fi
fi
node -v
npm -v

# -----------------------------------------------------------------------------
# 3. PM2 (process manager)
# -----------------------------------------------------------------------------
echo "[3/5] Installing PM2..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
pm2 -v

# -----------------------------------------------------------------------------
# 4. Clone or update repository
# -----------------------------------------------------------------------------
echo "[4/5] Cloning/updating WISPTools repository..."
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git remote set-url origin "$REPO_URL" 2>/dev/null || true
  git fetch origin main
  git reset --hard origin/main
  git pull origin main --no-edit || true
else
  if [ -d "$INSTALL_DIR" ] && [ "$(ls -A $INSTALL_DIR 2>/dev/null)" ]; then
    echo "  Directory $INSTALL_DIR exists and is not a git repo. Backup and remove it, or use another path."
    exit 1
  fi
  git clone --depth 1 --branch main "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# -----------------------------------------------------------------------------
# 5. Backend dependencies and env template
# -----------------------------------------------------------------------------
echo "[5/5] Installing backend dependencies..."
cd "$INSTALL_DIR/backend-services"
if [ ! -f package.json ]; then
  echo "  backend-services/package.json not found. Bad clone?"
  exit 1
fi
npm install --production

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "  Created backend-services/.env from .env.example. Edit .env and set:"
    echo "    MONGODB_URI, INTERNAL_API_KEY, FIREBASE_PROJECT_ID (and optional FIREBASE_SERVICE_ACCOUNT_*)"
  else
    echo "  No .env found. Create backend-services/.env with MONGODB_URI and INTERNAL_API_KEY."
  fi
else
  echo "  .env already exists; leaving unchanged."
fi

# -----------------------------------------------------------------------------
# Start services (user must have .env configured)
# -----------------------------------------------------------------------------
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Installation complete."
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Edit $INSTALL_DIR/backend-services/.env"
echo "     Set at least: MONGODB_URI, INTERNAL_API_KEY"
echo "  2. Start services:"
echo "     cd $INSTALL_DIR/backend-services"
echo "     pm2 start ecosystem.config.js"
echo "     pm2 save"
echo "     pm2 startup   # optional: start on boot"
echo "  3. Health check: curl http://localhost:3001/health"
echo ""
echo "To update later: sudo bash scripts/deployment/update-backend-from-git.sh"
echo "  (from $INSTALL_DIR; set GITHUB_TOKEN if repo is private)"
echo ""
