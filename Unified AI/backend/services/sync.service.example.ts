/**
 * Usage Examples for Sync Service
 * Demonstrates common synchronization patterns
 */

import { syncService } from './sync.service';
import { DeviceType } from '../entities/Device';
import { SyncOperation, ConflictResolutionStrategy } from '../entities/SyncEvent';
import { createVectorClock, incrementVectorClock } from '../utils/vector-clock.util';

// ========================================
// Example 1: Basic Device Registration
// ========================================

async function example1_RegisterDevice() {
  console.log('Example 1: Register a new device');

  const userId = 'user-123';

  // Register desktop device
  const desktopDevice = await syncService.registerDevice(
    userId,
    'MacBook Pro',
    DeviceType.DESKTOP,
    'macOS 13.0'
  );

  console.log('Desktop device registered:', desktopDevice.id);

  // Register mobile device
  const mobileDevice = await syncService.registerDevice(
    userId,
    'iPhone 14',
    DeviceType.MOBILE,
    'iOS 16.0'
  );

  console.log('Mobile device registered:', mobileDevice.id);

  return { desktopDevice, mobileDevice };
}

// ========================================
// Example 2: Simple Sync Flow
// ========================================

async function example2_SimpleSyncFlow() {
  console.log('Example 2: Simple sync flow');

  const userId = 'user-123';

  // Register device
  const device = await syncService.registerDevice(
    userId,
    'Desktop',
    DeviceType.DESKTOP,
    'Windows 11'
  );

  // Create initial vector clock
  let vectorClock = createVectorClock(device.id);

  // User creates a message
  vectorClock = incrementVectorClock(vectorClock, device.id);
  await syncService.recordSyncEvent(
    device.id,
    'Message',
    'msg-001',
    SyncOperation.CREATE,
    {
      content: 'Hello from Desktop',
      threadId: 'thread-001',
      timestamp: new Date().toISOString()
    },
    vectorClock
  );

  // User updates the message
  vectorClock = incrementVectorClock(vectorClock, device.id);
  await syncService.recordSyncEvent(
    device.id,
    'Message',
    'msg-001',
    SyncOperation.UPDATE,
    {
      content: 'Hello from Desktop (edited)',
      threadId: 'thread-001',
      timestamp: new Date().toISOString(),
      edited: true
    },
    vectorClock
  );

  // Get all events for this message
  const events = await syncService.getSyncEventsForEntity('Message', 'msg-001');
  console.log(`Found ${events.length} events for message`);

  // Update last sync time
  await syncService.updateDeviceLastSync(device.id);
}

// ========================================
// Example 3: Multi-Device Synchronization
// ========================================

async function example3_MultiDeviceSync() {
  console.log('Example 3: Multi-device synchronization');

  const userId = 'user-456';

  // Register two devices
  const device1 = await syncService.registerDevice(
    userId,
    'Laptop',
    DeviceType.DESKTOP,
    'Ubuntu 22.04'
  );

  const device2 = await syncService.registerDevice(
    userId,
    'Phone',
    DeviceType.MOBILE,
    'Android 13'
  );

  // Device 1 creates a document
  let clock1 = createVectorClock(device1.id);
  clock1 = incrementVectorClock(clock1, device1.id);

  await syncService.recordSyncEvent(
    device1.id,
    'Document',
    'doc-001',
    SyncOperation.CREATE,
    {
      title: 'My Document',
      content: 'Initial content',
      author: userId
    },
    clock1
  );

  console.log('Document created on device 1');

  // Simulate sync to device 2
  const syncData = await syncService.initiateSyncForDevice(device2.id);
  console.log(`Device 2 has ${syncData.pendingEvents.length} pending events`);

  // Device 2 processes the sync
  const recentEvents = await syncService.getSyncEventsSince(
    device2.id,
    new Date(Date.now() - 3600000) // Last hour
  );

  console.log(`Device 2 received ${recentEvents.length} events`);

  // Device 2 updates the document
  let clock2 = createVectorClock(device2.id);
  clock2 = incrementVectorClock(clock2, device2.id);

  await syncService.recordSyncEvent(
    device2.id,
    'Document',
    'doc-001',
    SyncOperation.UPDATE,
    {
      title: 'My Document',
      content: 'Updated from phone',
      author: userId
    },
    clock2
  );

  // Complete sync
  await syncService.completeSyncForDevice(device2.id, new Date());

  // Check sync status
  const status = await syncService.getSyncStatus(device2.id);
  console.log('Sync status:', {
    healthy: status.isHealthy,
    pendingEvents: status.pendingEvents,
    conflicts: status.unresolvedConflicts
  });
}

