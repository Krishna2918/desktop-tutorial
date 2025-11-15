/**
 * Comprehensive examples for using PermissionService and RBACService together
 *
 * This file demonstrates the permission and RBAC model for the Unified AI Hub:
 * - Direct permissions (PermissionSet table)
 * - Role-based permissions (Organization/Workspace members)
 * - Ownership permissions (creator has all rights)
 * - Inherited permissions (org admin can access all workspaces)
 * - Time-limited permissions (expiring grants)
 */

import { permissionService } from './permission.service';
import { rbacService } from './rbac.service';
import { PermissionEntityType } from '../entities/PermissionSet';
import { OrganizationRole } from '../entities/OrganizationMember';
import { WorkspaceRole } from '../entities/WorkspaceMember';

/**
 * Example 1: Organization-level access control
 *
 * Scenario: Alice owns TechCorp, Bob is an admin, Charlie is a member
 */
async function example1_OrganizationRoles() {
  const aliceId = 'user-alice';
  const bobId = 'user-bob';
  const charlieId = 'user-charlie';
  const orgId = 'org-techcorp';

  // Add Bob as admin
  await rbacService.addOrganizationMember(orgId, bobId, OrganizationRole.ADMIN);

  // Add Charlie as member
  await rbacService.addOrganizationMember(orgId, charlieId, OrganizationRole.MEMBER);

  // Check roles
  const aliceRole = await rbacService.getUserOrganizationRole(aliceId, orgId);
  console.log('Alice role:', aliceRole); // OWNER (from organization.ownerId)

  const bobRole = await rbacService.getUserOrganizationRole(bobId, orgId);
  console.log('Bob role:', bobRole); // ADMIN

  // Check if Bob can perform admin actions
  const bobIsAdmin = await rbacService.checkOrganizationRole(
    bobId,
    orgId,
    OrganizationRole.ADMIN
  );
  console.log('Bob is admin:', bobIsAdmin); // true

  // Get all Alice's organizations
  const aliceOrgs = await rbacService.getUserOrganizations(aliceId);
  console.log('Alice organizations:', aliceOrgs);
}

/**
 * Example 2: Workspace-level access with inheritance
 *
 * Scenario: TechCorp owns a workspace, members inherit access
 */
async function example2_WorkspaceInheritance() {
  const aliceId = 'user-alice';
  const bobId = 'user-bob';
  const daveId = 'user-dave';
  const orgId = 'org-techcorp';
  const workspaceId = 'ws-engineering';

  // Workspace is owned by organization (workspace.organizationId = orgId)

  // Check if Bob (org admin) can access the workspace
  const bobCanRead = await rbacService.hasInheritedAccess(
    bobId,
    PermissionEntityType.WORKSPACE,
    workspaceId,
    'read'
  );
  console.log('Bob can read workspace:', bobCanRead); // true (org admin has access)

  // Add Dave as workspace editor (not in organization)
  await rbacService.addWorkspaceMember(workspaceId, daveId, WorkspaceRole.EDITOR);

  // Check Dave's workspace role
  const daveRole = await rbacService.getUserWorkspaceRole(daveId, workspaceId);
  console.log('Dave workspace role:', daveRole); // EDITOR

  // Dave can write but not delete
  const daveCanWrite = await rbacService.hasInheritedAccess(
    daveId,
    PermissionEntityType.WORKSPACE,
    workspaceId,
    'write'
  );
  const daveCanDelete = await rbacService.hasInheritedAccess(
    daveId,
    PermissionEntityType.WORKSPACE,
    workspaceId,
    'delete'
  );
  console.log('Dave can write:', daveCanWrite); // true
  console.log('Dave can delete:', daveCanDelete); // false
}

/**
 * Example 3: Direct permissions on specific entities
 *
 * Scenario: Grant temporary access to a specific project
 */
