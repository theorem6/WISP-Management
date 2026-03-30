<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { afterNavigate } from '$app/navigation';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { customerService, type Customer } from '$lib/services/customerService';
  import AddEditCustomerModal from './components/AddEditCustomerModal.svelte';
  import CustomerOnboardingWizard from '$lib/components/wizards/customers/CustomerOnboardingWizard.svelte';
  import ModuleWizardMenu from '$lib/components/wizards/ModuleWizardMenu.svelte';
  import { getWizardsForPath } from '$lib/config/wizardCatalog';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import GroupManagement from '../hss-management/components/GroupManagement.svelte';
  import BandwidthPlans from '../hss-management/components/BandwidthPlans.svelte';
  import { API_CONFIG, getApiUrl } from '$lib/config/api';
  import { authService } from '$lib/services/authService';
  
  type CustomerTab = 'customers' | 'service-plans' | 'customer-groups' | 'portal';
  
  let activeTab: CustomerTab = 'customers';
  const HSS_API = API_CONFIG.PATHS.HSS;
  
  // Data
  let customers: Customer[] = [];
  let isLoading = true;
  let error = '';
  let success = '';
  
  // Modals
  let showAddModal = false;
  let showEditModal = false;
  let showOnboardingWizard = false;
  let selectedCustomer: Customer | null = null;
  
  // Search & Filters
  let searchQuery = '';
  let selectedStatus = '';
  let showInactive = false;
  
  // Stats
  let stats = {
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    cancelled: 0
  };
  
  $: tenantId = $currentTenant?.id || '';
  
  let loadTimeout: ReturnType<typeof setTimeout> | null = null;

  afterNavigate(({ to }) => {
    const tab = to?.url.searchParams.get('tab');
    if (tab === 'portal') activeTab = 'portal';
  });
  onMount(() => {
    if (browser) {
      const wizardId = $page.url.searchParams.get('wizard');
      if (wizardId === 'customer-onboarding') { showOnboardingWizard = true; goto($page.url.pathname, { replaceState: true }); }
    }
    if (tenantId) loadCustomers();
  });
  
  // Only reload when tenantId changes, not on every render
  let lastTenantId = '';
  $: if (tenantId && tenantId !== lastTenantId) {
    lastTenantId = tenantId;
    loadCustomers();
  }
  
  async function loadCustomers() {
    if (!tenantId) return;
    
    try {
      isLoading = true;
      error = '';
      success = ''; // Clear success message when loading
      
      const filters: any = {
        limit: 1000
      };
      
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }
      
      if (selectedStatus) {
        filters.status = selectedStatus;
      }
      
      console.log('[CustomerPage] Calling searchCustomers with filters:', filters);
      customers = await customerService.searchCustomers(filters);
      console.log('[CustomerPage] Customers loaded:', { count: customers.length, customers });
      
      // Filter out inactive if needed
      if (!showInactive) {
        customers = customers.filter(c => c.isActive !== false);
      }
      
      // Calculate stats
      calculateStats();
      console.log('[CustomerPage] Stats calculated:', stats);
      
    } catch (err: any) {
      console.error('[CustomerPage] Error loading customers:', err);
      error = err.message || 'Failed to load customers';
      customers = [];
      setTimeout(() => {
        error = '';
      }, 5000);
    } finally {
      isLoading = false;
      console.log('[CustomerPage] Loading complete, isLoading:', isLoading);
    }
  }
  
  function calculateStats() {
    stats.total = customers.length;
    stats.active = customers.filter(c => c.serviceStatus === 'active').length;
    stats.pending = customers.filter(c => c.serviceStatus === 'pending').length;
    stats.suspended = customers.filter(c => c.serviceStatus === 'suspended').length;
    stats.cancelled = customers.filter(c => c.serviceStatus === 'cancelled').length;
  }
  
  function handleAdd() {
    selectedCustomer = null;
    showAddModal = true;
  }
  
  function handleEdit(customer: Customer) {
    selectedCustomer = customer;
    showEditModal = true;
  }
  
  function handleDelete(customer: Customer) {
    if (!confirm(`Are you sure you want to delete customer ${customer.fullName || customer.customerId}?`)) {
      return;
    }
    
    deleteCustomer(customer);
  }
  
  async function deleteCustomer(customer: Customer) {
    try {
      if (!customer._id) {
        error = 'Customer ID not found';
        setTimeout(() => { error = ''; }, 5000);
        return;
      }
      
      isLoading = true;
      error = '';
      success = '';
      
      await customerService.deleteCustomer(customer._id);
      success = `Customer ${customer.fullName || customer.customerId} deleted successfully`;
      
      setTimeout(() => {
        success = '';
      }, 3000);
      
      await loadCustomers();
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      error = err.message || 'Failed to delete customer';
      setTimeout(() => {
        error = '';
      }, 5000);
    } finally {
      isLoading = false;
    }
  }
  
  function handleModalClose() {
    showAddModal = false;
    showEditModal = false;
    selectedCustomer = null;
  }

  async function handleCustomerSaved() {
    handleModalClose();
    success = selectedCustomer ? 'Customer updated successfully' : 'Customer created successfully';
    setTimeout(() => {
      success = '';
    }, 3000);
    // Reload customers after a brief delay to ensure backend has processed
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadCustomers();
  }
  
  function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }
  
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active': return 'status-active';
      case 'pending': return 'status-pending';
      case 'suspended': return 'status-suspended';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  }
