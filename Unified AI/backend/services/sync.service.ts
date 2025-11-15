/**
 * Multi-device Synchronization Service
 * Implements CRDT-based conflict resolution using vector clocks
 */

import { Repository, MoreThan, In } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { Device, DeviceType } from '../entities/Device';
import { SyncEvent, SyncOperation, ConflictResolutionStrategy } from '../entities/SyncEvent';
import {
  VectorClock,
  createVectorClock,
  incrementVectorClock,
  compareVectorClocks,
  mergeVectorClocks,
  ClockComparison,
  areConcurrent,
  isValidVectorClock
} from '../utils/vector-clock.util';
import {
  Delta,
  DeltaChange,
  createDelta,
  applyDelta,
  mergeDelta,
  threeWayMerge,
  optimizeDelta,
  calculateChecksum
} from '../utils/delta.util';

export interface DeviceRegistration {
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  platform: string;
}

export interface SyncEventData {
  deviceId: string;
  entityType: string;
  entityId: string;
  operation: SyncOperation;
  payload?: Record<string, any>;
  vectorClock: VectorClock;
}

export interface Conflict {
  id: string;
  entityType: string;
  entityId: string;
  events: SyncEvent[];
  detectedAt: Date;
}

export interface SyncStatus {
  deviceId: string;
  lastSyncAt?: Date;
  pendingEvents: number;
  unresolvedConflicts: number;
  isHealthy: boolean;
  vectorClock?: VectorClock;
}

export interface ConflictResolution {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolution?: any;
  resolvedBy?: string;
}

export class SyncService {
  private deviceRepository: Repository<Device>;
  private syncEventRepository: Repository<SyncEvent>;

  constructor() {
    this.deviceRepository = AppDataSource.getRepository(Device);
    this.syncEventRepository = AppDataSource.getRepository(SyncEvent);
  }

  // ========================================
  // Device Management
  // ========================================

