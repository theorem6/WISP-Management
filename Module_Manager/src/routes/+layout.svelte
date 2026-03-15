<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { authService } from '$lib/services/authService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import { themeManager } from '$lib/stores/themeStore';
  import '../app.css';
  
  let isInitializing = true;
  let isAuthenticated = false;
  let currentUser: any = null;

  /** Routes that do not require authentication (login, signup, auth callbacks, etc.) */
  function isPublicRoute(pathname: string): boolean {
    const p = pathname;
    return (
      p === '/' ||
      p === '' ||
      p === '/login' ||
      p === '/signup' ||
      p === '/reset-password' ||
      p.startsWith('/auth/') ||
      p.startsWith('/oauth/') ||
      p.startsWith('/modules/customers/portal/login') ||
      p.startsWith('/modules/customers/portal/signup') ||
      p.startsWith('/portal/')
    );
  }

  // Check if we're on an admin route
  $: isAdminRoute = $page.url.pathname.startsWith('/admin');
  
  // Redirect unauthenticated users to login (except on public routes)
  $: if (browser && !isInitializing && !isAuthenticated && !isPublicRoute($page.url.pathname)) {
    goto('/login', { replaceState: true });
  }
  
  // When at app root and not authenticated, redirect to login
  $: if (browser && !isInitializing && !isAuthenticated && ($page.url.pathname === '/' || $page.url.pathname === '')) {
    goto('/login', { replaceState: true });
  }
  
  onMount(async () => {
    if (!browser) return;
    
    console.log('[Root Layout] Initializing theme system...');
    // Theme manager is automatically initialized when imported
    
    console.log('[Root Layout] Initializing authentication...');
    
    // Wait for Firebase auth to restore session (prevents redirect loop on refresh)
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Check Firebase authentication state (sync after init)
    const user = authService.getCurrentUser();
    isAuthenticated = !!user;
    currentUser = user;
    
    console.log('[Root Layout] Auth state:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
    // Initialize tenant store only if authenticated
    if (isAuthenticated) {
      console.log('[Root Layout] Initializing tenant store...');
      await tenantStore.initialize();
      console.log('[Root Layout] Tenant store initialized');
    }
    
    isInitializing = false;
  });
  
  
  // Simple auth state listener for basic protection
  // TenantGuard will handle the complex logic
  authService.onAuthStateChange((user) => {
    if (!browser) return;
    
    isAuthenticated = !!user;
    currentUser = user;
    
    console.log('[Root Layout] Auth state changed:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
    // Only handle sign-out (let TenantGuard handle sign-in)
    if (!isAuthenticated) {
      tenantStore.clearTenantData();
    }
  });
</script>

{#if isInitializing}
  <div class="auth-loading">
    <div class="spinner"></div>
    <p>Initializing authentication...</p>
  </div>
{:else}
  <!-- Let TenantGuard handle authentication and tenant logic -->
  <slot />
{/if}

<style>
  .auth-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-primary);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border-color);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-loading p {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
</style>