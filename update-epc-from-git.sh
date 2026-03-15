#!/bin/bash
# Update EPC scripts from git repository and restart daemon

set -e

GIT_REPO_URL="https://github.com/theorem6/WISP-Management.git"
GIT_REPO_BRANCH="main"
GIT_REPO_DIR="/opt/wisptools/repo"
SCRIPTS_SOURCE_DIR="${GIT_REPO_DIR}/backend-services/scripts"

echo "=========================================="
echo "Updating EPC Scripts from Git Repository"
echo "=========================================="
echo ""

# Ensure git is installed
if ! command -v git >/dev/null 2>&1; then
    echo "Installing git..."
    apt-get update -qq
    apt-get install -y git
fi

# Set up or update git repository
if [ ! -d "$GIT_REPO_DIR" ]; then
    echo "Cloning git repository..."
    mkdir -p "$GIT_REPO_DIR"
    git clone --depth 1 --branch "$GIT_REPO_BRANCH" "$GIT_REPO_URL" "$GIT_REPO_DIR"
    echo "✅ Repository cloned"
else
    echo "Updating git repository..."
    cd "$GIT_REPO_DIR"
    git fetch origin "$GIT_REPO_BRANCH"
    git reset --hard "origin/${GIT_REPO_BRANCH}"
    echo "✅ Repository updated"
fi

# Copy updated scripts from repository
if [ -d "$SCRIPTS_SOURCE_DIR" ]; then
    echo ""
    echo "Copying scripts from repository..."
    
    # Update check-in agent
    if [ -f "${SCRIPTS_SOURCE_DIR}/epc-checkin-agent.sh" ]; then
        cp "${SCRIPTS_SOURCE_DIR}/epc-checkin-agent.sh" /opt/wisptools/epc-checkin-agent.sh
        chmod +x /opt/wisptools/epc-checkin-agent.sh
        echo "✅ epc-checkin-agent.sh updated"
    fi
    
    # Update other scripts
    [ -f "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-ping-monitor.js && echo "✅ epc-ping-monitor.js updated"
    [ -f "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.js" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.js && echo "✅ epc-snmp-discovery.js updated"
    [ -f "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.sh" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.sh" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.sh && echo "✅ epc-snmp-discovery.sh updated"
    
    echo ""
    echo "✅ All scripts updated from repository"
else
    echo "❌ ERROR: Scripts directory not found: $SCRIPTS_SOURCE_DIR"
    exit 1
fi

# Restart check-in daemon if it exists
if systemctl list-unit-files | grep -q wisptools-checkin; then
    echo ""
    echo "Restarting wisptools-checkin daemon..."
    systemctl restart wisptools-checkin
    sleep 2
    if systemctl is-active --quiet wisptools-checkin; then
        echo "✅ Daemon restarted successfully"
    else
        echo "⚠️  Daemon may not be running, check status:"
        systemctl status wisptools-checkin --no-pager | head -5
    fi
else
    echo ""
    echo "ℹ️  wisptools-checkin daemon not found (may not be installed)"
fi

echo ""
echo "=========================================="
echo "✅ Update Complete!"
echo "=========================================="
