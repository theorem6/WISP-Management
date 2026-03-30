/**
 * User Role System - Type Definitions
 * 
 * Defines user roles, module access permissions, and work order permissions
 * for the multi-tenant WISP management platform.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// USER ROLES
// ============================================================================

/**
 * User role types in the system
 */
export type UserRole = 
  | 'platform_admin'  // Super admin (admin@wisptools.io only)
  | 'owner'           // Tenant creator, full access
  | 'admin'           // Full management, configurable modules
  | 'engineer'        // Network engineer - technical modules
  | 'installer'       // Field technician - field ops only
  | 'helpdesk'        // Support staff - tickets and customer service
  | 'support'         // Customer support - portal management only
  | 'viewer';         // Read-only access

/**
 * Human-readable role names
 */
export const ROLE_NAMES: Record<UserRole, string> = {
  platform_admin: 'Platform Admin',
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  installer: 'Field Technician',
  helpdesk: 'Help Desk',
  support: 'Customer Support',
  viewer: 'Viewer'
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  platform_admin: 'Super administrator with access to all tenants and features',
  owner: 'Tenant owner with full control over all settings and users',
  admin: 'Administrator with user management and configurable module access',
  engineer: 'Network engineer with access to technical modules',
  installer: 'Field technician with mobile app and field operations access',
  helpdesk: 'Support staff with ticketing and customer service access',
  support: 'Customer support agent with portal management access only',
  viewer: 'Read-only access to reports and dashboards'
};

// ============================================================================
// MODULE ACCESS PERMISSIONS
// ============================================================================

/**
 * Module access permissions for a user/role
 */
export interface ModuleAccess {
  // Core Technical Modules
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
  
  // Admin Modules
  userManagement: boolean;
  tenantSettings: boolean;
  backendManagement: boolean;
  billing: boolean;
  
  // Platform Admin Only
  tenantManagement: boolean;

  /** Voice / SIP / UC — numbers, E911, porting */
  voiceTelephony: boolean;
}

/**
 * Permission levels for module access
 */
export interface ModulePermissionLevel {
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

/**
 * Default module access per role
 */
export const DEFAULT_MODULE_ACCESS: Record<UserRole, ModuleAccess> = {
  platform_admin: {
    // Full access to everything
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: true,
    billing: true,
    tenantManagement: true,
    voiceTelephony: true
  },
  
  owner: {
    // Full tenant access
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: false,
    billing: true,
    tenantManagement: false,
    voiceTelephony: true
  },
  
  admin: {
    // Configurable by owner
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: true,
    tenantSettings: true,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    voiceTelephony: true
  },
  
  engineer: {
    // Technical modules only
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: false,
    distributedEpc: true,
    monitoring: true,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    voiceTelephony: true
  },
  
  installer: {
    // Field operations only
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: false,
    hssManagement: false,
    coverageMap: true,      // View only
    inventory: true,         // Checkout/deploy only
    workOrders: true,        // Assigned tickets only
    helpDesk: false,
    distributedEpc: false,
    monitoring: false,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    voiceTelephony: false
  },
  
  helpdesk: {
    // Customer support modules
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: true,     // Troubleshoot CPEs
    hssManagement: false,
    coverageMap: true,       // View only
    inventory: true,         // View only
    workOrders: true,        // Create/view/assign
    helpDesk: true,          // Full access
    distributedEpc: false,
    monitoring: true,        // View only
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    voiceTelephony: true
  },
  
  support: {
    // Customer portal support only - goes directly to support dashboard
    pciResolution: false,
    cbrsManagement: false,
    acsManagement: false,
    hssManagement: false,
    coverageMap: false,
    inventory: false,
    workOrders: false,
    helpDesk: true,          // Customer tickets
    distributedEpc: false,
    monitoring: false,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    voiceTelephony: false
  },
  
  viewer: {
    // Read-only everything
    pciResolution: true,
    cbrsManagement: true,
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    workOrders: true,
    helpDesk: true,
    distributedEpc: true,
    monitoring: true,
    userManagement: false,
    tenantSettings: false,
    backendManagement: false,
    billing: false,
    tenantManagement: false,
    voiceTelephony: true
  }
};

// ============================================================================
// WORK ORDER PERMISSIONS
// ============================================================================

/**
 * Work order-specific permissions
 */
export interface WorkOrderPermissions {
  canViewAll: boolean;         // See all tickets in tenant
  canViewAssigned: boolean;    // See only tickets assigned to user
  canCreate: boolean;          // Create new tickets
  canAssign: boolean;          // Assign tickets to others
  canReassign: boolean;        // Change ticket assignments
  canClose: boolean;           // Mark tickets as resolved/closed
  canDelete: boolean;          // Delete tickets
  canEscalate: boolean;        // Escalate ticket priority
}

/**
 * Default work order permissions per role
 */
export const DEFAULT_WORK_ORDER_PERMISSIONS: Record<UserRole, WorkOrderPermissions> = {
  platform_admin: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  
  owner: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  
  admin: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: true,
    canEscalate: true
  },
  
