# Permission System - Quick Reference

## Files Created

### Core Services
- **permission.service.ts** (572 lines) - Direct permission management
- **rbac.service.ts** (750 lines) - Role-based access control

### Documentation
- **PERMISSION_SYSTEM.md** (16KB) - Complete documentation
- **PERMISSION_INTEGRATION.md** (18KB) - Integration guide

### Examples & Tests
- **permission-rbac.example.ts** (527 lines) - 12 comprehensive examples
- **permission-rbac.test.ts** (647 lines) - Full test suite

## One-Minute Quick Start

```typescript
import { permissionService } from './services/permission.service';
import { rbacService } from './services/rbac.service';
import { PermissionEntityType } from './entities/PermissionSet';

// Grant permission
await permissionService.grantPermission(
  'user-id',
  PermissionEntityType.PROJECT,
  'project-id',
  { read: true, write: true }
);

// Check permission
const canWrite = await permissionService.checkPermission(
  'user-id',
  PermissionEntityType.PROJECT,
  'project-id',
  'write'
);

// Add organization member
await rbacService.addOrganizationMember(
  'org-id',
  'user-id',
  OrganizationRole.ADMIN
);

// Comprehensive check (recommended)
async function authorize(userId, entityType, entityId, action) {
  return (
    await permissionService.canUserAccess(userId, entityType, entityId, action) ||
    await rbacService.hasInheritedAccess(userId, entityType, entityId, action)
  );
}
```

## Common Operations Cheat Sheet

### Permission Operations

| Operation | Method | Example |
|-----------|--------|---------|
| Check permission | `checkPermission()` | `await permissionService.checkPermission(userId, entityType, entityId, 'read')` |
| Grant permission | `grantPermission()` | `await permissionService.grantPermission(userId, entityType, entityId, { read: true })` |
| Revoke permission | `revokePermission()` | `await permissionService.revokePermission(permissionId)` |
| Get user permissions | `getUserPermissions()` | `await permissionService.getUserPermissions(userId, entityType, entityId)` |
| Comprehensive check | `canUserAccess()` | `await permissionService.canUserAccess(userId, entityType, entityId, 'write')` |

### RBAC Operations

| Operation | Method | Example |
|-----------|--------|---------|
| Add org member | `addOrganizationMember()` | `await rbacService.addOrganizationMember(orgId, userId, role)` |
| Add workspace member | `addWorkspaceMember()` | `await rbacService.addWorkspaceMember(wsId, userId, role)` |
| Check org role | `checkOrganizationRole()` | `await rbacService.checkOrganizationRole(userId, orgId, OrganizationRole.ADMIN)` |
| Get user workspaces | `getUserWorkspaces()` | `await rbacService.getUserWorkspaces(userId)` |
| Check inherited access | `hasInheritedAccess()` | `await rbacService.hasInheritedAccess(userId, entityType, entityId, 'read')` |

## Entity Types

```typescript
enum PermissionEntityType {
  WORKSPACE = 'WORKSPACE',
  PROJECT = 'PROJECT',
  THREAD = 'THREAD'
}
```

## Permission Actions

```typescript
type PermissionAction = 'read' | 'write' | 'delete' | 'share' | 'export';
```

## Organization Roles (Hierarchical)

```typescript
enum OrganizationRole {
  OWNER = 'OWNER',      // Full control
  ADMIN = 'ADMIN',      // Manage members, access all
  MEMBER = 'MEMBER',    // Create content
  VIEWER = 'VIEWER'     // Read-only
}
```

## Workspace Roles (Hierarchical)

```typescript
enum WorkspaceRole {
  OWNER = 'OWNER',      // Full control
  EDITOR = 'EDITOR',    // Edit content
  VIEWER = 'VIEWER'     // Read-only
}
```

## Permission Flow

