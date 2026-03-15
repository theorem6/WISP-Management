#!/bin/bash
# Deploy git-based update system to existing agent

set -e

echo "=========================================="
echo "Deploying Git-Based Update System"
echo "=========================================="
echo ""

# Configuration
GIT_REPO_URL="https://github.com/theorem6/WISP-Management.git"
GIT_REPO_BRANCH="main"
GIT_REPO_DIR="/opt/wisptools/repo"
SCRIPTS_SOURCE_DIR="${GIT_REPO_DIR}/backend-services/scripts"

# Step 1: Install git
echo "Step 1: Installing git..."
if ! command -v git >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y git
    echo "✅ Git installed"
else
    echo "✅ Git already installed: $(git --version)"
fi
echo ""

# Step 2: Clone or update repository
echo "Step 2: Setting up git repository..."
if [ ! -d "$GIT_REPO_DIR" ]; then
    echo "Cloning repository..."
    mkdir -p "$GIT_REPO_DIR"
    git clone --depth 1 --branch "$GIT_REPO_BRANCH" "$GIT_REPO_URL" "$GIT_REPO_DIR"
    echo "✅ Repository cloned"
else
    echo "Updating existing repository..."
    cd "$GIT_REPO_DIR"
    git fetch origin "$GIT_REPO_BRANCH"
    git reset --hard "origin/${GIT_REPO_BRANCH}"
    echo "✅ Repository updated"
fi
echo ""

# Step 3: Copy scripts from repository
echo "Step 3: Copying scripts from repository..."
if [ ! -d "$SCRIPTS_SOURCE_DIR" ]; then
    echo "❌ ERROR: Scripts directory not found: $SCRIPTS_SOURCE_DIR"
    exit 1
fi

mkdir -p /opt/wisptools

# Copy agent script
if [ -f "${SCRIPTS_SOURCE_DIR}/epc-checkin-agent.sh" ]; then
    cp "${SCRIPTS_SOURCE_DIR}/epc-checkin-agent.sh" /opt/wisptools/
    chmod +x /opt/wisptools/epc-checkin-agent.sh
    echo "✅ Agent script updated"
else
    echo "❌ ERROR: Agent script not found in repository"
    exit 1
fi

# Copy other scripts
[ -f "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.js" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.js && echo "✅ SNMP JS script updated"
[ -f "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.sh" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-snmp-discovery.sh" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.sh && echo "✅ SNMP bash script updated"
[ -f "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" ] && cp "${SCRIPTS_SOURCE_DIR}/epc-ping-monitor.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-ping-monitor.js && echo "✅ Ping monitor script updated"
echo ""

# Step 4: Restart service
echo "Step 4: Restarting check-in service..."
systemctl restart wisptools-checkin
sleep 2
if systemctl is-active --quiet wisptools-checkin; then
    echo "✅ Service restarted successfully"
else
    echo "⚠️  Service may not be running, check status"
    systemctl status wisptools-checkin --no-pager | head -5
fi
echo ""

# Step 5: Verification
echo "Step 5: Verification..."
echo "Git version: $(git --version)"
echo "Repository: $GIT_REPO_DIR"
echo "Latest commit: $(cd $GIT_REPO_DIR && git log -1 --oneline)"
echo "Agent script has git config: $(grep -c GIT_REPO /opt/wisptools/epc-checkin-agent.sh || echo 0) lines"
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "The agent is now using git-based updates."
echo "Future updates will use 'git pull' instead of curl downloads."