async function example3_DirectPermissions() {
  const eveId = 'user-eve';
  const projectId = 'proj-secret';

  // Grant Eve temporary read access for 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await permissionService.grantPermission(
    eveId,
    PermissionEntityType.PROJECT,
    projectId,
    { read: true, export: true },
    expiresAt
  );

  // Check if Eve can read the project
  const canRead = await permissionService.checkPermission(
    eveId,
    PermissionEntityType.PROJECT,
    projectId,
    'read'
  );
  console.log('Eve can read project:', canRead); // true

  // Check if Eve can write (not granted)
  const canWrite = await permissionService.checkPermission(
    eveId,
    PermissionEntityType.PROJECT,
    projectId,
    'write'
  );
  console.log('Eve can write project:', canWrite); // false

  // Get all of Eve's permissions on the project
  const evePermissions = await permissionService.getUserPermissions(
    eveId,
    PermissionEntityType.PROJECT,
    projectId
  );
  console.log('Eve permissions:', evePermissions); // { read: true, export: true }
}

/**
 * Example 4: Comprehensive access check (combines all sources)
 *
 * Scenario: Check if a user can access an entity considering all permission sources
 */
async function example4_ComprehensiveAccessCheck() {
  const userId = 'user-frank';
  const threadId = 'thread-important';
  const projectId = 'proj-main';
  const workspaceId = 'ws-engineering';

  // Thread hierarchy: thread -> project -> workspace -> organization

  // Option A: Use permissionService.canUserAccess (checks ownership + direct permissions + inheritance)
  const canAccessViaPermission = await permissionService.canUserAccess(
    userId,
    PermissionEntityType.THREAD,
    threadId,
    'read'
  );

  // Option B: Use rbacService.hasInheritedAccess (checks role-based inheritance)
  const canAccessViaRole = await rbacService.hasInheritedAccess(
    userId,
    PermissionEntityType.THREAD,
    threadId,
    'read'
  );

  // Combined check (recommended pattern)
  const canAccess = canAccessViaPermission || canAccessViaRole;
  console.log('User can access thread:', canAccess);

  // Get effective permissions from roles
  const rolePermissions = await rbacService.getEffectivePermissions(
    userId,
    PermissionEntityType.THREAD,
    threadId
  );
  console.log('Role-based permissions:', rolePermissions);

  // Get direct permissions
  const directPermissions = await permissionService.getUserPermissions(
    userId,
    PermissionEntityType.THREAD,
    threadId
  );
  console.log('Direct permissions:', directPermissions);
}

/**
 * Example 5: Managing workspace members
 *
 * Scenario: Add and remove workspace members, update roles
 */
async function example5_WorkspaceMemberManagement() {
  const workspaceId = 'ws-design';
  const georgeId = 'user-george';
  const helenId = 'user-helen';

  // Add George as editor
  const georgeMembership = await rbacService.addWorkspaceMember(
    workspaceId,
    georgeId,
    WorkspaceRole.EDITOR
  );
  console.log('George added:', georgeMembership);

  // Add Helen as viewer
  await rbacService.addWorkspaceMember(
    workspaceId,
    helenId,
    WorkspaceRole.VIEWER
  );

  // Helen requests more access - upgrade to editor via workspace owner
  // (In production, this would check if requester is workspace owner)
  const helenMembership = await rbacService.addWorkspaceMember(
    workspaceId,
    helenId,
    WorkspaceRole.EDITOR
  );
  // Note: addWorkspaceMember will throw if already member, so in practice
  // you'd need a separate updateWorkspaceMemberRole method (similar to org)

  // Remove George from workspace
  await rbacService.removeWorkspaceMember(workspaceId, georgeId);
  console.log('George removed from workspace');
}

/**
 * Example 6: Permission inheritance chain
 *
 * Scenario: Demonstrate how permissions flow through the hierarchy
 */
