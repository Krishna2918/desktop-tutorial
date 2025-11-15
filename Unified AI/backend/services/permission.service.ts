import { Repository, In } from 'typeorm';
import { PermissionSet, PermissionEntityType } from '../entities/PermissionSet';
import { Workspace, WorkspaceOwnerType } from '../entities/Workspace';
import { Project } from '../entities/Project';
import { Thread } from '../entities/Thread';
import { AppDataSource } from '../config/data-source';

/**
 * Permission actions supported by the system
 */
export type PermissionAction = 'read' | 'write' | 'delete' | 'share' | 'export';

/**
 * Permission set with all possible actions
 */
export interface Permissions {
  read?: boolean;
  write?: boolean;
  delete?: boolean;
  share?: boolean;
  export?: boolean;
  [key: string]: any;
}

/**
 * Cache entry for permission checks
 */
interface PermissionCacheEntry {
  value: boolean;
  expiresAt: number;
}

/**
 * Service for managing direct permissions on entities
 * Handles permission grants, revocations, and access checks
 */
export class PermissionService {
  private permissionRepository: Repository<PermissionSet>;
  private workspaceRepository: Repository<Workspace>;
  private projectRepository: Repository<Project>;
  private threadRepository: Repository<Thread>;

  // In-memory cache for hot paths (5 minute TTL)
  private cache: Map<string, PermissionCacheEntry> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.permissionRepository = AppDataSource.getRepository(PermissionSet);
    this.workspaceRepository = AppDataSource.getRepository(Workspace);
    this.projectRepository = AppDataSource.getRepository(Project);
    this.threadRepository = AppDataSource.getRepository(Thread);
  }

  /**
   * Check if user has a specific permission on an entity
   * Uses caching for performance
   */
  async checkPermission(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string,
    action: PermissionAction
  ): Promise<boolean> {
    if (!userId || !entityType || !entityId || !action) {
      throw new Error('Missing required parameters for permission check');
    }

    // Check cache first
    const cacheKey = `${userId}:${entityType}:${entityId}:${action}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Check direct permissions
    const permissionSet = await this.permissionRepository.findOne({
      where: {
        userId,
        entityType,
        entityId
      }
    });

    let hasPermission = false;

    if (permissionSet) {
      // Check if permission is expired
      if (permissionSet.expiresAt && permissionSet.expiresAt < new Date()) {
        // Permission expired, remove it
        await this.permissionRepository.remove(permissionSet);
        hasPermission = false;
      } else {
        // Check if the specific action is granted
        hasPermission = permissionSet.permissions[action] === true;
      }
    }

    // Cache the result
    this.cache.set(cacheKey, {
      value: hasPermission,
      expiresAt: Date.now() + this.cacheTTL
    });

    return hasPermission;
  }

  /**
   * Get all permissions a user has on an entity
   */
  async getUserPermissions(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string
  ): Promise<Permissions> {
    if (!userId || !entityType || !entityId) {
      throw new Error('Missing required parameters for getting permissions');
    }

    const permissionSet = await this.permissionRepository.findOne({
      where: {
        userId,
        entityType,
        entityId
      }
    });

    if (!permissionSet) {
      return {};
    }

    // Check if permission is expired
    if (permissionSet.expiresAt && permissionSet.expiresAt < new Date()) {
      await this.permissionRepository.remove(permissionSet);
      return {};
    }

    return permissionSet.permissions;
  }

  /**
   * Grant permissions to a user on an entity
   * Supports time-limited permissions via expiresAt
   */
  async grantPermission(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string,
    permissions: Permissions,
    expiresAt?: Date
  ): Promise<PermissionSet> {
    if (!userId || !entityType || !entityId || !permissions) {
      throw new Error('Missing required parameters for granting permissions');
    }

    // Validate that at least one permission is granted
    const hasAnyPermission = Object.values(permissions).some(value => value === true);
    if (!hasAnyPermission) {
      throw new Error('At least one permission must be granted');
    }

    // Validate expiration date is in the future
    if (expiresAt && expiresAt <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }

    // Check if permission already exists
    let permissionSet = await this.permissionRepository.findOne({
      where: {
        userId,
        entityType,
        entityId
      }
    });

    if (permissionSet) {
      // Update existing permissions (merge)
      permissionSet.permissions = {
        ...permissionSet.permissions,
        ...permissions
      };
      permissionSet.expiresAt = expiresAt;
    } else {
      // Create new permission set
      permissionSet = this.permissionRepository.create({
        userId,
        entityType,
        entityId,
        permissions,
        expiresAt
      });
    }

    await this.permissionRepository.save(permissionSet);

    // Invalidate cache for this user and entity
    this.invalidateCache(userId, entityType, entityId);

    return permissionSet;
  }

  /**
   * Revoke a specific permission set by ID
   */
  async revokePermission(permissionSetId: string): Promise<void> {
    if (!permissionSetId) {
      throw new Error('Permission set ID is required');
    }

    const permissionSet = await this.permissionRepository.findOne({
      where: { id: permissionSetId }
    });

    if (!permissionSet) {
      throw new Error('Permission set not found');
    }

    const { userId, entityType, entityId } = permissionSet;

    await this.permissionRepository.remove(permissionSet);

    // Invalidate cache
    this.invalidateCache(userId!, entityType, entityId);
  }

  /**
   * Revoke all permissions for a user on a specific entity
   */
  async revokeAllPermissions(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string
  ): Promise<void> {
    if (!userId || !entityType || !entityId) {
      throw new Error('Missing required parameters for revoking permissions');
    }

    const permissionSets = await this.permissionRepository.find({
      where: {
        userId,
        entityType,
        entityId
      }
    });

    if (permissionSets.length > 0) {
      await this.permissionRepository.remove(permissionSets);
      this.invalidateCache(userId, entityType, entityId);
    }
  }

  /**
   * Get all permissions for an entity (all users)
   */
  async getEntityPermissions(
    entityType: PermissionEntityType,
    entityId: string
  ): Promise<PermissionSet[]> {
    if (!entityType || !entityId) {
      throw new Error('Missing required parameters for getting entity permissions');
    }

    const permissionSets = await this.permissionRepository.find({
      where: {
        entityType,
        entityId
      },
      relations: ['user']
    });

    // Filter out expired permissions
    const validPermissions: PermissionSet[] = [];
    const expiredPermissions: PermissionSet[] = [];

    for (const permissionSet of permissionSets) {
      if (permissionSet.expiresAt && permissionSet.expiresAt < new Date()) {
        expiredPermissions.push(permissionSet);
      } else {
        validPermissions.push(permissionSet);
      }
    }

    // Clean up expired permissions
    if (expiredPermissions.length > 0) {
      await this.permissionRepository.remove(expiredPermissions);
    }

    return validPermissions;
  }

  /**
   * Get all entities of a specific type that a user can access with a given action
   */
  async getUserAccessibleEntities(
    userId: string,
    entityType: PermissionEntityType,
    action: PermissionAction
  ): Promise<string[]> {
    if (!userId || !entityType || !action) {
      throw new Error('Missing required parameters for getting accessible entities');
    }

    const permissionSets = await this.permissionRepository
      .createQueryBuilder('ps')
      .where('ps.userId = :userId', { userId })
      .andWhere('ps.entityType = :entityType', { entityType })
      .andWhere(`json_extract(ps.permissions, '$.${action}') = 1`)
      .andWhere('(ps.expiresAt IS NULL OR ps.expiresAt > :now)', { now: new Date() })
      .getMany();

    return permissionSets.map(ps => ps.entityId);
  }

  /**
   * Check if user has any permission on an entity (any action)
   */
  async hasAnyPermission(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string
  ): Promise<boolean> {
    if (!userId || !entityType || !entityId) {
      throw new Error('Missing required parameters for permission check');
    }

    const permissionSet = await this.permissionRepository.findOne({
      where: {
        userId,
        entityType,
        entityId
      }
    });

    if (!permissionSet) {
      return false;
    }

    // Check if permission is expired
    if (permissionSet.expiresAt && permissionSet.expiresAt < new Date()) {
      await this.permissionRepository.remove(permissionSet);
      return false;
    }

    // Check if any permission is granted
    return Object.values(permissionSet.permissions).some(value => value === true);
  }

  /**
   * Comprehensive permission check with ownership and inheritance
   * This is the main method to use for access control
   */
  async canUserAccess(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string,
    action: PermissionAction
  ): Promise<boolean> {
    if (!userId || !entityType || !entityId || !action) {
      throw new Error('Missing required parameters for access check');
    }

    try {
      // 1. Check ownership
      const isOwner = await this.checkOwnership(userId, entityType, entityId);
      if (isOwner) {
        return true;
      }

      // 2. Check direct permissions
      const hasDirectPermission = await this.checkPermission(
        userId,
        entityType,
        entityId,
        action
      );
      if (hasDirectPermission) {
        return true;
      }

      // 3. For projects and threads, check inherited permissions from parent entities
      if (entityType === PermissionEntityType.PROJECT) {
        const project = await this.projectRepository.findOne({
          where: { id: entityId }
        });

        if (project) {
          // Check workspace permissions
          const hasWorkspacePermission = await this.checkPermission(
            userId,
            PermissionEntityType.WORKSPACE,
            project.workspaceId,
            action
          );
          if (hasWorkspacePermission) {
            return true;
          }
        }
      } else if (entityType === PermissionEntityType.THREAD) {
        const thread = await this.threadRepository.findOne({
          where: { id: entityId },
          relations: ['project']
        });

        if (thread) {
          // Check project permissions
          const hasProjectPermission = await this.checkPermission(
            userId,
            PermissionEntityType.PROJECT,
            thread.projectId,
            action
          );
          if (hasProjectPermission) {
            return true;
          }

          // Check workspace permissions
          const project = await this.projectRepository.findOne({
            where: { id: thread.projectId }
          });
          if (project) {
            const hasWorkspacePermission = await this.checkPermission(
              userId,
              PermissionEntityType.WORKSPACE,
              project.workspaceId,
              action
            );
            if (hasWorkspacePermission) {
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking user access:', error);
      return false;
    }
  }

  /**
   * Check if user owns an entity
   * Ownership grants all permissions
   */
  private async checkOwnership(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string
  ): Promise<boolean> {
    try {
      switch (entityType) {
        case PermissionEntityType.WORKSPACE:
          const workspace = await this.workspaceRepository.findOne({
            where: { id: entityId }
          });
          if (!workspace) return false;

          // Check user ownership
          if (workspace.ownerType === WorkspaceOwnerType.USER) {
            return workspace.userId === userId;
          }
          // Organization ownership is handled by RBAC service
          return false;

        case PermissionEntityType.PROJECT:
          const project = await this.projectRepository.findOne({
            where: { id: entityId },
            relations: ['workspace']
          });
          if (!project || !project.workspace) return false;

          // Check workspace ownership
          if (project.workspace.ownerType === WorkspaceOwnerType.USER) {
            return project.workspace.userId === userId;
          }
          return false;

        case PermissionEntityType.THREAD:
          const thread = await this.threadRepository.findOne({
            where: { id: entityId }
          });
          if (!thread) return false;

          // Thread creator is owner
          return thread.createdById === userId;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking ownership:', error);
      return false;
    }
  }

  /**
   * Invalidate cache entries for a user and entity
   */
  private invalidateCache(
    userId: string,
    entityType: PermissionEntityType,
    entityId: string
  ): void {
    const actions: PermissionAction[] = ['read', 'write', 'delete', 'share', 'export'];
    for (const action of actions) {
      const cacheKey = `${userId}:${entityType}:${entityId}:${action}`;
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Clear all expired cache entries
   * Should be called periodically
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired permissions from database
   * Should be called periodically (e.g., daily)
   */
  async cleanupExpiredPermissions(): Promise<number> {
    try {
      const expiredPermissions = await this.permissionRepository
        .createQueryBuilder('ps')
        .where('ps.expiresAt IS NOT NULL')
        .andWhere('ps.expiresAt < :now', { now: new Date() })
        .getMany();

      if (expiredPermissions.length > 0) {
        await this.permissionRepository.remove(expiredPermissions);

        // Invalidate cache for all expired permissions
        for (const permission of expiredPermissions) {
          if (permission.userId) {
            this.invalidateCache(permission.userId, permission.entityType, permission.entityId);
          }
        }
      }

      return expiredPermissions.length;
    } catch (error) {
      console.error('Error cleaning up expired permissions:', error);
      return 0;
    }
  }
}

// Singleton instance
export const permissionService = new PermissionService();

// Cleanup expired cache every 10 minutes
setInterval(() => {
  permissionService.clearExpiredCache();
}, 10 * 60 * 1000);

// Cleanup expired permissions from database every hour
setInterval(() => {
  permissionService.cleanupExpiredPermissions();
}, 60 * 60 * 1000);
