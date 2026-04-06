// Firebase Functions - Main Entry Point
// Combines PCI analysis and GenieACS integration

// Import shared Firebase initialization (must be first)
import { db, auth } from './firebaseInit.js';

// Export notification functions
export { onWorkOrderAssigned, onNotificationCreated } from './notifications.js';

// Export admin setup function
export { setupAdmin } from './setupAdmin.js';

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { FieldValue } from 'firebase-admin/firestore';
import { FUNCTIONS_CONFIG } from './config.js';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import http from 'http';
import https from 'https';

const corsHandler = cors({ origin: [...FUNCTIONS_CONFIG.cors.origins] });

// PCI Analysis Function (existing)
export const analyzePCI = onRequest({
  region: FUNCTIONS_CONFIG.functions.defaultOptions.region,
  memory: FUNCTIONS_CONFIG.functions.defaultOptions.memory,
  timeoutSeconds: FUNCTIONS_CONFIG.functions.defaultOptions.timeoutSeconds
}, async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { cells } = req.body;
      
      if (!cells || !Array.isArray(cells)) {
        return res.status(400).json({ error: 'Invalid cells data' });
      }

      // Analyze PCI conflicts (simplified version)
      const conflicts = analyzeConflictsSimple(cells);
      
      // Save analysis to Firestore
      const analysisRef = await db.collection('pci_analyses').add({
        cells: cells,
        conflicts: conflicts,
        timestamp: FieldValue.serverTimestamp(),
        cellCount: cells.length,
        conflictCount: conflicts.length
      });

      return res.json({
        analysisId: analysisRef.id,
        conflicts: conflicts,
        summary: {
          totalCells: cells.length,
          totalConflicts: conflicts.length,
          criticalConflicts: conflicts.filter(c => c.severity === 'CRITICAL').length
        }
      });
    } catch (error) {
      console.error('PCI Analysis Error:', error);
      return res.status(500).json({ error: 'Analysis failed' });
    }
  });
});

// Export GenieACS bridge functions (connects to real GenieACS)
// NOTE: Single-tenant versions are deprecated - use multi-tenant versions below
// Keeping for backward compatibility but not recommended for new implementations
/*
export {
  proxyGenieACSNBI,
  syncGenieACSDevices,
  getDeviceParameters,
  executeDeviceTask,
  getDevicePerformanceMetrics
} from './genieacsBridge.js';

// Export simplified GenieACS integration functions (Firestore only - fallback)
export {
  syncCPEDevices,
  getCPEDevices,
  getCPEDevice,
  updateCPELocation,
  getCPEPerformanceMetrics
} from './simpleGenieacsIntegration.js';

// Export simplified GenieACS core services (placeholders)
export {
  genieacsCWMP,
  genieacsNBI,
  genieacsFS,
  genieacsUI
} from './simpleGenieacsServices.js';
*/

// Export Multi-Tenant GenieACS functions (PRIMARY - USE THESE)
export {
  proxyGenieACSNBIMultitenant,
  syncGenieACSDevicesMultitenant,
  handleCWMPMultitenant,
  getDeviceParametersMultitenant,
  executeDeviceTaskMultitenant
} from './genieacsBridgeMultitenant.js';

export {
  genieacsNBIMultitenant,
  genieacsFSMultitenant
} from './genieacsServicesMultitenant.js';


// Export Firestore-based presets management (legacy - fallback)
export {
  getPresets,
  createPreset,
  deletePreset,
  initializeSamplePresets
} from './cleanPresetsManagement.js';

// Export Firestore-based faults management (legacy - fallback)
export {
  getFaults,
  getFault,
  createFault,
  resolveFault,
  initializeSampleFaults
} from './faultsManagement.js';

// Export MongoDB-backed presets management (primary)
export {
  getMongoPresets,
  createMongoPreset,
  updateMongoPreset,
  deleteMongoPreset,
  toggleMongoPreset
} from './mongoPresetsManagement.js';

// Export MongoDB-backed faults management (primary)
export {
  getMongoFaults,
  getMongoFault,
  acknowledgeMongoFault,
  deleteMongoFault,
  createMongoFault,
  deleteResolvedMongoFaults
} from './mongoFaultsManagement.js';

// Export MongoDB initialization and health check functions
export {
  checkMongoHealth,
  initializeMongoPresets,
  initializeMongoFaults,
  initializeMongoDatabase
} from './mongoInitialization.js';

// Export CBRS Management functions (modular)
export {
  getCBRSDevices,
  saveCBRSDevice,
  deleteCBRSDevice,
  logCBRSEvent,
  proxySASRequest,
  getSASUserIDs,
  getSASInstallations,
  getCBRSAnalytics,
  cbrsWebhook,
  saveCbrsConfigSecure,
  loadCbrsConfigSecure
} from './cbrs/index.js';

