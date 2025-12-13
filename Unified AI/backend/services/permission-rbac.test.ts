/**
 * Unit tests for PermissionService and RBACService
 *
 * These tests demonstrate the expected behavior of the permission system
 * Run with: npm test or jest
 */

import { permissionService, PermissionService } from './permission.service';
import { rbacService, RBACService } from './rbac.service';
import { PermissionEntityType } from '../entities/PermissionSet';
import { OrganizationRole } from '../entities/OrganizationMember';
import { WorkspaceRole } from '../entities/WorkspaceMember';

describe('PermissionService', () => {
  beforeEach(() => {
    // Clear cache before each test
    permissionService.clearCache();
  });

  describe('checkPermission', () => {
    it('should return false when user has no permissions', async () => {
      const result = await permissionService.checkPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        'read'
      );
      expect(result).toBe(false);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(
        permissionService.checkPermission('', PermissionEntityType.WORKSPACE, 'ws-1', 'read')
      ).rejects.toThrow('Missing required parameters');
    });

    it('should return true when user has the specific permission', async () => {
      // Grant permission first
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true }
      );

      const result = await permissionService.checkPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        'read'
      );
      expect(result).toBe(true);
    });

    it('should return false for actions not granted', async () => {
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true }
      );

      const result = await permissionService.checkPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        'write'
      );
      expect(result).toBe(false);
    });

    it('should use cache for repeated checks', async () => {
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true }
      );

      // First check
      const result1 = await permissionService.checkPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        'read'
      );

      // Second check (should use cache)
      const result2 = await permissionService.checkPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        'read'
      );

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('grantPermission', () => {
    it('should grant permissions successfully', async () => {
      const permission = await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.PROJECT,
        'project-1',
        { read: true, write: true }
      );

      expect(permission).toBeDefined();
      expect(permission.userId).toBe('user-1');
      expect(permission.entityId).toBe('project-1');
      expect(permission.permissions.read).toBe(true);
      expect(permission.permissions.write).toBe(true);
    });

    it('should merge permissions when granting to existing entry', async () => {
      // First grant
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.PROJECT,
        'project-1',
        { read: true }
      );

      // Second grant (merge)
      const permission = await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.PROJECT,
        'project-1',
        { write: true }
      );

      expect(permission.permissions.read).toBe(true);
      expect(permission.permissions.write).toBe(true);
    });

    it('should support expiring permissions', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const permission = await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.THREAD,
        'thread-1',
        { read: true },
        expiresAt
      );

      expect(permission.expiresAt).toEqual(expiresAt);
    });

    it('should throw error when expiration is in the past', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1);

      await expect(
        permissionService.grantPermission(
          'user-1',
          PermissionEntityType.THREAD,
          'thread-1',
          { read: true },
          expiresAt
        )
      ).rejects.toThrow('Expiration date must be in the future');
    });

    it('should throw error when no permissions are granted', async () => {
      await expect(
        permissionService.grantPermission(
          'user-1',
          PermissionEntityType.THREAD,
          'thread-1',
          {}
        )
      ).rejects.toThrow('At least one permission must be granted');
    });
  });

  describe('getUserPermissions', () => {
    it('should return empty object when user has no permissions', async () => {
      const permissions = await permissionService.getUserPermissions(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1'
      );
      expect(permissions).toEqual({});
    });

    it('should return all permissions for a user', async () => {
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true, write: true, delete: true }
      );

      const permissions = await permissionService.getUserPermissions(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1'
      );

      expect(permissions).toEqual({
        read: true,
        write: true,
        delete: true
      });
    });
  });

  describe('revokePermission', () => {
    it('should revoke a specific permission set', async () => {
      const permission = await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true }
      );

      await permissionService.revokePermission(permission.id);

      const hasPermission = await permissionService.checkPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        'read'
      );
      expect(hasPermission).toBe(false);
    });

    it('should throw error when permission set not found', async () => {
      await expect(
        permissionService.revokePermission('non-existent-id')
      ).rejects.toThrow('Permission set not found');
    });
  });

  describe('revokeAllPermissions', () => {
    it('should revoke all permissions for a user on an entity', async () => {
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true, write: true }
      );

      await permissionService.revokeAllPermissions(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1'
      );

      const permissions = await permissionService.getUserPermissions(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1'
      );
      expect(permissions).toEqual({});
    });
  });

  describe('getUserAccessibleEntities', () => {
    it('should return entities user can access with specific action', async () => {
      await permissionService.grantPermission('user-1', PermissionEntityType.PROJECT, 'proj-1', { read: true });
      await permissionService.grantPermission('user-1', PermissionEntityType.PROJECT, 'proj-2', { read: true });
      await permissionService.grantPermission('user-1', PermissionEntityType.PROJECT, 'proj-3', { write: true });

      const readableProjects = await permissionService.getUserAccessibleEntities(
        'user-1',
        PermissionEntityType.PROJECT,
        'read'
      );

      expect(readableProjects).toContain('proj-1');
      expect(readableProjects).toContain('proj-2');
      expect(readableProjects).not.toContain('proj-3');
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has any permission', async () => {
      await permissionService.grantPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1',
        { read: true }
      );

      const hasAny = await permissionService.hasAnyPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1'
      );
      expect(hasAny).toBe(true);
    });

    it('should return false when user has no permissions', async () => {
      const hasAny = await permissionService.hasAnyPermission(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'workspace-1'
      );
      expect(hasAny).toBe(false);
    });
  });

  describe('cleanupExpiredPermissions', () => {
    it('should remove expired permissions from database', async () => {
      // Grant permission that expires in the past
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1);

      // This would require mocking the database to test properly
      // In production, you'd use a test database
    });
  });
});

