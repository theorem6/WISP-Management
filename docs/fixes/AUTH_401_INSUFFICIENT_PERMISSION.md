---
title: Fix 401 Unauthorized on user-tenants
description: Cloud Function + INTERNAL_API_KEY for /api/user-tenants.
---

# Fix: 401 Unauthorized / auth/insufficient-permission on /api/user-tenants

**If you see 401 "Invalid or missing internal key":** run `.\scripts\set-internal-api-key-on-gce.ps1` (after `gcloud auth login`) so the backend and Cloud Function share the same INTERNAL_API_KEY.

**If you see 401 on `/api/admin/tenants` or `/admin/tenants`:** The backend must verify Firebase tokens for admin routes. Set Firebase Admin credentials on the GCE backend: `.\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\wisptools-production-xxxxx.json"`. Also ensure your email is in `PLATFORM_ADMIN_EMAILS` (default: admin@wisptools.io) or set `PLATFORM_ADMIN_UIDS` in backend `.env`.

**If you see "blocked by CORS policy" when the management app (management.wisptools.io) calls hss.wisptools.io:** The backend sends CORS headers (see [CORS and direct backend](#cors-and-direct-backend) below). Deploy the latest backend (explicit CORS middleware in `server.js`) and ensure nginx has `location /api/` and `location /admin/` proxying to Node. Apply `backend-services/scripts/nginx-ssl-config.conf` and reload nginx.

**If user-tenants works (200) but you still get 401 on `/api/tenant-settings`, `/api/plans`, or `/api/notifications`:** the backend must verify Firebase tokens for those routes. Set Firebase Admin on the backend once: get a Firebase service account JSON (Firebase Console → Project Settings → Service accounts → Generate new private key), then run `.\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\wisptools-production-xxxxx.json"`. See [401 on /api/tenant-settings](#401-on-apitenant-settings-apiplans-apinotifications-backend-token-verification) below.

## Fix in use: Cloud Function + INTERNAL_API_KEY (no backend Firebase needed)

`/api/user-tenants/**` is served by the **userTenants** Cloud Function. The function verifies the Firebase token (it has Auth permission) and calls your backend’s internal route with a shared secret. You do **not** need Firebase Admin credentials on the backend for this route.

**Cloud Function** already reads INTERNAL_API_KEY from Firebase Secret Manager (set once via `firebase functions:secrets:set INTERNAL_API_KEY`).

**Backend (GCE acs-hss-server):** set the **same** key on the backend so the internal route accepts calls from the function.

**One-command fix (after gcloud auth):**

```powershell
# If gcloud needs reauth:
gcloud auth login

# Then from repo root – fetches key from Firebase, sets it on GCE backend, restarts main-api:
.\scripts\set-internal-api-key-on-gce.ps1
```

That script gets the key from Firebase Secret Manager, copies it to the GCE instance, updates `/opt/lte-pci-mapper/backend-services/.env` with `INTERNAL_API_KEY=...`, and restarts `main-api`. After it runs, `/api/user-tenants` should return 200 and the tenant system should work.

---

## 404 "Route not found" with path `/` (Nginx stripping path)

**Symptom:** After INTERNAL_API_KEY is set, the app still fails with **404 Not Found** and the error body shows `{ error: 'Route not found', method: 'GET', path: '/', url: '/' }`. The Cloud Function calls the backend at `https://hss.wisptools.io/api/internal/user-tenants/:userId`, but the backend receives the request as path `/` instead of `/api/internal/user-tenants/:userId`.

**Cause:** Nginx on the GCE backend (acs-hss-server) is proxying to the Node app in a way that strips the path (e.g. `proxy_pass` with a trailing slash or missing `location /api/` block), so the Node app only sees `/`.

**Fix:** Apply the Nginx API routing fix on the backend server so `/api/` is proxied with the full path.

**One-command fix (from repo root, after `gcloud auth login`):**

```powershell
.\scripts\fix-nginx-api-routing-on-gce.ps1
```

That script copies `scripts/fix-nginx-api-routing.sh` to the GCE instance and runs it with `sudo` (backup, update `hss-api` config with a `location /api/` block, test, reload nginx).

**Or run manually on the server:**

```bash
# SSH into acs-hss-server, then:
sudo bash /path/to/fix-nginx-api-routing.sh
```

After the fix, `GET https://hss.wisptools.io/api/internal/user-tenants/:userId` (with `X-Internal-Key`) should reach the Node app with the correct path and return 200.

---

## 404 on /api/tenant-settings

**Symptom:** `GET /api/tenant-settings?path=/api/tenant-settings` returns **404**.

**Causes and fixes:**

1. **authProxy path parsing:** Firebase Hosting may pass `req.url` as `/` when rewriting. The frontend sends `?path=/api/tenant-settings` so authProxy can resolve the route. If you still get 404, check Firebase Functions logs for authProxy – it may log `receivedPath: (empty)`.
2. **Missing X-Tenant-ID:** authProxy requires `X-Tenant-ID`. The frontend must send it (tenantSettingsService uses `getAuthHeaders(tenantId)`). If tenant isn’t selected yet, the request may run without it and authProxy returns 400, not 404.
3. **Backend returns 404:** The internal route returns 404 when `Tenant.findById(tenantId)` is null. Confirm the tenant exists and the ID matches (MongoDB `_id` string).
4. **INTERNAL_API_KEY:** Ensure it’s set in Firebase (authProxy) and on the backend. Mismatch causes 401, not 404.

---

## 404 on /api/customer-billing (generate-invoices, dunning/run)

**Symptom:** Frontend calls `POST /api/customer-billing/generate-invoices` or `POST /api/customer-billing/dunning/run` and gets **404 Not Found**.

**Cause:** Firebase Hosting rewrites `/api/**` to the **apiProxy** Cloud Function, which forwards to `BACKEND_HOST` (default `https://hss.wisptools.io`). A 404 usually means (1) the path is not reaching the Node app (nginx stripping path – see [404 with path `/`](#404-route-not-found-with-path--nginx-stripping-path) above), or (2) **BACKEND_HOST** is wrong or the backend is not running.

**Fix:**

1. **Firebase:** Ensure apiProxy has **BACKEND_HOST** set (e.g. `https://hss.wisptools.io`) in the function’s environment or in Firebase config. No port is needed if nginx on that host proxies to the Node app.
2. **GCE nginx:** Ensure `/api/` is proxied to the Node app with the full path. Run: `.\scripts\fix-nginx-api-routing-on-gce.ps1`
3. **Backend:** The backend mounts customer-billing at `/api/customer-billing`; no internal key is required – only **X-Tenant-ID** and (optionally) **Authorization**. If nginx and BACKEND_HOST are correct, these routes should return 200.

---

## 401 on /api/tenant-settings, /api/plans, /api/notifications (backend token verification)

**Symptom:** User tenants list works (200), but **GET /api/tenant-settings**, **GET /api/plans**, **GET /api/notifications** (and other routes that use `verifyAuth`) return **401 Unauthorized** with "Invalid token". The backend uses Firebase Admin to verify the Bearer token; without a service account it falls back to ADC and verification fails.

**Fix:** Set **Firebase Admin credentials** on the GCE backend so `auth().verifyIdToken()` succeeds.

1. **Get a service account key:** Firebase Console → Project Settings (gear) → Service accounts → **Generate new private key** (for project wisptools-production). Save the JSON file locally.
2. **Run the script (from repo root):**
   ```powershell
   .\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\wisptools-production-xxxxx.json"
   .\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\key.json" -GceProject "lte-pci-mapper-65450042-bbf71"
   ```
   The script writes `FIREBASE_SERVICE_ACCOUNT_BASE64` to the backend `.env`, restarts main-api, and removes the temp file from the server.
3. After that, `/api/tenant-settings` and `/api/notifications` (and any other `verifyAuth` route) should return 200 when called with a valid Bearer token.

---

## Alternative: Backend verifies token (Firebase Admin on backend only)

If you prefer not to use the Cloud Function, you can remove the `/api/user-tenants` rewrite so the request goes to apiProxy → backend. Then the backend must verify the Firebase token, so you must set **Firebase Admin credentials** on the backend (see below). No INTERNAL_API_KEY is needed in that setup.

---

## Quick fix (where to do it) – backend credentials (for alternative setup)

- **Where:** The server that actually runs the API and verifies the token. In production this is the **backend** at **`BACKEND_HOST`** (default: **https://hss.wisptools.io**). Firebase Hosting rewrites `/api/**` to the `apiProxy` Cloud Function, which **forwards** the request to that backend. The 401 is returned by that backend when it tries to verify your ID token.
- **What:** On **that backend server** (hss.wisptools.io or whatever hosts your Node API), set **Firebase Admin credentials** (service account JSON or key file) so `auth().verifyIdToken()` can succeed. Then restart the backend.
- **How:** See options below (env var `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_BASE64`, or key file path).

## Symptom

- After login, the app calls `GET /api/user-tenants/:userId` and gets **401 Unauthorized**.
- Console error: **"Credential implementation provided to initializeApp() via the 'credential' property has insufficient permission to access the requested resource"** (`auth/insufficient-permission`).
- TenantGuard redirects to tenant setup; tenant list never loads.

## Cause

The **backend** (API server that handles `/api/user-tenants`) uses the Firebase Admin SDK to verify the user’s ID token via `auth().verifyIdToken()`. That call requires the **credential** used to initialize the Admin SDK to have permission to use the Firebase Authentication API.

On **production** (e.g. wisptools.io), if no Firebase Admin service account is configured, the backend falls back to **Application Default Credentials (ADC)** (e.g. the default compute/service account). That identity often does **not** have Firebase Auth permissions, so token verification fails with `auth/insufficient-permission` and the API returns 401.

## Fix (production backend)

You must give the backend **explicit Firebase Admin credentials** for the project `wisptools-production`. Use one of the options below.

### Option 1: Service account JSON in an environment variable (recommended)

1. In [Firebase Console](https://console.firebase.google.com) → **Project Settings** (gear) → **Service accounts** → **Generate new private key** for the Firebase Admin SDK.  
   This downloads a JSON key for the project (e.g. `wisptools-production-xxxxx.json`).

2. On the **production API server** (or in your hosting env config, e.g. Cloud Run / GCE / Vercel):
   - Either set **`FIREBASE_SERVICE_ACCOUNT_JSON`** to the **entire JSON string** (escape newlines if needed),  
   - Or set **`FIREBASE_SERVICE_ACCOUNT_BASE64`** to the **base64-encoded** JSON:
     ```bash
     # Base64 (no newlines in output)
     base64 -w0 wisptools-production-xxxxx.json
     ```
     Then set that value in your production env, e.g.:
     ```bash
     export FIREBASE_SERVICE_ACCOUNT_BASE64='<paste base64 here>'
     ```

3. Restart the backend so it picks up the new env.  
   On startup you should see: **"Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_JSON"** or **"Using FIREBASE_SERVICE_ACCOUNT_BASE64"**.

### Option 2: Service account key file on disk

1. Obtain the same Firebase Admin SDK JSON key (see Option 1, step 1).

2. Place it on the server (e.g. `/opt/.../wisptools-production-firebase-adminsdk.json`) and set:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_KEY=/path/to/wisptools-production-firebase-adminsdk.json
   # or
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/wisptools-production-firebase-adminsdk.json
   ```

3. Restart the backend. Logs should show: **"Firebase Admin: Using service account file from environment path"**.

### Option 3: Keep using ADC (e.g. Cloud Run default SA)

If the backend **must** use Application Default Credentials (no key file, no JSON env):

1. In [Google Cloud Console](https://console.cloud.google.com) → **IAM & Admin** → **IAM**.
2. Find the **service account** used by your backend (e.g. Cloud Run default compute SA).
3. Add a role that allows Firebase Auth API access, e.g.:
   - **Firebase Authentication Admin**, or  
   - A custom role that includes `firebaseauth.users.get` (or the permission required for Admin Auth).

Then redeploy/restart so token verification uses that identity.

## Verification

After applying the fix:

1. Backend startup logs should show one of:
   - `Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_JSON`
   - `Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_BASE64`
   - `Firebase Admin: Using service account file from environment path`
   and **not** “Falling back to application default credentials (ADC)” unless you intentionally use Option 3.

2. Log in at https://wisptools.io/login and open the app. The request to `/api/user-tenants/:userId` should return **200** with your tenant list, and TenantGuard should no longer redirect to tenant setup due to 401.

## Reference

- **Production flow:** Browser → wisptools.io → Firebase Hosting rewrite → `apiProxy` Cloud Function → **BACKEND_HOST** (e.g. hss.wisptools.io). The backend at BACKEND_HOST is what returns 401; configure credentials there.
- Backend Firebase init: `backend-services/config/firebase.js`
- Auth middleware (verifyIdToken): `backend-services/routes/users/role-auth-middleware.js`
- Route: `backend-services/routes/users/tenant-details.js` (GET `/api/user-tenants/:userId`)
- apiProxy backend URL: `functions/src/index.ts` uses `process.env.BACKEND_HOST || 'https://hss.wisptools.io'`
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)

---

## CORS and direct backend (management → hss)

The management app (https://management.wisptools.io) can call the backend at **https://hss.wisptools.io** directly (no Firebase Hosting proxy). That is cross-origin, so the backend must send CORS headers and respond to OPTIONS (preflight).

**Backend:** `backend-services/server.js` has an explicit CORS middleware (first in the stack) that (1) sets `Access-Control-Allow-Origin` to the request `Origin` when it is in the allowed list (e.g. `https://management.wisptools.io`), (2) sets `Access-Control-Allow-Credentials`, `Allow-Methods`, `Allow-Headers`, and (3) responds to **OPTIONS** with **204** and no body. Deploy this backend to GCE so CORS works.

**Nginx on GCE:** Proxy both `/api/` and `/admin/` to the Node app so OPTIONS and GET/POST reach Node. Use `backend-services/scripts/nginx-ssl-config.conf` (it includes `location /api/` and `location /admin/`). Reload nginx after updating config.

**Firebase Admin for /api/users and /admin/tenants:** These routes use `verifyAuth` and require a valid Firebase ID token. Set `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_BASE64` (or key file) on the backend so token verification succeeds; otherwise you get 401 even when CORS is fixed.
