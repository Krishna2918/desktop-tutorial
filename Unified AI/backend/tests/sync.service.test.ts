/**
 * Tests for Multi-device Synchronization Service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { AppDataSource } from '../config/data-source';
import { SyncService } from '../services/sync.service';
import { DeviceType } from '../entities/Device';
import { SyncOperation, ConflictResolutionStrategy } from '../entities/SyncEvent';
import { User } from '../entities/User';
import {
  createVectorClock,
  incrementVectorClock,
  compareVectorClocks,
  ClockComparison
} from '../utils/vector-clock.util';
import { createDelta, applyDelta } from '../utils/delta.util';

describe('SyncService', () => {
  let syncService: SyncService;
  let testUser: User;

  beforeAll(async () => {
    // Initialize database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    syncService = new SyncService();

    // Create test user
    const userRepo = AppDataSource.getRepository(User);
    testUser = userRepo.create({
      email: `sync-test-${Date.now()}@example.com`,
      passwordHash: 'test-hash',
      fullName: 'Sync Test User'
    });
    testUser = await userRepo.save(testUser);
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      const userRepo = AppDataSource.getRepository(User);
      await userRepo.remove(testUser);
    }

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('Device Management', () => {
    it('should register a new device', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Test Desktop',
        DeviceType.DESKTOP,
        'macOS 13.0'
      );

      expect(device.id).toBeDefined();
      expect(device.deviceName).toBe('Test Desktop');
      expect(device.deviceType).toBe(DeviceType.DESKTOP);
      expect(device.platform).toBe('macOS 13.0');
      expect(device.isActive).toBe(true);
    });

    it('should prevent duplicate device registration', async () => {
      await syncService.registerDevice(
        testUser.id,
        'Duplicate Device',
        DeviceType.MOBILE,
        'iOS 16.0'
      );

      await expect(
        syncService.registerDevice(
          testUser.id,
          'Duplicate Device',
          DeviceType.MOBILE,
          'iOS 16.0'
        )
      ).rejects.toThrow('already exists');
    });

    it('should get user devices', async () => {
      const devices = await syncService.getUserDevices(testUser.id, true);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices.every(d => d.isActive)).toBe(true);
    });

    it('should get device by id', async () => {
      const devices = await syncService.getUserDevices(testUser.id, true);
      const firstDevice = devices[0];

      const device = await syncService.getDevice(firstDevice.id);
      expect(device).toBeDefined();
      expect(device!.id).toBe(firstDevice.id);
    });

    it('should deactivate a device', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Device to Deactivate',
        DeviceType.WEB,
        'Chrome 110'
      );

      await syncService.deactivateDevice(device.id);

      const deactivated = await syncService.getDevice(device.id);
      expect(deactivated!.isActive).toBe(false);
    });

    it('should update device last sync time', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Sync Time Test',
        DeviceType.DESKTOP,
        'Windows 11'
      );

      const beforeUpdate = device.lastSyncAt;
      await new Promise(resolve => setTimeout(resolve, 100));

      await syncService.updateDeviceLastSync(device.id);

      const updated = await syncService.getDevice(device.id);
      expect(updated!.lastSyncAt!.getTime()).toBeGreaterThan(beforeUpdate!.getTime());
    });
  });

  describe('Sync Event Management', () => {
    it('should record a sync event', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Event Test Device',
        DeviceType.DESKTOP,
        'Linux'
      );

      const vectorClock = createVectorClock(device.id);
      const event = await syncService.recordSyncEvent(
        device.id,
        'Message',
        'msg-123',
        SyncOperation.CREATE,
        { content: 'Hello World' },
        vectorClock
      );

      expect(event.id).toBeDefined();
      expect(event.entityType).toBe('Message');
      expect(event.entityId).toBe('msg-123');
      expect(event.operation).toBe(SyncOperation.CREATE);
      expect(event.payload?.content).toBe('Hello World');
    });

    it('should get sync events since timestamp', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Timeline Test',
        DeviceType.MOBILE,
        'Android 13'
      );

      const startTime = new Date();
      await new Promise(resolve => setTimeout(resolve, 100));

      const clock = createVectorClock(device.id);
      await syncService.recordSyncEvent(
        device.id,
        'Message',
        'msg-456',
        SyncOperation.CREATE,
        { content: 'Test' },
        clock
      );

      const events = await syncService.getSyncEventsSince(device.id, startTime);
      expect(events.length).toBeGreaterThan(0);
    });

    it('should get sync events for entity', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Entity Test',
        DeviceType.WEB,
        'Firefox'
      );

      const entityId = `entity-${Date.now()}`;
      let clock = createVectorClock(device.id);

      await syncService.recordSyncEvent(
        device.id,
        'Thread',
        entityId,
        SyncOperation.CREATE,
        { title: 'Test Thread' },
        clock
      );

      clock = incrementVectorClock(clock, device.id);
      await syncService.recordSyncEvent(
        device.id,
        'Thread',
        entityId,
        SyncOperation.UPDATE,
        { title: 'Updated Thread' },
        clock
      );

      const events = await syncService.getSyncEventsForEntity('Thread', entityId);
      expect(events.length).toBe(2);
      expect(events[0].operation).toBe(SyncOperation.CREATE);
      expect(events[1].operation).toBe(SyncOperation.UPDATE);
    });
  });

  describe('Vector Clock Operations', () => {
    it('should compare vector clocks correctly', () => {
      const clock1 = { 'device-1': 1, 'device-2': 2 };
      const clock2 = { 'device-1': 2, 'device-2': 2 };

      const comparison = syncService.compareVectorClocks(clock1, clock2);
      expect(comparison).toBe(ClockComparison.BEFORE);
    });

    it('should detect concurrent clocks', () => {
      const clock1 = { 'device-1': 2, 'device-2': 1 };
      const clock2 = { 'device-1': 1, 'device-2': 2 };

      const comparison = syncService.compareVectorClocks(clock1, clock2);
      expect(comparison).toBe(ClockComparison.CONCURRENT);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts between concurrent events', async () => {
      const device1 = await syncService.registerDevice(
        testUser.id,
        'Conflict Device 1',
        DeviceType.DESKTOP,
        'macOS'
      );

      const device2 = await syncService.registerDevice(
        testUser.id,
        'Conflict Device 2',
        DeviceType.MOBILE,
        'iOS'
      );

      const entityId = `conflict-entity-${Date.now()}`;

      // Create concurrent events (different devices, same entity)
      const clock1 = createVectorClock(device1.id);
      const clock2 = createVectorClock(device2.id);

      const event1 = await syncService.recordSyncEvent(
        device1.id,
        'Message',
        entityId,
        SyncOperation.UPDATE,
        { content: 'Version from device 1' },
        clock1
      );

      const event2 = await syncService.recordSyncEvent(
        device2.id,
        'Message',
        entityId,
        SyncOperation.UPDATE,
        { content: 'Version from device 2' },
        clock2
      );

      const conflicts = await syncService.detectConflicts([event1, event2]);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].entityId).toBe(entityId);
    });

    it('should get unresolved conflicts for user', async () => {
      const conflicts = await syncService.getUnresolvedConflicts(testUser.id);
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict with LAST_WRITE_WINS strategy', async () => {
      const device1 = await syncService.registerDevice(
        testUser.id,
        'Resolution Device 1',
        DeviceType.DESKTOP,
        'Windows'
      );

      const device2 = await syncService.registerDevice(
        testUser.id,
        'Resolution Device 2',
        DeviceType.WEB,
        'Chrome'
      );

      const entityId = `resolve-entity-${Date.now()}`;

      const clock1 = createVectorClock(device1.id);
      const clock2 = createVectorClock(device2.id);

      const event1 = await syncService.recordSyncEvent(
        device1.id,
        'Message',
        entityId,
        SyncOperation.UPDATE,
        { content: 'First version' },
        clock1
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const event2 = await syncService.recordSyncEvent(
        device2.id,
        'Message',
        entityId,
        SyncOperation.UPDATE,
        { content: 'Second version' },
        clock2
      );

      const conflictId = `${event1.id}-${event2.id}`;
      await syncService.resolveConflict(
        conflictId,
        ConflictResolutionStrategy.LAST_WRITE_WINS
      );

      const events = await syncService.getSyncEventsForEntity('Message', entityId);
      const resolvedEvents = events.filter(e => e.conflictResolved);
      expect(resolvedEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should resolve conflict with MANUAL strategy', async () => {
      const device1 = await syncService.registerDevice(
        testUser.id,
        'Manual Resolution 1',
        DeviceType.DESKTOP,
        'Linux'
      );

      const device2 = await syncService.registerDevice(
        testUser.id,
        'Manual Resolution 2',
        DeviceType.MOBILE,
        'Android'
      );

      const entityId = `manual-resolve-${Date.now()}`;

      const clock1 = createVectorClock(device1.id);
      const clock2 = createVectorClock(device2.id);

      const event1 = await syncService.recordSyncEvent(
        device1.id,
        'Document',
        entityId,
        SyncOperation.UPDATE,
        { title: 'Title A', content: 'Content A' },
        clock1
      );

      const event2 = await syncService.recordSyncEvent(
        device2.id,
        'Document',
        entityId,
        SyncOperation.UPDATE,
        { title: 'Title B', content: 'Content B' },
        clock2
      );

      const conflictId = `${event1.id}-${event2.id}`;
      const manualResolution = {
        title: 'Merged Title',
        content: 'Merged Content'
      };

      await syncService.resolveConflict(
        conflictId,
        ConflictResolutionStrategy.MANUAL,
        manualResolution
      );

      const events = await syncService.getSyncEventsForEntity('Document', entityId);
      const latestEvent = events[events.length - 1];
      expect(latestEvent.payload?.title).toBe('Merged Title');
    });
  });

  describe('Delta Operations', () => {
    it('should create delta from changes', () => {
      const before = {
        title: 'Original Title',
        content: 'Original Content',
        tags: ['tag1']
      };

      const after = {
        title: 'Updated Title',
        content: 'Original Content',
        tags: ['tag1', 'tag2']
      };

      const delta = syncService.createDelta(before, after);
      expect(delta.length).toBeGreaterThan(0);

      const titleChange = delta.find(c => c.path.includes('title'));
      expect(titleChange).toBeDefined();
      expect(titleChange!.value).toBe('Updated Title');
    });

    it('should apply delta to object', async () => {
      const base = {
        name: 'John',
        age: 30
      };

      const delta = [
        {
          op: 'replace' as any,
          path: '/age',
          value: 31,
          oldValue: 30
        }
      ];

      const result = await syncService.applyDelta('User', 'user-1', delta);
      expect(result.age).toBe(31);
    });
  });

  describe('Sync Coordination', () => {
    it('should initiate sync for device', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Sync Coordination Test',
        DeviceType.DESKTOP,
        'macOS'
      );

      const syncData = await syncService.initiateSyncForDevice(device.id);
      expect(syncData.vectorClock).toBeDefined();
      expect(Array.isArray(syncData.pendingEvents)).toBe(true);
    });

    it('should complete sync for device', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Complete Sync Test',
        DeviceType.MOBILE,
        'iOS'
      );

      const syncUpTo = new Date();
      await syncService.completeSyncForDevice(device.id, syncUpTo);

      const updated = await syncService.getDevice(device.id);
      expect(updated!.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(syncUpTo.getTime());
    });

    it('should get sync status for device', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Status Test Device',
        DeviceType.WEB,
        'Safari'
      );

      // Create some events
      const clock = createVectorClock(device.id);
      await syncService.recordSyncEvent(
        device.id,
        'Message',
        'msg-status-test',
        SyncOperation.CREATE,
        { content: 'Status test' },
        clock
      );

      const status = await syncService.getSyncStatus(device.id);
      expect(status.deviceId).toBe(device.id);
      expect(status.lastSyncAt).toBeDefined();
      expect(typeof status.pendingEvents).toBe('number');
      expect(typeof status.unresolvedConflicts).toBe('number');
      expect(typeof status.isHealthy).toBe('boolean');
    });
  });

  describe('Batch Operations', () => {
    it('should batch sync events efficiently', async () => {
      const device = await syncService.registerDevice(
        testUser.id,
        'Batch Test Device',
        DeviceType.DESKTOP,
        'Linux'
      );

      const events = [];
      let clock = createVectorClock(device.id);

      for (let i = 0; i < 50; i++) {
        clock = incrementVectorClock(clock, device.id);
        events.push({
          deviceId: device.id,
          entityType: 'Message',
          entityId: `batch-msg-${i}`,
          operation: SyncOperation.CREATE,
          payload: { content: `Message ${i}` },
          vectorClock: clock
        });
      }

      const savedEvents = await syncService.batchSyncEvents(events);
      expect(savedEvents.length).toBe(50);
    });
  });

  describe('Statistics', () => {
    it('should get sync statistics for user', async () => {
      const stats = await syncService.getSyncStatistics(testUser.id);

      expect(typeof stats.totalDevices).toBe('number');
      expect(typeof stats.activeDevices).toBe('number');
      expect(typeof stats.totalEvents).toBe('number');
      expect(typeof stats.unresolvedConflicts).toBe('number');
      expect(stats.totalDevices).toBeGreaterThanOrEqual(stats.activeDevices);
    });
  });
});
