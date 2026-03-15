// Distributed EPC Management API
// Handles EPC registration, metrics collection, and monitoring

const express = require('express');
const crypto = require('crypto');
const { RemoteEPC, EPCMetrics, SubscriberSession, AttachDetachEvent, EPCAlert } = require('./distributed-epc-schema');

const router = express.Router();

// Middleware to verify EPC authentication
function authenticateEPC(req, res, next) {
  const authCode = req.headers['x-epc-auth-code'];
  const apiKey = req.headers['x-epc-api-key'];
  const signature = req.headers['x-epc-signature'];
  
  if (!authCode || !apiKey) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }
  
  RemoteEPC.findOne({ auth_code: authCode, api_key: apiKey, enabled: true })
    .then(epc => {
      if (!epc) {
        return res.status(401).json({ error: 'Invalid authentication' });
      }
      
      // Verify signature if provided
      if (signature) {
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
          .createHmac('sha256', epc.secret_key)
          .update(payload)
          .digest('hex');
        
        if (signature !== expectedSignature) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
      
      req.epc = epc;
      next();
    })
    .catch(err => {
      console.error('[EPC Auth] Error:', err);
      res.status(500).json({ error: 'Authentication error' });
    });
}

// Middleware for tenant-based access
function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenant ID' });
  }
  
  req.tenantId = tenantId;
  next();
}

/**
 * EPC Registration & Management
 */

// Register a new EPC site
router.post('/epc/register', requireTenant, async (req, res) => {
  try {
    const {
      site_name,
      location,
      network_config,
      contact,
      metrics_config
    } = req.body;
    
    // Generate unique identifiers
    const epc_id = `epc_${crypto.randomBytes(8).toString('hex')}`;
    const auth_code = crypto.randomBytes(16).toString('hex');
    const api_key = crypto.randomBytes(32).toString('hex');
    const secret_key = crypto.randomBytes(32).toString('hex');
    
    const epc = new RemoteEPC({
      epc_id,
      site_name,
      tenant_id: req.tenantId,
      auth_code,
      api_key,
      secret_key,
      location,
      network_config,
      contact,
      metrics_config: metrics_config || {},
      status: 'registered' // Starts as 'registered', becomes 'online' on first heartbeat
    });
    
    await epc.save();
    
    res.json({
      success: true,
      epc_id,
      auth_code,
      api_key,
      secret_key,
      message: 'EPC registered successfully. Keep these credentials secure!'
    });
  } catch (error) {
    console.error('[EPC Register] Error:', error);
    res.status(500).json({ error: 'Failed to register EPC', details: error.message });
  }
});

