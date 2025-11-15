# Sync Service - Quick Start Guide

Get started with the Multi-Device Synchronization Service in 5 minutes.

## Installation

No installation needed - the service is ready to use!

## Imports

```typescript
// Everything you need from one place
import {
  syncService,
  DeviceType,
  SyncOperation,
  ConflictResolutionStrategy,
  createVectorClock,
  incrementVectorClock
} from './services/sync.service.index';
```

## 5-Minute Quick Start

### Step 1: Register a Device (30 seconds)

```typescript
const device = await syncService.registerDevice(
  'user-123',           // User ID
  'My Laptop',          // Device name
  DeviceType.DESKTOP,   // Type: DESKTOP | MOBILE | WEB
  'macOS 13.0'         // Platform info
);

console.log('Device ID:', device.id);
```

### Step 2: Create Your First Sync Event (1 minute)

```typescript
// Initialize vector clock
let vectorClock = createVectorClock(device.id);

// User creates a message
vectorClock = incrementVectorClock(vectorClock, device.id);

await syncService.recordSyncEvent(
  device.id,
  'Message',                    // Entity type
  'msg-001',                    // Entity ID
  SyncOperation.CREATE,         // Operation
  {                             // Payload
    content: 'Hello World',
    threadId: 'thread-001',
    timestamp: new Date()
  },
  vectorClock
);

console.log('Event recorded!');
```

### Step 3: Sync to Another Device (2 minutes)

```typescript
// Register second device
const mobileDevice = await syncService.registerDevice(
  'user-123',
  'My Phone',
  DeviceType.MOBILE,
  'iOS 16.0'
);

// Pull pending events
const { pendingEvents, vectorClock: currentClock } =
  await syncService.initiateSyncForDevice(mobileDevice.id);

console.log(`Found ${pendingEvents.length} events to sync`);

// Apply events to local state...
for (const event of pendingEvents) {
  console.log('Syncing:', event.entityType, event.operation);
  // Apply to your local database/state
}

// Mark sync complete
await syncService.completeSyncForDevice(mobileDevice.id, new Date());
```

### Step 4: Handle Conflicts (1.5 minutes)

```typescript
// Check for conflicts
const conflicts = await syncService.getUnresolvedConflicts('user-123');

if (conflicts.length > 0) {
  console.log(`Found ${conflicts.length} conflicts`);

  // Auto-resolve with last-write-wins
  for (const conflict of conflicts) {
    await syncService.resolveConflict(
      conflict.id,
      ConflictResolutionStrategy.LAST_WRITE_WINS
    );
  }

  console.log('Conflicts resolved!');
}
```

## Common Patterns

### Pattern 1: Update an Entity

```typescript
// Get current clock
let clock = await getCurrentClock(device.id);

// Update entity in database
message.content = 'Updated content';
await messageRepo.save(message);

// Record sync event
clock = incrementVectorClock(clock, device.id);
await syncService.recordSyncEvent(
  device.id,
  'Message',
  message.id,
  SyncOperation.UPDATE,
  { content: message.content },
  clock
);
```

### Pattern 2: Delete an Entity

```typescript
// Delete from database
await messageRepo.delete(message.id);

// Record sync event
clock = incrementVectorClock(clock, device.id);
await syncService.recordSyncEvent(
  device.id,
  'Message',
  message.id,
  SyncOperation.DELETE,
  { deletedAt: new Date() },
  clock
);
```

### Pattern 3: Batch Sync Multiple Events

```typescript
const events = [
  {
    deviceId: device.id,
    entityType: 'Message',
    entityId: 'msg-1',
    operation: SyncOperation.CREATE,
    payload: { content: 'Message 1' },
    vectorClock: clock1
  },
  {
    deviceId: device.id,
    entityType: 'Message',
    entityId: 'msg-2',
    operation: SyncOperation.CREATE,
    payload: { content: 'Message 2' },
    vectorClock: clock2
  }
];

const savedEvents = await syncService.batchSyncEvents(events);
console.log(`Synced ${savedEvents.length} events`);
```

### Pattern 4: Check Sync Health

```typescript
const status = await syncService.getSyncStatus(device.id);

if (!status.isHealthy) {
  console.warn('Sync unhealthy!');
  console.log('Pending events:', status.pendingEvents);
  console.log('Unresolved conflicts:', status.unresolvedConflicts);
}
```

