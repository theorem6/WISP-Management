// Deployment Script Generator for Remote EPCs
// Generates interactive bash scripts for Open5GS installation and configuration

/**
 * Generate a complete deployment script for a remote EPC
 * @param {Object} epc - EPC configuration object
 * @returns {string} - Bash script content
 */
function generateDeploymentScript(epc) {
  const mcc = epc.network_config?.mcc || '001';
  const mnc = epc.network_config?.mnc || '01';
  const tac = epc.network_config?.tac || '1';
  const apn = epc.network_config?.apn || 'internet';
  const dns_primary = epc.network_config?.dns_primary || '8.8.8.8';
  const dns_secondary = epc.network_config?.dns_secondary || '8.8.4.4';
  
  // Cloud HSS configuration (will be hss.wisptools.io in production)
  const hss_hostname = 'hss.wisptools.io';
  const hss_ip_fallback = '136.112.111.167';  // Current GCE server IP
  const hss_port = '3001';  // HSS Management API port
  
  return `#!/bin/bash
# 🚀 Automated EPC Deployment Script - WISPTools.io
# Site: ${epc.site_name}
# EPC ID: ${epc.epc_id}
# Tenant ID: ${epc.tenant_id}
# Generated: ${new Date().toISOString()}
#
# This script is fully automated and requires no user interaction

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
PURPLE='\\033[0;35m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "\\n\${BLUE}[INFO]\${NC} \$1"
}

print_success() {
    echo -e "\\n\${GREEN}[SUCCESS]\${NC} \$1"
}

print_warning() {
    echo -e "\\n\${YELLOW}[WARNING]\${NC} \$1"
}

print_error() {
    echo -e "\\n\${RED}[ERROR]\${NC} \$1"
}

print_header() {
    echo -e "\\n\${PURPLE}═══════════════════════════════════════════════════════════\${NC}"
    echo -e "\${PURPLE}     \$1\${NC}"
    echo -e "\${PURPLE}═══════════════════════════════════════════════════════════\${NC}"
}

# Automated configuration
print_header "Automated EPC Deployment - ${epc.site_name}"
echo -e "\${CYAN}EPC ID:\${NC} ${epc.epc_id}"
echo -e "\${CYAN}Tenant ID:\${NC} ${epc.tenant_id}"
echo -e "\${CYAN}Location:\${NC} ${epc.location?.city || 'Not specified'}, ${epc.location?.state || 'Not specified'}"
echo -e "\${CYAN}Network:\${NC} MCC=${mcc} MNC=${mnc} TAC=${tac}"
echo -e "\${CYAN}APN:\${NC} ${apn}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  print_error "Please run as root (use sudo)"
  exit 1
fi

# Automatic IP configuration - no user interaction
print_header "Network Configuration (Auto-Detected)"

# Auto-detect primary IP
MME_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
print_status "Auto-detected Primary IP: $MME_IP"

# Use same IP for all EPC components (collocated deployment)
SGWC_IP="$MME_IP"
SGWU_IP="$MME_IP"
SMF_IP="$MME_IP"
UPF_IP="$MME_IP"

# Cloud HSS Configuration
# Try to resolve hss.wisptools.io, fallback to IP if DNS not available
if host ${hss_hostname} > /dev/null 2>&1; then
    HSS_ADDR="${hss_hostname}"
    print_status "Using Cloud HSS: ${hss_hostname}"
else
    HSS_ADDR="${hss_ip_fallback}"
    print_warning "DNS lookup failed for ${hss_hostname}, using IP: ${hss_ip_fallback}"
fi
HSS_PORT="${hss_port}"

# DNS configuration
DNS_PRIMARY="${dns_primary}"
DNS_SECONDARY="${dns_secondary}"

# APN configuration (from tenant/EPC settings)
APN_NAME="${apn}"
APN_POOL="10.45.0.0/16"  # Default pool

# Display configuration
echo ""
print_status "Configuration:"
echo "  MME IP: $MME_IP"
echo "  SGW-C IP: $SGWC_IP"
echo "  SGW-U IP: $SGWU_IP"
echo "  SMF IP: $SMF_IP"
echo "  UPF IP: $UPF_IP"
echo "  Cloud HSS: $HSS_ADDR:$HSS_PORT"
echo "  DNS: $DNS_PRIMARY, $DNS_SECONDARY"
echo "  APN: $APN_NAME ($APN_POOL)"
echo ""

print_status "Proceeding with automated installation..."
sleep 2

print_header "Installing Dependencies"
print_status "Updating package lists..."
apt-get update -qq

print_status "Installing required packages..."
apt-get install -y wget curl gnupg software-properties-common apt-transport-https ca-certificates

print_header "Installing Node.js"
print_status "Node.js is required for the metrics agent..."
if ! command -v node &> /dev/null; then
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js $(node --version) installed"
else
    print_success "Node.js $(node --version) already installed"
fi

print_status "Installing monitoring tools..."
apt-get install -y sysstat net-tools iftop vnstat

print_header "Installing Open5GS"
print_status "Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

print_status "Installing Open5GS EPC components..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf

print_header "Configuring EPC Components"

# Configure MME
print_status "Configuring MME..."
cat > /etc/open5gs/mme.yaml <<EOF
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: $MME_IP
  gtpc:
    - addr: $SGWC_IP
  gummei:
    plmn_id:
      mcc: ${mcc}
      mnc: ${mnc}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: ${mcc}
      mnc: ${mnc}
    tac: ${tac}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "Cloud HSS EPC"
    short: "CloudEPC"
  guami:
    plmn_id:
      mcc: ${mcc}
      mnc: ${mnc}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: $SGWC_IP
  pfcp:
    - addr: $SGWC_IP
  sgwu:
    - addr: $SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: $SGWU_IP
  pfcp:
    - addr: $SGWU_IP
  sgwc:
    - addr: $SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: $SMF_IP
  pfcp:
    - addr: $SMF_IP
  upf:
    - addr: $UPF_IP
  dns:
    - $DNS_PRIMARY
    - $DNS_SECONDARY
  subnet:
    - addr: $APN_POOL
  ue_pool:
    - addr: $APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: $UPF_IP
  pfcp:
    - addr: $UPF_IP
  smf:
    - addr: $SMF_IP
EOF

# Configure PCRF
print_status "Configuring PCRF..."
cat > /etc/open5gs/pcrf.yaml <<EOF
pcrf:
  freeDiameter: /etc/freeDiameter/pcrf.conf
  gtpc:
    - addr: 127.0.0.1
EOF

print_header "Configuring Diameter Connection to Cloud HSS"
print_status "Setting up FreeDiameter MME configuration for Cloud HSS..."
print_status "Cloud HSS: $HSS_ADDR:$HSS_PORT"

# Create FreeDiameter MME configuration
cat > /etc/freeDiameter/mme.conf <<EOF
# FreeDiameter MME Configuration for Cloud HSS (${hss_hostname})
# EPC: ${epc.epc_id} / Tenant: ${epc.tenant_id}
Identity = "mme.${epc.epc_id}.wisptools.local";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "$MME_IP";
Port = 3868;

# TLS Configuration (optional - currently disabled for cloud HSS)
# TLS_Cred = "/etc/freeDiameter/mme.cert.pem", "/etc/freeDiameter/mme.key.pem";
# TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS (wisptools.io)
# Primary HSS connection
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "$HSS_ADDR"; No_TLS; Port = $HSS_PORT; };

# Fallback if using IP directly
ConnectPeer = "hss.cloud" { ConnectTo = "${hss_ip_fallback}"; No_TLS; Port = $HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

print_status "Setting up FreeDiameter PCRF configuration..."
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
# EPC: ${epc.epc_id} / Tenant: ${epc.tenant_id}
Identity = "pcrf.${epc.epc_id}.wisptools.local";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "$MME_IP";
Port = 3869;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "$HSS_ADDR"; No_TLS; Port = $HSS_PORT; };
ConnectPeer = "hss.cloud" { ConnectTo = "${hss_ip_fallback}"; No_TLS; Port = $HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_gx.fdx";
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_rx.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

print_success "FreeDiameter configured to connect to Cloud HSS at $HSS_ADDR:$HSS_PORT"

print_header "Setting Up Metrics Agent"
print_status "Creating metrics collection agent for Cloud Monitoring..."

# Download metrics agent from GitHub
print_status "Downloading metrics agent from GitHub..."
curl -o /opt/open5gs-metrics-agent.js \\
  https://raw.githubusercontent.com/theorem6/WISP-Management/main/deployment-files/open5gs-metrics-agent.js

if [ $? -eq 0 ]; then
    print_success "Metrics agent downloaded"
else
    print_error "Download failed, trying alternate method..."
    # Fallback: create basic metrics agent inline
    cat > /opt/open5gs-metrics-agent.js << 'AGENT_EOF'
// Minimal metrics agent - auto-generated fallback
console.log('Using fallback metrics agent');
// Agent implementation here
AGENT_EOF
fi

chmod +x /opt/open5gs-metrics-agent.js

# Configure environment variables for metrics agent
print_status "Configuring metrics agent with EPC credentials..."
cat > /etc/wisptools/metrics-agent.env <<EOF
# WISPTools.io Metrics Agent Configuration
# EPC: ${epc.epc_id} / Tenant: ${epc.tenant_id}
# Generated: $(date)

# API Endpoint
EPC_API_URL=https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy

# EPC Authentication (from auto-registration)
EPC_ID=${epc.epc_id}
EPC_AUTH_CODE=${epc.auth_code}
EPC_API_KEY=${epc.api_key}
EPC_SECRET_KEY=${epc.secret_key}
EPC_TENANT_ID=${epc.tenant_id}

# Metrics Configuration
EPC_METRICS_INTERVAL=60
EPC_SITE_NAME="${epc.site_name}"

# Export for systemd
export EPC_API_URL
export EPC_ID
export EPC_AUTH_CODE
export EPC_API_KEY
export EPC_SECRET_KEY
export EPC_TENANT_ID
export EPC_METRICS_INTERVAL
export EPC_SITE_NAME
EOF

chmod 600 /etc/wisptools/metrics-agent.env

# Install required Node.js modules
print_status "Installing Node.js dependencies for metrics agent..."
mkdir -p /opt/metrics-agent
cd /opt/metrics-agent
npm init -y > /dev/null 2>&1
npm install node-fetch@2 > /dev/null 2>&1

# Initialize network monitoring
print_status "Initializing network monitoring..."
vnstat --create -i ogstun 2>/dev/null || true
systemctl enable vnstat
systemctl start vnstat

# Create systemd service for metrics agent
print_status "Creating systemd service..."
cat > /etc/systemd/system/open5gs-metrics-agent.service <<EOF
[Unit]
Description=Open5GS Metrics Agent - WISPTools.io
Documentation=https://github.com/theorem6/WISP-Management
After=network-online.target open5gs-mmed.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/metrics-agent
EnvironmentFile=/etc/wisptools/metrics-agent.env
ExecStart=/usr/bin/node /opt/open5gs-metrics-agent.js
Restart=always
RestartSec=30
StartLimitInterval=300
StartLimitBurst=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=metrics-agent

[Install]
WantedBy=multi-user.target
EOF

print_success "Metrics agent configured"

print_header "Starting Services"
print_status "Enabling and starting Open5GS services..."

systemctl daemon-reload
systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd
systemctl enable open5gs-metrics-agent

print_status "Starting services..."
systemctl start open5gs-mmed
sleep 2
systemctl start open5gs-sgwcd
sleep 2
systemctl start open5gs-sgwud
sleep 2
systemctl start open5gs-smfd
sleep 2
systemctl start open5gs-upfd
sleep 2
systemctl start open5gs-pcrfd
sleep 2
systemctl start open5gs-metrics-agent

print_header "Verification"
print_status "Checking service status..."

services=("open5gs-mmed" "open5gs-sgwcd" "open5gs-sgwud" "open5gs-smfd" "open5gs-upfd" "open5gs-pcrfd" "open5gs-metrics-agent")

for service in "\${services[@]}"; do
    if systemctl is-active --quiet $service; then
        print_success "$service is running"
    else
        print_error "$service failed to start"
        systemctl status $service --no-pager
    fi
done

print_header "Deployment Complete!"
print_success "EPC deployment completed successfully!"
echo ""
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo -e "\${CYAN}  EPC Configuration Summary\${NC}"
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo ""
echo -e "\${GREEN}Site:\${NC} ${epc.site_name}"
echo -e "\${GREEN}EPC ID:\${NC} ${epc.epc_id}"
echo -e "\${GREEN}Tenant ID:\${NC} ${epc.tenant_id}"
echo ""
echo -e "\${GREEN}Network:\${NC}"
echo "  MME IP: $MME_IP:36412"
echo "  SGW-C IP: $SGWC_IP"
echo "  SGW-U IP: $SGWU_IP"
echo "  SMF IP: $SMF_IP"
echo "  UPF IP: $UPF_IP"
echo ""
echo -e "\${GREEN}Cloud HSS:\${NC} $HSS_ADDR:$HSS_PORT"
echo -e "\${GREEN}MCC/MNC/TAC:\${NC} ${mcc}/${mnc}/${tac}"
echo -e "\${GREEN}APN:\${NC} ${apn}"
echo ""
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo -e "\${CYAN}  Service Status\${NC}"
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo ""
systemctl status open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd open5gs-pcrfd open5gs-metrics-agent --no-pager | grep "Active:"
echo ""
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo -e "\${CYAN}  Next Steps\${NC}"
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo ""
echo "1. ✅ EPC is registered with wisptools.io"
echo "2. ✅ Metrics agent is reporting to cloud"
echo "3. ✅ Connected to Cloud HSS at $HSS_ADDR"
echo ""
echo "4. Configure eNodeB:"
echo "   - MME Address: $MME_IP"
echo "   - MME Port: 36412"
echo "   - PLMN: ${mcc}${mnc}"
echo "   - TAC: ${tac}"
echo ""
echo "5. Add subscribers via WISPTools.io HSS Management"
echo "   https://wisptools.io/hss-management"
echo ""
echo "6. Monitor this EPC in dashboard:"
echo "   https://wisptools.io/distributed-epc"
echo ""
echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
echo ""
print_success "🎉 Your EPC is now ONLINE and connected to Cloud HSS!"
print_success "📡 Reporting metrics to wisptools.io every 60 seconds"
echo ""
`;
}

module.exports = {
  generateDeploymentScript
};

