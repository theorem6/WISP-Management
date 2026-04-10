<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { authService } from '$lib/services/authService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import { themeManager } from '$lib/stores/themeStore';
  import '../app.css';
  import DemoSiteBanner from '$lib/components/DemoSiteBanner.svelte';
  import { env } from '$env/dynamic/public';
  
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

  /** Demo / test deployment banner (PUBLIC_DEMO_SITE=true) */
  $: showDemoBanner =
    browser &&
    !isInitializing &&
    isAuthenticated &&
    (env.PUBLIC_DEMO_SITE === 'true' || env.PUBLIC_DEMO_SITE === '1');
  
  // Enforce that every new session must pass through the login page at least once,
  // regardless of any cached Firebase auth state.
  $: if (browser && !isInitializing) {
    const path = $page.url.pathname;
    const loginCompleted = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('wm_session_login_completed') === 'true'
      : false;

    // Allow the actual login and auth callback/reset routes to be accessed freely
    const isLoginOrAuthRoute =
      path === '/login' ||
      path === '/signup' ||
      path === '/reset-password' ||
      path.startsWith('/auth/') ||
      path.startsWith('/oauth/');

    // If this session has not yet completed an explicit login,
    // force the user to the login page for any other route.
    if (!loginCompleted && !isLoginOrAuthRoute) {
      goto('/login', { replaceState: true });
    }
  }
  
  onMount(async () => {
    if (!browser) return;

    // Ensure login is always the first step for a new browser session.
    // On the very first load in this tab/session, clear any cached Firebase auth
    // so that the user must visit the login screen explicitly.
    try {
      const sessionKey = 'wm_session_login_initialized';
      const alreadyInitialized = sessionStorage.getItem(sessionKey) === 'true';
      if (!alreadyInitialized) {
        console.log('[Root Layout] Clearing cached auth for new session - forcing explicit login');
        await authService.signOut();
        sessionStorage.setItem(sessionKey, 'true');
      }
    } catch (e) {
      console.warn('[Root Layout] Failed to enforce first-login session rule', e);
    }
    
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
  {#if showDemoBanner}
    <DemoSiteBanner />
  {/if}
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