async function example6_InheritanceChain() {
  const userId = 'user-ian';
  const orgId = 'org-startup';
  const workspaceId = 'ws-product';
  const projectId = 'proj-mvp';
  const threadId = 'thread-discussion';

  // Ian is an admin in the organization
  await rbacService.addOrganizationMember(orgId, userId, OrganizationRole.ADMIN);

  // Organization owns the workspace (workspace.organizationId = orgId)
  // Workspace contains the project (project.workspaceId = workspaceId)
  // Project contains the thread (thread.projectId = projectId)

  // Ian can access all levels due to organization admin role
  const canAccessWorkspace = await rbacService.hasInheritedAccess(
    userId,
    PermissionEntityType.WORKSPACE,
    workspaceId,
    'write'
  );

  const canAccessProject = await rbacService.hasInheritedAccess(
    userId,
    PermissionEntityType.PROJECT,
    projectId,
    'write'
  );

  const canAccessThread = await rbacService.hasInheritedAccess(
    userId,
    PermissionEntityType.THREAD,
    threadId,
    'write'
  );

  console.log('Org admin can access workspace:', canAccessWorkspace); // true
  console.log('Org admin can access project:', canAccessProject); // true
  console.log('Org admin can access thread:', canAccessThread); // true
}

/**
 * Example 7: Thread ownership
 *
 * Scenario: Thread creator has full access regardless of other permissions
 */
async function example7_ThreadOwnership() {
  const janiceId = 'user-janice';
  const threadId = 'thread-janice-private';

  // Janice created the thread (thread.createdById = janiceId)

  // Even if Janice is not a workspace member, she owns the thread
  const canAccess = await permissionService.canUserAccess(
    janiceId,
    PermissionEntityType.THREAD,
    threadId,
    'delete'
  );
  console.log('Janice can delete her thread:', canAccess); // true (owner)
}

/**
 * Example 8: Listing accessible entities
 *
 * Scenario: Get all entities a user can access
 */
async function example8_ListAccessibleEntities() {
  const userId = 'user-kevin';

  // Get all workspaces Kevin can access
  const workspaces = await rbacService.getUserWorkspaces(userId);
  console.log('Kevin workspaces:', workspaces);

  // Get all projects Kevin has read permission on
  const readableProjects = await permissionService.getUserAccessibleEntities(
    userId,
    PermissionEntityType.PROJECT,
    'read'
  );
  console.log('Kevin readable projects:', readableProjects);

  // Get all organizations Kevin is a member of
  const organizations = await rbacService.getUserOrganizations(userId);
  console.log('Kevin organizations:', organizations);
}

/**
 * Example 9: Permission cleanup
 *
 * Scenario: Remove expired permissions and revoke access
 */
async function example9_PermissionCleanup() {
  const userId = 'user-laura';
  const projectId = 'proj-temp';

  // Grant temporary permission that expires
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

  const permission = await permissionService.grantPermission(
    userId,
    PermissionEntityType.PROJECT,
    projectId,
    { read: true },
    expiresAt
  );

  // Later: revoke the permission manually
  await permissionService.revokePermission(permission.id);

  // Or revoke all permissions for a user on an entity
  await permissionService.revokeAllPermissions(
    userId,
    PermissionEntityType.PROJECT,
    projectId
  );

  // Cleanup expired permissions from database (run periodically)
  const cleanedCount = await permissionService.cleanupExpiredPermissions();
  console.log('Cleaned up permissions:', cleanedCount);
}

/**
 * Example 10: Complete authorization middleware pattern
 *
 * Scenario: How to use these services in API endpoints
 */
async function example10_AuthorizationMiddleware() {
  // Typical API authorization flow
  async function checkThreadAccess(
    userId: string,
    threadId: string,
    requiredAction: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    try {
      // 1. Check direct permissions
      const hasDirectPermission = await permissionService.canUserAccess(
        userId,
        PermissionEntityType.THREAD,
        threadId,
        requiredAction
      );

      if (hasDirectPermission) {
        return true;
      }

      // 2. Check role-based permissions
      const hasRolePermission = await rbacService.hasInheritedAccess(
        userId,
        PermissionEntityType.THREAD,
        threadId,
        requiredAction
      );

      return hasRolePermission;
    } catch (error) {
      console.error('Error checking thread access:', error);
      return false;
    }
  }

  // Usage in API endpoint
  const userId = 'user-mike';
  const threadId = 'thread-sensitive';

  const canRead = await checkThreadAccess(userId, threadId, 'read');
  if (!canRead) {
    throw new Error('Unauthorized: You do not have permission to read this thread');
  }

  // Proceed with the operation
  console.log('Access granted - proceeding with operation');
}

