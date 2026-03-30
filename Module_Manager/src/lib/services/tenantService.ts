// Unified Tenant Management Service
// Uses backend API instead of direct Firestore for consistency with MongoDB user-tenant associations

import { browser } from '$app/environment';
import { authService } from './authService';
import { isPlatformAdmin } from './adminService';
import { API_CONFIG, getBackendDirectBase } from '$lib/config/api';
import type {
  Tenant,
  UserTenantAssociation,
  TenantRole,
  TenantInvitation,
  TenantSettings,
  TenantLimits
} from '../models/tenant';

export class TenantService {
  private baseUrl: string;
  private apiBaseUrl: string;
  private adminBaseUrl: string;

  constructor() {
    // Get base URL from environment or construct it
    this.baseUrl = browser ? window.location.origin : 
      process.env.VITE_CWMP_BASE_URL || 'https://your-domain.com';
    
    // Use centralized API configuration
    this.apiBaseUrl = API_CONFIG.PATHS.TENANTS.split('/tenants')[0] || '/api';
    this.adminBaseUrl = `${this.apiBaseUrl}${API_CONFIG.PATHS.ADMIN}`; // /api/admin
  }

  /** Full URL for an admin API path (e.g. 'tenants' or 'tenants/123'). Uses VITE_BACKEND_URL when set to avoid proxy 404s. */
  private getAdminUrl(suffix: string): string {
    const direct = getBackendDirectBase();
    if (direct) return `${direct}/admin/${suffix.replace(/^\//, '')}`;
    return `${this.adminBaseUrl}/${suffix.replace(/^\//, '')}`;
  }

