/**
 * Module Access Configuration Service
 * 
 * Manages role-based module access configuration for tenants
 */

import { db } from '$lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserRole, ModuleAccess } from '$lib/models/userRole';
import { DEFAULT_MODULE_ACCESS } from '$lib/models/userRole';

/**
 * Tenant module configuration
 */
export interface TenantModuleConfig {
  // Module configuration per role
  roleModuleAccess: Record<UserRole, ModuleAccess>;
  
  // Globally enabled modules for the tenant
  enabledModules: {
    pciResolution: boolean;
    cbrsManagement: boolean;
    acsManagement: boolean;
    hssManagement: boolean;
    coverageMap: boolean;
    inventory: boolean;
    workOrders: boolean;
    helpDesk: boolean;
    distributedEpc: boolean;
    monitoring: boolean;
    backendManagement: boolean;
    voiceTelephony: boolean;
  };
  
  updatedAt: string;
  updatedBy: string;
}

/**
 * Get module access configuration for tenant
 */
export async function getTenantModuleConfig(tenantId: string): Promise<TenantModuleConfig | null> {
  try {
    const configRef = doc(db(), 'tenants', tenantId, 'config', 'modules');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      return null;
    }
    
    return configDoc.data() as TenantModuleConfig;
  } catch (error) {
    console.error('Error fetching module config:', error);
    throw error;
  }
}

/**
 * Update module access for a specific role
 */
export async function updateRoleModuleAccess(
  tenantId: string,
  role: UserRole,
  moduleAccess: ModuleAccess,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db(), 'tenants', tenantId, 'config', 'modules');
    
    // Get existing config or create new one
    const configDoc = await getDoc(configRef);
    const existingConfig = configDoc.exists() ? configDoc.data() : {};
    
    // Update role module access
    const updatedConfig = {
      ...existingConfig,
      roleModuleAccess: {
        ...(existingConfig.roleModuleAccess || {}),
        [role]: moduleAccess
      },
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };
    
    await setDoc(configRef, updatedConfig, { merge: true });
  } catch (error) {
    console.error('Error updating role module access:', error);
    throw error;
  }
}

/**
 * Update globally enabled modules for tenant
 */
export async function updateEnabledModules(
  tenantId: string,
  enabledModules: TenantModuleConfig['enabledModules'],
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db(), 'tenants', tenantId, 'config', 'modules');
    
    await setDoc(configRef, {
      enabledModules,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    }, { merge: true });
  } catch (error) {
    console.error('Error updating enabled modules:', error);
    throw error;
  }
}

/**
 * Reset module access for a role to defaults
 */
export async function resetRoleToDefaults(
  tenantId: string,
  role: UserRole,
  userId: string
): Promise<void> {
  try {
    const defaultAccess = DEFAULT_MODULE_ACCESS[role];
    await updateRoleModuleAccess(tenantId, role, defaultAccess, userId);
  } catch (error) {
    console.error('Error resetting role to defaults:', error);
    throw error;
  }
}

/**
 * Reset all roles to defaults
 */
export async function resetAllRolesToDefaults(
  tenantId: string,
  userId: string
): Promise<void> {
  try {
    const configRef = doc(db(), 'tenants', tenantId, 'config', 'modules');
    
    await setDoc(configRef, {
      roleModuleAccess: DEFAULT_MODULE_ACCESS,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    }, { merge: true });
  } catch (error) {
    console.error('Error resetting all roles:', error);
    throw error;
  }
}

/**
 * Get module access for a specific role (with tenant overrides)
 */
export async function getRoleModuleAccess(
  tenantId: string,
  role: UserRole
): Promise<ModuleAccess> {
  try {
    const config = await getTenantModuleConfig(tenantId);
    
    if (config?.roleModuleAccess?.[role]) {
      return config.roleModuleAccess[role];
    }
    
    // Return defaults if no custom config
    return DEFAULT_MODULE_ACCESS[role];
  } catch (error) {
    console.error('Error getting role module access:', error);
    return DEFAULT_MODULE_ACCESS[role];
  }
}

