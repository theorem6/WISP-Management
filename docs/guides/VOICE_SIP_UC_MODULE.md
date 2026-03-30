# Voice / SIP & UC module

Tenant-scoped telephone numbers, carrier accounts, E911-related service locations, port orders, and carrier webhook ingress. The UI lives at **`/modules/voice-telephony`** in Module_Manager.

---

## What ships in this repo

| Layer | Location |
|-------|----------|
| **Frontend** | `Module_Manager/src/routes/modules/voice-telephony/`, `Module_Manager/src/lib/services/voiceService.ts` |
| **API** | `backend-services/routes/voice-sip.js`, `backend-services/routes/voice-webhooks.js` |
| **Models** | `backend-services/models/voice-sip.js` |
| **Domain schema / adapter stubs** | `backend-services/services/voice-domain-schema.js`, `voice-provider-adapter.js` |
| **Server registration** | `backend-services/server.js` (and root `server.js` if you run the monolith entrypoint) |

---

## RBAC and modules

- Permission key: **`voiceTelephony`** (see `Module_Manager/src/lib/stores/modulePermissions.ts`, `userRole.ts`, Settings → **Module access**).
- Tenant admins enable the module under **Admin → tenant → Modules** (`voiceTelephony` checkbox; tier defaults include it where configured).

---

## Backend environment

Copy `backend-services/.env.example` to `.env` and set at least `MONGODB_URI`, `INTERNAL_API_KEY`, and Firebase verification as for the rest of the API.

| Variable | Purpose |
|----------|---------|
| **`VOICE_WEBHOOK_SECRET`** | Optional. If set, `POST /api/voice/webhooks/:provider` verifies **HMAC-SHA256** of the raw body (`X-Voice-Webhook-Signature` or `sha256=<hex>`). If unset, webhooks are accepted without signature (**development only**). |

---

## HTTP API (tenant)

Base path: **`/api/voice`**. All tenant routes require:

- **`Authorization: Bearer <Firebase ID token>`**
- **`X-Tenant-ID: <tenant id>`**

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/voice/schema` | Domain schema / reference |
| GET, POST | `/api/voice/provider-accounts` | Carrier account records |
| GET, POST | `/api/voice/telephone-numbers` | List; create (`e164`, `status`, `voiceProviderAccountId`, …) |
| PATCH | `/api/voice/telephone-numbers/:id` | Update status, `customerId`, E911 links, etc. |
| GET, POST | `/api/voice/service-locations` | Geocoded addresses; optional `?customerId=` |
| GET, POST | `/api/voice/emergency-addresses` | E911 records linked to locations |
| GET, POST | `/api/voice/port-orders` | LNP orders |
| POST | `/api/voice/actions/*` | Stub carrier actions (provision E911, create port) |

**Customer linking:** Use the same **`customerId`** string as the Customers module (e.g. `CUST-2025-001`) on telephone numbers and service locations.

---

## Webhooks (carrier → platform)

- **`POST /api/voice/webhooks/:provider`**
- Mounted with **`express.raw`** for this path so HMAC can be computed on the **exact** body bytes.
- Configure `VOICE_WEBHOOK_SECRET` in production.

---

## Frontend and proxy

- The management app calls **`/api/voice`** (see `Module_Manager/src/lib/config/api.ts` → `PATHS.VOICE`).
- Firebase Hosting rewrites **`/api/**`** to the **`apiProxy`** Cloud Function, which forwards to the configured backend host. No extra hosting rule is required for `/api/voice` beyond the existing `/api/**` rule.

---

## Deployment (this repository)

Pushing to **`main`** or **`master`** triggers GitHub Actions:

| Workflow | When it runs | What it deploys |
|----------|----------------|-----------------|
| [`auto-deploy.yml`](../../.github/workflows/auto-deploy.yml) | Push to main/master | **Frontend** to Firebase Hosting if `Module_Manager/**` changed; **Functions** if `functions/**` changed |
| [`deploy-backend-gce.yml`](../../.github/workflows/deploy-backend-gce.yml) | Push to main/master | **backend-services** tarball to GCE (`pm2 reload`) |

After changing voice routes or models, deploy **backend-services** to GCE so production serves the new API. After UI changes, the **frontend** job must run (Module_Manager paths).

**Manual:** From repo root, after `cd Module_Manager && npm run build`: `firebase deploy --only hosting:management` (requires Firebase CLI and project access). Backend: see [BACKEND_DEPLOYMENT_INSTRUCTIONS.md](../deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md) and [deploy-backend-gce.yml](../../.github/workflows/deploy-backend-gce.yml).

---

## Related UI entry points

- Dashboard tile, First-time setup “next steps”, Customers card / modal → Voice with `?customerId=`.
- Coverage map: `focusLat` / `focusLng` query params center the map when a location has coordinates.

---

**Last updated:** March 2026
