# Fix: GET /api/user-tenants/:userId 404 on management.wisptools.io

## Symptom

After logging in at https://management.wisptools.io/login, the app calls `GET /api/user-tenants/{userId}` and receives **404 (Not Found)** with body `{detail: 'Not Found'}`. Tenant list never loads and the user may be sent to tenant setup.

## Cause

1. **Cloud Function not deployed**  
   The management site uses Firebase Hosting rewrites so that `/api/user-tenants/**` is handled by the **userTenants** Cloud Function. If you only ran `firebase deploy --only hosting`, the **userTenants** function was not deployed. The rewrite then targets a missing or outdated function and Firebase returns 404.

2. **CORS**  
   The Functions CORS allowlist did not include `https://management.wisptools.io`, so responses could be blocked by the browser (less common when the request is same-origin via Hosting rewrite, but the origin is now included for consistency).

## Fixes applied

1. **CORS**  
   In `functions/src/config.ts`, added to allowed origins:
   - `https://management.wisptools.io`
   - `https://wisptools-management.web.app`

2. **Path handling in userTenants**  
   In `functions/src/index.ts`, the **userTenants** function now:
   - Uses `req.originalUrl` and `x-original-url` as fallbacks when `req.url` is `/` or missing (so the path is correct when invoked via Hosting rewrite).

3. **Deploy the function**  
   Deploy the **userTenants** (and optionally all) Cloud Functions so the rewrite has a live target:

   ```bash
   firebase deploy --only functions:userTenants
   ```

   Or deploy all functions:

   ```bash
   firebase deploy --only functions
   ```

## Flow

1. Browser: `GET https://management.wisptools.io/api/user-tenants/{userId}` with `Authorization: Bearer <token>`.
2. Firebase Hosting (management target) rewrites the request to the **userTenants** Cloud Function.
3. **userTenants** verifies the Firebase ID token, then calls the backend: `GET https://hss.wisptools.io/api/internal/user-tenants/{userId}` with `x-internal-key`.
4. Backend (GCE) returns the tenant list; **userTenants** forwards the response to the browser.

## Requirements

- **userTenants** Cloud Function deployed (see above).
- **INTERNAL_API_KEY** set in Firebase (e.g. `firebase functions:secrets:set INTERNAL_API_KEY`) and the same value set on the GCE backend.
- Backend reachable at `BACKEND_HOST` (default `https://hss.wisptools.io`) and route `GET /api/internal/user-tenants/:userId` mounted (e.g. in `backend-services/routes/internal.js`).

## Verify

After deploying the function:

1. Log in at https://management.wisptools.io/login.
2. In DevTools Network tab, confirm `GET .../api/user-tenants/{userId}` returns **200** with a JSON array (possibly empty) of tenants, not 404.
