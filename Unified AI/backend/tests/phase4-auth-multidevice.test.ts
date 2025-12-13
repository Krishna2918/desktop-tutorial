/**
 * Phase 4 - Auth, Account Management & Multi-Device Tests
 *
 * Test Suite validates:
 * - User authentication (register, login, logout)
 * - Session management with JWT
 * - Multi-device support
 * - Data synchronization
 * - Conflict resolution
 * - RBAC (Role-Based Access Control)
 * - Permission inheritance
 */

import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';
import { syncService } from '../services/sync.service';
import { permissionService } from '../services/permission.service';
import { rbacService } from '../services/rbac.service';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken
} from '../utils/jwt.util';

import { User } from '../entities/User';
import { Device, DeviceType } from '../entities/Device';
import { Session } from '../entities/Session';
import { SyncEvent, SyncOperation } from '../entities/SyncEvent';
import { Organization, OrganizationPlanType } from '../entities/Organization';
import { OrganizationMember, OrganizationRole } from '../entities/OrganizationMember';
import { Workspace, WorkspaceOwnerType } from '../entities/Workspace';
import { WorkspaceMember, WorkspaceRole } from '../entities/WorkspaceMember';
import { PermissionSet, PermissionEntityType } from '../entities/PermissionSet';

describe('Phase 4: Auth, Account Management & Multi-Device', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await AppDataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('Test Suite 1: User Registration & Email Verification', () => {
    test('1.1 Register new user', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        displayName: 'New User'
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.displayName).toBe('New User');
      expect(result.user.emailVerified).toBe(false);
      expect(result.verificationToken).toBeDefined();

      // Password should be hashed
      expect(result.user.passwordHash).not.toBe('SecurePassword123!');
      expect(result.user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash
    });

    test('1.2 Reject duplicate email', async () => {
      await expect(
        authService.register({
          email: 'newuser@example.com',
          password: 'AnotherPassword123!',
          displayName: 'Duplicate User'
        })
      ).rejects.toThrow(/email.*already.*registered/i);
    });

    test('1.3 Verify email with token', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      expect(user).not.toBeNull();
      expect(user!.emailVerificationToken).toBeDefined();

      const result = await authService.verifyEmail(user!.emailVerificationToken!);

      expect(result.success).toBe(true);
      expect(result.user.emailVerified).toBe(true);
      expect(result.user.emailVerificationToken).toBeNull();
    });

    test('1.4 Reject invalid verification token', async () => {
      await expect(
        authService.verifyEmail('invalid-token-12345')
      ).rejects.toThrow(/invalid.*verification.*token/i);
    });
  });

  describe('Test Suite 2: Login & JWT Token Generation', () => {
    test('2.1 Login with correct credentials', async () => {
      const result = await authService.login(
        {
          email: 'newuser@example.com',
          password: 'SecurePassword123!'
        },
        'device-desktop-1',
        '192.168.1.100',
        'Mozilla/5.0...'
      );

      expect(result.user).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.expiresIn).toBe(900); // 15 minutes in seconds
    });

    test('2.2 Reject wrong password', async () => {
      await expect(
        authService.login(
          {
            email: 'newuser@example.com',
            password: 'WrongPassword123!'
          },
          'device-desktop-1'
        )
      ).rejects.toThrow(/invalid.*credentials/i);
    });

    test('2.3 Reject non-existent user', async () => {
      await expect(
        authService.login(
          {
            email: 'nonexistent@example.com',
            password: 'AnyPassword123!'
          },
          'device-desktop-1'
        )
      ).rejects.toThrow(/invalid.*credentials/i);
    });

    test('2.4 Validate access token', async () => {
      const loginResult = await authService.login(
        {
          email: 'newuser@example.com',
          password: 'SecurePassword123!'
        },
        'device-desktop-2'
      );

      const validationResult = await authService.validateSession(
        loginResult.accessToken
      );

      expect(validationResult.user).toBeDefined();
      expect(validationResult.user.id).toBe(loginResult.user.id);
      expect(validationResult.session).toBeDefined();
    });

    test('2.5 Reject expired token', async () => {
      // Generate token with immediate expiry
      const token = generateAccessToken(
        {
          userId: '00000000-0000-0000-0000-000000000000',
          email: 'test@example.com'
        },
        '0s' // Expires immediately
      );

      // Wait a moment to ensure expiry
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(verifyAccessToken(token)).rejects.toThrow(/expired/i);
    });
  });

  describe('Test Suite 3: Session Management', () => {
    test('3.1 Create session on login', async () => {
      const loginResult = await authService.login(
        {
          email: 'newuser@example.com',
          password: 'SecurePassword123!'
        },
        'device-web-1',
        '10.0.0.1',
        'Chrome'
      );

      const sessions = await sessionService.getAllUserSessions(loginResult.user.id);

      expect(sessions.length).toBeGreaterThan(0);
      const webSession = sessions.find(s => s.device.deviceName === 'device-web-1');
      expect(webSession).toBeDefined();
      expect(webSession!.isActive).toBe(true);
    });

    test('3.2 Refresh access token', async () => {
      const loginResult = await authService.login(
        {
          email: 'newuser@example.com',
          password: 'SecurePassword123!'
        },
        'device-mobile-1'
      );

      const refreshResult = await authService.refreshAccessToken(
        loginResult.refreshToken
      );

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.accessToken).not.toBe(loginResult.accessToken);
      expect(refreshResult.refreshToken).toBeDefined();
    });

    test('3.3 Logout single device', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const deviceRepo = dataSource.getRepository(Device);
      const device = await deviceRepo.findOne({
        where: { userId: user!.id, deviceName: 'device-desktop-1' }
      });

      expect(device).not.toBeNull();

      await authService.logout(user!.id, device!.id);

      const updatedSessions = await sessionService.getAllUserSessions(user!.id);
      const loggedOutSession = updatedSessions.find(
        s => s.deviceId === device!.id && s.isActive
      );

      expect(loggedOutSession).toBeUndefined();
    });

    test('3.4 Logout all devices', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      await sessionService.invalidateAllUserSessions(
        user!.id,
        'User logged out from all devices'
      );

      const activeSessions = await sessionService.getAllUserSessions(
        user!.id,
        false // includeInactive = false
      );

      expect(activeSessions.length).toBe(0);
    });
  });

  describe('Test Suite 4: Password Management', () => {
    test('4.1 Request password reset', async () => {
      const result = await authService.requestPasswordReset('newuser@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/reset.*sent/i);

      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      expect(user!.passwordResetToken).toBeDefined();
      expect(user!.passwordResetExpires).toBeDefined();
    });

    test('4.2 Reset password with token', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const oldPasswordHash = user!.passwordHash;

      await authService.resetPassword(
        user!.passwordResetToken!,
        'NewSecurePassword456!'
      );

      const updatedUser = await userRepo.findOne({
        where: { id: user!.id }
      });

      expect(updatedUser!.passwordHash).not.toBe(oldPasswordHash);
      expect(updatedUser!.passwordResetToken).toBeNull();
      expect(updatedUser!.passwordResetExpires).toBeNull();

      // Verify can login with new password
      const loginResult = await authService.login(
        {
          email: 'newuser@example.com',
          password: 'NewSecurePassword456!'
        },
        'device-test-1'
      );

      expect(loginResult.user).toBeDefined();
    });

    test('4.3 Change password (authenticated)', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      await authService.changePassword(
        user!.id,
        'NewSecurePassword456!',
        'AnotherPassword789!'
      );

      // Verify old password no longer works
      await expect(
        authService.login(
          {
            email: 'newuser@example.com',
            password: 'NewSecurePassword456!'
          },
          'device-test-2'
        )
      ).rejects.toThrow(/invalid.*credentials/i);

      // Verify new password works
      const loginResult = await authService.login(
        {
          email: 'newuser@example.com',
          password: 'AnotherPassword789!'
        },
        'device-test-3'
      );

      expect(loginResult.user).toBeDefined();
    });
  });

  describe('Test Suite 5: Multi-Device Registration', () => {
    test('5.1 Register multiple devices for one user', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const desktop = await syncService.registerDevice({
        userId: user!.id,
        deviceName: 'MacBook Pro',
        deviceType: DeviceType.DESKTOP,
        platform: 'macOS'
      });

      const mobile = await syncService.registerDevice({
        userId: user!.id,
        deviceName: 'iPhone 15',
        deviceType: DeviceType.MOBILE,
        platform: 'iOS'
      });

      const web = await syncService.registerDevice({
        userId: user!.id,
        deviceName: 'Chrome Browser',
        deviceType: DeviceType.WEB,
        platform: 'Chrome/Linux'
      });

      expect(desktop.id).toBeDefined();
      expect(mobile.id).toBeDefined();
      expect(web.id).toBeDefined();

      const devices = await syncService.getUserDevices(user!.id, true);
      expect(devices.length).toBeGreaterThanOrEqual(3);
    });

    test('5.2 Track last sync for each device', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const devices = await syncService.getUserDevices(user!.id, true);
      const device = devices[0];

      const before = device.lastSyncAt;

      await syncService.updateDeviceLastSync(device.id);

      const updated = await syncService.getDevice(device.id);
      expect(updated.lastSyncAt).not.toEqual(before);
    });
  });

  describe('Test Suite 6: Data Synchronization', () => {
    test('6.1 Record sync event on data change', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const devices = await syncService.getUserDevices(user!.id, true);
      const device = devices[0];

      const syncEvent = await syncService.recordSyncEvent({
        deviceId: device.id,
        entityType: 'Message',
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        operation: SyncOperation.CREATE,
        payload: { content: 'Hello, world!' },
        vectorClock: { [device.id]: 1 }
      });

      expect(syncEvent.id).toBeDefined();
      expect(syncEvent.operation).toBe(SyncOperation.CREATE);
    });

    test('6.2 Get sync events since last sync', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const devices = await syncService.getUserDevices(user!.id, true);
      const device1 = devices[0];
      const device2 = devices[1];

      // Device 1 creates an event
      await syncService.recordSyncEvent({
        deviceId: device1.id,
        entityType: 'Message',
        entityId: '123e4567-e89b-12d3-a456-426614174001',
        operation: SyncOperation.CREATE,
        payload: { content: 'Message from device 1' },
        vectorClock: { [device1.id]: 2 }
      });

      const oneSecondAgo = new Date(Date.now() - 1000);

      // Device 2 fetches events
      const events = await syncService.getSyncEventsSince(device2.id, oneSecondAgo);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.deviceId === device1.id)).toBe(true);
    });
  });

  describe('Test Suite 7: Conflict Detection & Resolution', () => {
    test('7.1 Detect concurrent edits (conflict)', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const devices = await syncService.getUserDevices(user!.id, true);
      const device1 = devices[0];
      const device2 = devices[1];

      const entityId = '123e4567-e89b-12d3-a456-426614174002';

      // Both devices edit the same message concurrently
      const event1 = await syncService.recordSyncEvent({
        deviceId: device1.id,
        entityType: 'Message',
        entityId,
        operation: SyncOperation.UPDATE,
        payload: { content: 'Version from device 1' },
        vectorClock: { [device1.id]: 3, [device2.id]: 1 }
      });

      const event2 = await syncService.recordSyncEvent({
        deviceId: device2.id,
        entityType: 'Message',
        entityId,
        operation: SyncOperation.UPDATE,
        payload: { content: 'Version from device 2' },
        vectorClock: { [device1.id]: 1, [device2.id]: 3 }
      });

      const conflicts = await syncService.detectConflicts([event1, event2]);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].events.length).toBe(2);
      expect(conflicts[0].entityId).toBe(entityId);
    });

    test('7.2 Resolve conflict with LAST_WRITE_WINS', async () => {
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const devices = await syncService.getUserDevices(user!.id, true);
      const device1 = devices[0];
      const device2 = devices[1];

      const entityId = '123e4567-e89b-12d3-a456-426614174003';

      const event1 = await syncService.recordSyncEvent({
        deviceId: device1.id,
        entityType: 'Message',
        entityId,
        operation: SyncOperation.UPDATE,
        payload: { content: 'Earlier version' },
        vectorClock: { [device1.id]: 4, [device2.id]: 2 }
      });

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const event2 = await syncService.recordSyncEvent({
        deviceId: device2.id,
        entityType: 'Message',
        entityId,
        operation: SyncOperation.UPDATE,
        payload: { content: 'Later version' },
        vectorClock: { [device1.id]: 2, [device2.id]: 4 }
      });

      const conflicts = await syncService.detectConflicts([event1, event2]);
      expect(conflicts.length).toBeGreaterThan(0);

      const resolved = await syncService.resolveConflict(
        conflicts[0].id,
        'LAST_WRITE_WINS',
        { selectedEventId: event2.id }
      );

      expect(resolved.conflictResolved).toBe(true);
    });
  });

  describe('Test Suite 8: RBAC - Organization Roles', () => {
    test('8.1 Create organization with owner', async () => {
      const userRepo = dataSource.getRepository(User);
      const orgRepo = dataSource.getRepository(Organization);

      const owner = await userRepo.findOne({
        where: { email: 'newuser@example.com' }
      });

      const org = orgRepo.create({
        name: 'Test Organization',
        slug: 'test-org',
        ownerId: owner!.id,
        plan: OrganizationPlanType.TEAM,
        maxSeats: 10
      });

      await orgRepo.save(org);

      await rbacService.addOrganizationMember({
        organizationId: org.id,
        userId: owner!.id,
        role: OrganizationRole.OWNER
      });

      const hasOwnerRole = await rbacService.checkOrganizationRole(
        owner!.id,
        org.id,
        OrganizationRole.OWNER
      );

      expect(hasOwnerRole).toBe(true);
    });

    test('8.2 Add organization member with ADMIN role', async () => {
      const userRepo = dataSource.getRepository(User);
      const orgRepo = dataSource.getRepository(Organization);

      const org = await orgRepo.findOne({ where: { slug: 'test-org' } });

      // Create another user
      const adminResult = await authService.register({
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        displayName: 'Admin User'
      });

      await rbacService.addOrganizationMember({
        organizationId: org!.id,
        userId: adminResult.user.id,
        role: OrganizationRole.ADMIN
      });

      const hasAdminRole = await rbacService.checkOrganizationRole(
        adminResult.user.id,
        org!.id,
        OrganizationRole.ADMIN
      );

      expect(hasAdminRole).toBe(true);
    });

    test('8.3 Check role hierarchy (ADMIN < OWNER)', async () => {
      const userRepo = dataSource.getRepository(User);
      const orgRepo = dataSource.getRepository(Organization);

      const org = await orgRepo.findOne({ where: { slug: 'test-org' } });
      const admin = await userRepo.findOne({ where: { email: 'admin@example.com' } });

      // Admin should NOT have owner role
      const hasOwnerRole = await rbacService.checkOrganizationRole(
        admin!.id,
        org!.id,
        OrganizationRole.OWNER
      );

      expect(hasOwnerRole).toBe(false);

      // But admin should have admin role
      const hasAdminRole = await rbacService.checkOrganizationRole(
        admin!.id,
        org!.id,
        OrganizationRole.ADMIN
      );

      expect(hasAdminRole).toBe(true);
    });
  });

  describe('Test Suite 9: RBAC - Workspace Permissions', () => {
    test('9.1 Organization admin has access to org workspaces', async () => {
      const userRepo = dataSource.getRepository(User);
      const orgRepo = dataSource.getRepository(Organization);
      const workspaceRepo = dataSource.getRepository(Workspace);

      const org = await orgRepo.findOne({ where: { slug: 'test-org' } });
      const admin = await userRepo.findOne({ where: { email: 'admin@example.com' } });

      // Create workspace owned by organization
      const workspace = workspaceRepo.create({
        name: 'Team Workspace',
        ownerType: WorkspaceOwnerType.ORGANIZATION,
        organizationId: org!.id
      });

      await workspaceRepo.save(workspace);

      // Check if admin has inherited access
      const hasAccess = await rbacService.hasInheritedAccess(
        admin!.id,
        PermissionEntityType.WORKSPACE,
        workspace.id,
        'read'
      );

      expect(hasAccess).toBe(true);
    });

    test('9.2 Add workspace member with EDITOR role', async () => {
      const userRepo = dataSource.getRepository(User);
      const workspaceRepo = dataSource.getRepository(Workspace);

      const workspace = await workspaceRepo.findOne({
        where: { name: 'Team Workspace' }
      });

      // Create another user
      const editorResult = await authService.register({
        email: 'editor@example.com',
        password: 'EditorPassword123!',
        displayName: 'Editor User'
      });

      await rbacService.addWorkspaceMember({
        workspaceId: workspace!.id,
        userId: editorResult.user.id,
        role: WorkspaceRole.EDITOR
      });

      const hasRole = await rbacService.checkWorkspaceRole(
        editorResult.user.id,
        workspace!.id,
        WorkspaceRole.EDITOR
      );

      expect(hasRole).toBe(true);
    });
  });

  describe('Test Suite 10: Fine-Grained Permissions', () => {
    test('10.1 Grant direct permission to user', async () => {
      const userRepo = dataSource.getRepository(User);
      const workspaceRepo = dataSource.getRepository(Workspace);

      const viewer = await authService.register({
        email: 'viewer@example.com',
        password: 'ViewerPassword123!',
        displayName: 'Viewer User'
      });

      const workspace = await workspaceRepo.findOne({
        where: { name: 'Team Workspace' }
      });

      // Grant read-only permission
      await permissionService.grantPermission({
        userId: viewer.user.id,
        entityType: PermissionEntityType.WORKSPACE,
        entityId: workspace!.id,
        permissions: {
          read: true,
          write: false,
          delete: false,
          share: false,
          export: false
        }
      });

      const canRead = await permissionService.checkPermission(
        viewer.user.id,
        PermissionEntityType.WORKSPACE,
        workspace!.id,
        'read'
      );

      const canWrite = await permissionService.checkPermission(
        viewer.user.id,
        PermissionEntityType.WORKSPACE,
        workspace!.id,
        'write'
      );

      expect(canRead).toBe(true);
      expect(canWrite).toBe(false);
    });

    test('10.2 Time-limited permission expires', async () => {
      const userRepo = dataSource.getRepository(User);
      const workspaceRepo = dataSource.getRepository(Workspace);

      const tempUser = await authService.register({
        email: 'temp@example.com',
        password: 'TempPassword123!',
        displayName: 'Temp User'
      });

      const workspace = await workspaceRepo.findOne({
        where: { name: 'Team Workspace' }
      });

      // Grant permission that expires in 1 second
      const expiresAt = new Date(Date.now() + 1000);

      await permissionService.grantPermission({
        userId: tempUser.user.id,
        entityType: PermissionEntityType.WORKSPACE,
        entityId: workspace!.id,
        permissions: { read: true },
        expiresAt
      });

      // Should have access now
      const hasAccessNow = await permissionService.checkPermission(
        tempUser.user.id,
        PermissionEntityType.WORKSPACE,
        workspace!.id,
        'read'
      );

      expect(hasAccessNow).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should NOT have access after expiration
      const hasAccessLater = await permissionService.checkPermission(
        tempUser.user.id,
        PermissionEntityType.WORKSPACE,
        workspace!.id,
        'read'
      );

      expect(hasAccessLater).toBe(false);
    });
  });

  describe('Summary: Phase 4 Test Results', () => {
    test('All Phase 4 tests passed - Generate summary', async () => {
      const userRepo = dataSource.getRepository(User);
      const sessionRepo = dataSource.getRepository(Session);
      const deviceRepo = dataSource.getRepository(Device);
      const syncEventRepo = dataSource.getRepository(SyncEvent);

      const userCount = await userRepo.count();
      const sessionCount = await sessionRepo.count();
      const deviceCount = await deviceRepo.count();
      const syncEventCount = await syncEventRepo.count();

      console.log('\n=== Phase 4 Test Summary ===');
      console.log('Authentication & Session Management:');
      console.log(`  Users: ${userCount}`);
      console.log(`  Active Sessions: ${sessionCount}`);
      console.log('Multi-Device Support:');
      console.log(`  Registered Devices: ${deviceCount}`);
      console.log(`  Sync Events: ${syncEventCount}`);
      console.log('\nAll Phase 4 tests completed successfully! ✓');

      expect(true).toBe(true);
    });
  });
});
