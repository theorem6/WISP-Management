---
title: WISP Management Documentation Index
description: Documentation structure for LTE WISP Management Platform (HSS, GenieACS, CBRS, PCI).
---

# LTE WISP Management Platform - Documentation

Complete documentation for the LTE WISP Management Platform with HSS, GenieACS, CBRS, and PCI management.

---

## 📋 **Status & Planning (start here)**

| Document | Purpose |
|----------|---------|
| [WHERE_WE_ARE_AND_NEXT_STEPS.md](./WHERE_WE_ARE_AND_NEXT_STEPS.md) | Current state, deploy commands, next steps (priority) |
| [NEXT_ITEMS_TO_ADD.md](./NEXT_ITEMS_TO_ADD.md) | Full list: wizards, portal, billing, ACS, docs, monitoring (all implemented or optional) |
| [WHATS_MISSING_IN_APP.md](./WHATS_MISSING_IN_APP.md) | One-page checklist: done vs remaining (optional only) |
| [ENHANCEMENTS.md](./ENHANCEMENTS.md) | Further enhancements; done vs future |
| [OPTIONAL_ITEMS.md](./OPTIONAL_ITEMS.md) | **Optional work only** – documentation, portal, ACS, monitoring, field app, reporting |

**In-app:** Dashboard → 📖 Help, or go to **/docs** and **/docs/reference/project-status**.

---

## ⚙️ **Operational setup**

| Task | Document |
|------|----------|
| **Billing automation** (invoices + dunning) | [BILLING_CRON_AND_DUNNING_SCHEDULE.md](./BILLING_CRON_AND_DUNNING_SCHEDULE.md) – cron on GCE or Cloud Scheduler; internal route `POST /api/internal/cron/billing`; script `backend-services/scripts/cron-billing.sh` |
| **Field App APK** (build + download URL) | [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md) – build APK, host it, set `MOBILE_APP_DOWNLOAD_URL`; dashboard 📱 link uses it |
| **Backend deploy** (when script SSH fails) | [DEPLOY_BACKEND_FALLBACK.md](../DEPLOY_BACKEND_FALLBACK.md) – manual `gcloud compute ssh` steps |
| **Backend deployment** (full) | [deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md](./deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) – env vars (API_BASE_URL, INTERNAL_API_KEY), options |

---

## 📚 **Documentation Structure**

```
docs/
├── hss/                    # HSS & Subscriber Management
│   ├── HSS_PRODUCTION_GUIDE.md
│   ├── MME_CONNECTION_GUIDE.md
│   └── HSS_DEPLOYMENT_COMPLETE.md
│
├── deployment/             # Deployment & Setup Guides
│   ├── COMPLETE_DEPLOYMENT_NOW.md
│   ├── FINAL_DEPLOYMENT_STATUS.md
│   ├── GOOGLE_CLOUD_DEPLOYMENT.md
│   ├── BUILD_INSTRUCTIONS.md
│   ├── DEPLOY_HSS_PROXY.md
│   └── SIMPLE_CLOUD_HTTPS_FIX.md
│
├── guides/                 # Feature & Module Guides
│   ├── ADMIN_AND_USER_MANAGEMENT.md
│   ├── MULTI_TENANT_ARCHITECTURE.md
│   ├── MULTI_TENANT_SETUP_GUIDE.md
│   ├── TENANT_DELETION_GUIDE.md
│   ├── ONE_TENANT_PER_USER.md
│   ├── CBRS_API_KEY_SETUP_GUIDE.md
│   ├── CBRS_HYBRID_MODEL_GUIDE.md
│   ├── CBRS_MODULE_COMPLETE.md
│   ├── GOOGLE_OAUTH_SETUP.md
│   ├── SETUP_GOOGLE_OAUTH_CLIENTID.md
│   ├── PCI_COLLISION_PREVENTION.md
│   ├── TR069_FIRMWARE_UPGRADE_GUIDE.md
│   ├── DATABASE_STRUCTURE.md
│   ├── DATA_MODEL.md
│   ├── THEME_SYSTEM.md
│   └── UI_TOOLTIPS_GUIDE.md
│
└── archived/               # Superseded Documentation
    ├── SETUP_HSS_WITH_4GENGINEER.md
    ├── HTTPS_SETUP_OPTIONS.md
    ├── FRONTEND_BACKEND_CONNECTION.md
    ├── PRODUCTION_DEPLOYMENT_FINAL.md
    ├── COMPLETE_REFACTORING_SUMMARY.md
    ├── CBRS_CREDENTIALS_GUIDE.md
    ├── TENANT_SYSTEM_REFACTOR.md
    ├── COMPLETE_TENANT_SETUP_FIX.md
    └── TENANT_SETUP_AUTHENTICATION_FIX.md
```

