# Permission and RBAC System Documentation

## Overview

The Unified AI Hub implements a comprehensive permission and role-based access control (RBAC) system that supports:

- **Direct Permissions**: Fine-grained control on specific entities
- **Role-Based Permissions**: Organization and workspace membership roles
- **Ownership Permissions**: Creators/owners have full access
- **Inherited Permissions**: Access flows through the entity hierarchy
- **Time-Limited Permissions**: Temporary access grants with expiration
- **Performance Caching**: In-memory caching for hot paths

## Architecture

### Entity Hierarchy

```
Organization
    └── Workspace (org-owned)
        └── Project
            └── Thread

User
    └── Workspace (user-owned)
        └── Project
            └── Thread
```

### Permission Sources (Priority Order)

1. **Ownership**: Creator/owner has all permissions
2. **Organization Role**: Org admins can access all org workspaces
3. **Workspace Role**: Workspace owners can access all projects/threads
4. **Direct Permissions**: Explicit grants on specific entities

## Services

### PermissionService

Manages direct permissions on entities (Workspace, Project, Thread).

**Location**: `/backend/services/permission.service.ts`

**Key Methods**:

```typescript
// Check if user has specific permission
checkPermission(userId, entityType, entityId, action): Promise<boolean>

// Get all permissions for a user on an entity
getUserPermissions(userId, entityType, entityId): Promise<Permissions>

// Grant permissions (supports expiration)
grantPermission(userId, entityType, entityId, permissions, expiresAt?): Promise<PermissionSet>

// Revoke specific permission set
revokePermission(permissionSetId): Promise<void>

// Revoke all permissions for user on entity
revokeAllPermissions(userId, entityType, entityId): Promise<void>

// Get all permissions for an entity
getEntityPermissions(entityType, entityId): Promise<PermissionSet[]>

// Get entities user can access with specific action
getUserAccessibleEntities(userId, entityType, action): Promise<string[]>

// Check if user has any permission
hasAnyPermission(userId, entityType, entityId): Promise<boolean>

// Comprehensive check with ownership and inheritance
canUserAccess(userId, entityType, entityId, action): Promise<boolean>
```

**Supported Actions**:
- `read`: View content
- `write`: Modify content
- `delete`: Remove content
- `share`: Share with others
- `export`: Export content

**Features**:
- In-memory caching (5-minute TTL)
- Automatic cleanup of expired permissions
- Permission merging when granting multiple times
- Ownership detection
- Parent entity inheritance

### RBACService

Manages role-based access control for organizations and workspaces.

**Location**: `/backend/services/rbac.service.ts`

**Key Methods**:

```typescript
// Organization Roles
checkOrganizationRole(userId, organizationId, requiredRole): Promise<boolean>
getUserOrganizationRole(userId, organizationId): Promise<OrganizationRole | null>
addOrganizationMember(organizationId, userId, role, permissions?): Promise<OrganizationMember>
removeOrganizationMember(organizationId, userId): Promise<void>
updateOrganizationMemberRole(organizationId, userId, newRole): Promise<OrganizationMember>

// Workspace Roles
checkWorkspaceRole(userId, workspaceId, requiredRole): Promise<boolean>
getUserWorkspaceRole(userId, workspaceId): Promise<WorkspaceRole | null>
addWorkspaceMember(workspaceId, userId, role, permissions?): Promise<WorkspaceMember>
removeWorkspaceMember(workspaceId, userId): Promise<void>

// Listing
getUserOrganizations(userId, role?): Promise<Organization[]>
getUserWorkspaces(userId, role?): Promise<Workspace[]>

// Inheritance
hasInheritedAccess(userId, entityType, entityId, action): Promise<boolean>
getEffectivePermissions(userId, entityType, entityId): Promise<Permissions>
```

**Organization Roles** (hierarchical):
- `OWNER`: Full control, cannot be removed
- `ADMIN`: Manage members, access all workspaces
- `MEMBER`: Create and manage own content
- `VIEWER`: Read-only access

**Workspace Roles** (hierarchical):
- `OWNER`: Full control
- `EDITOR`: Create and edit content
- `VIEWER`: Read-only access

**Default Role Permissions**:

| Role | Read | Write | Delete | Share | Export |
|------|------|-------|--------|-------|--------|
| **Organization** |
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| MEMBER | ✓ | ✓ | ✗ | ✓ | ✓ |
| VIEWER | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Workspace** |
| OWNER | ✓ | ✓ | ✓ | ✓ | ✓ |
| EDITOR | ✓ | ✓ | ✗ | ✓ | ✓ |
| VIEWER | ✓ | ✗ | ✗ | ✗ | ✓ |

## Usage Examples

### Example 1: Basic Permission Grant

