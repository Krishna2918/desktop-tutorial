# Sync Service Integration Guide

Quick guide to integrating the Sync Service into your Unified AI Hub application.

## Quick Integration

### 1. Import the Service

```typescript
// Simple import
import { syncService } from './services/sync.service';

// Or use the central index for everything
import {
  syncService,
  DeviceType,
  SyncOperation,
  ConflictResolutionStrategy,
  createVectorClock,
  incrementVectorClock
} from './services/sync.service.index';
```

### 2. Initialize on App Startup

```typescript
// app.ts or main.ts
import { AppDataSource } from './config/data-source';
import { syncService } from './services/sync.service';

async function initializeApp() {
  // Initialize database
  await AppDataSource.initialize();

  // Sync service is ready to use (no additional initialization needed)
  console.log('Sync service ready');
}
```

### 3. Integrate with User Authentication

```typescript
// auth.service.ts
import { syncService } from './services/sync.service';
import { DeviceType } from './entities/Device';

export class AuthService {
  async loginUser(email: string, password: string, deviceInfo: any) {
    // ... authenticate user ...

    // Register device for this session
    const device = await syncService.registerDevice(
      user.id,
      deviceInfo.name || 'Unknown Device',
      deviceInfo.type || DeviceType.WEB,
      deviceInfo.platform || navigator.userAgent
    );

    // Store device ID in session
    session.deviceId = device.id;

    return { user, device };
  }
}
```

### 4. Add Sync to Entity Operations

#### Message Creation

```typescript
// message.controller.ts
import { syncService } from './services/sync.service';
import { SyncOperation } from './entities/SyncEvent';
import { createVectorClock, incrementVectorClock } from './utils/vector-clock.util';

export class MessageController {
  async createMessage(userId: string, deviceId: string, content: string, threadId: string) {
    // Create message in database
    const message = await messageRepository.save({
      content,
      threadId,
      userId,
      createdAt: new Date()
    });

    // Get or create vector clock for this device
    let vectorClock = await this.getDeviceVectorClock(deviceId);
    vectorClock = incrementVectorClock(vectorClock, deviceId);

    // Record sync event
    await syncService.recordSyncEvent(
      deviceId,
      'Message',
      message.id,
      SyncOperation.CREATE,
      {
        content: message.content,
        threadId: message.threadId,
        createdAt: message.createdAt.toISOString()
      },
      vectorClock
    );

    return message;
  }

  async updateMessage(userId: string, deviceId: string, messageId: string, newContent: string) {
    // Update message in database
    const message = await messageRepository.findOne({ where: { id: messageId } });
    message.content = newContent;
    message.updatedAt = new Date();
    await messageRepository.save(message);

    // Record sync event
    let vectorClock = await this.getDeviceVectorClock(deviceId);
    vectorClock = incrementVectorClock(vectorClock, deviceId);

    await syncService.recordSyncEvent(
      deviceId,
      'Message',
      message.id,
      SyncOperation.UPDATE,
      {
        content: message.content,
        updatedAt: message.updatedAt.toISOString()
      },
      vectorClock
    );

    return message;
  }

  private async getDeviceVectorClock(deviceId: string) {
    // Get latest vector clock from sync events
    const syncData = await syncService.initiateSyncForDevice(deviceId);
    return syncData.vectorClock;
  }
}
```

### 5. Set Up Periodic Sync

```typescript
// sync.worker.ts
import { syncService } from './services/sync.service';

export class SyncWorker {
  private syncInterval: NodeJS.Timeout | null = null;

  start(deviceId: string, intervalMs: number = 30000) {
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync(deviceId);
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }, intervalMs);
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  private async performSync(deviceId: string) {
    // Initiate sync
    const { pendingEvents } = await syncService.initiateSyncForDevice(deviceId);

    // Process events (apply to local state)
    for (const event of pendingEvents) {
      await this.applyEvent(event);
    }

    // Mark sync complete
    await syncService.completeSyncForDevice(deviceId, new Date());

    // Check for conflicts
    const status = await syncService.getSyncStatus(deviceId);
    if (status.unresolvedConflicts > 0) {
      // Notify user
      this.notifyUserOfConflicts(deviceId);
    }
  }

  private async applyEvent(event: any) {
    // Apply event to local database/state
    // This is application-specific logic
  }

  private notifyUserOfConflicts(deviceId: string) {
    // Send notification to user about conflicts
  }
}
```

