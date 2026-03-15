<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { tenantService } from '$lib/services/tenantService';
  import { createPaymentMethod } from '$lib/services/billingService';

  let step = 1; // 1: Email Verification, 2: Payment Option, 3: Tenant Info, 4: Success
  let isLoading = false;
  let error = '';
  let success = '';

  // Step 1: Email Verification
  let email = '';
  let verificationCode = '';
  let verificationCodeSent = false;
  let canResendCode = false;
  let resendCountdown = 0;

  // Step 2: Tenant Information
  let tenantName = '';
  let displayName = '';
  let contactPhone = '';
  let subdomain = '';

  // Step 2: Payment Information
  let paymentMethodType: 'beta' | 'paypal' | 'credit_card' = 'beta'; // Default to Beta (Free)
  let paypalEmail = '';
  let creditCardInfo = {
    email: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: ''
  };
  let paymentMethodCreated = false;

  // Created tenant ID
  let createdTenantId: string = '';
  let isCreatingTenant = false; // Guard to prevent double creation

  onMount(async () => {
    if (!browser) return;
    
    console.log('[Signup Page] 🔄 Page mounted');
    console.log('[Signup Page] Current URL:', window.location.href);
    
    // Check for Google sign-in redirect result first
    try {
      const redirectResult = await authService.checkRedirectResult();
      if (redirectResult && redirectResult.success && redirectResult.data) {
        console.log('[Signup Page] Google redirect sign-in successful!');
        await handleGoogleSignInSuccess(redirectResult.data);
        return;
      }
    } catch (err: any) {
      console.warn('[Signup Page] No redirect result or error:', err);
    }
    
    // Check if user is already authenticated
    const currentUser = authService.getCurrentUser();
    console.log('[Signup Page] Auth check:', { hasUser: !!currentUser, email: currentUser?.email });
    
    if (currentUser) {
      // Check if user already has a tenant
      const userEmail = currentUser.email;
      if (userEmail) {
        email = userEmail;
        // Skip to payment step if user is already authenticated
        step = 2;
        paymentMethodType = 'beta';
        return;
      }
    }
    
    console.log('[Signup Page] ✅ Ready to show signup wizard, step:', step);
  });

  // Google Sign-In Functions
  async function handleGoogleSignIn() {
    isLoading = true;
    error = '';

    try {
      console.log('[Signup Page] Initiating Google sign in...');
      const result = await authService.signInWithGoogle('signup');

      if (result.success) {
        // Redirect will happen automatically
        console.log('[Signup Page] Redirecting to Google for sign-in...');
        return;
      } else {
        error = result.error || 'Google authentication failed';
        isLoading = false;
      }
    } catch (err: any) {
      error = err.message || 'Google authentication error';
      isLoading = false;
    }
  }

  async function handleGoogleSignInSuccess(userProfile: any) {
    isLoading = true;
    error = '';

    try {
      console.log('[Signup Page] Processing Google sign-in success...');
      
      // Wait for Firebase auth state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const finalUser = authService.getCurrentUser();
      if (!finalUser || !finalUser.email) {
        error = 'Failed to get user information from Google';
        isLoading = false;
        return;
      }

      // Set email from Google account
      email = finalUser.email;

      // Try to get user tenants - if they have any, redirect to dashboard
      try {
        const userTenants = await tenantService.getUserTenants();
        if (userTenants && userTenants.length > 0) {
          console.log('[Signup Page] User already has tenant, redirecting to dashboard');
          goto('/dashboard');
          return;
        }
      } catch (err: any) {
        // User doesn't have tenants yet, continue with signup
        console.log('[Signup Page] No existing tenants found, continuing with signup');
      }

      // Continue with signup flow - skip email verification
      step = 2; // Move to payment step
      paymentMethodType = 'beta';
      success = 'Google sign-in successful! Continue with account setup.';
      setTimeout(() => success = '', 3000);
      isLoading = false;
    } catch (err: any) {
      error = err.message || 'Error processing Google sign-in';
      isLoading = false;
    }
  }

  // Email Verification Functions
  async function sendVerificationCode() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const apiPath = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api'
        : '/api';
      
      const response = await fetch(`${apiPath}/auth/verification/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      verificationCodeSent = true;
      canResendCode = false;
      resendCountdown = 60; // 60 second countdown

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        resendCountdown--;
        if (resendCountdown <= 0) {
          canResendCode = true;
          clearInterval(countdownInterval);
        }
      }, 1000);

      success = 'Verification code sent to your email!';
      setTimeout(() => success = '', 5000);
    } catch (err: any) {
      error = err.message || 'Failed to send verification code';
    } finally {
      isLoading = false;
    }
  }

  async function verifyCode() {
    if (!verificationCode || verificationCode.length !== 6) {
      error = 'Please enter the 6-digit verification code';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const apiPath = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api'
        : '/api';
      
      const response = await fetch(`${apiPath}/auth/verification/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      // Code verified - create Firebase account and move to next step
      // For now, we'll create the account in step 2, so just move forward
      // Auto-select payment method (Beta Free) and proceed
      paymentMethodType = 'beta';
      step = 2; // Move to payment option step
      success = 'Email verified successfully!';
      setTimeout(() => success = '', 3000);
    } catch (err: any) {
      error = err.message || 'Verification failed';
    } finally {
      isLoading = false;
    }
  }

  // Tenant Setup Functions
  async function handleTenantSubmit() {
    // Prevent double submission
    if (isLoading || isCreatingTenant) {
      console.log('[Signup] Tenant creation already in progress, ignoring duplicate call');
      return;
    }

    if (!tenantName || !displayName || !contactPhone) {
      error = 'Please fill in all required fields';
      return;
    }

    // Prevent if tenant already created
    if (createdTenantId) {
      console.log('[Signup] Tenant already created, redirecting to success');
      step = 4;
      return;
    }

    // Validate and auto-generate subdomain if needed
    if (!subdomain) {
      subdomain = tenantName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    // Validate subdomain format (hyphen at end of character class to avoid range interpretation)
    if (!/^[a-z0-9-]+$/.test(subdomain) || subdomain.startsWith('-') || subdomain.endsWith('-')) {
      error = 'Subdomain can only contain lowercase letters, numbers, and hyphens (cannot start or end with hyphen)';
      return;
    }

    if (subdomain.length < 3) {
      error = 'Subdomain must be at least 3 characters long';
      return;
    }

    if (subdomain.length > 63) {
      error = 'Subdomain must be 63 characters or less';
      return;
    }

    isLoading = true;
    isCreatingTenant = true;
    error = '';

    let userCreated = false;
    let firebaseUser: any = null;

    try {
      // First, check if user is already authenticated or try to create account
      firebaseUser = authService.getCurrentUser();
      if (!firebaseUser) {
        // Create account with temporary password - user will set password later
        const tempPassword = `Temp${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        const signUpResult = await authService.signUp(email, tempPassword);
        
        if (!signUpResult.success || !signUpResult.data) {
          // Check if error is due to email already existing
          if (signUpResult.error && signUpResult.error.includes('already in use')) {
            throw new Error('This email address is already registered. Please <a href="/login" style="color: #00d9ff; text-decoration: underline;">sign in instead</a>. If you forgot your password, use the "Forgot password?" link on the login page.');
          }
          throw new Error(signUpResult.error || 'Failed to create account');
        }

        firebaseUser = authService.getCurrentUser();
        if (!firebaseUser) {
          throw new Error('Account created but user not found');
        }

        userCreated = true; // Track that we created this user

        // Send password reset email so user can set their own password
        const resetResult = await authService.resetPassword(email);
        if (!resetResult.success) {
          console.warn('Failed to send password reset email:', resetResult.error);
          // Continue anyway - user can reset password later
        }
      }

      // Create tenant
      // Note: createTenant expects individual parameters, not an object
      // The backend automatically creates the user-tenant association as owner
      const createResult = await tenantService.createTenant(
        tenantName,
        displayName,
        email,
        firebaseUser.uid,
        subdomain,
        true, // createOwnerAssociation
        email // ownerEmail
      );

      if (!createResult.success || !createResult.tenantId) {
        throw new Error(createResult.error || 'Failed to create tenant');
      }

      createdTenantId = createResult.tenantId;

      // Create payment method only if a paid option was selected (skip for beta/free)
      if (paymentMethodType && paymentMethodCreated && paymentMethodType !== 'beta') {
        try {
          await createPaymentMethod(
            createdTenantId,
            paymentMethodType,
            paymentMethodType === 'paypal' ? (paypalEmail || email) : undefined,
            paymentMethodType === 'credit_card' ? creditCardInfo : undefined
          );
        } catch (paymentErr: any) {
          console.warn('Payment method creation failed (continuing anyway):', paymentErr);
          // Continue anyway - payment can be added later
        }
      }

      success = 'Tenant created successfully!';
      step = 4; // Move to success step
      
      // Redirect to login after a short delay
      setTimeout(() => {
        goto('/login?signup=success');
      }, 2000);
    } catch (err: any) {
      // If we created a Firebase user but tenant creation failed, delete the user
      if (userCreated && firebaseUser) {
        console.log('Tenant creation failed, cleaning up Firebase user...');
        try {
          await authService.deleteCurrentUser();
          console.log('Firebase user deleted successfully');
        } catch (deleteError: any) {
          console.error('Failed to delete Firebase user:', deleteError);
          // Continue with error handling
        }
      }

      // Handle email already exists error specially
      if (err.message && err.message.includes('already in use')) {
        error = 'This email address is already registered. Please sign in to your existing account instead.';
        // Show error for 5 seconds, then suggest going to login
        setTimeout(() => {
          if (error.includes('already registered')) {
            error = 'Redirecting to login page...';
            setTimeout(() => {
              goto('/login');
            }, 1000);
          }
        }, 5000);
      } else {
        error = err.message || 'Failed to create tenant';
      }
      console.error('Tenant creation error:', err);
    } finally {
      isLoading = false;
      isCreatingTenant = false;
    }
  }

  // Payment Functions - Simplified, just select and proceed without actual payment
  async function handlePaymentSubmit() {
    // Payment method is selected, proceed to tenant creation
    // For beta/free, no payment method will be created
    // For paid options, payment method will be created after tenant creation
    paymentMethodCreated = paymentMethodType !== 'beta';
    step = 3; // Move to tenant creation step
  }

</script>

<div class="signup-wizard">
  <div class="wizard-container">
    <div class="wizard-header">
      <h1>Create Your Account</h1>
      <p class="subtitle">Get started with WISP Management in just a few steps</p>
    </div>

    <div class="progress-bar">
      <div class="progress" style="width: {step * 25}%"></div>
    </div>

    <div class="wizard-content">
      {#if error}
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          {error}
        </div>
      {/if}

      {#if success}
        <div class="success-message">
          <span class="success-icon">✅</span>
          {success}
        </div>
      {/if}

      <!-- Step 1: Email Verification -->
      {#if step === 1}
        <div class="step-content">
          <h2>Step 1: Verify Your Email</h2>
          <p class="step-description">We'll send a verification code to your email address to ensure it's valid.</p>

          <div class="form-group">
            <label for="email">Email Address <span class="required">*</span></label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="your@email.com"
              disabled={isLoading || verificationCodeSent}
              required
            />
          </div>

          {#if !verificationCodeSent}
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <button 
                type="button" 
                class="btn-primary" 
                onclick={sendVerificationCode}
                disabled={isLoading || !email}
              >
                {#if isLoading}
                  <span class="spinner"></span>
                  Sending...
                {:else}
                  Send Verification Code
                {/if}
              </button>

              <div style="display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0;">
                <div style="flex: 1; height: 1px; background: var(--border-color, #d1d5db);"></div>
                <span style="color: var(--text-secondary, #6b7280); font-size: 0.875rem;">OR</span>
                <div style="flex: 1; height: 1px; background: var(--border-color, #d1d5db);"></div>
              </div>

              <button 
                type="button" 
                class="btn-google" 
                onclick={handleGoogleSignIn}
                disabled={isLoading}
                style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 0.9rem 1rem; border-radius: 0.6rem; background: #ffffff; color: #1a2332; font-weight: 600; font-size: 0.95rem; border: none; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);"
              >
                <svg aria-hidden="true" viewBox="0 0 533.5 544.3" style="width: 20px; height: 20px;">
                  <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.4-34.1-4.1-50.2H272v95h147.5c-6.4 34-25 62.8-53.4 82v68h86.1c50.4-46.5 80.3-115.1 80.3-194.8z"/>
                  <path fill="#34a853" d="M272 544.3c72.2 0 132.8-23.9 177-64.7l-86.1-68c-23.9 16.1-54.5 25.7-90.9 25.7-69.9 0-129.2-47.2-150.4-110.5h-90.7v69.8c44 87.4 134.5 148.7 241.1 148.7z"/>
                  <path fill="#fbbc04" d="M121.6 326.8c-10.2-30-10.2-62.5 0-92.5v-69.8h-90.7c-37.3 74.6-37.3 158.4 0 233z"/>
                  <path fill="#ea4335" d="M272 107.7c39.2-.6 76.4 13.8 105 39.9l78.2-78.2C404.5 25.5 344 0 272 0 165.4 0 74.9 61.3 30.9 148.7l90.7 69.8C142.7 175 202.1 107.7 272 107.7z"/>
                </svg>
                <span>Sign up with Google</span>
              </button>
            </div>
          {:else}
            <div class="verification-sent">
              <p class="success-text">✅ Verification code sent to {email}</p>
              {#if !canResendCode}
                <p class="resend-countdown">You can resend in {resendCountdown} seconds</p>
              {/if}
            </div>

            <div class="form-group">
              <label for="verificationCode">Verification Code <span class="required">*</span></label>
              <input
                id="verificationCode"
                type="text"
                bind:value={verificationCode}
                placeholder="Enter 6-digit code"
                maxlength="6"
                disabled={isLoading}
                required
              />
              <p class="help-text">Check your email for the 6-digit verification code</p>
            </div>

            <div class="form-actions">
              {#if canResendCode}
                <button 
                  type="button" 
                  class="btn-secondary" 
                  onclick={sendVerificationCode}
                  disabled={isLoading}
                >
                  Resend Code
                </button>
              {/if}
              <button 
                type="button" 
                class="btn-primary" 
                onclick={verifyCode}
                disabled={isLoading || !verificationCode}
              >
                {#if isLoading}
                  <span class="spinner"></span>
                  Verifying...
                {:else}
                  Verify Email
                {/if}
              </button>
            </div>
          {/if}
        </div>

      <!-- Step 2: Tenant Information -->
      {:else if step === 2}
        <div class="step-content">
          <h2>Step 2: Payment Option</h2>
          <p class="step-description">Select your preferred payment method. No charges will be made at this time.</p>

          <div class="beta-disclaimer">
            <div class="beta-badge">BETA</div>
            <p><strong>WISPTools.io is currently in beta.</strong> Start with our free beta option - no payment required. You can upgrade to a paid plan later from your account settings.</p>
          </div>

          <div class="form-group">
            <label>Payment Option <span class="required">*</span></label>
            <div class="payment-method-options">
              <label class="payment-option">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="beta"
                  bind:group={paymentMethodType}
                  checked
                  disabled={isLoading}
                />
                <div class="payment-option-content">
                  <div class="payment-icon">🎉</div>
                  <div>
                    <strong>Beta (Free)</strong>
                    <p>Free access during beta period - No payment required</p>
                  </div>
                </div>
              </label>
              <label class="payment-option">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="paypal"
                  bind:group={paymentMethodType}
                  disabled={isLoading}
                />
                <div class="payment-option-content">
                  <div class="payment-icon">💳</div>
                  <div>
                    <strong>PayPal</strong>
                    <p>Pay with PayPal account (set up now, charges begin after beta)</p>
                  </div>
                </div>
              </label>
              <label class="payment-option">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="credit_card"
                  bind:group={paymentMethodType}
                  disabled={isLoading}
                />
                <div class="payment-option-content">
                  <div class="payment-icon">💳</div>
                  <div>
                    <strong>Credit Card</strong>
                    <p>Pay with credit or debit card (set up now, charges begin after beta)</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div class="form-actions">
            <button 
              type="button" 
              class="btn-secondary" 
              onclick={() => step = 1}
              disabled={isLoading}
            >
              ← Back
            </button>
            <button 
              type="button" 
              class="btn-primary" 
              onclick={handlePaymentSubmit}
              disabled={isLoading || !paymentMethodType}
            >
              Continue →
            </button>
          </div>
        </div>

      {:else if step === 3}
        <div class="step-content">
          <h2>Step 3: Organization Information</h2>
          <p class="step-description">Tell us about your organization.</p>

          <div class="form-group">
            <label for="tenantName">Organization Name <span class="required">*</span></label>
            <input
              id="tenantName"
              type="text"
              bind:value={tenantName}
              placeholder="Acme WISP"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-group">
            <label for="displayName">Display Name <span class="required">*</span></label>
            <input
              id="displayName"
              type="text"
              bind:value={displayName}
              placeholder="Acme Wireless Internet"
              disabled={isLoading}
              required
            />
            <p class="help-text">This is how your organization will appear in the system</p>
          </div>

          <div class="form-group">
            <label for="contactPhone">Contact Phone <span class="required">*</span></label>
            <input
              id="contactPhone"
              type="tel"
              bind:value={contactPhone}
              placeholder="+1 (555) 123-4567"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-group">
            <label for="subdomain">Subdomain <span class="required">*</span></label>
            <input
              id="subdomain"
              type="text"
              bind:value={subdomain}
              placeholder="acme-wisp"
              disabled={isLoading}
              minlength="3"
              maxlength="63"
              required
            />
            <p class="help-text">Unique subdomain for your organization (lowercase letters, numbers, and hyphens only). Will be auto-generated from tenant name if left blank.</p>
          </div>

          <div class="form-group">
            <label>Primary Location (Optional)</label>
            <p class="help-text">You can create your primary location (NOC/HQ/Tower) after completing setup from the coverage map.</p>
          </div>

          <div class="form-actions">
            <button 
              type="button" 
              class="btn-secondary" 
              onclick={() => step = 1}
              disabled={isLoading}
            >
              ← Back
            </button>
            <button 
              type="button" 
              class="btn-primary" 
              onclick={handleTenantSubmit}
              disabled={isLoading}
            >
              {#if isLoading}
                <span class="spinner"></span>
                Creating...
              {:else}
                Finish
              {/if}
            </button>
          </div>
        </div>

      <!-- Step 3: Payment Information -->
      <!-- Step 4: Success -->
      {:else if step === 4}
        <div class="step-content success-step">
          <div class="success-icon-large">✅</div>
          <h2>Account Created Successfully!</h2>
          <p class="success-message">
            Your WISP Management account has been created. You can now start using the platform.
          </p>
          <div class="success-details">
            <p><strong>Organization:</strong> {displayName}</p>
            <p><strong>Email:</strong> {email}</p>
            {#if paymentMethodType === 'beta'}
              <p><strong>Payment Option:</strong> Beta (Free) - No payment required ✓</p>
            {:else if paymentMethodCreated}
              <p><strong>Payment Method:</strong> {paymentMethodType === 'paypal' ? 'PayPal' : 'Credit Card'} ✓</p>
            {/if}
          </div>
          <button 
            type="button" 
            class="btn-primary" 
            onclick={() => goto('/login?signup=success')}
          >
            Go to Login →
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>


<style>
  .signup-wizard {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, #f3f4f6);
    padding: 2rem;
  }

  .wizard-container {
    background: var(--card-bg, white);
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    width: 100%;
    padding: 2rem;
  }

  .wizard-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .wizard-header h1 {
    color: var(--text-primary, #1f2937);
    margin: 0 0 0.5rem;
    font-size: 2rem;
  }

  .subtitle {
    color: var(--text-secondary, #6b7280);
    margin: 0;
  }

  .progress-bar {
    height: 4px;
    background: var(--bg-secondary, #e5e7eb);
    border-radius: 2px;
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: var(--primary-color, #8b5cf6);
    transition: width 0.3s ease;
  }

  .step-content {
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .step-content h2 {
    color: var(--text-primary, #1f2937);
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
  }

  .step-description {
    color: var(--text-secondary, #6b7280);
    margin: 0 0 2rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    color: var(--text-primary, #1f2937);
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .required {
    color: var(--danger-color, #ef4444);
  }

  .form-group input[type="text"],
  .form-group input[type="email"],
  .form-group input[type="tel"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color, #8b5cf6);
  }

  .help-text {
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
    margin: 0.25rem 0 0;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--primary-color, #8b5cf6);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark, #7c3aed);
  }

  .btn-secondary {
    background: var(--bg-secondary, #e5e7eb);
    color: var(--text-primary, #1f2937);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--hover-bg, #d1d5db);
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .error-message,
  .success-message {
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-message {
    background: var(--danger-light, #fee2e2);
    color: var(--danger-dark, #991b1b);
  }

  .success-message {
    background: var(--success-light, #d1fae5);
    color: var(--success-dark, #065f46);
  }

  .verification-sent {
    background: var(--success-light, #d1fae5);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .success-text {
    color: var(--success-dark, #065f46);
    margin: 0 0 0.5rem;
  }

  .resend-countdown {
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
    margin: 0;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .payment-method-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .payment-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 2px solid var(--border-color, #d1d5db);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .payment-option:hover {
    border-color: var(--primary-color, #8b5cf6);
    background: var(--hover-bg, #f9fafb);
  }

  .payment-option input[type="radio"]:checked + .payment-option-content {
    color: var(--primary-color, #8b5cf6);
  }

  .payment-option-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .payment-icon {
    font-size: 1.5rem;
  }

  .beta-disclaimer {
    background: var(--warning-light, #fef3c7);
    border: 1px solid var(--warning-color, #f59e0b);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .beta-badge {
    display: inline-block;
    background: var(--warning-color, #f59e0b);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .beta-disclaimer p {
    margin: 0;
    color: var(--warning-dark, #92400e);
    font-size: 0.875rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .success-step {
    text-align: center;
  }

  .success-icon-large {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .success-details {
    background: var(--bg-secondary, #f3f4f6);
    padding: 1.5rem;
    border-radius: 8px;
    margin: 2rem 0;
    text-align: left;
  }

  .success-details p {
    margin: 0.5rem 0;
    color: var(--text-primary, #1f2937);
  }
</style>
