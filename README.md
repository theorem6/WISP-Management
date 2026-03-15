# WISP Management (wisptools.io)

> **The Complete Wireless ISP Management Platform**  
> Professional multi-tenant solution for LTE/5G network operations, field technicians, customer support, and network optimization. Part of the [wisptools.io](https://wisptools.io) project.

---

## Repository (GitHub)

The product is **WISP Management** at [wisptools.io](https://wisptools.io). The GitHub repo is **[theorem6/WISP-Management](https://github.com/theorem6/WISP-Management)**.

---

## Make this repository public

To make the repo **public** on GitHub:

1. Open the repo on GitHub → **Settings** → **General**.
2. Scroll to **Danger Zone**.
3. Click **Change repository visibility** → choose **Public** → confirm.

After that, the repo and this documentation are visible to everyone.

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Full documentation (main page)](#-full-documentation-on-this-page)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## Overview

**WISP Management** is the main app on [wisptools.io](https://wisptools.io)—a comprehensive, enterprise-grade platform for wireless ISPs and network operators. Built with modern technologies and a modular architecture, it combines network planning, field operations, customer support, and system monitoring into one powerful platform.

### Key capabilities

- **Multi-tenant architecture** – Isolate organizations with their own data and configurations
- **CBRS management** – Integration with Google SAS and Federated Wireless APIs
- **ACS/TR-069** – CPE device management and monitoring
- **PCI planning** – LTE PCI conflict resolution and optimization
- **User management** – Role-based access (Owner, Admin, Member, Viewer)
- **Network visualization** – Interactive maps with ArcGIS integration

---

## Features

| Area | Highlights |
|------|------------|
| **Multi-tenant** | Organization isolation, user roles, tenant switching, admin console |
| **HSS & subscribers** | Open5GS HSS, S6a/Diameter, subscriber CRUD, bandwidth plans, groups, bulk import, IMEI, remote MME, MongoDB Atlas |
| **CBRS** | Google SAS, Federated Wireless, device registration, grants/heartbeats, spectrum visualization |
| **ACS/TR-069** | Provisioning, firmware, configuration, performance monitoring, fault management |
| **PCI planning** | Auto PCI assignment, conflict detection, neighbor analysis, optimization algorithms |
| **Security** | Firebase Auth, RBAC, API key management, encryption, audit logging |

---

## Architecture

**Frontend:** SvelteKit 2, TypeScript, ArcGIS Maps SDK, Firebase SDK  

**Backend:** Firebase Functions, Firestore, Firebase Auth; optional Node API on GCE (see [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md))  

**APIs:** Google SAS, Federated Wireless, GenieACS (TR-069), MongoDB  

**Project layout:**

```
WISP Management (repo: WISPTools)/
├── Module_Manager/          # Main SvelteKit app
│   ├── src/routes/          # login, dashboard, tenant-setup, modules/*
│   └── src/lib/             # services, config, components
├── backend-services/        # Node API (GCE)
├── functions/               # Firebase Cloud Functions
├── docs/                    # All documentation
├── scripts/                 # Deployment and ops (see scripts/README.md)
├── PROMPTS.md               # Architectural playbook (Vibe Coding)
└── ORPHANED_FILES.md        # Cleanup candidates
```

---

## Quick Start

**Prerequisites:** Node.js 20+, Firebase CLI (`npm install -g firebase-tools`), Git, Google Cloud account (for deployment).

```bash
git clone https://github.com/theorem6/WISP-Management.git
cd WISPTools/Module_Manager
npm install
cp .env.example .env.local   # Edit with your Firebase config
npm run dev
# Open http://localhost:5173
```

First-time: sign up at `/login`, set up your organization (tenant), then use the dashboard and modules. For CBRS, configure API keys in CBRS Management (see [CBRS_API_KEY_SETUP_GUIDE.md](docs/guides/CBRS_API_KEY_SETUP_GUIDE.md)).

---

## Full documentation (on this page)

All documentation lives in the **`docs/`** folder. This section is the **full index** so the main page is your single entry point.

### Status & planning (start here)

| Document | Purpose |
|----------|---------|
| [WHERE_WE_ARE_AND_NEXT_STEPS.md](docs/WHERE_WE_ARE_AND_NEXT_STEPS.md) | Current state, deploy commands, next steps |
| [WHERE_THINGS_ARE_AND_NEXT_STEPS.md](docs/status/WHERE_THINGS_ARE_AND_NEXT_STEPS.md) | Status and next steps (alternate) |
| [NEXT_ITEMS_TO_ADD.md](docs/NEXT_ITEMS_TO_ADD.md) | Wizards, portal, billing, ACS, docs, monitoring |
| [WHATS_MISSING_IN_APP.md](docs/WHATS_MISSING_IN_APP.md) | Done vs remaining checklist |
| [ENHANCEMENTS.md](docs/ENHANCEMENTS.md) | Further enhancements |
| [OPTIONAL_ITEMS.md](docs/OPTIONAL_ITEMS.md) | Optional work only |

In-app: Dashboard → Help, or routes **/docs** and **/docs/reference/project-status**.

### Operational setup

| Task | Document |
|------|----------|
| **Billing automation** (invoices + dunning) | [BILLING_CRON_AND_DUNNING_SCHEDULE.md](docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md) |
| **Field App APK** (build + download URL) | [FIELD_APP_DOWNLOAD.md](docs/FIELD_APP_DOWNLOAD.md) |
| **Backend deploy fallback** (when SSH fails) | [DEPLOY_BACKEND_FALLBACK.md](DEPLOY_BACKEND_FALLBACK.md) |
| **Backend deployment** (full) | [BACKEND_DEPLOYMENT_INSTRUCTIONS.md](docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) |
| **Scripts (Windows/Linux)** | [scripts/README.md](scripts/README.md) |
| **Install (single machine or distributed)** | [INSTALLATION.md](docs/installation/INSTALLATION.md) |

### Documentation structure

```
docs/
├── installation/        # Install scripts and guide
│   └── INSTALLATION.md  # Single-machine and distributed
├── hss/                 # HSS & subscriber management
│   ├── HSS_PRODUCTION_GUIDE.md
│   ├── MME_CONNECTION_GUIDE.md
│   └── HSS_DEPLOYMENT_COMPLETE.md
├── deployment/          # Deployment & setup (65+ guides)
│   ├── COMPLETE_DEPLOYMENT_NOW.md   ⭐ Start here to deploy
│   ├── FINAL_DEPLOYMENT_STATUS.md
│   ├── GOOGLE_CLOUD_DEPLOYMENT.md
│   ├── BACKEND_DEPLOYMENT_INSTRUCTIONS.md
│   └── ...
├── guides/              # Feature & module guides (30+)
│   ├── MULTI_TENANT_ARCHITECTURE.md
│   ├── MULTI_TENANT_SETUP_GUIDE.md
│   ├── ADMIN_AND_USER_MANAGEMENT.md
│   ├── CBRS_HYBRID_MODEL_GUIDE.md
│   ├── TR069_FIRMWARE_UPGRADE_GUIDE.md
│   ├── DATABASE_STRUCTURE.md
│   └── ...
├── fixes/               # Fix and troubleshooting docs
├── status/              # Status reports
├── distributed-epc/    # EPC deployment and backend
├── setup/               # Setup guides
└── archived/            # Superseded docs
```

### Quick links by goal

| Goal | Document |
|------|----------|
| **Deploy the complete system** | [COMPLETE_DEPLOYMENT_NOW.md](docs/deployment/COMPLETE_DEPLOYMENT_NOW.md) |
| **Install backend (single or distributed)** | [INSTALLATION.md](docs/installation/INSTALLATION.md) |
| **Understand HSS** | [HSS_PRODUCTION_GUIDE.md](docs/hss/HSS_PRODUCTION_GUIDE.md) |
| **Connect an MME** | [MME_CONNECTION_GUIDE.md](docs/hss/MME_CONNECTION_GUIDE.md) |
| **Deployment status** | [FINAL_DEPLOYMENT_STATUS.md](docs/deployment/FINAL_DEPLOYMENT_STATUS.md) |
| **Google Cloud setup** | [GOOGLE_CLOUD_DEPLOYMENT.md](docs/deployment/GOOGLE_CLOUD_DEPLOYMENT.md) |
| **CBRS/SAS** | [CBRS_HYBRID_MODEL_GUIDE.md](docs/guides/CBRS_HYBRID_MODEL_GUIDE.md) |
| **Tenants** | [MULTI_TENANT_SETUP_GUIDE.md](docs/guides/MULTI_TENANT_SETUP_GUIDE.md) |
| **Database** | [DATABASE_STRUCTURE.md](docs/guides/DATABASE_STRUCTURE.md) |

### HSS & subscriber management

- [HSS_PRODUCTION_GUIDE.md](docs/hss/HSS_PRODUCTION_GUIDE.md) – Architecture, config, MongoDB schema, workflows, monitoring, backup, security
- [MME_CONNECTION_GUIDE.md](docs/hss/MME_CONNECTION_GUIDE.md) – Remote MMEs, FreeDiameter, S6a, firewall, TLS, troubleshooting
- [HSS_DEPLOYMENT_COMPLETE.md](docs/hss/HSS_DEPLOYMENT_COMPLETE.md) – Overview, quick reference, service commands

### Deployment & setup

- [COMPLETE_DEPLOYMENT_NOW.md](docs/deployment/COMPLETE_DEPLOYMENT_NOW.md) ⭐ – Step-by-step deployment
- [FINAL_DEPLOYMENT_STATUS.md](docs/deployment/FINAL_DEPLOYMENT_STATUS.md) – Current status and next steps
- [GOOGLE_CLOUD_DEPLOYMENT.md](docs/deployment/GOOGLE_CLOUD_DEPLOYMENT.md) – GCE, Cloud Build, Firebase, secrets, IAM
- [BUILD_INSTRUCTIONS.md](docs/deployment/BUILD_INSTRUCTIONS.md) – Dev environment and build
- [BACKEND_DEPLOYMENT_INSTRUCTIONS.md](docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) – Backend env and options

### Feature & module guides

**Tenant management:**  
[MULTI_TENANT_ARCHITECTURE.md](docs/guides/MULTI_TENANT_ARCHITECTURE.md), [MULTI_TENANT_SETUP_GUIDE.md](docs/guides/MULTI_TENANT_SETUP_GUIDE.md), [ADMIN_AND_USER_MANAGEMENT.md](docs/guides/ADMIN_AND_USER_MANAGEMENT.md), [TENANT_DELETION_GUIDE.md](docs/guides/TENANT_DELETION_GUIDE.md), [ONE_TENANT_PER_USER.md](docs/guides/ONE_TENANT_PER_USER.md)

**CBRS & spectrum:**  
[CBRS_HYBRID_MODEL_GUIDE.md](docs/guides/CBRS_HYBRID_MODEL_GUIDE.md), [CBRS_MODULE_COMPLETE.md](docs/guides/CBRS_MODULE_COMPLETE.md), [CBRS_API_KEY_SETUP_GUIDE.md](docs/guides/CBRS_API_KEY_SETUP_GUIDE.md), [GOOGLE_OAUTH_SETUP.md](docs/guides/GOOGLE_OAUTH_SETUP.md)

**Device management:**  
[TR069_FIRMWARE_UPGRADE_GUIDE.md](docs/guides/TR069_FIRMWARE_UPGRADE_GUIDE.md)

**Data & UI:**  
[DATABASE_STRUCTURE.md](docs/guides/DATABASE_STRUCTURE.md), [DATA_MODEL.md](docs/guides/DATA_MODEL.md), [THEME_SYSTEM.md](docs/guides/THEME_SYSTEM.md)

### Module-specific docs

- **Module_Manager:** [Module_Manager/README.md](Module_Manager/README.md), [Module_Manager/QUICK_START.md](Module_Manager/QUICK_START.md), [Module_Manager/FIREBASE_ENV_SETUP.md](Module_Manager/FIREBASE_ENV_SETUP.md)
- **HSS module:** [modules/hss-management/README.md](Module_Manager/src/routes/modules/hss-management/README.md)
- **CBRS module:** [modules/cbrs-management/README.md](Module_Manager/src/routes/modules/cbrs-management/README.md)
- **ACS/CPE module:** [modules/acs-cpe-management/README.md](Module_Manager/src/routes/modules/acs-cpe-management/README.md)

### Recommended reading order

**New users:** README (here) → [COMPLETE_DEPLOYMENT_NOW.md](docs/deployment/COMPLETE_DEPLOYMENT_NOW.md) → [HSS_PRODUCTION_GUIDE.md](docs/hss/HSS_PRODUCTION_GUIDE.md) → [MULTI_TENANT_SETUP_GUIDE.md](docs/guides/MULTI_TENANT_SETUP_GUIDE.md)

**Network engineers:** [HSS_PRODUCTION_GUIDE.md](docs/hss/HSS_PRODUCTION_GUIDE.md) → [MME_CONNECTION_GUIDE.md](docs/hss/MME_CONNECTION_GUIDE.md) → [PCI_COLLISION_PREVENTION.md](docs/guides/PCI_COLLISION_PREVENTION.md) → [TR069_FIRMWARE_UPGRADE_GUIDE.md](docs/guides/TR069_FIRMWARE_UPGRADE_GUIDE.md)

**Admins:** [ADMIN_AND_USER_MANAGEMENT.md](docs/guides/ADMIN_AND_USER_MANAGEMENT.md) → [MULTI_TENANT_ARCHITECTURE.md](docs/guides/MULTI_TENANT_ARCHITECTURE.md) → [DATABASE_STRUCTURE.md](docs/guides/DATABASE_STRUCTURE.md) → [GOOGLE_CLOUD_DEPLOYMENT.md](docs/deployment/GOOGLE_CLOUD_DEPLOYMENT.md)

**Developers:** [BUILD_INSTRUCTIONS.md](docs/deployment/BUILD_INSTRUCTIONS.md) → [DATA_MODEL.md](docs/guides/DATA_MODEL.md) → [Module_Manager/README.md](Module_Manager/README.md) → [BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)

### Search by topic

| Topic | Documents |
|-------|------------|
| **HSS** | HSS_PRODUCTION_GUIDE, MME_CONNECTION_GUIDE, HSS_DEPLOYMENT_COMPLETE |
| **Deployment** | COMPLETE_DEPLOYMENT_NOW, GOOGLE_CLOUD_DEPLOYMENT, BACKEND_DEPLOYMENT_INSTRUCTIONS |
| **CBRS** | CBRS_HYBRID_MODEL_GUIDE, CBRS_API_KEY_SETUP_GUIDE, CBRS_MODULE_COMPLETE |
| **Tenants** | MULTI_TENANT_SETUP_GUIDE, ADMIN_AND_USER_MANAGEMENT, MULTI_TENANT_ARCHITECTURE |
| **Database** | DATABASE_STRUCTURE, DATA_MODEL |

### Other key docs

- **Architecture & workflow:** [BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md), [PROJECT_WORKFLOW_QUICK_START.md](docs/PROJECT_WORKFLOW_QUICK_START.md), [BACKEND_INTEGRATIONS.md](docs/BACKEND_INTEGRATIONS.md)
- **Portal & billing:** [CUSTOMER_PORTAL_ACCESS_AND_PAGES.md](docs/CUSTOMER_PORTAL_ACCESS_AND_PAGES.md), [BILLING_CRON_AND_DUNNING_SCHEDULE.md](docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md)
- **Wizards:** [WIZARD_ACCESS_GUIDE.md](docs/WIZARD_ACCESS_GUIDE.md), [WIZARD_INTEGRATION_COMPLETE.md](docs/WIZARD_INTEGRATION_COMPLETE.md)
- **Fixes & troubleshooting:** [docs/fixes/](docs/fixes/) (e.g. AUTH_401, BILLING_404, CRITICAL_FIX_SUMMARY)
- **Architectural playbook (Vibe Coding):** [PROMPTS.md](PROMPTS.md)
- **Cleanup candidates:** [ORPHANED_FILES.md](ORPHANED_FILES.md)

**Detailed doc index:** [docs/README.md](docs/README.md) (same content in doc folder).

---

## Deployment

**Firebase (recommended):**

Two Hosting sites in this project:

| Site | Target | Content | URL |
|------|--------|---------|-----|
| **wisptools-production** | `landing` | Static landing page (`landing/`) | wisptools.io |
| **wisptools-management** | `management` | WISP Management app (`Module_Manager`) | management.wisptools.io |

```bash
firebase deploy
# Or: firebase deploy --only hosting
# Or per site: firebase deploy --only hosting:landing  |  firebase deploy --only hosting:management
```

Build the app before deploy: `cd Module_Manager && npm run build`. The `landing/` folder is static and needs no build.

**Backend to GCE:** Use [deploy-backend-to-gce.ps1](deploy-backend-to-gce.ps1) (Windows) or [scripts/deployment/update-backend-from-git.sh](scripts/deployment/update-backend-from-git.sh) (on server). See [scripts/README.md](scripts/README.md) and [BACKEND_DEPLOYMENT_INSTRUCTIONS.md](docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md).

**Secrets:** Use Firebase App Hosting / Secret Manager or env vars (see `.env.example` and [FIREBASE_ADMIN_SDK_SETUP.md](docs/FIREBASE_ADMIN_SDK_SETUP.md)). Never commit secrets.

---

## User roles

| Role | Permissions |
|------|-------------|
| **Platform Admin** | Full system access, all tenants |
| **Tenant Owner** | Full access within organization |
| **Tenant Admin** | Users and settings |
| **Member** | Access modules and features |
| **Viewer** | Read-only |

---

## Contributing

Contributions are welcome. Use **Issues** for bugs and feature requests and **Pull Requests** with clear descriptions. Prefer feature branches and keep docs updated. See [genieacs-fork/CONTRIBUTING.md](genieacs-fork/CONTRIBUTING.md) for the GenieACS fork.

---

## License

This project is open source under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. You may share and adapt the work with attribution. See [LICENSE](LICENSE) and [creativecommons.org/licenses/by/4.0](https://creativecommons.org/licenses/by/4.0/).

Third-party: **GenieACS** (AGPLv3), **SvelteKit** (MIT), **Firebase** (Google ToS), **ArcGIS** (Esri License).

---

## Support

- **Documentation:** This README and [docs/README.md](docs/README.md)
- **Issues:** [GitHub Issues](https://github.com/theorem6/WISP-Management/issues)

---

**Built for WISP operators worldwide.**  
**Version:** 2.0 · **Last updated:** January 2026 · **Status:** Production ready
