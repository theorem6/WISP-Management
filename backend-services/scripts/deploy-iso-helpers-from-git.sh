#!/bin/bash
# Deploy iso-helpers.js from git repository
# This script pulls the latest iso-helpers.js from the git repository

set -e

BACKEND_DIR="/home/david_peterson_consulting_com/lte-wisp-backend"
REPO_URL="https://github.com/theorem6/WISP-Management.git"
TEMP_DIR="/tmp/lte-pci-mapper-deploy"

echo "=== Deploying iso-helpers.js from Git ==="

# Clean up any existing temp directory
rm -rf "$TEMP_DIR"

# Clone the repository
echo "Cloning repository..."
git clone "$REPO_URL" "$TEMP_DIR"

# Create utils directory if it doesn't exist
mkdir -p "$BACKEND_DIR/utils"

# Copy iso-helpers.js
echo "Copying iso-helpers.js..."
cp "$TEMP_DIR/backend-services/utils/iso-helpers.js" "$BACKEND_DIR/utils/iso-helpers.js"

# Set proper permissions
chown david_peterson_consulting_com:david_peterson_consulting_com "$BACKEND_DIR/utils/iso-helpers.js"
chmod 644 "$BACKEND_DIR/utils/iso-helpers.js"

# Clean up
rm -rf "$TEMP_DIR"

echo "=== Deployment complete ==="
echo "File location: $BACKEND_DIR/utils/iso-helpers.js"
ls -la "$BACKEND_DIR/utils/iso-helpers.js"

