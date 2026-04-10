/**
 * TenantGuardService
 * 
 * A robust service that provides tenant validation and isolation for modules.
 * This service abstracts away the complexity of tenant management and provides
 * a clean API that modules can use without knowing internal implementation details.
 * 
 * Key Features:
 * - Tenant validation and loading
 * - Authentication checks
 * - Admin role validation
 * - Automatic tenant selection for single-tenant users
 * - Event-driven updates when tenant state changes
 * - Isolation from internal tenant store changes
 */

import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { tenantStore } from '../stores/tenantStore';
import { get } from 'svelte/store';
import { authService } from './authService';
import { isPlatformAdmin } from './adminService';
import type { Tenant } from '../models/tenant';
import { getConfiguredSingleTenantId, isSingleTenantMode } from '../config/tenantMode';

export interface TenantGuardResult {
  success: boolean;
  tenant?: Tenant;
  isAdmin?: boolean;
  error?: string;
  requiresRedirect?: string;
}

export interface TenantGuardOptions {
  requireTenant?: boolean;
  requireAdmin?: boolean;
  autoSelectSingleTenant?: boolean;
  createDefaultTenant?: boolean;
}

export type TenantStateChangeCallback = (result: TenantGuardResult) => void;

class TenantGuardService {
  private callbacks: Set<TenantStateChangeCallback> = new Set();
  private isInitialized = false;
  private currentResult: TenantGuardResult | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    if (browser) {
      this.initialize();
    }
  }

  /**
   * Initialize the service and set up tenant store subscription
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[TenantGuardService] Initializing...');
    
    // Subscribe to tenant store changes
    this.unsubscribe = tenantStore.subscribe(async (state) => {
      await this.handleTenantStateChange(state);
    });

    this.isInitialized = true;
    console.log('[TenantGuardService] Initialized');
  }

  /**
   * Handle tenant store state changes and notify callbacks
   */
  private async handleTenantStateChange(state: any): Promise<void> {
    const result = await this.validateCurrentState();
    this.currentResult = result;
    
    // Notify all registered callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('[TenantGuardService] Error in callback:', error);
      }
    });
  }

  /**
   * Validate the current authentication and tenant state
   */
  private async validateCurrentState(): Promise<TenantGuardResult> {
    try {
      // Check authentication
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        return {
          success: false,
          error: 'Not authenticated',
          requiresRedirect: '/login'
        };
      }

      // Check admin status
      const userEmail = currentUser?.email || '';
      const isAdmin = isPlatformAdmin(userEmail);

      // Get current tenant state
      const tenantState = get(tenantStore);
      
      // If admin, they don't need a tenant
      if (isAdmin) {
        return {
          success: true,
          isAdmin: true,
          tenant: undefined
        };
      }

      // Check if tenant is required and available
      if (tenantState.currentTenant) {
        return {
          success: true,
          tenant: tenantState.currentTenant,
          isAdmin: false
        };
      }

      // No tenant available
      return {
        success: false,
        error: 'No tenant selected',
        requiresRedirect: '/tenant-selector'
      };

    } catch (error) {
      console.error('[TenantGuardService] Validation error:', error);
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Ensure tenant is loaded and available
   * This method handles the full tenant loading process
   */
  async ensureTenant(options: TenantGuardOptions = {}): Promise<TenantGuardResult> {
    const {
      requireTenant = true,
      requireAdmin = false,
      autoSelectSingleTenant = true,
      createDefaultTenant = false
    } = options;

    console.log('[TenantGuardService] Ensuring tenant with options:', options);

    try {
      // Check authentication first
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        console.log('[TenantGuardService] Not authenticated, redirecting to login');
        await goto('/login', { replaceState: true });
        return {
          success: false,
          error: 'Not authenticated',
          requiresRedirect: '/login'
        };
      }

      // Check admin status
      const userEmail = currentUser?.email || '';
      const isAdmin = isPlatformAdmin(userEmail);

      // Check admin requirement
      if (requireAdmin && !isAdmin) {
        return {
          success: false,
          error: 'Administrator access required',
          isAdmin: false
        };
      }

      // If admin and tenant not required, return success
      if (isAdmin && !requireTenant) {
        return {
          success: true,
          isAdmin: true,
          tenant: undefined
        };
      }

      // Initialize tenant store if needed
      const tenantState = get(tenantStore);
      if (!tenantState.isInitialized) {
        console.log('[TenantGuardService] Initializing tenant store...');
        await tenantStore.initialize();
      }

      // Check if tenant is already available
      if (tenantState.currentTenant) {
        return {
          success: true,
          tenant: tenantState.currentTenant,
          isAdmin: false
        };
      }

      // Load user's tenants
      console.log('[TenantGuardService] Loading user tenants...');
      const tenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email ?? undefined);
      
      if (tenants.length === 0) {
        if (createDefaultTenant) {
          // Create default tenant
          console.log('[TenantGuardService] Creating default tenant...');
          const { tenantService } = await import('./tenantService');
          const result = await tenantService.createTenant(
            'default-tenant',
            'My Organization',
            currentUser.email || 'user@example.com',
            currentUser.uid,
            undefined,
            true,
            currentUser.email ?? undefined
          );

          if (result.success && result.tenantId) {
            const { tenant } = await tenantService.getTenant(result.tenantId);
            if (tenant) {
              tenantStore.setCurrentTenant(tenant);
              return {
                success: true,
                tenant: tenant,
                isAdmin: false
              };
            }
          }
        }

        return {
          success: false,
          error: 'No tenants available',
          requiresRedirect: '/tenant-setup'
        };
      }

      if (tenants.length === 1 && autoSelectSingleTenant) {
        // Auto-select single tenant
        console.log('[TenantGuardService] Auto-selecting single tenant');
        tenantStore.setCurrentTenant(tenants[0]);
        return {
          success: true,
          tenant: tenants[0],
          isAdmin: false
        };
      }

      if (tenants.length > 1) {
        const singleId = isSingleTenantMode() ? getConfiguredSingleTenantId() : null;
        if (singleId) {
          const fixed = tenants.find((t) => t.id === singleId);
          if (fixed) {
            console.log('[TenantGuardService] Single-tenant mode: pinning configured org');
            tenantStore.setCurrentTenant(fixed, { source: 'single-tenant-env' });
            return {
              success: true,
              tenant: fixed,
              isAdmin: false
            };
          }
        }
        // Multiple tenants - redirect to selector
        console.log('[TenantGuardService] Multiple tenants, redirecting to selector');
        await goto('/tenant-selector', { replaceState: true });
        return {
          success: false,
          error: 'Multiple tenants available',
          requiresRedirect: '/tenant-selector'
        };
      }

      return {
        success: false,
        error: 'Unable to determine tenant'
      };

    } catch (error) {
      console.error('[TenantGuardService] Error ensuring tenant:', error);
      return {
        success: false,
        error: `Failed to ensure tenant: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get the current tenant without triggering any loading
   */
  getCurrentTenant(): Tenant | null {
    const state = get(tenantStore);
    return state.currentTenant || null;
  }

  /**
   * Get the current tenant guard result
   */
  getCurrentResult(): TenantGuardResult | null {
    return this.currentResult;
  }

  /**
   * Check if user is admin
   */
  isUserAdmin(): boolean {
    const currentUser = authService.getCurrentUser();
    if (!currentUser?.email) return false;
    return isPlatformAdmin(currentUser.email);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return authService.getCurrentUser() !== null;
  }

  /**
   * Register a callback for tenant state changes
   */
  onTenantStateChange(callback: TenantStateChangeCallback): () => void {
    this.callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Wait for tenant to be available
   */
  async waitForTenant(timeoutMs: number = 10000): Promise<TenantGuardResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkTenant = () => {
        const result = this.getCurrentResult();
        if (result && result.success && result.tenant) {
          resolve(result);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          resolve({
            success: false,
            error: 'Timeout waiting for tenant'
          });
          return;
        }

        setTimeout(checkTenant, 100);
      };

      checkTenant();
    });
  }

  /**
   * Cleanup the service
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.callbacks.clear();
    this.isInitialized = false;
    this.currentResult = null;
  }
}

// Export singleton instance
export const tenantGuardService = new TenantGuardService();

