/**
 * EPC Auto-Update Utility
 * Checks if remote EPC scripts need to be updated and provides download URLs
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const appConfig = require('../config/app');

const SCRIPTS_DIR = '/var/www/html/downloads/scripts';
const CENTRAL_SERVER = 'hss.wisptools.io';

/**
 * Get the SHA256 hash of a file
 */
async function getFileHash(filePath) {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    console.error(`[EPC Auto-Update] Error hashing file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Check if scripts need updating and return update information
 * @param {string} epc_id - The EPC ID
 * @param {Object} currentVersions - Current script versions on the EPC (optional)
 * @returns {Promise<Object>} Update information with script URLs and hashes
 */
async function checkForUpdates(epc_id, currentVersions = {}) {
  const scripts = [
    'epc-checkin-agent.sh',
    'epc-snmp-discovery.sh',
    'epc-snmp-discovery.js',  // Node.js version
    'epc-ping-monitor.js',   // Ping monitoring script
    'epc-snmp-monitor.js'    // SNMP metrics for graphs
  ];
  
  const updates = {};
  
  for (const scriptName of scripts) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    
    try {
      // Check if script exists
      await fs.access(scriptPath);
      
      // Get current hash
      const currentHash = await getFileHash(scriptPath);
      if (!currentHash) {
        console.warn(`[EPC Auto-Update] Failed to hash ${scriptPath}, skipping`);
        continue;
      }
      
      // Get current version from EPC (if provided)
      const currentVersion = currentVersions?.[scriptName] || 
                            (currentVersions?.scripts && currentVersions.scripts[scriptName]) ||
                            null;
      
      // If version doesn't match or doesn't exist, mark for update
      const epcHash = currentVersion?.hash || null;
      
      // Check for updates - if no hash reported or hash differs, update
      // BUT: If hash is reported and matches, skip update (even if file was just updated)
      // SPECIAL CASE: If agent script itself needs updating and no hash is reported,
      // prioritize it since updating the agent will enable hash reporting for other scripts
      if (!epcHash) {
        // No hash reported - EPC might be old version or script doesn't exist
        // For agent script, this is critical - update it first to enable hash reporting
        updates[scriptName] = {
          url: `https://${CENTRAL_SERVER}/downloads/scripts/${scriptName}`,
          hash: currentHash,
          size: (await fs.stat(scriptPath)).size,
          updated: true,
          priority: scriptName === 'epc-checkin-agent.sh' ? 1 : 5 // Agent gets highest priority
        };
        console.log(`[EPC Auto-Update] ${scriptName} needs update (no hash reported). Server: ${currentHash.substring(0, 16)}...`);
      } else if (epcHash !== currentHash) {
        // Hash differs - needs update
        updates[scriptName] = {
          url: `https://${CENTRAL_SERVER}/downloads/scripts/${scriptName}`,
          hash: currentHash,
          size: (await fs.stat(scriptPath)).size,
          updated: true
        };
        console.log(`[EPC Auto-Update] ${scriptName} needs update. EPC: ${epcHash.substring(0, 16)}..., Server: ${currentHash.substring(0, 16)}...`);
      } else {
        // Hash matches - up to date
        console.log(`[EPC Auto-Update] ${scriptName} is up to date (${currentHash.substring(0, 16)}...)`);
      }
    } catch (error) {
      // Script doesn't exist, skip
      console.warn(`[EPC Auto-Update] Script ${scriptName} not found at ${scriptPath}:`, error.message);
    }
  }
  
  // Calculate version hash from all script hashes (deterministic version)
  let versionHash = null;
  if (Object.keys(updates).length > 0) {
    const hash = crypto.createHash('sha256');
    Object.entries(updates).sort().forEach(([scriptName, info]) => {
      hash.update(`${scriptName}:${info.hash}`);
    });
    versionHash = hash.digest('hex').substring(0, 16); // 16 char version
  }
  
  return {
    has_updates: Object.keys(updates).length > 0,
    scripts: updates,
    version: versionHash // Version based on script hashes
  };
}

