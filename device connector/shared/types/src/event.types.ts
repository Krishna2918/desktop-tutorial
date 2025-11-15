/**
 * Real-time event types
 */

export enum DeviceEvent {
  ONLINE = 'device.online',
  OFFLINE = 'device.offline',
  IDLE = 'device.idle',
  REGISTERED = 'device.registered',
  REMOVED = 'device.removed',
  UPDATED = 'device.updated',
}

export enum FileEvent {
  TRANSFER_INITIATED = 'file.transfer.initiated',
  TRANSFER_PROGRESS = 'file.transfer.progress',
  TRANSFER_COMPLETED = 'file.transfer.completed',
  TRANSFER_FAILED = 'file.transfer.failed',
  FILE_AVAILABLE = 'file.available',
  FILE_DELETED = 'file.deleted',
}

export enum RemoteControlEvent {
  REQUEST = 'remote.control.request',
  APPROVED = 'remote.control.approved',
  DENIED = 'remote.control.denied',
  SESSION_START = 'remote.control.session_start',
  SESSION_END = 'remote.control.session_end',
  INPUT = 'remote.control.input',
}

export enum ClipboardEvent {
  SYNC = 'clipboard.sync',
  CLEARED = 'clipboard.cleared',
}

export enum AuthEvent {
  BIOMETRIC_APPROVAL_REQUEST = 'auth.biometric_approval_request',
  BIOMETRIC_APPROVAL_RESPONSE = 'auth.biometric_approval_response',
  SESSION_REVOKED = 'auth.session_revoked',
  PASSWORD_CHANGED = 'auth.password_changed',
}

export type EventType =
  | DeviceEvent
  | FileEvent
  | RemoteControlEvent
  | ClipboardEvent
  | AuthEvent;

export interface EventPayload<T = any> {
  eventType: EventType;
  timestamp: Date;
  deviceId?: string;
  userId?: string;
  data: T;
}

export interface DeviceOnlinePayload {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  lastSeenAt: Date;
}

export interface DeviceOfflinePayload {
  deviceId: string;
  deviceName: string;
  lastSeenAt: Date;
}

export interface FileTransferProgressPayload {
  fileId: string;
  fileName: string;
  shareId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  speedBps?: number;
}

export interface FileAvailablePayload {
  fileId: string;
  fileName: string;
  fileSize: number;
  sourceDeviceId: string;
  sourceDeviceName: string;
  mimeType?: string;
}

export interface RemoteControlRequestPayload {
  sessionId: string;
  controllerDeviceId: string;
  controllerDeviceName: string;
  mode: 'view_only' | 'view_and_control';
  requestedAt: Date;
  expiresAt: Date;
}

export interface BiometricApprovalRequestPayload {
  approvalId: string;
  requestingDeviceId: string;
  requestingDeviceName: string;
  requestType: string;
  requestContext: Record<string, any>;
  expiresAt: Date;
}