```typescript
import { permissionService } from './services/permission.service';
import { PermissionEntityType } from './entities/PermissionSet';

// Grant read and export permissions on a project
await permissionService.grantPermission(
  'user-123',
  PermissionEntityType.PROJECT,
  'project-456',
  { read: true, export: true }
);

// Check if user can read
const canRead = await permissionService.checkPermission(
  'user-123',
  PermissionEntityType.PROJECT,
  'project-456',
  'read'
);
```

### Example 2: Time-Limited Access

```typescript
// Grant temporary access for 7 days
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7);

await permissionService.grantPermission(
  'collaborator-id',
  PermissionEntityType.THREAD,
  'thread-id',
  { read: true, write: true },
  expiresAt
);
```

### Example 3: Organization Management

```typescript
import { rbacService } from './services/rbac.service';
import { OrganizationRole } from './entities/OrganizationMember';

// Add user as organization admin
await rbacService.addOrganizationMember(
  'org-id',
  'user-id',
  OrganizationRole.ADMIN
);

// Check if user has admin privileges
const isAdmin = await rbacService.checkOrganizationRole(
  'user-id',
  'org-id',
  OrganizationRole.ADMIN
);
```

### Example 4: Workspace Access

```typescript
import { WorkspaceRole } from './entities/WorkspaceMember';

// Add user to workspace
await rbacService.addWorkspaceMember(
  'workspace-id',
  'user-id',
  WorkspaceRole.EDITOR
);

// Check inherited access on workspace
const canWrite = await rbacService.hasInheritedAccess(
  'user-id',
  PermissionEntityType.WORKSPACE,
  'workspace-id',
  'write'
);
```

### Example 5: Comprehensive Authorization (Recommended)

```typescript
// Check all permission sources
async function authorizeAccess(
  userId: string,
  entityType: PermissionEntityType,
  entityId: string,
  action: 'read' | 'write' | 'delete'
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

// Use in API endpoint
if (!await authorizeAccess(userId, PermissionEntityType.PROJECT, projectId, 'write')) {
  throw new Error('Unauthorized');
}
```

## Permission Flow

### Workspace Access

```
1. Is user the workspace owner (user-owned)?
   └─ YES → Grant all permissions
   └─ NO → Continue

2. Is workspace org-owned AND user is org owner/admin?
   └─ YES → Grant all permissions
   └─ NO → Continue

3. Does user have workspace role?
   └─ YES → Grant role permissions
   └─ NO → Continue

4. Does user have direct permissions?
   └─ YES → Grant those permissions
   └─ NO → Access denied
```

### Project Access

```
1. Get project's workspace
2. Check workspace access (see above)
   └─ If has access → Grant same permissions
   └─ NO → Continue

3. Does user have direct permissions on project?
   └─ YES → Grant those permissions
   └─ NO → Access denied
```

### Thread Access

```
1. Is user the thread creator?
   └─ YES → Grant all permissions
   └─ NO → Continue

2. Get thread's project
3. Check project access
   └─ If has access → Grant same permissions
   └─ NO → Continue

4. Does user have direct permissions on thread?
   └─ YES → Grant those permissions
   └─ NO → Access denied
```

## Database Schema

### permission_sets

```sql
CREATE TABLE permission_sets (
  id UUID PRIMARY KEY,
  entityType ENUM('WORKSPACE', 'PROJECT', 'THREAD'),
  entityId UUID NOT NULL,
  userId UUID,
  roleId UUID,
  permissions JSON NOT NULL, -- { read, write, delete, share, export }
  grantedAt TIMESTAMP DEFAULT NOW(),
  expiresAt TIMESTAMP NULL,

  INDEX idx_entity (entityType, entityId),
  INDEX idx_user (userId),
  INDEX idx_expires (expiresAt)
);
```

### organization_members

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY,
  organizationId UUID NOT NULL,
  userId UUID NOT NULL,
  role ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'),
  permissions JSON,
  joinedAt TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (organizationId, userId)
);
```

### workspace_members

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY,
  workspaceId UUID NOT NULL,
  userId UUID NOT NULL,
  role ENUM('OWNER', 'EDITOR', 'VIEWER'),
  permissions JSON,
  addedAt TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (workspaceId, userId)
);
```

## Performance Considerations

### Caching

Both services implement in-memory caching:

- **Cache TTL**: 5 minutes
- **Auto-cleanup**: Every 10 minutes
- **Cache invalidation**: On permission/role changes

```typescript
// Clear cache manually if needed
permissionService.clearCache();
rbacService.clearCache();

// Clear only expired entries
permissionService.clearExpiredCache();
rbacService.clearExpiredCache();
```

### Database Cleanup

Expired permissions are automatically cleaned:

```typescript
// Runs every hour automatically
// Returns number of permissions cleaned
const count = await permissionService.cleanupExpiredPermissions();
```

### Query Optimization

- All permission checks use indexed columns
- Role lookups are cached
- Batch operations use transactions
- FTS indexes for entity searches

