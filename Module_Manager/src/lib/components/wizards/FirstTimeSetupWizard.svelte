<script lang="ts">
  /**
   * First-Time Setup Wizard
   * 
   * Comprehensive onboarding wizard for new WISP operators.
   * Guides users through initial configuration after tenant creation.
   */
  
  import { createEventDispatcher, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import OrganizationSetupWizard from './OrganizationSetupWizard.svelte';
  import InitialConfigurationWizard from './InitialConfigurationWizard.svelte';

  export let show = false;
  export let autoStart = false; // If true, starts wizard automatically on mount

  const dispatch = createEventDispatcher();

  let showOrgWizard = false;
  let showConfigWizard = false;
  let currentStep = 0;
  let completedSteps: Set<number> = new Set();
  let isLoading = false;
  let error = '';
  
  // Wizard steps
  const steps = [
    { id: 'welcome', title: 'Welcome', icon: '👋' },
    { id: 'organization', title: 'Organization Setup', icon: '🏢' },
    { id: 'tower', title: 'Add First Tower', icon: '🗼' },
    { id: 'modules', title: 'Configure Modules', icon: '⚙️' },
    { id: 'complete', title: 'Complete!', icon: '✅' }
  ];
  
  // Setup tracking
  let setupProgress = {
    organizationCreated: false,
    towerAdded: false,
    cbrsConfigured: false,
    acsConfigured: false,
    monitoringConfigured: false,
    customerAdded: false
  };
  
  onMount(async () => {
    if (autoStart && show) {
      await checkSetupProgress();
    }
  });
  
  async function checkSetupProgress() {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    isLoading = true;
    try {
      // Check if tower sites exist
      const { authService } = await import('$lib/services/authService');
      const token = await authService.getAuthTokenForApi();
      const response = await fetch('/api/network/sites', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': tenantId
        }
      });
      const sites = response.ok ? await response.json() : [];
      setupProgress.towerAdded = Array.isArray(sites) && sites.length > 0;
      setupProgress.towerAdded = sites.length > 0;
      
      // Check CBRS configuration (if module accessible)
      // Check ACS configuration
      // Check monitoring configuration
      // Check customers
      
      // If all done, skip to completion
      if (setupProgress.organizationCreated && setupProgress.towerAdded) {
        currentStep = steps.length - 1;
      }
    } catch (err) {
      console.error('Error checking setup progress:', err);
    } finally {
      isLoading = false;
    }
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function nextStep() {
    if (currentStep < steps.length - 1) {
      completedSteps.add(currentStep);
      currentStep++;
    }
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }
  
  function goToStep(stepIndex: number) {
    // Can only go to completed steps or next step
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      currentStep = stepIndex;
    }
  }
  
  async function completeSetup() {
    isLoading = true;
    try {
      // Mark onboarding as complete
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboardingCompleted', 'true');
      }
      
      // Navigate to dashboard
      await goto('/dashboard');
      handleClose();
    } catch (err: any) {
      error = err.message || 'Failed to complete setup';
    } finally {
      isLoading = false;
    }
  }
  
  async function skipToDashboard() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboardingCompleted', 'true');
    }
    await goto('/dashboard');
    handleClose();
  }
</script>

