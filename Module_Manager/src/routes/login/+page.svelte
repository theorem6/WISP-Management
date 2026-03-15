<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { authService } from '$lib/services/authService';
  import { tenantService } from '$lib/services/tenantService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import type { User } from 'firebase/auth';
  import { isPlatformAdmin } from '$lib/services/adminService';

  let email = '';
  let password = '';
  let isLoading = false;
  let error = '';
  let success = '';
  let showPasswordReset = false;
  let passwordResetEmail = '';
  let passwordResetSent = false;

  // Listen for Google sign-in completion via auth state listener
  let googleSignInHandler: ((e: CustomEvent) => void) | null = null;

  onMount(async () => {
    if (!browser) return;
    
    console.log('[Login Page] 🔄 Page mounted, checking authentication...');
    console.log('[Login Page] Current URL:', window.location.href);
    console.log('[Login Page] URL search:', window.location.search);
    console.log('[Login Page] URL hash:', window.location.hash);
    console.log('[Login Page] Full URL:', window.location.toString());
    
    // Check if we have a stored redirect URL (indicates we just came back from Google)
    const storedRedirectUrl = typeof window !== 'undefined' ? sessionStorage.getItem('google_signin_redirect_url') : null;
    const signInInitiated = typeof window !== 'undefined' ? sessionStorage.getItem('google_signin_initiated') : null;
    
    if (storedRedirectUrl || signInInitiated) {
      console.log('[Login Page] 🔵 Detected return from Google sign-in!', {
        storedRedirectUrl,
        signInInitiated: signInInitiated ? new Date(parseInt(signInInitiated)).toISOString() : null,
        timeSinceInitiated: signInInitiated ? Date.now() - parseInt(signInInitiated) + 'ms' : null
      });
      
      // Don't remove these yet - we'll remove them after successful login
      // This helps us detect if we're in a redirect flow
    }
    
    // Listen for Google sign-in completion event from auth service
    // This is a fallback when getRedirectResult() doesn't work
    googleSignInHandler = (e: CustomEvent) => {
      console.log('[Login Page] 🔵✅ Received google-signin-complete event!', e.detail);
      if (e.detail?.user) {
        console.log('[Login Page] Processing Google sign-in from event...');
        // Clear the stored redirect indicators
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('google_signin_redirect_url');
          sessionStorage.removeItem('google_signin_initiated');
        }
        handleGoogleRedirectSuccess(e.detail.user);
      } else {
        console.warn('[Login Page] Event received but no user data:', e.detail);
      }
    };
    window.addEventListener('google-signin-complete', googleSignInHandler as EventListener);
    console.log('[Login Page] ✅ Registered listener for google-signin-complete event');
    
    // CRITICAL: Check redirect result IMMEDIATELY, synchronously, before ANY delays
    // getRedirectResult() must be called before auth state listener processes the redirect
    // Firebase redirects back to the same page, so check immediately
    let redirectResult: any = null;
    try {
      console.log('[Login Page] 🔍 Checking for Google redirect result (SYNCHRONOUS, must be first!)...');
      redirectResult = await authService.checkRedirectResult();
      console.log('[Login Page] 📋 Redirect result:', redirectResult);
    } catch (err: any) {
      console.error('[Login Page] ❌ Error checking redirect result:', err);
      error = err.message || 'Error processing Google sign-in';
    }
    
    // Process redirect result if found
    if (redirectResult && redirectResult.success && redirectResult.data) {
      console.log('[Login Page] ✅ Google redirect sign-in successful! Processing...');
      // Handle the successful redirect sign-in
      await handleGoogleRedirectSuccess(redirectResult.data);
      return; // Exit early - redirect will happen
    } else if (redirectResult && !redirectResult.success) {
      error = redirectResult.error || 'Google sign-in failed';
      console.error('[Login Page] ❌ Google redirect sign-in failed:', error);
      isLoading = false;
    } else {
      console.log('[Login Page] ℹ️ No redirect result found (normal for non-redirect visits)');
    }
    
    // Wait a moment for auth service to fully initialize (only if no redirect)
    if (!redirectResult || !redirectResult.success) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // FALLBACK: If no redirect result but user is authenticated, they might have signed in via redirect
    // The auth state listener might have processed the redirect before we checked
    // Wait and check multiple times for the user to appear
    let currentUser = authService.getCurrentUser();
    console.log('[Login Page] 🔍 Checking for authenticated user (fallback, attempt 1):', {
      hasUser: !!currentUser,
      userEmail: currentUser?.email,
      providerData: currentUser?.providerData?.map(p => p.providerId) || []
    });
    
    // If we detected a return from Google (stored redirect URL or sign-in initiated), 
    // wait more aggressively for the auth state to update
    const isReturnFromGoogle = storedRedirectUrl || signInInitiated;
    if (!currentUser && isReturnFromGoogle) {
      console.log('[Login Page] 🔄 Detected return from Google but no user yet - waiting aggressively for auth state...');
      console.log('[Login Page] This might take a moment as Firebase processes the redirect...');
      
      // Wait longer and check more times (up to 3 seconds)
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        currentUser = authService.getCurrentUser();
        if (currentUser) {
          console.log('[Login Page] ✅ User found after waiting:', {
            attempt: i + 1,
            email: currentUser.email,
            providerData: currentUser.providerData.map(p => p.providerId)
          });
          break;
        }
        if (i % 5 === 0) {
          console.log(`[Login Page] Still waiting for auth state... (attempt ${i + 1}/15)`);
        }
      }
    }
    
    if (currentUser && !redirectResult) {
      // Check if this user signed in with Google (has Google provider)
      const isGoogleUser = currentUser.providerData.some(p => p.providerId === 'google.com');
      if (isGoogleUser) {
        console.log('[Login Page] 🔵✅ User authenticated with Google (redirect completed via fallback, processing...)');
        // Clear the stored redirect indicators
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('google_signin_redirect_url');
          sessionStorage.removeItem('google_signin_initiated');
        }
        await handleGoogleRedirectSuccess({ email: currentUser.email, uid: currentUser.uid });
        return;
      } else {
        console.log('[Login Page] ℹ️ User found but not Google user:', currentUser.providerData.map(p => p.providerId));
      }
    } else if (!currentUser && isReturnFromGoogle) {
      console.warn('[Login Page] ⚠️ Detected return from Google but no user found after waiting 3 seconds');
      console.warn('[Login Page] This suggests Firebase redirect flow may not be completing properly');
      console.warn('[Login Page] Possible causes:');
      console.warn('[Login Page] 1. Firebase Auth domain configuration issue');
      console.warn('[Login Page] 2. Custom domain redirect not properly configured');
      console.warn('[Login Page] 3. Browser blocking third-party cookies/storage');
      
      // Clear the stored redirect indicators to prevent infinite loops
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('google_signin_redirect_url');
        sessionStorage.removeItem('google_signin_initiated');
      }
    }
    
    // Check for error in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam === 'no-tenant') {
      error = 'You do not have access to any organizations. Please contact your administrator to be added to a tenant.';
      // Clear the error parameter from URL
      window.history.replaceState({}, '', '/login');
    }
    
    // Check if already authenticated with Firebase
    const user = authService.getCurrentUser();
    const isAuthenticated = !!user;
    
    console.log('[Login Page] Auth check:', {
      isAuthenticated,
      userEmail: user?.email || 'none'
    });
    
        if (isAuthenticated) {
          const userEmail = authService.getCurrentUser()?.email;
          const isPlatformAdminUser = isPlatformAdmin(userEmail || null);
          if (isPlatformAdminUser) {
            console.log('[Login Page] Already authenticated as platform admin, redirecting to admin pages');
            await goto('/admin/management', { replaceState: true });
          } else {
            console.log('[Login Page] Already authenticated, redirecting to dashboard');
            await goto('/dashboard', { replaceState: true });
          }
        } else {
      console.log('[Login Page] Not authenticated, showing login form');
    }
  });

  onDestroy(() => {
    // Clean up event listener
    if (googleSignInHandler && typeof window !== 'undefined') {
      window.removeEventListener('google-signin-complete', googleSignInHandler as EventListener);
    }
  });

  async function handleSubmit() {
    isLoading = true;
    error = '';
    success = '';

    // Basic validation
    if (!email || !password) {
      error = 'Please enter email and password';
      isLoading = false;
      return;
    }

    try {
      console.log('[Login Page] Form submitted:', { email });
      console.log('[Login Page] Calling authService.signIn...');
      
      console.log('[Login Page] Attempting sign in...');
      const result = await authService.signIn(email, password);
      console.log('[Login Page] Sign in result:', result);

      if (result.success) {
        console.log('[Login Page] Authentication successful, waiting for auth state...');
        
        // Wait for Firebase auth state to fully update before redirecting
        // This prevents redirect loops where dashboard checks auth before state is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify auth state is ready
        let user = authService.getCurrentUser();
        let retries = 0;
        while (!user && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          user = authService.getCurrentUser();
          retries++;
        }
        
        if (!user) {
          console.error('[Login Page] Auth state not ready after login, retrying...');
          error = 'Authentication state not ready. Please try again.';
          isLoading = false;
          return;
        }
        
        console.log('[Login Page] Auth state ready');
        
        // Store user info in localStorage for compatibility
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        
        // Ensure token is ready before making API calls
        // Force token refresh to ensure it's valid for backend
        try {
          const token = await user.getIdToken(true);
          console.log('[Login Page] Token ready:', { 
            hasToken: !!token, 
            tokenLength: token?.length,
            userId: user.uid 
          });
        } catch (tokenError: any) {
          console.warn('[Login Page] Token refresh warning:', tokenError);
          // Continue anyway - getAuthHeaders will retry
        }
        
        // Wait longer to ensure Firebase auth state is fully propagated
        // This is critical for tenant API calls to work
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Check if platform admin - redirect to admin management page
        const userIsPlatformAdmin = isPlatformAdmin(email);
        
        if (userIsPlatformAdmin) {
          console.log('[Login Page] Platform admin login, redirecting to admin pages');
          await goto('/admin/management', { replaceState: true });
        } else {
        // Robust tenant connection for logins
        const userRole = await ensureTenantConnection(user, email, false);
          
          console.log('[Login Page] User role:', userRole);
          
          // Redirect based on user role
          if (userRole === 'support') {
            console.log('[Login Page] Redirecting support user to support dashboard');
            await goto('/support-dashboard', { replaceState: true });
          } else {
            console.log('[Login Page] Redirecting to dashboard');
            await goto('/dashboard', { replaceState: true });
          }
        }
      } else {
        // Provide more helpful error messages
        const errorMsg = result.error || 'Authentication failed';
        
        // Check if this might be a platform admin account issue
        const isAdminEmail = email.toLowerCase() === 'admin@wisptools.io';
        if (isAdminEmail && errorMsg.includes('Invalid')) {
          error = 'Invalid credentials. If this is a platform admin account, ensure it exists in Firebase Authentication. You may need to create the account first or use Google Sign-In.';
        } else {
          // For invalid credential errors, suggest using password reset
          if (errorMsg.includes('Invalid email or password')) {
            error = errorMsg + ' Click "Forgot password?" below to reset your password or set a new one.';
          } else {
            error = errorMsg;
          }
        }
        
        console.error('[Login Page] Authentication failed:', error);
      }
    } catch (err: any) {
      error = err.message || 'An unexpected error occurred';
      console.error('[Login Page] Authentication error:', err);
      console.error('[Login Page] Error stack:', err.stack);
    } finally {
      isLoading = false;
    }
  }

  /**
   * Robust tenant connection after login
   * Ensures tenant is loaded, set, and available for all services
   * Returns the user's role in their primary tenant
   */
  async function ensureTenantConnection(user: User, email: string, isNewUser: boolean = false): Promise<string | null> {
    try {
      console.log('[Login Page] Ensuring tenant connection...', { userId: user.uid, email, isNewUser });
      
      // Initialize tenant store first
      await tenantStore.initialize();
      console.log('[Login Page] Tenant store initialized');
      
      // Load user's tenants
      const tenants = await tenantStore.loadUserTenants(user.uid, email);
      console.log('[Login Page] Loaded tenants:', tenants.length);
      
      // Check if we have a saved tenant in localStorage
      const savedTenantId = localStorage.getItem('selectedTenantId');
      let currentTenant = null;
      
      if (savedTenantId) {
        // Try to find the saved tenant in the loaded list
        currentTenant = tenants.find(t => t.id === savedTenantId);
        if (currentTenant) {
          console.log('[Login Page] Found saved tenant:', currentTenant.displayName);
          tenantStore.setCurrentTenant(currentTenant);
        } else {
          console.warn('[Login Page] Saved tenant not found in user tenants, clearing saved tenant');
          localStorage.removeItem('selectedTenantId');
          localStorage.removeItem('selectedTenantName');
        }
      }
      
      // Check if user is platform admin
      const userIsPlatformAdmin = isPlatformAdmin(email);
      
      // Platform admins don't need tenants - allow them to proceed
      if (userIsPlatformAdmin) {
        console.log('[Login Page] Platform admin detected, allowing login without tenant');
        // Platform admins can proceed without a tenant
        return 'platform_admin';
      }
      
      // If no current tenant set yet, try auto-selection
      if (!currentTenant && tenants.length > 0) {
        // Auto-select single tenant for non-admin users
        if (tenants.length === 1) {
          console.log('[Login Page] Auto-selecting single tenant:', tenants[0].displayName);
          currentTenant = tenants[0];
          tenantStore.setCurrentTenant(currentTenant);
        } else if (tenants.length > 0) {
          // Multiple tenants - use first tenant as default if none selected
          console.log('[Login Page] Multiple tenants available, using first as default');
          currentTenant = tenants[0];
          tenantStore.setCurrentTenant(currentTenant);
        }
      }
      
      // Note: New users should use the signup wizard which handles tenant creation
      
      // Ensure tenantId is in localStorage for services
      const finalTenant = get(tenantStore).currentTenant;
      let userRole: string | null = null;
      
      if (finalTenant) {
        localStorage.setItem('selectedTenantId', finalTenant.id);
        localStorage.setItem('selectedTenantName', finalTenant.displayName);
        // Get user's role in this tenant
        userRole = finalTenant.userRole || null;
        console.log('[Login Page] Tenant connection complete:', finalTenant.displayName, 'Role:', userRole);
      } else {
        console.warn('[Login Page] No tenant available after connection attempt');
        // Clear any stale tenant data
        localStorage.removeItem('selectedTenantId');
        localStorage.removeItem('selectedTenantName');
      }
      
      return userRole;
    } catch (error: any) {
      console.error('[Login Page] Error ensuring tenant connection:', error);
      // Don't block login - tenant can be set later
      // Clear any stale tenant data
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      return null;
    }
  }

  /**
   * Create an automatic tenant for a new user
   * Uses email domain or generates a name from email
   */
  async function createAutomaticTenant(user: User, email: string): Promise<void> {
    try {
      // Extract organization name from email domain or use email prefix
      const emailParts = email.split('@');
      const domain = emailParts[1] || '';
      const domainParts = domain.split('.');
      const orgName = domainParts[0] || emailParts[0] || 'My Organization';
      
      // Capitalize first letter
      const displayName = orgName.charAt(0).toUpperCase() + orgName.slice(1);
      
      // Generate subdomain (lowercase, alphanumeric + hyphens)
      const subdomain = orgName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').trim();
      
      console.log('[Login Page] Creating tenant:', {
        name: orgName,
        displayName,
        subdomain,
        contactEmail: email,
        userId: user.uid
      });
      
      // Create tenant with user as owner
      const result = await tenantService.createTenant(
        orgName,
        displayName,
        email,
        user.uid,
        subdomain,
        true,  // Create owner association
        email  // Owner email
      );
      
      if (result.success && result.tenantId) {
        console.log('[Login Page] Tenant created:', result.tenantId);
        
        // Load the newly created tenant and set it as current
        const { tenant } = await tenantService.getTenant(result.tenantId);
        if (tenant) {
          tenantStore.setCurrentTenant(tenant);
          console.log('[Login Page] Tenant set as current:', tenant.displayName);
        }
      } else {
        throw new Error(result.error || 'Failed to create tenant');
      }
    } catch (error: any) {
      console.error('[Login Page] Automatic tenant creation failed:', error);
      throw error;
    }
  }

  async function handlePasswordReset() {
    if (!passwordResetEmail || !passwordResetEmail.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    isLoading = true;
    error = '';
    success = '';

    try {
      const result = await authService.resetPassword(passwordResetEmail);
      if (result.success) {
        passwordResetSent = true;
        success = 'Password reset email sent! Check your inbox for instructions.';
      } else {
        error = result.error || 'Failed to send password reset email';
      }
    } catch (err: any) {
      error = err.message || 'Failed to send password reset email';
    } finally {
      isLoading = false;
    }
  }

  async function handleGoogleSignIn() {
    isLoading = true;
    error = '';

    try {
      console.log('[Login Page] Initiating Google sign in...');
      const result = await authService.signInWithGoogle('login');

      if (result.success) {
        // Redirect will happen automatically - user will be redirected to Google
        // Then back to login page where handleGoogleRedirectSuccess will be called
        console.log('[Login Page] Redirecting to Google for sign-in...');
        // Don't set isLoading = false here - redirect is happening
        return;
      } else {
        error = result.error || 'Google authentication failed';
        console.error('[Login Page] Google authentication failed:', error);
        isLoading = false;
      }
    } catch (err: any) {
      error = err.message || 'Google authentication error';
      console.error('[Login Page] Google authentication error:', err);
      isLoading = false;
    }
  }

  /**
   * Handle successful Google Sign-In redirect
   */
  async function handleGoogleRedirectSuccess(userProfile: any) {
    isLoading = true;
    error = '';

    try {
      console.log('[Login Page] Processing Google redirect sign-in...');
      
      // Wait for Firebase auth state to fully update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the actual user from Firebase
      let finalUser = authService.getCurrentUser();
      if (!finalUser) {
        // Wait a bit more
        let retries = 0;
        while (!finalUser && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          finalUser = authService.getCurrentUser();
          retries++;
        }
      }
      if (!finalUser) {
        console.error('[Login Page] Auth state not ready after Google redirect');
        error = 'Authentication state not ready. Please try again.';
        isLoading = false;
        return;
      }
      
      console.log('[Login Page] Google redirect auth state ready');

      // Check if platform admin (admin@wisptools.io)
      const isPlatformAdminUser = isPlatformAdmin(finalUser.email);
      
      // Allow all email domains - no restriction
      console.log('[Login Page] User authenticated:', { 
        email: finalUser.email, 
        isPlatformAdmin: isPlatformAdminUser 
      });
      
      // Store user info in localStorage for compatibility
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', finalUser.email || '');
      
      // Ensure token is ready before making API calls
      try {
        const token = await finalUser.getIdToken(true);
        console.log('[Login Page] Google token ready:', { 
          hasToken: !!token, 
          tokenLength: token?.length,
          userId: finalUser.uid 
        });
      } catch (tokenError: any) {
        console.warn('[Login Page] Google token refresh warning:', tokenError);
      }
      
      // Wait a bit more to ensure Firebase auth state is fully propagated
      await new Promise(resolve => setTimeout(resolve, 300));
      
          // Check if platform admin - redirect to admin management page
          if (isPlatformAdminUser) {
            console.log('[Login Page] Platform admin Google login, redirecting to admin pages');
            await goto('/admin/management', { replaceState: true });
          } else {
        // Robust tenant connection for Google sign-in
        const userRole = await ensureTenantConnection(finalUser, finalUser.email || '', true);
        
        console.log('[Login Page] Google login tenant connection complete, role:', userRole);
        
        // Redirect to dashboard
        await goto('/dashboard', { replaceState: true });
      }
    } catch (err: any) {
      error = err.message || 'Error processing Google sign-in';
      console.error('[Login Page] Error processing Google redirect:', err);
      isLoading = false;
    }
  }

</script>

<div class="login-page">
  <div class="login-container">
    <!-- Branding Section -->
    <div class="login-brand">
      <img src="/wisptools-logo.svg" alt="WISP Management" class="brand-logo" />
      <h1>WISP Management</h1>
      <p class="brand-tagline">wisptools.io</p>
      <p class="poc-notice">Part of wisptools.io. Source code: <a href="https://github.com/theorem6/WISP-Management" target="_blank" rel="noopener noreferrer">GitHub</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
    </div>

    <!-- Login Form -->
    <div class="login-card">
      <h2>Welcome Back</h2>
      <p class="subtitle">
        Sign in to access your network management tools
      </p>

      {#if error}
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          {error}
        </div>
      {/if}

      {#if success}
        <div class="success-message" style="background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #22c55e; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>✅</span>
          {success}
        </div>
      {/if}

      {#if showPasswordReset}
        <div class="password-reset-form" style="background: rgba(0, 217, 255, 0.1); border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; color: #00d9ff;">Reset Password</h3>
          {#if !passwordResetSent}
            <p style="color: #a0d9e8; margin-bottom: 1rem; font-size: 0.875rem;">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div class="form-group">
              <label for="passwordResetEmail">Email Address</label>
              <input
                id="passwordResetEmail"
                type="email"
                bind:value={passwordResetEmail}
                placeholder="your@email.com"
                disabled={isLoading}
                required
              />
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <button 
                type="button" 
                class="btn-primary" 
                onclick={handlePasswordReset}
                disabled={isLoading || !passwordResetEmail}
                style="flex: 1;"
              >
                {#if isLoading}
                  <span class="spinner"></span>
                  Sending...
                {:else}
                  Send Reset Link
                {/if}
              </button>
              <button 
                type="button" 
                class="link-btn" 
                onclick={() => { showPasswordReset = false; passwordResetEmail = ''; passwordResetSent = false; error = ''; success = ''; }}
                disabled={isLoading}
                style="background: rgba(0, 217, 255, 0.2); border: 1px solid rgba(0, 217, 255, 0.3); color: #00d9ff; padding: 0.875rem 1rem; border-radius: 0.5rem;"
              >
                Cancel
              </button>
            </div>
          {:else}
            <p style="color: #a0d9e8; margin-bottom: 1rem;">
              ✅ Password reset email sent! Please check your inbox and follow the instructions to reset your password.
            </p>
            <button 
              type="button" 
              class="link-btn" 
              onclick={() => { showPasswordReset = false; passwordResetEmail = ''; passwordResetSent = false; success = ''; }}
              style="background: rgba(0, 217, 255, 0.2); border: 1px solid rgba(0, 217, 255, 0.3); color: #00d9ff; padding: 0.875rem 1rem; border-radius: 0.5rem; width: 100%;"
            >
              Back to Sign In
            </button>
          {/if}
        </div>
      {/if}

      {#if !showPasswordReset}
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            disabled={isLoading}
            required
          />
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label for="password">Password</label>
            <button 
              type="button" 
              class="link-btn" 
              style="font-size: 0.875rem; padding: 0;"
              onclick={() => showPasswordReset = true}
            >
              Forgot password?
            </button>
          </div>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="Enter your password"
            disabled={isLoading}
            required
          />
        </div>

        <button type="submit" class="btn-primary" disabled={isLoading}>
          {#if isLoading}
            <span class="spinner"></span>
            Signing in...
          {:else}
            Sign In
          {/if}
        </button>
      </form>
      {/if}

      <div class="form-footer">
        <a 
          href="/signup" 
          class="link-btn"
          onclick={(e) => {
            e.preventDefault();
            goto('/signup');
          }}
        >
          Don't have an account? Create one
        </a>
      </div>

      <div class="login-divider">
        <span></span>
        <p>or</p>
        <span></span>
      </div>

      <button type="button" class="btn-google" onclick={handleGoogleSignIn} disabled={isLoading}>
        <svg aria-hidden="true" viewBox="0 0 533.5 544.3">
          <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.4-34.1-4.1-50.2H272v95h147.5c-6.4 34-25 62.8-53.4 82v68h86.1c50.4-46.5 80.3-115.1 80.3-194.8z"/>
          <path fill="#34a853" d="M272 544.3c72.2 0 132.8-23.9 177-64.7l-86.1-68c-23.9 16.1-54.5 25.7-90.9 25.7-69.9 0-129.2-47.2-150.4-110.5h-90.7v69.8c44 87.4 134.5 148.7 241.1 148.7z"/>
          <path fill="#fbbc04" d="M121.6 326.8c-10.2-30-10.2-62.5 0-92.5v-69.8h-90.7c-37.3 74.6-37.3 158.4 0 233z"/>
          <path fill="#ea4335" d="M272 107.7c39.2-.6 76.4 13.8 105 39.9l78.2-78.2C404.5 25.5 344 0 272 0 165.4 0 74.9 61.3 30.9 148.7l90.7 69.8C142.7 175 202.1 107.7 272 107.7z"/>
        </svg>
        <span>Sign in with Google</span>
      </button>

    </div>

    <!-- Features Section -->
    <div class="features">
      <div class="feature">
        <span class="feature-icon">📊</span>
        <h3>PCI Resolution</h3>
        <p>Automated conflict detection</p>
      </div>
      <div class="feature">
        <span class="feature-icon">📡</span>
        <h3>Coverage Planning</h3>
        <p>RF analysis tools</p>
      </div>
      <div class="feature">
        <span class="feature-icon">🌐</span>
        <h3>Spectrum Management</h3>
        <p>Frequency planning</p>
      </div>
    </div>

    <footer class="login-footer">
      <a href="https://github.com/theorem6/WISP-Management" target="_blank" rel="noopener noreferrer">GitHub</a>
      <span class="sep">·</span>
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
    </footer>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #1e3a4f 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .login-container {
    max-width: 500px;
    width: 100%;
  }

  .login-brand {
    text-align: center;
    color: white;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .brand-logo {
    width: 120px;
    height: 120px;
    filter: drop-shadow(0 0 30px rgba(0, 217, 255, 0.6));
    animation: pulse-glow 3s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% {
      filter: drop-shadow(0 0 30px rgba(0, 217, 255, 0.6));
    }
    50% {
      filter: drop-shadow(0 0 50px rgba(0, 242, 254, 0.8));
    }
  }

  .login-brand h1 {
    font-size: 2rem;
    margin: 0;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 2px;
    font-weight: 700;
  }

  .brand-tagline {
    color: #00d9ff;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .poc-notice {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.85);
    margin: 0.5rem 0 0;
    max-width: 360px;
  }
  .poc-notice a {
    color: #00d9ff;
    text-decoration: underline;
  }
  .poc-notice a:hover {
    color: #00f2fe;
  }

  .login-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    text-align: center;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .login-footer a {
    color: #00d9ff;
    text-decoration: none;
  }
  .login-footer a:hover {
    text-decoration: underline;
  }
  .login-footer .sep {
    margin: 0 0.5rem;
  }

  .login-card {
    background: linear-gradient(135deg, #1e3a4f 0%, #1a2332 100%);
    border: 2px solid rgba(0, 217, 255, 0.3);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 217, 255, 0.2);
  }

  .login-card h2 {
    font-size: 1.75rem;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #a0d9e8;
    margin-bottom: 2rem;
    font-size: 0.95rem;
  }

  .error-message {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .error-icon {
    font-size: 1.125rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: #00d9ff;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(0, 217, 255, 0.3);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s;
    background-color: rgba(15, 20, 25, 0.5);
    color: #ffffff;
  }

  .form-group input:focus {
    outline: none;
    border-color: #00f2fe;
    box-shadow: 0 0 0 3px rgba(0, 242, 254, 0.2);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    color: #0f1419;
    border: 2px solid #00d9ff;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 217, 255, 0.5);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .form-footer {
    margin-top: 1.5rem;
    text-align: center;
  }

  .link-btn {
    background: none;
    border: none;
    color: #00d9ff;
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
    padding: 0;
  }

  .link-btn:hover {
    color: #00f2fe;
  }

  .login-divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 2rem 0 1.5rem;
    color: #6bb7ca;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .login-divider span {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.4), transparent);
  }

  .login-divider p {
    margin: 0;
    white-space: nowrap;
  }

  .btn-google {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border-radius: 0.6rem;
    background: #ffffff;
    color: #1a2332;
    font-weight: 600;
    font-size: 0.95rem;
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  }

  .btn-google svg {
    width: 20px;
    height: 20px;
  }

  .btn-google:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(0, 217, 255, 0.25);
  }

  .btn-google:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .domain-note {
    margin-top: 0.75rem;
    text-align: center;
    color: #8dcde0;
    font-size: 0.85rem;
  }

  .demo-notice {
    margin-top: 2rem;
    padding: 1rem;
    background-color: rgba(0, 217, 255, 0.1);
    border: 1px solid rgba(0, 217, 255, 0.2);
    border-radius: 0.5rem;
    font-size: 0.75rem;
    color: #a0d9e8;
  }

  .demo-notice p {
    margin-bottom: 0.25rem;
  }

  .demo-notice strong {
    color: #00f2fe;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 2rem;
  }

  .feature {
    background: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(0, 242, 254, 0.05) 100%);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 217, 255, 0.2);
    border-radius: 0.75rem;
    padding: 1.5rem 1rem;
    text-align: center;
    color: white;
    transition: all 0.3s ease;
  }

  .feature:hover {
    border-color: #00d9ff;
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.3);
    transform: translateY(-2px);
  }

  .feature-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .feature h3 {
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    color: #00f2fe;
    font-weight: 600;
  }

  .feature p {
    font-size: 0.75rem;
    color: #a0d9e8;
  }

  @media (max-width: 768px) {
    .login-page {
      padding: 1rem;
    }

    .login-card {
      padding: 2rem 1.5rem;
    }

    .features {
      grid-template-columns: 1fr;
    }

    .brand-logo {
      width: 100px;
      height: 100px;
    }

    .login-brand h1 {
      font-size: 1.5rem;
    }
  }
</style>