---

## 🚀 **Quick Start**

### **I want to...**

| Goal | Document |
|------|----------|
| **Deploy the complete system** | [COMPLETE_DEPLOYMENT_NOW.md](./deployment/COMPLETE_DEPLOYMENT_NOW.md) |
| **Understand HSS architecture** | [HSS_PRODUCTION_GUIDE.md](./hss/HSS_PRODUCTION_GUIDE.md) |
| **Connect an MME** | [MME_CONNECTION_GUIDE.md](./hss/MME_CONNECTION_GUIDE.md) |
| **Check deployment status** | [FINAL_DEPLOYMENT_STATUS.md](./deployment/FINAL_DEPLOYMENT_STATUS.md) |
| **Set up Google Cloud** | [GOOGLE_CLOUD_DEPLOYMENT.md](./deployment/GOOGLE_CLOUD_DEPLOYMENT.md) |
| **Configure CBRS/SAS** | [CBRS_HYBRID_MODEL_GUIDE.md](./guides/CBRS_HYBRID_MODEL_GUIDE.md) |
| **Manage tenants** | [MULTI_TENANT_SETUP_GUIDE.md](./guides/MULTI_TENANT_SETUP_GUIDE.md) |
| **Understand the database** | [DATABASE_STRUCTURE.md](./guides/DATABASE_STRUCTURE.md) |

---

## 📖 **Documentation by Category**

### **🔐 HSS & Subscriber Management**

#### **[HSS_PRODUCTION_GUIDE.md](./hss/HSS_PRODUCTION_GUIDE.md)**
Complete production system guide:
- System architecture
- Service configurations (Open5GS HSS, Management API, GenieACS)
- MongoDB schema and collections
- Subscriber management workflows
- Monitoring and troubleshooting
- Backup and recovery procedures
- Security best practices

#### **[MME_CONNECTION_GUIDE.md](./hss/MME_CONNECTION_GUIDE.md)**
Connecting remote MMEs to cloud HSS:
- MME configuration (FreeDiameter, S6a interface)
- Network requirements and firewall rules
- TLS/security setup
- Multi-site deployment
- Testing and verification
- Troubleshooting common issues
- Diameter protocol debugging

#### **[HSS_DEPLOYMENT_COMPLETE.md](./hss/HSS_DEPLOYMENT_COMPLETE.md)**
Master HSS overview:
- System summary and capabilities
- Quick reference guide
- Service management commands
- Training resources
- Support and maintenance procedures

---

### **🚀 Deployment & Setup**

#### **[COMPLETE_DEPLOYMENT_NOW.md](./deployment/COMPLETE_DEPLOYMENT_NOW.md)** ⭐ **START HERE**
Step-by-step deployment completion:
- What's working vs pending
- Immediate action items
- Firebase Functions proxy deployment
- Testing checklist
- Success criteria

#### **[FINAL_DEPLOYMENT_STATUS.md](./deployment/FINAL_DEPLOYMENT_STATUS.md)**
Current system status:
- What's complete
- What's pending
- Architecture diagrams
- Deployment summary
- Next steps

#### **[GOOGLE_CLOUD_DEPLOYMENT.md](./deployment/GOOGLE_CLOUD_DEPLOYMENT.md)**
Google Cloud infrastructure setup:
- GCE VM creation
- Cloud Build automation
- Firebase hosting configuration
- Secret Manager setup
- IAM and permissions

#### **[BUILD_INSTRUCTIONS.md](./deployment/BUILD_INSTRUCTIONS.md)**
Building the platform:
- Development environment setup
- Build process
- Testing procedures

