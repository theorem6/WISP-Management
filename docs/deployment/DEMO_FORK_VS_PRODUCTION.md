# Demo fork vs production (same codebase)

You do **not** need a separate code fork for demos. **Production behavior is the default:** demo-only API paths and middleware are **not registered** unless you explicitly turn them on.

## What stays off in real deployments

| Mechanism | Production (typical) | Demo stack |
|-----------|----------------------|------------|
| `DEMO_VISITOR_MODE` | **unset** or not `true` | `true` |
| `/api/demo/*` routes | **Not mounted** (404) | Mounted |
| `demo-visitor-stamp` middleware | **Not loaded** | Loaded |
| `trust proxy` for demo IP | **Not set** by demo flag | Set when demo mode on |
| `PUBLIC_DEMO_VISITOR_LOGIN` | **unset** | `true` on demo web build |
| `PUBLIC_DEMO_SITE` | **unset** | optional |
| `SINGLE_TENANT_ID` | optional (real single WISP) | often set for demo tenant |
| `ALLOW_DEMO_RESET` | **unset** | only on isolated demo DB |

**Real code path:** With `DEMO_VISITOR_MODE` unset, the server never loads demo visitor middleware or demo routes. No extra `verifyIdToken` work on writes, no `/api/demo` surface.

## Hosted demo on “production” Node env

If the API runs with `NODE_ENV=production` but is a **public demo** host, set:

```env
DEMO_VISITOR_MODE=true
ALLOW_DEMO_IN_PRODUCTION=true
```

Otherwise the server **exits** at startup to avoid accidentally enabling visitor login on a private production API.

## Frontend builds

- **Private / customer build:** omit `PUBLIC_DEMO_VISITOR_LOGIN` and `PUBLIC_DEMO_SITE` (or set false). Login page shows standard sign-in only; no demo visitor panel.
- **Demo Hosting target:** set those vars in the demo build pipeline or `.env` for that deploy only.

## Git workflow (optional)

Some teams use a branch `demo/hosted` that only changes **CI env** or Hosting target — not application logic. The repo stays one codebase; the “fork” is **configuration + branch discipline**, not duplicated features.

## Related

- [DEMO_VISITOR.md](./DEMO_VISITOR.md) — visitor login details  
- [DEMO_SITE.md](./DEMO_SITE.md) — seed and deploy  
- [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) — operators  