// ========================================
// Example 4: Conflict Detection
// ========================================

async function example4_ConflictDetection() {
  console.log('Example 4: Conflict detection');

  const userId = 'user-789';

  // Register two devices
  const laptop = await syncService.registerDevice(
    userId,
    'Laptop',
    DeviceType.DESKTOP,
    'macOS'
  );

  const tablet = await syncService.registerDevice(
    userId,
    'Tablet',
    DeviceType.MOBILE,
    'iPadOS'
  );

  const documentId = 'doc-conflict-001';

  // Both devices update the same document concurrently (offline)
  // Device 1: Laptop
  const laptopClock = createVectorClock(laptop.id);
  const laptopEvent = await syncService.recordSyncEvent(
    laptop.id,
    'Document',
    documentId,
    SyncOperation.UPDATE,
    {
      title: 'Proposal',
      content: 'Version from laptop with detailed analysis',
      lastModified: new Date().toISOString()
    },
    incrementVectorClock(laptopClock, laptop.id)
  );

  // Device 2: Tablet (concurrent, different vector clock)
  const tabletClock = createVectorClock(tablet.id);
  const tabletEvent = await syncService.recordSyncEvent(
    tablet.id,
    'Document',
    documentId,
    SyncOperation.UPDATE,
    {
      title: 'Proposal',
      content: 'Version from tablet with quick edits',
      lastModified: new Date().toISOString()
    },
    incrementVectorClock(tabletClock, tablet.id)
  );

  // Detect conflicts
  const conflicts = await syncService.detectConflicts([laptopEvent, tabletEvent]);

  if (conflicts.length > 0) {
    console.log(`Detected ${conflicts.length} conflict(s)`);
    console.log('Conflict details:', conflicts[0]);
  }

  return conflicts;
}

// ========================================
// Example 5: Conflict Resolution
// ========================================

async function example5_ConflictResolution() {
  console.log('Example 5: Conflict resolution');

  // First create a conflict (using example 4)
  const conflicts = await example4_ConflictDetection();

  if (conflicts.length === 0) {
    console.log('No conflicts to resolve');
    return;
  }

  const conflict = conflicts[0];

  // Strategy 1: Last Write Wins
  console.log('Resolving with LAST_WRITE_WINS strategy...');
  await syncService.resolveConflict(
    conflict.id,
    ConflictResolutionStrategy.LAST_WRITE_WINS
  );

  console.log('Conflict resolved!');

  // For another conflict, use manual resolution
  // const manualResolution = {
  //   title: 'Proposal',
  //   content: 'Manually merged content combining both versions',
  //   lastModified: new Date().toISOString(),
  //   mergedBy: 'user-789'
  // };
  //
  // await syncService.resolveConflict(
  //   conflict.id,
  //   ConflictResolutionStrategy.MANUAL,
  //   manualResolution
  // );
}

// ========================================
// Example 6: Delta Synchronization
// ========================================

