<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { goto } from '$app/navigation';
  import AdminBreadcrumb from '$lib/components/admin/AdminBreadcrumb.svelte';
  import { isCurrentUserPlatformAdmin, isPlatformAdminByUid } from '$lib/services/adminService';
  import { getAdminApiRequest, getBackendDirectBase } from '$lib/config/api';

  let loading = true;
  let error = '';
  let tenants: any[] = [];
  
  // Modals
  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let showAssignOwnerModal = false;
  let showUsersModal = false;
  
  let selectedTenant: any = null;
  let processing = false;
  let tenantUsers: any[] = [];
  let loadingUsers = false;
  
  // Form data for create/edit
  let formData = {
    name: '',
    displayName: '',
    contactEmail: '',
    subdomain: ''
  };
  
  let newOwnerEmail = '';
  
  onMount(async () => {
    // Check if user is platform admin (by UID)
    const user = auth().currentUser;
    if (!user) {
      error = 'Please log in to access this page.';
      loading = false;
      return;
    }
    
    const isAdmin = isPlatformAdminByUid(user.uid) || await isCurrentUserPlatformAdmin();
    if (!isAdmin) {
      error = 'Access denied. Platform admin only.';
      loading = false;
      return;
    }
    
    await loadTenants();
  });
  
  async function getAuthHeaders() {
    const user = auth().currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await authService.getAuthTokenForApi();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /** Adds X-Requested-Path when using apiProxy (?path=). */
  async function getAuthHeadersAdmin(logicalPath?: string) {
    const base = await getAuthHeaders();
    if (logicalPath && !getBackendDirectBase()) {
      return { ...base, 'X-Requested-Path': logicalPath };
    }
    return base;
  }
  
  async function loadTenants() {
    loading = true;
    error = '';
    
    try {
      const { url, logicalPath } = getAdminApiRequest('tenants');
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const err = new Error(response.status === 401 
          ? 'Backend authentication not configured. Run set-firebase-admin-on-gce.ps1 and ensure PLATFORM_ADMIN_EMAILS includes your email.'
          : 'Failed to load tenants');
        (err as Error & { status?: number }).status = response.status;
        throw err;
      }
      
      tenants = await response.json();
      console.log('Loaded tenants:', tenants);
    } catch (err: any) {
      error = err.message || 'Failed to load tenants';
      if (err?.status === 401) {
        error = 'Backend authentication not configured. Run set-firebase-admin-on-gce.ps1 and ensure PLATFORM_ADMIN_EMAILS includes your email.';
      }
      console.error('Error loading tenants:', err);
    } finally {
      loading = false;
    }
  }
  
  // Create Tenant
  function openCreateModal() {
    formData = {
      name: '',
      displayName: '',
      contactEmail: '',
      subdomain: ''
    };
    showCreateModal = true;
  }
  
  async function createTenant() {
    if (!formData.name || !formData.displayName || !formData.contactEmail) {
      alert('Please fill in all required fields');
      return;
    }
    
    processing = true;
    
    try {
      const { url, logicalPath } = getAdminApiRequest('tenants');
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create tenant');
      }
      
      alert('✅ Tenant created successfully! The contact email will be assigned as the owner.');
      showCreateModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error creating tenant:', err);
    } finally {
      processing = false;
    }
  }
  
  // Edit Tenant
  function openEditModal(tenant: any) {
    selectedTenant = tenant;
    formData = {
      name: tenant.name,
      displayName: tenant.displayName,
      contactEmail: tenant.contactEmail,
      subdomain: tenant.subdomain
    };
    showEditModal = true;
  }
  
  async function updateTenant() {
    if (!selectedTenant) return;
    
    processing = true;
    
    try {
      const { url, logicalPath } = getAdminApiRequest(`tenants/${selectedTenant.id}`);
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update tenant');
      }
      
      alert('✅ Tenant updated successfully!');
      showEditModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error updating tenant:', err);
    } finally {
      processing = false;
    }
  }
  
  // Delete Tenant
  function openDeleteModal(tenant: any) {
    selectedTenant = tenant;
    showDeleteModal = true;
  }
  
  async function deleteTenant() {
    if (!selectedTenant) return;
    
    processing = true;
    
    try {
      const { url, logicalPath } = getAdminApiRequest(`tenants/${selectedTenant.id}`);
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete tenant');
      }
      
      alert('✅ Tenant deleted successfully!');
      showDeleteModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error deleting tenant:', err);
    } finally {
      processing = false;
    }
  }
  
  // Assign Owner
  function openAssignOwnerModal(tenant: any) {
    selectedTenant = tenant;
    newOwnerEmail = '';
    showAssignOwnerModal = true;
  }
  
  async function assignOwner() {
    if (!selectedTenant || !newOwnerEmail.trim()) {
      alert('Please enter an email address');
      return;
    }
    
    processing = true;
    
    try {
      const { url, logicalPath } = getAdminApiRequest('assign-owner');
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          email: newOwnerEmail.trim()
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to assign owner');
      }
      
      const result = await response.json();
      alert(`✅ ${result.message}`);
      showAssignOwnerModal = false;
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error assigning owner:', err);
    } finally {
      processing = false;
    }
  }
  
  // Toggle tenant status (enable/disable)
  async function toggleTenantStatus(tenant: any, enabled: boolean) {
    if (!tenant) return;
    
    processing = true;
    
    try {
      const { url, logicalPath } = getAdminApiRequest(`tenants/${tenant.id}`);
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          status: enabled ? 'active' : 'suspended'
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update tenant status');
      }
      
      // Update local state
      tenant.status = enabled ? 'active' : 'suspended';
      await loadTenants();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
      console.error('Error toggling tenant status:', err);
      // Reload to reset UI state
      await loadTenants();
    } finally {
      processing = false;
    }
  }
  
  // View tenant users
  async function openUsersModal(tenant: any) {
    selectedTenant = tenant;
    showUsersModal = true;
    loadingUsers = true;
    tenantUsers = [];
    
    try {
      const { url, logicalPath } = getAdminApiRequest(`tenants/${tenant.id}/users`);
      const headers = await getAuthHeadersAdmin(logicalPath);
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      
      tenantUsers = await response.json();
    } catch (err: any) {
      console.error('Error loading tenant users:', err);
      alert(`Failed to load users: ${err.message}`);
    } finally {
      loadingUsers = false;
    }
  }
  
  function closeModals() {
    showCreateModal = false;
    showEditModal = false;
    showDeleteModal = false;
    showAssignOwnerModal = false;
    showUsersModal = false;
    selectedTenant = null;
    tenantUsers = [];
  }
