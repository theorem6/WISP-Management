---
title: Where Things Are & Next Best Steps
description: Current state snapshot and prioritized next actions (post-push Jan 2025).
---

# Where Things Are & Next Best Steps

**Snapshot:** After latest commit (`63a79631`) and push to `origin/main`.  
**Purpose:** One place to see current state and the next best steps.

---

## Where things are

### Frontend
| Item | Location / status |
|------|-------------------|
| **App** | SvelteKit in `Module_Manager/` |
| **Hosting** | Firebase Hosting → `wisptools-production.web.app` |
| **Deploy** | `npm run build` in Module_Manager → `firebase deploy --only hosting:app` |
| **Docs in app** | `/help`, `/docs`; VitePress docs-site in `Module_Manager/docs-site/` (Phase 3 in progress) |

### Backend
| Item | Location / status |
|------|-------------------|
| **API** | Node on GCE VM `acs-hss-server` (us-central1-a) |
| **Path on server** | `/opt/lte-pci-mapper/backend-services` (or `/root/lte-pci-mapper` in some scripts) |
| **Deploy** | **Upload:** `.\deploy-backend-to-gce.ps1 -DeployMethod Upload` (preserves `.env`). **Git:** `deploy-all-complete.ps1` uses `update-backend-from-git.sh` → pulls from `theorem6/WISP-Management.git`. |
| **Health** | https://hss.wisptools.io/api/health |
| **Last deploy** | Git deploy ran; server reset to GitHub and pulled latest (63a79631). `main-api` and `epc-api` restarted. |

### Firebase & auth
| Item | Status |
|------|--------|
| **Project** | `wisptools-production` |
| **Functions** | apiProxy, userTenants, notifications, CBRS, TR-069, etc. Deploy: `firebase deploy --only functions`. |
| **`/api/user-tenants`** | Served by **userTenants** Cloud Function (verifies token, calls backend with INTERNAL_API_KEY). No Firebase Admin needed on backend for this route. |
| **INTERNAL_API_KEY** | Must match on backend. Sync: `.\scripts\set-internal-api-key-on-gce.ps1`. |
| **`/api/tenant-settings`, `/api/plans`, `/api/notifications`** | Hit backend; use `verifyAuth` (Firebase token). Backend needs **Firebase Admin** (service account) or these return 401. |

### Customer portal & billing
| Item | Status |
|------|--------|
| **Portal** | Login, dashboard, tickets, billing, FAQ, KB, service status. Access: `.../portal/login?tenant=<id>` or custom domain. |
| **Stripe** | Stripe Elements in portal “Pay now”; backend `create-payment-intent` (needs `STRIPE_SECRET_KEY`). |
| **Invoices / dunning** | Backend: `POST /api/customer-billing/generate-invoices`, `POST /api/customer-billing/dunning/run`. **Not yet scheduled**; see `docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md`. |

### Done (no action)
- Wizards (19+), wizard catalog, dropdown
- Auth redirect, help CSS, ModuleWizardMenu
- Field App download link (dashboard)
- Browser Notification API in notification center
- End-user docs only (operator-only content removed from /help)
- Deploy script: `hosting:app` target, GCE summary line fix, .env preservation on backend Upload

---

## Next best steps (priority order)

### 1. Fix 401s on tenant-settings / plans / notifications (if you still see them)
**Symptom:** `/api/user-tenants` works (200) but `/api/tenant-settings`, `/api/plans`, or `/api/notifications` return 401 “Invalid token”.

**Cause:** Backend verifies the Bearer token with Firebase Admin; without a service account it fails.

**Action (one-time):**
1. Firebase Console → Project Settings → Service accounts → **Generate new private key** (wisptools-production).
2. From repo root:  
   `.\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\wisptools-production-xxxxx.json"`  
   Script writes `FIREBASE_SERVICE_ACCOUNT_BASE64` to backend `.env` and restarts main-api.

**Doc:** `docs/fixes/AUTH_401_INSUFFICIENT_PERMISSION.md`

---

### 2. Schedule invoices and dunning
**Goal:** Run `generate-invoices` and `dunning/run` on a schedule (e.g. daily).

**Options:**
- **Cron on GCE:** Call backend on localhost with `X-Tenant-ID` (and optionally internal key if you add an internal cron route). Example crontab in `docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md`.
- **Cloud Scheduler:** HTTP job to backend or a small Cloud Function that calls the backend with internal key.

**Doc:** `docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md`

---

### 3. Confirm backend has latest code and env
- **If you use Git deploy:** Last run pulled 63a79631. Backend should already have latest from GitHub.
- **If you use Upload:** Run `.\deploy-backend-to-gce.ps1 -DeployMethod Upload` when you have local backend changes; `.env` is preserved.
- **INTERNAL_API_KEY:** If user-tenants or internal calls fail, run `.\scripts\set-internal-api-key-on-gce.ps1`.

---

### 4. Optional: Doc Phase 2/3 and single “Documentation” entry
- Add frontmatter / fix links (Phase 2); finish VitePress docs-site wiring and deploy (Phase 3).
- Consider one entry point (e.g. “Documentation” → `/help`) and retire duplicate paths.

---

### 5. Optional: Backend automation and repo alignment
- **Deploy on push:** Document or add Cloud Build / GCE startup script to pull from GitHub and restart PM2.
- **Repo URLs:** Most scripts use `theorem6/WISP-Management.git`. A few still reference `lte-pci-mapper` (e.g. `remote-backend-restart.sh`, `deploy-all-automated.sh`). Align to WISP-Management if the repo is unified.

---

## Quick reference

| Goal | Action |
|------|--------|
| 401 on tenant-settings/plans | Set Firebase Admin on GCE: `.\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\key.json"` |
| 401 on user-tenants / internal key | Sync INTERNAL_API_KEY: `.\scripts\set-internal-api-key-on-gce.ps1` |
| Schedule invoices & dunning | Add cron or Cloud Scheduler; see `docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md` |
| Deploy frontend | `cd Module_Manager; npm run build` → `firebase deploy --only hosting:app` |
| Deploy backend (local code) | `.\deploy-backend-to-gce.ps1 -DeployMethod Upload` |
| Deploy everything | `.\deploy-all-complete.ps1` (build + hosting:app + functions + Git backend update) |

---

**Related:** `docs/WHERE_WE_ARE_AND_NEXT_STEPS.md`, `docs/NEXT_STEPS_FOR_APP.md`, `docs/WHATS_MISSING_IN_APP.md`.
