# Multi-Device Synchronization Service

A comprehensive, production-ready synchronization service for the Unified AI Hub that implements CRDT-based conflict resolution using vector clocks.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Conflict Resolution](#conflict-resolution)
- [Best Practices](#best-practices)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)

## Overview

The Sync Service enables seamless multi-device synchronization with:

- **Vector Clock CRDTs** for distributed conflict detection
- **Delta synchronization** for efficient bandwidth usage
- **Automatic and manual conflict resolution**
- **Batch operations** for high-throughput scenarios
- **Offline-first support** with queue management
- **Real-time sync status monitoring**

## Features

### Device Management
- Register/deactivate devices
- Track device metadata (type, platform, last sync)
- Query user's devices
- Per-device vector clocks

### Sync Event Management
- Record create/update/delete operations
- Query events by timestamp or entity
- Batch event processing
- Event metadata and checksums

### Conflict Detection & Resolution
- Automatic conflict detection using vector clocks
- Multiple resolution strategies:
  - **LAST_WRITE_WINS**: Timestamp-based (automatic)
  - **MANUAL**: User-driven resolution
  - **MERGE**: Three-way merge (automatic when possible)
- Conflict history and audit trail

### Delta Application
- Compute deltas between states
- Apply deltas to entities
- Three-way merge for conflicts
- Delta optimization and compression

### Sync Coordination
- Initiate sync sessions
- Track sync progress
- Health monitoring
- Statistics and analytics

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Device 1  │     │   Device 2  │     │   Device 3  │
│  (Desktop)  │     │   (Mobile)  │     │    (Web)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                    │
       └───────────────────┴────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Sync Service │
                    └──────┬──────┘
                           │
       ┌───────────────────┴────────────────────┐
       │                                        │
┌──────▼──────┐                        ┌───────▼────────┐
│   Device    │                        │   SyncEvent    │
│  Repository │                        │   Repository   │
└─────────────┘                        └────────────────┘
       │                                        │
       └────────────────┬───────────────────────┘
                        │
                ┌───────▼────────┐
                │    Database    │
                │  (SQLite/PG)   │
                └────────────────┘
```

### Vector Clock Flow

```
Device 1: {d1:1, d2:0, d3:0} → CREATE message
Device 2: {d1:1, d2:1, d3:0} → UPDATE message (causal)
Device 3: {d1:0, d2:0, d3:1} → UPDATE message (concurrent - CONFLICT!)
```

## Installation

The service is already integrated into the Unified AI Hub backend. No additional installation needed.

### Dependencies

```json
{
  "typeorm": "^0.3.x",
  "sqlite3": "^5.x",
  "pg": "^8.x"
}
```

## Quick Start

### 1. Register a Device

```typescript
import { syncService } from './services/sync.service';
import { DeviceType } from './entities/Device';

const device = await syncService.registerDevice(
  'user-123',              // userId
  'MacBook Pro',           // deviceName
  DeviceType.DESKTOP,      // deviceType
  'macOS 13.0'            // platform
);

console.log('Device ID:', device.id);
```

### 2. Record a Sync Event

```typescript
import { createVectorClock, incrementVectorClock } from './utils/vector-clock.util';
import { SyncOperation } from './entities/SyncEvent';

// Initialize or get vector clock
let vectorClock = createVectorClock(device.id);

// Record create event
vectorClock = incrementVectorClock(vectorClock, device.id);
await syncService.recordSyncEvent(
  device.id,
  'Message',                    // entityType
  'msg-001',                    // entityId
  SyncOperation.CREATE,         // operation
  {                             // payload
    content: 'Hello World',
    threadId: 'thread-001'
  },
  vectorClock
);
```

### 3. Sync Between Devices

```typescript
// Get pending events
const syncData = await syncService.initiateSyncForDevice(device.id);
console.log('Pending events:', syncData.pendingEvents.length);

// Process events...

// Mark sync complete
await syncService.completeSyncForDevice(device.id, new Date());
```

### 4. Handle Conflicts

```typescript
// Get unresolved conflicts
const conflicts = await syncService.getUnresolvedConflicts('user-123');

// Resolve conflict
if (conflicts.length > 0) {
  await syncService.resolveConflict(
    conflicts[0].id,
    ConflictResolutionStrategy.LAST_WRITE_WINS
  );
}
```

## API Reference

### Device Management

#### `registerDevice(userId, deviceName, deviceType, platform)`
Register a new device for synchronization.

**Parameters:**
- `userId: string` - User ID
- `deviceName: string` - Human-readable device name
- `deviceType: DeviceType` - DESKTOP | MOBILE | WEB
- `platform: string` - Platform info (e.g., "macOS 13.0")

**Returns:** `Promise<Device>`

#### `getDevice(deviceId)`
Get device information.

**Parameters:**
- `deviceId: string` - Device ID

**Returns:** `Promise<Device | null>`

#### `getUserDevices(userId, activeOnly?)`
Get all devices for a user.

**Parameters:**
- `userId: string` - User ID
- `activeOnly?: boolean` - Filter for active devices only (default: true)

**Returns:** `Promise<Device[]>`

#### `deactivateDevice(deviceId)`
Deactivate a device.

**Parameters:**
- `deviceId: string` - Device ID

**Returns:** `Promise<void>`

#### `updateDeviceLastSync(deviceId)`
Update device's last sync timestamp.

**Parameters:**
- `deviceId: string` - Device ID

**Returns:** `Promise<void>`

### Sync Event Management

#### `recordSyncEvent(deviceId, entityType, entityId, operation, payload, vectorClock)`
Record a synchronization event.

**Parameters:**
- `deviceId: string` - Source device ID
- `entityType: string` - Entity type (Message, Thread, etc.)
- `entityId: string` - Entity ID
- `operation: SyncOperation` - CREATE | UPDATE | DELETE
- `payload: Record<string, any>` - Event payload
- `vectorClock: VectorClock` - Current vector clock

**Returns:** `Promise<SyncEvent>`

#### `getSyncEventsSince(deviceId, timestamp)`
Get sync events since a specific timestamp.

**Parameters:**
- `deviceId: string` - Device ID
- `timestamp: Date` - Start timestamp

**Returns:** `Promise<SyncEvent[]>`

#### `getSyncEventsForEntity(entityType, entityId)`
Get all sync events for a specific entity.

**Parameters:**
- `entityType: string` - Entity type
- `entityId: string` - Entity ID

**Returns:** `Promise<SyncEvent[]>`

#### `markEventsSynced(eventIds)`
Mark sync events as processed.

**Parameters:**
- `eventIds: string[]` - Array of event IDs

**Returns:** `Promise<void>`

### Conflict Detection & Resolution

#### `detectConflicts(events)`
Detect conflicts among sync events.

**Parameters:**
- `events: SyncEvent[]` - Events to check

**Returns:** `Promise<Conflict[]>`

#### `resolveConflict(conflictId, strategy, resolution?)`
Resolve a conflict using specified strategy.

**Parameters:**
- `conflictId: string` - Conflict ID
- `strategy: ConflictResolutionStrategy` - Resolution strategy
- `resolution?: any` - Manual resolution data (for MANUAL strategy)

**Returns:** `Promise<void>`

**Strategies:**
- `LAST_WRITE_WINS`: Use timestamp to determine winner
- `MANUAL`: Use provided resolution
- `MERGE`: Automatic three-way merge

#### `getUnresolvedConflicts(userId)`
Get conflicts needing resolution.

**Parameters:**
- `userId: string` - User ID

**Returns:** `Promise<Conflict[]>`

#### `compareVectorClocks(clock1, clock2)`
Compare two vector clocks.

**Parameters:**
- `clock1: VectorClock` - First clock
- `clock2: VectorClock` - Second clock

**Returns:** `ClockComparison` - BEFORE | AFTER | CONCURRENT | EQUAL

### Delta Application

#### `applyDelta(entityType, entityId, delta)`
Apply a delta to an entity.

**Parameters:**
- `entityType: string` - Entity type
- `entityId: string` - Entity ID
- `delta: Delta | DeltaChange[]` - Delta to apply

**Returns:** `Promise<any>` - Updated entity

#### `createDelta(before, after)`
Create a delta from before/after states.

**Parameters:**
- `before: any` - Previous state
- `after: any` - New state

**Returns:** `DeltaChange[]`

#### `mergeDelta(base, delta1, delta2)`
Merge two deltas (three-way merge).

**Parameters:**
- `base: any` - Base state
- `delta1: Delta` - First delta
- `delta2: Delta` - Second delta

**Returns:** `{ result: any, conflicts: Array<...> }`

### Sync Coordination

#### `initiateSyncForDevice(deviceId)`
Start sync for a device.

**Parameters:**
- `deviceId: string` - Device ID

**Returns:** `Promise<{ pendingEvents: SyncEvent[], vectorClock: VectorClock }>`

#### `completeSyncForDevice(deviceId, syncedUpTo)`
Mark sync complete.

**Parameters:**
- `deviceId: string` - Device ID
- `syncedUpTo: Date` - Sync timestamp

**Returns:** `Promise<void>`

#### `getSyncStatus(deviceId)`
Get sync health status.

**Parameters:**
- `deviceId: string` - Device ID

**Returns:** `Promise<SyncStatus>`

### Batch Operations

#### `batchSyncEvents(events)`
Batch process sync events.

**Parameters:**
- `events: SyncEventData[]` - Array of sync events

**Returns:** `Promise<SyncEvent[]>`

#### `getSyncStatistics(userId)`
Get sync statistics for monitoring.

**Parameters:**
- `userId: string` - User ID

**Returns:** `Promise<SyncStatistics>`

## Conflict Resolution

### Understanding Conflicts

Conflicts occur when two devices modify the same entity concurrently (vector clocks are concurrent).

```typescript
// Device 1 and Device 2 both offline, editing same document
Device 1: {d1:5, d2:3} → UPDATE doc-001
Device 2: {d1:3, d2:5} → UPDATE doc-001

// Clocks are concurrent → CONFLICT!
```

### Resolution Strategies

#### 1. LAST_WRITE_WINS (Automatic)

Best for: Simple use cases where latest change should win.

```typescript
await syncService.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.LAST_WRITE_WINS
);
```

#### 2. MANUAL (User-Driven)

Best for: Critical data requiring user decision.

```typescript
const mergedData = {
  title: 'User-chosen title',
  content: 'Manually merged content'
};

await syncService.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.MANUAL,
  mergedData
);
```

#### 3. MERGE (Automatic 3-way)

Best for: Non-overlapping changes.

```typescript
await syncService.resolveConflict(
  conflictId,
  ConflictResolutionStrategy.MERGE
);
```

## Best Practices

### 1. Always Increment Vector Clocks

```typescript
// ❌ Wrong - reusing same clock
const clock = createVectorClock(deviceId);
await recordEvent(deviceId, 'Message', 'msg-1', CREATE, data, clock);
await recordEvent(deviceId, 'Message', 'msg-2', CREATE, data, clock);