/**
 * Generate an update command for the EPC using git pull and apt updates
 * @param {Object} updateInfo - Update information from checkForUpdates
 * @param {Object} options - Additional options (apt_packages, etc.)
 * @returns {Object} EPC command to execute
 */
function generateUpdateCommand(updateInfo, options = {}) {
  if (!updateInfo.has_updates && !options.apt_packages) {
    return null;
  }
  
  // GitHub repository configuration
  // Repository is PRIVATE - uses HTTPS with token authentication
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 
                       process.env.GH_TOKEN || 
                       appConfig?.externalServices?.github?.token;
  const GIT_REPO_BRANCH = 'main';
  const GIT_REPO_DIR = '/opt/wisptools/repo';
  const SCRIPTS_SOURCE_DIR = `${GIT_REPO_DIR}/backend-services/scripts`;
  
  // Use HTTPS URL with token for private repository
  if (!GITHUB_TOKEN) {
    console.error('[EPC Auto-Update] GITHUB_TOKEN not set - cannot fetch from private repo');
    return;
  }
  const GIT_REPO_URL = `https://${GITHUB_TOKEN}@github.com/theorem6/WISP-Management.git`;
  console.log('[EPC Auto-Update] Using HTTPS with token authentication for private repository');
  
  // Sort scripts by priority (lower number = higher priority)
  // Agent script should be updated first to enable hash reporting
  const sortedScripts = updateInfo.has_updates ? Object.entries(updateInfo.scripts).sort((a, b) => {
    const priorityA = a[1].priority || 5;
    const priorityB = b[1].priority || 5;
    return priorityA - priorityB;
  }) : [];
  
  // Build git update script using sparse checkout (only downloads needed files)
  let gitUpdateScript = '';
  if (updateInfo.has_updates && sortedScripts.length > 0) {
    // Build list of git paths for sparse checkout (only the scripts we need)
    const gitPaths = sortedScripts.map(([scriptName]) => 
      `backend-services/scripts/${scriptName}`
    );
    
    gitUpdateScript = `
# Ensure git is installed
if ! command -v git >/dev/null 2>&1; then
    log "Installing git..."
    apt-get update -qq >/dev/null 2>&1
    apt-get install -y git >/dev/null 2>&1 || {
        log "ERROR: Failed to install git"
        exit 1
    }
fi

# Configure Git for HTTPS with token authentication
# Repository is PRIVATE - uses HTTPS with token (token embedded in URL)
export GIT_TERMINAL_PROMPT=0
git config --global credential.helper '' 2>&1 | while read line; do log "$line"; done
git config --global http.sslVerify true 2>&1 | while read line; do log "$line"; done
git config --global --add safe.directory "${GIT_REPO_DIR}" 2>&1 | while read line; do log "$line"; done

if [ ! -d "${GIT_REPO_DIR}" ]; then
    log "Initializing git repository with sparse checkout..."
    mkdir -p "${GIT_REPO_DIR}"
    cd "${GIT_REPO_DIR}"
    # Fix ownership to prevent "dubious ownership" errors
    chown -R root:root "${GIT_REPO_DIR}" 2>/dev/null || true
    git init >/dev/null 2>&1
    git config core.sparseCheckout true 2>&1
    git config core.sparseCheckoutCone false 2>&1
    
    # Configure sparse checkout to only download the scripts we need
    mkdir -p .git/info
    cat > .git/info/sparse-checkout << 'SPARSECHECKOUT'
${gitPaths.join('\n')}
SPARSECHECKOUT
    
    # Add remote with HTTPS URL (token embedded)
    git remote remove origin >/dev/null 2>&1 || true
    git remote add origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "$line"; done
    
    log "Fetching only required files from git (sparse checkout with HTTPS token)..."
    git fetch --depth 1 origin "${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "$line"; done
    if [ $? -ne 0 ]; then
        log "ERROR: Failed to fetch from git repository (check token authentication)"
        exit 1
    fi
    
    log "Checking out only required files..."
    git checkout -b "${GIT_REPO_BRANCH}" "origin/${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "$line"; done
    if [ $? -ne 0 ]; then
        log "ERROR: Failed to checkout files from repository"
        exit 1
    fi
else
    log "Updating git repository (sparse checkout)..."
    cd "${GIT_REPO_DIR}" || {
        log "ERROR: Cannot change to ${GIT_REPO_DIR}"
        exit 1
    }
    
    # Check if this is actually a VALID git repository - test if git recognizes it
    if [ ! -d ".git" ] || ! git rev-parse --git-dir >/dev/null 2>&1; then
        log "WARNING: Directory exists but is NOT a valid git repository. Reinitializing..."
        cd /opt/wisptools || exit 1
        rm -rf "${GIT_REPO_DIR}"
        mkdir -p "${GIT_REPO_DIR}"
        cd "${GIT_REPO_DIR}" || exit 1
        git init >/dev/null 2>&1 || {
            log "ERROR: Failed to initialize git repository"
            exit 1
        }
        git config core.sparseCheckout true 2>&1 | while read line; do log "$line"; done || true
        git config core.sparseCheckoutCone false 2>&1 | while read line; do log "$line"; done || true
        log "Git repository reinitialized"
    fi
    
    # Configure Git for HTTPS with token (ALWAYS, in case config was changed)
    export GIT_TERMINAL_PROMPT=0
    git config --global credential.helper '' 2>&1 | while read line; do log "$line"; done
    git config --global http.sslVerify true 2>&1 | while read line; do log "$line"; done
    git config --global --add safe.directory "${GIT_REPO_DIR}" 2>&1 | while read line; do log "$line"; done
    git config --global url."${GIT_REPO_URL}".insteadOf "git@github.com:theorem6/WISP-Management.git" 2>&1 | while read line; do log "$line"; done
    git config --global url."${GIT_REPO_URL}".insteadOf "https://github.com/theorem6/WISP-Management.git" 2>&1 | while read line; do log "$line"; done
    
    # Check current remote - if it's SSH or wrong, force recreate
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "none")
    if [[ "$CURRENT_REMOTE" != *"https://"* ]] || [[ "$CURRENT_REMOTE" != *"@github.com"* ]] || [[ "$CURRENT_REMOTE" == *"git@github.com"* ]]; then
        log "WARNING: Existing remote is incorrect: $CURRENT_REMOTE"
        log "Removing old remote and setting up HTTPS with token..."
        git remote remove origin >/dev/null 2>&1 || true
    fi
    
    # Ensure remote exists with correct URL
    if ! git remote get-url origin >/dev/null 2>&1; then
        log "Adding git remote with HTTPS token authentication..."
        git remote add origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "$line"; done
    else
        # Update existing remote to ensure it's correct
        git remote set-url origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "$line"; done
    fi
    
    # Verify remote URL is correct (for logging)
    VERIFIED_REMOTE=$(git remote get-url origin 2>/dev/null || echo "none")
    log "Git remote URL configured: \\$VERIFIED_REMOTE"
    
    # Update sparse checkout paths if needed (in case new scripts are added)
    mkdir -p .git/info
    cat > .git/info/sparse-checkout << 'SPARSECHECKOUT'
${gitPaths.join('\n')}
SPARSECHECKOUT
    
    log "Fetching latest changes (sparse checkout with HTTPS token)..."
    git fetch --depth 1 origin "${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "$line"; done
    FETCH_EXIT_CODE=$?
    
    if [ $FETCH_EXIT_CODE -ne 0 ]; then
        log "ERROR: Git fetch failed (exit code: $FETCH_EXIT_CODE)"
        log "ERROR: Attempting to fix repository..."
        
        # Try removing and re-adding remote
        git remote remove origin >/dev/null 2>&1 || true
        git remote add origin "${GIT_REPO_URL}" 2>&1 | while read line; do log "$line"; done
        
        # Retry fetch
        log "Retrying git fetch..."
        git fetch --depth 1 origin "${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "$line"; done
        FETCH_EXIT_CODE=$?
        
        if [ $FETCH_EXIT_CODE -ne 0 ]; then
            log "ERROR: Git fetch still failed after retry"
            log "ERROR: Token authentication may have failed or repository URL is incorrect"
            log "ERROR: Repository URL should be: ${GIT_REPO_URL}"
            exit 1
        fi
    fi
    
    log "Checking out updated files..."
    git checkout -f "origin/${GIT_REPO_BRANCH}" 2>&1 | while read line; do log "$line"; done
    git sparse-checkout reapply 2>&1 | while read line; do log "$line"; done
    log "Git repository updated successfully"
fi

# Copy updated scripts from repository
if [ -d "${SCRIPTS_SOURCE_DIR}" ]; then
`;
    
    sortedScripts.forEach(([scriptName, info]) => {
      gitUpdateScript += `
    # Update ${scriptName}
    if [ -f "${SCRIPTS_SOURCE_DIR}/${scriptName}" ]; then
        log "Updating ${scriptName} from git repository..."
        cp "${SCRIPTS_SOURCE_DIR}/${scriptName}" /opt/wisptools/${scriptName}
        chmod +x /opt/wisptools/${scriptName}
        log "Updated ${scriptName} successfully"
    else
        log "WARNING: ${scriptName} not found in repository"
    fi
`;
    });
    
    gitUpdateScript += `else
    log "ERROR: Scripts directory not found in repository"
    exit 1
fi
`;
  }
  
  // Build apt update script
  let aptUpdateScript = '';
  if (options.apt_packages && Array.isArray(options.apt_packages) && options.apt_packages.length > 0) {
    aptUpdateScript = `
# Update system packages
log "Updating apt package lists..."
apt-get update -qq 2>&1 | while read line; do log "$line"; done

# Upgrade specified packages
log "Upgrading packages: ${options.apt_packages.join(', ')}..."
apt-get upgrade -y ${options.apt_packages.join(' ')} 2>&1 | while read line; do log "$line"; done
if [ $? -eq 0 ]; then
    log "Package updates completed successfully"
else
    log "WARNING: Some package updates may have failed"
fi
`;
  }
  
  const fullScript = `#!/bin/bash
# Auto-update script for EPC agent scripts and system packages
# Uses git for code updates and apt for binary/system package updates
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-checkin.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [AUTO-UPDATE] $1" | tee -a "$LOG_FILE"
}

log "Starting auto-update process..."

${gitUpdateScript}

${aptUpdateScript}

# Restart check-in service if agent was updated
# NOTE: The check-in agent reports results in a background process that survives this restart
# The background process will retry if the restart happens before the HTTP request completes
if [ -f /opt/wisptools/epc-checkin-agent.sh ]; then
    log "Restarting check-in agent (result will be reported in background)"
    # Small delay to allow any immediate result reporting to start
    sleep 1
    systemctl restart wisptools-checkin 2>/dev/null || true
    log "Restarted check-in agent"
fi

log "Auto-update complete"
`;
  
  // Determine command priority based on what's being updated
  // If agent script is being updated, use highest priority (1)
  // Otherwise use standard update priority (5)
  const isAgentUpdate = updateInfo.has_updates && Object.keys(updateInfo.scripts).includes('epc-checkin-agent.sh');
  const commandPriority = isAgentUpdate ? 1 : 5;
  
  // Calculate version from update info (same as in checkForUpdates)
  let versionHash = null;
  if (updateInfo.has_updates) {
    const hash = crypto.createHash('sha256');
    Object.entries(updateInfo.scripts).sort().forEach(([scriptName, info]) => {
      hash.update(`${scriptName}:${info.hash}`);
    });
    versionHash = hash.digest('hex').substring(0, 16);
  }
  
  return {
    command_type: 'script_execution',
    action: 'update_scripts',
    script_content: fullScript,
    priority: commandPriority, // Higher priority for updates (lower number = higher priority)
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    version: versionHash // Version based on script hashes
  };
}

module.exports = {
  checkForUpdates,
  generateUpdateCommand
};

