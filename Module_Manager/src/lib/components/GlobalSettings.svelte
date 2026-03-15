<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { authService } from '$lib/services/authService';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { getTenantAppSettings, saveTenantAppSettings } from '$lib/services/tenantSettingsService';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  // Check if we're in plan or deploy module
  $: isPlanOrDeploy = (() => {
    const path = $page.url.pathname;
    return path.includes('/modules/plan') || path.includes('/modules/deploy');
  })();
  
  import ImportSystem from './ImportSystem.svelte';
  import UserManagementEmbedded from './UserManagementEmbedded.svelte';
  import BrandingManagement from './BrandingManagement.svelte';
  import { isDebugEnabled, enableDebug, disableDebug } from '$lib/utils/debug';
  
  let activeTab: 'appearance' | 'acs' | 'info' | 'import' | 'users' | 'branding' | 'debug' = 'appearance';
  let showImportSystem = false;
  let loading = false;
  let saveSuccess = false;
  let saveError = '';
  
  // Appearance settings
  let theme: 'light' | 'dark' | 'system' = 'system';
  
  // Debug settings
  let debugEnabled = false;
  let showDebugWarning = false;
  
  // ACS credentials
  let acsSettings = {
    username: '',
    password: '',
    url: ''
  };
  
  // Company info
  let companyInfo = {
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: ''
  };
  
  onMount(() => {
    loadSettings();
  });
  
  $: if (show && $currentTenant?.id) {
    loadAppSettingsFromBackend();
  }
  
  async function loadAppSettingsFromBackend() {
    const settings = await getTenantAppSettings($currentTenant?.id);
    acsSettings = { ...acsSettings, ...settings.acsSettings };
    companyInfo = { ...companyInfo, ...settings.companyInfo };
  }
  
  function loadSettings() {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system';
    if (savedTheme) {
      theme = savedTheme;
    }
    
    // Load debug setting
    debugEnabled = isDebugEnabled();
    
    // Load ACS and company from backend (or localStorage fallback) when tenant is set
    const tenantId = typeof window !== 'undefined' ? ($currentTenant?.id ?? localStorage.getItem('selectedTenantId') ?? undefined) : undefined;
    if (tenantId) {
      getTenantAppSettings(tenantId).then((s) => {
        acsSettings = { ...acsSettings, ...s.acsSettings };
        companyInfo = { ...companyInfo, ...s.companyInfo };
      });
    } else {
      const savedACS = localStorage.getItem('acs_settings');
      if (savedACS) {
        try {
          acsSettings = { ...acsSettings, ...JSON.parse(savedACS) };
        } catch (e) {
          console.error('Failed to parse ACS settings:', e);
        }
      }
      const savedCompany = localStorage.getItem('company_info');
      if (savedCompany) {
        try {
          companyInfo = { ...companyInfo, ...JSON.parse(savedCompany) };
        } catch (e) {
          console.error('Failed to parse company info:', e);
        }
      }
    }
  }
  
  function toggleDebugMode() {
    if (debugEnabled) {
      // Disabling - no warning needed
      disableDebug();
      debugEnabled = false;
      showDebugWarning = false;
    } else {
      // Enabling - show warning
      showDebugWarning = true;
      enableDebug();
      debugEnabled = true;
    }
  }
  
  function acknowledgeDebugWarning() {
    showDebugWarning = false;
  }
  
  function applyTheme(newTheme: 'light' | 'dark' | 'system') {
    theme = newTheme;
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    
    saveSuccess = true;
    setTimeout(() => saveSuccess = false, 2000);
  }
  
  async function saveACSSettings() {
    loading = true;
    saveError = '';
    try {
      const ok = await saveTenantAppSettings($currentTenant?.id, { acsSettings });
      if (ok) {
        saveSuccess = true;
        setTimeout(() => (saveSuccess = false), 2000);
      } else {
        saveError = 'Failed to save ACS settings. Check your connection.';
      }
    } catch (error: unknown) {
      console.error('Failed to save ACS settings:', error);
      saveError = error instanceof Error ? error.message : 'Failed to save ACS settings';
    } finally {
      loading = false;
    }
  }
  
  async function saveCompanyInfo() {
    loading = true;
    saveError = '';
    try {
      const ok = await saveTenantAppSettings($currentTenant?.id, { companyInfo });
      if (ok) {
        saveSuccess = true;
        setTimeout(() => (saveSuccess = false), 2000);
      } else {
        saveError = 'Failed to save company info. Check your connection.';
      }
    } catch (error: unknown) {
      console.error('Failed to save company info:', error);
      saveError = error instanceof Error ? error.message : 'Failed to save company info';
    } finally {
      loading = false;
    }
  }
  
  function handleClose() {
    show = false;
    activeTab = 'appearance';
    saveSuccess = false;
    saveError = '';
    dispatch('close');
  }

  let panelEl: HTMLDivElement | undefined;
  let prevShow = false;
  const FOCUSABLE_SEL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function getFocusables(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter((el) => !el.hasAttribute('disabled'));
  }
  $: if (show && !prevShow) {
    prevShow = true;
    setTimeout(() => panelEl && getFocusables(panelEl)[0]?.focus(), 50);
  }
  $: if (!show) prevShow = false;
  function handlePanelKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
      return;
    }
    if (e.key === 'Tab' && panelEl) {
      const focusables = getFocusables(panelEl);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const target = e.shiftKey ? (document.activeElement === first ? last : null) : (document.activeElement === last ? first : null);
      if (target) {
        e.preventDefault();
        target.focus();
      }
    }
  }