## Security Best Practices

### 1. Always Check Permissions

```typescript
// ✓ Good
if (!await authorizeAccess(userId, entityType, entityId, 'write')) {
  throw new Error('Unauthorized');
}

// ✗ Bad - trusting client input
if (req.body.hasPermission) {
  // Dangerous!
}
```

### 2. Use Specific Actions

```typescript
// ✓ Good - check specific action
await permissionService.checkPermission(userId, entityType, entityId, 'delete');

// ✗ Bad - checking if any permission exists
await permissionService.hasAnyPermission(userId, entityType, entityId);
```

### 3. Validate Expiration Times

```typescript
// ✓ Good - reasonable expiration
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30); // 30 days max

// ✗ Bad - indefinite or too long
const expiresAt = new Date();
expiresAt.setFullYear(expiresAt.getFullYear() + 100);
```

### 4. Principle of Least Privilege

```typescript
// ✓ Good - grant only needed permissions
await permissionService.grantPermission(userId, entityType, entityId, {
  read: true,
  export: true
});

// ✗ Bad - granting all permissions
await permissionService.grantPermission(userId, entityType, entityId, {
  read: true,
  write: true,
  delete: true,
  share: true,
  export: true
});
```

### 5. Audit Permission Changes

```typescript
// Log all permission grants/revokes
async function grantWithAudit(userId, entityType, entityId, permissions, grantedBy) {
  const permissionSet = await permissionService.grantPermission(
    userId,
    entityType,
    entityId,
    permissions
  );

  await auditLog.create({
    action: 'PERMISSION_GRANTED',
    userId: grantedBy,
    targetUserId: userId,
    entityType,
    entityId,
    permissions
  });

  return permissionSet;
}
```

## Testing

See `permission-rbac.test.ts` for comprehensive test suite.

```bash
# Run tests
npm test -- permission-rbac.test

# Run specific test suite
npm test -- permission-rbac.test -t "PermissionService"
```

## Migration Guide

### From Basic Auth to RBAC

1. **Identify current permission model**
2. **Map users to appropriate roles**
3. **Migrate owner relationships**
4. **Create permission sets for existing shares**
5. **Test thoroughly before production**

Example migration script:

```typescript
async function migrateToRBAC() {
  // 1. Create organization for existing team workspaces
  const org = await createOrganization('Legacy Team');

  // 2. Migrate workspace owners to org members
  const workspaces = await getTeamWorkspaces();
  for (const ws of workspaces) {
    await rbacService.addOrganizationMember(
      org.id,
      ws.ownerId,
      OrganizationRole.ADMIN
    );
  }

  // 3. Migrate shared access to permission sets
  const shares = await getSharedAccess();
  for (const share of shares) {
    await permissionService.grantPermission(
      share.userId,
      share.entityType,
      share.entityId,
      { read: true, write: share.canEdit }
    );
  }
}
```

## Troubleshooting

### Issue: Permission check returns false unexpectedly

**Solution**: Check all permission sources in order:
1. Ownership (creator/owner)
2. Organization role
3. Workspace role
4. Direct permissions

```typescript
// Debug permission check
const isOwner = await checkOwnership(userId, entityType, entityId);
const orgRole = await rbacService.getUserOrganizationRole(userId, orgId);
const wsRole = await rbacService.getUserWorkspaceRole(userId, wsId);
const directPerms = await permissionService.getUserPermissions(userId, entityType, entityId);

console.log({ isOwner, orgRole, wsRole, directPerms });
```

### Issue: Cache shows stale data

**Solution**: Clear cache after permission changes:

```typescript
// Cache is automatically invalidated on changes, but if needed:
permissionService.clearCache();
rbacService.clearCache();
```

### Issue: Performance slow on permission checks

**Solution**:
1. Ensure database indexes exist
2. Use caching (already enabled)
3. Batch permission checks when possible
4. Consider denormalizing for read-heavy workloads

## API Integration

### Express Middleware Example

```typescript
import { permissionService } from './services/permission.service';
import { rbacService } from './services/rbac.service';

export function requirePermission(
  entityType: PermissionEntityType,
  action: PermissionAction,
  entityIdParam: string = 'id'
) {
  return async (req, res, next) => {
    const userId = req.user.id;
    const entityId = req.params[entityIdParam];

    const hasAccess =
      await permissionService.canUserAccess(userId, entityType, entityId, action) ||
      await rbacService.hasInheritedAccess(userId, entityType, entityId, action);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

// Usage
app.delete(
  '/api/projects/:id',
  authenticate,
  requirePermission(PermissionEntityType.PROJECT, 'delete'),
  deleteProject
);
```

## Support

For questions or issues:
- Check the examples in `permission-rbac.example.ts`
- Review tests in `permission-rbac.test.ts`
- See inline documentation in the service files

## License

Part of the Unified AI Hub project.
