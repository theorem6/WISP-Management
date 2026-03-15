# WISP Management Install Scripts

| Script | Use case |
|--------|----------|
| **single-machine.sh** | One Linux server runs the full backend (main-api + epc-api). Dev, staging, or small production. |
| **distributed-api-node.sh** | One node in a distributed setup. Run on each API server; Firebase Hosting + Functions and MongoDB Atlas are separate. |

**Full guide:** [docs/installation/INSTALLATION.md](../../docs/installation/INSTALLATION.md)

## Quick usage

**Single machine (e.g. Ubuntu server):**
```bash
sudo bash scripts/install/single-machine.sh
# Default: /opt/lte-pci-mapper
# Then: edit backend-services/.env, then pm2 start ecosystem.config.js
```

**Distributed – API node only:**
```bash
sudo bash scripts/install/distributed-api-node.sh
# Same as single-machine; use when this box is one of several API nodes behind Firebase proxy.
```

**Optional env:** `WISPTOOLS_REPO_URL`, `NODE_VERSION` (default 20), `INSTALL_DIR` (or pass as first argument).
