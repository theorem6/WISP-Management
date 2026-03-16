<script lang="ts">
  /**
   * TenantGuard Component
   * 
   * Handles authentication and tenant validation in one centralized place.
   * Prevents redundant checks and eliminates redirect loops.
   * 
   * Usage: Wrap protected content in <TenantGuard>
   */
  
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantStore } from '../../stores/tenantStore';
  import { authService } from '../../services/authService';
  import { isPlatformAdmin } from '../../services/adminService';
  import { debug } from '../../utils/debug';
  
  export let requireTenant = true; // If false, only checks auth
  export let adminOnly = false; // If true, only admins can access
  
  let isChecking = true;
  let isAuthenticated = false;
  let isAdmin = false;
  let tenantState: any = null;
  let error = '';
  
  // Subscribe to tenant store
  const unsubscribe = tenantStore.subscribe(state => {
    tenantState = state;
  });
  
  onMount(async () => {
    if (!browser) return;
    
    try {
      // Step 1: Check Firebase authentication with retry logic
      let currentUser = authService.getCurrentUser();
      if (!currentUser) {
        // Wait for auth state to initialize (with reduced retries)
        let retries = 0;
        const maxRetries = 5; // 0.5 seconds total wait (reduced from 1.5s)
        while (!currentUser && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          currentUser = authService.getCurrentUser();
          retries++;
        }
        
        if (!currentUser) {
          console.log('[TenantGuard] Not authenticated after retries, redirecting to login');
          await goto('/login', { replaceState: true });
          return;
        }
      }
      
      isAuthenticated = true;
      
      // Step 2: Check if user is admin
      const userEmail = currentUser?.email || '';
      isAdmin = isPlatformAdmin(userEmail);
      
      // Step 3: Check admin-only access
      if (adminOnly && !isAdmin) {
        console.log('[TenantGuard] Admin access required but user is not admin');
        error = 'This page requires administrator access.';
        isChecking = false;
        return;
      }
      
      // Step 4: Initialize tenant store if not already initialized
      if (!tenantState.isInitialized) {
        console.log('[TenantGuard] Initializing tenant store...');
        await tenantStore.initialize();
      }
      
      // Step 4.5: Ensure token is ready before making API calls
      // This is critical - tokens need time to propagate after login
      let tokenReady = false;
      let tokenRetries = 0;
      const maxTokenRetries = 3; // Reduced from 10
      
      while (!tokenReady && tokenRetries < maxTokenRetries) {
        try {
          const token = await currentUser.getIdToken(true); // Force refresh
          if (token && token.length > 100) {
            tokenReady = true;
          } else {
            throw new Error('Token invalid or too short');
          }
        } catch (tokenError: any) {
          console.warn('[TenantGuard] Token not ready yet, retrying...', {
            attempt: tokenRetries + 1,
            error: tokenError?.message
          });
          await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay from 200ms * retries
          tokenRetries++;
        }
      }
      
      if (!tokenReady) {
        console.error('[TenantGuard] Failed to get valid token after retries');
        error = 'Authentication token not ready. Please refresh the page.';
        isChecking = false;
        return;
      }
      
      // Removed 300ms delay - token is ready, proceed immediately
      
      // Step 5: Check tenant requirement
      if (requireTenant) {
        if (!isAdmin) {
          // Regular users need a tenant for data isolation
          if (!tenantState.currentTenant) {
            // No tenant selected - load user's tenants
            if (currentUser) {
              let tenants: any[] = [];
              try {
                tenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
              } catch (err: any) {
                console.error('[TenantGuard] Error loading tenants:', err);
                // If 401 error, backend auth is misconfigured - show helpful message
                if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
                  error = 'Authentication error: Backend cannot verify your login. Please contact support.';
                  isChecking = false;
                  return;
                }
                // 503 / service misconfiguration (e.g. INTERNAL_API_KEY not set) - show clear error, do NOT redirect to tenant-setup
                if (err?.status === 503 || err.message?.includes('INTERNAL_API_KEY') || err.message?.includes('Service Unavailable')) {
                  error = 'We couldn\'t load your organizations (service configuration issue). Please try again later or contact support.';
                  isChecking = false;
                  return;
                }
                // Other errors - treat as no tenants and redirect to tenant selector/setup
                tenants = [];
              }
              
              if (tenants.length === 0) {
                // No tenants - only send to tenant setup if user hasn't already completed setup
                const setupCompleted = browser && localStorage.getItem('tenantSetupCompleted') === 'true';
                if (!setupCompleted) {
                  console.log('[TenantGuard] No tenants found and setup not completed - redirecting to tenant setup');
                  isChecking = false;
                  await goto('/tenant-setup', { replaceState: true });
                  return;
                }
                console.log('[TenantGuard] No tenants from API but setupCompleted=true - skipping tenant setup redirect');
              } else if (tenants.length === 1) {
                // Auto-select single tenant
                console.log('[TenantGuard] Auto-selecting single tenant');
                tenantStore.setCurrentTenant(tenants[0]);
              } else {
                // Multiple tenants - redirect to selector
                await goto('/tenant-selector', { replaceState: true });
                return;
              }
            }
          }
          
          // Verify tenant is still valid
          if (tenantState.currentTenant) {
            console.log('[TenantGuard] Tenant validated:', tenantState.currentTenant.displayName);
          }
        } else {
          // Platform admin (admin@wisptools.io) has master tenant rights
          // Can add, change, or delete tenant admins
          console.log('[TenantGuard] Platform admin - has master tenant rights');
          if (!tenantState.currentTenant && currentUser) {
            const tenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
            if (tenants.length > 0) {
              // Just load tenants without auto-selecting for admin
              console.log('[TenantGuard] Admin has', tenants.length, 'tenants available');
            }
          }
        }
      }
      
      isChecking = false;
      console.log('[TenantGuard] Guard checks completed successfully');
      
    } catch (err) {
      console.error('[TenantGuard] Error during checks:', err);
      // Don't immediately redirect to login on errors - show error instead
      error = 'Failed to validate access. Please refresh the page.';
      isChecking = false;
    }
  });
  
  // Cleanup subscription
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    unsubscribe();
  });
</script>

{#if isChecking}
  <div class="guard-loading">
    <div class="loading-spinner"></div>
    <p>Verifying access...</p>
  </div>
{:else if error}
  <div class="guard-error">
    <div class="error-icon">⚠️</div>
    <h2>Access Error</h2>
    <p>{error}</p>
    <button on:click={() => goto('/dashboard')}>Go to Dashboard</button>
  </div>
{:else}
  <slot />
{/if}

<style>
  .guard-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
  }
  
  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(124, 58, 237, 0.1);
    border-top-color: var(--brand-primary, #7c3aed);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .guard-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }
  
  .error-icon {
    font-size: 4rem;
  }
  
  .guard-error h2 {
    margin: 0;
  }
  
  .guard-error p {
    color: var(--text-secondary, #666);
    max-width: 400px;
  }
  
  .guard-error button {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .guard-error button:hover {
    transform: translateY(-2px);
  }
</style>