#### **[DEPLOY_HSS_PROXY.md](./deployment/DEPLOY_HSS_PROXY.md)**
Firebase Functions proxy deployment:
- Why the proxy is needed
- Deployment via Cloud Shell
- Testing and verification

#### **[SIMPLE_CLOUD_HTTPS_FIX.md](./deployment/SIMPLE_CLOUD_HTTPS_FIX.md)**
HTTPS proxy solutions:
- Firebase Functions approach
- Cloud Run alternative
- Load Balancer setup

---

### **📘 Feature & Module Guides**

#### **Tenant Management:**
- [MULTI_TENANT_ARCHITECTURE.md](./guides/MULTI_TENANT_ARCHITECTURE.md) - Architecture overview
- [MULTI_TENANT_SETUP_GUIDE.md](./guides/MULTI_TENANT_SETUP_GUIDE.md) - Setup instructions
- [ADMIN_AND_USER_MANAGEMENT.md](./guides/ADMIN_AND_USER_MANAGEMENT.md) - Admin features
- [TENANT_DELETION_GUIDE.md](./guides/TENANT_DELETION_GUIDE.md) - Delete tenants
- [ONE_TENANT_PER_USER.md](./guides/ONE_TENANT_PER_USER.md) - Tenant model

#### **CBRS & Spectrum:**
- [CBRS_HYBRID_MODEL_GUIDE.md](./guides/CBRS_HYBRID_MODEL_GUIDE.md) - CBRS implementation
- [CBRS_MODULE_COMPLETE.md](./guides/CBRS_MODULE_COMPLETE.md) - Module overview
- [CBRS_API_KEY_SETUP_GUIDE.md](./guides/CBRS_API_KEY_SETUP_GUIDE.md) - API configuration
- [GOOGLE_OAUTH_SETUP.md](./guides/GOOGLE_OAUTH_SETUP.md) - OAuth setup
- [SETUP_GOOGLE_OAUTH_CLIENTID.md](./guides/SETUP_GOOGLE_OAUTH_CLIENTID.md) - Client ID

#### **Network Optimization:**
- [PCI_COLLISION_PREVENTION.md](./guides/PCI_COLLISION_PREVENTION.md) - PCI management

#### **Device Management:**
- [TR069_FIRMWARE_UPGRADE_GUIDE.md](./guides/TR069_FIRMWARE_UPGRADE_GUIDE.md) - CPE firmware

#### **Data & UI:**
- [DATABASE_STRUCTURE.md](./guides/DATABASE_STRUCTURE.md) - Database schema
- [DATA_MODEL.md](./guides/DATA_MODEL.md) - Data models
- [THEME_SYSTEM.md](./guides/THEME_SYSTEM.md) - UI theming
- [UI_TOOLTIPS_GUIDE.md](./guides/UI_TOOLTIPS_GUIDE.md) - Tooltip system

---

## 🗂️ **Module-Specific Documentation**

### **Module_Manager/**
- [Module_Manager/README.md](../Module_Manager/README.md) - Frontend overview
- [Module_Manager/QUICK_START.md](../Module_Manager/QUICK_START.md) - Quick start
- [Module_Manager/AUTHENTICATION_FLOW.md](../Module_Manager/AUTHENTICATION_FLOW.md) - Auth flow
- [Module_Manager/FIREBASE_ENV_SETUP.md](../Module_Manager/FIREBASE_ENV_SETUP.md) - Environment
- [Module_Manager/PCI_MODULE_INTEGRATION.md](../Module_Manager/PCI_MODULE_INTEGRATION.md) - PCI module
- [Module_Manager/DATABASE_COMPARISON_ANALYSIS.md](../Module_Manager/DATABASE_COMPARISON_ANALYSIS.md) - Database

### **HSS Module:**
- [Module_Manager/src/routes/modules/hss-management/README.md](../Module_Manager/src/routes/modules/hss-management/README.md)

### **CBRS Module:**
- [Module_Manager/src/routes/modules/cbrs-management/README.md](../Module_Manager/src/routes/modules/cbrs-management/README.md)

