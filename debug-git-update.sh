#!/bin/bash
# Debug script for git update - paste this into SSH on the remote EPC agent
# This mimics what the auto-update system generates
# Run with: sudo bash debug-git-update.sh

CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [DEBUG-GIT-UPDATE] $1" | sudo tee -a "$LOG_FILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [DEBUG-GIT-UPDATE] $1" >&2
}

log "========================================="
log "Starting git update debug script"
log "========================================="

# Configuration - GITHUB_TOKEN must be set in env or /opt/wisptools/.env
if [ -z "$GITHUB_TOKEN" ] && [ -f /opt/wisptools/.env ]; then
  source /opt/wisptools/.env 2>/dev/null || true
fi
if [ -z "$GITHUB_TOKEN" ]; then
  log "ERROR: GITHUB_TOKEN not set. Set in env or /opt/wisptools/.env"
  exit 1
fi
GIT_REPO_BRANCH="main"
GIT_REPO_DIR="/opt/wisptools/repo"
SCRIPTS_SOURCE_DIR="${GIT_REPO_DIR}/backend-services/scripts"
GIT_REPO_URL="https://${GITHUB_TOKEN}@github.com/theorem6/WISP-Management.git"

log "Configuration:"
log "  GIT_REPO_URL: https://***@github.com/theorem6/WISP-Management.git"
log "  GIT_REPO_BRANCH: ${GIT_REPO_BRANCH}"
log "  GIT_REPO_DIR: ${GIT_REPO_DIR}"
log "  SCRIPTS_SOURCE_DIR: ${SCRIPTS_SOURCE_DIR}"

# Ensure git is installed
if ! command -v git >/dev/null 2>&1; then
    log "Installing git..."
    sudo apt-get update -qq >/dev/null 2>&1
    sudo apt-get install -y git >/dev/null 2>&1 || {
        log "ERROR: Failed to install git"
        exit 1
    }
fi

log "Git version: $(git --version)"

# Configure Git for HTTPS with token authentication
log "Configuring Git for HTTPS with token authentication..."
export GIT_TERMINAL_PROMPT=0
git config --global credential.helper '' 2>&1 | while read line; do log "config: $line"; done
git config --global http.sslVerify true 2>&1 | while read line; do log "config: $line"; done

log "Current git config credential.helper: $(git config --global credential.helper)"
log "Current git config http.sslVerify: $(git config --global http.sslVerify)"

# Scripts to download
SCRIPTS_TO_UPDATE=(
    "backend-services/scripts/epc-checkin-agent.sh"
    "backend-services/scripts/epc-snmp-discovery.sh"
    "backend-services/scripts/epc-snmp-discovery.js"
    "backend-services/scripts/epc-ping-monitor.js"
)

