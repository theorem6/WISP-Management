# Restoring multitenant behavior

Single-tenant mode is implemented with **environment flags** and a few UI redirects, not a second schema. To move a fork or branch back toward **full multitenant**, work through the following in order.

## 1. Environment

**Module Manager**

- Remove or set `PUBLIC_SINGLE_TENANT_MODE=false` (or unset).  
- Remove `PUBLIC_SINGLE_TENANT_ID` and `PUBLIC_SINGLE_TENANT_DISPLAY_NAME` unless you use them for something else.

**Node API**

- Unset `SINGLE_TENANT_ID` so the API does not inject a default `X-Tenant-ID`.

**Firebase Functions**

- Unset `SINGLE_TENANT_ID` in the Functions runtime config.

## 2. User flows

Re-test and, if you had removed them in a custom fork, restore:

- `/tenant-selector` — users with multiple associations pick an org.  
- `/tenant-setup` — first org creation for new accounts (see existing guides under `docs/guides/`).

The stock codebase already routes to these when single-tenant env is off.

## 3. Extension hooks

`Module_Manager/src/lib/tenant/multitenantExtensionHooks.ts` is safe to keep. Register `registerAfterTenantResolved` in a multitenant build for per-org analytics, billing, or auditing.

## 4. Data model

No migration is required to “turn multitenant back on”: documents keep `tenantId` / `_tenantId`. Add new tenants and associations through your existing admin flows.

## 5. Security review

When serving multiple customers on one deployment, re-verify:

- Firestore rules and API auth still enforce tenant boundaries.  
- GenieACS / CWMP URL isolation per tenant (see `docs/guides/MULTI_TENANT_*`).  
- Headers: clients must send `X-Tenant-ID` where applicable when `SINGLE_TENANT_ID` is not used.
