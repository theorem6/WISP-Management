# Admin API 404/401 via Firebase Hosting Proxy

## Symptoms

- **401** on `GET /api/users` (platform admin)
- **404** on `GET /api/admin/tenants`
- **404** on `GET /api/remote-agents/status`

Requests are sent to `https://management.wisptools.io/api/...`, rewritten by Firebase Hosting to the **apiProxy** Cloud Function, which forwards to the backend at `BACKEND_HOST`.

## Fixes applied in code

### 1. apiProxy path detection (Cloud Functions)

When Firebase Hosting rewrites to the function, the request path can be lost (e.g. `req.url === '/'`). The proxy now:

- Reads **`X-Requested-Path`** from the request headers (frontend sends this for proxy requests).
- Uses it when `req.url` / `originalUrl` are empty or `/`, so the correct backend path is used.

### 2. Frontend sending path for proxy

- **tenantService**: Admin API calls (`getAllTenants`, `getTenantUsers`, etc.) pass the request path into `getAuthHeaders(path)` and set **`X-Requested-Path`** on the request.
- **Admin management page**: `/api/remote-agents/status` is called with **`X-Requested-Path: /api/remote-agents/status`**.
- **userManagementService.getAllUsers**: **`X-Requested-Path: /api/users`** is set so the proxy can forward to the backend `/api/users`.

### 3. Backend CORS

In **backend-services/config/app.js**, the following origins were added so the backend can accept requests from the management app (when needed):

- `https://management.wisptools.io`
- `https://wisptools-management.web.app`
- `https://wisptools-management.firebaseapp.com`

## Backend / deployment checklist

If you still see **404** or **401** after deploying the above:

### 404 from backend

1. **BACKEND_HOST** (Cloud Function env): Must point at the real API server, e.g.  
   `https://hss.wisptools.io` or `https://your-gce-ip:3001` if no reverse proxy.  
   In Firebase: Functions → apiProxy → Environment variables.
2. Backend must be reachable from the internet (or from the Cloud Function’s network) on that URL.
3. If you use nginx in front of the Node app, it must forward the path (e.g. `location / { proxy_pass http://127.0.0.1:3001; }` without stripping the path).

### 401 Unauthorized

1. **Firebase Admin on GCE**: The backend must verify the Firebase ID token. Set one of:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON string), or
   - `FIREBASE_SERVICE_ACCOUNT_KEY` / `GOOGLE_APPLICATION_CREDENTIALS` (path to key file).  
   See e.g. `scripts/set-firebase-admin-on-gce.ps1` and `docs/fixes/AUTH_401_INSUFFICIENT_PERMISSION.md`.
2. **Platform admin**: Backend must treat the logged-in user as platform admin:
   - **PLATFORM_ADMIN_EMAILS**: comma-separated emails (default includes `admin@wisptools.io`).
   - **PLATFORM_ADMIN_UIDS**: comma-separated Firebase UIDs (optional; overrides email for that UID).

Redeploy **apiProxy** after changing `BACKEND_HOST`. Restart the backend on GCE after changing env (Firebase Admin or platform admin).