### **ACS/CPE Module:**
- [Module_Manager/src/routes/modules/acs-cpe-management/README.md](../Module_Manager/src/routes/modules/acs-cpe-management/README.md)
- [Module_Manager/src/routes/modules/acs-cpe-management/TR069_MONITORING_GUIDE.md](../Module_Manager/src/routes/modules/acs-cpe-management/TR069_MONITORING_GUIDE.md)
- [Module_Manager/src/routes/modules/acs-cpe-management/REFACTOR_SUMMARY.md](../Module_Manager/src/routes/modules/acs-cpe-management/REFACTOR_SUMMARY.md)

---

## 🎯 **Recommended Reading Order**

### **For New Users:**
1. [README.md](../README.md) - Platform overview
2. [COMPLETE_DEPLOYMENT_NOW.md](./deployment/COMPLETE_DEPLOYMENT_NOW.md) - Deploy the system
3. [HSS_PRODUCTION_GUIDE.md](./hss/HSS_PRODUCTION_GUIDE.md) - Use the HSS
4. [MULTI_TENANT_SETUP_GUIDE.md](./guides/MULTI_TENANT_SETUP_GUIDE.md) - Multi-tenancy

### **For Network Engineers:**
1. [HSS_PRODUCTION_GUIDE.md](./hss/HSS_PRODUCTION_GUIDE.md) - HSS operations
2. [MME_CONNECTION_GUIDE.md](./hss/MME_CONNECTION_GUIDE.md) - Connect MMEs
3. [PCI_COLLISION_PREVENTION.md](./guides/PCI_COLLISION_PREVENTION.md) - Network planning
4. [TR069_FIRMWARE_UPGRADE_GUIDE.md](./guides/TR069_FIRMWARE_UPGRADE_GUIDE.md) - Device management

### **For Administrators:**
1. [ADMIN_AND_USER_MANAGEMENT.md](./guides/ADMIN_AND_USER_MANAGEMENT.md) - User management
2. [MULTI_TENANT_ARCHITECTURE.md](./guides/MULTI_TENANT_ARCHITECTURE.md) - Multi-tenancy
3. [DATABASE_STRUCTURE.md](./guides/DATABASE_STRUCTURE.md) - Data management
4. [GOOGLE_CLOUD_DEPLOYMENT.md](./deployment/GOOGLE_CLOUD_DEPLOYMENT.md) - Infrastructure

### **For Developers:**
1. [BUILD_INSTRUCTIONS.md](./deployment/BUILD_INSTRUCTIONS.md) - Build process
2. [DATA_MODEL.md](./guides/DATA_MODEL.md) - Data models
3. [Module_Manager/README.md](../Module_Manager/README.md) - Frontend architecture
4. [THEME_SYSTEM.md](./guides/THEME_SYSTEM.md) - UI system

---

## 📊 **Documentation Statistics**

- **Total Documents:** 290+ markdown files in `docs/` and subfolders
- **Categories:** Status & planning, deployment, guides, fixes, status, hss, distributed-epc, setup, workflows, archived
- **Modules Covered:** HSS, GenieACS, CBRS, PCI, Tenant Management, Customer Portal, Wizards, ACS/CPE, Monitoring
- **Key entry points:** This README, [WHERE_WE_ARE_AND_NEXT_STEPS.md](./WHERE_WE_ARE_AND_NEXT_STEPS.md), [NEXT_ITEMS_TO_ADD.md](./NEXT_ITEMS_TO_ADD.md), [OPTIONAL_ITEMS.md](./OPTIONAL_ITEMS.md)
- **Last Updated:** January 2026

---

## 🔍 **Search Documentation**

### **By Topic:**

| Topic | Documents |
|-------|-----------|
| **HSS** | HSS_PRODUCTION_GUIDE, MME_CONNECTION_GUIDE, HSS_DEPLOYMENT_COMPLETE |
| **Deployment** | COMPLETE_DEPLOYMENT_NOW, GOOGLE_CLOUD_DEPLOYMENT, BUILD_INSTRUCTIONS |
| **CBRS** | CBRS_HYBRID_MODEL_GUIDE, CBRS_API_KEY_SETUP_GUIDE, CBRS_MODULE_COMPLETE |
| **Tenants** | MULTI_TENANT_SETUP_GUIDE, ADMIN_AND_USER_MANAGEMENT |
| **Database** | DATABASE_STRUCTURE, DATA_MODEL |
| **Security** | GOOGLE_OAUTH_SETUP, TLS configuration in HSS guides |
| **Monitoring** | Monitoring sections in HSS_PRODUCTION_GUIDE |
| **Troubleshooting** | Troubleshooting sections in all production guides |