### 6. Handle Conflicts in UI

```typescript
// conflict.controller.ts
import { syncService } from './services/sync.service';
import { ConflictResolutionStrategy } from './entities/SyncEvent';

export class ConflictController {
  async getConflictsForUser(userId: string) {
    const conflicts = await syncService.getUnresolvedConflicts(userId);

    // Format for UI
    return conflicts.map(conflict => ({
      id: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      versions: conflict.events.map(e => ({
        deviceId: e.deviceId,
        payload: e.payload,
        timestamp: e.syncedAt
      }))
    }));
  }

  async resolveConflict(
    conflictId: string,
    strategy: 'auto' | 'manual',
    resolution?: any
  ) {
    if (strategy === 'auto') {
      // Use last write wins
      await syncService.resolveConflict(
        conflictId,
        ConflictResolutionStrategy.LAST_WRITE_WINS
      );
    } else {
      // Use user's manual resolution
      await syncService.resolveConflict(
        conflictId,
        ConflictResolutionStrategy.MANUAL,
        resolution
      );
    }
  }
}
```

### 7. Add REST API Endpoints

```typescript
// sync.routes.ts
import { Router } from 'express';
import { syncService } from './services/sync.service';

const router = Router();

// Register device
router.post('/devices', async (req, res) => {
  try {
    const { userId, deviceName, deviceType, platform } = req.body;
    const device = await syncService.registerDevice(userId, deviceName, deviceType, platform);
    res.json({ success: true, device });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get sync status
router.get('/devices/:deviceId/status', async (req, res) => {
  try {
    const status = await syncService.getSyncStatus(req.params.deviceId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Initiate sync
router.post('/devices/:deviceId/sync', async (req, res) => {
  try {
    const syncData = await syncService.initiateSyncForDevice(req.params.deviceId);
    res.json({ success: true, ...syncData });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Record sync event
router.post('/events', async (req, res) => {
  try {
    const { deviceId, entityType, entityId, operation, payload, vectorClock } = req.body;
    const event = await syncService.recordSyncEvent(
      deviceId,
      entityType,
      entityId,
      operation,
      payload,
      vectorClock
    );
    res.json({ success: true, event });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Batch sync events
router.post('/events/batch', async (req, res) => {
  try {
    const { events } = req.body;
    const savedEvents = await syncService.batchSyncEvents(events);
    res.json({ success: true, count: savedEvents.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get conflicts
router.get('/users/:userId/conflicts', async (req, res) => {
  try {
    const conflicts = await syncService.getUnresolvedConflicts(req.params.userId);
    res.json({ success: true, conflicts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Resolve conflict
router.post('/conflicts/:conflictId/resolve', async (req, res) => {
  try {
    const { strategy, resolution } = req.body;
    await syncService.resolveConflict(req.params.conflictId, strategy, resolution);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
```

### 8. WebSocket Real-time Sync (Optional)

