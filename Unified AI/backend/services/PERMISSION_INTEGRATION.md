# Permission System Integration Guide

Quick guide to integrating PermissionService and RBACService into your Unified AI Hub backend.

## Quick Start

### 1. Import Services

```typescript
import { permissionService } from './services/permission.service';
import { rbacService } from './services/rbac.service';
import { PermissionEntityType } from './entities/PermissionSet';
import { OrganizationRole } from './entities/OrganizationMember';
import { WorkspaceRole } from './entities/WorkspaceMember';
```

### 2. Initialize (if needed)

The services are automatically initialized as singletons. No manual initialization required.

```typescript
// Services are ready to use immediately
const canAccess = await permissionService.checkPermission(...);
```

### 3. Basic Authorization Pattern

```typescript
// Recommended authorization function
async function authorize(
  userId: string,
  entityType: PermissionEntityType,
  entityId: string,
  action: 'read' | 'write' | 'delete' | 'share' | 'export'
): Promise<boolean> {
  // Check direct permissions + ownership
  const direct = await permissionService.canUserAccess(
    userId,
    entityType,
    entityId,
    action
  );

  // Check role-based access
  const role = await rbacService.hasInheritedAccess(
    userId,
    entityType,
    entityId,
    action
  );

  return direct || role;
}
```

## Common Use Cases

### Use Case 1: Create Workspace

```typescript
async function createWorkspace(
  userId: string,
  organizationId: string | null,
  data: any
) {
  // Create workspace
  const workspace = workspaceRepository.create({
    ...data,
    ownerType: organizationId ? WorkspaceOwnerType.ORGANIZATION : WorkspaceOwnerType.USER,
    userId: organizationId ? null : userId,
    organizationId: organizationId || null
  });

  await workspaceRepository.save(workspace);

  // If user-owned, user is automatically owner (handled by RBACService)
  // If org-owned, org admins automatically have access (handled by RBACService)

  return workspace;
}
```

### Use Case 2: Share Project

```typescript
async function shareProject(
  projectId: string,
  shareWithUserId: string,
  permissions: { read?: boolean; write?: boolean },
  expiresInDays?: number
) {
  // Calculate expiration
  let expiresAt: Date | undefined;
  if (expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  // Grant permissions
  const permissionSet = await permissionService.grantPermission(
    shareWithUserId,
    PermissionEntityType.PROJECT,
    projectId,
    permissions,
    expiresAt
  );

  // Optional: Create audit log
  await auditLog.create({
    action: 'PROJECT_SHARED',
    userId: shareWithUserId,
    projectId,
    permissions,
    expiresAt
  });

  return permissionSet;
}
```

### Use Case 3: Check Thread Access

```typescript
async function getThread(userId: string, threadId: string) {
  // Check if user can access thread
  const canAccess = await authorize(
    userId,
    PermissionEntityType.THREAD,
    threadId,
    'read'
  );

  if (!canAccess) {
    throw new Error('You do not have permission to access this thread');
  }

  // Fetch thread
  const thread = await threadRepository.findOne({
    where: { id: threadId },
    relations: ['messages', 'attachments']
  });

  return thread;
}
```

### Use Case 4: Delete Project

```typescript
async function deleteProject(userId: string, projectId: string) {
  // Check delete permission
  const canDelete = await authorize(
    userId,
    PermissionEntityType.PROJECT,
    projectId,
    'delete'
  );

  if (!canDelete) {
    throw new Error('You do not have permission to delete this project');
  }

  // Delete project
  await projectRepository.delete({ id: projectId });

  // Cleanup: Remove all related permissions
  const permissions = await permissionService.getEntityPermissions(
    PermissionEntityType.PROJECT,
    projectId
  );

  for (const perm of permissions) {
    await permissionService.revokePermission(perm.id);
  }
}
```

### Use Case 5: List User's Projects

```typescript
async function getUserProjects(userId: string) {
  // Get projects from accessible workspaces
  const workspaces = await rbacService.getUserWorkspaces(userId);
  const workspaceIds = workspaces.map(ws => ws.id);

  // Get all projects in those workspaces
  const projects = await projectRepository.find({
    where: {
      workspaceId: In(workspaceIds)
    },
    relations: ['workspace']
  });

  // Also get projects with direct permissions
  const directProjectIds = await permissionService.getUserAccessibleEntities(
    userId,
    PermissionEntityType.PROJECT,
    'read'
  );

  const directProjects = await projectRepository.find({
    where: {
      id: In(directProjectIds)
    },
    relations: ['workspace']
  });

  // Combine and deduplicate
  const allProjects = [...projects, ...directProjects];
  const unique = Array.from(
    new Map(allProjects.map(p => [p.id, p])).values()
  );

  return unique;
}
```

### Use Case 6: Add Organization Member