</script>

<div class="admin-page">
  <header>
    <AdminBreadcrumb items={[{ label: 'Tenant Management' }]} />
    <div class="header-content">
      <div class="header-title">
        <h1>🏢 Platform Admin - Tenant Management</h1>
        <p>Create and manage organization tenants</p>
      </div>
      <button class="btn-create" on:click={openCreateModal}>
        ➕ Create New Tenant
      </button>
    </div>
  </header>
  
  <main>
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading tenants...</p>
      </div>
    {:else if error}
      <div class="error-banner">
        ❌ {error}
      </div>
    {:else if tenants.length === 0}
      <div class="empty-state">
        <p>📭 No tenants found</p>
        <button class="btn-primary" on:click={openCreateModal}>Create First Tenant</button>
      </div>
    {:else}
      <div class="tenants-grid">
        {#each tenants as tenant}
          <div class="tenant-card">
            <div class="tenant-header">
              <h3>{tenant.displayName || tenant.name}</h3>
              <span class="tenant-status" class:active={tenant.status === 'active'}>
                {tenant.status || 'active'}
              </span>
            </div>
            
            <div class="tenant-details">
              <div class="detail-row">
                <span class="label">Organization Name:</span>
                <span class="value">{tenant.name}</span>
              </div>
              <div class="detail-row">
                <span class="label">Subdomain:</span>
                <span class="value monospace">{tenant.subdomain}</span>
              </div>
              <div class="detail-row">
                <span class="label">Contact Email:</span>
                <span class="value">{tenant.contactEmail}</span>
              </div>
              <div class="detail-row">
                <span class="label">Created:</span>
                <span class="value">{new Date(tenant.createdAt).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Users:</span>
                <span class="value">{tenant.userCount || 0}</span>
              </div>
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value">
                  <label class="status-toggle">
                    <input 
                      type="checkbox" 
                      checked={tenant.status === 'active'} 
                      on:change={(e) => toggleTenantStatus(tenant, e.currentTarget.checked)}
                      disabled={processing}
                    />
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">{tenant.status === 'active' ? 'Active' : 'Suspended'}</span>
                  </label>
                </span>
              </div>
            </div>
            
            <div class="tenant-actions">
              <button class="btn-action btn-users" on:click={() => openUsersModal(tenant)}>
                👥 View Users ({tenant.userCount || 0})
              </button>
              <button class="btn-action btn-owner" on:click={() => openAssignOwnerModal(tenant)}>
                👤 Assign Owner
              </button>
              <button class="btn-action btn-edit" on:click={() => openEditModal(tenant)}>
                ✏️ Edit
              </button>
              <button class="btn-action btn-delete" on:click={() => openDeleteModal(tenant)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{showCreateModal ? '➕ Create New Tenant' : '✏️ Edit Tenant'}</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>Organization Name <span class="required">*</span></label>
          <input 
            type="text" 
            bind:value={formData.name} 
            placeholder="e.g., acme-wireless"
            disabled={processing}
          />
          <small>Used internally, lowercase with hyphens</small>
        </div>
        
        <div class="form-group">
          <label>Display Name <span class="required">*</span></label>
          <input 
            type="text" 
            bind:value={formData.displayName} 
            placeholder="e.g., Acme Wireless Corp"
            disabled={processing}
          />
          <small>Friendly name shown in the UI</small>
        </div>
        
        <div class="form-group">
          <label>Contact Email (Owner) <span class="required">*</span></label>
          <input 
            type="email" 
            bind:value={formData.contactEmail} 
            placeholder="admin@example.com"
            disabled={processing}
          />
          <small>This person will be assigned as the tenant owner</small>
        </div>
        
        <div class="form-group">
          <label>Subdomain</label>
          <input 
            type="text" 
            bind:value={formData.subdomain} 
            placeholder="Auto-generated from name"
            disabled={processing}
          />
          <small>Leave blank to auto-generate</small>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals} disabled={processing}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          on:click={showCreateModal ? createTenant : updateTenant} 
          disabled={processing || !formData.name || !formData.displayName || !formData.contactEmail}
        >
          {processing ? 'Processing...' : (showCreateModal ? 'Create Tenant' : 'Update Tenant')}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedTenant}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content modal-danger" on:click|stopPropagation>
      <div class="modal-header">
        <h2>🗑️ Delete Tenant</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        <p><strong>⚠️ Warning:</strong> This action cannot be undone!</p>
        <p>Are you sure you want to delete the tenant:</p>
        <p class="tenant-name-delete"><strong>{selectedTenant.displayName}</strong></p>
        <p>All associated users, data, and configurations will be removed.</p>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals} disabled={processing}>
          Cancel
        </button>
        <button class="btn-danger" on:click={deleteTenant} disabled={processing}>
          {processing ? 'Deleting...' : 'Delete Tenant'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Assign Owner Modal -->
{#if showAssignOwnerModal && selectedTenant}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>👤 Assign/Change Owner</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        <p><strong>Tenant:</strong> {selectedTenant.displayName}</p>
        <p class="help-text">
          Enter the email address of the user who should be the owner of this tenant.
          The user must already have a Firebase account.
        </p>
        
        <div class="form-group">
          <label>Owner Email Address <span class="required">*</span></label>
          <input 
            type="email" 
            bind:value={newOwnerEmail} 
            placeholder="user@example.com"
            disabled={processing}
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals} disabled={processing}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          on:click={assignOwner} 
          disabled={processing || !newOwnerEmail.trim()}
        >
          {processing ? 'Assigning...' : 'Assign Owner'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Users Modal -->
{#if showUsersModal && selectedTenant}
  <div class="modal-overlay" on:click={closeModals}>
    <div class="modal-content modal-large" on:click|stopPropagation>
      <div class="modal-header">
        <h2>👥 Users in {selectedTenant.displayName}</h2>
        <button class="close-btn" on:click={closeModals}>✕</button>
      </div>
      
      <div class="modal-body">
        {#if loadingUsers}
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading users...</p>
          </div>
        {:else if tenantUsers.length === 0}
          <div class="empty-state">
            <p>No users found for this tenant</p>
          </div>
        {:else}
          <div class="users-list">
            {#each tenantUsers as user}
              <div class="user-item">
                <div class="user-info">
                  <div class="user-name">{user.displayName || 'No name'}</div>
                  <div class="user-email">{user.email}</div>
                </div>
                <div class="user-role-badge badge-{user.role}">
                  {user.role}
                </div>
                <div class="user-status-badge badge-{user.status}">
                  {user.status}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals}>
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-page {
    min-height: 100vh;
    background: var(--bg-primary);
  }
  
  header {
    background: var(--card-bg);
    border-bottom: 2px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }
  
  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;
  }
  
  /* Removed .back-btn styles - using breadcrumb instead */
  
  .header-title {
    flex: 1;
  }
  
  .header-title h1 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.6rem;
  }
  
  .header-title p {
    margin: 0.25rem 0 0 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .btn-create {
    background: var(--success-color);
    color: var(--text-inverse);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
  }
  
  .btn-create:hover {
    background: var(--success-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .loading, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
  }
  
  .loading {
    color: var(--text-secondary);
  }
  
  .spinner {
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem auto;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-banner {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
    padding: 1.5rem;
    border-radius: var(--border-radius-lg);
    border-left: 4px solid var(--danger-color);
    font-weight: 500;
  }
  
  .tenants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }
  
  .tenant-card {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border: 1px solid var(--border-color);
  }
  
  .tenant-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  
  .tenant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }
  
  .tenant-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.25rem;
  }
  
  .tenant-status {
    padding: 0.25rem 0.75rem;
    border-radius: var(--border-radius-md);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }
  
  .tenant-status.active {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }
  
  .tenant-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
  }
  
  .detail-row .label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .detail-row .value {
    color: var(--text-primary);
    text-align: right;
  }
  
  .monospace {
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
  }
  
  .tenant-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }
  
  .btn-action {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: var(--transition);
  }
  
  .btn-owner {
    background: var(--info-light);
    color: var(--info-dark, #1e40af);
  }
  
  .btn-owner:hover {
    background: var(--info-color);
    color: var(--text-inverse);
  }
  
  .btn-edit {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }
  
  .btn-edit:hover {
    background: var(--warning-color);
    color: var(--text-inverse);
  }
  
  .btn-delete {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }
  
  .btn-delete:hover {
    background: var(--danger-color);
    color: var(--text-inverse);
  }
  
  .btn-users {
    background: var(--primary-light);
    color: var(--primary-dark, #1e40af);
  }
  
  .btn-users:hover {
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  
  /* Status Toggle */
  .status-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  
  .status-toggle input[type="checkbox"] {
    display: none;
  }
  
  .toggle-slider {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--border-color);
    border-radius: 12px;
    transition: background var(--transition);
  }
  
  .toggle-slider::before {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--text-inverse);
    top: 2px;
    left: 2px;
    transition: transform var(--transition);
    box-shadow: var(--shadow-xs);
  }
  
  .status-toggle input[type="checkbox"]:checked + .toggle-slider {
    background: var(--success-color);
  }
  
  .status-toggle input[type="checkbox"]:checked + .toggle-slider::before {
    transform: translateX(20px);
  }
  
  .toggle-label {
    font-weight: 500;
    color: var(--text-primary);
  }
  
  /* Users Modal */
  .modal-large {
    max-width: 800px;
  }
  
  .users-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .user-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }
  
  .user-info {
    flex: 1;
  }
  
  .user-name {
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
  
  .user-email {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .user-role-badge,
  .user-status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .badge-owner { background: var(--primary-light, rgba(59, 130, 246, 0.1)); color: var(--primary-dark, #1e40af); }
  .badge-admin { background: var(--secondary-light, rgba(107, 114, 128, 0.1)); color: var(--secondary-dark, #374151); }
  .badge-engineer { background: var(--info-light, rgba(59, 130, 246, 0.1)); color: var(--info-dark, #1e40af); }
  .badge-installer { background: var(--warning-light); color: var(--warning-dark, #92400e); }
  .badge-helpdesk { background: var(--success-light); color: var(--success-dark, #065f46); }
  .badge-viewer { background: var(--bg-secondary); color: var(--text-primary); }
  
  .badge-active { background: var(--success-light); color: var(--success-dark, #065f46); }
  .badge-suspended { background: var(--danger-light); color: var(--danger-dark, #991b1b); }
  .badge-pending_invitation { background: var(--warning-light); color: var(--warning-dark, #92400e); }
  
  /* Modal styles */
  .modal-overlay {
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
    padding: var(--spacing-md);
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
  }
  
  .modal-danger {
    border-top: 4px solid var(--danger-color);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-sm);
    transition: var(--transition);
  }
  
  .close-btn:hover {
    background: var(--bg-secondary);
  }
  
  .modal-body {
    padding: var(--spacing-lg);
  }
  
  .modal-body p {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }
  
  .tenant-name-delete {
    font-size: 1.1rem;
    color: var(--danger-color);
    text-align: center;
    padding: var(--spacing-md);
    background: var(--danger-light);
    border-radius: var(--border-radius-md);
  }
  
  .help-text {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .required {
    color: var(--danger-color);
  }
  
  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    font-size: 1rem;
    background: var(--input-bg);
    color: var(--text-primary);
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  
  .form-group input:disabled {
    background: var(--bg-secondary);
    cursor: not-allowed;
  }
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }
  
  .btn-primary, .btn-secondary, .btn-danger {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: var(--transition);
  }
  
  .btn-primary {
    background: var(--primary-color);
    color: var(--text-inverse);
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }
  
  .btn-danger {
    background: var(--danger-color);
    color: var(--text-inverse);
  }
  
  .btn-danger:hover:not(:disabled) {
    background: var(--danger-hover);
  }
  
  .empty-state .btn-primary {
    margin-top: 1rem;
  }
  
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
    }
    
    .btn-create {
      width: 100%;
    }
    
    .tenants-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
