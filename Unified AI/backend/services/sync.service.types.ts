/**
 * Type definitions for Sync Service
 */

import { VectorClock } from '../utils/vector-clock.util';
import { Delta, DeltaChange } from '../utils/delta.util';
import { SyncOperation, ConflictResolutionStrategy } from '../entities/SyncEvent';
import { DeviceType } from '../entities/Device';

/**
 * Entity types that can be synchronized
 */
export enum SyncEntityType {
  MESSAGE = 'Message',
  THREAD = 'Thread',
  WORKSPACE = 'Workspace',
  PROJECT = 'Project',
  DOCUMENT = 'Document',
  USER_SETTINGS = 'UserSettings',
  AI_INTERACTION = 'AIInteraction',
  ORGANIZATION = 'Organization',
  DEVICE = 'Device'
}

/**
 * Sync event priority levels
 */
export enum SyncPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Sync conflict types
 */
export enum ConflictType {
  CONCURRENT_UPDATE = 'CONCURRENT_UPDATE',
  DELETE_UPDATE = 'DELETE_UPDATE',
  CREATE_CREATE = 'CREATE_CREATE',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH'
}

/**
 * Request to register a new device
 */
export interface RegisterDeviceRequest {
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  platform: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

/**
 * Response after device registration
 */
export interface RegisterDeviceResponse {
  deviceId: string;
  vectorClock: VectorClock;
  registeredAt: Date;
  syncEndpoint?: string;
}

/**
 * Sync session information
 */
export interface SyncSession {
  sessionId: string;
  deviceId: string;
  startedAt: Date;
  vectorClock: VectorClock;
  pendingEvents: number;
  estimatedDuration?: number;
}

/**
 * Sync request from device
 */
export interface SyncRequest {
  deviceId: string;
  lastSyncedAt?: Date;
  lastVectorClock?: VectorClock;
  includeDeltas?: boolean;
  maxEvents?: number;
  entityTypes?: SyncEntityType[];
}

/**
 * Sync response to device
 */
export interface SyncResponse {
  events: SyncEventDTO[];
  vectorClock: VectorClock;
  hasMore: boolean;
  conflicts?: ConflictDTO[];
  nextSyncRecommendedAt?: Date;
}

/**
 * Sync event data transfer object
 */
export interface SyncEventDTO {
  id: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload?: Record<string, any>;
  delta?: DeltaChange[];
  vectorClock: VectorClock;
  syncedAt: Date;
  metadata?: SyncEventMetadata;
}

/**
 * Metadata for sync events
 */
export interface SyncEventMetadata {
  userId?: string;
  priority?: SyncPriority;
  compressed?: boolean;
  encrypted?: boolean;
  checksum?: string;
  size?: number;
  tags?: string[];
}

/**
 * Conflict data transfer object
 */
export interface ConflictDTO {
  conflictId: string;
  conflictType: ConflictType;
  entityType: SyncEntityType;
  entityId: string;
  events: SyncEventDTO[];
  detectedAt: Date;
  suggestedResolution?: ConflictResolutionStrategy;
  requiresManualResolution: boolean;
}

/**
 * Conflict resolution request
 */
export interface ResolveConflictRequest {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolution?: any;
  resolvedBy: string;
  comments?: string;
}

/**
 * Sync health metrics
 */
export interface SyncHealthMetrics {
  deviceId: string;
  isOnline: boolean;
  isHealthy: boolean;
  lastSyncAt?: Date;
  syncLag?: number; // milliseconds
  pendingEvents: number;
  unresolvedConflicts: number;
  averageSyncDuration?: number;
  syncSuccessRate?: number;
  lastError?: string;
}

/**
 * Sync statistics for monitoring
 */
export interface SyncStatistics {
  userId?: string;
  deviceId?: string;
  period: {
    start: Date;
    end: Date;
  };
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalEvents: number;
  eventsPerType: Record<SyncEntityType, number>;
  conflictsDetected: number;
  conflictsResolved: number;
  averageSyncDuration: number;
  dataTransferred: number; // bytes
}

/**
 * Batch sync request
 */
export interface BatchSyncRequest {
  deviceId: string;
  events: Omit<SyncEventDTO, 'id' | 'syncedAt'>[];
  vectorClock: VectorClock;
  compressed?: boolean;
}

/**
 * Batch sync response
 */
export interface BatchSyncResponse {
  savedEventIds: string[];
  conflicts: ConflictDTO[];
  vectorClock: VectorClock;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

/**
 * Delta sync request (more efficient)
 */
export interface DeltaSyncRequest {
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  delta: Delta;
  baseVectorClock: VectorClock;
}

/**
 * Delta sync response
 */
export interface DeltaSyncResponse {
  success: boolean;
  eventId?: string;
  vectorClock: VectorClock;
  conflict?: ConflictDTO;
  mergedState?: any;
}

/**
 * Sync configuration
 */
export interface SyncConfiguration {
  deviceId: string;
  syncInterval?: number; // milliseconds
  batchSize?: number;
  autoResolveConflicts?: boolean;
  defaultResolutionStrategy?: ConflictResolutionStrategy;
  enableDeltaSync?: boolean;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  maxRetries?: number;
  retryBackoff?: number;
  offlineQueueSize?: number;
}

/**
 * Offline queue item
 */
export interface OfflineQueueItem {
  id: string;
  deviceId: string;
  event: Omit<SyncEventDTO, 'id' | 'syncedAt'>;
  queuedAt: Date;
  retryCount: number;
  priority: SyncPriority;
}

/**
 * Sync callback hooks
 */
export interface SyncHooks {
  onSyncStart?: (session: SyncSession) => void | Promise<void>;
  onSyncComplete?: (session: SyncSession, success: boolean) => void | Promise<void>;
  onSyncError?: (session: SyncSession, error: Error) => void | Promise<void>;
  onConflictDetected?: (conflict: ConflictDTO) => void | Promise<void>;
  onConflictResolved?: (conflictId: string, resolution: any) => void | Promise<void>;
  onEventReceived?: (event: SyncEventDTO) => void | Promise<void>;
  onEventSent?: (event: SyncEventDTO) => void | Promise<void>;
}

/**
 * Network status
 */
export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'other';
  effectiveType?: '2g' | '3g' | '4g' | '5g';
  downlink?: number; // Mbps
  rtt?: number; // milliseconds
}

/**
 * Sync options
 */
export interface SyncOptions {
  force?: boolean;
  priority?: SyncPriority;
  timeout?: number;
  includeDeleted?: boolean;
  entityTypes?: SyncEntityType[];
  sinceTimestamp?: Date;
  sinceVectorClock?: VectorClock;
  maxEvents?: number;
  resolveConcurrency?: boolean;
}

/**
 * Merge strategy options
 */
export interface MergeStrategyOptions {
  strategy: ConflictResolutionStrategy;
  customMerger?: (local: any, remote: any, base?: any) => any;
  fieldPriorities?: Record<string, 'local' | 'remote' | 'merge'>;
  preserveFields?: string[];
}

/**
 * Sync error codes
 */
export enum SyncErrorCode {
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_INACTIVE = 'DEVICE_INACTIVE',
  INVALID_VECTOR_CLOCK = 'INVALID_VECTOR_CLOCK',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * Custom sync error
 */
export class SyncError extends Error {
  constructor(
    public code: SyncErrorCode,
    message: string,
    public deviceId?: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'SyncError';
  }
}