</script>

{#if show}
  <div class="settings-overlay" on:click={handleClose} role="presentation">
    <div
      class="settings-panel"
      class:plan-deploy-mode={isPlanOrDeploy}
      on:click|stopPropagation
      on:keydown={handlePanelKeydown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      bind:this={panelEl}
    >
      <div class="settings-header">
        <h2 id="settings-title">⚙️ Settings</h2>
        <div class="header-actions">
          <button class="close-btn" on:click={handleClose} title="Close">✕</button>
        </div>
      </div>
      
      <div class="settings-tabs">
        <button 
          class="tab" 
          class:active={activeTab === 'appearance'}
          on:click={() => activeTab = 'appearance'}
        >
          🎨 Appearance
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'acs'}
          on:click={() => activeTab = 'acs'}
        >
          🔐 ACS Credentials
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'info'}
          on:click={() => activeTab = 'info'}
        >
          ℹ️ Company Info
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'import'}
          on:click={() => { activeTab = 'import'; showImportSystem = true; }}
        >
          📥 Import Data
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'users'}
          on:click={() => activeTab = 'users'}
        >
          👤 User Management
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'branding'}
          on:click={() => activeTab = 'branding'}
        >
          🎨 Customer Portal Branding
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'debug'}
          on:click={() => activeTab = 'debug'}
        >
          🐛 Debug Mode
        </button>
      </div>
      
      <div class="settings-content">
        {#if activeTab === 'appearance'}
          <div class="tab-content">
            <h3>Theme</h3>
            <p class="description">Choose your preferred color scheme</p>
            
            <div class="theme-options">
              <button 
                class="theme-option" 
                class:active={theme === 'light'}
                on:click={() => applyTheme('light')}
              >
                <span class="icon">☀️</span>
                <span class="label">Light</span>
              </button>
              
              <button 
                class="theme-option" 
                class:active={theme === 'dark'}
                on:click={() => applyTheme('dark')}
              >
                <span class="icon">🌙</span>
                <span class="label">Dark</span>
              </button>
              
              <button 
                class="theme-option" 
                class:active={theme === 'system'}
                on:click={() => applyTheme('system')}
              >
                <span class="icon">💻</span>
                <span class="label">System</span>
              </button>
            </div>
          </div>
        {:else if activeTab === 'acs'}
          <div class="tab-content">
            <h3>ACS Credentials</h3>
            <p class="description">Configure your ACS (GenieACS) connection</p>
            
            <div class="form-group">
              <label>ACS URL</label>
              <input 
                type="url" 
                bind:value={acsSettings.url}
                placeholder="https://acs.example.com"
              />
            </div>
            
            <div class="form-group">
              <label>Username</label>
              <input 
                type="text" 
                bind:value={acsSettings.username}
                placeholder="admin"
              />
            </div>
            
            <div class="form-group">
              <label>Password</label>
              <input 
                type="password" 
                bind:value={acsSettings.password}
                placeholder="••••••••"
              />
            </div>
            
            <button class="btn-save" on:click={saveACSSettings} disabled={loading}>
              {loading ? 'Saving...' : 'Save ACS Settings'}
            </button>
          </div>
        {:else if activeTab === 'info'}
          <div class="tab-content">
            <h3>Company Information</h3>
            <p class="description">Your company details for reports and documentation</p>
            
            <div class="form-group">
              <label>Company Name</label>
              <input 
                type="text" 
                bind:value={companyInfo.name}
                placeholder="ACME Networks Inc."
              />
            </div>
            
            <div class="form-group">
              <label>Street Address</label>
              <input 
                type="text" 
                bind:value={companyInfo.address}
                placeholder="123 Main Street"
              />
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>City</label>
                <input 
                  type="text" 
                  bind:value={companyInfo.city}
                  placeholder="New York"
                />
              </div>
              
              <div class="form-group">
                <label>State</label>
                <input 
                  type="text" 
                  bind:value={companyInfo.state}
                  placeholder="NY"
                  maxlength="2"
                />
              </div>
              
              <div class="form-group">
                <label>ZIP Code</label>
                <input 
                  type="text" 
                  bind:value={companyInfo.zip}
                  placeholder="10001"
                  maxlength="10"
                />
              </div>
            </div>
            
            <div class="form-group">
              <label>Phone</label>
              <input 
                type="tel" 
                bind:value={companyInfo.phone}
                placeholder="(555) 123-4567"
              />
            </div>
            
            <div class="form-group">
              <label>Email</label>
              <input 
                type="email" 
                bind:value={companyInfo.email}
                placeholder="contact@company.com"
              />
            </div>
            
            <button class="btn-save" on:click={saveCompanyInfo} disabled={loading}>
              {loading ? 'Saving...' : 'Save Company Info'}
            </button>
          </div>
        {:else if activeTab === 'import'}
          <div class="tab-content">
            <h3>Data Import</h3>
            <p class="description">Import data from CSV files for all database objects (except ACS items)</p>
            
            <div class="import-info">
              <p>Use the import system to bulk import:</p>
              <ul>
                <li>📦 Inventory Items</li>
                <li>👥 Customers</li>
                <li>🗺️ Plans/Projects</li>
                <li>🏗️ Sites/Towers</li>
                <li>📡 Network Equipment</li>
                <li>📋 Work Orders</li>
                <li>👤 Users</li>
                <li>📚 Hardware Bundles</li>
              </ul>
            </div>
            
            <button class="btn-save" on:click={() => { showImportSystem = true; }}>
              📥 Open Import System
            </button>
          </div>
        {:else if activeTab === 'users'}
          <div class="tab-content full-height">
            <UserManagementEmbedded />
          </div>
        {:else if activeTab === 'branding'}
          <div class="tab-content">
            <BrandingManagement />
          </div>
        {:else if activeTab === 'debug'}
          <div class="tab-content">
            <h3>🐛 Debug Mode</h3>
            <p class="description">Advanced debugging for troubleshooting with wisptools.io engineers</p>
            
            {#if showDebugWarning}
              <div class="debug-warning">
                <div class="warning-header">
                  <span class="warning-icon">⚠️</span>
                  <strong>Warning: Debug Mode Enabled</strong>
                </div>
                <p>Debug mode will:</p>
                <ul>
                  <li>Slow down web application responses</li>
                  <li>Generate extensive console logging</li>
                  <li>Expose detailed system information</li>
                </ul>
                <p><strong>This should only be enabled when working with a wisptools.io engineer.</strong></p>
                <button class="btn-acknowledge" on:click={acknowledgeDebugWarning}>
                  I Understand
                </button>
              </div>
            {/if}
            
            <div class="debug-setting">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Enable Debug Logging</label>
                  <p class="setting-description">
                    When enabled, detailed debug information will be logged to the browser console.
                    This includes API calls, data transformations, state changes, and system metrics.
                    <strong>Only enable this when troubleshooting with a wisptools.io engineer.</strong>
                  </p>
                </div>
                <label class="toggle-switch">
                  <input 
                    type="checkbox" 
                    bind:checked={debugEnabled}
                    on:change={toggleDebugMode}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            {#if debugEnabled}
              <div class="debug-status">
                <p><strong>Debug mode is currently enabled.</strong></p>
                <p>Check your browser's developer console (F12) to see debug logs.</p>
              </div>
            {/if}
          </div>
        {/if}
        
        {#if saveSuccess}
          <div class="success-message">
            ✅ Settings saved successfully!
          </div>
        {/if}
        
        {#if saveError}
          <div class="error-message">
            ❌ {saveError}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Import System Modal -->
{#if showImportSystem}
  <ImportSystem 
    show={showImportSystem}
    on:close={() => { showImportSystem = false; }}
  />
{/if}

<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    z-index: 10000;
    backdrop-filter: blur(2px);
    padding: 1rem;
  }
  
  .settings-panel {
    background: var(--card-bg, white);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    width: auto;
    min-width: 400px;
    max-width: 90vw;
    max-height: 85vh;
    height: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin-bottom: 9.5rem;
    margin-right: 2rem;
    margin-left: auto;
    animation: slideUp 0.2s ease-out;
  }
  
  .settings-panel.plan-deploy-mode {
    margin-bottom: 3rem;
    margin-right: auto;
    margin-left: 2rem;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-secondary, #f8f9fa);
    flex-shrink: 0;
  }
  
  .settings-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-primary, #1a202c);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .close-btn {
    background: var(--bg-hover, #e2e8f0);
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-secondary, #718096);
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    transition: all 0.2s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    background: var(--bg-hover, #e2e8f0);
    color: var(--text-primary, #1a202c);
    opacity: 0.8;
  }
  
  .settings-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    background: var(--bg-secondary, #f8f9fa);
    flex-shrink: 0;
    overflow-x: auto;
  }
  
  .tab {
    flex: 0 0 auto;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-secondary, #718096);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tab:hover {
    background: var(--bg-hover, #e2e8f0);
  }
  
  .tab.active {
    color: var(--primary, #3b82f6);
    border-bottom-color: var(--primary, #3b82f6);
    background: var(--card-bg, white);
  }
  
  .settings-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0;
    min-height: 0;
  }

  .tab-content.full-height {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    min-height: 0;
  }
  
  .tab-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .tab-content.full-height {
    padding: 1.5rem;
  }
  
  .tab-content h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    color: var(--text-primary, #1a202c);
  }
  
  .description {
    margin: 0 0 1rem 0;
    color: var(--text-secondary, #718096);
    font-size: 0.85rem;
  }
  
  .theme-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }
  
  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0.75rem;
    border: 2px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    background: var(--card-bg, white);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .theme-option:hover {
    border-color: var(--primary, #3b82f6);
    transform: translateY(-2px);
  }
  
  .theme-option.active {
    border-color: var(--primary, #3b82f6);
    background: var(--primary-light, #eff6ff);
  }
  
  .theme-option .icon {
    font-size: 1.5rem;
  }
  
  .theme-option .label {
    font-size: 0.85rem;
    color: var(--text-primary, #1a202c);
    font-weight: 500;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.375rem;
    font-weight: 500;
    color: var(--text-primary, #1a202c);
    font-size: 0.85rem;
  }
  
  .form-group input {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    font-size: 0.9rem;
    background: var(--input-bg, white);
    color: var(--text-primary, #1a202c);
    transition: border-color 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 0.75rem;
  }
  
  .btn-save {
    width: 100%;
    padding: 0.75rem;
    background: var(--primary, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.75rem;
  }
  
  .btn-save:hover:not(:disabled) {
    background: var(--primary-dark, #2563eb);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .success-message {
    margin-top: 1rem;
    padding: 1rem;
    background: #d1fae5;
    border: 1px solid #6ee7b7;
    border-radius: 6px;
    color: #065f46;
    font-size: 0.9rem;
  }
  
  .error-message {
    margin-top: 1rem;
    padding: 1rem;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.9rem;
  }
  
  .import-info {
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .import-info p {
    margin: 0 0 0.75rem;
    color: var(--text-primary, #1a202c);
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .import-info ul {
    margin: 0;
    padding-left: 1.25rem;
    list-style: none;
  }
  
  .import-info li {
    margin-bottom: 0.375rem;
    color: var(--text-secondary, #718096);
    font-size: 0.85rem;
  }
  
  .debug-warning {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #fef3c7;
    border: 2px solid #f59e0b;
    border-radius: 8px;
    color: #92400e;
  }
  
  .warning-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    font-size: 1rem;
  }
  
  .warning-icon {
    font-size: 1.5rem;
  }
  
  .debug-warning ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  .debug-warning li {
    margin-bottom: 0.25rem;
  }
  
  .btn-acknowledge {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .btn-acknowledge:hover {
    background: #d97706;
  }
  
  .debug-setting {
    margin-top: 1rem;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    background: var(--bg-secondary, #f8f9fa);
    border-radius: 8px;
    border: 1px solid var(--border-color, #e0e0e0);
  }
  
  .setting-info {
    flex: 1;
    margin-right: 1rem;
  }
  
  .setting-info label {
    display: block;
    font-weight: 600;
    color: var(--text-primary, #1a202c);
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }
  
  .setting-description {
    margin: 0;
    color: var(--text-secondary, #718096);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 26px;
    flex-shrink: 0;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 26px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
  
  .toggle-switch input:checked + .toggle-slider {
    background-color: #3b82f6;
  }
  
  .toggle-switch input:checked + .toggle-slider:before {
    transform: translateX(24px);
  }
  
  .debug-status {
    margin-top: 1rem;
    padding: 1rem;
    background: #d1fae5;
    border: 1px solid #6ee7b7;
    border-radius: 8px;
    color: #065f46;
    font-size: 0.9rem;
  }
</style>

