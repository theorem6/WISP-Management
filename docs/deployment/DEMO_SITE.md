# WISPTools test / demo site

This document describes how to run the **demo tenant** (fake but real API-backed data), configure the **frontend** and **backend**, and **deploy** to your Firebase / API hosts.

**Operators:** use [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) for isolation rules, fixed logins, feature expectations, and when it is safe to reset data.

## Overview

| Piece | Role |
|-------|------|
| MongoDB seed (`scripts/demo/seed-demo-data.js`) | Creates tenant `wisptools-demo` (configurable) plus CUST-DEMO-*, TKT-DEMO-*, INC-DEMO-*, DEMO-SN-* records |
| Single-tenant env | Pins one org so operators are not sent through multitenant selectors |
| `PUBLIC_DEMO_SITE` | Shows a banner and enables the `/demo` hub in Module Manager |
| Firebase Hosting (`hosting:management`) | Serves the SvelteKit static build (`Module_Manager/build/client`) |
| Node API (`server.js`) | REST API; often deployed on GCE/VM with PM2 or similar |
| Cloud Functions `apiProxy` | Firebase Hosting rewrites `/api/**` to your backend URL configured in Functions |

## 1. Seed demo data

From the repository root (with `MONGODB_URI` set):

```bash
npm install
npm run demo:seed
```

Optional: associate your Firebase test user as **owner** of the demo tenant in one step:

```bash
# Linux / macOS
export DEMO_FIREBASE_USER_UID="<paste Firebase Auth UID>"
npm run demo:seed

# Windows PowerShell
$env:DEMO_FIREBASE_USER_UID="<paste Firebase Auth UID>"
npm run demo:seed
```

Copy the printed **Tenant ID** into the env vars below.

To wipe and recreate demo documents ( **`ALLOW_DEMO_RESET=true`** required — isolated demo DB only; see runbook):

```bash
npm run demo:reset
```

## 2. Frontend (Module Manager)

1. Copy `Module_Manager/.env.example` to `Module_Manager/.env`.
2. Set Firebase web app keys as you already do for WISPTools.
3. For a single-org demo:

```env
PUBLIC_SINGLE_TENANT_MODE=true
PUBLIC_SINGLE_TENANT_ID=<tenant id from seed output>
PUBLIC_DEMO_SITE=true
```

4. Build:

```bash
cd Module_Manager
npm install
npm run build
```

Output: `Module_Manager/build/client` (used by `firebase.json` hosting target `management`).

## 3. Backend (Node API)

On the machine that runs `server.js`:

```env
MONGODB_URI=<same cluster as seed>
SINGLE_TENANT_ID=<same tenant id>
PORT=3001
```

Ensure `config/app.js` **CORS** `origins` includes your Hosting URL (e.g. `https://wisptools-management.web.app` or your custom domain). Add the origin if browsers block API calls.

Restart the API process after env changes.

## 4. Firebase Functions (`apiProxy`)

Hosting rewrites `/api/*` to Cloud Functions. The proxy must forward to the **public URL** of your Node API. Update your Functions config / env the same way you do for production, pointing at the **test** backend if this is a test stack.

Deploy Functions when the proxy code or target URL changes:

```bash
firebase deploy --only functions
```

(Exact function names may vary; see `functions/` and existing deployment docs.)

## 5. Deploy frontend (Hosting)

From repo root, after a successful `Module_Manager` build:

```bash
firebase deploy --only hosting:management
```

Deploy landing (if needed):

```bash
firebase deploy --only hosting:landing
```

### PowerShell helper

```powershell
.\scripts\demo\deploy-wisptools-test.ps1
```

This runs `npm run build` inside `Module_Manager` and deploys `hosting:management`.

## 6. Smoke test

1. Open the management site URL.
2. Sign in with the Firebase user linked to the demo tenant.
3. Open **Demo walkthrough** (`/demo`) — links to Customers, Work Orders, Maintain (incidents), Inventory.
4. Edit a customer or ticket and confirm persistence (MongoDB Compass or API GET).

## 7. Related docs

- [Demo operator runbook](./DEMO_RUNBOOK.md) — isolation, logins, feature matrix, reset policy  
- [Single-tenant mode](../guides/SINGLE_TENANT_MODE.md)
- [Multitenant fork notes](../multitenant-fork/README.md)
- [scripts/demo/README.md](../../scripts/demo/README.md)

## 8. Troubleshooting

| Symptom | Check |
|--------|--------|
| 400 missing `X-Tenant-ID` | `SINGLE_TENANT_ID` on API; browser `PUBLIC_SINGLE_TENANT_ID` / login tenant resolution |
| Empty lists | Tenant id mismatch between seed and `.env`; user not in `UserTenant` for that tenant |
| CORS errors | Add exact browser origin to `config/app.js` cors.origins |
| `/api` 502 from Hosting | Functions `apiProxy` target URL; backend down; firewall |