if [ ! -d "${GIT_REPO_DIR}" ]; then
    log "Initializing NEW git repository with sparse checkout..."
    sudo mkdir -p "${GIT_REPO_DIR}"
    cd "${GIT_REPO_DIR}" || exit 1
    sudo chown -R $USER:$USER "${GIT_REPO_DIR}" 2>/dev/null || sudo chown -R $(whoami):$(whoami) "${GIT_REPO_DIR}" 2>/dev/null || true
    
    log "Running: git init"
    git init 2>&1 | while read line; do log "init: $line"; done
    
    log "Running: git config core.sparseCheckout true"
    git config core.sparseCheckout true 2>&1 | while read line; do log "config: $line"; done
    git config core.sparseCheckoutCone false 2>&1 | while read line; do log "config: $line"; done
    
    log "Setting up sparse checkout paths..."
    mkdir -p .git/info
    {
        for script in "${SCRIPTS_TO_UPDATE[@]}"; do
            echo "$script"
        done
    } > .git/info/sparse-checkout
    
    log "Sparse checkout paths:"
    cat .git/info/sparse-checkout | while read line; do log "  - $line"; done
    
    log "Removing any existing remote..."
    git remote remove origin >/dev/null 2>&1 || log "No existing remote to remove"
    
    log "Adding remote: ${GIT_REPO_URL}"
    git remote add origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "remote-add: $line"; done
    
    log "Current remote URL: $(git remote get-url origin 2>/dev/null || echo 'none')"
    
    log "Fetching from git repository (depth 1, branch ${GIT_REPO_BRANCH})..."
    git fetch --depth 1 origin "${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "fetch: $line"; done
    FETCH_EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $FETCH_EXIT_CODE -ne 0 ]; then
        log "ERROR: Git fetch failed with exit code $FETCH_EXIT_CODE"
        log "Testing authentication manually..."
        log "Running: git ls-remote --heads ${GIT_REPO_URL}"
        git ls-remote --heads "${GIT_REPO_URL}" 2>&1 | head -5 | while read line; do log "ls-remote: $line"; done
        exit 1
    fi
    
    log "Checking out branch ${GIT_REPO_BRANCH}..."
    git checkout -b "${GIT_REPO_BRANCH}" "origin/${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "checkout: $line"; done
    CHECKOUT_EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $CHECKOUT_EXIT_CODE -ne 0 ]; then
        log "ERROR: Git checkout failed with exit code $CHECKOUT_EXIT_CODE"
        log "Available branches/refs:"
        git branch -a 2>&1 | while read line; do log "  branch: $line"; done
        exit 1
    fi
    
    log "Verifying files were checked out..."
    if [ -d "${SCRIPTS_SOURCE_DIR}" ]; then
        log "Scripts directory exists: ${SCRIPTS_SOURCE_DIR}"
        ls -la "${SCRIPTS_SOURCE_DIR}" | while read line; do log "  $line"; done
    else
        log "ERROR: Scripts directory does not exist: ${SCRIPTS_SOURCE_DIR}"
        log "Current directory contents:"
        find "${GIT_REPO_DIR}" -type f 2>/dev/null | head -20 | while read line; do log "  $line"; done
        exit 1
    fi
