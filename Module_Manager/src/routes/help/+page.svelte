<script lang="ts">
  import { goto } from '$app/navigation';
  import { pciResolutionDocs } from '$lib/docs/pci-resolution-docs';
  import { acsCpeDocs } from '$lib/docs/acs-cpe-docs';
  import { cbrsManagementDocs } from '$lib/docs/cbrs-management-docs';
  import { inventoryDocs } from '$lib/docs/inventory-docs';
  import { coverageMapDocs } from '$lib/docs/coverage-map-docs';
  import { hssSubscribersDocs } from '$lib/docs/hss-subscribers-docs';
  
  let selectedTopic = 'overview';
  
  const topics = [
    { id: 'overview', title: 'Overview', icon: '📚' },
    { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
    { id: 'user-management', title: 'User Management', icon: '👥' },
    { id: 'help-desk', title: 'Help Desk', icon: '🎧' },
    { id: 'work-orders', title: 'Work Orders', icon: '📋' },
    { id: 'customers-portal', title: 'Customers & Portal', icon: '👤' },
    { id: 'inventory', title: 'Inventory', icon: '📦' },
    { id: 'coverage-map', title: 'Coverage Map', icon: '🗺️' },
    { id: 'hss-subscribers', title: 'HSS & Subscribers', icon: '🔐' },
    { id: 'acs-cpe', title: 'ACS CPE Management', icon: '📡' },
    { id: 'pci-resolution', title: 'PCI Resolution', icon: '📊' },
    { id: 'cbrs', title: 'CBRS Management', icon: '📡' },
    { id: 'wizards', title: 'Wizards & Quick Actions', icon: '🧙' },
    { id: 'roles', title: 'User Roles', icon: '🔐' },
    { id: 'troubleshooting', title: 'Troubleshooting', icon: '🔧' }
  ];
</script>

<div class="help-container">
  <div class="help-header">
    <button type="button" class="help-back-link" title="Back to main app" on:click={() => goto('/dashboard')}>← Back to main app</button>
    <div class="help-header-brand">
      <div class="help-logo-section">
        <img src="/wisptools-logo.svg" alt="WISP Management" class="help-logo" />
        <div class="help-branding">
          <h1 class="help-app-title">WISP Management</h1>
          <p class="help-app-subtitle">Documentation</p>
        </div>
      </div>
    </div>
    <p class="help-header-desc">Complete guide to using the platform. Use the Help button in each module for context-specific tips.</p>
    <p class="help-docs-link"><a href="/docs">Reference &amp; Project Status → /docs</a></p>
  </div>
  
  <div class="help-layout">
    <aside class="help-sidebar">
      <nav>
        {#each topics as topic}
          <button
            class="topic-btn"
            class:active={selectedTopic === topic.id}
            on:click={() => selectedTopic = topic.id}
          >
            <span class="topic-title">{topic.title}</span>
          </button>
        {/each}
      </nav>
    </aside>
    
    <main class="help-content">
      {#if selectedTopic === 'overview'}
        <article>
          <h2>Welcome to WISP Multitool</h2>
          <p class="lead">Your complete wireless ISP management platform.</p>
          
          <section>
            <h3>What is WISP Multitool?</h3>
            <p><strong>WISP Multitool</strong> is an all-in-one platform designed for wireless Internet service providers (WISPs) to manage every aspect of their operations:</p>
            
            <ul>
              <li><strong>Network Planning</strong> - PCI resolution, CBRS spectrum, coverage mapping</li>
              <li><strong>Field Operations</strong> - Mobile app for technicians, work orders, inventory</li>
              <li><strong>Customer Support</strong> - Help desk ticketing, subscriber management</li>
              <li><strong>Customers & Portal</strong> - Customer records, branded customer portal, billing, support tickets</li>
              <li><strong>Device Management</strong> - ACS/TR-069 CPE management, HSS subscriber auth</li>
              <li><strong>Team Management</strong> - Role-based access, user invitations, permissions</li>
              <li><strong>Wizards & Quick Tips</strong> - Guided wizards (site deployment, subscribers, RMA, onboarding) and in-module help</li>
            </ul>
          </section>
          
          <section>
            <h3>Platform Components</h3>
            
            <div class="component-grid">
              <div class="component-card">
                <div class="component-icon">🌐</div>
                <h4>Web Platform</h4>
                <p>Browser-based management console for administrators, engineers, and support staff.</p>
              </div>
              
              <div class="component-card">
                <div class="component-icon">📱</div>
                <h4>Mobile App</h4>
                <p>Android app for field technicians with work orders, equipment scanning, and GPS navigation.</p>
              </div>
              
              <div class="component-card">
                <div class="component-icon">☁️</div>
                <h4>Cloud Backend</h4>
                <p>Scalable cloud backend for APIs, push notifications, and data storage.</p>
              </div>
            </div>
          </section>
          
          <section>
            <h3>Who Uses WISP Multitool?</h3>
            
            <div class="role-cards">
              <div class="role-card">
                <h4>🏢 Owner / Admin</h4>
                <p>Manage users, configure system, view all modules, control organization settings.</p>
              </div>
              
              <div class="role-card">
                <h4>👷 Network Engineer</h4>
                <p>Plan network coverage, configure CBRS, manage HSS subscribers, optimize PCI.</p>
              </div>
              
              <div class="role-card">
                <h4>🔧 Field Technician</h4>
                <p>Use mobile app for work orders, equipment deployment, inventory checkout, site visits.</p>
              </div>
              
              <div class="role-card">
                <h4>🎧 Help Desk</h4>
                <p>Create support tickets, assist customers, lookup subscribers, troubleshoot CPE devices.</p>
              </div>
            </div>
          </section>
        </article>
      
      {:else if selectedTopic === 'getting-started'}
        <article>
          <h2>🚀 Getting Started</h2>
          
          <section>
            <h3>1. First Login</h3>
            <ol>
              <li>Navigate to the platform URL</li>
              <li>Click <strong>"Sign in with Google"</strong></li>
              <li>Authorize with your Google account</li>
              <li>Select or create your organization (tenant)</li>
            </ol>
          </section>
          
          <section>
            <h3>2. Dashboard Overview</h3>
            <p>After login, you'll see the main dashboard with module cards and a header with:</p>
            <ul>
              <li><strong>Docs</strong> (top right) - Opens this help page</li>
              <li><strong>Settings</strong> - Theme (light/dark), branding, module access, tenant options</li>
              <li><strong>Notifications</strong> - In-app and optional browser notifications (enable in the panel)</li>
              <li><strong>Quick access</strong> dropdown - Jump to wizards (Plan, Deploy, CBRS, Customers, HSS, Inventory, etc.)</li>
            </ul>
            <p>Module cards include: <strong>PCI Resolution</strong>, <strong>CBRS Management</strong>, <strong>ACS CPE Management</strong>, <strong>HSS Management</strong>, <strong>Coverage Map</strong>, <strong>Inventory</strong>, <strong>Work Orders</strong>, <strong>Help Desk</strong>, <strong>Customers</strong>, <strong>User Management</strong>, and more.</p>
            <p><em>Note: Available modules depend on your user role and tenant configuration. First-time visitors see quick tips (Field App, Docs, Quick access).</em></p>
          </section>
          
          <section>
            <h3>3. Inviting Team Members</h3>
            <ol>
              <li>Go to <strong>User Management</strong> module</li>
              <li>Click <strong>"Invite User"</strong></li>
              <li>Enter email address</li>
              <li>Select role (Admin, Engineer, Installer, Help Desk, Viewer)</li>
              <li>Click <strong>"Send Invitation"</strong></li>
              <li>User receives email and can accept invitation</li>
            </ol>
          </section>
          
          <section>
            <h3>4. Mobile App Setup</h3>
            <p><strong>For Field Technicians:</strong></p>
            <ol>
              <li>Install <strong>WISP Multitool</strong> APK on Android device</li>
              <li>Open app and grant permissions (Camera, Location, Notifications)</li>
              <li>Login with same Google account as web platform</li>
              <li>Select your organization</li>
              <li>Start receiving work orders!</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'user-management'}
        <article>
          <h2>👥 User Management</h2>
          <p class="lead">Manage your team members, roles, and permissions.</p>
          
          <section>
            <h3>Inviting Users</h3>
            <ol>
              <li>Navigate to <code>/modules/user-management</code></li>
              <li>Click <strong>"Invite User"</strong> button</li>
              <li>Enter user's email address</li>
              <li>Select appropriate role:
                <ul>
                  <li><strong>Admin</strong> - Can manage users and configure modules</li>
                  <li><strong>Engineer</strong> - Access to technical/network modules</li>
                  <li><strong>Field Technician</strong> - Mobile app and field operations</li>
                  <li><strong>Help Desk</strong> - Customer support and ticketing</li>
                  <li><strong>Viewer</strong> - Read-only access to reports</li>
                </ul>
              </li>
              <li>Click <strong>"Send Invitation"</strong></li>
            </ol>
            <p class="tip">💡 <strong>Tip:</strong> Invited users will appear with "Pending" status until they accept the invitation and login.</p>
          </section>
          
          <section>
            <h3>Editing User Roles</h3>
            <ol>
              <li>In User Management, click <strong>"Edit"</strong> next to a user</li>
              <li>Select new role from dropdown</li>
              <li>Click <strong>"Update Role"</strong></li>
              <li>Changes take effect immediately</li>
            </ol>
            <p class="warning">⚠️ <strong>Note:</strong> Owner role cannot be changed. Only one owner per organization.</p>
          </section>
          
          <section>
            <h3>Suspending Users</h3>
            <p>Temporarily disable a user's access without removing them:</p>
            <ol>
              <li>Click <strong>"Edit"</strong> on the user</li>
              <li>Click <strong>"Suspend User"</strong></li>
              <li>User can still login but API calls will fail</li>
              <li>To re-enable, click <strong>"Activate User"</strong></li>
            </ol>
          </section>
          
          <section>
            <h3>Removing Users</h3>
            <ol>
              <li>Click <strong>"Edit"</strong> on the user</li>
              <li>Click <strong>"Remove from Organization"</strong></li>
              <li>Confirm deletion</li>
              <li>User is removed from tenant (cannot be undone)</li>
            </ol>
            <p class="warning">⚠️ <strong>Warning:</strong> Cannot remove the owner. Transfer ownership first.</p>
          </section>
        </article>
      
      {:else if selectedTopic === 'help-desk'}
        <article>
          <h2>🎧 Help Desk Module</h2>
          <p class="lead">Customer support ticketing and equipment troubleshooting.</p>
          
          <section>
            <h3>Creating Support Tickets</h3>
            <ol>
              <li>Go to <strong>Help Desk</strong> module</li>
              <li>Click <strong>"Create Ticket"</strong></li>
              <li>Enter ticket information:
                <ul>
                  <li><strong>Title</strong> - Brief description</li>
                  <li><strong>Type</strong> - Troubleshoot, Repair, Installation, Other</li>
                  <li><strong>Priority</strong> - Critical, High, Medium, Low</li>
                  <li><strong>Description</strong> - Detailed issue description</li>
                  <li><strong>Customer</strong> - Name and phone (optional)</li>
                </ul>
              </li>
              <li>Click <strong>"Create Ticket"</strong></li>
            </ol>
          </section>
          
          <section>
            <h3>Assigning Tickets</h3>
            <p>Help desk staff can assign tickets to field technicians:</p>
            <ol>
              <li>Click on a ticket card to open details</li>
              <li>Click <strong>"Assign"</strong> button</li>
              <li>Select field technician from dropdown</li>
              <li>Technician receives push notification on mobile app</li>
            </ol>
          </section>
          
          <section>
            <h3>Filtering Tickets</h3>
            <p>Use filters to find specific tickets:</p>
            <ul>
              <li><strong>Status</strong> - Open, Assigned, In Progress, Resolved, Closed</li>
              <li><strong>Priority</strong> - Critical, High, Medium, Low</li>
              <li><strong>Search</strong> - Search by ticket number, title, or customer name</li>
            </ul>
          </section>
          
          <section>
            <h3>Customer Lookup</h3>
            <ol>
              <li>Click <strong>"Customer Lookup"</strong> button</li>
              <li>Search by phone, email, or IMSI</li>
              <li>View customer information and service status</li>
              <li>See active equipment and recent tickets</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'roles'}
        <article>
          <h2>🔐 User Roles & Permissions</h2>
          <p class="lead">Understanding the role-based access control system.</p>
          
          <section>
            <h3>Role Hierarchy</h3>
            
            <div class="role-detail">
              <h4>🏢 Platform Admin</h4>
              <p><strong>Who:</strong> System administrator (admin@wisptools.io)</p>
              <p><strong>Access:</strong> ALL tenants, ALL modules, ALL permissions</p>
              <p><strong>Can:</strong> Manage all tenants, create owners, override any permission</p>
            </div>
            
            <div class="role-detail">
              <h4>👑 Owner</h4>
              <p><strong>Who:</strong> Organization creator</p>
              <p><strong>Access:</strong> ALL modules in their tenant</p>
              <p><strong>Can:</strong> Manage users, configure modules, full administrative control</p>
              <p><strong>Cannot:</strong> Be changed or removed (permanent role)</p>
            </div>
            
            <div class="role-detail">
              <h4>⚙️ Admin</h4>
              <p><strong>Who:</strong> Assistant administrators</p>
              <p><strong>Access:</strong> Configurable module access</p>
              <p><strong>Can:</strong> Manage users, configure permissions, access enabled modules</p>
              <p><strong>Cannot:</strong> Change owner role, delete organization</p>
            </div>
            
            <div class="role-detail">
              <h4>👷 Engineer</h4>
              <p><strong>Who:</strong> Network engineers</p>
              <p><strong>Access:</strong> Technical modules only (PCI, CBRS, HSS, ACS, Distributed EPC)</p>
              <p><strong>Can:</strong> Configure network, manage subscribers, view all work orders</p>
              <p><strong>Cannot:</strong> Manage users, access help desk</p>
            </div>
            
            <div class="role-detail">
              <h4>🔧 Field Technician (Installer)</h4>
              <p><strong>Who:</strong> Field workers</p>
              <p><strong>Access:</strong> Mobile app, assigned work orders, inventory checkout</p>
              <p><strong>Can:</strong> Deploy equipment, complete tickets, checkout inventory</p>
              <p><strong>Cannot:</strong> View other techs' tickets, configure network</p>
            </div>
            
            <div class="role-detail">
              <h4>🎧 Help Desk</h4>
              <p><strong>Who:</strong> Customer support staff</p>
              <p><strong>Access:</strong> Help desk, work orders, ACS troubleshooting</p>
              <p><strong>Can:</strong> Create tickets, assign to techs, troubleshoot CPE</p>
              <p><strong>Cannot:</strong> Manage users, configure network</p>
            </div>
            
            <div class="role-detail">
              <h4>👁️ Viewer</h4>
              <p><strong>Who:</strong> Read-only users, auditors</p>
              <p><strong>Access:</strong> View-only access to all modules</p>
              <p><strong>Can:</strong> View dashboards, reports, export data</p>
              <p><strong>Cannot:</strong> Make any changes</p>
            </div>
          </section>
          
          <section>
            <h3>Configuring Module Access</h3>
            <ol>
              <li>Go to <strong>Settings</strong> → <strong>Module Access</strong></li>
              <li>See matrix of roles vs. modules</li>
              <li>Check/uncheck boxes to enable/disable modules per role</li>
              <li>Click <strong>"Save Configuration"</strong></li>
              <li>Changes apply immediately to all users</li>
            </ol>
            <p class="tip">💡 <strong>Tip:</strong> Use the reset button to restore default permissions for a role.</p>
          </section>
        </article>
      
      {:else if selectedTopic === 'customers-portal'}
        <article>
          <h2>Customers & Customer Portal</h2>
          <p class="lead">Customer records, branded portal, billing, and support tickets.</p>
          
          <section>
            <h3>Customers Module</h3>
            <p>Manage customer records with service type (4G/5G, FWA, WiFi, Fiber), LTE auth (IMSI, Ki, OPc), MAC address, and QoS. Use the <strong>Customer Onboarding</strong> wizard from Quick access or the Customers module for guided setup.</p>
          </section>
          
          <section>
            <h3>Customer Portal Setup</h3>
            <p>Enable a branded customer portal so customers can sign in and access:</p>
            <ul>
              <li><strong>Dashboard</strong> - Overview and quick links</li>
              <li><strong>Billing</strong> - View account and billing information</li>
              <li><strong>Tickets</strong> - Open and track support tickets</li>
              <li><strong>Knowledge base / FAQ</strong> - Self-service help</li>
            </ul>
            <p>Configure portal branding (logo, colors) and enable the portal in <strong>Customers → Portal setup</strong>. Use <strong>Settings</strong> for organization-wide branding if needed.</p>
          </section>
          
          <section>
            <h3>Billing</h3>
            <p>Customer billing is available from the Customers module (billing modal per customer) and in the customer portal. Billing cycles and invoicing can be extended when prioritized.</p>
          </section>
        </article>
      
      {:else if selectedTopic === 'wizards'}
        <article>
          <h2>Wizards & Quick Actions</h2>
          <p class="lead">Guided flows and in-module quick tips.</p>
          
          <section>
            <h3>Available Wizards</h3>
            <p>Open wizards from the dashboard <strong>Quick access</strong> dropdown or from the <strong>Wizards</strong> page:</p>
            <ul>
              <li><strong>Site Deployment</strong> - Deploy and configure sites</li>
              <li><strong>Subscriber Creation / Group / Bandwidth Plan</strong> - HSS subscriber management</li>
              <li><strong>RMA Tracking</strong> - Inventory returns and tracking</li>
              <li><strong>Customer Onboarding</strong> - Guided customer setup</li>
              <li><strong>Device Onboarding / Registration</strong> - ACS and CBRS device registration</li>
              <li><strong>Conflict Resolution</strong> - PCI conflict resolution</li>
              <li><strong>Work Order Creation</strong> - Create work orders</li>
              <li><strong>Troubleshooting (ACS)</strong> - CPE diagnostics and steps</li>
              <li><strong>First-time / Organization / Initial Configuration</strong> - Setup and tenant wizards</li>
            </ul>
          </section>
          
          <section>
            <h3>Quick Tips in Modules</h3>
            <p>Each module can show a <strong>Help</strong> button that opens context-specific tips (e.g. Monitoring, Deploy, CBRS, Plan, Inventory). Use it for step-by-step guidance without leaving the module.</p>
          </section>
        </article>
      
      {:else if selectedTopic === 'work-orders'}
        <article>
          <h2>📋 Work Orders & Field Operations</h2>
          
          <section>
            <h3>Creating Work Orders</h3>
            <ol>
              <li>Go to <strong>Work Orders</strong> or <strong>Help Desk</strong> module</li>
              <li>Click <strong>"Create Work Order"</strong></li>
              <li>Fill in details:
                <ul>
                  <li><strong>Title</strong> - Brief description</li>
                  <li><strong>Type</strong> - Installation, Repair, Maintenance, etc.</li>
                  <li><strong>Priority</strong> - Critical to Low</li>
                  <li><strong>Site</strong> - Affected tower site (optional)</li>
                  <li><strong>Customer</strong> - Customer details (optional)</li>
                  <li><strong>Description</strong> - Full details</li>
                </ul>
              </li>
              <li>Click <strong>"Create"</strong></li>
            </ol>
          </section>
          
          <section>
            <h3>Assigning Work Orders</h3>
            <ol>
              <li>Open work order details</li>
              <li>Click <strong>"Assign"</strong></li>
              <li>Select field technician</li>
              <li>Technician receives push notification on mobile app</li>
              <li>Status changes to "Assigned"</li>
            </ol>
          </section>
          
          <section>
            <h3>Mobile App Workflow</h3>
            <p><strong>Field Technician receives notification:</strong></p>
            <ol>
              <li>Push notification appears on phone</li>
              <li>Tap notification to open app</li>
              <li>View work order details</li>
              <li>Navigate to site using GPS</li>
              <li>Complete work</li>
              <li>Update status to "Resolved"</li>
              <li>Add notes and photos</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'troubleshooting'}
        <article>
          <h2>🔧 Troubleshooting</h2>
          
          <section>
            <h3>Common Issues</h3>
            
            <div class="troubleshoot-item">
              <h4>❌ Can't see a module on dashboard</h4>
              <p><strong>Cause:</strong> Module not enabled for your role</p>
              <p><strong>Solution:</strong> Ask your administrator to enable the module in Settings → Module Access</p>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ API calls fail with 403 Forbidden</h4>
              <p><strong>Cause:</strong> Insufficient permissions for the action</p>
              <p><strong>Solution:</strong> Contact your administrator to update your role or permissions</p>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ Mobile app not receiving notifications</h4>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Check app has notification permissions granted</li>
                <li>Check user is logged in</li>
                <li>Restart app to re-register FCM token</li>
                <li>Check system notification settings</li>
              </ul>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ Browser notifications not showing</h4>
              <p><strong>Solution:</strong> Open the <strong>Notifications</strong> panel (bell icon on dashboard), click <strong>Enable notifications</strong>, and allow when the browser prompts. Notifications then appear for new unread items.</p>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ Want to change light/dark theme</h4>
              <p><strong>Solution:</strong> Click the <strong>Settings</strong> (gear) icon on the dashboard header and choose theme in the settings modal.</p>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ Work order not appearing in mobile app</h4>
              <p><strong>Cause:</strong> Work order not assigned to your user</p>
              <p><strong>Solution:</strong> Field technicians only see tickets assigned to them. Ask help desk to assign the ticket.</p>
            </div>
          </section>
          
          <section>
            <h3>Getting Help</h3>
            <p>If you encounter issues:</p>
            <ol>
              <li>Check this documentation first</li>
              <li>Contact your organization administrator</li>
              <li>Check browser console for errors (F12)</li>
              <li>Clear browser cache and cookies</li>
              <li>Try logging out and back in</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'pci-resolution'}
        <article>
          {@html pciResolutionDocs}
        </article>
      
      {:else if selectedTopic === 'acs-cpe'}
        <article>
          {@html acsCpeDocs}
        </article>
      
      {:else if selectedTopic === 'cbrs'}
        <article>
          {@html cbrsManagementDocs}
        </article>
      
      {:else if selectedTopic === 'inventory'}
        <article>
          {@html inventoryDocs}
        </article>
      
      {:else if selectedTopic === 'coverage-map'}
        <article>
          {@html coverageMapDocs}
        </article>
      
      {:else if selectedTopic === 'hss-subscribers'}
        <article>
          {@html hssSubscribersDocs}
        </article>
      
      {:else}
        <article>
          <h2>Documentation Coming Soon</h2>
          <p>Detailed documentation for <strong>{topics.find(t => t.id === selectedTopic)?.title || selectedTopic}</strong> will be added here.</p>
          <p>In the meantime, explore the module and use tooltips for guidance.</p>
        </article>
      {/if}
    </main>
  </div>
</div>

<style>
  .help-docs-link {
    margin-top: 0.5rem;
    font-size: 0.95rem;
  }
  .help-docs-link a {
    color: var(--primary, #3b82f6);
    text-decoration: none;
  }
  .help-docs-link a:hover {
    text-decoration: underline;
  }
</style>