```typescript
// sync.socket.ts
import { Server as SocketServer } from 'socket.io';
import { syncService } from './services/sync.service';

export class SyncSocket {
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Register device
      socket.on('register-device', async (data) => {
        try {
          const device = await syncService.registerDevice(
            data.userId,
            data.deviceName,
            data.deviceType,
            data.platform
          );
          socket.emit('device-registered', device);

          // Join user's room for broadcasts
          socket.join(`user-${data.userId}`);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Sync event from client
      socket.on('sync-event', async (data) => {
        try {
          const event = await syncService.recordSyncEvent(
            data.deviceId,
            data.entityType,
            data.entityId,
            data.operation,
            data.payload,
            data.vectorClock
          );

          // Broadcast to all user's devices except sender
          const device = await syncService.getDevice(data.deviceId);
          if (device) {
            socket.to(`user-${device.userId}`).emit('sync-event', event);
          }
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Request sync
      socket.on('request-sync', async (data) => {
        try {
          const syncData = await syncService.initiateSyncForDevice(data.deviceId);
          socket.emit('sync-data', syncData);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
    });
  }
}
```

## Frontend Integration (TypeScript/React Example)

```typescript
// useSyncService.ts
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSyncService(userId: string, deviceId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [syncStatus, setSyncStatus] = useState({
    isHealthy: true,
    pendingEvents: 0,
    conflicts: 0
  });

  useEffect(() => {
    // Connect to sync service
    const newSocket = io('http://localhost:3000');

    newSocket.on('connect', () => {
      console.log('Connected to sync service');
    });

    newSocket.on('sync-event', (event) => {
      // Handle incoming sync event
      applyEventToLocalState(event);
    });

    newSocket.on('device-registered', (device) => {
      console.log('Device registered:', device);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [userId]);

  const syncEvent = (entityType: string, entityId: string, operation: string, payload: any, vectorClock: any) => {
    if (socket) {
      socket.emit('sync-event', {
        deviceId,
        entityType,
        entityId,
        operation,
        payload,
        vectorClock
      });
    }
  };

  const requestSync = () => {
    if (socket) {
      socket.emit('request-sync', { deviceId });
    }
  };

  return { syncEvent, requestSync, syncStatus };
}

function applyEventToLocalState(event: any) {
  // Update local React state or Redux store
  console.log('Applying event:', event);
}
```

## Testing the Integration

```typescript
// integration.test.ts
import { syncService } from './services/sync.service';
import { DeviceType } from './entities/Device';

describe('Sync Integration', () => {
  it('should integrate with message creation', async () => {
    // Register device
    const device = await syncService.registerDevice(
      'test-user',
      'Test Device',
      DeviceType.DESKTOP,
      'Test Platform'
    );

    // Create message (your application logic)
    const message = { id: 'msg-1', content: 'Test' };

    // Record sync event
    const vectorClock = createVectorClock(device.id);
    await syncService.recordSyncEvent(
      device.id,
      'Message',
      message.id,
      SyncOperation.CREATE,
      message,
      incrementVectorClock(vectorClock, device.id)
    );

    // Verify
    const events = await syncService.getSyncEventsForEntity('Message', message.id);
    expect(events.length).toBe(1);
  });
});
```

## Monitoring & Observability

```typescript
// monitoring.ts
import { syncService } from './services/sync.service';

export async function monitorSyncHealth(userId: string) {
  const stats = await syncService.getSyncStatistics(userId);

  // Send to monitoring service (e.g., Prometheus, Datadog)
  metrics.gauge('sync.total_devices', stats.totalDevices);
  metrics.gauge('sync.active_devices', stats.activeDevices);
  metrics.gauge('sync.total_events', stats.totalEvents);
  metrics.gauge('sync.unresolved_conflicts', stats.unresolvedConflicts);

  return stats;
}
```

## Next Steps

1. Review the [main README](./SYNC_SERVICE_README.md) for detailed API documentation
2. Check [examples](./sync.service.example.ts) for usage patterns
3. Run [tests](../tests/sync.service.test.ts) to ensure everything works
4. Integrate into your authentication flow
5. Add sync events to your entity operations
6. Set up periodic sync and conflict resolution UI

## Support

For questions or issues, please refer to:
- Main documentation: `SYNC_SERVICE_README.md`
- Example code: `sync.service.example.ts`
- Test suite: `tests/sync.service.test.ts`