// Simple PCI conflict detection function (existing)
function analyzeConflictsSimple(cells: any[]) {
  const conflicts: any[] = [];
  
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];
      
      // Check for PCI conflicts
      if (cell1.pci === cell2.pci) {
        conflicts.push({
          type: 'COLLISION',
          severity: 'CRITICAL',
          cell1: cell1,
          cell2: cell2,
          distance: calculateDistance(cell1, cell2)
        });
      }
      
      // Check for Mod3 conflicts
      if (cell1.pci % 3 === cell2.pci % 3) {
        conflicts.push({
          type: 'MOD3',
          severity: 'HIGH',
          cell1: cell1,
          cell2: cell2,
          distance: calculateDistance(cell1, cell2)
        });
      }
    }
  }
  
  return conflicts;
}

// Calculate distance between two cells
function calculateDistance(cell1: any, cell2: any): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(cell2.latitude - cell1.latitude);
  const dLon = toRadians(cell2.longitude - cell1.longitude);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(cell1.latitude)) * Math.cos(toRadians(cell2.latitude)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// User Tenants - Verifies Firebase token in Cloud Function (has Auth permission), then calls backend internal API.
// Workaround for backend auth/insufficient-permission when backend uses ADC.
// invoker: 'public' so Hosting/browser can call this URL; we verify the Bearer token inside the function.
// INTERNAL_API_KEY: set via "firebase functions:secrets:set INTERNAL_API_KEY" (then set same value on backend).
export const userTenants = onRequest({
  region: FUNCTIONS_CONFIG.functions.apiProxy.region,
  memory: '256MiB',
  timeoutSeconds: 30,
  cors: true,
  invoker: 'public',
  secrets: ['INTERNAL_API_KEY']
}, async (req, res) => {
  const allowedOrigins: string[] = [...FUNCTIONS_CONFIG.cors.origins];
  const origin = (req.headers.origin as string) || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*');
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
  res.set('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const internalKey = process.env.INTERNAL_API_KEY;
  const backendHost = process.env.BACKEND_HOST || 'https://hss.wisptools.io';
  if (!internalKey) {
    console.error('[userTenants] INTERNAL_API_KEY not set');
    res.status(503).json({ error: 'Service misconfiguration', message: 'INTERNAL_API_KEY not set' });
    return;
  }

  // Path: /api/user-tenants/:userId (from Hosting rewrite; Hosting may send full path in req.url or x-original-url)
  let path = (req.url || (req as any).originalUrl || '').split('?')[0] || (req as any).path || '';
  if ((!path || path === '/') && (req.headers['x-original-url'] as string)) {
    try {
      path = new URL(req.headers['x-original-url'] as string).pathname;
    } catch {
      path = '';
    }
  }
  if (path.startsWith('http')) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = '';
    }
  }
  const match = path.match(/\/api\/user-tenants\/([^/]+)/);
  const userId = match ? match[1] : null;
  if (!userId) {
    res.status(400).json({ error: 'Bad Request', message: 'userId required in path', path });
    return;
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token' });
    return;
  }

  try {
    const decoded = await auth.verifyIdToken(token, true);
    if (decoded.uid !== userId) {
      res.status(403).json({ error: 'Forbidden', message: 'User can only request own tenants' });
      return;
    }
  } catch (e: any) {
    console.error('[userTenants] Token verification failed:', e?.message);
    res.status(401).json({
      error: 'Invalid token',
      message: e?.message || 'Token verification failed',
      code: e?.code || 'unknown'
    });
    return;
  }

  try {
    const path = `/api/internal/user-tenants/${userId}`;
    const url = `${backendHost}${path}`;
    const ax = await axios.get(url, {
      timeout: 15000,
      headers: {
        'x-internal-key': internalKey,
        'x-original-path': path  // workaround when LB/nginx strips path to /
      },
      responseType: 'json',
      validateStatus: () => true
    });
    // Backend 404 (e.g. route not found, or wrong BACKEND_HOST) → treat as no tenants so app still works
    if (ax.status === 404) {
      console.warn('[userTenants] Backend returned 404, returning empty tenant list for userId:', userId);
      res.status(200).set('Content-Type', 'application/json').json([]);
      return;
    }
    res.status(ax.status).set('Content-Type', 'application/json').send(ax.data);
  } catch (e: any) {
    console.error('[userTenants] Backend call failed:', e?.message);
    // Network/backend down → return empty list so user can still reach tenant selector / create tenant
    res.status(200).set('Content-Type', 'application/json').json([]);
  }
});