// ✅ Correct - increment for each event
let clock = createVectorClock(deviceId);
clock = incrementVectorClock(clock, deviceId);
await recordEvent(deviceId, 'Message', 'msg-1', CREATE, data, clock);
clock = incrementVectorClock(clock, deviceId);
await recordEvent(deviceId, 'Message', 'msg-2', CREATE, data, clock);
```

### 2. Use Batch Operations for Bulk Sync

```typescript
// ❌ Slow - individual saves
for (const event of events) {
  await syncService.recordSyncEvent(...);
}

// ✅ Fast - batch processing
await syncService.batchSyncEvents(events);
```

### 3. Handle Network Failures Gracefully

```typescript
try {
  await syncService.initiateSyncForDevice(deviceId);
} catch (error) {
  // Queue for retry
  offlineQueue.push({ deviceId, timestamp: new Date() });
  // Show offline indicator to user
}
```

### 4. Monitor Sync Health

```typescript
// Regular health checks
setInterval(async () => {
  const status = await syncService.getSyncStatus(deviceId);
  if (!status.isHealthy) {
    console.warn('Sync unhealthy:', status);
    // Alert user or trigger recovery
  }
}, 60000); // Every minute
```

### 5. Clean Up Old Events

```typescript
// Periodically clean up old resolved events
// (Built-in method available but optional)
// Consider retention policies based on:
// - Event age
// - Conflict resolution status
// - Storage constraints
```

## Performance

### Benchmarks

- **Single sync event**: ~5-10ms
- **Batch sync (100 events)**: ~100-200ms (1-2ms per event)
- **Conflict detection (1000 events)**: ~50-100ms
- **Delta computation (10KB document)**: ~5-10ms

### Optimization Tips

1. **Use delta sync for large entities**
   ```typescript
   const delta = createDelta(oldState, newState);
   await recordSyncEvent(deviceId, type, id, UPDATE, delta, clock);
   ```

2. **Batch events when possible**
   ```typescript
   await batchSyncEvents(events); // Much faster than individual saves
   ```

3. **Index frequently queried fields**
   - Already indexed: `deviceId`, `entityType`, `entityId`, `syncedAt`
   - Add custom indexes for your use case

4. **Enable compression for large payloads**
   ```typescript
   // Compress payload before storing
   const compressed = compress(JSON.stringify(largePayload));
   ```

## Troubleshooting

### Issue: "Device not found"

**Cause:** Device not registered or ID incorrect.

**Solution:**
```typescript
const device = await syncService.getDevice(deviceId);
if (!device) {
  // Re-register device
  await syncService.registerDevice(userId, name, type, platform);
}
```

### Issue: "Invalid vector clock format"

**Cause:** Malformed vector clock object.

**Solution:**
```typescript
import { isValidVectorClock } from './utils/vector-clock.util';

