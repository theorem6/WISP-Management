<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { authService } from '$lib/services/authService';
  import { tenantStore } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import type { Tenant } from '$lib/models/tenant';
  import { isSingleTenantMode } from '$lib/config/tenantMode';

  let isLoading = true;
  let tenants: Tenant[] = [];
  let currentUser: any = null;
  let error = '';

  onMount(async () => {
    if (!browser) return;

    console.log('[Tenant Selector] Page loaded');

    // Check if user is authenticated
    currentUser = authService.getCurrentUser();
    if (!currentUser) {
      console.log('[Tenant Selector] Not authenticated, redirecting to login');
      await goto('/login');
      return;
    }

    if (isSingleTenantMode()) {
      console.log('[Tenant Selector] Single-tenant mode: organization is fixed in config');
      await tenantStore.initialize();
      await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
      await goto('/dashboard', { replaceState: true });
      return;
    }

    // Initialize tenant store
    await tenantStore.initialize();

    // Load user's tenants
    try {
      tenants = await tenantStore.loadUserTenants(currentUser.uid, currentUser.email || undefined);
      console.log('[Tenant Selector] Loaded', tenants.length, 'tenants');
      
      if (tenants.length === 0) {
        // No tenants - allow user to create their first tenant
        console.log('[Tenant Selector] No tenants, allowing tenant creation');
        // Don't redirect - show the "Create New Organization" button instead
        // The error card will show, but users can click "Create New Organization"
      } else if (tenants.length === 1) {
        // Only one tenant, auto-select and redirect
        console.log('[Tenant Selector] Auto-selecting single tenant');
        selectTenant(tenants[0]);
      }
    } catch (err: any) {
      console.error('[Tenant Selector] Error loading tenants:', err);
      error = err.message || 'Failed to load tenants';
    } finally {
      isLoading = false;
    }
  });

  function selectTenant(tenant: Tenant) {
    console.log('[Tenant Selector] Tenant selected:', tenant.displayName);
    
    // Use tenant store to set current tenant
    tenantStore.setCurrentTenant(tenant, { source: 'manual' });
    
    // Redirect to dashboard
    goto('/dashboard');
  }

  async function createNewTenant() {
    console.log('[Tenant Selector] Creating new tenant');
    await goto('/tenant-setup');
  }
</script>

<TenantGuard requireTenant={false}>
<div class="tenant-selector-page">
  <div class="selector-container">
    <div class="selector-header">
      <h1>Select Organization</h1>
      <p>Choose the organization you want to work with</p>
    </div>

    {#if isLoading}
      <div class="loading-card">
        <div class="spinner-large"></div>
        <p>Loading your organizations...</p>
      </div>
    {:else if error}
      <div class="error-card">
        <span class="error-icon">⚠️</span>
        <h2>Error Loading Organizations</h2>
        <p>{error}</p>
        <button class="btn-primary" on:click={() => window.location.reload()}>
          Retry
        </button>
      </div>
    {:else}
      <div class="tenants-grid">
        {#each tenants as tenant}
          <button class="tenant-card" on:click={() => selectTenant(tenant)}>
            <div class="tenant-icon">🏢</div>
            <h3>{tenant.displayName}</h3>
            <p class="tenant-subdomain">{tenant.subdomain}</p>
            <div class="tenant-meta">
              <span class="status-badge status-{tenant.status}">{tenant.status}</span>
              <span class="role-badge">Your Role: Admin</span>
            </div>
          </button>
        {/each}

        <button class="tenant-card create-new" on:click={createNewTenant}>
          <div class="create-icon">➕</div>
          <h3>Create New Organization</h3>
          <p>Set up a new tenant for your devices</p>
        </button>
      </div>
    {/if}
  </div>
</div>
</TenantGuard>

<style>
  .tenant-selector-page {
    min-height: 100vh;
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
  }

  .selector-container {
    max-width: 900px;
    width: 100%;
  }

  .selector-header {
    text-align: center;
    color: var(--text-inverse);
    margin-bottom: var(--spacing-xl);
  }

  .selector-header h1 {
    font-size: 2rem;
    margin-bottom: var(--spacing-sm);
    font-weight: 600;
  }

  .selector-header p {
    opacity: 0.9;
    font-size: 1.1rem;
  }

  .loading-card, .error-card {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-2xl);
    box-shadow: var(--shadow-xl);
    text-align: center;
    border: 1px solid var(--border-color);
  }

  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border-light);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: var(--spacing-md);
  }

  .tenants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-lg);
  }

  .tenant-card {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-xl);
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    transition: var(--transition);
    border: 2px solid transparent;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tenant-card:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-xl);
    border-color: var(--brand-primary);
  }

  .tenant-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
  }

  .tenant-card h3 {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-sm);
    color: var(--text-primary);
    font-weight: 600;
  }

  .tenant-subdomain {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-md);
    font-family: 'Courier New', monospace;
  }

  .tenant-meta {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    justify-content: center;
  }

  .status-badge {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--border-radius);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-active {
    background-color: var(--success-light);
    color: var(--success);
  }

  .status-trial {
    background-color: var(--warning-light);
    color: var(--warning);
  }

  .status-suspended {
    background-color: var(--danger-light);
    color: var(--danger);
  }

  .role-badge {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--border-radius);
    font-size: 0.75rem;
    background-color: var(--primary-light);
    color: var(--brand-secondary);
  }

  .create-new {
    border: 2px dashed var(--border-color);
    background: var(--bg-secondary);
  }

  .create-new:hover {
    background: var(--card-bg);
    border-style: solid;
  }

  .create-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
    opacity: 0.7;
  }

  .btn-primary {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--gradient-primary);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    margin-top: var(--spacing-md);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  @media (max-width: 768px) {
    .tenant-selector-page {
      padding: var(--spacing-md);
    }

    .tenants-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

