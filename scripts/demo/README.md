# Demo site seed (MongoDB)

Populates a dedicated demo tenant with customers, work orders, incidents, and inventory so the **Module Manager** UI is interactable against real API data.

## Prerequisites

- `MONGODB_URI` in the repo root `.env` (same database the API uses).
- Optional: `DEMO_FIREBASE_USER_UID` — Firebase Auth **uid** of your test user (from Firebase console) so a `UserTenant` owner row is created.

## Commands (repo root)

```bash
npm run demo:seed
```

Reset demo tenant and re-seed (**requires `ALLOW_DEMO_RESET=true` in `.env`** — isolated demo MongoDB only):

```bash
npm run demo:reset
```

See [docs/deployment/DEMO_RUNBOOK.md](../../docs/deployment/DEMO_RUNBOOK.md) before using reset.

Or directly:

```bash
node scripts/demo/seed-demo-data.js
node scripts/demo/seed-demo-data.js --reset
```

## After seeding

The script prints the **tenant MongoDB id**. Configure:

| Layer | Variable | Purpose |
|-------|-----------|---------|
| Module Manager | `PUBLIC_SINGLE_TENANT_MODE=true`, `PUBLIC_SINGLE_TENANT_ID=<id>` | Single-org demo |
| Module Manager | `PUBLIC_DEMO_SITE=true` | Orange demo banner + `/demo` hub |
| Node API | `SINGLE_TENANT_ID=<id>` | Default `X-Tenant-ID` when header omitted |
| Functions | `SINGLE_TENANT_ID=<id>` | Same for Cloud Functions (optional) |

Link your test user if you did not set `DEMO_FIREBASE_USER_UID` during seed:

```bash
set DEMO_FIREBASE_USER_UID=<firebase-uid-from-console>
node scripts/demo/seed-demo-data.js
```

Full deployment steps: [docs/deployment/DEMO_SITE.md](../../docs/deployment/DEMO_SITE.md).  
Operator checklist (logins, features, data rules): [docs/deployment/DEMO_RUNBOOK.md](../../docs/deployment/DEMO_RUNBOOK.md).