async function example6_DeltaSync() {
  console.log('Example 6: Delta synchronization');

  const userId = 'user-101';
  const device = await syncService.registerDevice(
    userId,
    'Workstation',
    DeviceType.DESKTOP,
    'Linux'
  );

  // Original state
  const originalDocument = {
    title: 'Research Paper',
    abstract: 'This paper explores...',
    sections: [
      { id: 1, title: 'Introduction', content: 'The introduction...' },
      { id: 2, title: 'Methodology', content: 'Our approach...' }
    ],
    references: ['ref1', 'ref2']
  };

  // Updated state
  const updatedDocument = {
    title: 'Research Paper (Draft)',
    abstract: 'This paper explores advanced techniques...',
    sections: [
      { id: 1, title: 'Introduction', content: 'The introduction...' },
      { id: 2, title: 'Methodology', content: 'Our improved approach...' },
      { id: 3, title: 'Results', content: 'We found that...' }
    ],
    references: ['ref1', 'ref2', 'ref3']
  };

  // Create delta
  const delta = syncService.createDelta(originalDocument, updatedDocument);
  console.log(`Created delta with ${delta.length} changes`);

  // Apply delta
  const result = await syncService.applyDelta('Document', 'doc-002', delta);
  console.log('Delta applied successfully');

  // Record as sync event
  const vectorClock = incrementVectorClock(createVectorClock(device.id), device.id);
  await syncService.recordSyncEvent(
    device.id,
    'Document',
    'doc-002',
    SyncOperation.UPDATE,
    result,
    vectorClock
  );
}

// ========================================
// Example 7: Batch Synchronization
// ========================================

async function example7_BatchSync() {
  console.log('Example 7: Batch synchronization');

  const userId = 'user-202';
  const device = await syncService.registerDevice(
    userId,
    'Server',
    DeviceType.DESKTOP,
    'Cloud VM'
  );

  // Prepare multiple sync events
  const events = [];
  let vectorClock = createVectorClock(device.id);

  // Batch of messages
  for (let i = 0; i < 100; i++) {
    vectorClock = incrementVectorClock(vectorClock, device.id);

    events.push({
      deviceId: device.id,
      entityType: 'Message',
      entityId: `msg-batch-${i}`,
      operation: SyncOperation.CREATE,
      payload: {
        content: `Batch message ${i}`,
        threadId: 'thread-batch-001',
        timestamp: new Date().toISOString()
      },
      vectorClock: { ...vectorClock }
    });
  }

  console.log(`Syncing ${events.length} events in batch...`);

  const startTime = Date.now();
  const savedEvents = await syncService.batchSyncEvents(events);
  const duration = Date.now() - startTime;

  console.log(`Batch sync completed in ${duration}ms`);
  console.log(`Average: ${(duration / events.length).toFixed(2)}ms per event`);

  return savedEvents;
}

// ========================================
// Example 8: Sync Health Monitoring
// ========================================

async function example8_HealthMonitoring() {
  console.log('Example 8: Sync health monitoring');

  const userId = 'user-303';

  // Register multiple devices
  const devices = await Promise.all([
    syncService.registerDevice(userId, 'Primary Laptop', DeviceType.DESKTOP, 'macOS'),
    syncService.registerDevice(userId, 'Work Desktop', DeviceType.DESKTOP, 'Windows'),
    syncService.registerDevice(userId, 'Mobile Phone', DeviceType.MOBILE, 'Android')
  ]);

  console.log(`Monitoring ${devices.length} devices...`);

  // Check health of each device
  for (const device of devices) {
    const status = await syncService.getSyncStatus(device.id);

    console.log(`\nDevice: ${device.deviceName}`);
    console.log(`- Healthy: ${status.isHealthy}`);
    console.log(`- Last sync: ${status.lastSyncAt?.toISOString() || 'Never'}`);
    console.log(`- Pending events: ${status.pendingEvents}`);
    console.log(`- Unresolved conflicts: ${status.unresolvedConflicts}`);
  }

  // Get overall statistics
  const stats = await syncService.getSyncStatistics(userId);
  console.log('\nOverall Statistics:');
  console.log(`- Total devices: ${stats.totalDevices}`);
  console.log(`- Active devices: ${stats.activeDevices}`);
  console.log(`- Total events: ${stats.totalEvents}`);
  console.log(`- Unresolved conflicts: ${stats.unresolvedConflicts}`);

  return stats;
}

