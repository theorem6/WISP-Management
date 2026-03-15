#!/bin/bash
# =============================================================================
# WISPTools - Distributed Architecture: API Node Installation
# =============================================================================
# Run this on each server that will run the WISPTools backend API (main-api + epc-api).
# In the full distributed setup:
#   - Frontend: Firebase Hosting (deployed from your machine via firebase deploy)
#   - Auth/Proxy: Firebase Cloud Functions (apiProxy to this node)
#   - Database: MongoDB Atlas (external)
#   - API nodes: One or more servers running this script
#
# Usage:
#   sudo bash scripts/install/distributed-api-node.sh [install_dir]
#   Default install_dir: /opt/lte-pci-mapper
#
# Env (optional): WISPTOOLS_REPO_URL, NODE_VERSION
# After install: configure backend-services/.env (MONGODB_URI, INTERNAL_API_KEY,
# FIREBASE_*, API_BASE_URL). Then start PM2 as in single-machine.
# =============================================================================

set -e

INSTALL_DIR="${1:-/opt/lte-pci-mapper}"
REPO_URL="${WISPTOOLS_REPO_URL:-https://github.com/theorem6/WISP-Management.git}"
NODE_VERSION="${NODE_VERSION:-20}"

echo "═══════════════════════════════════════════════════════════"
echo "  WISPTools - Distributed API Node"
echo "  Install directory: $INSTALL_DIR"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Reuse single-machine install steps (system deps, Node, PM2, clone, npm install)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SINGLE_SCRIPT="$SCRIPT_DIR/single-machine.sh"
if [ -f "$SINGLE_SCRIPT" ]; then
  echo "Running single-machine install steps..."
  bash "$SINGLE_SCRIPT" "$INSTALL_DIR"
else
  echo "single-machine.sh not found. Run from repo: bash scripts/install/distributed-api-node.sh $INSTALL_DIR"
  exit 1
fi

echo ""
echo "This node is ready to act as an API server in a distributed setup."
echo "Ensure Firebase Cloud Functions (apiProxy) point to this host's URL:port (e.g. http://THIS_IP:3001)."
echo "See docs/installation/INSTALLATION.md for the full distributed architecture."
echo ""
