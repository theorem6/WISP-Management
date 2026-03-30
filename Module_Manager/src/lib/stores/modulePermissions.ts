// Module Permissions Store
// Manages which modules are available based on tenant configuration

import { derived } from 'svelte/store';
import { currentTenant } from './tenantStore';

export interface ModulePermissions {
  pciResolution: boolean;
  cbrsManagement: boolean;
  acsManagement: boolean;
  hssManagement: boolean;
  coverageMap: boolean;
  inventory: boolean;
  workOrders: boolean;
  helpDesk: boolean;
  userManagement: boolean;
  distributedEpc: boolean;
  monitoring: boolean;
  backendManagement: boolean;
  tenantManagement: boolean;
  voiceTelephony: boolean;
}

// Default permissions (if no config exists)
const DEFAULT_PERMISSIONS: ModulePermissions = {
  pciResolution: true,
  cbrsManagement: true,
  acsManagement: true,
  hssManagement: true,
  coverageMap: true,
  inventory: true,
  workOrders: true,
  helpDesk: true,
  userManagement: true,
  distributedEpc: true,
  monitoring: true,
  backendManagement: false,
  tenantManagement: false,
  voiceTelephony: true
};

// Derive module permissions from current tenant
export const modulePermissions = derived(
  currentTenant,
  ($tenant) => {
    if (!$tenant) {
      return DEFAULT_PERMISSIONS;
    }
    
    // Get enabledModules from tenant config
    const config = ($tenant as any).config;
    const enabledModules = config?.enabledModules;
    
    if (!enabledModules) {
      // No config, use defaults
      return DEFAULT_PERMISSIONS;
    }
    
    return {
      pciResolution: enabledModules.pciResolution ?? true,
      cbrsManagement: enabledModules.cbrsManagement ?? true,
      acsManagement: enabledModules.acsManagement ?? true,
      hssManagement: enabledModules.hssManagement ?? true,
      coverageMap: enabledModules.coverageMap ?? true,
      inventory: enabledModules.inventory ?? true,
      workOrders: enabledModules.workOrders ?? true,
      helpDesk: enabledModules.helpDesk ?? true,
      userManagement: enabledModules.userManagement ?? true,
      distributedEpc: enabledModules.distributedEpc ?? false,
      monitoring: enabledModules.monitoring ?? true,
      backendManagement: enabledModules.backendManagement ?? false,
      tenantManagement: enabledModules.tenantManagement ?? false,
      voiceTelephony: enabledModules.voiceTelephony ?? true
    };
  }
);

// Helper to check if a specific module is enabled
export function isModuleEnabled(moduleName: keyof ModulePermissions): boolean {
  let enabled = true;
  
  modulePermissions.subscribe(permissions => {
    enabled = permissions[moduleName] ?? true;
  })();
  
  return enabled;
}

// Module definitions with permission keys
export const MODULE_DEFINITIONS = [
  {
    id: 'pci-resolution',
    permissionKey: 'pciResolution' as keyof ModulePermissions,
    name: 'PCI Resolution & Network Optimization',
    description: 'Physical Cell ID conflict detection, SON optimization, and network self-organization',
    icon: '📊',
    color: 'var(--primary)',
    path: '/modules/pci-resolution'
  },
  {
    id: 'acs-cpe-management',
    permissionKey: 'acsManagement' as keyof ModulePermissions,
    name: 'ACS CPE Management',
    description: 'TR-069 device management and CPE monitoring with GPS mapping',
    icon: '📡',
    color: 'var(--success)',
    path: '/modules/acs-cpe-management'
  },
  {
    id: 'cbrs-management',
    permissionKey: 'cbrsManagement' as keyof ModulePermissions,
    name: 'CBRS Management',
    description: 'Citizens Broadband Radio Service management with Google SAS and Federated Wireless API integration',
    icon: '📡',
    color: '#8b5cf6',
    path: '/modules/cbrs-management'
  },
  {
    id: 'coverage-map',
    permissionKey: 'coverageMap' as keyof ModulePermissions,
    name: 'Coverage Map',
    description: 'Comprehensive network asset mapping with towers, sectors, CPE, and equipment inventory management',
    icon: '🗺️',
    color: '#7c3aed',
    path: '/modules/coverage-map'
  },
  {
    id: 'inventory',
    permissionKey: 'inventory' as keyof ModulePermissions,
    name: 'Inventory Management',
    description: 'Centralized asset tracking with location management, maintenance history, and warranty tracking',
    icon: '📦',
    color: '#10b981',
    path: '/modules/inventory'
  },
  {
    id: 'work-orders',
    permissionKey: 'workOrders' as keyof ModulePermissions,
    name: 'Work Orders & Tickets',
    description: 'Field operations management, trouble tickets, installations, and SLA tracking',
    icon: '📋',
    color: '#f59e0b',
    path: '/modules/work-orders'
  },
  {
    id: 'help-desk',
    permissionKey: 'helpDesk' as keyof ModulePermissions,
    name: 'Help Desk',
    description: 'Customer support ticketing with equipment lookup and quick actions',
    icon: '🎧',
    color: '#06b6d4',
    path: '/modules/help-desk'
  },
  {
    id: 'hss-management',
    permissionKey: 'hssManagement' as keyof ModulePermissions,
    name: 'HSS & Subscriber Management',
    description: 'Home Subscriber Server management with IMSI/Ki/OPc, groups, and bandwidth plans',
    icon: '🔐',
    color: 'var(--warning)',
    path: '/modules/hss-management'
  },
  {
    id: 'user-management',
    permissionKey: 'userManagement' as keyof ModulePermissions,
    name: 'User Management',
    description: 'Manage users, roles, and permissions for your organization',
    icon: '👥',
    color: '#8b5cf6',
    path: '/modules/user-management'
  },
  {
    id: 'monitoring',
    permissionKey: 'monitoring' as keyof ModulePermissions,
    name: 'Monitoring & Alerts',
    description: 'Real-time system monitoring, alerting, and audit logging across all modules',
    icon: '🔍',
    color: '#06b6d4',
    path: '/modules/monitoring'
  },
  {
    id: 'distributed-epc',
    permissionKey: 'distributedEpc' as keyof ModulePermissions,
    name: 'Distributed EPC',
    description: 'Multi-site LTE core network management and deployment',
    icon: '🌐',
    color: '#f59e0b',
    path: '/modules/distributed-epc',
    requiresUpgrade: true
  },
  {
    id: 'voice-telephony',
    permissionKey: 'voiceTelephony' as keyof ModulePermissions,
    name: 'Voice / SIP & UC',
    description: 'Telephone numbers, carrier accounts, E911, porting (LNP), and domain reference',
    icon: '📞',
    color: '#0ea5e9',
    path: '/modules/voice-telephony'
  }
];

// Get available modules for current tenant
export const availableModules = derived(
  modulePermissions,
  ($permissions) => {
    return MODULE_DEFINITIONS.filter(module => 
      $permissions[module.permissionKey]
    );
  }
);

