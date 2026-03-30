/**
 * User Management Service
 * 
 * Handles all user management operations including:
 * - Inviting users
 * - Updating roles
 * - Managing permissions
 * - Suspending/activating users
 */

import { auth } from '$lib/firebase';
import { authService } from '$lib/services/authService';
import { getBackendDirectBase } from '$lib/config/api';
import type { UserRole, ModuleAccess } from '$lib/models/userRole';

// Use relative URL to leverage Firebase Hosting rewrites
// This goes through Firebase Hosting rewrite to apiProxy function
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get the base API path, ensuring /api is included
 * - If API_BASE_URL is empty: use '/api' (relative URL for Firebase Hosting rewrites)
 * - If API_BASE_URL is set: ensure it ends with '/api' or append it
 * 
 * Supports multiple backend ports:
 * - Production: Uses Firebase Hosting rewrites (/api -> apiProxy Cloud Function)
 * - Local Development: http://localhost:3001/api (Main API) or http://localhost:3002/api (EPC API)
 * - Cloud Functions URL: Automatically includes /api if needed
 * 
 * IMPORTANT: Never use localhost in production builds - always use relative URLs
 */
function getApiPath(): string {
  // In production (browser environment), always use relative URLs for Firebase Hosting rewrites
  if (typeof window !== 'undefined') {
    // Check if we're in production (not localhost)
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    // If in production and API_BASE_URL is not explicitly set or points to localhost, use relative URL
    if (isProduction && (!API_BASE_URL || API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1'))) {
      // Production: Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
      return '/api';
    }
  }
  
  // Handle API_BASE_URL if set (for local development or explicit Cloud Functions URL)
  if (!API_BASE_URL || API_BASE_URL.trim() === '') {
    // Production: Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    return '/api';
  }
  
  // Development/Local: Ensure API_BASE_URL ends with /api
  let base = API_BASE_URL.trim();
  
  // Remove trailing slashes
  base = base.replace(/\/+$/, '');
  
  // Check if it already ends with /api
  if (base.endsWith('/api')) {
    return base;
  }
  
  // Append /api if not present
  // Handle cases like:
  // - http://localhost:3001 -> http://localhost:3001/api
  // - http://localhost:3002 -> http://localhost:3002/api
  // - https://cloudfunctions.net -> https://cloudfunctions.net/api
  return `${base}/api`;
}

/**
 * User in tenant
 */
export interface TenantUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  phoneNumber: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending_invitation';
  invitedBy: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  addedAt: string;
  lastAccessAt: string | null;
  lastLoginAt: string | null;
  moduleAccess: ModuleAccess | null;
  workOrderPermissions: any | null;
}

/**
 * Get auth headers with Firebase token
 */
async function getAuthHeaders(tenantId: string): Promise<HeadersInit> {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await authService.getAuthTokenForApi();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': tenantId
  };
}

/**
 * Get all users in a tenant
 */
export async function getTenantUsers(tenantId: string, scope: 'full' | 'visible' = 'full'): Promise<TenantUser[]> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const endpoint = scope === 'visible'
      ? `${apiPath}/users/tenant/${tenantId}/visible`
      : `${apiPath}/users/tenant/${tenantId}`;

    // Debug logging
    console.log('[userManagementService] Request details:', {
      apiPath,
      endpoint,
      hasAuth: !!headers['Authorization'],
      tenantId
    });

    const response = await fetch(endpoint, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch users');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    throw error;
  }
}

/**
 * Get all users across all tenants (admin only)
 */
export async function getAllUsers(): Promise<TenantUser[]> {
  try {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }

    const token = await authService.getAuthTokenForApi();
    const direct = getBackendDirectBase();
    const path = direct ? `${direct}/api/users` : `${getApiPath()}/users`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(direct ? {} : { 'X-Requested-Path': path })
    };

    const response = await fetch(path, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch all users' }));
      // Check if error is about missing tenant ID - this should not happen for platform admins
      if (errorData.message && errorData.message.includes('tenant ID')) {
        throw new Error('Platform admin access error: ' + errorData.message);
      }
      throw new Error(errorData.message || errorData.error || 'Failed to fetch all users');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
}

/**
 * Add a new user to the tenant
 * Automatically sends welcome email with login instructions
 */
export async function inviteUser(
  tenantId: string,
  email: string,
  role: UserRole,
  customModuleAccess?: ModuleAccess,
  sendEmail: boolean = true,
  displayName?: string
): Promise<{ invitationId: string; userId: string | null; status: string }> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        role,
        tenantId,
        customModuleAccess,
        sendEmail,
        displayName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add user');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
}

/**
 * Update user's role
 */
export async function updateUserRole(
  tenantId: string,
  userId: string,
  role: UserRole
): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/${userId}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        role,
        tenantId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update role');
    }
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

/**
 * Update user's module access
 */
export async function updateUserModuleAccess(
  tenantId: string,
  userId: string,
  moduleAccess: ModuleAccess
): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/${userId}/modules`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        moduleAccess,
        tenantId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update module access');
    }
  } catch (error) {
    console.error('Error updating module access:', error);
    throw error;
  }
}

/**
 * Suspend a user
 */
export async function suspendUser(tenantId: string, userId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/${userId}/suspend`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to suspend user');
    }
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
}

/**
 * Activate a suspended user
 */
export async function activateUser(tenantId: string, userId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/${userId}/activate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to activate user');
    }
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
}

/**
 * Remove user from tenant
 */
export async function removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/${userId}/tenant/${tenantId}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove user');
    }
  } catch (error) {
    console.error('Error removing user:', error);
    throw error;
  }
}

/**
 * Get user activity log
 */
export async function getUserActivity(tenantId: string, userId: string): Promise<any[]> {
  try {
    const headers = await getAuthHeaders(tenantId);
    
    // Use relative URL (goes through Firebase Hosting rewrite to apiProxy)
    const apiPath = getApiPath();
    const response = await fetch(`${apiPath}/users/${userId}/activity?tenantId=${tenantId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch activity');
    }

    const data = await response.json();
    return data.activities || [];
  } catch (error) {
    console.error('Error fetching user activity:', error);
    throw error;
  }
}