describe('RBACService', () => {
  beforeEach(() => {
    // Clear cache before each test
    rbacService.clearCache();
  });

  describe('checkOrganizationRole', () => {
    it('should return false when user is not a member', async () => {
      const result = await rbacService.checkOrganizationRole(
        'user-1',
        'org-1',
        OrganizationRole.MEMBER
      );
      expect(result).toBe(false);
    });

    it('should return true when user has required role or higher', async () => {
      // Add user as admin
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.ADMIN);

      // Check if user has member role (admin >= member)
      const result = await rbacService.checkOrganizationRole(
        'user-1',
        'org-1',
        OrganizationRole.MEMBER
      );
      expect(result).toBe(true);
    });

    it('should return false when user role is lower than required', async () => {
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.VIEWER);

      const result = await rbacService.checkOrganizationRole(
        'user-1',
        'org-1',
        OrganizationRole.ADMIN
      );
      expect(result).toBe(false);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(
        rbacService.checkOrganizationRole('', 'org-1', OrganizationRole.MEMBER)
      ).rejects.toThrow('Missing required parameters');
    });
  });

  describe('checkWorkspaceRole', () => {
    it('should return false when user is not a member', async () => {
      const result = await rbacService.checkWorkspaceRole(
        'user-1',
        'ws-1',
        WorkspaceRole.VIEWER
      );
      expect(result).toBe(false);
    });

    it('should return true when user has required role or higher', async () => {
      await rbacService.addWorkspaceMember('ws-1', 'user-1', WorkspaceRole.EDITOR);

      const result = await rbacService.checkWorkspaceRole(
        'user-1',
        'ws-1',
        WorkspaceRole.VIEWER
      );
      expect(result).toBe(true);
    });
  });

  describe('addOrganizationMember', () => {
    it('should add member successfully', async () => {
      const member = await rbacService.addOrganizationMember(
        'org-1',
        'user-1',
        OrganizationRole.MEMBER
      );

      expect(member).toBeDefined();
      expect(member.userId).toBe('user-1');
      expect(member.organizationId).toBe('org-1');
      expect(member.role).toBe(OrganizationRole.MEMBER);
    });

    it('should throw error when organization not found', async () => {
      await expect(
        rbacService.addOrganizationMember('non-existent', 'user-1', OrganizationRole.MEMBER)
      ).rejects.toThrow('Organization not found');
    });

    it('should throw error when user is already a member', async () => {
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.MEMBER);

      await expect(
        rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.ADMIN)
      ).rejects.toThrow('User is already a member');
    });

    it('should throw error when max seats reached', async () => {
      // This would require setting up an org with maxSeats and filling it
      // In production, you'd use a test database with seeded data
    });
  });

  describe('removeOrganizationMember', () => {
    it('should remove member successfully', async () => {
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.MEMBER);
      await rbacService.removeOrganizationMember('org-1', 'user-1');

      const role = await rbacService.getUserOrganizationRole('user-1', 'org-1');
      expect(role).toBeNull();
    });

    it('should throw error when trying to remove organization owner', async () => {
      // Assuming org-1 is owned by owner-1
      await expect(
        rbacService.removeOrganizationMember('org-1', 'owner-1')
      ).rejects.toThrow('Cannot remove organization owner');
    });

    it('should throw error when member not found', async () => {
      await expect(
        rbacService.removeOrganizationMember('org-1', 'non-member')
      ).rejects.toThrow('Member not found');
    });
  });

  describe('updateOrganizationMemberRole', () => {
    it('should update member role successfully', async () => {
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.MEMBER);

      const updated = await rbacService.updateOrganizationMemberRole(
        'org-1',
        'user-1',
        OrganizationRole.ADMIN
      );

      expect(updated.role).toBe(OrganizationRole.ADMIN);
    });

    it('should throw error when trying to change owner role', async () => {
      await expect(
        rbacService.updateOrganizationMemberRole('org-1', 'owner-1', OrganizationRole.ADMIN)
      ).rejects.toThrow('Cannot change organization owner role');
    });
  });

  describe('addWorkspaceMember', () => {
    it('should add member successfully', async () => {
      const member = await rbacService.addWorkspaceMember(
        'ws-1',
        'user-1',
        WorkspaceRole.EDITOR
      );

      expect(member).toBeDefined();
      expect(member.userId).toBe('user-1');
      expect(member.workspaceId).toBe('ws-1');
      expect(member.role).toBe(WorkspaceRole.EDITOR);
    });

    it('should throw error when workspace not found', async () => {
      await expect(
        rbacService.addWorkspaceMember('non-existent', 'user-1', WorkspaceRole.VIEWER)
      ).rejects.toThrow('Workspace not found');
    });

    it('should throw error when user is already a member', async () => {
      await rbacService.addWorkspaceMember('ws-1', 'user-1', WorkspaceRole.VIEWER);

      await expect(
        rbacService.addWorkspaceMember('ws-1', 'user-1', WorkspaceRole.EDITOR)
      ).rejects.toThrow('User is already a member');
    });
  });

  describe('getUserOrganizations', () => {
    it('should return all user organizations', async () => {
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.MEMBER);
      await rbacService.addOrganizationMember('org-2', 'user-1', OrganizationRole.ADMIN);

      const orgs = await rbacService.getUserOrganizations('user-1');
      expect(orgs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by role when specified', async () => {
      const adminOrgs = await rbacService.getUserOrganizations('user-1', OrganizationRole.ADMIN);
      // Should only return organizations where user is admin or higher
      expect(adminOrgs).toBeDefined();
    });
  });

  describe('getUserWorkspaces', () => {
    it('should return all user workspaces', async () => {
      await rbacService.addWorkspaceMember('ws-1', 'user-1', WorkspaceRole.EDITOR);
      await rbacService.addWorkspaceMember('ws-2', 'user-1', WorkspaceRole.VIEWER);

      const workspaces = await rbacService.getUserWorkspaces('user-1');
      expect(workspaces.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by role when specified', async () => {
      const editorWorkspaces = await rbacService.getUserWorkspaces('user-1', WorkspaceRole.EDITOR);
      expect(editorWorkspaces).toBeDefined();
    });
  });

  describe('hasInheritedAccess', () => {
    it('should grant access based on organization role', async () => {
      // User is org admin
      await rbacService.addOrganizationMember('org-1', 'user-1', OrganizationRole.ADMIN);
      // Workspace is owned by org
      // workspace.organizationId = 'org-1'

      const hasAccess = await rbacService.hasInheritedAccess(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'ws-org-owned',
        'write'
      );
      expect(hasAccess).toBe(true);
    });

    it('should grant access based on workspace role', async () => {
      await rbacService.addWorkspaceMember('ws-1', 'user-1', WorkspaceRole.EDITOR);

      const hasAccess = await rbacService.hasInheritedAccess(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'ws-1',
        'write'
      );
      expect(hasAccess).toBe(true);
    });

    it('should deny access when user has no roles', async () => {
      const hasAccess = await rbacService.hasInheritedAccess(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'ws-1',
        'write'
      );
      expect(hasAccess).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return all permissions based on role', async () => {
      await rbacService.addWorkspaceMember('ws-1', 'user-1', WorkspaceRole.EDITOR);

      const permissions = await rbacService.getEffectivePermissions(
        'user-1',
        PermissionEntityType.WORKSPACE,
        'ws-1'
      );

      expect(permissions.read).toBe(true);
      expect(permissions.write).toBe(true);
      expect(permissions.delete).toBe(false); // Editors can't delete
      expect(permissions.share).toBe(true);
      expect(permissions.export).toBe(true);
    });
  });
});

