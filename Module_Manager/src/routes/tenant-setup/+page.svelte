<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { tenantService } from '$lib/services/tenantService';
  import { authService } from '$lib/services/authService';
  import { tenantStore, currentTenant } from '$lib/stores/tenantStore';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { coverageMapService } from '../modules/coverage-map/lib/coverageMapService.mongodb';
  import SiteEditModal from '../modules/coverage-map/components/SiteEditModal.svelte';
  import type { TowerSite } from '../modules/coverage-map/lib/models';
  import { getConfiguredSingleTenantId, isSingleTenantMode } from '$lib/config/tenantMode';

  let isLoading = false;
  let error = '';
  let success = '';
  let step = 1; // 1: Organization Details, 2: Payment Method, 3: Primary Location, 4: Success

  // Tenant details
  let tenantName = '';
  let displayName = '';
  let contactEmail = '';
  let contactPhone = '';
  let subdomain = '';
  let currentUser: any = null;
  
  // Primary location
  let primaryLocationOption: 'create' | 'skip' = 'create';
  let showSiteModal = false;
  let createdSite: TowerSite | null = null;
  let selectedSiteId: string = '';
  let availableSites: TowerSite[] = [];

  onMount(async () => {
    if (!browser) return;

    console.log('[Tenant Setup] Page loaded');

    // Check if user is authenticated
    currentUser = authService.getCurrentUser();
    if (!currentUser) {
      console.log('[Tenant Setup] User not authenticated, redirecting to login');
      await goto('/login');
      return;
    }

    if (isSingleTenantMode() && getConfiguredSingleTenantId()) {
      console.log('[Tenant Setup] Single-tenant deployment: org creation is disabled');
      await goto('/dashboard', { replaceState: true });
      return;
    }

    // Allow first-time users to create their own tenant
    // Check if user has any tenants - if not, allow creation
    try {
      const existingTenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
      console.log('[Tenant Setup] User has', existingTenants.length, 'existing tenants');
      
      const userIsPlatformAdmin = isPlatformAdmin(currentUser.email || null);
      
      // Only allow if:
      // - First-time user with no tenants (allowed to create their first tenant)
      // - Platform admin with no tenants (initial bootstrap)
      if (existingTenants.length > 0) {
        console.log('[Tenant Setup] ACCESS DENIED - User already has at least one tenant');
        error = 'You already have an organization. Tenant setup is only for first-time users.';
        await goto('/tenant-selector', { replaceState: true });
        return;
      }
      
      console.log('[Tenant Setup] Access granted -', userIsPlatformAdmin ? 'platform admin (no tenants yet)' : 'first-time user (no tenants)');
    } catch (err: any) {
      console.error('[Tenant Setup] Error checking existing tenants:', err);
      // 503 / service misconfiguration - don't show create form; user may already have tenants we couldn't load
      if (err?.status === 503 || err.message?.includes('INTERNAL_API_KEY') || err.message?.includes('Service Unavailable')) {
        error = 'We couldn\'t load your organizations (service configuration issue). Please try again later or contact support.';
        isLoading = false;
        return;
      }
      // For other errors (e.g. 401), allow first-time setup; backend will handle authorization when creating
      console.log('[Tenant Setup] Allowing tenant creation despite check error');
    }

    console.log('[Tenant Setup] Platform admin access confirmed');
    contactEmail = currentUser.email || '';
    
    // Initialize credit card email with user email
    if (currentUser.email) {
      creditCardInfo.email = currentUser.email;
    }
  });

  // Payment method state
  let paymentMethodType: 'paypal' | 'credit_card' | null = null;
  let paypalEmail = '';
  let creditCardInfo = {
    email: currentUser?.email || '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: ''
  };
  let paymentMethodCreated = false;

  async function handlePaymentMethodSubmit() {
    if (isLoading) return;
    
    error = '';
    isLoading = true;

    try {
      const tenantId = tenantStore.getCurrentTenant()?.id;
      if (!tenantId) {
        error = 'Tenant not found. Please go back and complete organization setup.';
        isLoading = false;
        return;
      }

      if (!paymentMethodType) {
        error = 'Please select a payment method';
        isLoading = false;
        return;
      }

      if (paymentMethodType === 'paypal' && !paypalEmail.trim()) {
        error = 'Please enter your PayPal email address';
        isLoading = false;
        return;
      }

      if (paymentMethodType === 'credit_card') {
        // Basic validation (in production, use proper card validation)
        if (!creditCardInfo.cardNumber.trim() || !creditCardInfo.expiryDate.trim() || !creditCardInfo.cvv.trim()) {
          error = 'Please enter all credit card information';
          isLoading = false;
          return;
        }
      }

      // Get auth token
      const token = await authService.getAuthTokenForApi();
      
      // Create payment method
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId,
          type: paymentMethodType,
          paypalEmail: paymentMethodType === 'paypal' ? paypalEmail.trim() : undefined,
          creditCard: paymentMethodType === 'credit_card' ? {
            email: creditCardInfo.email,
            // In production, don't send full card details - use a payment processor
            // For now, we'll just store the email and indicate card was provided
            cardProvided: true
          } : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save payment method');
      }

      paymentMethodCreated = true;
      
      // Move to step 3 for primary location setup
      step = 3;
      
    } catch (err: any) {
      error = err.message || 'Failed to save payment method';
      console.error('Error saving payment method:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleSkipPayment() {
    // Allow skipping payment for now (beta), but warn user
    if (confirm('⚠️ Warning: You are skipping payment method setup. You may need to add a payment method later to continue using the service. Continue anyway?')) {
      step = 3; // Skip to primary location
    }
  }
  
  async function loadSites() {
    // This will only work after tenant is created, so we'll handle it in step 2
    try {
      if (currentUser?.uid) {
        // For now, sites will be empty until tenant is created
        availableSites = [];
      }
    } catch (err) {
      console.error('Error loading sites:', err);
      availableSites = [];
    }
  }
  
  async function handleSiteCreated(event: CustomEvent) {
    const { siteId } = event.detail;
    if (siteId) {
      // Fetch the created site
      try {
        const tenantId = tenantStore.getCurrentTenant()?.id;
        if (tenantId) {
          const site = await coverageMapService.getTowerSite(tenantId, siteId);
          if (site) {
            createdSite = site;
            selectedSiteId = siteId;
            showSiteModal = false;
          }
        }
      } catch (err) {
        console.error('Error fetching created site:', err);
      }
    }
  }
  
  async function handleCompleteSetup() {
    if (isLoading) return;
    
    isLoading = true;
    error = '';
    
    try {
      const tenantId = tenantStore.getCurrentTenant()?.id;
      if (!tenantId) {
        error = 'Tenant not found';
        isLoading = false;
        return;
      }
      
      // Update tenant with primary location if created
      if (primaryLocationOption === 'create' && createdSite) {
        // Update tenant with primary location
        // This will be done via a PUT request to update tenant
        const response = await fetch(`/api/tenants/${tenantId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${await authService.getAuthTokenForApi()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            primaryLocation: {
              siteId: createdSite.id,
              siteName: createdSite.name
            }
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update tenant with primary location');
        }
      }
      
      // Move to success step
      step = 4;
      
      // Redirect after a moment
      setTimeout(() => {
        goto('/dashboard', { replaceState: true });
      }, 2000);
    } catch (err: any) {
      error = err.message || 'Failed to complete setup';
    } finally {
      isLoading = false;
    }
  }

  function generateSubdomain() {
    if (tenantName) {
      subdomain = tenantName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }
  }

  async function handleSubmit() {
    error = '';
    success = '';
    isLoading = true;

    // Validation
    if (!tenantName || !displayName || !contactEmail) {
      error = 'Please fill in all required fields';
      isLoading = false;
      return;
    }

    if (!subdomain) {
      generateSubdomain();
    }

    try {
      // Check if this is platform admin or first-time user
      const userIsPlatformAdmin = isPlatformAdmin(currentUser.email || null);
      
      // Platform admin creating tenant should NOT be added as owner
      // First-time users creating their own tenant SHOULD be added as owner
      const result = await tenantService.createTenant(
        tenantName,
        displayName,
        contactEmail,
        currentUser.uid,
        subdomain,
        !userIsPlatformAdmin,  // Create owner association for first-time users, not for platform admin
        userIsPlatformAdmin ? undefined : currentUser.email  // Owner email for first-time users
      );

      if (result.success && result.tenantId) {
        success = 'Tenant created successfully!';
        
        console.log('[Tenant Setup] Tenant created successfully:', result.tenantId);
        
        // Load the newly created tenant
        const { tenant: newTenant } = await tenantService.getTenant(result.tenantId);
        if (newTenant) {
          // IMPORTANT: Set tenant in store - this handles all localStorage updates
          tenantStore.setCurrentTenant(newTenant);
          console.log('[Tenant Setup] Tenant set in store:', newTenant.displayName);
        }
        
        // Move to step 2 for payment method setup
        step = 2;
      } else {
        error = result.error || 'Failed to create tenant';
      }
    } catch (err: any) {
      error = err.message || 'An error occurred';
    }

    isLoading = false;
  }

  $: if (tenantName) {
    generateSubdomain();
  }
</script>

<div class="tenant-setup-page">
  <div class="setup-container">
    <div class="setup-header">
      <div>
        <h1>🏢 Set Up Your Organization</h1>
        <p>Create a tenant to manage your devices and networks</p>
      </div>
      <button type="button" class="exit-button" onclick={() => goto('/dashboard', { replaceState: true })}>
        Exit setup
      </button>
    </div>

    {#if step === 1}
      <div class="setup-card">
        <div class="progress-bar">
          <div class="progress" style="width: 50%"></div>
        </div>

        <h2>Organization Details</h2>
        <p class="subtitle">Tell us about your organization</p>

        <div class="info-message">
          <span class="info-icon">ℹ️</span>
          <strong>Note:</strong> Each account can create one organization. You'll be the owner and can invite additional users.
        </div>

        {#if error}
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {error}
          </div>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="form-group">
            <label for="tenantName">
              Organization Name <span class="required">*</span>
            </label>
            <input
              id="tenantName"
              type="text"
              bind:value={tenantName}
              placeholder="e.g., Acme Wireless"
              disabled={isLoading}
              required
            />
            <p class="help-text">Legal or business name of your organization</p>
          </div>

          <div class="form-group">
            <label for="displayName">
              Display Name <span class="required">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              bind:value={displayName}
              placeholder="e.g., Acme Wireless ISP"
              disabled={isLoading}
              required
            />
            <p class="help-text">Name shown in the application</p>
          </div>

          <div class="form-group">
            <label for="subdomain">
              Subdomain <span class="required">*</span>
            </label>
            <div class="subdomain-input">
              <input
                id="subdomain"
                type="text"
                bind:value={subdomain}
                placeholder="acme-wireless"
                disabled={isLoading}
                required
                pattern="[a-z0-9\-]+"
              />
              <span class="subdomain-suffix">.your-domain.com</span>
            </div>
            <p class="help-text">Unique URL for device connections: /cwmp/{subdomain}</p>
          </div>

          <div class="form-group">
            <label for="contactEmail">
              Contact Email <span class="required">*</span>
            </label>
            <input
              id="contactEmail"
              type="email"
              bind:value={contactEmail}
              placeholder="admin@acme-wireless.com"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-group">
            <label for="contactPhone">
              Contact Phone
            </label>
            <input
              id="contactPhone"
              type="tel"
              bind:value={contactPhone}
              placeholder="+1 (555) 123-4567"
              disabled={isLoading}
            />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
                Creating...
              {:else}
                Create Tenant
              {/if}
            </button>
          </div>
        </form>
      </div>
    {:else if step === 2}
      <div class="setup-card">
        <div class="progress-bar">
          <div class="progress" style="width: 66%"></div>
        </div>

        <h2>Payment Method Setup</h2>
        <p class="subtitle">Add a payment method for your account (required)</p>

        <div class="beta-disclaimer">
          <div class="beta-badge">BETA</div>
          <p><strong>wisptools.io (WISP Management) is currently in beta.</strong> No charges will be made without prior notice. Adding a payment method now ensures uninterrupted service when billing begins.</p>
        </div>

        {#if error}
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {error}
          </div>
        {/if}

        <div class="form-group">
          <label>Payment Method <span class="required">*</span></label>
          <div class="payment-method-options">
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
                  <p>Pay with PayPal account</p>
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
                  <p>Pay with credit or debit card</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {#if paymentMethodType === 'paypal'}
          <div class="form-group">
            <label for="paypalEmail">
              PayPal Email Address <span class="required">*</span>
            </label>
            <input
              id="paypalEmail"
              type="email"
              bind:value={paypalEmail}
              placeholder="your-email@example.com"
              disabled={isLoading}
              required
            />
            <p class="help-text">The email address associated with your PayPal account</p>
          </div>
        {/if}

        {#if paymentMethodType === 'credit_card'}
          <div class="form-group">
            <label for="cardEmail">
              Billing Email <span class="required">*</span>
            </label>
            <input
              id="cardEmail"
              type="email"
              bind:value={creditCardInfo.email}
              placeholder="billing@example.com"
              disabled={isLoading}
              required
            />
          </div>
          <div class="form-group">
            <label for="cardNumber">
              Card Number <span class="required">*</span>
            </label>
            <input
              id="cardNumber"
              type="text"
              bind:value={creditCardInfo.cardNumber}
              placeholder="1234 5678 9012 3456"
              disabled={isLoading}
              maxlength="19"
              oninput={(e) => {
                // Format card number with spaces
                const target = e.currentTarget as HTMLInputElement;
                let value = target.value.replace(/\s/g, '');
                if (value.length > 16) value = value.substring(0, 16);
                value = value.replace(/(.{4})/g, '$1 ').trim();
                creditCardInfo.cardNumber = value;
              }}
              required
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="expiryDate">
                Expiry Date (MM/YY) <span class="required">*</span>
              </label>
              <input
                id="expiryDate"
                type="text"
                bind:value={creditCardInfo.expiryDate}
                placeholder="12/25"
                disabled={isLoading}
                maxlength="5"
                oninput={(e) => {
                  const target = e.currentTarget as HTMLInputElement;
                  let value = target.value.replace(/\D/g, '');
                  if (value.length >= 2) {
                    value = value.substring(0, 2) + '/' + value.substring(2, 4);
                  }
                  creditCardInfo.expiryDate = value;
                }}
                required
              />
            </div>
            <div class="form-group">
              <label for="cvv">
                CVV <span class="required">*</span>
              </label>
              <input
                id="cvv"
                type="text"
                bind:value={creditCardInfo.cvv}
                placeholder="123"
                disabled={isLoading}
                maxlength="4"
                pattern="\d{3,4}"
                required
              />
            </div>
          </div>
          <div class="form-group">
            <label for="cardName">
              Cardholder Name <span class="required">*</span>
            </label>
            <input
              id="cardName"
              type="text"
              bind:value={creditCardInfo.name}
              placeholder="John Doe"
              disabled={isLoading}
              required
            />
          </div>
        {/if}

        <div class="form-actions">
          <button 
            type="button" 
            class="btn-secondary" 
            onclick={handleSkipPayment}
            disabled={isLoading}
          >
            Skip for Now
          </button>
          <button 
            type="button" 
            class="btn-primary" 
            onclick={handlePaymentMethodSubmit}
            disabled={isLoading || !paymentMethodType}
          >
            {#if isLoading}
              <span class="spinner"></span>
              Saving...
            {:else}
              Continue
            {/if}
          </button>
        </div>
      </div>
    {:else if step === 3}
      <div class="setup-card">
        <div class="progress-bar">
          <div class="progress" style="width: 100%"></div>
        </div>

        <h2>Primary Location Setup</h2>
        <p class="subtitle">Set up your primary NOC/HQ/Tower location for inventory management</p>

        <div class="info-message">
          <span class="info-icon">ℹ️</span>
          <strong>Note:</strong> Hardware scanned in will automatically be assigned to this location. You can change this later in settings.
        </div>

        {#if error}
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            {error}
          </div>
        {/if}

        <div class="form-group">
          <label>Primary Location</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" bind:group={primaryLocationOption} value="create" />
              <span>Create New Location</span>
            </label>
            <label class="radio-option">
              <input type="radio" bind:group={primaryLocationOption} value="skip" />
              <span>Skip for Now</span>
            </label>
          </div>
        </div>

        {#if primaryLocationOption === 'create'}
          <div class="form-group">
            <button 
              type="button" 
              class="btn-secondary" 
              onclick={() => showSiteModal = true}
              disabled={isLoading}
            >
              ➕ Create Primary Location
            </button>
            {#if createdSite}
              <p class="success-text">✅ Created: {createdSite.name}</p>
            {/if}
          </div>
        {/if}

        <div class="form-actions">
          <button 
            type="button" 
            class="btn-secondary" 
            onclick={async () => {
              // Skip location setup and go to dashboard
              await goto('/dashboard', { replaceState: true });
            }}
            disabled={isLoading}
          >
            Skip
          </button>
          <button 
            type="button" 
            class="btn-primary" 
            onclick={async () => {
              await handleCompleteSetup();
            }}
            disabled={isLoading || (primaryLocationOption === 'create' && !createdSite)}
          >
            {#if isLoading}
              <span class="spinner"></span>
              Saving...
            {:else}
              Complete Setup
            {/if}
          </button>
        </div>
      </div>
    {:else if step === 4}
      <div class="setup-card success-card">
        <div class="success-icon">✅</div>
        <h2>Setup Complete!</h2>
        <p>Your organization is ready to go.</p>
        
        <div class="success-details">
          <div class="detail-item">
            <strong>Organization:</strong> {displayName}
          </div>
          {#if createdSite}
            <div class="detail-item">
              <strong>Primary Location:</strong> {createdSite.name}
            </div>
          {/if}
          <div class="detail-item">
            <strong>Your Role:</strong> Owner (Full Access)
          </div>
        </div>

        <p class="redirect-message">Redirecting to dashboard...</p>
      </div>
    {/if}
  </div>
  
  <!-- Site Creation Modal -->
  {#if showSiteModal}
    {@const tenantId = tenantStore.getCurrentTenant()?.id}
    {#if tenantId}
      <SiteEditModal
        show={showSiteModal}
        site={null}
        {tenantId}
        on:close={() => showSiteModal = false}
        on:saved={handleSiteCreated}
      />
    {/if}
  {/if}
</div>

<style>
  .tenant-setup-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .setup-container {
    max-width: 600px;
    width: 100%;
  }

  .setup-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    color: white;
    margin-bottom: 2rem;
  }

  .setup-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .setup-header p {
    opacity: 0.9;
  }

  .exit-button {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .exit-button:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .setup-card {
    background: var(--card-bg);
    border-radius: 1rem;
    padding: 2.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background-color: rgba(124, 58, 237, 0.2);
    border-radius: 2px;
    margin-bottom: 2rem;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: linear-gradient(90deg, var(--brand-primary), var(--brand-secondary));
    transition: width 0.3s ease;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 2rem;
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

  .info-message {
    background-color: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #3b82f6;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .info-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .required {
    color: #ef4444;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s;
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .subdomain-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .subdomain-input input {
    flex: 1;
  }

  .subdomain-suffix {
    color: var(--text-secondary);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .help-text {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .form-actions {
    margin-top: 2rem;
  }

  .btn-primary {
    width: 100%;
    padding: 0.875rem;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
    color: white;
    border: none;
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
    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
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

  .success-card {
    text-align: center;
  }

  .success-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .success-details {
    background-color: rgba(124, 58, 237, 0.1);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin: 1.5rem 0;
    text-align: left;
  }

  .detail-item {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item strong {
    color: var(--text-primary);
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  code {
    background-color: var(--bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--brand-primary);
  }

  .redirect-message {
    margin-top: 1.5rem;
    color: var(--text-secondary);
    font-style: italic;
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
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .radio-option:hover {
    border-color: var(--brand-primary);
    background-color: rgba(37, 99, 235, 0.05);
  }
  
  .radio-option input[type="radio"] {
    margin: 0;
    accent-color: var(--brand-primary);
  }
  
  .btn-secondary {
    padding: 0.875rem 1.5rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
    border-color: var(--brand-primary);
  }
  
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .success-text {
    margin-top: 0.5rem;
    color: #10b981;
    font-size: 0.875rem;
  }
  
  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .beta-disclaimer {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);
    border: 2px solid rgba(251, 191, 36, 0.3);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin: 1.5rem 0;
    text-align: center;
  }

  .beta-badge {
    display: inline-block;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #1f2937;
    font-weight: 700;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .beta-disclaimer p {
    margin: 0;
    color: var(--text-primary);
    font-size: 0.9375rem;
    line-height: 1.6;
  }

  .beta-disclaimer strong {
    color: #f59e0b;
    font-weight: 600;
  }

  .payment-method-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .payment-option {
    display: block;
    border: 2px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--card-bg);
  }

  .payment-option:hover {
    border-color: var(--brand-primary);
    background: rgba(37, 99, 235, 0.05);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .payment-option input[type="radio"] {
    display: none;
  }

  .payment-option input[type="radio"]:checked + .payment-option-content {
    color: var(--brand-primary);
  }

  .payment-option:has(input[type="radio"]:checked) {
    border-color: var(--brand-primary);
    background: rgba(37, 99, 235, 0.1);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .payment-option-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .payment-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .payment-option-content strong {
    display: block;
    font-size: 1.125rem;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }

  .payment-option-content p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .tenant-setup-page {
      padding: 1rem;
    }

    .setup-card {
      padding: 2rem 1.5rem;
    }
  }
</style>