---

## 📞 **Getting Help**

1. **Search this documentation** using the index above
2. **Check troubleshooting sections** in relevant guides
3. **View logs** as described in production guides
4. **Consult module-specific READMEs** for detailed information

---

## 🔄 **Document Maintenance**

### **When to Update:**
- After system upgrades
- When adding new features
- When fixing bugs
- When changing configurations

### **How to Update:**
1. Edit the relevant .md file
2. Update "Last Updated" date
3. Commit with descriptive message
4. Push to main branch

---

## ✅ **Documentation Quality Standards**

All documentation includes:
- ✅ Clear structure with headings
- ✅ Code examples with syntax highlighting
- ✅ Step-by-step instructions
- ✅ Troubleshooting sections
- ✅ Command-line examples
- ✅ Architecture diagrams (ASCII art)
- ✅ Quick reference tables
- ✅ Links to related documents

---

**For the most up-to-date information, always check the main branch of the repository.**

---

## 📑 **Full documentation index (key files)**

### Root docs/
- **Status & planning:** WHERE_WE_ARE_AND_NEXT_STEPS.md, NEXT_ITEMS_TO_ADD.md, WHATS_MISSING_IN_APP.md, ENHANCEMENTS.md, OPTIONAL_ITEMS.md, NEXT_STEPS_FOR_APP.md
- **Operational:** BILLING_CRON_AND_DUNNING_SCHEDULE.md, FIELD_APP_DOWNLOAD.md, FIELD_APP_MY_PROJECTS.md
- **Portal & billing:** CUSTOMER_PORTAL_IMPLEMENTATION_PLAN.md, CUSTOMER_PORTAL_ACCESS_AND_PAGES.md, COMPLETION_DOC.md
- **Wizards:** WIZARD_IMPLEMENTATION_ADVISORY.md, WIZARD_ACCESS_GUIDE.md, WIZARD_INTEGRATION_COMPLETE.md, WIZARD_HIGH_PRIORITY_COMPLETE.md, WIZARD_DOCUMENTATION_COMPLETE.md
- **Architecture & workflow:** BACKEND_ARCHITECTURE.md, PROJECT_WORKFLOW_STATUS.md, PROJECT_WORKFLOW_QUICK_START.md, BACKEND_INTEGRATIONS.md
- **Deploy & EPC:** DEPLOYMENT_READY_SUMMARY.md, EPC_AUTO_UPDATE_SYSTEM.md, DEPLOYMENT_COMPLETE.md
- **Other:** DOCUMENTATION_SYSTEM_PLAN.md, DOCUMENTATION_PLAN_SUMMARY.md, IMPLEMENTATION_STATUS.md, LTE_5G_INTEGRATION_COMPLETE.md, ACS_FINAL_COMPLETION.md, ONBOARDING_IMPLEMENTATION_STATUS.md, FIREBASE_ADMIN_SDK_SETUP.md, OAUTH_REDIRECT_URIS.md, FIX_GOOGLE_OAUTH_REDIRECT_ERROR.md

### docs/deployment/
- BACKEND_DEPLOYMENT_INSTRUCTIONS.md, COMPLETE_DEPLOYMENT_NOW.md, and other deployment guides

### docs/guides/
- MULTI_TENANT_ARCHITECTURE.md, MULTI_TENANT_SETUP_GUIDE.md, CBRS_MODULE_COMPLETE.md, TR069_FIRMWARE_UPGRADE_GUIDE.md, MONITORING_AND_ALERTING.md, and other guides

### docs/fixes/
- BILLING_404_FIX.md, AUTH_401_INSUFFICIENT_PERMISSION.md, CRITICAL_FIX_SUMMARY.md, and other fix docs

### docs/status/, docs/hss/, docs/setup/, docs/workflows/
- Status reports, HSS guides, setup steps, field operations

**Last Updated:** January 2026