```
┌─────────────────────────────────────────┐
│ Authorization Request                    │
│ (userId, entityType, entityId, action)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 1. Check Ownership                       │
│    - Thread creator?                     │
│    - Workspace owner?                    │
└──────────────┬──────────────────────────┘
               │ No
               ▼
┌─────────────────────────────────────────┐
│ 2. Check Organization Role               │
│    - Is org member with sufficient role? │
└──────────────┬──────────────────────────┘
               │ No
               ▼
┌─────────────────────────────────────────┐
│ 3. Check Workspace Role                  │
│    - Is workspace member with role?      │
└──────────────┬──────────────────────────┘
               │ No
               ▼
┌─────────────────────────────────────────┐
│ 4. Check Direct Permissions              │
│    - Has PermissionSet for entity?       │
└──────────────┬──────────────────────────┘
               │ No
               ▼
         Access Denied
```

## Express Middleware Template

```typescript
import { permissionService } from './services/permission.service';
import { rbacService } from './services/rbac.service';

function requirePermission(entityType, action, idParam = 'id') {
  return async (req, res, next) => {
    const userId = req.user.id;
    const entityId = req.params[idParam];

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
app.delete('/projects/:id', requirePermission('PROJECT', 'delete'), deleteProject);
```

## Common Patterns

### Pattern 1: Share with Expiration

```typescript
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

await permissionService.grantPermission(
  collaboratorId,
  PermissionEntityType.THREAD,
  threadId,
  { read: true, export: true },
  expiresAt
);
```

### Pattern 2: List User's Accessible Entities

```typescript
// Via workspaces
const workspaces = await rbacService.getUserWorkspaces(userId);

// Via direct permissions
const projectIds = await permissionService.getUserAccessibleEntities(
  userId,
  PermissionEntityType.PROJECT,
  'read'
);
```

### Pattern 3: Get Effective Permissions

```typescript
const direct = await permissionService.getUserPermissions(userId, entityType, entityId);
const role = await rbacService.getEffectivePermissions(userId, entityType, entityId);

const effective = {
  read: direct.read || role.read,
  write: direct.write || role.write,
  delete: direct.delete || role.delete,
  share: direct.share || role.share,
  export: direct.export || role.export
};
```

### Pattern 4: Invite to Organization

```typescript
// Check if requester is admin
const isAdmin = await rbacService.checkOrganizationRole(
  requesterId,
  orgId,
  OrganizationRole.ADMIN
);

if (!isAdmin) throw new Error('Unauthorized');

// Add member
await rbacService.addOrganizationMember(orgId, newUserId, OrganizationRole.MEMBER);
```

## Performance Tips

1. **Use caching** - Already built-in with 5-minute TTL
2. **Batch checks** - Check multiple permissions in parallel
3. **Use indexes** - All queries use indexed columns
4. **Clear cache** - After bulk permission changes

```typescript
// Clear cache after bulk operations
await bulkGrantPermissions();
permissionService.clearCache();
rbacService.clearCache();
```

## Debugging

```typescript
// Check all permission sources
console.log('Ownership:', await checkOwnership(userId, entityType, entityId));
console.log('Org Role:', await rbacService.getUserOrganizationRole(userId, orgId));
console.log('Workspace Role:', await rbacService.getUserWorkspaceRole(userId, wsId));
console.log('Direct Perms:', await permissionService.getUserPermissions(userId, entityType, entityId));
console.log('Role Perms:', await rbacService.getEffectivePermissions(userId, entityType, entityId));
```

## Error Handling

```typescript
try {
  await permissionService.grantPermission(userId, entityType, entityId, permissions);
} catch (error) {
  if (error.message.includes('At least one permission')) {
    // No permissions granted
  } else if (error.message.includes('Expiration date')) {
    // Invalid expiration
  } else {
    // Other error
  }
}
```

## Next Steps

1. Read **PERMISSION_SYSTEM.md** for complete documentation
2. Review **permission-rbac.example.ts** for 12 detailed examples
3. Check **PERMISSION_INTEGRATION.md** for integration guide
4. Run tests in **permission-rbac.test.ts**

## Support

All files are in: `/home/user/desktop-tutorial/Unified AI/backend/services/`

- Core logic: `permission.service.ts`, `rbac.service.ts`
- Examples: `permission-rbac.example.ts`
- Tests: `permission-rbac.test.ts`
- Docs: `PERMISSION_SYSTEM.md`, `PERMISSION_INTEGRATION.md`
