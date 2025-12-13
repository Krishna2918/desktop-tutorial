import { Repository } from 'typeorm';
import { Organization } from '../entities/Organization';
import { OrganizationMember, OrganizationRole } from '../entities/OrganizationMember';
import { Workspace, WorkspaceOwnerType } from '../entities/Workspace';
import { WorkspaceMember, WorkspaceRole } from '../entities/WorkspaceMember';
import { Project } from '../entities/Project';
import { Thread } from '../entities/Thread';
import { PermissionEntityType } from '../entities/PermissionSet';
import { AppDataSource } from '../config/data-source';
import { PermissionAction, Permissions } from './permission.service';

/**
 * Role hierarchy levels for comparison
 */
const ORGANIZATION_ROLE_LEVELS: Record<OrganizationRole, number> = {
  [OrganizationRole.OWNER]: 4,
  [OrganizationRole.ADMIN]: 3,
  [OrganizationRole.MEMBER]: 2,
  [OrganizationRole.VIEWER]: 1
};

const WORKSPACE_ROLE_LEVELS: Record<WorkspaceRole, number> = {
  [WorkspaceRole.OWNER]: 3,
  [WorkspaceRole.EDITOR]: 2,
  [WorkspaceRole.VIEWER]: 1
};

/**
 * Default permissions for organization roles
 */
const ORGANIZATION_ROLE_PERMISSIONS: Record<OrganizationRole, Record<PermissionAction, boolean>> = {
  [OrganizationRole.OWNER]: {
    read: true,
    write: true,
    delete: true,
    share: true,
    export: true
  },
  [OrganizationRole.ADMIN]: {
    read: true,
    write: true,
    delete: true,
    share: true,
    export: true
  },
  [OrganizationRole.MEMBER]: {
    read: true,
    write: true,
    delete: false,
    share: true,
    export: true
  },
  [OrganizationRole.VIEWER]: {
    read: true,
    write: false,
    delete: false,
    share: false,
    export: true
  }
};

/**
 * Default permissions for workspace roles
 */
const WORKSPACE_ROLE_PERMISSIONS: Record<WorkspaceRole, Record<PermissionAction, boolean>> = {
  [WorkspaceRole.OWNER]: {
    read: true,
    write: true,
    delete: true,
    share: true,
    export: true
  },
  [WorkspaceRole.EDITOR]: {
    read: true,
    write: true,
    delete: false,
    share: true,
    export: true
  },
  [WorkspaceRole.VIEWER]: {
    read: true,
    write: false,
    delete: false,
    share: false,
    export: true
  }
};

/**
 * Cache entry for role checks
 */
interface RoleCacheEntry {
  role: OrganizationRole | WorkspaceRole | null;
  expiresAt: number;
}

/**
 * Service for role-based access control (RBAC)
 * Handles organization and workspace roles with permission inheritance
 */
export class RBACService {
  private organizationRepository: Repository<Organization>;
  private organizationMemberRepository: Repository<OrganizationMember>;
  private workspaceRepository: Repository<Workspace>;
  private workspaceMemberRepository: Repository<WorkspaceMember>;
  private projectRepository: Repository<Project>;
  private threadRepository: Repository<Thread>;

