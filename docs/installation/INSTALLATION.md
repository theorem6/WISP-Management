# WISPTools Installation Guide

This guide covers two deployment patterns: **single machine** (one server runs the backend) and **full distributed architecture** (Firebase Hosting + Functions, MongoDB Atlas, one or more API nodes on GCE or your own servers).

---

## Table of Contents

- [Single-Machine Installation](#single-machine-installation)
- [Full Distributed Architecture](#full-distributed-architecture)
- [Environment Variables](#environment-variables)
- [Verification and Updates](#verification-and-updates)

---

## Single-Machine Installation

Use this when one Linux server runs the entire WISPTools backend (main API + EPC API). Suitable for development, staging, or small production.

### When to use

- Dev/staging on one VM or bare metal
- Small production with one API server
- MongoDB is external (e.g. MongoDB Atlas) or you install MongoDB on the same machine separately

### Prerequisites

- **OS:** Ubuntu 20.04/22.04 or Debian 11+ (other Linux may work with manual Node install)
- **Access:** root or sudo
- **MongoDB:** Connection string (e.g. MongoDB Atlas). Not included in the script.

### Steps

1. **Clone the repo** (or copy the install script onto the server):
   ```bash
   git clone https://github.com/theorem6/WISP-Management.git /tmp/WISP-Management
   cd /tmp/WISP-Management
   ```

2. **Run the install script:**
   ```bash
   sudo bash scripts/install/single-machine.sh
   ```
   Default install path: `/opt/lte-pci-mapper`. To use another path:
   ```bash
   sudo bash scripts/install/single-machine.sh /opt/wisptools
   ```

3. **Configure environment:**
   ```bash
   cd /opt/lte-pci-mapper/backend-services
   cp .env.example .env
   # Edit .env: set at least MONGODB_URI and INTERNAL_API_KEY
   nano .env   # or vim
   ```

4. **Start services:**
   ```bash
   cd /opt/lte-pci-mapper/backend-services
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup   # optional: start on boot
   ```

5. **Verify:**
   ```bash
   curl http://localhost:3001/health
   # Expect JSON with status and uptime
   ```

### Optional: nginx in front

If you put nginx in front of the Node apps (e.g. for TLS or static files), proxy `/api/` and `/health` to `http://127.0.0.1:3001` and (if used) EPC routes to port 3002. See [BACKEND_DEPLOYMENT_INSTRUCTIONS.md](../deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) and project nginx examples in `scripts/`.

---

## Full Distributed Architecture

In the distributed setup, traffic flows as follows:

```
[Browser/App] → [Firebase Hosting] → [Firebase Cloud Functions (apiProxy)]
       → [Your API node(s) :3001 / :3002]
[MongoDB Atlas] (used by API nodes and optionally by Functions)
```

- **Firebase Hosting:** Serves the SvelteKit frontend (Module_Manager).
- **Firebase Cloud Functions:** `apiProxy` forwards `/api/**` and `/health` to your backend URL (e.g. `http://GCE_IP:3001`).
- **API node(s):** One or more Linux servers run the backend (this repo’s `backend-services` under PM2).
- **MongoDB Atlas:** Hosted database; all API nodes and optionally Functions use it.

### When to use

- Production with separate frontend (Firebase) and backend (your VMs)
- Multiple API nodes behind a load balancer or multiple Cloud Function targets
- You want to scale API nodes independently

### Step 1: Install each API node

On **every** server that will run the backend:

1. Clone the repo (or copy the install script onto the server):
   ```bash
   git clone https://github.com/theorem6/WISP-Management.git /tmp/WISP-Management
   cd /tmp/WISP-Management
   ```

2. Run the distributed API-node install script:
   ```bash
   sudo bash scripts/install/distributed-api-node.sh
   ```
   This uses the same steps as the single-machine script (Node, PM2, clone, `npm install`).

3. Configure `backend-services/.env` on that host (see [Environment variables](#environment-variables)).

4. Start PM2:
   ```bash
   cd /opt/lte-pci-mapper/backend-services
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. Ensure the host is reachable from the internet (or from Firebase via VPC/connector if you use it) on port 3001 (and 3002 if EPC API is used).

### Step 2: Firebase (Hosting + Functions)

From your **workstation** (or CI), not on the API server:

1. Install Node.js 20+, Firebase CLI (`npm install -g firebase-tools`), and (for GCE) Google Cloud SDK (`gcloud`).

2. Clone the repo and build the frontend:
   ```bash
   git clone https://github.com/theorem6/WISP-Management.git
   cd WISP-Management/Module_Manager
   npm install
   npm run build
   ```

3. Configure Firebase project and deploy:
   ```bash
   firebase login
   firebase use your-project-id
   firebase deploy --only hosting
   firebase deploy --only functions
   ```
   Set Functions config (e.g. backend URL, `INTERNAL_API_KEY`) so `apiProxy` points to your API node(s). See [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) and `functions/` in the repo.

### Step 3: MongoDB Atlas

- Create a cluster and database at [MongoDB Atlas](https://www.mongodb.com/atlas).
- Put the connection string in each API node’s `backend-services/.env` as `MONGODB_URI`.
- Restrict Atlas network access to your API nodes (and optional Cloud Function egress IPs).

### Step 4: Point apiProxy at your API node(s)

In your Firebase Functions config (or env), set the backend base URL to your API node’s public URL (e.g. `http://YOUR_GCE_IP:3001` or `https://api.yourdomain.com` if you put a reverse proxy in front). The `apiProxy` function should forward requests to that URL.

---

## Environment Variables

In `backend-services/.env` (see `backend-services/.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string (Atlas or self-hosted). |
| `INTERNAL_API_KEY` | Yes | Shared secret for `/api/internal/*`; must match Firebase Functions. Generate with `openssl rand -base64 32`. |
| `FIREBASE_PROJECT_ID` | Recommended | Firebase project ID (e.g. `wisptools-production`). |
| `FIREBASE_SERVICE_ACCOUNT_*` | Optional | If the backend verifies Firebase ID tokens itself; otherwise apiProxy can forward with the key. |
| `API_BASE_URL` | Optional | Public base URL of the API (for links in emails, deployment photos, etc.). |
| `NODE_ENV` | Optional | `production` or `development`. |

---

## Verification and Updates

### Health check

- **Local:** `curl http://localhost:3001/health`
- **Via Firebase:** `curl https://your-app.web.app/health` (if rewrites and apiProxy are configured)

### Updating the backend on a server

From the install directory (e.g. `/opt/lte-pci-mapper`):

```bash
cd /opt/lte-pci-mapper
sudo bash scripts/deployment/update-backend-from-git.sh
```

If the repo is private, set `GITHUB_TOKEN` in the environment or in `/opt/lte-pci-mapper/.env`.

### Script and doc locations

| Item | Path |
|------|------|
| Single-machine install | `scripts/install/single-machine.sh` |
| Distributed API node install | `scripts/install/distributed-api-node.sh` |
| Install scripts README | `scripts/install/README.md` |
| This guide | `docs/installation/INSTALLATION.md` |
| Backend deployment (SSH, env, PM2) | [docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md](../deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) |
| Backend architecture (ports, proxy) | [docs/BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) |

---

**Last updated:** January 2026