  engineer: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: false,
    canReassign: false,
    canClose: true,
    canDelete: false,
    canEscalate: true
  },
  
  installer: {
    canViewAll: false,          // Only their tickets
    canViewAssigned: true,
    canCreate: false,
    canAssign: false,
    canReassign: false,
    canClose: true,
    canDelete: false,
    canEscalate: false
  },
  
  helpdesk: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: true,
    canReassign: true,
    canClose: true,
    canDelete: false,
    canEscalate: true
  },
  
  support: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: true,
    canAssign: false,
    canReassign: false,
    canClose: true,
    canDelete: false,
    canEscalate: false
  },
  
  viewer: {
    canViewAll: true,
    canViewAssigned: true,
    canCreate: false,
    canAssign: false,
    canReassign: false,
    canClose: false,
    canDelete: false,
    canEscalate: false
  }
};

// ============================================================================
// USER PROFILE INTERFACES
// ============================================================================

/**
 * FCM token for push notifications
 */
export interface FCMToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  lastUpdated: Timestamp;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  workOrders: boolean;
  systemAlerts: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

/**
 * Extended user profile
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  
  // Role-based access
  primaryRole: UserRole;
  
  // Push notification tokens
  fcmTokens?: Record<string, FCMToken>;
  
  // Notification preferences
  notifications?: NotificationPreferences;
  
  // Metadata
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  isActive: boolean;
  isPlatformAdmin: boolean;
}

/**
 * User-tenant relationship
 */
export interface UserTenant {
  userId: string;
  tenantId: string;
  
  // Role in this tenant
  role: UserRole;
  
  // Custom module permissions (overrides defaults)
  moduleAccess?: ModuleAccess;
  
  // Work order permissions
  workOrderPermissions?: WorkOrderPermissions;
  
  // Status
  status: 'active' | 'suspended' | 'pending_invitation';
  
  // Invitation tracking
  invitedBy?: string;
  invitedAt?: Timestamp;
  acceptedAt?: Timestamp;
  
  // Metadata
  addedAt: Timestamp;
  lastAccessAt?: Timestamp;
}

/**
 * Tenant configuration with role-based access
 */
export interface TenantConfigWithRoles {
  // Module configuration
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
    billing: boolean;
    voiceTelephony: boolean;
  };
  
  // Role-specific module access (tenant admin can customize)
  roleModuleAccess?: Record<UserRole, ModuleAccess>;
  
  // Feature limits
  limits: {
    maxUsers: number;
    maxSites: number;
    maxSubscribers: number;
    maxCPEs: number;
    maxStorageGB: number;
  };
  
  // Subscription
  subscriptionTier: 'free' | 'starter' | 'professional' | 'enterprise';
  subscriptionStatus: 'active' | 'trial' | 'suspended' | 'cancelled';
  
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a role has permission to manage users
 */
export function canManageUsers(role: UserRole): boolean {
  return role === 'platform_admin' || role === 'owner' || role === 'admin';
}

/**
 * Check if a role has permission to configure tenant settings
 */
export function canConfigureTenant(role: UserRole): boolean {
  return role === 'platform_admin' || role === 'owner' || role === 'admin';
}

/**
 * Check if a role is an admin-level role
 */
export function isAdminRole(role: UserRole): boolean {
  return role === 'platform_admin' || role === 'owner' || role === 'admin';
}

/**
 * Check if a role is a technical role
 */
export function isTechnicalRole(role: UserRole): boolean {
  return role === 'engineer' || role === 'installer';
}

/**
 * Check if a role is field operations
 */
export function isFieldRole(role: UserRole): boolean {
  return role === 'installer';
}

/**
 * Get module access for a role with optional tenant overrides
 */
export function getModuleAccess(
  role: UserRole,
  tenantOverrides?: Record<UserRole, ModuleAccess>
): ModuleAccess {
  if (tenantOverrides && tenantOverrides[role]) {
    return tenantOverrides[role];
  }
  return DEFAULT_MODULE_ACCESS[role];
}

/**
 * Get work order permissions for a role
 */
export function getWorkOrderPermissions(role: UserRole): WorkOrderPermissions {
  return DEFAULT_WORK_ORDER_PERMISSIONS[role];
}

/**
 * Get all roles that can be assigned (excluding platform_admin)
 */
export function getAssignableRoles(): UserRole[] {
  return ['owner', 'admin', 'engineer', 'installer', 'helpdesk', 'support', 'viewer'];
}

/**
 * Get roles that can be created by the given role
 */
export function getCreatableRoles(role: UserRole): UserRole[] {
  switch (role) {
    case 'platform_admin':
      return ['owner', 'admin', 'engineer', 'installer', 'helpdesk', 'support', 'viewer'];
    case 'owner':
    case 'admin':
      return ['admin', 'engineer', 'installer', 'helpdesk', 'support', 'viewer'];
    default:
      return [];
  }
}

/**
 * Validate if a role can create another role
 */
export function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  const creatableRoles = getCreatableRoles(creatorRole);
  return creatableRoles.includes(targetRole);
}