// Auth Proxy - Verifies Firebase token then calls backend internal routes for tenant-settings and plans.
// Fixes 401 on GCE when backend has no Firebase Admin: token is verified here, backend receives internal key + X-Tenant-ID.
export const authProxy = onRequest({
  region: FUNCTIONS_CONFIG.functions.apiProxy.region,
  memory: '256MiB',
  timeoutSeconds: 30,
  cors: true,
  invoker: 'public',
  secrets: ['INTERNAL_API_KEY']
}, async (req, res) => {
  const allowedOrigins: string[] = [...FUNCTIONS_CONFIG.cors.origins];
  const origin = (req.headers.origin as string) || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*');
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
  res.set('Access-Control-Max-Age', '3600');
  res.set('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const internalKey = process.env.INTERNAL_API_KEY;
  const backendHost = process.env.BACKEND_HOST || 'https://hss.wisptools.io';
  if (!internalKey) {
    console.error('[authProxy] INTERNAL_API_KEY not set');
    res.status(503).json({ error: 'Service misconfiguration', message: 'INTERNAL_API_KEY not set' });
    return;
  }

  // Path resolution: when Hosting rewrites to function, req.url can be '/' or path+query - use all fallbacks
  const rawUrl = req.url || '';
  let path = rawUrl.split('?')[0] || (req as any).path || '';
  if (path.startsWith('http')) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = '';
    }
  }
  if ((!path || path === '/') && (req.headers['x-original-url'] as string)) {
    const x = req.headers['x-original-url'] as string;
    path = x.startsWith('http') ? (() => { try { return new URL(x).pathname; } catch { return x; } })() : x;
  }
  if ((!path || path === '/') && (req.headers['x-forwarded-path'] as string)) {
    path = (req.headers['x-forwarded-path'] as string).startsWith('/')
      ? (req.headers['x-forwarded-path'] as string) : `/${req.headers['x-forwarded-path']}`;
  }
  if ((!path || path === '/') && (req.headers['x-forwarded-request-uri'] as string)) {
    const x = (req.headers['x-forwarded-request-uri'] as string).split('?')[0];
    if (x.startsWith('/')) path = x;
  }
  if ((!path || path === '/') && (req as any).query?.path && typeof (req as any).query.path === 'string') {
    const qPath = (req as any).query.path as string;
    if (qPath.startsWith('/')) path = qPath.split('?')[0];
  }
  // Cloud Run may not populate req.query; parse path from query string in req.url (e.g. /?path=/api/tenant-settings)
  if ((!path || path === '/') && rawUrl.includes('?')) {
    try {
      const qs = rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?') + 1) : '';
      const params = new URLSearchParams(qs);
      const qPath = params.get('path');
      if (qPath && qPath.startsWith('/')) path = qPath.split('?')[0];
    } catch {
      // ignore
    }
  }
  // If path still empty, authProxy is only used for tenant-settings and plans - treat as tenant-settings
  if ((!path || path === '/') && (req.method === 'GET' || req.method === 'PUT')) {
    path = '/api/tenant-settings';
  }
  const query = rawUrl.includes('?') ? rawUrl.split('?')[1] || '' : '';
  const isTenantSettings = path === '/api/tenant-settings' || path.endsWith('/api/tenant-settings');
  const isPlans = path === '/api/plans' || path === '/api/plans/';
  if (!isTenantSettings && !isPlans) {
    res.status(404).json({ error: 'Not found', message: 'authProxy only handles /api/tenant-settings and GET /api/plans', receivedPath: path || '(empty)' });
    return;
  }

  const tenantId = (req.headers['x-tenant-id'] || req.headers['X-Tenant-ID']) as string;
  if (!tenantId) {
    res.status(400).json({ error: 'Bad Request', message: 'X-Tenant-ID header required' });
    return;
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token' });
    return;
  }

  try {
    await auth.verifyIdToken(token, true);
  } catch (e: any) {
    console.error('[authProxy] Token verification failed:', e?.message);
    res.status(401).json({
      error: 'Invalid token',
      message: e?.message || 'Token verification failed',
      code: e?.code || 'unknown'
    });
    return;
  }

  try {
    const internalPath = isTenantSettings ? '/api/internal/tenant-settings' : '/api/internal/plans';
    const url = query ? `${backendHost}${internalPath}?${query}` : `${backendHost}${internalPath}`;
    const method = req.method as 'GET' | 'PUT';
    const headers: Record<string, string> = {
      'x-internal-key': internalKey,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    };
    if (method === 'PUT' && req.body) {
      const ax = await axios.put(url, req.body, { timeout: 15000, headers, responseType: 'json', validateStatus: () => true });
      res.status(ax.status).set('Content-Type', 'application/json').send(ax.data);
    } else {
      const ax = await axios.get(url, { timeout: 15000, headers, responseType: 'json', validateStatus: () => true });
      res.status(ax.status).set('Content-Type', 'application/json').send(ax.data);
    }
  } catch (e: any) {
    console.error('[authProxy] Backend call failed:', e?.message);
    res.status(502).json({ error: 'Bad Gateway', message: e?.message || 'Backend request failed' });
  }
});

