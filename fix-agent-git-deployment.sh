#!/bin/bash
# Comprehensive fix for git-based agent deployment

set -e

echo "=========================================="
echo "Fixing Git-Based Agent Deployment"
echo "=========================================="
echo ""

OUTPUT_FILE="/tmp/agent-fix-report.txt"

{
    echo "=== STEP 1: Verify Git Installation ==="
    if command -v git >/dev/null 2>&1; then
        echo "✅ Git installed: $(git --version)"
    else
        echo "❌ Installing git..."
        apt-get update -qq
        apt-get install -y git
        echo "✅ Git installed: $(git --version)"
    fi
    
    echo ""
    echo "=== STEP 2: Verify Repository ==="
    GIT_REPO_DIR="/opt/wisptools/repo"
    if [ ! -d "$GIT_REPO_DIR/.git" ]; then
        echo "❌ Repository missing, cloning..."
        mkdir -p "$GIT_REPO_DIR"
        git clone --depth 1 --branch main https://github.com/theorem6/WISP-Management.git "$GIT_REPO_DIR"
        echo "✅ Repository cloned"
    else
        echo "✅ Repository exists, updating..."
        cd "$GIT_REPO_DIR"
        git fetch origin main
        git reset --hard origin/main
        echo "✅ Repository updated"
    fi
    
    echo ""
    echo "=== STEP 3: Verify Agent Script in Repository ==="
    AGENT_IN_REPO="${GIT_REPO_DIR}/backend-services/scripts/epc-checkin-agent.sh"
    if [ -f "$AGENT_IN_REPO" ]; then
        GIT_LINES=$(grep -c "GIT_REPO" "$AGENT_IN_REPO" || echo "0")
        echo "✅ Agent script in repo has $GIT_LINES git config lines"
        if [ "$GIT_LINES" -eq "0" ]; then
            echo "❌ ERROR: Agent script in repo does NOT have git config!"
        fi
    else
        echo "❌ ERROR: Agent script not found in repository!"
    fi
    
    echo ""
    echo "=== STEP 4: Copy Agent Script from Repository ==="
    if [ -f "$AGENT_IN_REPO" ]; then
        cp "$AGENT_IN_REPO" /opt/wisptools/epc-checkin-agent.sh
        chmod +x /opt/wisptools/epc-checkin-agent.sh
        echo "✅ Agent script copied from repository"
        
        # Verify copied script
        COPIED_GIT_LINES=$(grep -c "GIT_REPO" /opt/wisptools/epc-checkin-agent.sh || echo "0")
        echo "Copied script has $COPIED_GIT_LINES git config lines"
        if [ "$COPIED_GIT_LINES" -gt "0" ]; then
            echo "✅ Agent script has git configuration"
            echo "Git config preview:"
            grep "GIT_REPO" /opt/wisptools/epc-checkin-agent.sh | head -4
        else
            echo "❌ ERROR: Copied agent script does NOT have git config!"
        fi
    else
        echo "❌ ERROR: Cannot copy - agent script not in repository!"
    fi
    
    echo ""
    echo "=== STEP 5: Copy Other Scripts ==="
    SCRIPTS_SOURCE="${GIT_REPO_DIR}/backend-services/scripts"
    if [ -d "$SCRIPTS_SOURCE" ]; then
        [ -f "${SCRIPTS_SOURCE}/epc-ping-monitor.js" ] && cp "${SCRIPTS_SOURCE}/epc-ping-monitor.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-ping-monitor.js && echo "✅ epc-ping-monitor.js updated"
        [ -f "${SCRIPTS_SOURCE}/epc-snmp-discovery.js" ] && cp "${SCRIPTS_SOURCE}/epc-snmp-discovery.js" /opt/wisptools/ && chmod +x /opt/wisptools/epc-snmp-discovery.js && echo "✅ epc-snmp-discovery.js updated"
    fi
    
    echo ""
    echo "=== STEP 6: Restart Service ==="
    systemctl restart wisptools-checkin
    sleep 2
    if systemctl is-active --quiet wisptools-checkin; then
        echo "✅ Service is active"
    else
        echo "⚠️  Service status:"
        systemctl status wisptools-checkin --no-pager | head -5
    fi
    
    echo ""
    echo "=== STEP 7: Final Verification ==="
    echo "Git version: $(git --version)"
    echo "Repository latest commit: $(cd $GIT_REPO_DIR && git log -1 --oneline)"
    echo "Agent script location: /opt/wisptools/epc-checkin-agent.sh"
    echo "Agent script git config lines: $(grep -c 'GIT_REPO' /opt/wisptools/epc-checkin-agent.sh || echo '0')"
    echo "Service status: $(systemctl is-active wisptools-checkin && echo 'active' || echo 'inactive')"
    
} > "$OUTPUT_FILE" 2>&1

cat "$OUTPUT_FILE"
echo ""
echo "Report saved to: $OUTPUT_FILE"
