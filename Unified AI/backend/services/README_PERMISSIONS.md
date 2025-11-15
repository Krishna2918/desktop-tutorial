# Permission and RBAC System - README

## Overview

This directory contains a complete, production-ready permission and role-based access control (RBAC) system for the Unified AI Hub.

## Quick Start

```typescript
// Import everything you need
import {
  permissionService,
  rbacService,
  authorize,
  PermissionEntityType,
  OrganizationRole,
  WorkspaceRole
} from './services/permission.index';

// Check if user can access a project
const canWrite = await authorize(
  userId,
  PermissionEntityType.PROJECT,
  projectId,
  'write'
);

if (!canWrite) {
  throw new Error('Unauthorized');
}
```

## Files in This Directory

### 🔧 Core Services
- **`permission.service.ts`** (572 lines) - Direct permission management
- **`rbac.service.ts`** (750 lines) - Role-based access control
- **`permission.index.ts`** (152 lines) - Unified exports and helpers

### 📚 Documentation
- **`PERMISSION_SYSTEM.md`** - Complete system documentation (START HERE)
- **`PERMISSION_INTEGRATION.md`** - Integration guide with examples
- **`PERMISSION_QUICK_REFERENCE.md`** - Quick reference and cheat sheet
- **`PERMISSION_SUMMARY.md`** - Implementation summary and statistics
- **`README_PERMISSIONS.md`** - This file

### 📝 Examples & Tests
- **`permission-rbac.example.ts`** (527 lines) - 12 comprehensive examples
- **`permission-rbac.test.ts`** (647 lines) - Full test suite

## What This System Provides

### ✅ Features

1. **Direct Permissions**
   - Fine-grained control (read, write, delete, share, export)
   - Time-limited permissions with expiration
   - Permission inheritance from parent entities

2. **Role-Based Access Control**
   - Organization roles (OWNER, ADMIN, MEMBER, VIEWER)
   - Workspace roles (OWNER, EDITOR, VIEWER)
   - Automatic permission inheritance

3. **Performance**
   - In-memory caching (5-minute TTL)
   - Automatic cache cleanup
   - Optimized database queries

4. **Security**
   - Ownership detection
   - Principle of least privilege
   - Comprehensive validation

## Getting Started

### Step 1: Read the Documentation

Start with **`PERMISSION_SYSTEM.md`** for complete understanding.

### Step 2: Review Examples

Check **`permission-rbac.example.ts`** for 12 real-world examples.

### Step 3: Integrate

Follow **`PERMISSION_INTEGRATION.md`** for step-by-step integration.

### Step 4: Test

Run the test suite in **`permission-rbac.test.ts`**.

## Common Operations

### Grant Permission

```typescript
await permissionService.grantPermission(
  userId,
  PermissionEntityType.PROJECT,
  projectId,
  { read: true, write: true }
);
```

### Check Permission

```typescript
const canRead = await permissionService.checkPermission(
  userId,
  PermissionEntityType.PROJECT,
  projectId,
  'read'
);
```

### Add Organization Member

```typescript
await rbacService.addOrganizationMember(
  organizationId,
  userId,
  OrganizationRole.ADMIN
);
```

### Comprehensive Authorization (Recommended)

```typescript
const hasAccess = await authorize(
  userId,
  PermissionEntityType.THREAD,
  threadId,
  'write'
);
```

## Permission Hierarchy

```
Organization (role-based)
    ↓
Workspace (role-based or user-owned)
    ↓
Project (inherits from workspace)
    ↓
Thread (inherits from project, has creator)
```

## Entity Types

- `WORKSPACE` - Workspaces (can be user or org-owned)
- `PROJECT` - Projects (belong to workspaces)
- `THREAD` - Threads (belong to projects, have creators)

## Permission Actions

- `read` - View content
- `write` - Modify content
- `delete` - Remove content
- `share` - Share with others
- `export` - Export content

## Organization Roles

| Role | Access Level |
|------|--------------|
| OWNER | Full control, cannot be removed |
| ADMIN | Manage members, access all workspaces |
| MEMBER | Create and manage own content |
| VIEWER | Read-only access |

## Workspace Roles

| Role | Access Level |
|------|--------------|
| OWNER | Full control |
| EDITOR | Create and edit content |
| VIEWER | Read-only access |

## Architecture

### Permission Flow