// Main API Proxy - Provides HTTPS endpoint for unified backend API (Port 3001)
// Handles all API routes: customers, work-orders, inventory, plans, HSS, billing, etc.
// Also handles GET /api/user-tenants/:userId when Hosting routes it here (fallback for custom domain).
export const apiProxy = onRequest({
  region: FUNCTIONS_CONFIG.functions.apiProxy.region,
  memory: FUNCTIONS_CONFIG.functions.apiProxy.memory,
  timeoutSeconds: FUNCTIONS_CONFIG.functions.apiProxy.timeoutSeconds,
  cors: true,
  secrets: ['INTERNAL_API_KEY']
}, async (req, res) => {
  // Set CORS headers explicitly and reflect origin
  // Allow all authorized Firebase Hosting domains (from centralized config)
  const allowedOrigins: string[] = [...FUNCTIONS_CONFIG.cors.origins];
  
  const origin = (req.headers.origin as string) || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*');
  
  res.set('Access-Control-Allow-Origin', allowedOrigin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-tenant-id, X-Tenant-ID, x-user-email, X-User-Email, x-requested-path, X-Requested-Path, x-internal-key, X-Internal-Key, x-firebase-uid, X-Firebase-Uid'
  );
  res.set('Access-Control-Max-Age', '3600');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Vary', 'Origin');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Get path early (req.url can be '/' when Hosting rewrites to function; try headers)
  let earlyPath = (req.url || (req as any).originalUrl || '').split('?')[0] || '';
  if (earlyPath.startsWith('http')) {
    try {
      earlyPath = new URL(earlyPath).pathname;
    } catch {
      earlyPath = '';
    }
  }
  if ((!earlyPath || earlyPath === '/') && (req.headers['x-original-url'] as string)) {
    const x = req.headers['x-original-url'] as string;
    earlyPath = x.startsWith('http') ? (() => { try { return new URL(x).pathname; } catch { return x; } })() : x;
  }
  if ((!earlyPath || earlyPath === '/') && (req.headers['x-forwarded-path'] as string)) {
    earlyPath = (req.headers['x-forwarded-path'] as string).startsWith('/')
      ? (req.headers['x-forwarded-path'] as string) : `/${req.headers['x-forwarded-path']}`;
  }

  // GET /api/user-tenants/:userId is forwarded to backend /api/user-tenants/:userId with
  // Authorization header; backend tenant-details route verifies Firebase token (no internal key).

  // Build the full path from originalUrl (falls back to url/path) and strip the function mount if present
  // When called via direct Cloud Function URL, path may be: /apiProxy/api/customers
  // When called via Firebase Hosting rewrite, the original path is preserved in req.url
  // When called via Cloud Run service directly, path is: /api/customers
  // For Firebase Functions v2 onRequest, req.url contains the full path including query string
  // req.path may be just '/' for rewrites, so we prioritize req.url
  let incoming = '';
  const rawUrl = req.url || (req as any).originalUrl || '';
  // req.url may be path-only (/api/notifications) or full URL (https://wisptools.io/api/notifications)
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    try {
      const u = new URL(rawUrl);
      incoming = u.pathname || '';
    } catch {
      incoming = rawUrl;
    }
  } else if (rawUrl && rawUrl !== '/') {
    incoming = rawUrl;
  } else if (req.path && req.path !== '/') {
    incoming = req.path;
  }
  // Fallback: proxy headers (Firebase Hosting may not pass path; frontend sends X-Requested-Path)
  if (!incoming || incoming === '/') {
    const xRequestedPath = req.headers['x-requested-path'] as string | undefined;
    const xOriginal = req.headers['x-original-url'] as string | undefined;
    const xForwardedPath = req.headers['x-forwarded-path'] as string | undefined;
    const xForwardedRequestUri = req.headers['x-forwarded-request-uri'] as string | undefined;
    if (typeof xRequestedPath === 'string' && xRequestedPath.startsWith('/')) {
      incoming = xRequestedPath.split('?')[0];
    } else if (xOriginal?.startsWith('http')) {
      try {
        incoming = new URL(xOriginal).pathname || '';
      } catch {
        incoming = xOriginal;
      }
    } else if (xOriginal?.startsWith('/')) {
      incoming = xOriginal;
    } else if (xForwardedPath) {
      incoming = xForwardedPath.startsWith('/') ? xForwardedPath : `/${xForwardedPath}`;
    } else if (xForwardedRequestUri) {
      const p = xForwardedRequestUri.split('?')[0];
      if (p.startsWith('/')) incoming = p;
    }
  }

  // Strip /apiProxy prefix if present (when called directly via Cloud Function URL)
  if (incoming.startsWith('/apiProxy')) {
    incoming = incoming.substring('/apiProxy'.length);
  } else if (incoming.startsWith('apiProxy/')) {
    incoming = incoming.substring('apiProxy/'.length);
  }
  
  // For Firebase Hosting rewrites, the path might include query string
  // Extract just the pathname if query string is present
  if (incoming.includes('?')) {
    incoming = incoming.split('?')[0];
  }
  
  // Ensure path starts with / for backend URL construction
  let proxiedPath = incoming.startsWith('/') ? incoming : (incoming ? `/${incoming}` : '');

  // When path is empty, use ?path= from query (Cloud Run / 2nd gen may not put query in req.url)
  if (!proxiedPath || proxiedPath === '/') {
    const qPath = (req as any).query?.path;
    if (typeof qPath === 'string' && qPath.startsWith('/')) {
      proxiedPath = qPath.split('?')[0];
    }
  }
  if ((!proxiedPath || proxiedPath === '/') && rawUrl.includes('?')) {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `http://host${rawUrl}`);
      const qPath = u.searchParams.get('path');
      if (qPath && qPath.startsWith('/')) {
        proxiedPath = qPath.split('?')[0];
      }
    } catch {
      // ignore
    }
  }
  // Last resort: use X-Requested-Path for proxiedPath when Hosting strips path (e.g. 2nd gen rewrite)
  if (!proxiedPath || proxiedPath === '/') {
    const xPath = req.headers['x-requested-path'] as string | undefined;
    if (typeof xPath === 'string' && xPath.startsWith('/')) {
      let p = xPath.split('?')[0];
      if (p.startsWith('/apiProxy')) p = p.substring('/apiProxy'.length);
      if (p) proxiedPath = p.startsWith('/') ? p : `/${p}`;
    }
  }

  // Normalize admin routes at the very end so this also applies to ?path=/api/admin/... fallbacks.
  // Backend mounts admin routes at /admin/* (not /api/admin/*).
  if (proxiedPath.startsWith('/api/admin')) {
    proxiedPath = proxiedPath.substring('/api'.length); // /api/admin/... -> /admin/...
  }

  // Backend Service Architecture:
  // - Port 3001: Unified Main API Server (backend-services/server.js)
  //   Handles ALL routes: /api/customers, /api/work-orders, /api/hss, /api/inventory,
  //   /api/plans, /api/maintain, /api/billing, /admin/** etc.
  // - Port 3002: EPC/ISO Generation API (min-epc-server.js) - Handles /api/deploy/**
  // Note: Port 3000 is available for separate HSS service if needed in future
  // Use domain name instead of IP address (hss.wisptools.io per memory)
  // Port 3001 is for the HSS Management API (per memory)
  // Backend server runs HTTP on port 3001
  // Fallback to IP if domain doesn't resolve (Firebase Functions network issue)
  const backendHost = process.env.BACKEND_HOST || 'https://hss.wisptools.io';
  const url = `${backendHost}${proxiedPath}`;
  
  // Log request details for debugging
  console.log('[apiProxy] Request details:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: (req as any).originalUrl,
    rawRequestUrl: (req as any).rawRequest?.url,
    processedPath: proxiedPath,
    finalUrl: url,
    headers: Object.keys(req.headers || {}),
    authHeaders: {
      authorization: req.headers['authorization'] ? 'present' : 'missing',
      Authorization: req.headers['Authorization'] ? 'present' : 'missing',
      allAuthKeys: Object.keys(req.headers || {}).filter(h => h.toLowerCase().includes('auth'))
    },
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : 'null/undefined'
  });
  
  // Validate that we have a valid path
  if (!proxiedPath || proxiedPath === '/') {
    console.error('[apiProxy] ERROR: Empty or invalid path after processing:', {
      incoming,
      proxiedPath,
      originalUrl: (req as any).originalUrl,
      url: req.url,
      path: req.path
    });
    res.set('Access-Control-Allow-Origin', origin).status(400).json({
      error: 'Invalid request path',
      message: 'No valid API path found in request',
      details: {
        originalUrl: (req as any).originalUrl,
        url: req.url,
        path: req.path
      }
    });
    return;
  }

  // GET /api/user-tenants/tenant/:tenantId - verify token here and call backend internal route
  // so backend does not need Firebase Admin (avoids 401 when GCE has no credentials)
  const tenantDetailsMatch = proxiedPath.match(/^\/api\/user-tenants\/tenant\/([^/]+)$/);
  if (req.method === 'GET' && tenantDetailsMatch) {
    const internalKey = process.env.INTERNAL_API_KEY;
    const backendHost = process.env.BACKEND_HOST || 'https://hss.wisptools.io';
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!internalKey) {
      console.error('[apiProxy] INTERNAL_API_KEY not set for tenant-details');
      res.set('Access-Control-Allow-Origin', origin).status(503).json({ error: 'Service misconfiguration' });
      return;
    }
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.set('Access-Control-Allow-Origin', origin).status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      res.set('Access-Control-Allow-Origin', origin).status(401).json({ error: 'Unauthorized', message: 'No token' });
      return;
    }
    try {
      const decoded = await auth.verifyIdToken(token, true);
      const uid = decoded.uid;
      const tenantId = tenantDetailsMatch[1];
      const internalUrl = `${backendHost}/api/internal/tenant-details/${encodeURIComponent(tenantId)}`;
      const ax = await axios.get(internalUrl, {
        timeout: 15000,
        headers: {
          'x-internal-key': internalKey,
          'x-firebase-uid': uid,
          'Content-Type': 'application/json'
        },
        responseType: 'json',
        validateStatus: () => true
      });
      res.status(ax.status).set('Content-Type', 'application/json').send(ax.data);
      return;
    } catch (e: any) {
      console.error('[apiProxy] tenant-details token verify or backend call failed:', e?.message);
      res.set('Access-Control-Allow-Origin', origin).status(e?.response?.status === 404 ? 404 : 401).json({
        error: e?.response?.data?.error || 'Unauthorized',
        message: e?.response?.data?.message || e?.message || 'Token verification or backend request failed'
      });
      return;
    }
  }

  // POST /api/tenants — verify token here and call internal route so backend does not need
  // Firebase Admin for verifyIdToken (avoids 401 when GCE has no credentials).
  const isPostFirstTenant =
    req.method === 'POST' &&
    (proxiedPath === '/api/tenants' || proxiedPath === '/api/tenants/');
  if (isPostFirstTenant) {
    const internalKey = process.env.INTERNAL_API_KEY;
    const bh = process.env.BACKEND_HOST || 'https://hss.wisptools.io';
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!internalKey) {
      console.error('[apiProxy] INTERNAL_API_KEY not set for first-tenant');
      res.set('Access-Control-Allow-Origin', origin).status(503).json({ error: 'Service misconfiguration' });
      return;
    }
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.set('Access-Control-Allow-Origin', origin).status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      res.set('Access-Control-Allow-Origin', origin).status(401).json({ error: 'Unauthorized', message: 'No token' });
      return;
    }
    try {
      const decoded = await auth.verifyIdToken(token, true);
      const uid = decoded.uid;
      const email = decoded.email || '';
      const internalUrl = `${bh}/api/internal/first-tenant`;
      const ax = await axios.post(internalUrl, req.body, {
        timeout: 30000,
        headers: {
          'x-internal-key': internalKey,
          'x-firebase-uid': uid,
          'x-firebase-email': email,
          'Content-Type': 'application/json'
        },
        responseType: 'json',
        validateStatus: () => true
      });
      res.status(ax.status).set('Content-Type', 'application/json').send(ax.data);
      return;
    } catch (e: any) {
      console.error('[apiProxy] first-tenant token verify or backend call failed:', e?.message);
      const status = e?.response?.status;
      res.set('Access-Control-Allow-Origin', origin).status(status && status >= 400 ? status : 401).json({
        error: e?.response?.data?.error || 'Unauthorized',
        message: e?.response?.data?.message || e?.message || 'Token verification or backend request failed'
      });
      return;
    }
  }
  
  try {
    // Create Axios instance with retry logic for this request
    const axiosInstance = axios.create({
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json'
      },
      // Keep connections alive for better performance
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });

    // Configure retry logic
    axiosRetry(axiosInstance, {
      retries: 3, // Retry up to 3 times
      retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
      retryCondition: (error: AxiosError) => {
        // Retry on network errors or 5xx server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ? error.response.status >= 500 : false) ||
               error.code === 'ECONNREFUSED' ||
               error.code === 'ETIMEDOUT' ||
               error.code === 'ENOTFOUND';
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`[apiProxy] Retry attempt ${retryCount} for ${requestConfig.url}`, {
          errorCode: error.code,
          status: (error as AxiosError).response?.status
        });
      },
    });

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Original-Path': proxiedPath // Backend uses this when nginx strips path to /
    };
    
    // Forward x-tenant-id if present (check both lowercase and camelCase)
    const tenantId = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    if (tenantId) {
      headers['x-tenant-id'] = tenantId as string;
      console.log('[apiProxy] Forwarding tenant ID:', tenantId);
    } else {
      console.warn('[apiProxy] No tenant ID header found. Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('tenant')));
    }
    
    // Forward Authorization header if present (check both cases - Firebase Functions normalizes to lowercase)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader) {
      const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      headers['Authorization'] = authValue as string;
      console.log('[apiProxy] Forwarding Authorization header (length:', authValue.length, 'starts with:', authValue.substring(0, 20) + '...)');
    } else {
      console.error('[apiProxy] ❌ No Authorization header found! Available headers:', Object.keys(req.headers));
      console.error('[apiProxy] All header keys:', JSON.stringify(Object.keys(req.headers || {})));
    }
    
    const userEmailHeader = req.headers['x-user-email'] || req.headers['X-User-Email'];
    if (userEmailHeader) {
      const emailValue = Array.isArray(userEmailHeader) ? userEmailHeader[0] : userEmailHeader;
      headers['x-user-email'] = emailValue as string;
      console.log('[apiProxy] Forwarding user email header:', emailValue);
    }
    
    // Prepare request config
    const axiosConfig: any = {
      method: req.method as any,
      url: url,
      headers: headers,
      responseType: 'json', // Default to JSON, will change for text responses
      validateStatus: () => true, // Don't throw on any status code
    };
    
    // Add body for non-GET/HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        // Empty body
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          axiosConfig.data = {};
        }
      } else if (typeof req.body === 'string') {
        // If body is already a string, use it directly
        axiosConfig.data = req.body;
        console.log('[apiProxy] Body is already string, length:', req.body.length);
      } else {
        // Body is an object - Axios will automatically stringify it
        axiosConfig.data = req.body;
        console.log('[apiProxy] Body object, keys:', Object.keys(req.body));
      }
    }
    
    // Determine response type based on URL
    if (url.includes('deployment-script')) {
      axiosConfig.responseType = 'text';
    }
    
    const response = await axiosInstance.request(axiosConfig);
    
    // Log response status for debugging
    console.log('[apiProxy] Backend response:', {
      status: response.status,
      statusText: response.statusText,
      url: url,
      contentType: response.headers['content-type']
    });
    
    // Check content type to determine how to handle response
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json') || axiosConfig.responseType === 'json') {
      const data = response.data;
      
      // Log error responses with full details
      if (response.status >= 400) {
        console.error('[apiProxy] Backend returned error:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          errorData: data
        });
      }
      
      res.set('Access-Control-Allow-Origin', origin).status(response.status).json(data);
    } else if (contentType.includes('text/') || url.includes('deployment-script') || typeof response.data === 'string') {
      // Handle text responses (like shell scripts)
      const text = typeof response.data === 'string' ? response.data : String(response.data);
      
      // Log error responses
      if (response.status >= 400) {
        console.error('[apiProxy] Backend returned text error:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          text: text.substring(0, 500) // First 500 chars
        });
      }
      
      res.set('Access-Control-Allow-Origin', origin).status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
    } else {
      // Fallback: try to send as JSON
      const data = response.data;
      
      if (response.status >= 400) {
        console.error('[apiProxy] Backend returned error (fallback):', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          errorData: data
        });
      }
      
      res.set('Access-Control-Allow-Origin', origin).status(response.status).json(data);
    }
  } catch (error: any) {
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('[apiProxy] Proxy Axios error:', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        url: axiosError.config?.url,
        stack: axiosError.stack
      });
      
      // Check if it's a connection error
      const isConnectionError = 
        axiosError.code === 'ECONNREFUSED' ||
        axiosError.code === 'ETIMEDOUT' ||
        axiosError.code === 'ENOTFOUND' ||
        axiosError.message?.includes('ECONNREFUSED') ||
        axiosError.message?.includes('ETIMEDOUT') ||
        axiosError.message?.includes('ENOTFOUND');
      
      res.set('Access-Control-Allow-Origin', origin).status(500).json({ 
        error: isConnectionError ? 'Backend service unavailable' : 'Proxy error',
        message: axiosError.message,
        details: axiosError.toString(),
        url: url,
        errorType: 'AxiosError',
        code: axiosError.code
      });
    } else {
      // Handle other errors
      console.error('[apiProxy] Proxy error:', {
        message: error.message,
        stack: error.stack,
        url: url,
        errorType: error.constructor?.name
      });
      
      res.set('Access-Control-Allow-Origin', origin).status(500).json({ 
        error: 'Proxy error',
        message: error.message,
        details: error.toString(),
        url: url,
        errorType: error.constructor?.name


        
      });
    }
  }
});