// Generate deployment script for a registered EPC
router.get('/epc/:epc_id/deployment-script', requireTenant, async (req, res) => {
  try {
    const epc = await RemoteEPC.findOne({
      epc_id: req.params.epc_id,
      tenant_id: req.tenantId
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Generate the deployment script with embedded credentials
    const script = generateDeploymentScript(epc);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/x-shellscript');
    res.setHeader('Content-Disposition', `attachment; filename="deploy-epc-${epc.site_name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.sh"`);
    
    res.send(script);
  } catch (error) {
    console.error('[Deployment Script] Error:', error);
    res.status(500).json({ error: 'Failed to generate deployment script' });
  }
});

// Helper function to generate deployment script
function generateDeploymentScript(epc) {
  const mcc = epc.network_config?.mcc || '001';
  const mnc = epc.network_config?.mnc || '01';
  const tac = epc.network_config?.tac || '1';
  
  return `#!/bin/bash
# 🚀 Complete EPC Deployment Script - Rapid5GS Style
# Site: ${epc.site_name}
# EPC ID: ${epc.epc_id}
# Generated: ${new Date().toISOString()}

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

# Interactive configuration
print_header "Remote EPC Deployment - ${epc.site_name}"
echo -e "\${CYAN}EPC ID:\${NC} ${epc.epc_id}"
echo -e "\${CYAN}Location:\${NC} ${epc.location?.city || 'Not specified'}, ${epc.location?.state || 'Not specified'}"
echo -e "\${CYAN}Coordinates:\${NC} ${epc.location?.coordinates?.latitude || 'N/A'}, ${epc.location?.coordinates?.longitude || 'N/A'}"
echo -e "\${CYAN}Network:\${NC} MCC=${mcc} MNC=${mnc} TAC=${tac}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  print_error "Please run as root (use sudo)"
  exit 1
fi

# Interactive IP configuration
print_header "Network Configuration"
echo "Please provide the following network information:"
echo ""

# Get MME IP
read -p "MME IP Address (S1AP interface) [default: auto-detect]: " MME_IP
if [ -z "$MME_IP" ]; then
    MME_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
    print_status "Auto-detected MME IP: $MME_IP"
fi

# Get SGW-C IP
read -p "SGW-C IP Address (S11 interface) [default: $MME_IP]: " SGWC_IP
if [ -z "$SGWC_IP" ]; then
    SGWC_IP="$MME_IP"
fi

# Get SGW-U IP
read -p "SGW-U IP Address (S1-U interface) [default: $MME_IP]: " SGWU_IP
if [ -z "$SGWU_IP" ]; then
    SGWU_IP="$MME_IP"
fi

# Get SMF IP
read -p "SMF IP Address (N4 interface) [default: $MME_IP]: " SMF_IP
if [ -z "$SMF_IP" ]; then
    SMF_IP="$MME_IP"
fi

# Get UPF IP
read -p "UPF IP Address (N3 interface) [default: $MME_IP]: " UPF_IP
if [ -z "$UPF_IP" ]; then
    UPF_IP="$MME_IP"
fi

# Get Cloud HSS IP
read -p "Cloud HSS IP Address [default: 136.112.111.167]: " HSS_IP
if [ -z "$HSS_IP" ]; then
    HSS_IP="136.112.111.167"
fi

# Get DNS servers
read -p "Primary DNS Server [default: 8.8.8.8]: " DNS_PRIMARY
if [ -z "$DNS_PRIMARY" ]; then
    DNS_PRIMARY="8.8.8.8"
fi

read -p "Secondary DNS Server [default: 8.8.4.4]: " DNS_SECONDARY
if [ -z "$DNS_SECONDARY" ]; then
    DNS_SECONDARY="8.8.4.4"
fi

# Get APN configuration
read -p "APN Name [default: internet]: " APN_NAME
if [ -z "$APN_NAME" ]; then
    APN_NAME="internet"
fi

read -p "APN IP Pool (CIDR) [default: 10.45.0.0/16]: " APN_POOL
if [ -z "$APN_POOL" ]; then
    APN_POOL="10.45.0.0/16"
fi

echo ""
print_status "Configuration Summary:"
echo "  MME IP: $MME_IP"
echo "  SGW-C IP: $SGWC_IP"
echo "  SGW-U IP: $SGWU_IP"
echo "  SMF IP: $SMF_IP"
echo "  UPF IP: $UPF_IP"
echo "  Cloud HSS IP: $HSS_IP"
echo "  DNS: $DNS_PRIMARY, $DNS_SECONDARY"
echo "  APN: $APN_NAME ($APN_POOL)"
echo ""

read -p "Continue with installation? [Y/n]: " CONFIRM
if [[ $CONFIRM =~ ^[Nn]$ ]]; then
    print_warning "Installation cancelled by user"
    exit 0
fi

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
print_status "Setting up FreeDiameter MME configuration..."

# Create FreeDiameter MME configuration
cat > /etc/freeDiameter/mme.conf <<EOF
# FreeDiameter MME Configuration for Cloud HSS
Identity = "mme.${epc.site_name.replace(/[^a-zA-Z0-9]/g, '')}.local";
Realm = "local";

# TLS Configuration
TLS_Cred = "/etc/freeDiameter/mme.cert.pem", "/etc/freeDiameter/mme.key.pem";
TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS
ConnectPeer = "hss.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };
ConnectPeer = "pcrf.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };

# Application configuration
AppServers = "mme.local";
AppServers = "pcrf.local";

# Security
No_IPv6;
No_SCTP;
EOF

print_status "Setting up FreeDiameter PCRF configuration..."
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
Identity = "pcrf.${epc.site_name.replace(/[^a-zA-Z0-9]/g, '')}.local";
Realm = "local";

# TLS Configuration
TLS_Cred = "/etc/freeDiameter/pcrf.cert.pem", "/etc/freeDiameter/pcrf.key.pem";
TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS
ConnectPeer = "hss.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };

# Application configuration
AppServers = "pcrf.local";

# Security
No_IPv6;
No_SCTP;
EOF

print_header "Setting Up Metrics Agent"
print_status "Creating metrics collection agent..."

# Download metrics agent from GitHub (private repo)
# GITHUB_TOKEN must be set in env - do not hardcode
DOWNLOAD_OK=0
if [ -n "\${GITHUB_TOKEN}" ]; then
  print_status "Downloading metrics agent from GitHub..."
  curl -sSf -H "Authorization: token \${GITHUB_TOKEN}" \\
    -o /opt/open5gs-metrics-agent.js \\
    https://raw.githubusercontent.com/theorem6/WISP-Management/main/deployment-files/open5gs-metrics-agent.js
  DOWNLOAD_OK=$?
fi
if [ $DOWNLOAD_OK -eq 0 ] && [ -s /opt/open5gs-metrics-agent.js ]; then
    print_success "Metrics agent downloaded"
else
    print_warning "Download failed or GITHUB_TOKEN not set, using embedded version..."
    # Fallback to embedded version
    cat > /opt/open5gs-metrics-agent.js <<'EOFAGENT'
#!/usr/bin/env node

const https = require('https');
const http = require('http');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const HSS_API_URL = '${process.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy'}';
const EPC_ID = '${epc.epc_id}';
const TENANT_ID = '${epc.tenant_id}';

// Function to get network statistics
function getNetworkStats() {
    try {
        const interfaces = os.networkInterfaces();
        const stats = {};
        
        for (const [name, addrs] of Object.entries(interfaces)) {
            if (name !== 'lo' && addrs.some(addr => addr.family === 'IPv4')) {
                try {
                    const rxBytes = fs.readFileSync(\`/sys/class/net/\${name}/statistics/rx_bytes\`, 'utf8').trim();
                    const txBytes = fs.readFileSync(\`/sys/class/net/\${name}/statistics/tx_bytes\`, 'utf8').trim();
                    stats[name] = {
                        rx_bytes: parseInt(rxBytes),
                        tx_bytes: parseInt(txBytes)
                    };
                } catch (e) {
                    // Interface might not have stats
                }
            }
        }
        return stats;
    } catch (error) {
        return {};
    }
}

// Function to get disk usage
function getDiskUsage() {
    try {
        const output = execSync('df -B1 / | tail -1', { encoding: 'utf8' });
        const parts = output.trim().split(/\\s+/);
        return {
            total: parseInt(parts[1]),
            used: parseInt(parts[2]),
            available: parseInt(parts[3]),
            percent: parseInt(parts[4])
        };
    } catch (error) {
        return null;
    }
}

// Function to get CPU usage percentage
function getCpuUsage() {
    try {
        const output = execSync('top -bn1 | grep "Cpu(s)"', { encoding: 'utf8' });
        const match = output.match(/([0-9.]+)\\s*id/);
        if (match) {
            return 100 - parseFloat(match[1]);
        }
    } catch (error) {
        // Fallback to load average
        const load = os.loadavg()[0];
        const cpus = os.cpus().length;
        return (load / cpus) * 100;
    }
    return 0;
}

// Function to get active subscriber count from MongoDB
function getSubscriberCount(callback) {
    try {
        // Try to connect to Open5GS MongoDB
        const MongoClient = require('mongodb').MongoClient;
        const url = 'mongodb://localhost:27017';
        
        MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
            if (err) {
                callback(0);
                return;
            }
            
            const db = client.db('open5gs');
            db.collection('subscribers').countDocuments({}, (err, count) => {
                client.close();
                callback(err ? 0 : count);
            });
        });
    } catch (error) {
        callback(0);
    }
}

// Function to get connected UE count
function getConnectedUEs() {
    try {
        // Check MME for connected UEs
        const output = execSync('sudo open5gs-mmed -v 2>&1 | grep -c "UE Context" || echo 0', { encoding: 'utf8' });
        return parseInt(output.trim()) || 0;
    } catch (error) {
        return 0;
    }
}

// Function to check service status with details
function checkService(serviceName) {
    try {
        const status = execSync(\`systemctl is-active \${serviceName}\`, { encoding: 'utf8' }).trim();
        const isActive = status === 'active';
        
        if (isActive) {
            try {
                // Get memory usage for the service
                const memInfo = execSync(\`systemctl status \${serviceName} | grep Memory\`, { encoding: 'utf8' });
                const memMatch = memInfo.match(/([0-9.]+[KMGT])/);
                return {
                    status: 'active',
                    memory: memMatch ? memMatch[1] : 'N/A'
                };
            } catch (e) {
                return { status: 'active', memory: 'N/A' };
            }
        }
        return { status: status, memory: 'N/A' };
    } catch (error) {
        return { status: 'inactive', memory: 'N/A' };
    }
}

// Function to collect comprehensive metrics
function collectMetrics(callback) {
    const networkStats = getNetworkStats();
    const diskUsage = getDiskUsage();
    const cpuUsage = getCpuUsage();
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    
    const metrics = {
        timestamp: new Date().toISOString(),
        epc_id: EPC_ID,
        tenant_id: TENANT_ID,
        system: {
            hostname: os.hostname(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            cpu_percent: Math.round(cpuUsage * 100) / 100,
            memory: {
                total: memTotal,
                free: memFree,
                used: memUsed,
                percent: Math.round((memUsed / memTotal) * 100 * 100) / 100
            },
            disk: diskUsage,
            network: networkStats,
            cpus: os.cpus().length
        },
        services: {
            mme: checkService('open5gs-mmed'),
            sgwc: checkService('open5gs-sgwcd'),
            sgwu: checkService('open5gs-sgwud'),
            smf: checkService('open5gs-smfd'),
            upf: checkService('open5gs-upfd'),
            pcrf: checkService('open5gs-pcrfd')
        }
    };
    
    // Get subscriber count asynchronously
    getSubscriberCount((count) => {
        metrics.subscribers = {
            total: count,
            connected: getConnectedUEs()
        };
        callback(metrics);
    });
}

// Function to send heartbeat
function sendHeartbeat() {
    collectMetrics((metrics) => {
        const postData = JSON.stringify({
            epc_id: EPC_ID,
            tenant_id: TENANT_ID,
            metrics: metrics,
            status: 'online'
        });
        
        const apiUrl = new URL(HSS_API_URL + '/api/epc/' + EPC_ID + '/heartbeat');
        
        const options = {
            hostname: apiUrl.hostname,
            port: apiUrl.port || 443,
            path: apiUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-Tenant-ID': TENANT_ID
            }
        };
        
        const protocol = apiUrl.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(\`[\${new Date().toISOString()}] Heartbeat sent successfully\`);
                } else {
                    console.log(\`[\${new Date().toISOString()}] Heartbeat failed: \${res.statusCode} - \${responseData}\`);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error(\`[\${new Date().toISOString()}] Heartbeat error:\`, error.message);
        });
        
        req.write(postData);
        req.end();
    });
}

// Send heartbeat every 60 seconds
setInterval(sendHeartbeat, 60000);

// Send initial heartbeat after 5 seconds (give services time to start)
setTimeout(sendHeartbeat, 5000);

console.log('Open5GS Metrics Agent started for EPC:', EPC_ID);
console.log('Tenant ID:', TENANT_ID);
console.log('Sending metrics to:', HSS_API_URL);
EOFAGENT
fi

chmod +x /opt/open5gs-metrics-agent.js

# Install MongoDB driver for metrics agent
print_status "Installing MongoDB driver for metrics agent..."
cd /opt
npm install mongodb

# Initialize network monitoring
print_status "Initializing network monitoring..."
vnstat --create -i ogstun 2>/dev/null || true
systemctl enable vnstat
systemctl start vnstat

# Create systemd service for metrics agent
cat > /etc/systemd/system/open5gs-metrics-agent.service <<EOF
[Unit]
Description=Open5GS Metrics Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /opt/open5gs-metrics-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

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
echo -e "\${CYAN}EPC Configuration:\${NC}"
echo "  Site: ${epc.site_name}"
echo "  EPC ID: ${epc.epc_id}"
echo "  MME IP: $MME_IP"
echo "  Cloud HSS: $HSS_IP"
echo ""
echo -e "\${CYAN}Service Status:\${NC}"
systemctl status open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd open5gs-pcrfd --no-pager
echo ""
echo -e "\${CYAN}Next Steps:\${NC}"
echo "1. Configure your eNodeB to connect to MME at $MME_IP:36412"
echo "2. Add subscribers via the Cloud HSS web interface"
echo "3. Monitor EPC status in the dashboard"
echo ""
print_success "Your EPC is now online and connected to the Cloud HSS!"
`;
}

// List EPCs for a tenant
router.get('/epc/list', requireTenant, async (req, res) => {
  try {
    const { status, include_offline } = req.query;
    
    const query = { tenant_id: req.tenantId };
    if (status) query.status = status;
    
    const epcs = await RemoteEPC.find(query)
      .select('-secret_key') // Don't send secret key
      .sort({ site_name: 1 });
    
    // Calculate uptime and add health indicators
    const now = new Date();
    const enrichedEPCs = epcs.map(epc => {
      const epcObj = epc.toObject();
      
      // Check if offline (no heartbeat in 5 minutes)
      const lastHeartbeat = epc.last_heartbeat;
      if (lastHeartbeat) {
        const minutesSinceHeartbeat = (now - lastHeartbeat) / 1000 / 60;
        if (minutesSinceHeartbeat > 5 && epcObj.status === 'online') {
          epcObj.status = 'offline';
        }
        epcObj.minutes_since_heartbeat = Math.floor(minutesSinceHeartbeat);
      }
      
      return epcObj;
    });
    
    res.json({
      success: true,
      count: enrichedEPCs.length,
      epcs: enrichedEPCs
    });
  } catch (error) {
    console.error('[EPC List] Error:', error);
    res.status(500).json({ error: 'Failed to list EPCs' });
  }
});

// Get EPC details
router.get('/epc/:epc_id', requireTenant, async (req, res) => {
  try {
    const epc = await RemoteEPC.findOne({
      epc_id: req.params.epc_id,
      tenant_id: req.tenantId
    }).select('-secret_key');
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // Get latest metrics
    const latestMetrics = await EPCMetrics.findOne({
      epc_id: req.params.epc_id
    }).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      epc: epc.toObject(),
      latest_metrics: latestMetrics
    });
  } catch (error) {
    console.error('[EPC Details] Error:', error);
    res.status(500).json({ error: 'Failed to get EPC details' });
  }
});