  /**
   * Get authentication headers for API calls.
   * Pass path when calling through Firebase Hosting → apiProxy so the proxy can route correctly.
   */
  private async getAuthHeaders(requestPath?: string): Promise<Record<string, string>> {
    const token = await authService.getAuthTokenForApi();
    if (!token) {
      throw new Error('User not authenticated - failed to get valid token');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    // Only send X-Requested-Path for proxy (relative path); direct backend doesn't need it
    if (requestPath && !requestPath.startsWith('http')) {
      headers['X-Requested-Path'] = requestPath;
    }
    return headers;
  }

  /**
   * Create a new tenant
   */
  async createTenant(
    name: string,
    displayName: string,
    contactEmail: string,
    createdBy: string,
    subdomain?: string,
    createOwnerAssociation: boolean = false,
    ownerEmail?: string
  ): Promise<{ success: boolean; tenantId?: string; error?: string }> {
    try {
      const user = authService.getCurrentUser();
      const userIsPlatformAdmin = isPlatformAdmin(user?.email ?? null);
      const endpoint = userIsPlatformAdmin ? this.getAdminUrl('tenants') : `${this.apiBaseUrl}/tenants`;
      const headers = await this.getAuthHeaders(endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          displayName,
          contactEmail,
          subdomain,
          ownerEmail: createOwnerAssociation ? ownerEmail : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to create tenant' };
      }

      const result = await response.json();
      return { success: true, tenantId: result.tenant.id };
    } catch (error) {
      console.error('Error creating tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get tenant by ID (for regular users).
   * Uses apiProxy URL so the request hits the backend (not userTenants), avoiding 403 when Hosting rewrites /api/user-tenants/** to userTenants.
   * Returns { tenant, error } so callers can avoid clearing tenant on 401 (auth/config issue) and only clear on 404 (not found).
   */
  async getTenant(tenantId: string): Promise<{ tenant: Tenant | null; error?: 'not_found' | 'unauthorized' }> {
    try {
      const headers = await this.getAuthHeaders();
      // Use same-origin URL so request goes through Hosting rewrite to apiProxy (avoids cross-origin 401).
      // path param helps apiProxy resolve route when Hosting rewrites send req.url as '/'
      const path = `/api/user-tenants/tenant/${tenantId}`;
      const url = `${path}?path=${encodeURIComponent(path)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) return { tenant: null, error: 'not_found' };
        if (response.status === 401) return { tenant: null, error: 'unauthorized' };
        throw new Error(`Failed to get tenant: ${response.statusText}`);
      }

      const data = await response.json();
      const tenant = this.mapApiTenantToTenant(data);
      return { tenant };
    } catch (error) {
      console.error('Error getting tenant:', error);
      return { tenant: null };
    }
  }

  /**
   * Get tenant by ID (admin only)
   */
  async getTenantAdmin(tenantId: string): Promise<Tenant | null> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}`);
      const headers = await this.getAuthHeaders(path);
      
      const response = await fetch(path, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get tenant: ${response.statusText}`);
      }

      const tenant = await response.json();
      return this.mapApiTenantToTenant(tenant);
    } catch (error) {
      console.error('Error getting tenant:', error);
      return null;
    }
  }

  /**
   * Get all tenants (admin only)
   */
  async getAllTenants(): Promise<Tenant[]> {
    try {
      const path = this.getAdminUrl('tenants');
      const headers = await this.getAuthHeaders(path);
      
      const response = await fetch(path, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        // If we got HTML, it's a routing issue
        if (errorText.trim().startsWith('<!')) {
          throw new Error('API route not found - received HTML instead of JSON');
        }
        const err = new Error(`Failed to get tenants: ${response.statusText}`) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      const tenants = await response.json();
      return tenants.map((tenant: any) => this.mapApiTenantToTenant(tenant));
    } catch (error) {
      console.error('Error getting all tenants:', error);
      throw error;
    }
  }

  /**
   * Update a tenant (admin only)
   */
  async updateTenant(
    tenantId: string, 
    updates: Partial<Tenant>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}`);
      const headers = await this.getAuthHeaders(path);
      
      const response = await fetch(path, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to update tenant' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Delete a tenant (admin only)
   */
  async deleteTenant(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}`);
      const headers = await this.getAuthHeaders(path);
      
      const response = await fetch(path, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to delete tenant' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Assign owner to a tenant
   */
  async assignOwner(tenantId: string, email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}/assign-owner`);
      const headers = await this.getAuthHeaders(path);
      
      const response = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to assign owner' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error assigning owner:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get users in a tenant
   */
  async getTenantUsers(tenantId: string): Promise<any[]> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}/users`);
      const headers = await this.getAuthHeaders(path);
      
      const response = await fetch(path, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to get tenant users: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting tenant users:', error);
      return [];
    }
  }

  async createInvitation(
    tenantId: string,
    email: string,
    role: TenantRole,
    invitedBy: string
  ): Promise<{ success: boolean; invitation?: TenantInvitation; error?: string }> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}/invitations`);
      const headers = await this.getAuthHeaders(path);
      const response = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, role, invitedBy })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.message || 'Failed to create invitation' };
      }

      const invitation = await response.json();
      return { success: true, invitation };
    } catch (error) {
      console.error('Error creating tenant invitation:', error);
      return { success: false, error: String(error) };
    }
  }

  async updateUserRole(
    userId: string,
    tenantId: string,
    role: TenantRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}/users/${userId}/role`);
      const headers = await this.getAuthHeaders(path);
      const response = await fetch(path, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.message || 'Failed to update user role' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating user role:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get user tenants (for regular users)
   */
  async getUserTenants(userId: string): Promise<Tenant[]> {
    try {
      const headers = await this.getAuthHeaders();
      // Use direct Cloud Function URL (Hosting rewrite to userTenants often 404s on custom domain)
      const userTenantsBase = API_CONFIG.CLOUD_FUNCTIONS.USER_TENANTS;
      const url = `${userTenantsBase}/api/user-tenants/${userId}`;
      
      console.log('[TenantService] getUserTenants request:', {
        url,
        apiBaseUrl: this.apiBaseUrl,
        method: 'GET',
        hasAuthHeader: !!headers['Authorization'],
        headerKeys: Object.keys(headers),
        tokenLength: headers['Authorization']?.toString().split('Bearer ')[1]?.length || 0
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      console.log('[TenantService] getUserTenants response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('[TenantService] getUserTenants error response:', errorData);
        console.error('[TenantService] Full error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          errorCode: errorData.code,
          errorMessage: errorData.message,
          errorDetails: errorData.details,
          url,
          headers: Object.fromEntries(response.headers.entries()),
          // Log the token info (first 50 chars only for security)
          tokenInfo: headers['Authorization'] ? {
            hasToken: true,
            tokenLength: headers['Authorization'].split('Bearer ')[1]?.length,
            tokenStart: headers['Authorization'].split('Bearer ')[1]?.substring(0, 50) + '...'
          } : { hasToken: false }
        });
        
        const err = new Error(`Failed to get user tenants: ${response.statusText} - ${errorData.message || errorData.error} (code: ${errorData.code || 'unknown'})`) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      const tenants = await response.json();
      
      // Backend already returns full tenant details with user role
      return tenants;
    } catch (error: any) {
      console.error('Error getting user tenants:', error);
      // Rethrow 5xx (e.g. 503 Service Unavailable / INTERNAL_API_KEY not set) so callers can show an error instead of redirecting to tenant-setup
      if (error?.status >= 500) throw error;
      return [];
    }
  }

  async getUserRole(userId: string, tenantId: string): Promise<TenantRole | null> {
    try {
      const tenants = await this.getUserTenants(userId);
      const tenant = tenants.find((t: any) => t.id === tenantId || t.tenantId === tenantId);
      return tenant?.userRole ?? null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<{ success: boolean; error?: string }> {
    return this.updateTenant(tenantId, { settings });
  }

  async updateTenantLimits(tenantId: string, limits: TenantLimits): Promise<{ success: boolean; error?: string }> {
    return this.updateTenant(tenantId, { limits });
  }

  /**
   * Map API tenant response to Tenant model
   */
  private mapApiTenantToTenant(apiTenant: any): Tenant {
    return {
      id: apiTenant.id,
      name: apiTenant.name,
      displayName: apiTenant.displayName,
      subdomain: apiTenant.subdomain,
      cwmpUrl: apiTenant.cwmpUrl,
      userRole: apiTenant.userRole, // Include user's role in this tenant
      contactEmail: apiTenant.contactEmail,
      settings: apiTenant.settings || {
        allowSelfRegistration: false,
        requireEmailVerification: true,
        maxUsers: 50,
        maxDevices: 20,
        features: {
          acs: true,
          hss: true,
          pci: true,
          helpDesk: true,
          userManagement: true,
          customerManagement: true
        }
      },
      limits: apiTenant.limits || {
        maxUsers: 50,
        maxDevices: 20,
        maxNetworks: 10,
        maxTowerSites: 100
      },
      createdAt: new Date(apiTenant.createdAt),
      updatedAt: new Date(apiTenant.updatedAt),
      createdBy: apiTenant.createdBy,
      status: apiTenant.status || 'active'
    };
  }

  /**
   * Generate subdomain from name
   */
  private generateSubdomain(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    try {
      const tenants = await this.getAllTenants();
      return tenants.find(t => t.subdomain === subdomain) || null;
    } catch (error) {
      console.error('Error getting tenant by subdomain:', error);
      return null;
    }
  }

  /**
   * Add user to tenant (legacy method - now handled by user management API)
   */
  async addUserToTenant(
    userId: string, 
    tenantId: string, 
    role: TenantRole
  ): Promise<{ success: boolean; error?: string }> {
    console.warn('addUserToTenant is deprecated - use user management API instead');
    return { success: false, error: 'Use user management API instead' };
  }

  /**
   * Remove user from tenant (legacy method - now handled by user management API)
   */
  async removeUserFromTenant(
    userId: string, 
    tenantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const path = this.getAdminUrl(`tenants/${tenantId}/users/${userId}`);
      const headers = await this.getAuthHeaders(path);
      const response = await fetch(path, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.message || 'Failed to remove user from tenant' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing user from tenant:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Check if user has permission in tenant (legacy method)
   */
  async checkPermission(
    userId: string,
    tenantId: string,
    permission: keyof import('../models/tenant').TenantPermissions
  ): Promise<boolean> {
    console.warn('checkPermission is deprecated - use role-based access control instead');
    return false;
  }
}

// Export singleton instance
export const tenantService = new TenantService();