/**
 * Device-related types
 */

export type DeviceType = 'ios' | 'android' | 'macos' | 'windows';
export type DeviceStatus = 'active' | 'revoked' | 'suspended';
export type TrustLevel = 'full' | 'limited' | 'revoked';
export type DevicePermission =
  | 'file_transfer'
  | 'clipboard'
  | 'remote_control'
  | 'contacts';

export interface DeviceCapabilities {
  biometric: boolean;
  clipboard: boolean;
  files: boolean;
  remoteControl: boolean;
  contacts: boolean;
  screenShare: boolean;
}

export interface DeviceSettings {
  clipboardSyncEnabled: boolean;
  autoDownloadFiles: boolean;
  acceptRemoteControl: boolean;
  notificationPreferences: {
    fileTransfer: boolean;
    remoteControlRequest: boolean;
    deviceOnline: boolean;
  };
  theme: 'dark' | 'light' | 'auto';
  language: string;
}

export interface Device {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceType;
  osVersion: string;
  appVersion: string;
  deviceModel?: string;
  uniqueIdentifier: string;
  publicKey: string;
  capabilities: DeviceCapabilities;
  settings: DeviceSettings;
  lastSeenAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceStatus: DeviceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterDeviceDto {
  deviceName: string;
  deviceType: DeviceType;
  osVersion: string;
  appVersion: string;
  deviceModel?: string;
  uniqueIdentifier: string;
  publicKey: string;
  capabilities: DeviceCapabilities;
}

export interface UpdateDeviceDto {
  deviceName?: string;
  settings?: Partial<DeviceSettings>;
}

export interface DeviceTrust {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  trustLevel: TrustLevel;
  permissions: DevicePermission[];
  grantedAt: Date;
  revokedAt?: Date;
}

export interface DevicePresence {
  deviceId: string;
  status: 'online' | 'offline' | 'idle';
  lastSeen: Date;
  ipAddress?: string;
}