else
    log "Updating EXISTING git repository (sparse checkout)..."
    cd "${GIT_REPO_DIR}" || exit 1
    sudo chown -R $USER:$USER "${GIT_REPO_DIR}" 2>/dev/null || sudo chown -R $(whoami):$(whoami) "${GIT_REPO_DIR}" 2>/dev/null || true
    
    log "Current directory: $(pwd)"
    log "Current remote URL: $(git remote get-url origin 2>/dev/null || echo 'none')"
    
    # Configure Git for HTTPS with token (ALWAYS, in case config was changed)
    export GIT_TERMINAL_PROMPT=0
    git config --global credential.helper '' 2>&1 | while read line; do log "config: $line"; done
    git config --global http.sslVerify true 2>&1 | while read line; do log "config: $line"; done
    
    # Check current remote - if it's SSH or wrong, force recreate
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "none")
    log "Current remote URL: $CURRENT_REMOTE"
    
    if [[ "$CURRENT_REMOTE" != *"https://"* ]] || [[ "$CURRENT_REMOTE" != *"@github.com"* ]] || [[ "$CURRENT_REMOTE" == *"git@github.com"* ]]; then
        log "WARNING: Existing remote is incorrect: $CURRENT_REMOTE"
        log "Removing old remote and setting up HTTPS with token..."
        git remote remove origin >/dev/null 2>&1 || log "Failed to remove remote (may not exist)"
    fi
    
    # Ensure remote exists with correct URL
    if ! git remote get-url origin >/dev/null 2>&1; then
        log "Adding git remote with HTTPS token authentication..."
        git remote add origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "remote-add: $line"; done
    else
        log "Updating existing remote URL..."
        git remote set-url origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "remote-set-url: $line"; done
    fi
    
    # Verify remote URL is correct
    VERIFIED_REMOTE=$(git remote get-url origin 2>/dev/null || echo "none")
    log "Verified remote URL: ${VERIFIED_REMOTE}"
    
    # Update sparse checkout paths if needed
    log "Updating sparse checkout paths..."
    mkdir -p .git/info
    {
        for script in "${SCRIPTS_TO_UPDATE[@]}"; do
            echo "$script"
        done
    } > .git/info/sparse-checkout
    
    log "Sparse checkout paths:"
    cat .git/info/sparse-checkout | while read line; do log "  - $line"; done
    
    log "Fetching latest changes (sparse checkout with HTTPS token)..."
    git fetch --depth 1 origin "${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "fetch: $line"; done
    FETCH_EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $FETCH_EXIT_CODE -ne 0 ]; then
        log "ERROR: Git fetch failed (exit code: $FETCH_EXIT_CODE)"
        log "Testing authentication manually..."
        log "Running: git ls-remote --heads ${GIT_REPO_URL}"
        git ls-remote --heads "${GIT_REPO_URL}" 2>&1 | head -10 | while read line; do log "ls-remote: $line"; done
        
        log "Attempting to fix repository..."
        git remote remove origin >/dev/null 2>&1 || true
        git remote add origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "remote-add: $line"; done
        
        log "Retrying git fetch..."
        git fetch --depth 1 origin "${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "fetch-retry: $line"; done
        FETCH_EXIT_CODE=${PIPESTATUS[0]}
        
        if [ $FETCH_EXIT_CODE -ne 0 ]; then
            log "ERROR: Git fetch still failed after retry"
            log "ERROR: Token authentication may have failed or repository URL is incorrect"
            log "ERROR: Repository URL should be: ${GIT_REPO_URL}"
            log "Testing network connectivity..."
            ping -c 2 github.com 2>&1 | while read line; do log "ping: $line"; done
            exit 1
        fi
    fi
    
    log "Checking out updated files..."
    git checkout -f "origin/${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "checkout: $line"; done
    git sparse-checkout reapply 2>&1 | while read line; do log "sparse-checkout: $line"; done
    
    log "Verifying files after checkout..."
    if [ -d "${SCRIPTS_SOURCE_DIR}" ]; then
        log "Scripts directory exists: ${SCRIPTS_SOURCE_DIR}"
        ls -la "${SCRIPTS_SOURCE_DIR}" | while read line; do log "  $line"; done
    else
        log "ERROR: Scripts directory does not exist: ${SCRIPTS_SOURCE_DIR}"
        log "Repository structure:"
        find "${GIT_REPO_DIR}" -type d -maxdepth 3 2>/dev/null | while read line; do log "  dir: $line"; done
        exit 1
    fi
    
    log "Git repository updated successfully"
fi

# Copy updated scripts from repository
log "========================================="
log "Copying scripts to /opt/wisptools/"
log "========================================="

if [ -d "${SCRIPTS_SOURCE_DIR}" ]; then
    for script_path in "${SCRIPTS_TO_UPDATE[@]}"; do
        script_name=$(basename "$script_path")
        source_file="${SCRIPTS_SOURCE_DIR}/${script_name}"
        dest_file="/opt/wisptools/${script_name}"
        
        if [ -f "${source_file}" ]; then
            log "Copying ${script_name}..."
            sudo cp "${source_file}" "${dest_file}"
            sudo chmod +x "${dest_file}"
            log "✅ Copied ${script_name} to ${dest_file}"
        else
            log "WARNING: ${script_name} not found in repository at ${source_file}"
        fi
    done
else
    log "ERROR: Scripts directory not found in repository: ${SCRIPTS_SOURCE_DIR}"
    log "Repository contents:"
    find "${GIT_REPO_DIR}" -type f 2>/dev/null | head -30 | while read line; do log "  $line"; done
    exit 1
fi

log "========================================="
log "Git update debug script completed"
log "========================================="

