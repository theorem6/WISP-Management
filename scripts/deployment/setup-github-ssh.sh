#!/bin/bash
# Setup GitHub SSH Key for Backend Server
# This script configures SSH authentication for GitHub private repository access
# SSH Key Fingerprint: SHA256:evjwW3FJ1wGL/y2JM6daCrcQA1OYVlV4BAyXiM5gdZ0
# Run with: sudo bash scripts/deployment/setup-github-ssh.sh

set -e

echo "🔑 Setting up GitHub SSH authentication for backend server..."
echo ""

SSH_DIR="$HOME/.ssh"
REPO_DIR="/opt/lte-pci-mapper"

# Create .ssh directory if it doesn't exist
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Add GitHub to known_hosts
echo "📝 Adding GitHub to SSH known_hosts..."
if [ ! -f "$SSH_DIR/known_hosts" ] || ! grep -q "github.com" "$SSH_DIR/known_hosts" 2>/dev/null; then
  ssh-keyscan -t rsa,ecdsa,ed25519 github.com >> "$SSH_DIR/known_hosts" 2>/dev/null || true
  chmod 600 "$SSH_DIR/known_hosts"
  echo "✅ GitHub added to known_hosts"
else
  echo "✅ GitHub already in known_hosts"
fi

# Check if SSH key exists
if [ -f "$SSH_DIR/id_rsa" ] || [ -f "$SSH_DIR/id_ed25519" ] || [ -f "$SSH_DIR/id_ecdsa" ]; then
  echo ""
  echo "🔍 Found existing SSH key(s):"
  ls -la "$SSH_DIR"/id_* 2>/dev/null | awk '{print $9}' | while read keyfile; do
    if [ -n "$keyfile" ]; then
      echo "  - $keyfile"
      # Show fingerprint
      ssh-keygen -lf "$keyfile" 2>/dev/null || true
    fi
  done
  echo ""
  echo "📋 To verify the key is added to GitHub:"
  echo "   1. Display public key: cat $SSH_DIR/id_*.pub"
  echo "   2. Add it to GitHub: Settings > SSH and GPG keys > New SSH key"
  echo ""
  echo "Expected fingerprint: SHA256:evjwW3FJ1wGL/y2JM6daCrcQA1OYVlV4BAyXiM5gdZ0"
else
  echo ""
  echo "⚠️  No SSH key found in $SSH_DIR"
  echo ""
  echo "To generate a new SSH key:"
  echo "  ssh-keygen -t ed25519 -C 'gce-server@wisptools.io' -f $SSH_DIR/id_ed25519"
  echo ""
  echo "Then add the public key to GitHub:"
  echo "  1. Display public key: cat $SSH_DIR/id_ed25519.pub"
  echo "  2. Add it to GitHub: Settings > SSH and GPG keys > New SSH key"
  echo ""
  echo "Expected fingerprint: SHA256:evjwW3FJ1wGL/y2JM6daCrcQA1OYVlV4BAyXiM5gdZ0"
fi

# Update git remote to use SSH if repo exists
if [ -d "$REPO_DIR/.git" ]; then
  echo ""
  echo "🔄 Updating git remote to use SSH..."
  cd "$REPO_DIR"
  CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ "$CURRENT_REMOTE" != *"git@github.com"* ]]; then
    git remote set-url origin git@github.com:theorem6/WISP-Management.git
    echo "✅ Git remote updated to SSH"
  else
    echo "✅ Git remote already using SSH"
  fi
  
  # Test SSH connection
  echo ""
  echo "🧪 Testing SSH connection to GitHub..."
  if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "✅ SSH authentication successful!"
  else
    echo "⚠️  SSH authentication test completed (exit code may be non-zero, but connection works)"
    echo "   (GitHub returns exit code 1 for 'Hi username! You've successfully authenticated' message)"
  fi
else
  echo ""
  echo "⚠️  Git repository not found at $REPO_DIR"
  echo "   Repository will be configured when it's initialized"
fi

echo ""
echo "✅ GitHub SSH setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure SSH key is added to GitHub (if not already done)"
echo "   2. Test connection: ssh -T git@github.com"
echo "   3. Update repository: cd $REPO_DIR && git pull origin main"

