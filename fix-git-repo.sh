#!/bin/bash
# Fix Git Repository on Remote EPC Device
# Run this on the remote EPC device: sudo bash fix-git-repo.sh

# Don't use set -e - we need to handle errors manually
set +e

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [FIX-GIT-REPO] $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: This script must be run with sudo"
    echo "Usage: sudo bash $0"
    exit 1
fi

log "========================================="
log "Fixing Git Repository"
log "========================================="

GIT_REPO_DIR="/opt/wisptools/repo"
# GITHUB_TOKEN must be set in env or /opt/wisptools/.env - do not hardcode
if [ -z "$GITHUB_TOKEN" ] && [ -f /opt/wisptools/.env ]; then
  source /opt/wisptools/.env 2>/dev/null || true
fi
if [ -z "$GITHUB_TOKEN" ]; then
  log "ERROR: GITHUB_TOKEN not set. Set in env or /opt/wisptools/.env"
  exit 1
fi
GIT_REPO_URL="https://${GITHUB_TOKEN}@github.com/theorem6/WISP-Management.git"
GIT_REPO_BRANCH="main"

# Check if directory exists and if it's a VALID git repository
if [ -d "$GIT_REPO_DIR" ]; then
    log "Directory exists: $GIT_REPO_DIR"
    
    # Change to directory to test if it's a valid git repo
    cd "$GIT_REPO_DIR" 2>/dev/null || {
        log "ERROR: Cannot access $GIT_REPO_DIR"
        exit 1
    }
    
    # Test if this is actually a valid git repository
    if git rev-parse --git-dir >/dev/null 2>&1; then
        log "Directory is already a valid git repository"
    else
        log "WARNING: Directory exists but is NOT a valid git repository"
        log "Removing and recreating..."
        cd / || true
        rm -rf "$GIT_REPO_DIR"
        mkdir -p "$GIT_REPO_DIR"
        cd "$GIT_REPO_DIR"
        log "✅ Directory cleaned"
    fi
else
    log "Creating directory: $GIT_REPO_DIR"
    mkdir -p "$GIT_REPO_DIR"
    cd "$GIT_REPO_DIR"
fi

# Verify we're in the right directory
if [ "$(pwd)" != "$GIT_REPO_DIR" ]; then
    log "ERROR: Failed to change to $GIT_REPO_DIR"
    exit 1
fi

# Initialize git if needed (double check - the .git might not exist even if git recognizes it)
if [ ! -d ".git" ] || ! git rev-parse --git-dir >/dev/null 2>&1; then
    log "Initializing git repository..."
    git init >/dev/null 2>&1 || {
        log "ERROR: Failed to initialize git repository"
        exit 1
    }
    git config core.sparseCheckout true 2>&1 | while read line; do log "$line"; done || true
    git config core.sparseCheckoutCone false 2>&1 | while read line; do log "$line"; done || true
    log "✅ Git repository initialized"
fi

# Configure Git
log "Configuring Git for HTTPS with token authentication..."
export GIT_TERMINAL_PROMPT=0
git config --global credential.helper '' 2>&1 | while read line; do log "$line"; done
git config --global http.sslVerify true 2>&1 | while read line; do log "$line"; done
git config --global --add safe.directory "$GIT_REPO_DIR" 2>&1 | while read line; do log "$line"; done

# Set up remote
log "Configuring git remote..."
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$GIT_REPO_URL" 2>&1 | while read line; do log "$line"; done

log "Remote URL: $(git remote get-url origin 2>/dev/null || echo 'none')"

# Set up sparse checkout for scripts
log "Configuring sparse checkout..."
mkdir -p .git/info
cat > .git/info/sparse-checkout << 'SPARSECHECKOUT'
backend-services/scripts/epc-checkin-agent.sh
backend-services/scripts/epc-snmp-discovery.sh
backend-services/scripts/epc-snmp-discovery.js
backend-services/scripts/epc-ping-monitor.js
SPARSECHECKOUT

log "Sparse checkout configured"

# Fetch and checkout
log "Fetching from repository..."
if git fetch --depth 1 origin "$GIT_REPO_BRANCH" 2>&1 | while read line; do log "fetch: $line"; done; then
    log "Checking out files..."
    if git checkout -b "$GIT_REPO_BRANCH" "origin/${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "checkout: $line"; done; then
        git sparse-checkout reapply 2>&1 | while read line; do log "sparse-checkout: $line"; done || true
        log "✅ Git repository fixed and updated"
        
        # Verify files
        if [ -d "backend-services/scripts" ]; then
            log "✅ Scripts directory exists"
            ls -la backend-services/scripts/ | head -10 | while read line; do log "  $line"; done
        else
            log "WARNING: Scripts directory not found"
        fi
    else
        log "ERROR: Git checkout failed"
        exit 1
    fi
else
    log "ERROR: Git fetch failed"
    exit 1
fi

log "========================================="
log "Git Repository Fix Complete"
log "========================================="