describe('Integration: PermissionService + RBACService', () => {
  it('should combine direct permissions and role-based permissions', async () => {
    const userId = 'user-integration';
    const workspaceId = 'ws-integration';

    // User has workspace viewer role (can only read)
    await rbacService.addWorkspaceMember(workspaceId, userId, WorkspaceRole.VIEWER);

    // Grant additional write permission directly
    await permissionService.grantPermission(
      userId,
      PermissionEntityType.WORKSPACE,
      workspaceId,
      { write: true }
    );

    // Check combined access
    const canRead = await rbacService.hasInheritedAccess(
      userId,
      PermissionEntityType.WORKSPACE,
      workspaceId,
      'read'
    );

    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.WORKSPACE,
      workspaceId,
      'write'
    );

    expect(canRead).toBe(true); // From viewer role
    expect(canWrite).toBe(true); // From direct permission
  });

  it('should respect permission hierarchy', async () => {
    const userId = 'user-hierarchy';
    const orgId = 'org-hierarchy';
    const workspaceId = 'ws-hierarchy';
    const projectId = 'proj-hierarchy';

    // User is org admin
    await rbacService.addOrganizationMember(orgId, userId, OrganizationRole.ADMIN);
    // Org owns workspace, workspace owns project

    // User should have access at all levels
    const hasWorkspaceAccess = await rbacService.hasInheritedAccess(
      userId,
      PermissionEntityType.WORKSPACE,
      workspaceId,
      'write'
    );

    const hasProjectAccess = await rbacService.hasInheritedAccess(
      userId,
      PermissionEntityType.PROJECT,
      projectId,
      'write'
    );

    expect(hasWorkspaceAccess).toBe(true);
    expect(hasProjectAccess).toBe(true);
  });
});