{#if show}
  <div class="wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h2 id="wizard-title">🚀 Welcome to WISP Tools</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">✕</button>
      </div>
      
      <!-- Progress Steps -->
      <nav class="wizard-steps" aria-label="Setup steps">
        {#each steps as step, index}
          <button
            type="button"
            class="wizard-step"
            class:active={index === currentStep}
            class:complete={completedSteps.has(index)}
            on:click={() => goToStep(index)}
            disabled={index > currentStep && !completedSteps.has(index)}
          >
            <span class="step-icon">{step.icon}</span>
            <span class="step-title">{step.title}</span>
          </button>
        {/each}
      </nav>
      
      <!-- Step Content -->
      <div class="wizard-content">
        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}
        
        {#if currentStep === 0}
          <!-- Welcome Step -->
          <div class="wizard-panel">
            <div class="welcome-content">
              <h3>Welcome to WISP Tools! 🎉</h3>
              <p>Let's get your wireless ISP set up and running in just a few minutes.</p>
              
              <div class="features-preview">
                <div class="feature-item">
                  <span class="icon">🗺️</span>
                  <div>
                    <strong>Coverage Map</strong>
                    <p>Plan and visualize your network coverage</p>
                  </div>
                </div>
                <div class="feature-item">
                  <span class="icon">📡</span>
                  <div>
                    <strong>CBRS Management</strong>
                    <p>Manage spectrum and device registration</p>
                  </div>
                </div>
                <div class="feature-item">
                  <span class="icon">⚙️</span>
                  <div>
                    <strong>CPE Management</strong>
                    <p>Configure and monitor customer equipment</p>
                  </div>
                </div>
                <div class="feature-item">
                  <span class="icon">📊</span>
                  <div>
                    <strong>Monitoring & Analytics</strong>
                    <p>Track performance and network health</p>
                  </div>
                </div>
              </div>
              
              <div class="setup-time">
                <strong>⏱️ Estimated time:</strong> 5-10 minutes
              </div>
            </div>
          </div>
          
        {:else if currentStep === 1}
          <!-- Organization Setup Step -->
          <div class="wizard-panel">
            <h3>Organization Setup</h3>
            <p>Your organization is already created! Let's verify the details.</p>
            
            {#if $currentTenant}
              <div class="info-card">
                <div class="info-row">
                  <span class="label">Organization Name:</span>
                  <span class="value">{$currentTenant.displayName}</span>
                </div>
                <div class="info-row">
                  <span class="label">Contact Email:</span>
                  <span class="value">{$currentTenant.contactEmail}</span>
                </div>
              </div>
            {/if}
            
            <p class="hint">✅ Organization setup complete! You can edit these details later in Settings.</p>
            <button type="button" class="btn-link" on:click={() => (showOrgWizard = true)}>Open full Organization Setup wizard</button>
          </div>
          
        {:else if currentStep === 2}
          <!-- Add First Tower Step -->
          <div class="wizard-panel">
            <h3>Add Your First Tower Site</h3>
            <p>Let's add your first network tower to get started with coverage planning.</p>
            
            <div class="action-card">
              <p><strong>Option 1: Quick Setup</strong></p>
              <p>Add a tower site now through the Coverage Map module.</p>
              <button class="btn-primary" on:click={() => { dispatch('action', { type: 'add-tower' }); }}>
                Open Coverage Map
              </button>
            </div>
            
            <div class="action-card">
              <p><strong>Option 2: Skip for Now</strong></p>
              <p>You can add tower sites later from the Coverage Map module.</p>
            </div>
          </div>
          
        {:else if currentStep === 3}
          <!-- Configure Modules Step -->
          <div class="wizard-panel">
            <h3>Configure Modules (Optional)</h3>
            <p>Set up the modules you'll use for your operations.</p>
            
            <div class="modules-grid">
              <div class="module-card">
                <span class="icon">📡</span>
                <h4>CBRS Management</h4>
                <p>Configure Google SAS and Federated Wireless API keys</p>
                <button class="btn-secondary" on:click={() => dispatch('action', { type: 'setup-cbrs' })}>
                  Setup CBRS
                </button>
              </div>
              
              <div class="module-card">
                <span class="icon">⚙️</span>
                <h4>ACS/TR-069</h4>
                <p>Connect GenieACS for CPE device management</p>
                <button class="btn-secondary" on:click={() => dispatch('action', { type: 'setup-acs' })}>
                  Setup ACS
                </button>
              </div>
              
              <div class="module-card">
                <span class="icon">📊</span>
                <h4>Monitoring</h4>
                <p>Configure SNMP and network monitoring</p>
                <button class="btn-secondary" on:click={() => dispatch('action', { type: 'setup-monitoring' })}>
                  Setup Monitoring
                </button>
              </div>
            </div>
            
            <p class="hint">💡 You can configure these modules later from the Dashboard.</p>
            <button type="button" class="btn-link" on:click={() => (showConfigWizard = true)}>Open full Initial Configuration wizard</button>
          </div>
          
        {:else if currentStep === 4}
          <!-- Complete Step -->
          <div class="wizard-panel">
            <h3>🎉 Setup Complete!</h3>
            <p>You're all set! Here's what you can do next:</p>
            
            <div class="next-steps">
              <a href="/modules/coverage-map" class="next-step-item">
                <span class="icon">🗺️</span>
                <div>
                  <strong>Explore Coverage Map</strong>
                  <p>Add tower sites and plan your network coverage</p>
                </div>
              </a>
              <a href="/modules/customers" class="next-step-item">
                <span class="icon">👥</span>
                <div>
                  <strong>Add Customers</strong>
                  <p>Start managing your customer base</p>
                </div>
              </a>
              <a href="/modules/work-orders" class="next-step-item">
                <span class="icon">📋</span>
                <div>
                  <strong>Create Work Orders</strong>
                  <p>Manage installations and service requests</p>
                </div>
              </a>
              <a href="/modules/voice-telephony" class="next-step-item">
                <span class="icon">📞</span>
                <div>
                  <strong>Voice / SIP &amp; UC</strong>
                  <p>Link numbers, E911, and porting to customers</p>
                </div>
              </a>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Wizard Footer -->
      <div class="wizard-footer">
        {#if currentStep > 0}
          <button class="btn-secondary" on:click={prevStep} disabled={isLoading}>
            ← Previous
          </button>
        {:else}
          <button class="btn-secondary" on:click={skipToDashboard} disabled={isLoading}>
            Skip Setup
          </button>
        {/if}
        
        <div class="footer-actions">
          {#if currentStep < steps.length - 1}
            <button class="btn-primary" on:click={nextStep} disabled={isLoading}>
              {currentStep === 0 ? 'Get Started →' : 'Next →'}
            </button>
          {:else}
            <button class="btn-primary" on:click={completeSetup} disabled={isLoading}>
              {isLoading ? 'Completing...' : 'Go to Dashboard →'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
  <OrganizationSetupWizard show={showOrgWizard} on:close={() => (showOrgWizard = false)} />
  <InitialConfigurationWizard show={showConfigWizard} on:close={() => (showConfigWizard = false)} />
{/if}

<style>
  .btn-link {
    background: none;
    border: none;
    color: var(--primary-color, #007bff);
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.25rem 0;
    margin-top: 0.5rem;
    display: inline-block;
  }
  .btn-link:hover {
    color: var(--primary-hover, #0056b3);
  }
  .wizard-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
  }
  
  .wizard-modal {
    background: var(--card-bg, #ffffff);
    border-radius: 1rem;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .wizard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .wizard-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--hover-bg, #f5f5f5);
    color: var(--text-primary, #1a1a1a);
  }
  
  .wizard-steps {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    overflow-x: auto;
  }
  
  .wizard-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .wizard-step:hover:not(:disabled) {
    background: var(--hover-bg, #f0f0f0);
  }
  
  .wizard-step.active {
    background: var(--primary-color, #007bff);
    color: white;
    border-color: var(--primary-color, #007bff);
  }
  
  .wizard-step.complete {
    background: var(--success-bg, #d4edda);
    border-color: var(--success-color, #28a745);
  }
  
  .wizard-step:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .step-icon {
    font-size: 1.25rem;
  }
  
  .wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }
  
  .wizard-panel h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: var(--text-primary, #1a1a1a);
  }
  
  .wizard-panel p {
    color: var(--text-secondary, #666);
    line-height: 1.6;
    margin: 0.5rem 0;
  }
  
  .wizard-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
    gap: 1rem;
  }
  
  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary-color, #007bff);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover, #0056b3);
    transform: translateY(-1px);
  }
  
  .btn-secondary {
    background: var(--bg-secondary, #f9f9f9);
    color: var(--text-primary, #1a1a1a);
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--hover-bg, #f0f0f0);
  }
  
  .btn-primary:disabled, .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .welcome-content {
    text-align: center;
  }
  
  .features-preview {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin: 2rem 0;
  }
  
  .feature-item {
    display: flex;
    align-items: start;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
  }
  
  .feature-item .icon {
    font-size: 2rem;
  }
  
  .setup-time {
    margin-top: 2rem;
    padding: 1rem;
    background: var(--info-bg, #d1ecf1);
    border-radius: 0.5rem;
    color: var(--info-color, #0c5460);
  }
  
  .info-card {
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin: 1rem 0;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-row .label {
    font-weight: 500;
    color: var(--text-secondary, #666);
  }
  
  .info-row .value {
    color: var(--text-primary, #1a1a1a);
  }
  
  .action-card {
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin: 1rem 0;
  }
  
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }
  
  .module-card {
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
    padding: 1.5rem;
    text-align: center;
  }
  
  .module-card .icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.5rem;
  }
  
  .module-card h4 {
    margin: 0.5rem 0;
    color: var(--text-primary, #1a1a1a);
  }
  
  .module-card p {
    font-size: 0.875rem;
    margin: 0.5rem 0 1rem 0;
  }
  
  .next-steps {
    margin: 2rem 0;
  }

  a.next-step-item {
    text-decoration: none;
    color: inherit;
  }

  a.next-step-item:hover {
    background: var(--hover-bg, #f0f0f0);
  }
  
  .next-step-item {
    display: flex;
    align-items: start;
    gap: 1rem;
    padding: 1rem;
    margin: 0.5rem 0;
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 0.5rem;
  }
  
  .next-step-item .icon {
    font-size: 1.5rem;
  }
  
  .hint {
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--info-bg, #d1ecf1);
    border-radius: 0.5rem;
    color: var(--info-color, #0c5460);
    font-size: 0.875rem;
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: var(--error-bg, #f8d7da);
    color: var(--error-color, #721c24);
  }
  
  @media (max-width: 640px) {
    .wizard-modal {
      max-width: 100%;
      margin: 0.5rem;
    }
    
    .features-preview {
      grid-template-columns: 1fr;
    }
    
    .modules-grid {
      grid-template-columns: 1fr;
    }
    
    .wizard-steps {
      flex-wrap: nowrap;
      overflow-x: auto;
    }
  }
</style>