if (!isValidVectorClock(clock)) {
  // Recreate clock
  clock = createVectorClock(deviceId);
}
```

### Issue: "Conflicts not resolving automatically"

**Cause:** Changes overlap in ways MERGE can't handle.

**Solution:**
```typescript
// Fall back to manual resolution
const conflicts = await getUnresolvedConflicts(userId);
for (const conflict of conflicts) {
  const mergedData = await promptUserForResolution(conflict);
  await resolveConflict(conflict.id, MANUAL, mergedData);
}
```

### Issue: "Sync performance degrading"

**Cause:** Too many old events, large payloads.

**Solution:**
1. Clean up old resolved events
2. Use delta sync for large entities
3. Implement pagination for event queries
4. Consider archiving old data

## Examples

See `sync.service.example.ts` for comprehensive usage examples:

- Device registration
- Simple sync flow
- Multi-device synchronization
- Conflict detection and resolution
- Delta synchronization
- Batch operations
- Health monitoring
- Offline-first patterns
- Vector clock operations

## Testing

Run the test suite:

```bash
npm test -- sync.service.test.ts
```

Tests cover:
- Device management
- Sync event recording
- Conflict detection
- Conflict resolution
- Delta operations
- Batch processing
- Vector clock operations

## License

Part of the Unified AI Hub - MIT License

## Support

For issues or questions:
1. Check this README
2. Review examples in `sync.service.example.ts`
3. Check test cases in `sync.service.test.ts`
4. File an issue in the project repository
