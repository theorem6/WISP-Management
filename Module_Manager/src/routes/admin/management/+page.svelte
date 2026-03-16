<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isPlatformAdmin } from '$lib/services/adminService';
  import { getAllUsers } from '$lib/services/userManagementService';
  import { tenantService } from '$lib/services/tenantService';
  import { auth } from '$lib/firebase';

  interface AdminFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    path: string;
    adminOnly?: boolean;
  }

  const adminFeatures: AdminFeature[] = [
    {
      id: 'tenant-management',
      name: 'Tenant Management',
      description: 'Create, configure, and manage organization tenants',
      icon: '🏢',
      path: '/admin/tenant-management'
    },
    {
      id: 'system-settings',
      name: 'System Settings',
      description: 'Configure system-wide settings and preferences',
      icon: '⚙️',
      path: '/modules/backend-management'
    }
  ];

  let isAdmin = false;
  let currentUser: any = null;
  
  // Live status data
  let systemStatus = {
    health: 'checking',
    healthMessage: 'Checking system status...',
    activeTenants: 0,
    totalUsers: 0,
    databaseStatus: 'checking',
    databaseMessage: 'Checking database connection...'
  };
  
  let statusLoading = true;
  let statusError = '';
  let statusUpdateInterval: NodeJS.Timeout | null = null;
  
  // Remote agents status
  let remoteAgents: any[] = [];
  let loadingAgents = false;
  let agentsError = '';

  onMount(async () => {
    if (!browser) return;
    
    // Wait a bit for auth state to be ready after page refresh
    await new Promise(resolve => setTimeout(resolve, 100));
    
    currentUser = await authService.getCurrentUser();
    
    if (!currentUser) {
      // Not authenticated - redirect to login
      goto('/login', { replaceState: true });
      return;
    }
    
    isAdmin = isPlatformAdmin(currentUser?.email || null);
    
    if (!isAdmin) {
      // Not admin - redirect to dashboard
      goto('/dashboard', { replaceState: true });
      return;
    }
    
    // Only load status if admin
    await loadSystemStatus();
    await loadAllRemoteAgents();
    // Update status every 30 seconds
    statusUpdateInterval = setInterval(() => {
      loadSystemStatus();
      loadAllRemoteAgents();
    }, 30000);
  });

  onDestroy(() => {
    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
    }
  });

  async function loadSystemStatus() {
    if (!isAdmin) return;
    
    try {
      statusLoading = true;
      statusError = '';
      
      // Load tenants and users in parallel
      // Wrap in Promise.allSettled to prevent one failure from blocking the other
      const [tenantsResult, usersResult] = await Promise.allSettled([
        tenantService.getAllTenants(),
        getAllUsers()
      ]);
      
      const tenants = tenantsResult.status === 'fulfilled' ? tenantsResult.value : [];
      const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
      
      // Log errors and set user-friendly message for 401 (backend auth not configured)
      if (tenantsResult.status === 'rejected') {
        const err = tenantsResult.reason;
        console.error('[Admin Management] Error loading tenants:', err);
        const msg = String(err?.message || err);
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          statusError = 'Backend authentication not configured. The server cannot verify your login. Run set-firebase-admin-on-gce.ps1 and ensure PLATFORM_ADMIN_EMAILS includes your email.';
        } else {
          statusError = (err as Error)?.message || 'Failed to load tenants';
        }
      }
      if (usersResult.status === 'rejected') {
        console.error('[Admin Management] Error loading users:', usersResult.reason);
        if (!statusError) {
          statusError = (usersResult.reason as Error)?.message || 'Failed to load users';
        }
      }
      
      // Update system status
      systemStatus = {
        health: 'operational',
        healthMessage: 'All systems operational',
        activeTenants: tenants.length,
        totalUsers: users.length,
        databaseStatus: 'connected',
        databaseMessage: 'MongoDB Atlas connected'
      };
      
    } catch (error: any) {
      console.error('Error loading system status:', error);
      statusError = error.message || 'Failed to load system status';
      
      // Set error status
      systemStatus = {
        health: 'error',
        healthMessage: 'System status unavailable',
        activeTenants: 0,
        totalUsers: 0,
        databaseStatus: 'error',
        databaseMessage: 'Database connection failed'
      };
    } finally {
      statusLoading = false;
    }
  }

  function handleFeatureClick(feature: AdminFeature) {
    goto(feature.path);
  }

  // No back button needed - this is the main admin page
  
  async function handleLogout() {
    try {
      await authService.signOut();
      
      // Clear all localStorage data
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      localStorage.removeItem('tenantSetupCompleted');
      
      // Redirect to login
      goto('/login', { replaceState: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async function getAuthHeaders(requestPath?: string) {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    const token = await currentUser.getIdToken();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    if (requestPath) headers['X-Requested-Path'] = requestPath;
    return headers;
  }

  async function loadAllRemoteAgents() {
    if (!isAdmin) return;
    
    try {
      loadingAgents = true;
      agentsError = '';
      remoteAgents = [];

      const path = '/api/remote-agents/status';
      const headers = await getAuthHeaders(path);

      // System-wide query - get ALL agents (assigned and unassigned) in one call
      // No tenant header needed - backend returns everything for admin/system queries
      const response = await fetch(path, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.agents && Array.isArray(data.agents)) {
          // Get all tenants to map tenant_id to tenant names
          const tenants = await tenantService.getAllTenants();
          const tenantMap = new Map(tenants.map(t => [t.id, t.displayName || t.name]));

          // Add tenant names to agents
          remoteAgents = data.agents.map((agent: any) => ({
            ...agent,
            tenant_name: agent.tenant_id 
              ? (tenantMap.get(agent.tenant_id) || agent.tenant_id || 'Unknown')
              : 'Unassigned'
          })).sort((a, b) => {
            // Sort by last check-in (most recent first)
            const aTime = a.last_checkin || a.discovered_at || 0;
            const bTime = b.last_checkin || b.discovered_at || 0;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
        } else {
          remoteAgents = [];
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.error('Error loading remote agents:', err);
      agentsError = err.message || 'Failed to load remote agents';
      remoteAgents = [];
    } finally {
      loadingAgents = false;
    }
  }

  function formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  function formatTimeAgo(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return 'N/A';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getFirstCheckin(agent: any): string {
    if (agent.type === 'epc_agent') {
      return agent.created_at ? formatDate(agent.created_at) : 'N/A';
    } else {
      return agent.discovered_at ? formatDate(agent.discovered_at) : 'N/A';
    }
  }
</script>

<div class="admin-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <div class="module-title">
          <h1>⚙️ Admin Management</h1>
          <p>User and tenant management for owners and administrators</p>
        </div>
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">Platform Admin</span>
            <button class="logout-btn" onclick={handleLogout} title="Logout">
              🚪 Logout
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="module-content">
      <!-- Overview -->
      <div class="overview-section">
        <h2>Administration Overview</h2>
        <p>The Admin Management module provides comprehensive tools for managing users, tenants, system settings, and billing. This module is only accessible to platform owners and administrators.</p>
      </div>

      <!-- Features Grid -->
      <div class="features-section">
        <h2>Administration Features</h2>
        <div class="features-grid">
          {#each adminFeatures as feature}
            <div 
              class="feature-card" 
              onclick={() => handleFeatureClick(feature)}
              onkeydown={(e) => e.key === 'Enter' && handleFeatureClick(feature)}
              role="button"
              tabindex="0"
            >
              <div class="feature-icon">{feature.icon}</div>
              <div class="feature-info">
                <h3 class="feature-name">{feature.name}</h3>
                <p class="feature-description">{feature.description}</p>
              </div>
              <div class="feature-arrow">→</div>
            </div>
          {/each}
        </div>
      </div>

      <!-- System Status -->
      <div class="system-status">
        <h2>System Status</h2>
        {#if statusError}
          <div class="status-error">
            <p>⚠️ {statusError}</p>
            <button class="retry-btn" onclick={loadSystemStatus}>Retry</button>
          </div>
        {/if}
        <div class="status-grid">
          <div class="status-card">
            <div class="status-icon {systemStatus.health}">
              {#if systemStatus.health === 'operational'}
                🟢
              {:else if systemStatus.health === 'error'}
                🔴
              {:else}
                🟡
              {/if}
            </div>
            <div class="status-info">
              <h4>System Health</h4>
              <p>{systemStatus.healthMessage}</p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">📊</div>
            <div class="status-info">
              <h4>Active Tenants</h4>
              <p>
                {#if statusLoading}
                  Loading...
                {:else}
                  {systemStatus.activeTenants} tenant{systemStatus.activeTenants !== 1 ? 's' : ''} active
                {/if}
              </p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon">👥</div>
            <div class="status-info">
              <h4>Total Users</h4>
              <p>
                {#if statusLoading}
                  Loading...
                {:else}
                  {systemStatus.totalUsers} users across all tenants
                {/if}
              </p>
            </div>
          </div>
          <div class="status-card">
            <div class="status-icon {systemStatus.databaseStatus}">
              {#if systemStatus.databaseStatus === 'connected'}
                💾
              {:else if systemStatus.databaseStatus === 'error'}
                ⚠️
              {:else}
                🔄
              {/if}
            </div>
            <div class="status-info">
              <h4>Database</h4>
              <p>{systemStatus.databaseMessage}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Remote Agents Status Section -->
      <div class="remote-agents-section">
        <div class="section-header">
          <h2>📡 Remote Agents Status</h2>
          <button class="refresh-btn" onclick={loadAllRemoteAgents} disabled={loadingAgents}>
            {loadingAgents ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {#if loadingAgents && remoteAgents.length === 0}
          <div class="loading-state">
            <p>Loading remote agents...</p>
          </div>
        {:else if agentsError}
          <div class="error-state">
            <p>⚠️ {agentsError}</p>
            <button class="retry-btn" onclick={loadAllRemoteAgents}>Retry</button>
          </div>
        {:else if remoteAgents.length === 0}
          <div class="empty-state">
            <p>No remote agents found across all tenants.</p>
          </div>
        {:else}
          <div class="agents-summary">
            <p><strong>{remoteAgents.length}</strong> remote agent{remoteAgents.length !== 1 ? 's' : ''} checking in system-wide</p>
          </div>
          <div class="agents-table-container">
            <table class="agents-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Name/Code</th>
                  <th>First Check-in</th>
                  <th>Last Check-in</th>
                  <th>Status</th>
                  <th>Hardware Linked</th>
                </tr>
              </thead>
              <tbody>
                {#each remoteAgents as agent (agent.epc_id || agent.device_id)}
                  <tr>
                    <td>
                      <strong>{agent.tenant_name || agent.tenant_id || 'Unknown'}</strong>
                    </td>
                    <td>
                      <span class="agent-type-badge type-{agent.type}">
                        {agent.type === 'epc_agent' ? 'EPC' : 'SNMP'}
                      </span>
                    </td>
                    <td>
                      <code>{agent.epc_id || agent.device_id || 'N/A'}</code>
                    </td>
                    <td>
                      {agent.type === 'epc_agent' 
                        ? (agent.device_code || agent.site_name || 'N/A')
                        : (agent.name || agent.ip_address || 'N/A')}
                    </td>
                    <td>{getFirstCheckin(agent)}</td>
                    <td>
                      {agent.type === 'epc_agent' 
                        ? (agent.last_checkin ? formatDate(agent.last_checkin) : 'Never')
                        : (agent.discovered_at ? formatDate(agent.discovered_at) : 'N/A')}
                      {#if agent.time_since_checkin !== null && agent.time_since_checkin !== undefined}
                        <br>
                        <small class="time-ago">{formatTimeAgo(agent.time_since_checkin)}</small>
                      {/if}
                    </td>
                    <td>
                      <span class="status-badge status-{agent.checkin_status || agent.status}">
                        {agent.type === 'epc_agent' 
                          ? (agent.checkin_status || agent.status || 'unknown')
                          : (agent.status || 'discovered')}
                      </span>
                    </td>
                    <td>
                      {#if agent.hardware_linked}
                        <span class="linked-badge linked">✓ Linked</span>
                        {#if agent.hardware_link_type}
                          <br><small>({agent.hardware_link_type})</small>
                        {/if}
                      {:else}
                        <span class="linked-badge unlinked">✗ Unlinked</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
      </div>
    </div>
  
  <style>
  .admin-module {
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .module-header {
    background: var(--card-bg);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 0;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .back-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: var(--transition);
    color: var(--text-primary);
  }

  .back-btn:hover {
    background: var(--hover-bg);
    border-color: var(--primary-color);
  }

  .back-icon {
    font-size: 1.25rem;
  }

  .module-title {
    text-align: center;
    flex: 1;
  }

  .module-title h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .module-title p {
    color: var(--text-secondary);
    margin: 0.25rem 0 0 0;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .user-role {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .logout-btn {
    margin-top: 0.5rem;
    background: var(--danger-color, #dc2626);
    color: white;
    border: none;
    border-radius: var(--radius-sm, 0.375rem);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition, all 0.2s);
  }

  .logout-btn:hover {
    background: var(--danger-dark, #b91c1c);
    transform: translateY(-1px);
  }

  .module-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .overview-section {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-sm);
  }

  .overview-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .overview-section p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .features-section {
    margin-bottom: 2rem;
  }

  .features-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    cursor: pointer;
    transition: var(--transition);
    border: 2px solid transparent;
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
  }

  .feature-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .feature-info {
    flex: 1;
  }

  .feature-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .feature-description {
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .feature-arrow {
    font-size: 1.5rem;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .system-status {
    margin-bottom: 2rem;
  }

  .system-status h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .status-card {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: var(--transition);
  }

  .status-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .status-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .status-icon.operational {
    color: var(--success-color);
  }

  .status-icon.error {
    color: var(--danger-color);
  }

  .status-icon.checking {
    color: var(--warning-color);
  }

  .status-icon.connected {
    color: var(--success-color);
  }

  .status-info h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .status-info p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .status-error {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    border-radius: var(--radius-md);
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .status-error p {
    margin: 0;
    color: var(--danger-dark, #991b1b);
    font-weight: 500;
  }

  .retry-btn {
    background: var(--danger-color);
    color: var(--text-inverse);
    border: none;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
  }

  .retry-btn:hover {
    background: var(--danger-hover);
    transform: translateY(-1px);
  }

  .remote-agents-section {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    padding: 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-sm);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border-color);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .refresh-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .agents-summary {
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }

  .agents-table-container {
    overflow-x: auto;
  }

  .agents-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .agents-table th {
    background: var(--bg-secondary);
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid var(--border-color);
    position: sticky;
    top: 0;
    color: var(--text-primary);
  }

  .agents-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .agents-table tbody tr:hover {
    background: var(--hover-bg);
  }

  .agent-type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .type-epc_agent {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .type-snmp_device {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  code {
    background: var(--code-bg, rgba(0, 0, 0, 0.1));
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .time-ago {
    color: var(--text-secondary);
    font-size: 0.75rem;
  }

  .linked-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .linked-badge.linked {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .linked-badge.unlinked {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-active {
    background: var(--success-light);
    color: var(--success-dark, #065f46);
  }

  .status-recent {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .status-stale {
    background: var(--warning-light);
    color: var(--warning-dark, #92400e);
  }

  .status-offline {
    background: var(--danger-light);
    color: var(--danger-dark, #991b1b);
  }

  .status-never {
    background: var(--text-secondary);
    color: var(--text-inverse);
  }

  .loading-state, .empty-state, .error-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .error-state {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    border-radius: var(--radius-md);
    color: var(--danger-dark, #991b1b);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .module-title h1 {
      font-size: 1.5rem;
    }

    .module-content {
      padding: 1rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }

    .status-grid {
      grid-template-columns: 1fr;
    }

    .agents-table-container {
      font-size: 0.75rem;
    }

    .agents-table th,
    .agents-table td {
      padding: 0.5rem;
    }
  }
</style>