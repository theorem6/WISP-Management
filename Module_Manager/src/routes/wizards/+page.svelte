<script lang="ts">
  /**
   * Wizards hub – lists all guided wizards in the app and where to find them.
   * Each wizard links to its module; the module page opens the wizard.
   */
  import { goto } from '$app/navigation';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import OrganizationSetupWizard from '$lib/components/wizards/OrganizationSetupWizard.svelte';
  import InitialConfigurationWizard from '$lib/components/wizards/InitialConfigurationWizard.svelte';
  import { ALL_WIZARDS } from '$lib/config/wizardCatalog';

  interface WizardEntry {
    id: string;
    name: string;
    description: string;
    icon: string;
    moduleName: string;
    modulePath: string;
    whereInModule: string;
    openHere?: boolean; // if true, open wizard on this page instead of navigating
  }

  let showOrgWizard = false;
  let showConfigWizard = false;
  let wizardsPulldownOpen = false;

  const wizards: WizardEntry[] = [
    {
      id: 'first-time-setup',
      name: 'First-Time Setup',
      description: 'Onboarding for new WISP operators: towers, CBRS, ACS, monitoring.',
      icon: '🚀',
      moduleName: 'Dashboard / Onboarding',
      modulePath: '/onboarding',
      whereInModule: 'Shown automatically on first visit, or open from /onboarding.',
    },
    {
      id: 'organization-setup',
      name: 'Organization Setup',
      description: 'Verify or edit organization (tenant) name and contact details.',
      icon: '🏢',
      moduleName: 'Onboarding',
      modulePath: '/onboarding',
      whereInModule: 'Onboarding flow step 1, or open here.',
      openHere: true,
    },
    {
      id: 'initial-configuration',
      name: 'Initial Configuration',
      description: 'Add first tower and configure CBRS, ACS, and Monitoring modules.',
      icon: '⚙️',
      moduleName: 'Onboarding',
      modulePath: '/onboarding',
      whereInModule: 'Onboarding flow step 3, or open here.',
      openHere: true,
    },
    {
      id: 'site-deployment',
      name: 'Add Site',
      description: 'Create a new tower, NOC, warehouse, or other site.',
      icon: '📍',
      moduleName: 'Deploy',
      modulePath: '/modules/deploy',
      whereInModule: 'Header bar: "Add Site" button.',
    },
    {
      id: 'deploy-equipment',
      name: 'Deploy Equipment',
      description: 'Step-by-step equipment deployment in the field.',
      icon: '📦',
      moduleName: 'Deploy',
      modulePath: '/modules/deploy',
      whereInModule: 'Header bar: "Deploy Equipment" button.',
    },
    {
      id: 'pci-planner',
      name: 'PCI Planner',
      description: 'Plan and resolve PCI conflicts across LTE sectors.',
      icon: '📊',
      moduleName: 'Deploy',
      modulePath: '/modules/deploy',
      whereInModule: 'Header bar: "PCI" button (shows sector count).',
    },
    {
      id: 'frequency-planner',
      name: 'Frequency Planner',
      description: 'Frequency planning for LTE/FWA sectors.',
      icon: '📡',
      moduleName: 'Deploy',
      modulePath: '/modules/deploy',
      whereInModule: 'Header bar: "Frequency" button (shows sector count).',
    },
    {
      id: 'acs-setup',
      name: 'ACS/TR-069 Setup',
      description: 'Configure GenieACS and TR-069 for CPE management.',
      icon: '⚙️',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "Setup Wizard" or empty-state "Run Setup Wizard".',
    },
    {
      id: 'device-onboarding',
      name: 'Device Onboarding',
      description: 'Onboard a new CPE device to GenieACS.',
      icon: '📱',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "Onboard Device" button.',
    },
    {
      id: 'troubleshooting',
      name: 'Troubleshooting',
      description: 'Guided CPE troubleshooting steps.',
      icon: '🔧',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "Troubleshooting" button.',
    },
    {
      id: 'preset-creation',
      name: 'Preset Creation',
      description: 'Create GenieACS presets for device configuration.',
      icon: '⚙️',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "More wizards ▼" → Preset Creation.',
    },
    {
      id: 'bulk-operations',
      name: 'Bulk Operations',
      description: 'Bulk operations on CPE devices.',
      icon: '📦',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "More wizards ▼" → Bulk Operations.',
    },
    {
      id: 'firmware-update',
      name: 'Firmware Update',
      description: 'Update firmware on CPE devices.',
      icon: '💾',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "More wizards ▼" → Firmware Update.',
    },
    {
      id: 'device-registration',
      name: 'Device Registration',
      description: 'Register CPE devices with GenieACS.',
      icon: '📱',
      moduleName: 'ACS CPE Management',
      modulePath: '/modules/acs-cpe-management',
      whereInModule: 'Header: "More wizards ▼" → Device Registration.',
    },
    {
      id: 'cbrs-setup',
      name: 'CBRS Setup',
      description: 'Configure CBRS/SAS and CBSD devices.',
      icon: '📡',
      moduleName: 'CBRS Management',
      modulePath: '/modules/cbrs-management',
      whereInModule: 'Empty state or "Run Setup Wizard" / "Run Setup Wizard →".',
    },
    {
      id: 'cbrs-device-registration',
      name: 'CBRS Device Registration',
      description: 'Add a CBSD device (serial, FCC ID, category, location) step-by-step.',
      icon: '📡',
      moduleName: 'CBRS Management',
      modulePath: '/modules/cbrs-management',
      whereInModule: 'Header: "Register Device Wizard" button.',
    },
    {
      id: 'work-order-creation',
      name: 'Work Order Creation',
      description: 'Create work orders or tickets step-by-step.',
      icon: '📋',
      moduleName: 'Work Orders',
      modulePath: '/modules/work-orders',
      whereInModule: '"Create Work Order Wizard" button at top.',
    },
    {
      id: 'subscriber-creation',
      name: 'Subscriber Creation',
      description: 'Create HSS/LTE subscriber with IMSI, auth keys, group, and plan.',
      icon: '🔐',
      moduleName: 'HSS & Subscriber Management',
      modulePath: '/modules/hss-management',
      whereInModule: 'Header: "Add Subscriber Wizard" button.',
    },
    {
      id: 'customer-onboarding',
      name: 'Customer Onboarding',
      description: 'Guided flow to add a new customer (basic info, address, service type, optional LTE).',
      icon: '👋',
      moduleName: 'Customers',
      modulePath: '/modules/customers',
      whereInModule: 'Customers tab: "Onboarding Wizard" button.',
    },
    {
      id: 'inventory-checkin',
      name: 'Check-in Wizard',
      description: 'Check in inventory items (e.g. return equipment).',
      icon: '📦',
      moduleName: 'Inventory',
      modulePath: '/modules/inventory',
      whereInModule: 'Header/toolbar: "Check-in Wizard" button.',
    },
    {
      id: 'rma-tracking',
      name: 'Track RMA',
      description: 'Mark an inventory item as RMA and record RMA number, vendor, and reason.',
      icon: '📋',
      moduleName: 'Inventory',
      modulePath: '/modules/inventory',
      whereInModule: 'Header/toolbar: "Track RMA" button.',
    },
    {
      id: 'bandwidth-plan',
      name: 'Bandwidth Plan',
      description: 'Create an HSS bandwidth plan (name, download/upload Mbps).',
      icon: '📶',
      moduleName: 'HSS & Subscriber Management',
      modulePath: '/modules/hss-management',
      whereInModule: 'Header: "Add Plan Wizard" button.',
    },
    {
      id: 'subscriber-group',
      name: 'Subscriber Group',
      description: 'Create an HSS subscriber group (name, optional plan, APN, QCI).',
      icon: '📦',
      moduleName: 'HSS & Subscriber Management',
      modulePath: '/modules/hss-management',
      whereInModule: 'Header: "Add Group Wizard" button.',
    },
    {
      id: 'monitoring-setup',
      name: 'Monitoring Setup',
      description: 'Set up network monitoring (sites, devices, alerts).',
      icon: '📊',
      moduleName: 'Monitor',
      modulePath: '/modules/monitoring',
      whereInModule: 'Header: wizard icon button, or empty state "Get Started with Setup Wizard".',
    },
    {
      id: 'conflict-resolution',
      name: 'Conflict Resolution Wizard',
      description: 'Identify and resolve PCI conflicts step-by-step (analyze, optimize, apply, verify).',
      icon: '📊',
      moduleName: 'PCI Resolution',
      modulePath: '/modules/pci-resolution',
      whereInModule: 'Left sidebar: "Conflict Wizard" button.',
    },
    {
      id: 'import-wizard',
      name: 'Import Wizard',
      description: 'Import data (e.g. PCI/sector data) from file.',
      icon: '📥',
      moduleName: 'PCI Resolution',
      modulePath: '/modules/pci-resolution',
      whereInModule: 'Header/toolbar: "Import" to open Import Wizard.',
    },
    {
      id: 'epc-deployment',
      name: 'EPC Deployment',
      description: 'Register and deploy EPC devices.',
      icon: '🔧',
      moduleName: 'Hardware',
      modulePath: '/modules/hardware',
      whereInModule: 'Add menu (dropdown) → EPC deployment / wizard option.',
    },
    {
      id: 'marketing-discovery',
      name: 'Marketing Discovery',
      description: 'Add marketing addresses to a plan (coverage discovery).',
      icon: '📍',
      moduleName: 'Plan',
      modulePath: '/modules/plan',
      whereInModule: 'Inside a plan: use marketing/address discovery for the plan.',
    },
  ];