1. **Check Ownership** - Is user the owner/creator?
2. **Check Organization Role** - Does user have org-level access?
3. **Check Workspace Role** - Does user have workspace-level access?
4. **Check Direct Permissions** - Does user have explicit permission?

### Database Tables

- `permission_sets` - Direct permissions
- `organization_members` - Organization memberships
- `workspace_members` - Workspace memberships
- `organizations` - Organizations
- `workspaces` - Workspaces
- `projects` - Projects
- `threads` - Threads

## Performance

### Caching
- **TTL**: 5 minutes
- **Auto-cleanup**: Every 10 minutes
- **Cache hit**: ~0.1ms
- **Cache miss**: ~5-15ms

### Database Cleanup
- Expired permissions cleaned hourly
- Automatic on startup
- Manual cleanup available

## Testing

```bash
# Run all tests
npm test -- permission-rbac.test

# Run specific suite
npm test -- permission-rbac.test -t "PermissionService"
```

## Express.js Integration

```typescript
import { requirePermission } from './middleware/auth';

app.delete(
  '/projects/:id',
  requirePermission(PermissionEntityType.PROJECT, 'delete'),
  deleteProjectHandler
);
```

See **`PERMISSION_INTEGRATION.md`** for complete middleware examples.

## Examples

### Example 1: Share a Project

```typescript
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

await permissionService.grantPermission(
  collaboratorId,
  PermissionEntityType.PROJECT,
  projectId,
  { read: true, export: true },
  expiresAt
);
```

### Example 2: Check Access

```typescript
async function getProject(userId: string, projectId: string) {
  const hasAccess = await authorize(
    userId,
    PermissionEntityType.PROJECT,
    projectId,
    'read'
  );

  if (!hasAccess) {
    throw new Error('Unauthorized');
  }

  return await projectRepository.findOne({ where: { id: projectId } });
}
```

### Example 3: List User's Workspaces

```typescript
const workspaces = await rbacService.getUserWorkspaces(userId);
console.log(`User has access to ${workspaces.length} workspaces`);
```

See **`permission-rbac.example.ts`** for 12 complete examples.

## Maintenance

### Regular Tasks
- Expired permissions cleaned automatically (hourly)
- Cache cleaned automatically (every 10 minutes)
- No manual intervention required

### Manual Cleanup
```typescript
// Clean expired permissions
const count = await permissionService.cleanupExpiredPermissions();

// Clear all caches
permissionService.clearCache();
rbacService.clearCache();
```

## Troubleshooting

### Issue: Permission check returns unexpected result

**Solution**: Debug all permission sources
```typescript
console.log('Direct:', await permissionService.getUserPermissions(userId, entityType, entityId));
console.log('Role:', await rbacService.getEffectivePermissions(userId, entityType, entityId));
console.log('Org Role:', await rbacService.getUserOrganizationRole(userId, orgId));
console.log('WS Role:', await rbacService.getUserWorkspaceRole(userId, wsId));
```

### Issue: Cache shows stale data

**Solution**: Cache is automatically invalidated, but if needed:
```typescript
permissionService.clearCache();
rbacService.clearCache();
```

See **`PERMISSION_SYSTEM.md`** for complete troubleshooting guide.

## API Reference

### PermissionService Methods

| Method | Description |
|--------|-------------|
| `checkPermission()` | Check specific permission |
| `grantPermission()` | Grant permissions |
| `revokePermission()` | Revoke specific permission |
| `getUserPermissions()` | Get all permissions |
| `canUserAccess()` | Comprehensive check |

### RBACService Methods

| Method | Description |
|--------|-------------|
| `checkOrganizationRole()` | Check org role |
| `addOrganizationMember()` | Add member to org |
| `getUserWorkspaces()` | List workspaces |
| `hasInheritedAccess()` | Check with inheritance |

See **`PERMISSION_QUICK_REFERENCE.md`** for complete API reference.

## Support

### Documentation
- **Complete docs**: `PERMISSION_SYSTEM.md`
- **Integration guide**: `PERMISSION_INTEGRATION.md`
- **Quick reference**: `PERMISSION_QUICK_REFERENCE.md`

### Examples
- **Usage examples**: `permission-rbac.example.ts`
- **Tests**: `permission-rbac.test.ts`

### Getting Help
1. Check the documentation files
2. Review the examples
3. Run the tests
4. Check inline code comments

## License

Part of the Unified AI Hub project.

---

**Ready to use!** Start with `PERMISSION_SYSTEM.md` for complete documentation.