</script>

<TenantGuard>
  <div class="customers-page">
    <div class="page-header">
      <div class="header-content">
        <div class="header-top">
          <button class="back-btn" on:click={() => goto('/modules')} title="Back to Module Manager">
            ←
          </button>
          <h1>👥 Customer Management</h1>
        </div>
        <p class="subtitle">Manage your tenant's customers, service plans, and customer groups</p>
      </div>
      <div class="header-actions">
        {#if activeTab === 'customers'}
          <ModuleWizardMenu
            wizards={getWizardsForPath('/modules/customers')}
            on:select={(e) => { if (e.detail?.id === 'customer-onboarding') showOnboardingWizard = true; }}
          />
          <button class="btn-primary" on:click={handleAdd}>
            ➕ Add Customer
          </button>
        {:else if activeTab === 'portal'}
          <a href="/modules/customers/portal-setup" class="btn-secondary" title="Customize portal branding, FAQ, alerts, and ticket options">🌐 Customize Portal</a>
          <a href="/modules/customers/portal/login" target="_blank" class="btn-secondary" title="Open Customer Portal">👁️ View Portal</a>
        {/if}
      </div>
    </div>
    
    <!-- Navigation Tabs -->
    <div class="tabs">
      <button 
        class:active={activeTab === 'customers'} 
        on:click={() => activeTab = 'customers'}
      >
        👥 Customers
      </button>
      <button 
        class:active={activeTab === 'service-plans'} 
        on:click={() => activeTab = 'service-plans'}
      >
        📡 Service Plans
      </button>
      <button 
        class:active={activeTab === 'customer-groups'} 
        on:click={() => activeTab = 'customer-groups'}
      >
        📦 Customer Groups
      </button>
      <button 
        class:active={activeTab === 'portal'} 
        on:click={() => activeTab = 'portal'}
      >
        🌐 Portal
      </button>
    </div>
    
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}
    
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}
    
    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'customers'}
        <!-- Customers Tab -->
        <!-- Stats Cards -->
        <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{stats.total}</div>
        <div class="stat-label">Total Customers</div>
      </div>
      <div class="stat-card stat-active">
        <div class="stat-value">{stats.active}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card stat-pending">
        <div class="stat-value">{stats.pending}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card stat-suspended">
        <div class="stat-value">{stats.suspended}</div>
        <div class="stat-label">Suspended</div>
      </div>
    </div>
    
    <!-- Search and Filters -->
    <div class="filters-section">
      <div class="search-bar">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search by name, phone, email, or customer ID..."
          class="search-input"
          on:input={() => {
            // Debounce search to prevent excessive API calls
            if (loadTimeout) clearTimeout(loadTimeout);
            loadTimeout = setTimeout(() => {
              loadCustomers();
            }, 300);
          }}
        />
      </div>
      
      <div class="filter-controls">
        <select bind:value={selectedStatus} on:change={() => loadCustomers()}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
          <option value="trial">Trial</option>
        </select>
        
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={showInactive} on:change={() => loadCustomers()} />
          Show Inactive
        </label>
      </div>
    </div>
    
    <!-- Customer List -->
    <div class="customers-list">
      {#if isLoading}
        <div class="loading">Loading customers...</div>
      {:else if customers.length === 0}
        <div class="empty-state">
          <p>No customers found.</p>
          <button class="btn-primary" on:click={handleAdd}>Add Your First Customer</button>
        </div>
      {:else}
        <div class="customer-grid">
          {#each customers as customer (customer._id || customer.customerId)}
            <div class="customer-card">
              <div class="customer-header">
                <div class="customer-name-section">
                  <h3>{customer.fullName || `${customer.firstName} ${customer.lastName}`}</h3>
                  <span class="customer-id">{customer.customerId}</span>
                </div>
                <span class="status-badge {getStatusBadgeClass(customer.serviceStatus)}">
                  {customer.serviceStatus}
                </span>
              </div>
              
              <div class="customer-details">
                {#if customer.primaryPhone}
                  <div class="detail-row">
                    <span class="detail-icon">📞</span>
                    <span>{formatPhone(customer.primaryPhone)}</span>
                  </div>
                {/if}
                
                {#if customer.email}
                  <div class="detail-row">
                    <span class="detail-icon">📧</span>
                    <span>{customer.email}</span>
                  </div>
                {/if}
                
                {#if customer.serviceAddress?.street}
                  <div class="detail-row">
                    <span class="detail-icon">📍</span>
                    <span>
                      {customer.serviceAddress.street}
                      {#if customer.serviceAddress.city}
                        , {customer.serviceAddress.city}
                      {/if}
                      {#if customer.serviceAddress.state}
                        , {customer.serviceAddress.state}
                      {/if}
                    </span>
                  </div>
                {/if}
                
                {#if customer.servicePlan?.planName}
                  <div class="detail-row">
                    <span class="detail-icon">📡</span>
                    <span>
                      {customer.servicePlan.planName}
                      {#if customer.servicePlan.downloadMbps}
                        ({customer.servicePlan.downloadMbps}/{customer.servicePlan.uploadMbps} Mbps)
                      {/if}
                    </span>
                  </div>
                {/if}
                
                {#if customer.serviceType}
                  <div class="detail-row">
                    <span class="detail-icon">📶</span>
                    <span>Service Type: {customer.serviceType}</span>
                  </div>
                {/if}
                
                {#if customer.networkInfo?.imsi}
                  <div class="detail-row">
                    <span class="detail-icon">🔢</span>
                    <span>IMSI: {customer.networkInfo.imsi}</span>
                  </div>
                {/if}
              </div>
              
              <div class="customer-actions">
                <button class="btn-secondary btn-sm" on:click={() => handleEdit(customer)}>
                  ✏️ Edit
                </button>
                <button class="btn-danger btn-sm" on:click={() => handleDelete(customer)}>
                  🗑️ Delete
                </button>
                <button class="btn-secondary btn-sm" on:click={() => goto(`/modules/customers/${customer._id || customer.customerId}`)}>
                  👁️ View
                </button>
                <button
                  type="button"
                  class="btn-secondary btn-sm"
                  title="Voice & SIP for this customer"
                  on:click={() => goto(`/modules/voice-telephony?customerId=${encodeURIComponent(customer.customerId)}`)}
                >
                  📞 Voice
                </button>
                <a 
                  href="/modules/customers/portal/login" 
                  target="_blank" 
                  class="btn-secondary btn-sm"
                  title="Open Customer Portal"
                >
                  🌐 Portal
                </a>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
      {:else if activeTab === 'service-plans'}
        <!-- Service Plans Tab -->
        <BandwidthPlans {tenantId} {HSS_API} />
      {:else if activeTab === 'customer-groups'}
        <!-- Customer Groups Tab -->
        <GroupManagement {tenantId} {HSS_API} />
      {:else if activeTab === 'portal'}
        <!-- Portal Tab: setup and view customer portal -->
        <div class="portal-tab">
          <div class="portal-tab-header">
            <h2>Customer Portal</h2>
            <p class="portal-tab-desc">The customer portal lets your subscribers log in to view tickets, service status, and support. Use <strong>Customize Portal</strong> to configure branding and options; use <strong>View Portal</strong> to open the portal in a new tab.</p>
          </div>
          <div class="portal-actions">
            <a href="/modules/customers/portal-setup" class="btn-primary" title="Customize portal branding, FAQ, alerts, and ticket options">
              🌐 Customize Portal
            </a>
            <a href="/modules/customers/portal/login" target="_blank" rel="noopener noreferrer" class="btn-secondary" title="Open portal login in new tab">
              👁️ View Portal
            </a>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  {#if showAddModal}
    <AddEditCustomerModal
      show={showAddModal}
      customer={null}
      on:saved={handleCustomerSaved}
      on:close={handleModalClose}
    />
  {/if}
  
  {#if showEditModal && selectedCustomer}
    <AddEditCustomerModal
      show={showEditModal}
      customer={selectedCustomer}
      on:saved={handleCustomerSaved}
      on:close={handleModalClose}
    />
  {/if}

  <CustomerOnboardingWizard
    show={showOnboardingWizard}
    on:close={() => { showOnboardingWizard = false; loadCustomers(); }}
    on:saved={() => loadCustomers()}
  />
</TenantGuard>

<style>
  .customers-page {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }
  
  .header-content {
    flex: 1;
  }
  
  .header-top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .back-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 0.5rem 0.75rem;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-primary);
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
  }
  
  .back-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--brand-primary);
    transform: translateX(-2px);
  }
  
  .header-content h1 {
    margin: 0;
    font-size: 2rem;
    color: var(--text-primary);
  }
  
  .subtitle {
    margin: 0.5rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  
  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  .alert {
    padding: 1rem;
    border-radius: var(--border-radius);
    margin-bottom: 1rem;
  }
  
  .alert-error {
    background: var(--danger-light, #fee);
    color: var(--danger, #c00);
    border: 1px solid var(--danger);
  }
  
  .alert-success {
    background: var(--success-light, #d4edda);
    color: var(--success, #155724);
    border: 1px solid var(--success);
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    text-align: center;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .stat-label {
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-active {
    border-color: var(--success);
    background: var(--success-light, #d4edda20);
  }
  
  .stat-pending {
    border-color: var(--warning);
    background: var(--warning-light, #fff3cd20);
  }
  
  .stat-suspended {
    border-color: var(--danger);
    background: var(--danger-light, #f8d7da20);
  }
  
  .filters-section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .search-bar {
    flex: 1;
    min-width: 300px;
  }
  
  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 1rem;
  }
  
  .filter-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .filter-controls select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background: var(--card-bg);
    color: var(--text-primary);
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .billing-admin-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }
  .billing-action-msg {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  .billing-tab {
    padding: 1rem 0;
  }
  .billing-tab-header {
    margin-bottom: 1.5rem;
  }
  .billing-tab-desc {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
    max-width: 640px;
  }
  .billing-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .billing-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    flex-wrap: wrap;
  }
  .billing-name {
    flex: 1;
    min-width: 140px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .billing-id {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  .portal-tab {
    padding: 1rem 0;
  }
  .portal-tab-header {
    margin-bottom: 1.5rem;
  }
  .portal-tab-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--text-primary);
  }
  .portal-tab-desc {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
    max-width: 640px;
  }
  .portal-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .portal-actions a {
    text-decoration: none;
  }
  .empty-sub {
    margin: 0.5rem 0 0 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
  }
  
  .customer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }
  
  .customer-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 1.5rem;
    transition: var(--transition);
  }
  
  .customer-card:hover {
    border-color: var(--brand-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  
  .customer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .customer-name-section h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }
  
  .customer-id {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-active {
    background: var(--success-light, #d4edda);
    color: var(--success, #155724);
  }
  
  .status-pending {
    background: var(--warning-light, #fff3cd);
    color: var(--warning, #856404);
  }
  
  .status-suspended {
    background: var(--danger-light, #f8d7da);
    color: var(--danger, #721c24);
  }
  
  .status-cancelled {
    background: #e9ecef;
    color: #495057;
  }
  
  .customer-details {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .detail-icon {
    font-size: 1rem;
  }
  
  .customer-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .btn-secondary,
  .btn-danger {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius);
    font-size: 0.85rem;
    cursor: pointer;
    transition: var(--transition);
    text-decoration: none;
    display: inline-block;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  a.btn-secondary {
    text-decoration: none;
  }
  
  .header-actions .btn-secondary {
    padding: 0.75rem 1.5rem;
  }
  
  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }
  
  .btn-danger {
    background: var(--danger);
    color: white;
  }
  
  .btn-danger:hover {
    background: var(--danger-dark, #c82333);
  }
  
  .btn-sm {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }
  
  /* Tabs */
  .tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 2rem;
    overflow-x: auto;
  }
  
  .tabs button {
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text-secondary);
    transition: all 0.2s;
    white-space: nowrap;
  }
  
  .tabs button:hover {
    color: var(--brand-primary);
    background: var(--bg-secondary);
  }
  
  .tabs button.active {
    color: var(--brand-primary);
    border-bottom-color: var(--brand-primary);
    font-weight: 600;
  }
  
  .tab-content {
    animation: fadeIn 0.3s;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @media (max-width: 768px) {
    .tabs {
      padding-bottom: 0.5rem;
    }
    
    .tabs button {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }
  }
</style>