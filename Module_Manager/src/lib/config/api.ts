/**
 * Centralized API Configuration
 * All API endpoints and URLs should be defined here
 */

// API Base URLs - Use relative URLs for Firebase Hosting rewrites
export const API_CONFIG = {
  // Base API path (relative - goes through Firebase Hosting rewrite to apiProxy)
  BASE: '/api',
  
  // API Service Paths
  PATHS: {
    PLANS: '/api/plans',
    NETWORK: '/api/network',
    CUSTOMERS: '/api/customers',
    CUSTOMER_BILLING: '/api/customer-billing',
    INVENTORY: '/api/inventory',
    BUNDLES: '/api/bundles',
    DEPLOY: '/api/deploy',
    HSS: '/api/hss',
    MONITORING: '/api/monitoring',
    MAINTAIN: '/api/maintain',
    TENANTS: '/api/tenants',
    USERS: '/api/users',
    WORK_ORDERS: '/api/work-orders',
    ADMIN: '/admin',
    ISO: '/api/deploy', // ISO proxy uses deploy endpoint
    PERMISSIONS: '/api/permissions',
    MIKROTIK: '/api/mikrotik',
    EPC_UPDATES: '/api/epc-updates',
    SNMP_MONITORING: '/api/snmp',
    MONITORING_GRAPHS: '/api/monitoring/graphs',
    DEVICE_ASSIGNMENT: '/api/device-assignment',
    NOTIFICATIONS: '/api/notifications',
    VOICE: '/api/voice',
    API: '/api'
  },
  
  // Cloud Function endpoints (only used when direct access is needed)
  CLOUD_FUNCTIONS: {
    API_PROXY: 'https://us-central1-wisptools-production.cloudfunctions.net/apiProxy',
    ISO_PROXY: 'https://us-central1-wisptools-production.cloudfunctions.net/isoProxy',
    COVERAGE_MAP_PROXY: 'https://us-central1-wisptools-production.cloudfunctions.net/coverageMapProxy',
    // Direct URL for userTenants (bypasses Hosting rewrite; fix for 404 on management.wisptools.io)
    USER_TENANTS: typeof import.meta.env !== 'undefined' && import.meta.env?.VITE_USER_TENANTS_URL
      ? String(import.meta.env.VITE_USER_TENANTS_URL).replace(/\/$/, '')
      : 'https://usertenants-nxulhoqnyq-uc.a.run.app'
  },
  
  // Backend services (GCE VM)
  BACKEND_SERVICES: {
    HSS_MANAGEMENT: 'https://hss.wisptools.io:3001/api/hss',
    DEFAULT: 'https://hss.wisptools.io:3001/api'
  },

  /** Mobile Field App APK download URL. Serve APK from Firebase Hosting (static) or Firebase Storage and set here. */
  MOBILE_APP_DOWNLOAD_URL: '/downloads/wisp-field-app.apk'
} as const;

/**
 * Direct backend base URL (no trailing slash).
 * When set (e.g. VITE_BACKEND_URL=https://api.wisptools.io or https://hss.wisptools.io), admin/API requests
 * go directly to the backend instead of via Firebase Hosting → apiProxy.
 * If you moved the backend URL, set VITE_BACKEND_URL at build time (e.g. VITE_BACKEND_URL=https://api.wisptools.io).
 */
export function getBackendDirectBase(): string {
  const envUrl = typeof import.meta.env !== 'undefined' && import.meta.env?.VITE_BACKEND_URL
    ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, '')
    : '';
  if (envUrl) return envUrl;
  // When on management site, default backend (override with VITE_BACKEND_URL if backend was moved)
  if (typeof window !== 'undefined' && (window.location.hostname === 'management.wisptools.io' || window.location.hostname === 'wisptools-management.web.app')) {
    return 'https://hss.wisptools.io';
  }
  return '';
}

/**
 * Get API URL for a specific service
 */
export function getApiUrl(service?: keyof typeof API_CONFIG.PATHS): string {
  if (service) {
    return API_CONFIG.PATHS[service];
  }
  return API_CONFIG.BASE;
}

/**
 * Get full API endpoint URL
 */
export function getApiEndpoint(service: keyof typeof API_CONFIG.PATHS, endpoint: string = ''): string {
  const baseUrl = API_CONFIG.PATHS[service];
  return `${baseUrl}${endpoint}`;
}

