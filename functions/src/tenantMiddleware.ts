// Tenant Middleware for Firebase Functions
// Extracts and validates tenant context from requests

import { auth, db } from './firebaseInit.js';
const adminAuth = auth;

export interface TenantContext {
  tenantId: string;
  userId: string;
  userEmail: string;
  role: string;
  permissions: Record<string, boolean>;
}

/**
 * Extract tenant context from request
 * Supports multiple methods:
 * 1. Authorization header with Firebase ID token
 * 2. Query parameter: tenantId
 * 3. Request body: tenantId
 */
export async function extractTenantContext(req: any): Promise<TenantContext | null> {
  try {
    // Extract user from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('No authorization header found');
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || '';

    // Get tenant ID from request (query/body, then header, then default user, then single-tenant env)
    let tenantId = req.query.tenantId || req.body?.tenantId;
    const headerTenant = req.headers?.['x-tenant-id'] || req.headers?.['X-Tenant-ID'];
    if (!tenantId && typeof headerTenant === 'string' && headerTenant.trim()) {
      tenantId = headerTenant.trim();
    }

    if (!tenantId) {
      tenantId = await getDefaultTenantForUser(userId);
    }

    const singleFromEnv =
      typeof process.env.SINGLE_TENANT_ID === 'string' && process.env.SINGLE_TENANT_ID.trim() !== ''
        ? process.env.SINGLE_TENANT_ID.trim()
        : null;
    if (!tenantId && singleFromEnv) {
      tenantId = singleFromEnv;
    }

    if (!tenantId) {
      console.warn('No tenant ID found for user:', userId);
      return null;
    }

    // Get user's role and permissions in this tenant
    const userTenant = await getUserTenantAssociation(userId, tenantId);
    
    if (!userTenant) {
      console.warn('User not associated with tenant:', userId, tenantId);
      return null;
    }

    return {
      tenantId,
      userId,
      userEmail,
      role: userTenant.role,
      permissions: userTenant.permissions
    };
  } catch (error) {
    console.error('Error extracting tenant context:', error);
    return null;
  }
}

/**
 * Get default tenant for user (first tenant they're associated with)
 */
async function getDefaultTenantForUser(userId: string): Promise<string | null> {
  try {
    const snapshot = await db
      .collection('user_tenants')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    return snapshot.docs[0].data().tenantId;
  } catch (error) {
    console.error('Error getting default tenant:', error);
    return null;
  }
}

/**
 * Get user-tenant association
 */
async function getUserTenantAssociation(userId: string, tenantId: string) {
  try {
    const associationId = `${userId}_${tenantId}`;
    const doc = await db.collection('user_tenants').doc(associationId).get();
    
    if (!doc.exists) return null;
    
    return doc.data();
  } catch (error) {
    console.error('Error getting user tenant association:', error);
    return null;
  }
}

/**
 * Middleware wrapper for Cloud Functions
 */
export function withTenantContext(
  handler: (req: any, res: any, context: TenantContext) => Promise<void>
) {
  return async (req: any, res: any) => {
    const context = await extractTenantContext(req);
    
    if (!context) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Invalid tenant context'
      });
    }
    
    // Add tenant context to request for easy access
    req.tenantContext = context;
    
    return handler(req, res, context);
  };
}

/**
 * Check if user has specific permission
 */
export function requirePermission(permission: string) {
  return (context: TenantContext): boolean => {
    return context.permissions[permission] === true;
  };
}

/**
 * Check if user has specific role
 */
export function requireRole(role: string) {
  return (context: TenantContext): boolean => {
    return context.role === role || context.role === 'owner';
  };
}

/**
 * Extract tenant from CWMP URL
 * URL format: /cwmp/{subdomain} or /cwmp/{tenantId}
 */
export async function extractTenantFromCWMPUrl(url: string): Promise<string | null> {
  try {
    // Extract subdomain or tenant ID from URL path
    const match = url.match(/\/cwmp\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    
    const identifier = match[1];
    
    // Try to find tenant by subdomain first
    const tenantBySubdomain = await db
      .collection('tenants')
      .where('subdomain', '==', identifier)
      .limit(1)
      .get();
    
    if (!tenantBySubdomain.empty) {
      return tenantBySubdomain.docs[0].id;
    }
    
    // Try as direct tenant ID
    const tenantById = await db.collection('tenants').doc(identifier).get();
    if (tenantById.exists) {
      return tenantById.id;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting tenant from CWMP URL:', error);
    return null;
  }
}

/**
 * Add tenant ID to MongoDB query
 * Ensures data isolation between tenants
 */
export function addTenantFilter(query: any, tenantId: string): any {
  return {
    ...query,
    _tenantId: tenantId
  };
}

/**
 * Add tenant ID to MongoDB document
 */
export function addTenantToDocument(document: any, tenantId: string): any {
  return {
    ...document,
    _tenantId: tenantId,
    _tenantUpdatedAt: new Date()
  };
}

