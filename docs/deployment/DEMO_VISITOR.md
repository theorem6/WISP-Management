# Demo visitor login (IP-derived, ephemeral data)

Visitors can sign in **without a password** using **Continue as demo visitor** on the login page. The API creates a stable Firebase user per **client IP address** (plus a server secret), tags new records they create, **limits** how much they can create, and **deletes their records when they sign out**.

## When to enable

Use only on **isolated demo** stacks (dedicated MongoDB + demo tenant).

**Production default:** With `DEMO_VISITOR_MODE` unset, the server does **not** mount `/api/demo` or load `demo-visitor-stamp` — real deployments are unchanged. See [DEMO_FORK_VS_PRODUCTION.md](./DEMO_FORK_VS_PRODUCTION.md).

**`NODE_ENV=production`:** Startup **fails** if `DEMO_VISITOR_MODE=true` unless you also set `ALLOW_DEMO_IN_PRODUCTION=true` (for intentional public demo APIs only).

## Requirements

| Layer | Setting |
|--------|---------|
| API | `DEMO_VISITOR_MODE=true` |
| API | `DEMO_VISITOR_TENANT_ID=<Mongo tenant _id>` or rely on `SINGLE_TENANT_ID` |
| API | `DEMO_VISITOR_SALT=<long random string>` (required for real deployments; default is insecure) |
| API | `trust proxy` is set automatically when `DEMO_VISITOR_MODE=true` so `X-Forwarded-For` resolves to the real client (behind Hosting / load balancers). |
| Web app | `PUBLIC_DEMO_VISITOR_LOGIN=true` |
| Web app | `PUBLIC_SINGLE_TENANT_MODE=true` and `PUBLIC_SINGLE_TENANT_ID` matching the same tenant |

Optional limits (defaults in parentheses):

- `DEMO_VISITOR_MAX_CUSTOMERS` (8)  
- `DEMO_VISITOR_MAX_WORK_ORDERS` (15)  
- `DEMO_VISITOR_MAX_INCIDENTS` (10)  
- `DEMO_VISITOR_MAX_INVENTORY` (8)  

## How it works

1. **POST `/api/demo/visitor-start`** (no auth)  
   - Reads client IP from `X-Forwarded-For` / `req.ip`.  
   - `visitorKey = sha256(DEMO_VISITOR_SALT + "|" + ip).slice(0,20)`  
   - Firebase uid: `demo_v_<visitorKey>`  
   - Creates or updates the Firebase user, sets custom claims `{ demoVisitor: true, visitorKey }`, returns a **custom token**.  
   - Upserts `UserTenant` for that uid on the demo tenant (role `engineer`).

2. Browser calls **`signInWithCustomToken`**, then normal tenant bootstrap.

3. **`middleware/demo-visitor-stamp.js`** (when `DEMO_VISITOR_MODE=true`) verifies the Bearer token on POST/PUT/PATCH, stamps **`demoVisitorKey`** on JSON bodies, and blocks creates over the configured limits for:
   - `/api/customers` (excludes `/api/customers/portal/*`)
   - `/api/work-orders`
   - `/api/incidents`
   - `/api/inventory`

4. **Sign out** (`authService.signOut`) for uid `demo_v_*` calls **POST `/api/demo/visitor-purge`** with `Authorization: Bearer <token>` and **`X-Tenant-ID`**, which runs `deleteMany` on Customer, WorkOrder, Incident, and InventoryItem where `demoVisitorKey` matches and `tenantId` matches.

Seeded rows (`CUST-DEMO-*`, etc.) have **no** `demoVisitorKey` and are **not** removed by purge.

## Security notes

- **Same NAT / shared IP** → same demo identity (by design for “known user changes with IP”).  
- **Rate limiting** is not implemented in-repo; add at your edge if needed.  
- **Salt** must be secret: if leaked, someone could precompute visitor keys (still only affects demo DB).

## Related docs

- [DEMO_FORK_VS_PRODUCTION.md](./DEMO_FORK_VS_PRODUCTION.md) — demo vs real API defaults  
- [DEMO_SITE.md](./DEMO_SITE.md) — deploy and seed  
- [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) — operator checklist  
