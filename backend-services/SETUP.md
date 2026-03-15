# WISP Management Backend Setup

Main API server for wisptools.io: auth, tenants, customers, billing, HSS, monitoring, and more.

## Quick Start (Local)

```bash
cd backend-services
cp .env.example .env
# Edit .env: set MONGODB_URI and INTERNAL_API_KEY (required)
npm install
npm start
```

Health check: http://localhost:3001/health

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (Atlas or local) |
| `INTERNAL_API_KEY` | Shared secret for `/api/internal/*` routes. Must match Firebase Functions `INTERNAL_API_KEY`. Generate: `openssl rand -base64 32` |

## Optional (Production)

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON string of Firebase service account |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Base64-encoded JSON (recommended on GCE) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Path to `.json` file |
| `FIREBASE_PROJECT_ID` | Default: `wisptools-production` |

Firebase Admin is only needed if the backend verifies tokens directly. If apiProxy/userTenants Cloud Functions handle auth and call `/api/internal/*` with `INTERNAL_API_KEY`, you can omit Firebase credentials on the backend.

## Production (PM2)

```bash
cd backend-services
# Ensure .env has MONGODB_URI, INTERNAL_API_KEY, and any Firebase/ARCGIS/SMTP keys
pm2 start ecosystem.config.js
pm2 save
```

## Ports

- **3001** – Main API (server.js)
- **3002** – EPC/ISO server (min-epc-server.js), optional

## Troubleshooting

- **401 on /api/user-tenants or /api/tenant-settings:** Set `INTERNAL_API_KEY` on backend to match Firebase. See `docs/fixes/AUTH_401_INSUFFICIENT_PERMISSION.md`
- **404 with path `/`:** Nginx may be stripping the path. Run `scripts/fix-nginx-api-routing-on-gce.ps1`
- **MongoDB connection fails:** Verify `MONGODB_URI` in `.env` and network access (Atlas IP allowlist)