// Update EPC configuration
router.put('/epc/:epc_id', requireTenant, async (req, res) => {
  try {
    const { site_name, location, network_config, contact, metrics_config, enabled } = req.body;
    
    const updateData = {};
    if (site_name) updateData.site_name = site_name;
    if (location) updateData.location = location;
    if (network_config) updateData.network_config = network_config;
    if (contact) updateData.contact = contact;
    if (metrics_config) updateData.metrics_config = metrics_config;
    if (typeof enabled !== 'undefined') updateData.enabled = enabled;
    
    const epc = await RemoteEPC.findOneAndUpdate(
      { epc_id: req.params.epc_id, tenant_id: req.tenantId },
      { $set: updateData },
      { new: true }
    ).select('-secret_key');
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    res.json({ success: true, epc });
  } catch (error) {
    console.error('[EPC Update] Error:', error);
    res.status(500).json({ error: 'Failed to update EPC' });
  }
});

// Delete EPC
router.delete('/epc/:epc_id', requireTenant, async (req, res) => {
  try {
    const epc = await RemoteEPC.findOneAndDelete({
      epc_id: req.params.epc_id,
      tenant_id: req.tenantId
    });
    
    if (!epc) {
      return res.status(404).json({ error: 'EPC not found' });
    }
    
    // TODO: Consider soft delete or archiving metrics instead
    
    res.json({ success: true, message: 'EPC deleted successfully' });
  } catch (error) {
    console.error('[EPC Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete EPC' });
  }
});