```typescript
async function inviteToOrganization(
  requesterId: string,
  organizationId: string,
  inviteUserId: string,
  role: OrganizationRole
) {
  // Check if requester is org admin
  const isAdmin = await rbacService.checkOrganizationRole(
    requesterId,
    organizationId,
    OrganizationRole.ADMIN
  );

  if (!isAdmin) {
    throw new Error('Only organization admins can invite members');
  }

  // Add member
  const member = await rbacService.addOrganizationMember(
    organizationId,
    inviteUserId,
    role
  );

  // Send notification
  await notificationService.send(inviteUserId, {
    type: 'ORG_INVITATION',
    organizationId,
    role
  });

  return member;
}
```

### Use Case 7: Transfer Workspace Ownership

```typescript
async function transferWorkspaceOwnership(
  currentOwnerId: string,
  workspaceId: string,
  newOwnerId: string
) {
  // Get workspace
  const workspace = await workspaceRepository.findOne({
    where: { id: workspaceId }
  });

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  // Verify current owner (for user-owned workspaces)
  if (workspace.ownerType === WorkspaceOwnerType.USER) {
    if (workspace.userId !== currentOwnerId) {
      throw new Error('Only the workspace owner can transfer ownership');
    }

    // Update workspace owner
    workspace.userId = newOwnerId;
    await workspaceRepository.save(workspace);

    // Optional: Add previous owner as editor
    await rbacService.addWorkspaceMember(
      workspaceId,
      currentOwnerId,
      WorkspaceRole.EDITOR
    );
  } else {
    throw new Error('Organization-owned workspaces cannot be transferred this way');
  }
}
```

### Use Case 8: Get User's Effective Permissions

```typescript
async function getUserEntityPermissions(
  userId: string,
  entityType: PermissionEntityType,
  entityId: string
) {
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

  // Merge (OR operation - if either grants permission, user has it)
  const merged = {
    read: directPermissions.read || rolePermissions.read || false,
    write: directPermissions.write || rolePermissions.write || false,
    delete: directPermissions.delete || rolePermissions.delete || false,
    share: directPermissions.share || rolePermissions.share || false,
    export: directPermissions.export || rolePermissions.export || false
  };

  return merged;
}
```

## Express.js Integration

### Middleware for Route Protection

```typescript
// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../services/permission.service';
import { rbacService } from '../services/rbac.service';
import { PermissionEntityType } from '../entities/PermissionSet';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export function requireEntityPermission(
  entityType: PermissionEntityType,
  action: 'read' | 'write' | 'delete' | 'share' | 'export',
  entityIdParam: string = 'id'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user.id;
      const entityId = req.params[entityIdParam];

      if (!entityId) {
        return res.status(400).json({ error: 'Entity ID required' });
      }

      // Check both permission sources
      const hasDirectAccess = await permissionService.canUserAccess(
        userId,
        entityType,
        entityId,
        action
      );

      const hasRoleAccess = await rbacService.hasInheritedAccess(
        userId,
        entityType,
        entityId,
        action
      );

      if (!hasDirectAccess && !hasRoleAccess) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have ${action} permission for this ${entityType.toLowerCase()}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireOrganizationRole(requiredRole: OrganizationRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user.id;
      const organizationId = req.params.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const hasRole = await rbacService.checkOrganizationRole(
        userId,
        organizationId,
        requiredRole
      );

      if (!hasRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You need ${requiredRole} role in this organization`
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
```

### Route Examples

```typescript
// routes/projects.ts
import express from 'express';
import { requireEntityPermission, requireOrganizationRole } from '../middleware/auth';
import { PermissionEntityType } from '../entities/PermissionSet';
import { OrganizationRole } from '../entities/OrganizationMember';

const router = express.Router();

// Get project (requires read permission)
router.get(
  '/:id',
  requireEntityPermission(PermissionEntityType.PROJECT, 'read'),
  async (req, res) => {
    const project = await getProject(req.params.id);
    res.json(project);
  }
);

// Update project (requires write permission)
router.put(
  '/:id',
  requireEntityPermission(PermissionEntityType.PROJECT, 'write'),
  async (req, res) => {
    const project = await updateProject(req.params.id, req.body);
    res.json(project);
  }
);

// Delete project (requires delete permission)
router.delete(
  '/:id',
  requireEntityPermission(PermissionEntityType.PROJECT, 'delete'),
  async (req, res) => {
    await deleteProject(req.user!.id, req.params.id);
    res.status(204).send();
  }
);

// Share project (requires share permission)
router.post(
  '/:id/share',
  requireEntityPermission(PermissionEntityType.PROJECT, 'share'),
  async (req, res) => {
    const { userId, permissions, expiresInDays } = req.body;
    const share = await shareProject(req.params.id, userId, permissions, expiresInDays);
    res.json(share);
  }
);

// Organization routes
router.post(
  '/organizations/:organizationId/members',
  requireOrganizationRole(OrganizationRole.ADMIN),
  async (req, res) => {
    const { userId, role } = req.body;
    const member = await rbacService.addOrganizationMember(
      req.params.organizationId,
      userId,
      role
    );
    res.json(member);
  }
);

