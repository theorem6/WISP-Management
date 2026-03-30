<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { auth } from '$lib/firebase';
  import {
    getTenantModuleConfig,
    updateRoleModuleAccess,
    resetRoleToDefaults,
    resetAllRolesToDefaults,
    type TenantModuleConfig
  } from '$lib/services/moduleAccessService';
  import { DEFAULT_MODULE_ACCESS, ROLE_NAMES, type UserRole, type ModuleAccess } from '$lib/models/userRole';
  
  let loading = true;
  let saving = false;
  let error = '';
  let success = false;
  let config: TenantModuleConfig | null = null;
  let moduleAccess: Record<UserRole, ModuleAccess> = { ...DEFAULT_MODULE_ACCESS };
  let hasChanges = false;
  let showResetConfirm = false;
  
  const roles: UserRole[] = ['owner', 'admin', 'engineer', 'installer', 'helpdesk', 'viewer'];
  
  const modules = [
    { key: 'pciResolution' as keyof ModuleAccess, name: 'PCI Resolution', icon: '📊' },
    { key: 'cbrsManagement' as keyof ModuleAccess, name: 'CBRS Management', icon: '📡' },
    { key: 'acsManagement' as keyof ModuleAccess, name: 'ACS CPE Management', icon: '📡' },
    { key: 'hssManagement' as keyof ModuleAccess, name: 'HSS Management', icon: '🔐' },
    { key: 'coverageMap' as keyof ModuleAccess, name: 'Coverage Map', icon: '🗺️' },
    { key: 'inventory' as keyof ModuleAccess, name: 'Inventory', icon: '📦' },
    { key: 'workOrders' as keyof ModuleAccess, name: 'Work Orders', icon: '📋' },
    { key: 'helpDesk' as keyof ModuleAccess, name: 'Help Desk', icon: '🎧' },
    { key: 'distributedEpc' as keyof ModuleAccess, name: 'Distributed EPC', icon: '🌐' },
    { key: 'monitoring' as keyof ModuleAccess, name: 'Monitoring', icon: '🔍' },
    { key: 'voiceTelephony' as keyof ModuleAccess, name: 'Voice / SIP & UC', icon: '📞' },
    { key: 'userManagement' as keyof ModuleAccess, name: 'User Management', icon: '👥' },
    { key: 'tenantSettings' as keyof ModuleAccess, name: 'Tenant Settings', icon: '⚙️' },
    { key: 'backendManagement' as keyof ModuleAccess, name: 'Backend Management', icon: '🔧' },
  ];
  
  onMount(async () => {
    await loadConfig();
  });
  
  async function loadConfig() {
    if (!$currentTenant) return;
    
    loading = true;
    error = '';
    
    try {
      config = await getTenantModuleConfig($currentTenant.id);
      
      if (config?.roleModuleAccess) {
        moduleAccess = { ...config.roleModuleAccess };
      } else {
        moduleAccess = { ...DEFAULT_MODULE_ACCESS };
      }
      
      hasChanges = false;
    } catch (err: any) {
      error = err.message || 'Failed to load configuration';
    } finally {
      loading = false;
    }
  }
  
  function toggleModule(role: UserRole, moduleKey: keyof ModuleAccess) {
    // Owner and platform_admin always have full access
    if (role === 'owner' || role === 'platform_admin') return;
    
    moduleAccess[role] = {
      ...moduleAccess[role],
      [moduleKey]: !moduleAccess[role][moduleKey]
    };
    hasChanges = true;
  }
  
  async function handleSave() {
    const firebaseAuth = auth();
    const currentUserId = firebaseAuth.currentUser?.uid;
    if (!$currentTenant || !currentUserId) return;
    
    saving = true;
    error = '';
    success = false;
    
    try {
      // Save each role's configuration
      for (const role of roles) {
        if (role !== 'platform_admin') {
          await updateRoleModuleAccess(
            $currentTenant.id,
            role,
            moduleAccess[role],
            currentUserId
          );
        }
      }
      
      success = true;
      hasChanges = false;
      
      setTimeout(() => {
        success = false;
      }, 3000);
    } catch (err: any) {
      error = err.message || 'Failed to save configuration';
    } finally {
      saving = false;
    }
  }
  
  async function handleResetRole(role: UserRole) {
    const firebaseAuth = auth();
    const currentUserId = firebaseAuth.currentUser?.uid;
    if (!$currentTenant || !currentUserId) return;
    
    try {
      await resetRoleToDefaults($currentTenant.id, role, currentUserId);
      await loadConfig();
    } catch (err: any) {
      error = err.message || 'Failed to reset role';
    }
  }
  
  async function handleResetAll() {
    const firebaseAuth = auth();
    const currentUserId = firebaseAuth.currentUser?.uid;
    if (!$currentTenant || !currentUserId) return;
    
    saving = true;
    error = '';
    
    try {
      await resetAllRolesToDefaults($currentTenant.id, currentUserId);
      await loadConfig();
      showResetConfirm = false;
    } catch (err: any) {
      error = err.message || 'Failed to reset all roles';
    } finally {
      saving = false;
    }
  }
  
  function isModuleEnabled(role: UserRole, moduleKey: keyof ModuleAccess): boolean {
    return moduleAccess[role]?.[moduleKey] ?? false;
  }
  
  function isRoleLocked(role: UserRole): boolean {
    return role === 'owner' || role === 'platform_admin';
  }

  function handleResetBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      showResetConfirm = false;
    }
  }

  function handleResetBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      showResetConfirm = false;
    }
  }