/**
 * Metrics Collection Endpoints (Called by remote EPC agents)
 */

// Heartbeat endpoint
router.post('/metrics/heartbeat', authenticateEPC, async (req, res) => {
  try {
    const { version, uptime_seconds } = req.body;
    
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      {
        $set: {
          status: 'online',
          last_heartbeat: new Date(),
          last_seen: new Date(),
          uptime_seconds: uptime_seconds || 0,
          version: version || {}
        }
      }
    );
    
    res.json({
      success: true,
      epc_id: req.epc.epc_id,
      metrics_config: req.epc.metrics_config
    });
  } catch (error) {
    console.error('[Heartbeat] Error:', error);
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Submit metrics
router.post('/metrics/submit', authenticateEPC, async (req, res) => {
  try {
    const metricsData = {
      epc_id: req.epc.epc_id,
      tenant_id: req.epc.tenant_id,
      timestamp: new Date(),
      ...req.body
    };
    
    const metrics = new EPCMetrics(metricsData);
    await metrics.save();
    
    // Update EPC last_seen
    await RemoteEPC.findOneAndUpdate(
      { epc_id: req.epc.epc_id },
      { $set: { last_seen: new Date() } }
    );
    
    // Check for alerts
    await checkMetricsForAlerts(req.epc, metricsData);
    
    res.json({ success: true, message: 'Metrics received' });
  } catch (error) {
    console.error('[Metrics Submit] Error:', error);
    res.status(500).json({ error: 'Failed to submit metrics', details: error.message });
  }
});

// Submit attach event
router.post('/metrics/attach', authenticateEPC, async (req, res) => {
  try {
    const { imsi, apn, cellid, enb_ip, allocated_ip } = req.body;
    
    if (!imsi) {
      return res.status(400).json({ error: 'IMSI required' });
    }
    
    // Create session
    const session = new SubscriberSession({
      imsi,
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      session_id: `session_${crypto.randomBytes(8).toString('hex')}`,
      status: 'attached',
      apn,
      cellid,
      enb_ip,
      allocated_ip,
      attached_at: new Date(),
      last_activity: new Date()
    });
    
    await session.save();
    
    // Log event
    const event = new AttachDetachEvent({
      tenant_id: req.epc.tenant_id,
      epc_id: req.epc.epc_id,
      imsi,
      event_type: 'attach',
      apn,
      cellid,
      enb_ip,
      allocated_ip,
      result: 'success'
    });
    
    await event.save();
    
    res.json({ success: true, session_id: session.session_id });
  } catch (error) {
    console.error('[Attach Event] Error:', error);
    res.status(500).json({ error: 'Failed to process attach event' });
  }
});

// Submit detach event
router.post('/metrics/detach', authenticateEPC, async (req, res) => {
  try {
    const { imsi, session_id, data_usage } = req.body;
    
    if (!imsi) {
      return res.status(400).json({ error: 'IMSI required' });
    }
    
    // Find and update session
    const query = { imsi, epc_id: req.epc.epc_id, status: 'attached' };
    if (session_id) query.session_id = session_id;
    
    const session = await SubscriberSession.findOne(query).sort({ attached_at: -1 });
    
    if (session) {
      const now = new Date();
      const sessionDuration = Math.floor((now - session.attached_at) / 1000);
      
      session.status = 'detached';
      session.detached_at = now;
      if (data_usage) session.data_usage = data_usage;
      
      await session.save();
      
      // Log event
      const event = new AttachDetachEvent({
        tenant_id: req.epc.tenant_id,
        epc_id: req.epc.epc_id,
        imsi,
        event_type: 'detach',
        apn: session.apn,
        cellid: session.cellid,
        enb_ip: session.enb_ip,
        result: 'success',
        session_duration_seconds: sessionDuration,
        data_usage_bytes: data_usage?.total_bytes || 0
      });
      
      await event.save();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Detach Event] Error:', error);
    res.status(500).json({ error: 'Failed to process detach event' });
  }
});

/**
 * Dashboard/UI Endpoints
 */

// Get dashboard data for a tenant
router.get('/dashboard', requireTenant, async (req, res) => {
  try {
    const { epc_id } = req.query;
    
    const query = { tenant_id: req.tenantId };
    if (epc_id) query.epc_id = epc_id;
    
    // Get all EPCs
    const epcs = await RemoteEPC.find({ tenant_id: req.tenantId })
      .select('-secret_key');
    
    // Get latest metrics for each EPC
    const latestMetrics = await EPCMetrics.aggregate([
      { $match: query },
      { $sort: { timestamp: -1 } },
      { $group: {
        _id: '$epc_id',
        latest: { $first: '$$ROOT' }
      }}
    ]);
    
    // Get active sessions count
    const activeSessions = await SubscriberSession.countDocuments({
      ...query,
      status: 'attached'
    });
    
    // Get recent attach/detach events (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttaches = await AttachDetachEvent.countDocuments({
      ...query,
      event_type: 'attach',
      timestamp: { $gte: oneHourAgo }
    });
    
    const recentDetaches = await AttachDetachEvent.countDocuments({
      ...query,
      event_type: 'detach',
      timestamp: { $gte: oneHourAgo }
    });
    
    // Get active alerts
    const activeAlerts = await EPCAlert.find({
      tenant_id: req.tenantId,
      resolved: false
    }).sort({ timestamp: -1 }).limit(10);
    
    res.json({
      success: true,
      epcs: epcs.map(epc => {
        const metrics = latestMetrics.find(m => m._id === epc.epc_id);
        return {
          ...epc.toObject(),
          latest_metrics: metrics?.latest || null
        };
      }),
      summary: {
        total_epcs: epcs.length,
        online_epcs: epcs.filter(e => e.status === 'online').length,
        active_sessions: activeSessions,
        recent_attaches: recentAttaches,
        recent_detaches: recentDetaches
      },
      alerts: activeAlerts
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Get historical metrics
router.get('/metrics/history', requireTenant, async (req, res) => {
  try {
    const { epc_id, metric_type, start_date, end_date, granularity = 'hour' } = req.query;
    
    if (!epc_id) {
      return res.status(400).json({ error: 'epc_id required' });
    }
    
    const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = end_date ? new Date(end_date) : new Date();
    
    const metrics = await EPCMetrics.find({
      epc_id,
      tenant_id: req.tenantId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 }).select(metric_type ? `timestamp ${metric_type}` : '');
    
    res.json({
      success: true,
      count: metrics.length,
      metrics
    });
  } catch (error) {
    console.error('[Metrics History] Error:', error);
    res.status(500).json({ error: 'Failed to get metrics history' });
  }
});

// Get subscriber roster
router.get('/subscribers/roster', requireTenant, async (req, res) => {
  try {
    const { epc_id, status = 'attached', limit = 100, skip = 0 } = req.query;
    
    const query = { tenant_id: req.tenantId };
    if (epc_id) query.epc_id = epc_id;
    if (status) query.status = status;
    
    const [sessions, total] = await Promise.all([
      SubscriberSession.find(query)
        .sort({ attached_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip)),
      SubscriberSession.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      total,
      sessions
    });
  } catch (error) {
    console.error('[Roster] Error:', error);
    res.status(500).json({ error: 'Failed to get subscriber roster' });
  }
});

// Get attach/detach events
router.get('/events/attach-detach', requireTenant, async (req, res) => {
  try {
    const { epc_id, event_type, hours = 48, limit = 100 } = req.query;
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const query = {
      tenant_id: req.tenantId,
      timestamp: { $gte: startTime }
    };
    
    if (epc_id) query.epc_id = epc_id;
    if (event_type) query.event_type = event_type;
    
    const events = await AttachDetachEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('[Events] Error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * Alert Management
 */
async function checkMetricsForAlerts(epc, metrics) {
  const alerts = [];
  
  // Check system resources
  if (metrics.system) {
    if (metrics.system.cpu_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_cpu',
        message: `High CPU usage: ${metrics.system.cpu_percent}%`,
        details: { cpu_percent: metrics.system.cpu_percent }
      });
    }
    
    if (metrics.system.memory_percent > 90) {
      alerts.push({
        tenant_id: epc.tenant_id,
        epc_id: epc.epc_id,
        severity: 'warning',
        alert_type: 'high_memory',
        message: `High memory usage: ${metrics.system.memory_percent}%`,
        details: { memory_percent: metrics.system.memory_percent }
      });
    }
  }
  
  // Check IP pool exhaustion
  if (metrics.ogstun_pool && metrics.ogstun_pool.utilization_percent > 90) {
    alerts.push({
      tenant_id: epc.tenant_id,
      epc_id: epc.epc_id,
      severity: 'critical',
      alert_type: 'pool_exhausted',
      message: `IP pool nearly exhausted: ${metrics.ogstun_pool.utilization_percent}%`,
      details: metrics.ogstun_pool
    });
  }
  
  // Check component status
  if (metrics.components) {
    for (const [component, status] of Object.entries(metrics.components)) {
      if (status === 'stopped' || status === 'error') {
        alerts.push({
          tenant_id: epc.tenant_id,
          epc_id: epc.epc_id,
          severity: 'error',
          alert_type: 'component_down',
          message: `Component ${component} is ${status}`,
          details: { component, status }
        });
      }
    }
  }
  
  // Save new alerts
  if (alerts.length > 0) {
    await EPCAlert.insertMany(alerts);
  }
}

module.exports = router;

