// Authenticated API Service with Multi-Tenant Support
// Automatically adds Firebase JWT token and tenant context to all requests

import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { authService } from './authService';

export class ApiService {
  private baseUrl: string;

  constructor() {
    // Use relative URLs that go through Firebase Hosting rewrites to backend
    // This routes /api/* to the backend API via apiProxy function
    this.baseUrl = browser ? '/api' : '';
  }

  /**
   * Get Firebase ID token for authenticated requests.
   * Uses getAuthTokenForApi for robust token retrieval (wait, force refresh, retries).
   */
  private async getAuthToken(): Promise<string | null> {
    return authService.getAuthTokenForApi();
  }

  /**
   * Get current tenant ID from localStorage
   */
  private getTenantId(): string | null {
    if (!browser) return null;
    const stored = localStorage.getItem('selectedTenantId');
    if (stored && stored.trim() !== '') return stored;
    const fromEnv = env.PUBLIC_SINGLE_TENANT_ID;
    if (fromEnv != null && String(fromEnv).trim() !== '') return String(fromEnv).trim();
    return null;
  }

  /**
   * Make authenticated API request with tenant context
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAuthToken();
    const tenantId = this.getTenantId();

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Add auth token
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Add tenant ID to headers (backend expects X-Tenant-ID header)
    if (tenantId) {
      headers.set('X-Tenant-ID', tenantId);
    }

    // Build URL
    let url = `${this.baseUrl}${endpoint}`;
    let body = options.body;

    return fetch(url, {
      ...options,
      headers,
      body,
    });
  }

  /**
   * GET request with authentication
   */
  async get<T = any>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, { method: 'GET' });
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API GET ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * POST request with authentication
   */
  async post<T = any>(endpoint: string, payload?: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API POST ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * PUT request with authentication
   */
  async put<T = any>(endpoint: string, payload: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API PUT ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * DELETE request with authentication
   */
  async delete<T = any>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeRequest(endpoint, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return { success: true, data };
    } catch (error) {
      console.error(`API DELETE ${endpoint} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  // ============================================================================
  // Multi-Tenant GenieACS Endpoints
  // ============================================================================

  /**
   * Sync devices from GenieACS (tenant-specific)
   */
  async syncGenieACSDevices() {
    return this.post('/syncGenieACSDevicesMultitenant');
  }

  /**
   * Get device parameters (tenant-specific)
   */
  async getDeviceParameters(deviceId: string) {
    return this.get(`/getDeviceParametersMultitenant?deviceId=${deviceId}`);
  }

  /**
   * Execute device task (tenant-specific with permission check)
   */
  async executeDeviceTask(deviceId: string, taskName: string, parameter?: string, value?: any) {
    return this.post('/executeDeviceTaskMultitenant', {
      deviceId,
      name: taskName,
      parameter,
      value,
    });
  }

  // ============================================================================
  // TR-069 Configuration
  // ============================================================================

  async getTR069Config() {
    return this.get('/api/tr069/configuration');
  }

  async saveTR069Config(genieacsUrl: string, genieacsApiUrl: string) {
    return this.post('/api/tr069/configuration', { genieacsUrl, genieacsApiUrl });
  }

  async testTR069Connection(genieacsApiUrl: string) {
    return this.post('/api/tr069/connection-test', { genieacsApiUrl });
  }

  /**
   * Get devices (tenant-filtered)
   */
  async getDevices() {
    return this.get('/genieacsNBIMultitenant/devices');
  }

  /**
   * Get faults (tenant-filtered)
   */
  async getFaults() {
    return this.get('/genieacsNBIMultitenant/faults');
  }

  /**
   * Get presets (tenant-filtered)
   */
  async getPresets() {
    return this.get('/genieacsNBIMultitenant/presets');
  }

  /**
   * Create preset (permission-checked)
   */
  async createPreset(presetName: string, config: any) {
    return this.put(`/genieacsNBIMultitenant/presets/${presetName}`, config);
  }

  /**
   * Delete preset (permission-checked)
   */
  async deletePreset(presetName: string) {
    return this.delete(`/genieacsNBIMultitenant/presets/${presetName}`);
  }
}

// Singleton instance
export const apiService = new ApiService();