</script>

<div class="module-access-container">
  <div class="header">
    <div class="title-section">
      <h1>⚙️ Module Access Configuration</h1>
      <p class="subtitle">Configure which modules each role can access in {$currentTenant?.name || 'your organization'}</p>
    </div>
    
    <div class="header-actions">
      <button class="btn btn-secondary" on:click={() => showResetConfirm = true} disabled={loading || saving}>
        🔄 Reset All to Defaults
      </button>
      
      <button class="btn btn-primary" on:click={handleSave} disabled={!hasChanges || saving}>
        {#if saving}
          <span class="spinner-sm"></span>
          Saving...
        {:else}
          💾 Save Configuration
        {/if}
      </button>
    </div>
  </div>
  
  {#if error}
    <div class="alert alert-error">
      <span>❌</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="alert alert-success">
      <span>✅</span>
      <span>Configuration saved successfully!</span>
    </div>
  {/if}
  
  {#if hasChanges}
    <div class="alert alert-warning">
      <span>⚠️</span>
      <span>You have unsaved changes. Click "Save Configuration" to apply them.</span>
    </div>
  {/if}
  
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading configuration...</p>
    </div>
  {:else}
    <div class="config-table-container">
      <table class="config-table">
        <thead>
          <tr>
            <th class="module-column">Module</th>
            {#each roles as role}
              {#if role !== 'platform_admin'}
                <th class="role-column">
                  <div class="role-header">
                    <div class="role-name">{ROLE_NAMES[role]}</div>
                    {#if isRoleLocked(role)}
                      <span class="lock-badge">🔒</span>
                    {:else}
                      <button
                        class="reset-role-btn"
                        on:click={() => handleResetRole(role)}
                        title="Reset to defaults"
                      >
                        🔄
                      </button>
                    {/if}
                  </div>
                </th>
              {/if}
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each modules as module}
            <tr>
              <td class="module-name">
                <span class="module-icon">{module.icon}</span>
                {module.name}
              </td>
              {#each roles as role}
                {#if role !== 'platform_admin'}
                  <td class="checkbox-cell">
                    <label class="checkbox-container">
                      <input
                        type="checkbox"
                        checked={isModuleEnabled(role, module.key)}
                        on:change={() => toggleModule(role, module.key)}
                        disabled={isRoleLocked(role) || saving}
                      />
                      <span class="checkmark"></span>
                    </label>
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    
    <div class="legend">
      <h3>Legend:</h3>
      <ul>
        <li>✅ <strong>Checked</strong> = Role can access this module</li>
        <li>❌ <strong>Unchecked</strong> = Role cannot access this module</li>
        <li>🔒 <strong>Locked</strong> = Owner role always has full access (cannot be changed)</li>
        <li>🔄 <strong>Reset</strong> = Reset individual role to default permissions</li>
      </ul>
    </div>
  {/if}
</div>

{#if showResetConfirm}
  <div
    class="modal-backdrop"
    role="presentation"
    aria-hidden="true"
    tabindex="-1"
    on:click={handleResetBackdropClick}
  >
    <div
      class="modal-content"
      role="dialog"
      aria-modal="true"
      aria-label="Reset module access confirmation dialog"
      tabindex="0"
      on:keydown={handleResetBackdropKeydown}
      on:click|stopPropagation
    >
      <div class="modal-header">
        <h2>Reset All to Defaults?</h2>
        <button class="close-btn" on:click={() => showResetConfirm = false}>✕</button>
      </div>
      <div class="modal-body">
        <p>This will reset module access for all roles to their default configurations.</p>
        <p class="warning-text">Any custom changes will be lost. This cannot be undone.</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" on:click={() => showResetConfirm = false} disabled={saving}>
          Cancel
        </button>
        <button class="btn btn-danger" on:click={handleResetAll} disabled={saving}>
          {#if saving}
            <span class="spinner-sm"></span>
            Resetting...
          {:else}
            Yes, Reset All
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .module-access-container {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }
  
  .title-section h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
  
  .config-table-container {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow-x: auto;
    margin-bottom: 2rem;
  }
  
  .config-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .config-table thead {
    background: var(--bg-secondary);
    border-bottom: 2px solid var(--border-color);
  }
  
  .config-table th {
    padding: 1rem;
    text-align: center;
    font-weight: 600;
    white-space: nowrap;
  }
  
  .module-column {
    text-align: left !important;
    min-width: 200px;
  }
  
  .role-column {
    min-width: 120px;
  }
  
  .role-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  
  .role-name {
    font-size: 0.875rem;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  
  .lock-badge {
    font-size: 1.25rem;
  }
  
  .reset-role-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
  }
  
  .reset-role-btn:hover {
    opacity: 1;
  }
  
  .config-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .module-name {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 500;
  }
  
  .module-icon {
    font-size: 1.5rem;
  }
  
  .checkbox-cell {
    text-align: center;
  }
  
  .checkbox-container {
    display: inline-block;
    position: relative;
    cursor: pointer;
    user-select: none;
  }
  
  .checkbox-container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }
  
  .checkmark {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-radius: 0.25rem;
    background: white;
    transition: all 0.2s;
  }
  
  .checkbox-container input:checked ~ .checkmark {
    background: var(--primary);
    border-color: var(--primary);
  }
  
  .checkbox-container input:checked ~ .checkmark::after {
    content: '✓';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: 700;
    font-size: 16px;
  }
  
  .checkbox-container input:disabled ~ .checkmark {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .legend {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.5rem;
  }
  
  .legend h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }
  
  .legend ul {
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .legend li {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary { background: var(--primary); color: white; }
  .btn-secondary { background: #6b7280; color: white; }
  .btn-danger { background: #ef4444; color: white; }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  
  .alert-error {
    background: #fee;
    border: 1px solid #fcc;
    color: #c00;
  }
  
  .alert-success {
    background: #efe;
    border: 1px solid #cfc;
    color: #060;
  }
  
  .alert-warning {
    background: #ffc;
    border: 1px solid #fc6;
    color: #960;
  }
  
  .alert button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }
  
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .spinner-sm {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: white;
    border-radius: 0.75rem;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0.5;
  }
  
  .close-btn:hover {
    opacity: 1;
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .modal-body p {
    margin: 0 0 1rem;
    color: var(--text-secondary);
  }
  
  .warning-text {
    color: #ef4444;
    font-weight: 500;
  }
  
  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
</style>