  // In-memory cache for role lookups (5 minute TTL)
  private roleCache: Map<string, RoleCacheEntry> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.organizationMemberRepository = AppDataSource.getRepository(OrganizationMember);
    this.workspaceRepository = AppDataSource.getRepository(Workspace);
    this.workspaceMemberRepository = AppDataSource.getRepository(WorkspaceMember);
    this.projectRepository = AppDataSource.getRepository(Project);
    this.threadRepository = AppDataSource.getRepository(Thread);
  }

  /**
   * Check if user has a specific role or higher in an organization
   */
  async checkOrganizationRole(
    userId: string,
    organizationId: string,
    requiredRole: OrganizationRole
  ): Promise<boolean> {
    if (!userId || !organizationId || !requiredRole) {
      throw new Error('Missing required parameters for role check');
    }

    const userRole = await this.getUserOrganizationRole(userId, organizationId);
    if (!userRole) {
      return false;
    }

    // Check if user's role level is >= required role level
    return ORGANIZATION_ROLE_LEVELS[userRole] >= ORGANIZATION_ROLE_LEVELS[requiredRole];
  }

  /**
   * Check if user has a specific role or higher in a workspace
   */
  async checkWorkspaceRole(
    userId: string,
    workspaceId: string,
    requiredRole: WorkspaceRole
  ): Promise<boolean> {
    if (!userId || !workspaceId || !requiredRole) {
      throw new Error('Missing required parameters for role check');
    }

    const userRole = await this.getUserWorkspaceRole(userId, workspaceId);
    if (!userRole) {
      return false;
    }

    // Check if user's role level is >= required role level
    return WORKSPACE_ROLE_LEVELS[userRole] >= WORKSPACE_ROLE_LEVELS[requiredRole];
  }

  /**
   * Get user's role in an organization
   * Returns null if user is not a member
   */
  async getUserOrganizationRole(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRole | null> {
    if (!userId || !organizationId) {
      throw new Error('Missing required parameters for getting organization role');
    }

    // Check cache
    const cacheKey = `org:${userId}:${organizationId}`;
    const cached = this.roleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.role as OrganizationRole | null;
    }

    // Check if user is organization owner
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId }
    });

    if (organization && organization.ownerId === userId) {
      this.cacheRole(cacheKey, OrganizationRole.OWNER);
      return OrganizationRole.OWNER;
    }

    // Check organization membership
    const membership = await this.organizationMemberRepository.findOne({
      where: {
        userId,
        organizationId
      }
    });

    const role = membership ? membership.role : null;
    this.cacheRole(cacheKey, role);
    return role;
  }

  /**
   * Get user's role in a workspace
   * Returns null if user is not a member
   */
  async getUserWorkspaceRole(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceRole | null> {
    if (!userId || !workspaceId) {
      throw new Error('Missing required parameters for getting workspace role');
    }

    // Check cache
    const cacheKey = `ws:${userId}:${workspaceId}`;
    const cached = this.roleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.role as WorkspaceRole | null;
    }

    // Check if user is workspace owner (for user-owned workspaces)
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId }
    });

    if (workspace) {
      if (workspace.ownerType === WorkspaceOwnerType.USER && workspace.userId === userId) {
        this.cacheRole(cacheKey, WorkspaceRole.OWNER);
        return WorkspaceRole.OWNER;
      }

      // For org-owned workspaces, check if user is org owner/admin
      if (workspace.ownerType === WorkspaceOwnerType.ORGANIZATION && workspace.organizationId) {
        const orgRole = await this.getUserOrganizationRole(userId, workspace.organizationId);
        if (orgRole === OrganizationRole.OWNER || orgRole === OrganizationRole.ADMIN) {
          // Org owners and admins have workspace owner rights
          this.cacheRole(cacheKey, WorkspaceRole.OWNER);
          return WorkspaceRole.OWNER;
        }
      }
    }

    // Check workspace membership
    const membership = await this.workspaceMemberRepository.findOne({
      where: {
        userId,
        workspaceId
      }
    });

    const role = membership ? membership.role : null;
    this.cacheRole(cacheKey, role);
    return role;
  }

  /**
   * Add a member to an organization
   */
  async addOrganizationMember(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    permissions?: Record<string, boolean>
  ): Promise<OrganizationMember> {
    if (!organizationId || !userId || !role) {
      throw new Error('Missing required parameters for adding organization member');
    }

    // Check if organization exists
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check if user is already a member
    const existingMember = await this.organizationMemberRepository.findOne({
      where: {
        organizationId,
        userId
      }
    });

    if (existingMember) {
      throw new Error('User is already a member of this organization');
    }

    // Check seat limits
    const memberCount = await this.organizationMemberRepository.count({
      where: { organizationId }
    });

    if (memberCount >= organization.maxSeats) {
      throw new Error('Organization has reached maximum seats');
    }

    // Create membership
    const member = this.organizationMemberRepository.create({
      organizationId,
      userId,
      role,
      permissions
    });

    await this.organizationMemberRepository.save(member);

    // Invalidate cache
    this.invalidateOrgCache(userId, organizationId);

    return member;
  }

  /**
   * Remove a member from an organization
   */
  async removeOrganizationMember(
    organizationId: string,
    userId: string
  ): Promise<void> {
    if (!organizationId || !userId) {
      throw new Error('Missing required parameters for removing organization member');
    }

    // Check if user is organization owner
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId }
    });

    if (organization && organization.ownerId === userId) {
      throw new Error('Cannot remove organization owner');
    }

    const member = await this.organizationMemberRepository.findOne({
      where: {
        organizationId,
        userId
      }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    await this.organizationMemberRepository.remove(member);

    // Invalidate cache
    this.invalidateOrgCache(userId, organizationId);
  }

  /**
   * Update a member's role in an organization
   */
  async updateOrganizationMemberRole(
    organizationId: string,
    userId: string,
    newRole: OrganizationRole
  ): Promise<OrganizationMember> {
    if (!organizationId || !userId || !newRole) {
      throw new Error('Missing required parameters for updating member role');
    }

    // Check if user is organization owner
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId }
    });

    if (organization && organization.ownerId === userId) {
      throw new Error('Cannot change organization owner role');
    }

    const member = await this.organizationMemberRepository.findOne({
      where: {
        organizationId,
        userId
      }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    member.role = newRole;
    await this.organizationMemberRepository.save(member);

    // Invalidate cache
    this.invalidateOrgCache(userId, organizationId);

    return member;
  }

  /**
   * Add a member to a workspace
   */
  async addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    permissions?: Record<string, boolean>
  ): Promise<WorkspaceMember> {
    if (!workspaceId || !userId || !role) {
      throw new Error('Missing required parameters for adding workspace member');
    }

    // Check if workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId }
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check if user is already a member
    const existingMember = await this.workspaceMemberRepository.findOne({
      where: {
        workspaceId,
        userId
      }
    });

    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Create membership
    const member = this.workspaceMemberRepository.create({
      workspaceId,
      userId,
      role,
      permissions
    });

    await this.workspaceMemberRepository.save(member);

    // Invalidate cache
    this.invalidateWorkspaceCache(userId, workspaceId);

    return member;
  }

  /**
   * Remove a member from a workspace
   */
  async removeWorkspaceMember(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    if (!workspaceId || !userId) {
      throw new Error('Missing required parameters for removing workspace member');
    }

    const member = await this.workspaceMemberRepository.findOne({
      where: {
        workspaceId,
        userId
      }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    await this.workspaceMemberRepository.remove(member);

    // Invalidate cache
    this.invalidateWorkspaceCache(userId, workspaceId);
  }

  /**
   * Get all organizations a user is a member of
   * Optionally filter by role
   */
  async getUserOrganizations(
    userId: string,
    role?: OrganizationRole
  ): Promise<Organization[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const queryBuilder = this.organizationRepository
      .createQueryBuilder('org')
      .leftJoin('org.members', 'member')
      .where('(org.ownerId = :userId OR member.userId = :userId)', { userId })
      .andWhere('org.isDeleted = :isDeleted', { isDeleted: false });

    if (role) {
      queryBuilder.andWhere('(org.ownerId = :userId OR member.role = :role)', { userId, role });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get all workspaces a user can access
   * Optionally filter by role
   */
  async getUserWorkspaces(
    userId: string,
    role?: WorkspaceRole
  ): Promise<Workspace[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const queryBuilder = this.workspaceRepository
      .createQueryBuilder('ws')
      .leftJoin('ws.members', 'member')
      .leftJoin('ws.organizationOwner', 'org')
      .leftJoin('org.members', 'orgMember')
      .where(
        `(
          ws.userId = :userId OR
          member.userId = :userId OR
          (ws.organizationId IS NOT NULL AND (org.ownerId = :userId OR orgMember.userId = :userId))
        )`,
        { userId }
      )
      .andWhere('ws.isArchived = :isArchived', { isArchived: false });

    if (role) {
      queryBuilder.andWhere(
        `(
          (ws.userId = :userId AND :role = '${WorkspaceRole.OWNER}') OR
          member.role = :role
        )`,
        { userId, role }
      );
    }

    return queryBuilder.getMany();
  }

  /**
   * Check if user has access to an entity through role inheritance
   * Follows hierarchy: Organization → Workspace → Project → Thread
   */
  async hasInheritedAccess(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string,
    action: PermissionAction
  ): Promise<boolean> {
    if (!userId || !entityType || !entityId || !action) {
      throw new Error('Missing required parameters for inherited access check');
    }

    try {
      switch (entityType) {
        case PermissionEntityType.WORKSPACE:
          return await this.checkWorkspaceAccess(userId, entityId, action);

        case PermissionEntityType.PROJECT:
          return await this.checkProjectAccess(userId, entityId, action);

        case PermissionEntityType.THREAD:
          return await this.checkThreadAccess(userId, entityId, action);

        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking inherited access:', error);
      return false;
    }
  }

  /**
   * Check workspace access through roles
   */
  private async checkWorkspaceAccess(
    userId: string,
    workspaceId: string,
    action: PermissionAction
  ): Promise<boolean> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId }
    });

    if (!workspace) {
      return false;
    }

    // Check if user owns the workspace
    if (workspace.ownerType === WorkspaceOwnerType.USER && workspace.userId === userId) {
      return true;
    }

    // Check organization ownership
    if (workspace.ownerType === WorkspaceOwnerType.ORGANIZATION && workspace.organizationId) {
      const orgRole = await this.getUserOrganizationRole(userId, workspace.organizationId);
      if (orgRole && this.roleHasPermission(orgRole, action, 'organization')) {
        return true;
      }
    }

    // Check workspace membership
    const wsRole = await this.getUserWorkspaceRole(userId, workspaceId);
    if (wsRole && this.roleHasPermission(wsRole, action, 'workspace')) {
      return true;
    }

    return false;
  }

  /**
   * Check project access through workspace/org roles
   */
  private async checkProjectAccess(
    userId: string,
    projectId: string,
    action: PermissionAction
  ): Promise<boolean> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['workspace']
    });

    if (!project || !project.workspace) {
      return false;
    }

    // Check workspace access (includes org access)
    return await this.checkWorkspaceAccess(userId, project.workspaceId, action);
  }

  /**
   * Check thread access through project/workspace/org roles
   */
  private async checkThreadAccess(
    userId: string,
    threadId: string,
    action: PermissionAction
  ): Promise<boolean> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      return false;
    }

    // Check if user created the thread
    if (thread.createdById === userId) {
      return true;
    }

    // Check project access (includes workspace and org access)
    return await this.checkProjectAccess(userId, thread.projectId, action);
  }

  /**
   * Check if a role has permission for an action
   */
  private roleHasPermission(
    role: OrganizationRole | WorkspaceRole,
    action: PermissionAction,
    roleType: 'organization' | 'workspace'
  ): boolean {
    if (roleType === 'organization') {
      return ORGANIZATION_ROLE_PERMISSIONS[role as OrganizationRole]?.[action] ?? false;
    } else {
      return WORKSPACE_ROLE_PERMISSIONS[role as WorkspaceRole]?.[action] ?? false;
    }
  }

  /**
   * Cache a role lookup result
   */
  private cacheRole(key: string, role: OrganizationRole | WorkspaceRole | null): void {
    this.roleCache.set(key, {
      role,
      expiresAt: Date.now() + this.cacheTTL
    });
  }

  /**
   * Invalidate organization cache for a user
   */
  private invalidateOrgCache(userId: string, organizationId: string): void {
    const cacheKey = `org:${userId}:${organizationId}`;
    this.roleCache.delete(cacheKey);
  }

  /**
   * Invalidate workspace cache for a user
   */
  private invalidateWorkspaceCache(userId: string, workspaceId: string): void {
    const cacheKey = `ws:${userId}:${workspaceId}`;
    this.roleCache.delete(cacheKey);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.roleCache.entries()) {
      if (entry.expiresAt <= now) {
        this.roleCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.roleCache.clear();
  }

  /**
   * Get effective permissions for a user on an entity based on their role
   */
  async getEffectivePermissions(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string
  ): Promise<Permissions> {
    const permissions: Permissions = {
      read: false,
      write: false,
      delete: false,
      share: false,
      export: false
    };

    const actions: PermissionAction[] = ['read', 'write', 'delete', 'share', 'export'];

    for (const action of actions) {
      permissions[action] = await this.hasInheritedAccess(userId, entityType, entityId, action);
    }

    return permissions;
  }
}

// Singleton instance
export const rbacService = new RBACService();

// Cleanup expired cache every 10 minutes
setInterval(() => {
  rbacService.clearExpiredCache();
}, 10 * 60 * 1000);
