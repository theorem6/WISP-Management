# Single-tenant mode

This repository supports **one fixed organization** per deployment while keeping the same data model (`tenantId` / `_tenantId` fields) as multitenant. That avoids a risky schema rewrite and lets you re-enable multitenant later using the fork documentation.

## What changes in single-tenant mode

- **Module Manager (SvelteKit)**  
  - Set `PUBLIC_SINGLE_TENANT_MODE=true` and `PUBLIC_SINGLE_TENANT_ID` to your org’s tenant document id (same value users would select in multitenant mode).  
  - Optional: `PUBLIC_SINGLE_TENANT_DISPLAY_NAME` for UI labels before tenant metadata loads.  
  - The tenant selector and self-service org creation paths are bypassed or redirected; the app resolves the configured org after login.

- **Node API (`server.js`)**  
  - Set `SINGLE_TENANT_ID` to the same id. If a request has no `X-Tenant-ID` header, middleware injects this value so scripts and tools still work.

- **Firebase Functions (`functions`)**  
  - Optional `SINGLE_TENANT_ID` in the Functions environment: used when the request does not specify a tenant and the user has no default association (same semantics as the Node layer).

## Configuration checklist

1. Create or choose the **one** tenant record your users will use (Firestore / Mongo as already documented for your stack).  
2. Ensure every user has a **user–tenant association** for that id (same as today).  
3. Deploy env vars for the web app, API, and Functions consistently.  
4. Test login: you should land on the dashboard with the correct org without visiting `/tenant-selector`.

## Multitenant again

See [docs/multitenant-fork/README.md](../multitenant-fork/README.md) and [MULTITENANT_RESTORATION.md](../multitenant-fork/MULTITENANT_RESTORATION.md).

## Extension hooks (code)

`Module_Manager/src/lib/tenant/multitenantExtensionHooks.ts` exposes `registerAfterTenantResolved` for telemetry or custom policy when you maintain a multitenant fork.