// ISO Generation API Proxy - Provides HTTPS endpoint for ISO API (Port 3002)
export const isoProxy = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 300,  // 5 minutes for ISO generation
  cors: true
}, async (req, res) => {
  // CRITICAL: Log immediately to verify function is being invoked
  console.log('[isoProxy] Function invoked!', {
    method: req.method,
    url: req.url,
    path: (req as any).path,
    originalUrl: (req as any).originalUrl,
    baseUrl: (req as any).baseUrl,
    headers: {
      host: req.headers.host,
      'content-type': req.headers['content-type'],
      'x-tenant-id': req.headers['x-tenant-id']
    }
  });
  
  // Set CORS headers explicitly
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Port 3001 (Main API) - The /api/deploy/generate-epc-iso route exists on the main backend server
  // The route is registered in backend-services/routes/epc-deployment.js on port 3001
  // Use domain name instead of IP address (hss.wisptools.io per memory)
  // Port 3001 is for the HSS Management API (per memory)
  // Backend server accessible via nginx on hss.wisptools.io
  const backendUrl = process.env.BACKEND_HOST || 'https://hss.wisptools.io';  // Main API server via nginx
  
  // Extract path and query string from request
  // Firebase Functions 2nd gen with Hosting rewrites:
  // - Hosting rewrite: req.url = /api/deploy/download-iso?url=... (full URL preserved)
  // - Direct call: req.url = /isoProxy/api/deploy/download-iso?url=...
  
  const fullUrl = req.url || (req as any).originalUrl || (req as any).path || '';
  const queryIndex = fullUrl.indexOf('?');
  let path = queryIndex >= 0 ? fullUrl.substring(0, queryIndex) : fullUrl;
  const queryString = queryIndex >= 0 ? fullUrl.substring(queryIndex) : '';
  
  // Remove /isoProxy prefix if present (direct Cloud Function calls)
  if (path.startsWith('/isoProxy')) {
    path = path.substring('/isoProxy'.length);
  }
  
  // Ensure path starts with /
  if (!path || path === '/') {
    path = '/api/deploy';
    console.warn('[isoProxy] No path in request, using default:', path);
  } else if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // For Firebase Hosting rewrites, the path should already be /api/deploy/...
  // For direct calls or downloads paths, add the prefix if needed
  if (!path.startsWith('/api/deploy') && !path.startsWith('/api/epc')) {
    if (path.startsWith('/generate-epc-iso') || path.startsWith('/download-iso')) {
      path = '/api/deploy' + path;
      console.log('[isoProxy] Restored /api/deploy prefix, new path:', path);
    } else if (path.startsWith('/downloads/')) {
      // Static file download request - don't add /api/deploy prefix
      console.log('[isoProxy] Static file download request, keeping path:', path);
    } else {
      path = '/api/deploy' + path;
      console.log('[isoProxy] Added /api/deploy prefix for unknown path, new path:', path);
    }
  }
  
  // Reconstruct full URL with query string
  const urlWithQuery = path + queryString;
  
  // Final validation log
  console.log('[isoProxy] Extracted path:', {
    originalReqUrl: req.url,
    finalPath: path,
    queryString: queryString,
    willCallBackend: `${backendUrl}${urlWithQuery}`
  });
  
  const url = `${backendUrl}${urlWithQuery}`;
  
  // Debug logging - log ALL request details to understand path extraction
  console.log('[isoProxy] Request details:', {
    method: req.method,
    reqUrl: req.url,
    reqPath: (req as any).path,
    originalUrl: (req as any).originalUrl,
    extractedPath: path,
    queryString: queryString,
    finalBackendUrl: url
  });
  
  try {
    // Create Axios instance with retry logic for this request
    const axiosInstance = axios.create({
      timeout: 300000, // 5 minutes timeout for ISO generation
      headers: {
        'Content-Type': 'application/json'
      },
      // Keep connections alive for better performance
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    });

    // Configure retry logic
    axiosRetry(axiosInstance, {
      retries: 3, // Retry up to 3 times
      retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
      retryCondition: (error: AxiosError) => {
        // Retry on network errors or 5xx server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response?.status ? error.response.status >= 500 : false) ||
               error.code === 'ECONNREFUSED' ||
               error.code === 'ETIMEDOUT' ||
               error.code === 'ENOTFOUND';
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`[isoProxy] Retry attempt ${retryCount} for ${requestConfig.url}`, {
          errorCode: error.code,
          status: (error as AxiosError).response?.status
        });
      },
    });

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Forward x-tenant-id if present
    if (req.headers['x-tenant-id']) {
      headers['x-tenant-id'] = req.headers['x-tenant-id'] as string;
    }
    
    // Forward Authorization header if present (check both cases - Firebase Functions normalizes to lowercase)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader) {
      headers['Authorization'] = authHeader as string;
      console.log('[isoProxy] Forwarding Authorization header');
    } else {
      console.warn('[isoProxy] No Authorization header found. Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('auth')));
    }
    
    // Prepare request config
    const axiosConfig: any = {
      method: req.method as any,
      url: url,
      headers: headers,
      responseType: 'json', // Default to JSON
      validateStatus: () => true, // Don't throw on any status code
    };
    
    // Add body for non-GET/HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      axiosConfig.data = req.body || {};
    }
    
    const response = await axiosInstance.request(axiosConfig);
    
    // Log response details for debugging
    console.log('[isoProxy] Backend response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type'],
      url: url
    });
    
    // Check content type to determine how to handle response
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      const data = response.data;
      res.status(response.status).json(data);
    } else {
      // Fallback for other content types
      const text = typeof response.data === 'string' ? response.data : String(response.data);
      
      // If we got an error response, try to parse it as JSON first
      if (response.status >= 400) {
        try {
          const errorData = JSON.parse(text);
          res.status(response.status).json(errorData);
        } catch {
          // If not JSON, send as text
          res.status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
        }
      } else {
        res.status(response.status).set('Content-Type', contentType || 'text/plain').send(text);
      }
    }
  } catch (error: any) {
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error('[isoProxy] Axios error details:', {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        url: axiosError.config?.url,
        stack: axiosError.stack
      });
      
      // Provide more detailed error information
      let errorMessage = axiosError.message || 'Unknown error';
      if (axiosError.code === 'ECONNREFUSED') {
        errorMessage = `Backend server not reachable at ${url}. Please verify the backend is running.`;
      } else if (axiosError.code === 'ETIMEDOUT') {
        errorMessage = `Backend server timeout at ${url}. The request took too long.`;
      }
      
      res.status(500).json({ 
        error: 'ISO proxy error', 
        message: errorMessage,
        details: axiosError.toString(),
        url: url,
        path: path,
        code: axiosError.code
      });
    } else {
      // Handle other errors
      console.error('[isoProxy] Error details:', {
        message: error.message,
        stack: error.stack,
        url: url,
        path: path
      });
      
      let errorMessage = error.message || 'Unknown error';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = `Backend server not reachable at ${url}. Please verify the backend is running.`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = `Backend server timeout at ${url}. The request took too long.`;
      }
      
      res.status(500).json({ 
        error: 'ISO proxy error', 
        message: errorMessage,
        details: error.toString(),
        url: url,
        path: path
      });
    }
  }
});