/**
 * Example 11: User-owned vs Organization-owned workspaces
 *
 * Scenario: Different ownership models for workspaces
 */
async function example11_WorkspaceOwnership() {
  const nancyId = 'user-nancy';
  const personalWorkspaceId = 'ws-nancy-personal';
  const orgWorkspaceId = 'ws-company-shared';
  const orgId = 'org-company';

  // Personal workspace (owned by Nancy)
  // workspace.ownerType = USER, workspace.userId = nancyId
  const nancyIsOwner = await rbacService.getUserWorkspaceRole(nancyId, personalWorkspaceId);
  console.log('Nancy role in personal workspace:', nancyIsOwner); // OWNER

  // Organization workspace
  // workspace.ownerType = ORGANIZATION, workspace.organizationId = orgId
  // Nancy's access depends on her organization role
  const orgRole = await rbacService.getUserOrganizationRole(nancyId, orgId);
  const nancyOrgWorkspaceRole = await rbacService.getUserWorkspaceRole(nancyId, orgWorkspaceId);
  console.log('Nancy org role:', orgRole);
  console.log('Nancy role in org workspace:', nancyOrgWorkspaceRole);
  // If orgRole is OWNER/ADMIN, nancyOrgWorkspaceRole will be OWNER
}

/**
 * Example 12: Sharing and collaboration
 *
 * Scenario: Share a thread with external collaborators
 */
async function example12_SharingAndCollaboration() {
  const ownerId = 'user-owner';
  const collaboratorId = 'user-collaborator';
  const threadId = 'thread-shared';

  // Owner shares thread with collaborator (read + export, expires in 30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await permissionService.grantPermission(
    collaboratorId,
    PermissionEntityType.THREAD,
    threadId,
    { read: true, export: true },
    expiresAt
  );

  // Get all users who have access to this thread
  const threadPermissions = await permissionService.getEntityPermissions(
    PermissionEntityType.THREAD,
    threadId
  );

  console.log('Users with access to thread:', threadPermissions.length);
  threadPermissions.forEach(perm => {
    console.log(`- User ${perm.userId}: ${JSON.stringify(perm.permissions)}`);
  });
}

// Export all examples
export {
  example1_OrganizationRoles,
  example2_WorkspaceInheritance,
  example3_DirectPermissions,
  example4_ComprehensiveAccessCheck,
  example5_WorkspaceMemberManagement,
  example6_InheritanceChain,
  example7_ThreadOwnership,
  example8_ListAccessibleEntities,
  example9_PermissionCleanup,
  example10_AuthorizationMiddleware,
  example11_WorkspaceOwnership,
  example12_SharingAndCollaboration
};

/**
 * Quick reference: When to use which service
 *
 * Use PermissionService when:
 * - Granting direct access to specific entities
 * - Creating time-limited access (temporary sharing)
 * - Fine-grained permission control (specific actions)
 * - Checking if user can perform specific action
 *
 * Use RBACService when:
 * - Managing organization/workspace members
 * - Checking role-based access
 * - Getting user's role in org/workspace
 * - Listing all accessible entities based on roles
 *
 * Use both together when:
 * - Comprehensive authorization checks (recommended)
 * - API endpoint authorization
 * - Building admin dashboards
 * - Implementing sharing features
 *
 * Permission hierarchy:
 * 1. Ownership (creator/owner has full access)
 * 2. Organization role (org admin can access all org workspaces)
 * 3. Workspace role (workspace owner can access all projects/threads)
 * 4. Direct permissions (explicit grants on specific entities)
 *
 * Role hierarchy:
 * - Organization: OWNER > ADMIN > MEMBER > VIEWER
 * - Workspace: OWNER > EDITOR > VIEWER
 */
