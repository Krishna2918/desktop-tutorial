/**
 * Sync Service - Central Export
 *
 * Import everything you need for synchronization from this single file
 */

// Main service
export { SyncService, syncService } from './sync.service';

// Types and interfaces
export {
  // Enums
  SyncEntityType,
  SyncPriority,
  ConflictType,
  SyncErrorCode,

  // Interfaces
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  SyncSession,
  SyncRequest,
  SyncResponse,
  SyncEventDTO,
  SyncEventMetadata,
  ConflictDTO,
  ResolveConflictRequest,
  SyncHealthMetrics,
  SyncStatistics,
  BatchSyncRequest,
  BatchSyncResponse,
  DeltaSyncRequest,
  DeltaSyncResponse,
  SyncConfiguration,
  OfflineQueueItem,
  SyncHooks,
  NetworkStatus,
  SyncOptions,
  MergeStrategyOptions,

  // Error class
  SyncError,
} from './sync.service.types';

// Vector clock utilities
export {
  VectorClock,
  ClockComparison,
  createVectorClock,
  incrementVectorClock,
  mergeVectorClocks,
  compareVectorClocks,
  happenedBefore,
  areConcurrent,
  getDeviceTimestamp,
  dominates,
  mergeMultipleClocks,
  clockToString,
  stringToClock,
  isValidVectorClock,
} from '../utils/vector-clock.util';

// Delta utilities
export {
  DeltaOperation,
  DeltaChange,
  Delta,
  createDelta,
  applyDelta,
  mergeDelta,
  threeWayMerge,
  calculateChecksum,
  optimizeDelta,
} from '../utils/delta.util';

// Entity types from entities
export { Device, DeviceType } from '../entities/Device';
export {
  SyncEvent,
  SyncOperation,
  ConflictResolutionStrategy,
} from '../entities/SyncEvent';

// Re-export service instance for convenience
export default syncService;
