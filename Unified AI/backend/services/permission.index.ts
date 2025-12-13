/**
 * Permission and RBAC System - Main Export
 *
 * Import both services and types from this single file:
 *
 * import {
 *   permissionService,
 *   rbacService,
 *   PermissionEntityType,
 *   OrganizationRole,
 *   WorkspaceRole,
 *   PermissionAction
 * } from './services/permission.index';
 */

// Services
export { permissionService, PermissionService, PermissionAction, Permissions } from './permission.service';
export { rbacService, RBACService } from './rbac.service';

// Entity types and enums
export { PermissionSet, PermissionEntityType } from '../entities/PermissionSet';
export { OrganizationMember, OrganizationRole } from '../entities/OrganizationMember';
export { WorkspaceMember, WorkspaceRole } from '../entities/WorkspaceMember';

// Type definitions for convenience
export type {
  PermissionAction,
  Permissions
} from './permission.service';

/**
 * Quick authorization helper
 *
 * Checks both direct permissions and role-based access
 * This is the recommended way to check authorization
 */
export async function authorize(
  userId: string,
  entityType: PermissionEntityType,
  entityId: string,
  action: PermissionAction
): Promise<boolean> {
  // Check direct permissions + ownership
  const hasDirectAccess = await permissionService.canUserAccess(
    userId,
    entityType,
    entityId,
    action
  );

  if (hasDirectAccess) {
    return true;
  }

  // Check role-based access
  const hasRoleAccess = await rbacService.hasInheritedAccess(
    userId,
    entityType,
    entityId,
    action
  );

  return hasRoleAccess;
}

/**
 * Get all effective permissions for a user on an entity
 *
 * Merges direct permissions and role-based permissions
 */
export async function getEffectivePermissions(
  userId: string,
  entityType: PermissionEntityType,
  entityId: string
): Promise<Permissions> {
  // Get direct permissions
  const directPermissions = await permissionService.getUserPermissions(
    userId,
    entityType,
    entityId
  );

  // Get role-based permissions
  const rolePermissions = await rbacService.getEffectivePermissions(
    userId,
    entityType,
    entityId
  );

  // Merge (OR operation - if either source grants permission, user has it)
  return {
    read: directPermissions.read || rolePermissions.read || false,
    write: directPermissions.write || rolePermissions.write || false,
    delete: directPermissions.delete || rolePermissions.delete || false,
    share: directPermissions.share || rolePermissions.share || false,
    export: directPermissions.export || rolePermissions.export || false
  };
}

/**
 * Cleanup utilities
 */
export const cleanup = {
  /**
   * Clean up expired permissions from database
   * Should be called periodically (e.g., daily via cron job)
   */
  async cleanupExpiredPermissions(): Promise<number> {
    return await permissionService.cleanupExpiredPermissions();
  },

  /**
   * Clear all in-memory caches
   * Useful after bulk operations
   */
  clearAllCaches(): void {
    permissionService.clearCache();
    rbacService.clearCache();
  },

  /**
   * Clear only expired cache entries
   * Called automatically every 10 minutes
   */
  clearExpiredCaches(): void {
    permissionService.clearExpiredCache();
    rbacService.clearExpiredCache();
  }
};

/**
 * Quick reference for permission actions
 */
export const PERMISSION_ACTIONS = {
  READ: 'read' as PermissionAction,
  WRITE: 'write' as PermissionAction,
  DELETE: 'delete' as PermissionAction,
  SHARE: 'share' as PermissionAction,
  EXPORT: 'export' as PermissionAction
};

/**
 * Default export for convenience
 */
export default {
  permissionService,
  rbacService,
  authorize,
  getEffectivePermissions,
  cleanup,
  PERMISSION_ACTIONS
};
