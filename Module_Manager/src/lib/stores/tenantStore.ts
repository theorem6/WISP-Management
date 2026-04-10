// Centralized Tenant Store
// Single source of truth for tenant state across the application
// Prevents redundant checks and eliminates redirect loops

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Tenant } from '../models/tenant';
import { isPlatformAdmin } from '../services/adminService';
import { debug } from '../utils/debug';
import { getConfiguredSingleTenantId, isSingleTenantMode } from '../config/tenantMode';
import {
	notifyAfterTenantResolved,
	type TenantResolutionSource
} from '../tenant/multitenantExtensionHooks';

export interface TenantState {
  // Current tenant
  currentTenant: Tenant | null;
  
  // All tenants the user has access to
  userTenants: Tenant[];
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Setup completion
  setupCompleted: boolean;
  
  // Error state
  error: string | null;
}

const initialState: TenantState = {
  currentTenant: null,
  userTenants: [],
  isLoading: false,
  isInitialized: false,
  setupCompleted: false,
  error: null,
};

// Create the main tenant store
function createTenantStore() {
  const { subscribe, set, update } = writable<TenantState>(initialState);

  return {
    subscribe,
    
    /**
     * Initialize the tenant store from localStorage
     * This should only be called once during app initialization
     */
    async initialize(): Promise<void> {
      if (!browser) return;
      
      update(state => ({ ...state, isLoading: true }));
      
      try {
        // Check localStorage for saved tenant (single-tenant mode may override id via env)
        const selectedTenantId = localStorage.getItem('selectedTenantId');
        const setupCompleted = localStorage.getItem('tenantSetupCompleted') === 'true';
        const configuredId = isSingleTenantMode() ? getConfiguredSingleTenantId() : null;
        const effectiveTenantId = configuredId || selectedTenantId || '';

        if (effectiveTenantId) {
          if (configuredId && selectedTenantId && selectedTenantId !== configuredId) {
            localStorage.setItem('selectedTenantId', configuredId);
          }
          // Lazy load tenantService to avoid circular dependencies
          const { tenantService } = await import('../services/tenantService');
          const result = await tenantService.getTenant(effectiveTenantId);
          const tenant = result.tenant;

          if (tenant) {
            // Tenant found - set as current
            update(state => ({
              ...state,
              currentTenant: tenant,
              setupCompleted: true,
              isLoading: false,
              isInitialized: true,
              error: null
            }));

            // Update localStorage
            localStorage.setItem('selectedTenantId', tenant.id);
            localStorage.setItem('selectedTenantName', tenant.displayName);
            localStorage.setItem('tenantSetupCompleted', 'true');

            debug.log('[TenantStore] Initialized with tenant:', tenant.displayName);
            notifyAfterTenantResolved({
              tenantId: tenant.id,
              source: configuredId ? 'single-tenant-env' : 'local-storage'
            });
          } else if (result.error === 'not_found') {
            // Tenant not found (404) - clear localStorage
            console.warn('[TenantStore] Tenant not found, clearing localStorage');
            localStorage.removeItem('selectedTenantId');
            localStorage.removeItem('selectedTenantName');
            localStorage.removeItem('tenantSetupCompleted');

            update(state => ({
              ...state,
              currentTenant: null,
              setupCompleted: false,
              isLoading: false,
              isInitialized: true,
              error: null
            }));
          } else {
            // 401 or other error - keep current tenant in localStorage, just mark initialized
            update(state => ({
              ...state,
              isLoading: false,
              isInitialized: true,
              error: result.error === 'unauthorized' ? 'Auth or server config issue' : null
            }));
          }
        } else {
          // No tenant in localStorage
          update(state => ({
            ...state,
            setupCompleted,
            isLoading: false,
            isInitialized: true,
            error: null
          }));
        }
      } catch (error) {
        console.error('[TenantStore] Initialization error:', error);
        update(state => ({
          ...state,
          isLoading: false,
          isInitialized: true,
          error: String(error)
        }));
      }
    },
    
    /**
     * Load all tenants for a user
     * Auto-selects the tenant if user has exactly one (non-admin users)
     * Includes retry logic to wait for auth state to be ready
     */
    async loadUserTenants(userId: string, userEmail?: string): Promise<Tenant[]> {
      if (!browser) return [];
      
      update(state => ({ ...state, isLoading: true }));
      
      try {
        // Wait for auth to be ready before making API calls
        // This prevents 401 errors from calling API before token is ready
        const { authService } = await import('../services/authService');
        let retries = 0;
        let user = authService.getCurrentUser();
        
        // Wait for user to be available (up to 2 seconds)
        while (!user && retries < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          user = authService.getCurrentUser();
          retries++;
        }
        
        if (!user) {
          console.warn('[TenantStore] User not available after waiting, auth may not be ready');
          update(state => ({
            ...state,
            isLoading: false,
            error: null,
            userTenants: []
          }));
          return [];
        }
        
        // Ensure token is ready by getting it once and verifying it's valid
        let tokenReady = false;
        let tokenRetries = 0;
        const maxTokenRetries = 10;
        
        while (!tokenReady && tokenRetries < maxTokenRetries) {
          try {
            const token = await user.getIdToken(true); // Force refresh to ensure valid token
            if (token && token.length > 100) { // Basic validation - tokens are usually long
              tokenReady = true;
            } else {
              throw new Error('Token invalid or too short');
            }
          } catch (tokenError: any) {
            console.warn('[TenantStore] Token not ready yet, retrying...', {
              attempt: tokenRetries + 1,
              error: tokenError?.message
            });
            // Wait with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 200 * (tokenRetries + 1)));
            tokenRetries++;
          }
        }
        
        if (!tokenReady) {
          console.error('[TenantStore] Failed to get valid token after retries');
          update(state => ({
            ...state,
            isLoading: false,
            error: 'Failed to get authentication token',
            userTenants: []
          }));
          return [];
        }
        
        // Wait a bit more to ensure token is fully propagated
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check if platform admin - they don't need tenants
        const userIsPlatformAdmin = isPlatformAdmin(userEmail ?? null);
        
        if (userIsPlatformAdmin) {
          update(state => ({
            ...state,
            userTenants: [],
            isLoading: false,
            error: null
          }));
          return [];
        }

        if (isSingleTenantMode() && getConfiguredSingleTenantId()) {
          const singleId = getConfiguredSingleTenantId()!;
          const { tenantService } = await import('../services/tenantService');
          let result = await tenantService.getTenant(singleId);
          let tenant = result.tenant;
          if (!tenant) {
            const list = await tenantService.getUserTenants(userId);
            tenant = list.find((t) => t.id === singleId) || null;
          } else {
            const list = await tenantService.getUserTenants(userId);
            const match = list.find((t) => t.id === singleId);
            if (match) tenant = match;
          }
          if (tenant) {
            update((state) => ({
              ...state,
              userTenants: [tenant],
              currentTenant: tenant,
              setupCompleted: true,
              isLoading: false,
              error: null
            }));
            localStorage.setItem('selectedTenantId', tenant.id);
            localStorage.setItem('selectedTenantName', tenant.displayName);
            localStorage.setItem('tenantSetupCompleted', 'true');
            notifyAfterTenantResolved({ tenantId: tenant.id, source: 'single-tenant-env' });
            debug.log('[TenantStore] Single-tenant mode resolved:', tenant.displayName);
            return [tenant];
          }
          console.warn(
            '[TenantStore] Single-tenant mode: tenant not found or no access for',
            singleId
          );
        }

        const { tenantService } = await import('../services/tenantService');
        const tenants = await tenantService.getUserTenants(userId);
        
        // Auto-select tenant for non-admin users to ensure data isolation
        const currentState = get({ subscribe });
        
        if (tenants.length === 1 && !currentState.currentTenant) {
          // Regular user with one tenant - auto-select it (enforces data isolation)
          const tenant = tenants[0];
          debug.log('[TenantStore] Auto-selecting single tenant:', tenant.displayName);
          
          update(state => ({
            ...state,
            userTenants: tenants,
            currentTenant: tenant,
            setupCompleted: true,
            isLoading: false,
            error: null
          }));
          
          // Save to localStorage
          localStorage.setItem('selectedTenantId', tenant.id);
          localStorage.setItem('selectedTenantName', tenant.displayName);
          localStorage.setItem('tenantSetupCompleted', 'true');
          notifyAfterTenantResolved({ tenantId: tenant.id, source: 'load-user-tenants' });
        } else {
          // Platform admin or multi-tenant user - no auto-selection
          update(state => ({
            ...state,
            userTenants: tenants,
            isLoading: false,
            error: null
          }));
        }
        
        return tenants;
      } catch (error: any) {
        console.error('[TenantStore] Error loading user tenants:', error);
        
        // Handle 401 errors gracefully - don't block the app
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          console.warn('[TenantStore] Auth error - user may not be authenticated yet');
          update(state => ({
            ...state,
            isLoading: false,
            error: null, // Don't set error for auth issues - they're expected during login
            userTenants: []
          }));
          return [];
        }
        
        // Rethrow 5xx / service misconfiguration so TenantGuard can show a clear error instead of redirecting to tenant-setup
        if (error?.status >= 500 || error?.message?.includes('INTERNAL_API_KEY') || error?.message?.includes('Service Unavailable')) {
          update(state => ({ ...state, isLoading: false }));
          throw error;
        }
        
        // For other errors, return empty array but log the error
        update(state => ({
          ...state,
          isLoading: false,
          error: String(error)
        }));
        return [];
      }
    },
    
    /**
     * Set the current tenant
     */
    setCurrentTenant(
      tenant: Tenant | null,
      resolution?: { source?: TenantResolutionSource }
    ): void {
      if (!browser) return;
      
      update(state => ({
        ...state,
        currentTenant: tenant,
        setupCompleted: tenant !== null,
        error: null
      }));
      
      if (tenant) {
        // Save to localStorage
        localStorage.setItem('selectedTenantId', tenant.id);
        localStorage.setItem('selectedTenantName', tenant.displayName);
        localStorage.setItem('tenantSetupCompleted', 'true');
        debug.log('[TenantStore] Current tenant set to:', tenant.displayName);
        notifyAfterTenantResolved({
          tenantId: tenant.id,
          source: resolution?.source ?? 'manual'
        });
      } else {
        // Clear localStorage
        localStorage.removeItem('selectedTenantId');
        localStorage.removeItem('selectedTenantName');
        localStorage.removeItem('tenantSetupCompleted');
      }
    },
    
    /**
     * Mark setup as completed
     */
    markSetupCompleted(): void {
      if (!browser) return;
      
      update(state => ({ ...state, setupCompleted: true }));
      localStorage.setItem('tenantSetupCompleted', 'true');
    },
    
    /**
     * Clear all tenant state (for logout)
     */
    clear(): void {
      if (!browser) return;
      
      set(initialState);
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      localStorage.removeItem('tenantSetupCompleted');
      sessionStorage.clear();
    },
    
    /**
     * Alias for clear() method for compatibility
     */
    clearTenantData(): void {
      this.clear();
    },
    
    /**
     * Set error state
     */
    setError(error: string): void {
      update(state => ({ ...state, error }));
    },
    
    /**
     * Clear error state
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },
    
    /**
     * Check if user needs to go through tenant setup
     */
    needsSetup(): boolean {
      const state = get({ subscribe });
      return state.isInitialized && !state.currentTenant && !state.setupCompleted;
    },
    
    /**
     * Check if tenant is loaded and ready
     */
    isReady(): boolean {
      const state = get({ subscribe });
      return state.isInitialized && state.currentTenant !== null;
    }
  };
}

// Export the singleton store
export const tenantStore = createTenantStore();

// Derived stores for convenience
export const currentTenant = derived(tenantStore, $store => $store.currentTenant);
export const userTenants = derived(tenantStore, $store => $store.userTenants);
export const tenantLoading = derived(tenantStore, $store => $store.isLoading);
export const tenantError = derived(tenantStore, $store => $store.error);
export const tenantReady = derived(tenantStore, $store => $store.isInitialized && $store.currentTenant !== null);

