<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { tenantStore, currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { isCurrentUserPlatformAdmin, isPlatformAdminByUid, getCurrentUserUid, isPlatformAdmin } from '$lib/services/adminService';
  import GlobalSettings from '$lib/components/GlobalSettings.svelte';
  import NotificationCenter from '$lib/components/common/NotificationCenter.svelte';
  import FirstTimeSetupWizard from '$lib/components/wizards/FirstTimeSetupWizard.svelte';
  import TipsModal from '$lib/components/modals/TipsModal.svelte';
  import { API_CONFIG } from '$lib/config/api';
  import { getModuleTips, FIELD_APP_DOWNLOAD_PLACEHOLDER } from '$lib/config/moduleTips';
  import { tipsService } from '$lib/services/tipsService';

  interface Module {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    status: 'active' | 'coming-soon';
    path: string;
    adminOnly?: boolean;
    features: string[];
  }

  const modules: Module[] = [
            {
              id: 'plan',
              name: '📋 Plan',
              description: 'Interactive map-based planning tools for network expansion',
              icon: '📋',
              color: 'var(--primary)', // Blue
              status: 'active',
              path: '/modules/plan',
              features: ['Coverage Analysis', 'Site Planning', 'Inventory Check', 'CBRS Spectrum', 'Capacity Planning', 'Cost Analysis']
            },
            {
              id: 'deploy',
              name: '🚀 Deploy',
              description: 'Interactive map-based deployment tools for network rollouts',
              icon: '🚀',
              color: 'var(--success)', // Green
              status: 'active',
              path: '/modules/deploy',
              features: ['PCI Resolution', 'ACS CPE Management', 'Work Orders', 'Installation Management', 'Equipment Configuration', 'Quality Assurance']
            },
            {
              id: 'monitor',
              name: '📊 Monitor',
              description: 'Interactive map-based monitoring tools for network oversight',
              icon: '📊',
              color: 'var(--warning)', // Amber
              status: 'active',
              path: '/modules/monitor',
              features: ['Network Monitoring', 'Device Health', 'Traffic Analysis', 'Performance Analytics', 'Alert Management', 'HSS Management']
            },
            {
              id: 'maintain',
              name: '🔧 Maintain',
              description: 'Traditional interface for ticketing and maintenance management',
              icon: '🔧',
              color: 'var(--danger)', // Red
              status: 'active',
              path: '/modules/maintain',
              features: ['Ticketing System', 'Preventive Maintenance', 'Incident Management', 'Customer Support', 'Vendor Management', 'Knowledge Base']
            },
            {
              id: 'customers',
              name: '👥 Customers',
              description: 'Manage customers and the customer portal',
              icon: '👥',
              color: 'var(--info)', // Blue
              status: 'active',
              path: '/modules/customers',
              features: ['Customer Database', 'Customer Portal', 'Service Management', 'Installation History', 'Customer Support']
            },
            {
              id: 'hardware',
              name: '🔧 Hardware',
              description: 'Comprehensive equipment and hardware management system',
              icon: '🔧',
              color: '#8b5cf6', // Purple
              status: 'active',
              path: '/modules/hardware',
              features: ['Equipment Inventory', 'Asset Tracking', 'Hardware Management', 'Status Monitoring', 'Location Tracking', 'Maintenance Records']
            },
            {
              id: 'voice-telephony',
              name: '📞 Voice / SIP',
              description: 'Telephone numbers, carrier linkage, E911, and number porting (LNP)',
              icon: '📞',
              color: '#0ea5e9',
              status: 'active',
              path: '/modules/voice-telephony',
              features: ['Provider accounts', 'TN inventory', 'E911 status', 'Port orders', 'Domain reference']
            }
  ];

  const adminModules: Module[] = [
    {
      id: 'admin-management',
      name: '⚙️ Admin Management',
      description: 'User and tenant management for owners and administrators',
      icon: '⚙️',
      color: 'var(--text-secondary)', // Gray
      status: 'active',
      path: '/admin/management',
      adminOnly: true,
      features: ['User Management', 'Tenant Management', 'System Settings']
    },
    {
      id: 'system-management',
      name: '🔧 System Management',
      description: 'System-wide tenant management and deletion (Platform Admin Only)',
      icon: '🔧',
      color: '#f44336', // Red
      status: 'active',
      path: '/admin/system-management',
      adminOnly: true,
      features: ['View All Tenants', 'Delete Tenants', 'Suspend/Activate Tenants', 'System Overview']
    }
  ];

  let isAdmin = false;
  let currentUser: any = null;
  let isLoggedIn = false;
  let showOnboardingWizard = false;
  let showSettings = false;
  let showTipsModal = false;
  let tipsShown = false;
  const dashboardTips = getModuleTips('dashboard').map((t) => {
    if (t.id === 'dashboard-field-app') {
      const linkHtml = API_CONFIG.MOBILE_APP_DOWNLOAD_URL
        ? `<p><a href="${API_CONFIG.MOBILE_APP_DOWNLOAD_URL}" download>📥 Download Android APK</a></p>`
        : '';
      return { ...t, content: t.content.replace(`<p>${FIELD_APP_DOWNLOAD_PLACEHOLDER}</p>`, linkHtml).replace(FIELD_APP_DOWNLOAD_PLACEHOLDER, linkHtml) };
    }
    return t;
  });

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      // Check admin status by UID first (most reliable)
      const uid = getCurrentUserUid();
      if (uid) {
        isAdmin = isPlatformAdminByUid(uid) || await isCurrentUserPlatformAdmin();
      } else {
        // Fallback to email check
        isAdmin = isPlatformAdmin(currentUser?.email || null);
      }
      isLoggedIn = !!currentUser;
      
      // Redirect platform admins to admin pages instead of dashboard
      if (isAdmin) {
        console.log('[Dashboard] Platform admin detected, redirecting to admin pages');
        await goto('/admin/management', { replaceState: true });
        return;
      }
      
      // Check if onboarding wizard should be shown
      if (browser) {
        const onboardingCompleted = localStorage.getItem('onboardingCompleted');
        const tenantSetupCompleted = localStorage.getItem('tenantSetupCompleted');
        
        // Show wizard if tenant setup is complete but onboarding isn't
        if (tenantSetupCompleted === 'true' && onboardingCompleted !== 'true') {
          showOnboardingWizard = true;
        }
        // Show Quick Tips on first visit if enabled
        if (dashboardTips.length > 0 && tipsService.shouldShowTips('dashboard') && !tipsShown) {
          setTimeout(() => {
            showTipsModal = true;
            tipsShown = true;
          }, 800);
        }
      }
    }
  });
  
  function handleWizardAction(event: CustomEvent) {
    const { type } = event.detail;
    switch (type) {
      case 'add-tower':
        goto('/modules/coverage-map');
        showOnboardingWizard = false;
        break;
      case 'setup-cbrs':
        goto('/modules/cbrs-management');
        showOnboardingWizard = false;
        break;
      case 'setup-acs':
        goto('/modules/acs-cpe-management');
        showOnboardingWizard = false;
        break;
      case 'setup-monitoring':
        goto('/modules/monitoring');
        showOnboardingWizard = false;
        break;
    }
  }
  
  function handleWizardClose() {
    showOnboardingWizard = false;
  }

  function handleModuleClick(module: Module) {
    if (module.status === 'active') {
      goto(module.path);
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
      
      // Clear all localStorage data
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('selectedTenantId');
      localStorage.removeItem('selectedTenantName');
      localStorage.removeItem('tenantSetupCompleted');
      
      // Clear tenant store
      tenantStore.clearTenantData();
      
      await goto('/login', { replaceState: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
</script>

<TenantGuard>
  <!-- First-Time Setup Wizard -->
  {#if showOnboardingWizard}
    <FirstTimeSetupWizard 
      show={showOnboardingWizard} 
      autoStart={true}
      on:close={handleWizardClose}
      on:action={handleWizardAction}
    />
  {/if}
  
  <div class="dashboard-container">
    <!-- Header: centered logo + text, icons directly below -->
    <div class="header">
      <div class="header-content">
        <div class="header-brand">
          <div class="logo-section">
            <img src="/wisptools-logo.svg" alt="WISP Management" class="dashboard-logo" />
            <div class="branding">
              <h1 class="app-title">WISP Management</h1>
              <p class="app-subtitle">wisptools.io</p>
            <p class="poc-notice">wisptools.io · Source code: <a href="https://github.com/theorem6/WISP-Management" target="_blank" rel="noopener noreferrer">github.com/theorem6/WISP-Management</a></p>
            </div>
          </div>
          <div class="header-icons">
            <a href={API_CONFIG.MOBILE_APP_DOWNLOAD_URL} class="icon-btn apk-btn" title="Download Field App" aria-label="Download WISP Field App (APK)" download>
              <span class="apk-icon">📱</span>
            </a>
            <a href="/help" class="icon-btn doc-btn" title="Help" aria-label="Open help">
              <span class="doc-icon">📖</span>
            </a>
            <button class="icon-btn gear-btn" onclick={() => (showSettings = true)} title="Settings" aria-label="Open settings">
              <svg class="gear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            {#if isLoggedIn && currentUser}
              <NotificationCenter />
              {#if isAdmin}
                <span class="admin-badge" title="Administrator">Admin</span>
              {/if}
              <button class="icon-btn power-btn" onclick={handleLogout} title="Logout" aria-label="Logout">
                <svg class="power-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
              </button>
            {:else}
              <button class="login-btn" onclick={() => goto('/login')}>
                <span class="login-icon">🔑</span>
                Login
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <GlobalSettings bind:show={showSettings} on:close={() => (showSettings = false)} />
    <TipsModal bind:show={showTipsModal} moduleId="dashboard" tips={dashboardTips} on:close={() => (showTipsModal = false)} />

    <!-- Main Content -->
    <div class="main-content">
      <!-- Core Modules -->
      <div class="modules-section">
        <div class="modules-grid">
          {#each modules as module}
            <div 
              class="module-card" 
              class:active={module.status === 'active'}
              class:coming-soon={module.status === 'coming-soon'}
              onclick={() => handleModuleClick(module)}
              onkeydown={(e) => e.key === 'Enter' && handleModuleClick(module)}
              role="button"
              tabindex="0"
              aria-label="Open {module.name}. {module.description}"
            >
              <div class="module-header">
                <h3 class="module-name">{module.name}</h3>
              </div>
              
              <div class="module-features">
                <ul>
                  {#each module.features as feature}
                    <li>{feature}</li>
                  {/each}
                </ul>
              </div>

              <div class="module-status">
                {#if module.status === 'active'}
                  <span class="status-badge active">Active</span>
                {:else}
                  <span class="status-badge coming-soon">Coming Soon</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Admin Modules -->
      {#if isAdmin}
        <div class="admin-section">
          <h2 class="section-title">Administration</h2>
          <div class="admin-modules">
            {#each adminModules as module}
              <div 
                class="admin-card" 
                onclick={() => handleModuleClick(module)}
                onkeydown={(e) => e.key === 'Enter' && handleModuleClick(module)}
                role="button"
                tabindex="0"
                aria-label="Open {module.name}. {module.description}"
              >
                <div class="admin-icon" style="background-color: {module.color}20; color: {module.color}">
                  {module.icon}
                </div>
                <div class="admin-info">
                  <h3 class="admin-name">{module.name}</h3>
                  <p class="admin-description">{module.description}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Footer: License + GitHub -->
      <footer class="app-footer">
        <a href="https://github.com/theorem6/WISP-Management" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span class="sep">·</span>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
      </footer>
    </div>
  </div>
</TenantGuard>

<style>
  .dashboard-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #1e3a4f 100%);
    padding: 0;
  }

  .header {
    background: linear-gradient(90deg, #1a2332 0%, #1e3a4f 100%);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
    padding: 1rem 0 0.75rem;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .header-brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0.5rem 0 0;
  }

  .dashboard-logo {
    width: 72px;
    height: 72px;
    filter: drop-shadow(0 0 12px rgba(0, 217, 255, 0.5));
    transition: transform 0.3s ease;
  }

  .dashboard-logo:hover {
    transform: scale(1.05) rotate(5deg);
  }

  .branding {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .app-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 1px;
    line-height: 1.2;
  }

  .app-subtitle {
    font-size: 0.95rem;
    color: #00d9ff;
    margin: 0;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  .poc-notice {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 0.25rem 0 0;
  }
  .poc-notice a {
    color: #00d9ff;
    text-decoration: underline;
  }

  .app-footer {
    margin-top: 2rem;
    padding: 1rem 2rem;
    text-align: center;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .app-footer a {
    color: #00d9ff;
    text-decoration: none;
  }
  .app-footer a:hover {
    text-decoration: underline;
  }
  .app-footer .sep {
    margin: 0 0.5rem;
  }

  .header-icons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  .user-status {
    display: flex;
    align-items: center;
  }

  .admin-indicator {
    background: var(--success-light);
    color: var(--success);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .power-btn {
    background: var(--bg-secondary, #1a2332);
    color: var(--text-primary);
    border: 1px solid var(--border-color, #334155);
    border-radius: 8px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .power-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: var(--danger, #ef4444);
    color: var(--danger);
  }

  .power-icon {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }

  .login-btn {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .login-btn:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
  }

  .login-icon {
    font-size: 1rem;
  }

  .main-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .section-title {
    font-size: 1.8rem;
    font-weight: 600;
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 1.5rem 0;
    text-shadow: 0 0 20px rgba(0, 242, 254, 0.3);
  }

  /* Module Launch Bar */
  .module-launch-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
    max-width: 100%;
  }

  .launch-btn {
    padding: 1rem 3rem;
    font-size: 1.2rem;
    font-weight: 600;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 140px;
  }

  .launch-btn.plan {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 2px solid rgba(102, 126, 234, 0.3);
  }

  .launch-btn.deploy {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border: 2px solid rgba(240, 147, 251, 0.3);
  }

  .launch-btn.monitor {
    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
    border: 2px solid #00d9ff;
    box-shadow: 0 4px 20px rgba(0, 217, 255, 0.4);
  }

  .launch-btn.maintain {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    border: 2px solid rgba(67, 233, 123, 0.3);
  }

  .launch-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  }

  .launch-btn:active {
    transform: translateY(0);
  }

  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
    width: 100%;
    max-width: 100%;
  }
  
  @media (max-width: 768px) {
    .modules-grid {
      grid-template-columns: 1fr;
    }
  }
  
  @media (min-width: 769px) and (max-width: 1024px) {
    .modules-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (min-width: 1025px) {
    .modules-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  @media (min-width: 1400px) {
    .modules-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
  }

  .module-card {
    background: linear-gradient(135deg, #1e3a4f 0%, #1a2332 100%);
    border-radius: 1rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid rgba(0, 217, 255, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .module-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0, 217, 255, 0.4);
    border-color: #00d9ff;
  }

  .module-card.active {
    border-color: #00f2fe;
    box-shadow: 0 4px 20px rgba(0, 242, 254, 0.5);
  }

  .module-card.coming-soon {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .module-header {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(0, 217, 255, 0.3);
  }

  .module-name {
    margin: 0;
    font-size: 1.5rem;
    color: #00f2fe;
    font-weight: 700;
    text-shadow: 0 0 10px rgba(0, 242, 254, 0.5);
  }

  .module-features {
    margin: 1rem 0;
  }

  .module-features ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .module-features li {
    padding: 0.6rem 0;
    color: #a0d9e8;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
  }

  .module-features li:before {
    content: "▸";
    color: #00d9ff;
    font-weight: bold;
    font-size: 1.2rem;
    margin-right: 0.75rem;
  }

  .module-status {
    display: flex;
    justify-content: flex-end;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .status-badge.active {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.coming-soon {
    background: #fef3c7;
    color: #92400e;
  }

  .admin-section {
    margin-bottom: 3rem;
  }

  .admin-modules {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
  }
  
  @media (max-width: 768px) {
    .admin-modules {
      grid-template-columns: 1fr;
    }
  }

  .admin-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .admin-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #6b7280;
  }

  .admin-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .admin-name {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .admin-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .quick-actions {
    margin-bottom: 2rem;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .action-btn {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid transparent;
    border-radius: 0.75rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
  }

  .action-icon {
    font-size: 1.5rem;
  }

  .action-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 0 1rem;
    }

    .logo-section {
      flex-direction: column;
      text-align: center;
    }

    .app-title {
      font-size: 2rem;
    }

    .main-content {
      padding: 1rem;
    }

    .modules-grid {
      grid-template-columns: 1fr;
    }

    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--border-color, #334155);
    border-radius: 8px;
    background: var(--bg-secondary, #1a2332);
    color: var(--text-primary);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: rgba(0, 217, 255, 0.12);
    border-color: var(--primary);
    color: var(--primary);
  }
  .admin-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border-radius: 4px;
    font-weight: 600;
  }

  .doc-btn,
  .apk-btn {
    text-decoration: none;
  }
  .doc-icon,
  .apk-icon {
    font-size: 1.1rem;
  }
  .gear-icon {
    width: 18px;
    height: 18px;
  }
</style>