</script>

<svelte:head>
  <title>Wizards – WISP Management</title>
</svelte:head>

<TenantGuard>
  <div class="wizards-page">
    <header class="wizards-header">
      <button class="back-btn" onclick={() => goto('/dashboard')} type="button">
        ← Dashboard
      </button>
      <div class="wizards-header-row">
        <h1>🧙 List of wizards</h1>
        <div class="wizards-pulldown-wrap">
          <button
            type="button"
            class="wizards-pulldown-trigger"
            class:open={wizardsPulldownOpen}
            onclick={() => (wizardsPulldownOpen = !wizardsPulldownOpen)}
            onblur={() => setTimeout(() => (wizardsPulldownOpen = false), 150)}
            aria-haspopup="true"
            aria-expanded={wizardsPulldownOpen}
          >
            Jump to wizard ▼
          </button>
          {#if wizardsPulldownOpen}
            <div class="wizards-pulldown-menu" role="menu">
              {#each ALL_WIZARDS as w}
                <button type="button" role="menuitem" class="wizards-pulldown-item" onclick={() => { const url = w.path + (w.path.includes('?') ? '&' : '?') + 'wizard=' + encodeURIComponent(w.id); goto(url); wizardsPulldownOpen = false; }}>
                  <span class="wizards-pulldown-icon">{w.icon}</span>
                  <span>{w.label}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <p class="subtitle">Guided flows for setup, deployment, and operations. Each wizard runs inside its module. Use <strong>Jump to wizard</strong> above or "Open in [Module]" below to go to that module, then click the wizard button in the module header.</p>
    </header>

    <div class="wizards-grid">
      {#each wizards as w}
        <article class="wizard-card">
          <div class="wizard-icon">{w.icon}</div>
          <h2 class="wizard-name">{w.name}</h2>
          <p class="wizard-desc">{w.description}</p>
          <p class="wizard-where">
            <strong>{w.moduleName}</strong> · {w.whereInModule}
          </p>
          <button
            class="open-in-module"
            onclick={() => {
              if (w.openHere && w.id === 'organization-setup') { showOrgWizard = true; return; }
              if (w.openHere && w.id === 'initial-configuration') { showConfigWizard = true; return; }
              const url = w.modulePath + '?wizard=' + encodeURIComponent(w.id);
              goto(url);
            }}
            type="button"
          >
            {#if w.openHere}
              Open {w.name}
            {:else}
              Open in {w.moduleName}
            {/if}
          </button>
        </article>
      {/each}
    </div>
  </div>
  <OrganizationSetupWizard show={showOrgWizard} on:close={() => (showOrgWizard = false)} />
  <InitialConfigurationWizard show={showConfigWizard} on:close={() => (showConfigWizard = false)} />
</TenantGuard>

<style>
  .wizards-page {
    min-height: 100vh;
    background: var(--bg-primary, #0f1419);
    color: var(--text-primary, #e2e8f0);
    padding: 1.5rem;
  }

  .wizards-header {
    margin-bottom: 2rem;
  }

  .back-btn {
    background: transparent;
    border: 1px solid var(--primary, #00d9ff);
    color: var(--primary, #00d9ff);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .back-btn:hover {
    background: rgba(0, 217, 255, 0.1);
  }

  .wizards-header h1 {
    font-size: 1.75rem;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    color: var(--text-secondary, #94a3b8);
    font-size: 0.95rem;
    margin: 0;
  }

  .wizards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .wizard-card {
    background: var(--bg-secondary, #1a2332);
    border: 1px solid var(--border, #334155);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .wizard-icon {
    font-size: 1.75rem;
  }

  .wizard-name {
    font-size: 1.1rem;
    margin: 0;
    font-weight: 600;
  }

  .wizard-desc {
    font-size: 0.9rem;
    color: var(--text-secondary, #94a3b8);
    margin: 0;
    line-height: 1.4;
    flex: 1;
  }

  .wizard-where {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
    margin: 0;
    line-height: 1.35;
  }

  .wizard-where strong {
    color: var(--primary, #00d9ff);
  }

  .open-in-module {
    align-self: flex-start;
    background: var(--primary, #00d9ff);
    color: #0f1419;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }

  .open-in-module:hover {
    filter: brightness(1.1);
  }

  .wizards-header-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .wizards-pulldown-wrap { position: relative; display: inline-block; }
  .wizards-pulldown-trigger {
    padding: 0.5rem 0.75rem;
    background: var(--primary, #00d9ff);
    color: #0f1419;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .wizards-pulldown-trigger:hover { filter: brightness(1.1); }
  .wizards-pulldown-trigger.open { box-shadow: 0 0 0 2px rgba(0, 217, 255, 0.5); }
  .wizards-pulldown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    min-width: 240px;
    max-height: 60vh;
    overflow-y: auto;
    background: var(--bg-secondary, #1a2332);
    border: 1px solid var(--border, #334155);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    padding: 4px 0;
  }
  .wizards-pulldown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.9rem;
    text-align: left;
    cursor: pointer;
  }
  .wizards-pulldown-item:hover { background: rgba(0, 217, 255, 0.15); color: var(--primary); }
  .wizards-pulldown-icon { font-size: 1rem; }
</style>
