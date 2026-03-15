#!/bin/bash
# Deploy Monitoring Backend to GCE via Git
# This script pulls the latest code from GitHub and deploys it

set -e

echo "🚀 Deploying LTE WISP Monitoring Backend via Git..."

# Configuration
BACKEND_DIR="/home/david_peterson_consulting_com/lte-wisp-backend"
REPO_URL="https://github.com/theorem6/WISP-Management.git"
REPO_DIR="/tmp/lte-pci-mapper-deploy"
SERVICE_NAME="lte-wisp-backend"
PORT=3003

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${YELLOW}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Clone or update repository
print_status "Step 1: Fetching latest code from Git..."
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
    git pull origin main
else
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
fi
print_success "Code updated from Git"

# Step 2: Create backend directory structure
print_status "Step 2: Setting up backend directory..."
mkdir -p "$BACKEND_DIR"
mkdir -p "$BACKEND_DIR/routes"
mkdir -p "$BACKEND_DIR/models"
mkdir -p "$BACKEND_DIR/config"
print_success "Directory structure created"

# Step 3: Copy monitoring backend server
print_status "Step 3: Copying monitoring backend server..."
cp "$REPO_DIR/backend-services/monitoring-backend-server.js" "$BACKEND_DIR/server.js"
print_success "Server file copied"

# Step 4: Copy route files
print_status "Step 4: Copying route files..."
cp "$REPO_DIR/backend-services/routes/monitoring.js" "$BACKEND_DIR/routes/" || print_error "Failed to copy monitoring.js"
cp "$REPO_DIR/backend-services/routes/epc.js" "$BACKEND_DIR/routes/" || print_error "Failed to copy epc.js"
cp "$REPO_DIR/backend-services/routes/mikrotik.js" "$BACKEND_DIR/routes/" || print_error "Failed to copy mikrotik.js"
cp "$REPO_DIR/backend-services/routes/snmp.js" "$BACKEND_DIR/routes/" || print_error "Failed to copy snmp.js"
cp "$REPO_DIR/backend-services/routes/network.js" "$BACKEND_DIR/routes/" || print_error "Failed to copy network.js"
cp "$REPO_DIR/backend-services/routes/epc-deployment.js" "$BACKEND_DIR/routes/" || print_error "Failed to copy epc-deployment.js"
print_success "Route files copied"

# Step 5: Copy model files
print_status "Step 5: Copying model files..."
cp "$REPO_DIR/backend-services/models/network.js" "$BACKEND_DIR/models/" || print_error "Failed to copy network.js"
print_success "Model files copied"

# Step 6: Copy config files if they exist
print_status "Step 6: Copying configuration files..."
if [ -f "$REPO_DIR/backend-services/config/app.js" ]; then
    cp "$REPO_DIR/backend-services/config/app.js" "$BACKEND_DIR/config/" || true
fi
print_success "Configuration files copied"

# Step 7: Create package.json
print_status "Step 7: Creating package.json..."
cat > "$BACKEND_DIR/package.json" << 'EOF'
{
  "name": "lte-wisp-monitoring-backend",
  "version": "1.0.0",
  "description": "LTE WISP Management Platform - Monitoring Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^7.5.0",
    "dotenv": "^16.3.1"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF
print_success "package.json created"

# Step 8: Install dependencies
print_status "Step 8: Installing dependencies..."
cd "$BACKEND_DIR"
npm install --production --quiet
print_success "Dependencies installed"

# Step 9: Ensure ISO directory exists
print_status "Step 9: Creating ISO directory..."
sudo mkdir -p /var/www/html/downloads/isos
sudo mkdir -p /tmp/iso-downloads
sudo mkdir -p /opt/epc-iso-builder
sudo chmod 755 /var/www/html/downloads/isos
sudo chmod 755 /tmp/iso-downloads
sudo chmod 755 /opt/epc-iso-builder
print_success "ISO directories created"

# Step 9b: Deploy EPC scripts to downloads directory
print_status "Step 9b: Deploying EPC scripts to downloads directory..."
sudo mkdir -p /var/www/html/downloads/scripts
if [ -f "$REPO_DIR/backend-services/scripts/deploy-scripts-to-downloads.sh" ]; then
    sudo bash "$REPO_DIR/backend-services/scripts/deploy-scripts-to-downloads.sh"
    print_success "EPC scripts deployed"
else
    # Fallback: manually copy scripts
    sudo cp "$REPO_DIR/backend-services/scripts/epc-checkin-agent.sh" /var/www/html/downloads/scripts/ 2>/dev/null || true
    sudo cp "$REPO_DIR/backend-services/scripts/epc-snmp-discovery.sh" /var/www/html/downloads/scripts/ 2>/dev/null || true
    sudo cp "$REPO_DIR/backend-services/scripts/epc-snmp-discovery.js" /var/www/html/downloads/scripts/ 2>/dev/null || true
    sudo cp "$REPO_DIR/backend-services/scripts/epc-ping-monitor.js" /var/www/html/downloads/scripts/ 2>/dev/null || true
    sudo chmod +x /var/www/html/downloads/scripts/*.sh /var/www/html/downloads/scripts/*.js 2>/dev/null || true
    sudo chown www-data:www-data /var/www/html/downloads/scripts/* 2>/dev/null || true
    print_success "EPC scripts copied (fallback method)"
fi

# Step 10: Create systemd service
print_status "Step 10: Creating systemd service..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=LTE WISP Monitoring Backend
After=network.target

[Service]
Type=simple
User=david_peterson_consulting_com
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=$PORT
# Set MONGODB_URI in environment or .env - never commit credentials
Environment=MONGODB_URI=${MONGODB_URI:-}
StandardOutput=append:$BACKEND_DIR/logs/backend.log
StandardError=append:$BACKEND_DIR/logs/backend-error.log

[Install]
WantedBy=multi-user.target
EOF
print_success "Systemd service created"

# Step 11: Create logs directory
print_status "Step 11: Creating logs directory..."
mkdir -p "$BACKEND_DIR/logs"
print_success "Logs directory created"

# Step 12: Reload systemd and restart service
print_status "Step 12: Reloading systemd and restarting service..."
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}
print_success "Service restarted"

# Step 13: Wait for service to start
print_status "Step 13: Waiting for service to start..."
sleep 5

# Step 14: Check service status
print_status "Step 14: Checking service status..."
if sudo systemctl is-active --quiet ${SERVICE_NAME}; then
    print_success "Service is running"
else
    print_error "Service failed to start"
    echo "Checking logs..."
    sudo journalctl -u ${SERVICE_NAME} -n 30 --no-pager
    exit 1
fi

# Step 15: Test health endpoint
print_status "Step 15: Testing health endpoint..."
if curl -f -s http://localhost:${PORT}/health > /dev/null; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    exit 1
fi

# Step 16: Test network endpoint
print_status "Step 16: Testing network endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H 'X-Tenant-ID: 690abdc14a6f067977986db3' "http://localhost:${PORT}/api/network/sectors")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
    print_success "Network endpoint is accessible (HTTP $RESPONSE)"
else
    print_error "Network endpoint returned HTTP $RESPONSE"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deployment Complete!                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "✅ Monitoring Backend deployed successfully"
echo "🌐 Backend URL: http://136.112.111.167:${PORT}"
echo "📊 Health Check: http://136.112.111.167:${PORT}/health"
echo "📋 Service Status: sudo systemctl status ${SERVICE_NAME}"
echo "📝 Logs: sudo journalctl -u ${SERVICE_NAME} -f"