### Pattern 5: Get Sync Statistics

```typescript
const stats = await syncService.getSyncStatistics('user-123');

console.log('Total devices:', stats.totalDevices);
console.log('Active devices:', stats.activeDevices);
console.log('Total events:', stats.totalEvents);
console.log('Conflicts:', stats.unresolvedConflicts);
```

## Helper Function: Get Current Clock

```typescript
async function getCurrentClock(deviceId: string) {
  const { vectorClock } = await syncService.initiateSyncForDevice(deviceId);
  return vectorClock;
}
```

## Complete Example

```typescript
import {
  syncService,
  DeviceType,
  SyncOperation,
  createVectorClock,
  incrementVectorClock
} from './services/sync.service.index';

async function completeExample() {
  // 1. Register device
  const device = await syncService.registerDevice(
    'user-123',
    'Laptop',
    DeviceType.DESKTOP,
    'macOS'
  );

  // 2. Initialize clock
  let clock = createVectorClock(device.id);

  // 3. Create message
  clock = incrementVectorClock(clock, device.id);
  await syncService.recordSyncEvent(
    device.id,
    'Message',
    'msg-1',
    SyncOperation.CREATE,
    { content: 'Hello' },
    clock
  );

  // 4. Update message
  clock = incrementVectorClock(clock, device.id);
  await syncService.recordSyncEvent(
    device.id,
    'Message',
    'msg-1',
    SyncOperation.UPDATE,
    { content: 'Hello World' },
    clock
  );

  // 5. Sync to mobile
  const mobile = await syncService.registerDevice(
    'user-123',
    'Phone',
    DeviceType.MOBILE,
    'iOS'
  );

  const { pendingEvents } = await syncService.initiateSyncForDevice(mobile.id);
  console.log('Synced', pendingEvents.length, 'events');

  // 6. Check health
  const status = await syncService.getSyncStatus(device.id);
  console.log('Healthy:', status.isHealthy);
}
```

## What's Next?

- **Full Documentation**: See `SYNC_SERVICE_README.md`
- **Integration Guide**: See `SYNC_INTEGRATION_GUIDE.md`
- **Examples**: See `sync.service.example.ts`
- **Tests**: See `tests/sync.service.test.ts`

## Common Issues

**"Device not found"**
```typescript
// Solution: Verify device ID or re-register
const device = await syncService.getDevice(deviceId);
if (!device) {
  await syncService.registerDevice(...);
}
```

**"Invalid vector clock"**
```typescript
// Solution: Create new clock
const clock = createVectorClock(deviceId);
```

**"Conflicts detected"**
```typescript
// Solution: Resolve conflicts
const conflicts = await syncService.getUnresolvedConflicts(userId);
for (const conflict of conflicts) {
  await syncService.resolveConflict(
    conflict.id,
    ConflictResolutionStrategy.LAST_WRITE_WINS
  );
}
```

## Key Concepts

**Vector Clock**: Tracks causality across devices
```typescript
{ 'device-1': 5, 'device-2': 3 } // Device 1 has 5 events, Device 2 has 3
```

**Conflict**: When two devices modify the same entity concurrently
```typescript
Device 1: {d1:5, d2:3} → Update message
Device 2: {d1:3, d2:5} → Update message (concurrent!)
// Result: CONFLICT
```

**Delta**: Efficient change representation
```typescript
// Instead of sending whole object, send only changes
{ op: 'replace', path: '/title', value: 'New Title' }
```

## Performance Tips

1. **Use batch operations** for multiple events
2. **Use delta sync** for large objects
3. **Run periodic cleanup** of old events
4. **Monitor sync health** regularly
5. **Resolve conflicts quickly** to prevent buildup

## Ready to Go!

You now have everything you need to implement multi-device sync. Start with the examples above, then refer to the full documentation for advanced features.

**Files you should read:**
1. This file (QUICK_START.md) - Done! ✓
2. SYNC_SERVICE_README.md - Complete API reference
3. SYNC_INTEGRATION_GUIDE.md - How to integrate
4. sync.service.example.ts - 10 working examples

**Happy syncing!** 🚀