export default router;
```

## GraphQL Integration

```typescript
// resolvers/project.resolvers.ts
import { permissionService } from '../services/permission.service';
import { rbacService } from '../services/rbac.service';
import { PermissionEntityType } from '../entities/PermissionSet';

export const projectResolvers = {
  Query: {
    project: async (_, { id }, context) => {
      const userId = context.user.id;

      // Check permission
      const canAccess =
        await permissionService.canUserAccess(userId, PermissionEntityType.PROJECT, id, 'read') ||
        await rbacService.hasInheritedAccess(userId, PermissionEntityType.PROJECT, id, 'read');

      if (!canAccess) {
        throw new Error('Unauthorized');
      }

      return projectRepository.findOne({ where: { id } });
    },

    userProjects: async (_, __, context) => {
      const userId = context.user.id;
      return getUserProjects(userId);
    }
  },

  Mutation: {
    updateProject: async (_, { id, input }, context) => {
      const userId = context.user.id;

      // Check write permission
      const canWrite =
        await permissionService.canUserAccess(userId, PermissionEntityType.PROJECT, id, 'write') ||
        await rbacService.hasInheritedAccess(userId, PermissionEntityType.PROJECT, id, 'write');

      if (!canWrite) {
        throw new Error('Unauthorized');
      }

      return updateProject(id, input);
    },

    shareProject: async (_, { projectId, userId, permissions }, context) => {
      const requesterId = context.user.id;

      // Check share permission
      const canShare =
        await permissionService.canUserAccess(requesterId, PermissionEntityType.PROJECT, projectId, 'share') ||
        await rbacService.hasInheritedAccess(requesterId, PermissionEntityType.PROJECT, projectId, 'share');

      if (!canShare) {
        throw new Error('Unauthorized');
      }

      return shareProject(projectId, userId, permissions);
    }
  },

  Project: {
    permissions: async (project, _, context) => {
      const userId = context.user.id;
      return getUserEntityPermissions(userId, PermissionEntityType.PROJECT, project.id);
    }
  }
};
```

## Background Jobs

```typescript
// jobs/permission-cleanup.ts
import { permissionService } from '../services/permission.service';
import { rbacService } from '../services/rbac.service';

// Run every hour
export async function cleanupExpiredPermissions() {
  console.log('Starting permission cleanup...');

  const count = await permissionService.cleanupExpiredPermissions();
  console.log(`Cleaned up ${count} expired permissions`);

  // Clear expired cache entries
  permissionService.clearExpiredCache();
  rbacService.clearExpiredCache();

  console.log('Permission cleanup completed');
}

// Setup cron job (using node-cron or similar)
import cron from 'node-cron';

// Every hour
cron.schedule('0 * * * *', cleanupExpiredPermissions);
```

## Testing Your Integration

```typescript
// test/integration/permissions.test.ts
import { permissionService } from '../../services/permission.service';
import { rbacService } from '../../services/rbac.service';
import { PermissionEntityType } from '../../entities/PermissionSet';

describe('Permission Integration Tests', () => {
  it('should enforce permissions in API endpoints', async () => {
    const response = await request(app)
      .get('/api/projects/project-123')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403); // User has no permission

    expect(response.body.error).toBe('Forbidden');
  });

  it('should allow access with proper permissions', async () => {
    // Grant permission
    await permissionService.grantPermission(
      userId,
      PermissionEntityType.PROJECT,
      'project-123',
      { read: true }
    );

    const response = await request(app)
      .get('/api/projects/project-123')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.id).toBe('project-123');
  });
});
```

## Monitoring and Logging

```typescript
// utils/permission-logger.ts
import { permissionService } from '../services/permission.service';
import { rbacService } from '../services/rbac.service';

// Wrap permission checks with logging
export async function checkAndLog(
  userId: string,
  entityType: PermissionEntityType,
  entityId: string,
  action: string
): Promise<boolean> {
  const startTime = Date.now();

  const hasAccess =
    await permissionService.canUserAccess(userId, entityType, entityId, action as any) ||
    await rbacService.hasInheritedAccess(userId, entityType, entityId, action as any);

  const duration = Date.now() - startTime;

  // Log to monitoring system
  logger.info('Permission check', {
    userId,
    entityType,
    entityId,
    action,
    hasAccess,
    duration
  });

  // Alert if check is slow
  if (duration > 1000) {
    logger.warn('Slow permission check', { duration, userId, entityType, entityId });
  }

  return hasAccess;
}
```

## Next Steps

1. **Review the examples** in `permission-rbac.example.ts`
2. **Run the tests** in `permission-rbac.test.ts`
3. **Read the full documentation** in `PERMISSION_SYSTEM.md`
4. **Implement middleware** as shown above
5. **Test thoroughly** before production deployment

## Support

For issues or questions, refer to:
- `PERMISSION_SYSTEM.md` - Complete documentation
- `permission-rbac.example.ts` - Usage examples
- `permission-rbac.test.ts` - Test examples
