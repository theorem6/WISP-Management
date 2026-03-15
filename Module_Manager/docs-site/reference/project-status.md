---
title: "Project Status & Next Steps"
description: "Current project status and prioritized next items for WISP Management"
---

# Project Status & Next Steps

This page summarizes where the project stands and what to work on next. For the full, up-to-date lists, see the markdown files in the repository `docs/` folder.

## Where We Are

- **Frontend:** Firebase Hosting. Deploy: `npm run build` in Module_Manager, then `firebase deploy --only hosting:app`.
- **Backend:** GCE VM (e.g. hss.wisptools.io). Deploy: `deploy-backend-to-gce.ps1` (Upload or Git).
- **Functions:** `firebase deploy --only functions`.
- **Wizards:** Site Deployment and Subscriber Creation wizards added; others (Deploy Equipment, Work Order, Check-in, ACS, CBRS, Monitoring) exist or are in progress.
- **Customer form:** Add/Edit Customer includes service type (4G/5G, FWA, WiFi, Fiber), LTE auth (IMSI, Ki, OPc), MAC address, and QoS (QCI, data quota, priority).
- **ACS:** Preset Management UI at `/modules/acs-cpe-management/presets`. Parameter editor in TR-069 actions.
- **Customer portal:** Branding API and portal-setup UI exist; ticket flow wired.

## Next Items (Summary)

1. **Wizards:** Remaining wizards (RMA Tracking, Customer Onboarding, Bandwidth Plan, Subscriber Group, Conflict Resolution, CBRS Device Registration, Organization/Initial Configuration) as needed.
2. **Customer billing:** Billing cycles, invoicing, SLA tracking (when prioritized).
3. **Documentation:** Add frontmatter to remaining docs; link more files into this docs-site.
4. **Optional:** Connection topology (ArcGIS), advanced alerting, field app branded icon, API_BASE_URL for deployment photos.

## Key Docs in Repository

In the repo root, see:

- **`docs/WHERE_WE_ARE_AND_NEXT_STEPS.md`** – Snapshot and prioritized next steps.
- **`docs/NEXT_ITEMS_TO_ADD.md`** – Full list of items needing to be added (from all .md files).
- **`docs/PROJECT_WORKFLOW_STATUS.md`** – Plan/deploy/field app workflow status.
- **`docs/IMPLEMENTATION_STATUS.md`** – Documentation system (VitePress) phases.

These are the single source of truth for planning and status.
