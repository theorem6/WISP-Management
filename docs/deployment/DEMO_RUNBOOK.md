# Demo site operator runbook

Use this for **training**, **sales**, and **internal testing** without creating new orgs, without surprise data loss, and with clear expectations per feature.

## 1. Isolation (do this first)

| Rule | Why |
|------|-----|
| **Dedicated MongoDB** database or cluster for demo (e.g. `wisptools_demo` or separate Atlas project) | Prevents seed scripts or mistakes from touching production. |
| **Dedicated Firebase project** *or* at least **demo-only Auth users** | Keeps demo logins out of production identity. |
| **Demo Hosting URL** (e.g. management test hostname) points only at this stack | Operators know which URL is “safe to break.” |

**Never** point `MONGODB_URI` at production while running `npm run demo:seed` or testing destructive scripts.

## 1b. Demo visitor (no password)

When **`DEMO_VISITOR_MODE`** and **`PUBLIC_DEMO_VISITOR_LOGIN`** are enabled, the login page offers **Continue as demo visitor**. Identity is **derived from client IP + server salt**; **creates are capped** and **data that visitor added is deleted on sign out** (seeded demo rows stay). See [DEMO_VISITOR.md](./DEMO_VISITOR.md).

## 2. Fixed logins (no new accounts during the demo)

| Item | Guidance |
|------|------------|
| **Primary demo user** | Create **one** Firebase Auth user (e.g. `demo@<your-org>.internal`). Store the password in a **password manager** or internal vault — **not** in git. |
| **Link user → tenant** | Set `DEMO_FIREBASE_USER_UID=<uid>` and run `npm run demo:seed` so MongoDB `UserTenant` has **owner** for the demo tenant. |
| **Optional second user** | Only if you need to show RBAC (e.g. `viewer@...`). Pre-create in Firebase; add another `UserTenant` row with a lower role — still **no signup during the session**. |
| **Single-tenant mode** | `PUBLIC_SINGLE_TENANT_MODE=true` + `PUBLIC_SINGLE_TENANT_ID` so users are not sent through tenant creation or selector flows. |

**During the demo:** log in as the pre-made demo user only. Do not use “Sign up” or “Create organization” on the demo URL (single-tenant + seeded tenant makes those paths unnecessary).

## 3. Data retention (additive, not destructive)

| Practice | Detail |
|----------|--------|
| **Default seed** | `npm run demo:seed` is **idempotent** for prefixed rows (`CUST-DEMO-*`, `TKT-DEMO-*`, `INC-DEMO-*`, `DEMO-SN-*`). Re-running adds nothing if those rows already exist. |
| **Prefer edit over delete** | Train presenters to **update** demo customers/tickets (status, notes) instead of removing rows when the UI allows. |
| **Close / resolve instead of purge** | Use statuses like closed, resolved, cancelled rather than hard deletes where supported. |
| **Full wipe** | `npm run demo:reset` **deletes** demo-tagged data and the demo tenant. It only runs if **`ALLOW_DEMO_RESET=true`** in `.env` — set this **only** on the isolated demo database. |

**Golden rule:** Do not run `demo:reset` against any database shared with non-demo data.

## 4. Reset safety (`ALLOW_DEMO_RESET`)

- **`--reset`** is **blocked** unless `ALLOW_DEMO_RESET=true`.
- Set in **`.env` on the machine that runs the seed**, for demo DBs only:

```env
ALLOW_DEMO_RESET=true
```

- Remove or set to `false` on laptops that accidentally share a `.env` with staging/production URIs.

## 5. Feature readiness checklist

Use **Green** = works end-to-end with current demo stack, **Yellow** = needs extra integration or expectation-setting, **Red** = not viable on generic cloud demo without dedicated lab infra.

| Feature / module | Status | Notes |
|------------------|--------|--------|
| Customers (list, edit, search) | Green | Seeded `CUST-DEMO-*`; Mongo-backed. |
| Work orders (list, detail, status) | Green | Seeded `TKT-DEMO-*`. |
| Incidents (Maintain tab) | Green | Seeded `INC-DEMO-*`. |
| Inventory (list, filter by serial) | Green | Seeded `DEMO-SN-*`. |
| Dashboard / module grid | Green | Navigation only. |
| Help desk / tickets tied to customers | Yellow | Create tickets against demo customers; avoid deleting seed rows. |
| Monitoring graphs / device health | Yellow | Needs agents or devices pushing metrics; cloud may show empty — **narrate**. |
| ACS / GenieACS / TR-069 | Yellow | Needs reachable ACS + CPE; use **one lab CPE** or show empty state. |
| SNMP / ping discovery | Yellow | Intended for **remote agents**, not cloud → set expectations. |
| HSS / subscriber / EPC | Yellow | Needs configured HSS/EPC stack or sandbox; often **narrate** on pure Hosting demo. |
| CBRS / SAS | Yellow | Sandbox credentials and regulatory constraints — often demo **UI only**. |
| Billing / PayPal / Stripe | Yellow | Use **sandbox** keys and test cards only; never production merchant IDs. |
| Email / SMS notifications | Yellow | Point to **sandbox** providers or disable outbound in demo env. |
| Voice / SIP | Yellow | Requires carrier / trunk test config. |

Update this table when your demo stack gains real integrations.

## 6. Integration settings (sandboxes only)

| Integration | Demo rule |
|-------------|-----------|
| **Payments** | Sandbox mode, test cards, separate PayPal/Stripe apps. |
| **Maps / ArcGIS** | API keys restricted to demo origins if possible. |
| **External webhooks** | Use test endpoints or disable in demo. |

## 7. “Clean slate” without deleting the golden tenant

If trainers need a fresh story **without** `demo:reset`:

- **Option A:** Add new rows with new IDs (e.g. run an extended seed script with dated suffixes — future enhancement).
- **Option B:** Clone the demo database to a throwaway DB and point a **separate** env at it for that session.
- **Option C:** Use `demo:reset` only on an isolated DB with `ALLOW_DEMO_RESET=true`, then re-seed.

## 8. URLs and env quick reference (fill in for your org)

| What | Value (placeholder) |
|------|---------------------|
| Management site URL | `https://________________` |
| MongoDB URI (demo only) | `mongodb.../________________` |
| Demo tenant id | _(from `npm run demo:seed` output)_ |
| Firebase project id | `________________` |
| Demo user email | `________________` |
| **Never run reset here:** | _(e.g. production / staging URIs)_ |

## 9. Related documents

- [DEMO_SITE.md](./DEMO_SITE.md) — build, deploy, smoke test  
- [../guides/SINGLE_TENANT_MODE.md](../guides/SINGLE_TENANT_MODE.md) — single-org configuration  
- [../../scripts/demo/README.md](../../scripts/demo/README.md) — seed commands  
- [../multitenant-fork/README.md](../multitenant-fork/README.md) — if you later split multitenant code  