  /**
   * Register a new device for synchronization
   */
  async registerDevice(
    userId: string,
    deviceName: string,
    deviceType: DeviceType,
    platform: string
  ): Promise<Device> {
    try {
      // Check if device with same name already exists for user
      const existingDevice = await this.deviceRepository.findOne({
        where: { userId, deviceName, isActive: true }
      });

      if (existingDevice) {
        throw new Error(`Device with name "${deviceName}" already exists for this user`);
      }

      const device = this.deviceRepository.create({
        userId,
        deviceName,
        deviceType,
        platform,
        isActive: true,
        lastSyncAt: new Date()
      });

      const savedDevice = await this.deviceRepository.save(device);

      // Create initial sync event to establish vector clock
      const initialClock = createVectorClock(savedDevice.id);
      await this.recordSyncEvent(
        savedDevice.id,
        'Device',
        savedDevice.id,
        SyncOperation.CREATE,
        { deviceName, deviceType, platform },
        initialClock
      );

      return savedDevice;
    } catch (error) {
      throw new Error(
        `Failed to register device: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get device information
   */
  async getDevice(deviceId: string): Promise<Device | null> {
    try {
      return await this.deviceRepository.findOne({
        where: { id: deviceId },
        relations: ['user']
      });
    } catch (error) {
      throw new Error(
        `Failed to get device: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string, activeOnly: boolean = true): Promise<Device[]> {
    try {
      const where: any = { userId };
      if (activeOnly) {
        where.isActive = true;
      }

      return await this.deviceRepository.find({
        where,
        order: { lastSyncAt: 'DESC' }
      });
    } catch (error) {
      throw new Error(
        `Failed to get user devices: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId: string): Promise<void> {
    try {
      const device = await this.getDevice(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      device.isActive = false;
      await this.deviceRepository.save(device);

      // Record deactivation event
      const latestEvent = await this.getLatestEventForDevice(deviceId);
      const clock = latestEvent?.vectorClock
        ? incrementVectorClock(latestEvent.vectorClock, deviceId)
        : createVectorClock(deviceId);

      await this.recordSyncEvent(
        deviceId,
        'Device',
        deviceId,
        SyncOperation.DELETE,
        { deactivatedAt: new Date() },
        clock
      );
    } catch (error) {
      throw new Error(
        `Failed to deactivate device: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update device's last sync timestamp
   */
  async updateDeviceLastSync(deviceId: string): Promise<void> {
    try {
      await this.deviceRepository.update(
        { id: deviceId },
        { lastSyncAt: new Date() }
      );
    } catch (error) {
      throw new Error(
        `Failed to update device last sync: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ========================================
  // Sync Event Management
  // ========================================

  /**
   * Record a synchronization event
   */
  async recordSyncEvent(
    deviceId: string,
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    payload: Record<string, any>,
    vectorClock: VectorClock
  ): Promise<SyncEvent> {
    try {
      // Validate vector clock
      if (!isValidVectorClock(vectorClock)) {
        throw new Error('Invalid vector clock format');
      }

      // Verify device exists
      const device = await this.getDevice(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      const syncEvent = this.syncEventRepository.create({
        deviceId,
        entityType,
        entityId,
        operation,
        payload,
        vectorClock,
        conflictResolved: false
      });

      const savedEvent = await this.syncEventRepository.save(syncEvent);

      // Check for conflicts with existing events
      await this.detectAndMarkConflicts(savedEvent);

      return savedEvent;
    } catch (error) {
      throw new Error(
        `Failed to record sync event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get sync events since a specific timestamp for a device
   */
  async getSyncEventsSince(
    deviceId: string,
    timestamp: Date
  ): Promise<SyncEvent[]> {
    try {
      return await this.syncEventRepository.find({
        where: {
          syncedAt: MoreThan(timestamp)
        },
        order: { syncedAt: 'ASC' }
      });
    } catch (error) {
      throw new Error(
        `Failed to get sync events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all sync events for a specific entity
   */
  async getSyncEventsForEntity(
    entityType: string,
    entityId: string
  ): Promise<SyncEvent[]> {
    try {
      return await this.syncEventRepository.find({
        where: { entityType, entityId },
        order: { syncedAt: 'ASC' }
      });
    } catch (error) {
      throw new Error(
        `Failed to get entity sync events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Mark sync events as processed/synced
   */
  async markEventsSynced(eventIds: string[]): Promise<void> {
    try {
      // For now, we just verify they exist
      // In a more complex system, you might add a 'synced' flag to track per-device sync status
      const events = await this.syncEventRepository.find({
        where: { id: In(eventIds) }
      });

      if (events.length !== eventIds.length) {
        throw new Error('Some events not found');
      }

      // Could add additional tracking here if needed
    } catch (error) {
      throw new Error(
        `Failed to mark events as synced: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ========================================
  // Conflict Detection & Resolution
  // ========================================

  /**
   * Detect conflicts among sync events
   */
  async detectConflicts(events: SyncEvent[]): Promise<Conflict[]> {
    try {
      const conflicts: Conflict[] = [];
      const entityMap = new Map<string, SyncEvent[]>();

      // Group events by entity
      for (const event of events) {
        const key = `${event.entityType}:${event.entityId}`;
        if (!entityMap.has(key)) {
          entityMap.set(key, []);
        }
        entityMap.get(key)!.push(event);
      }

      // Check each entity for conflicts
      for (const [key, entityEvents] of entityMap) {
        const [entityType, entityId] = key.split(':');

        // Compare all pairs of events
        for (let i = 0; i < entityEvents.length; i++) {
          for (let j = i + 1; j < entityEvents.length; j++) {
            const event1 = entityEvents[i];
            const event2 = entityEvents[j];

            // Skip if either event is already resolved
            if (event1.conflictResolved || event2.conflictResolved) {
              continue;
            }

            // Check if events are concurrent (conflict)
            if (
              event1.vectorClock &&
              event2.vectorClock &&
              areConcurrent(event1.vectorClock, event2.vectorClock)
            ) {
              conflicts.push({
                id: `${event1.id}-${event2.id}`,
                entityType,
                entityId,
                events: [event1, event2],
                detectedAt: new Date()
              });
            }
          }
        }
      }

      return conflicts;
    } catch (error) {
      throw new Error(
        `Failed to detect conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resolve a conflict using specified strategy
   */
  async resolveConflict(
    conflictId: string,
    strategy: ConflictResolutionStrategy,
    resolution?: any
  ): Promise<void> {
    try {
      // Parse conflict ID to get event IDs
      const [eventId1, eventId2] = conflictId.split('-');

      const events = await this.syncEventRepository.find({
        where: { id: In([eventId1, eventId2]) }
      });

      if (events.length !== 2) {
        throw new Error('Conflict events not found');
      }

      const [event1, event2] = events;

      let resolvedPayload: any;

      switch (strategy) {
        case ConflictResolutionStrategy.LAST_WRITE_WINS:
          // Use the event with the latest timestamp
          resolvedPayload = event1.syncedAt > event2.syncedAt
            ? event1.payload
            : event2.payload;
          break;

        case ConflictResolutionStrategy.MANUAL:
          // Use the provided resolution
          if (!resolution) {
            throw new Error('Manual resolution requires a resolution payload');
          }
          resolvedPayload = resolution;
          break;

        case ConflictResolutionStrategy.MERGE:
          // Perform three-way merge
          const base = {}; // In production, fetch the common ancestor
          const result = threeWayMerge(
            base,
            event1.payload || {},
            event2.payload || {}
          );

          if (result.conflicts.length > 0) {
            // Still have conflicts after merge, escalate to manual
            throw new Error('Automatic merge failed, manual resolution required');
          }

          resolvedPayload = result.result;
          break;

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      // Mark events as resolved
      event1.conflictResolved = true;
      event1.conflictResolutionStrategy = strategy;
      event2.conflictResolved = true;
      event2.conflictResolutionStrategy = strategy;

      await this.syncEventRepository.save([event1, event2]);

      // Create a new resolved event with merged vector clocks
      const mergedClock = mergeVectorClocks(
        event1.vectorClock || {},
        event2.vectorClock || {}
      );

      await this.recordSyncEvent(
        event1.deviceId, // Use first device as source
        event1.entityType,
        event1.entityId,
        SyncOperation.UPDATE,
        resolvedPayload,
        mergedClock
      );
    } catch (error) {
      throw new Error(
        `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get unresolved conflicts for a user
   */
  async getUnresolvedConflicts(userId: string): Promise<Conflict[]> {
    try {
      // Get all user devices
      const devices = await this.getUserDevices(userId, true);
      const deviceIds = devices.map(d => d.id);

      if (deviceIds.length === 0) {
        return [];
      }

      // Get unresolved events
      const unresolvedEvents = await this.syncEventRepository.find({
        where: {
          deviceId: In(deviceIds),
          conflictResolved: false
        },
        order: { syncedAt: 'ASC' }
      });

      // Detect conflicts among these events
      return await this.detectConflicts(unresolvedEvents);
    } catch (error) {
      throw new Error(
        `Failed to get unresolved conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Compare two vector clocks
   */
  compareVectorClocks(
    clock1: VectorClock,
    clock2: VectorClock
  ): ClockComparison {
    return compareVectorClocks(clock1, clock2);
  }

  // ========================================
  // Delta Application
  // ========================================

  /**
   * Apply a delta to an entity
   */
  async applyDelta(
    entityType: string,
    entityId: string,
    delta: Delta | DeltaChange[]
  ): Promise<any> {
    try {
      // In production, fetch the current state of the entity
      // For now, we'll work with the delta directly
      const currentState = {}; // Fetch from appropriate repository

      const newState = applyDelta(currentState, delta);

      // Validate the result
      if (Array.isArray(delta)) {
        // Calculate checksum for validation
        const checksum = calculateChecksum(newState);
        console.log(`Applied delta to ${entityType}:${entityId}, checksum: ${checksum}`);
      }

      return newState;
    } catch (error) {
      throw new Error(
        `Failed to apply delta: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a delta from before/after states
   */
  createDelta(before: any, after: any): DeltaChange[] {
    return createDelta(before, after);
  }

  /**
   * Merge two deltas (three-way merge)
   */
  mergeDelta(
    base: any,
    delta1: Delta,
    delta2: Delta
  ): {
    result: any;
    conflicts: Array<{ path: string; delta1Value: any; delta2Value: any }>;
  } {
    return mergeDelta(base, delta1, delta2);
  }

  // ========================================
  // Sync Coordination
  // ========================================

  /**
   * Initiate synchronization for a device
   */
  async initiateSyncForDevice(deviceId: string): Promise<{
    pendingEvents: SyncEvent[];
    vectorClock: VectorClock;
  }> {
    try {
      const device = await this.getDevice(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      if (!device.isActive) {
        throw new Error('Device is not active');
      }

      // Get the latest vector clock for this device
      const latestEvent = await this.getLatestEventForDevice(deviceId);
      const currentClock = latestEvent?.vectorClock || createVectorClock(deviceId);

      // Get all events since last sync
      const lastSyncTime = device.lastSyncAt || new Date(0);
      const pendingEvents = await this.getSyncEventsSince(deviceId, lastSyncTime);

      return {
        pendingEvents,
        vectorClock: currentClock
      };
    } catch (error) {
      throw new Error(
        `Failed to initiate sync: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Complete synchronization for a device
   */
  async completeSyncForDevice(
    deviceId: string,
    syncedUpTo: Date
  ): Promise<void> {
    try {
      const device = await this.getDevice(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      // Update last sync time
      device.lastSyncAt = syncedUpTo;
      await this.deviceRepository.save(device);

      // Optionally, clean up old sync events
      // await this.cleanupOldSyncEvents(deviceId, syncedUpTo);
    } catch (error) {
      throw new Error(
        `Failed to complete sync: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get sync status for a device
   */
  async getSyncStatus(deviceId: string): Promise<SyncStatus> {
    try {
      const device = await this.getDevice(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      // Get pending events
      const lastSyncTime = device.lastSyncAt || new Date(0);
      const pendingEvents = await this.getSyncEventsSince(deviceId, lastSyncTime);

      // Get unresolved conflicts
      const conflicts = await this.getUnresolvedConflicts(device.userId);
      const deviceConflicts = conflicts.filter(c =>
        c.events.some(e => e.deviceId === deviceId)
      );

      // Get latest vector clock
      const latestEvent = await this.getLatestEventForDevice(deviceId);
      const vectorClock = latestEvent?.vectorClock;

      // Determine health status
      const isHealthy =
        device.isActive &&
        deviceConflicts.length === 0 &&
        (device.lastSyncAt ? (Date.now() - device.lastSyncAt.getTime()) < 3600000 : false); // Synced in last hour

      return {
        deviceId,
        lastSyncAt: device.lastSyncAt,
        pendingEvents: pendingEvents.length,
        unresolvedConflicts: deviceConflicts.length,
        isHealthy,
        vectorClock
      };
    } catch (error) {
      throw new Error(
        `Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Get the latest sync event for a device
   */
  private async getLatestEventForDevice(deviceId: string): Promise<SyncEvent | null> {
    try {
      const events = await this.syncEventRepository.find({
        where: { deviceId },
        order: { syncedAt: 'DESC' },
        take: 1
      });

      return events.length > 0 ? events[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect and mark conflicts for a new event
   */
  private async detectAndMarkConflicts(newEvent: SyncEvent): Promise<void> {
    try {
      // Get all events for the same entity
      const relatedEvents = await this.getSyncEventsForEntity(
        newEvent.entityType,
        newEvent.entityId
      );

      // Check for conflicts with existing events
      for (const existingEvent of relatedEvents) {
        if (
          existingEvent.id !== newEvent.id &&
          !existingEvent.conflictResolved &&
          existingEvent.vectorClock &&
          newEvent.vectorClock &&
          areConcurrent(existingEvent.vectorClock, newEvent.vectorClock)
        ) {
          // Found a conflict - both events remain marked as unresolved
          console.log(
            `Conflict detected between events ${existingEvent.id} and ${newEvent.id}`
          );
        }
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Cleanup old sync events (optional maintenance)
   */
  private async cleanupOldSyncEvents(
    deviceId: string,
    olderThan: Date
  ): Promise<void> {
    try {
      // Only delete resolved events older than the specified date
      await this.syncEventRepository
        .createQueryBuilder()
        .delete()
        .where('deviceId = :deviceId', { deviceId })
        .andWhere('conflictResolved = :resolved', { resolved: true })
        .andWhere('syncedAt < :date', { date: olderThan })
        .execute();
    } catch (error) {
      console.error('Error cleaning up old sync events:', error);
      // Don't throw - this is a maintenance operation
    }
  }

  /**
   * Batch process sync events for efficiency
   */
  async batchSyncEvents(events: SyncEventData[]): Promise<SyncEvent[]> {
    try {
      const savedEvents: SyncEvent[] = [];

      // Process events in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        const batch = events.slice(i, i + BATCH_SIZE);

        const syncEvents = batch.map(eventData =>
          this.syncEventRepository.create({
            deviceId: eventData.deviceId,
            entityType: eventData.entityType,
            entityId: eventData.entityId,
            operation: eventData.operation,
            payload: eventData.payload,
            vectorClock: eventData.vectorClock,
            conflictResolved: false
          })
        );

        const saved = await this.syncEventRepository.save(syncEvents);
        savedEvents.push(...saved);
      }

      // Detect conflicts for all saved events
      await this.detectConflicts(savedEvents);

      return savedEvents;
    } catch (error) {
      throw new Error(
        `Failed to batch sync events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get sync statistics for monitoring
   */
  async getSyncStatistics(userId: string): Promise<{
    totalDevices: number;
    activeDevices: number;
    totalEvents: number;
    unresolvedConflicts: number;
    lastSyncTime?: Date;
  }> {
    try {
      const devices = await this.getUserDevices(userId, false);
      const activeDevices = devices.filter(d => d.isActive);

      const deviceIds = devices.map(d => d.id);
      const totalEvents = deviceIds.length > 0
        ? await this.syncEventRepository.count({
            where: { deviceId: In(deviceIds) }
          })
        : 0;

      const conflicts = await this.getUnresolvedConflicts(userId);

      const lastSyncTime = devices.reduce((latest: Date | undefined, device) => {
        if (!device.lastSyncAt) return latest;
        if (!latest || device.lastSyncAt > latest) return device.lastSyncAt;
        return latest;
      }, undefined);

      return {
        totalDevices: devices.length,
        activeDevices: activeDevices.length,
        totalEvents,
        unresolvedConflicts: conflicts.length,
        lastSyncTime
      };
    } catch (error) {
      throw new Error(
        `Failed to get sync statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Singleton instance
export const syncService = new SyncService();