// ========================================
// Example 9: Offline-First Sync Pattern
// ========================================

async function example9_OfflineFirstSync() {
  console.log('Example 9: Offline-first sync pattern');

  const userId = 'user-404';
  const device = await syncService.registerDevice(
    userId,
    'Offline Device',
    DeviceType.MOBILE,
    'iOS'
  );

  // Simulate offline operations
  const offlineQueue = [];
  let vectorClock = createVectorClock(device.id);

  // User makes changes while offline
  for (let i = 0; i < 5; i++) {
    vectorClock = incrementVectorClock(vectorClock, device.id);

    offlineQueue.push({
      deviceId: device.id,
      entityType: 'Message',
      entityId: `offline-msg-${i}`,
      operation: SyncOperation.CREATE,
      payload: {
        content: `Offline message ${i}`,
        createdAt: new Date().toISOString(),
        offline: true
      },
      vectorClock: { ...vectorClock }
    });
  }

  console.log(`Queued ${offlineQueue.length} offline operations`);

  // Simulate coming back online and syncing
  console.log('Device back online, syncing...');

  const savedEvents = await syncService.batchSyncEvents(offlineQueue);
  console.log(`Synced ${savedEvents.length} offline events`);

  // Update device sync status
  await syncService.completeSyncForDevice(device.id, new Date());

  const status = await syncService.getSyncStatus(device.id);
  console.log('Sync status after offline sync:', status);
}

// ========================================
// Example 10: Vector Clock Comparison
// ========================================

async function example10_VectorClockComparison() {
  console.log('Example 10: Vector clock comparison');

  // Different clock scenarios
  const clock1 = { 'device-1': 5, 'device-2': 3 };
  const clock2 = { 'device-1': 5, 'device-2': 4 };
  const clock3 = { 'device-1': 4, 'device-2': 5 };

  console.log('Clock 1:', clock1);
  console.log('Clock 2:', clock2);
  console.log('Clock 3:', clock3);

  // Compare clocks
  const comparison1vs2 = syncService.compareVectorClocks(clock1, clock2);
  const comparison1vs3 = syncService.compareVectorClocks(clock1, clock3);
  const comparison2vs3 = syncService.compareVectorClocks(clock2, clock3);

  console.log('\nComparisons:');
  console.log(`Clock1 vs Clock2: ${comparison1vs2}`); // BEFORE
  console.log(`Clock1 vs Clock3: ${comparison1vs3}`); // CONCURRENT
  console.log(`Clock2 vs Clock3: ${comparison2vs3}`); // CONCURRENT

  // This helps determine:
  // - BEFORE: clock1 happened before clock2 (causally ordered)
  // - AFTER: clock1 happened after clock2 (causally ordered)
  // - CONCURRENT: clocks are concurrent (potential conflict)
  // - EQUAL: clocks are identical
}

// ========================================
// Run all examples
// ========================================

async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('SYNC SERVICE EXAMPLES');
  console.log('='.repeat(60));

  try {
    // await example1_RegisterDevice();
    // await example2_SimpleSyncFlow();
    // await example3_MultiDeviceSync();
    // await example4_ConflictDetection();
    // await example5_ConflictResolution();
    // await example6_DeltaSync();
    // await example7_BatchSync();
    // await example8_HealthMonitoring();
    // await example9_OfflineFirstSync();
    await example10_VectorClockComparison();

    console.log('\n' + '='.repeat(60));
    console.log('All examples completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use
export {
  example1_RegisterDevice,
  example2_SimpleSyncFlow,
  example3_MultiDeviceSync,
  example4_ConflictDetection,
  example5_ConflictResolution,
  example6_DeltaSync,
  example7_BatchSync,
  example8_HealthMonitoring,
  example9_OfflineFirstSync,
  example10_VectorClockComparison,
  runAllExamples
};

// Uncomment to run examples
// runAllExamples();
