/**
 * Synchronization types (clipboard, contacts, etc.)
 */

export type ClipboardContentType = 'text' | 'image' | 'file' | 'url';
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'deleted';

export interface ClipboardSync {
  id: string;
  userId: string;
  sourceDeviceId: string;
  contentType: ClipboardContentType;
  contentText?: string;
  contentData?: Buffer;
  contentFileId?: string;
  contentHash: string;
  contentSize: number;
  metadata: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

export interface SyncClipboardDto {
  contentType: ClipboardContentType;
  content: string | Buffer;
  metadata?: Record<string, any>;
}

export interface ContactData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  photoUrl?: string;
  customFields?: Record<string, any>;
}

export interface ContactSync {
  id: string;
  userId: string;
  sourceDeviceId: string;
  contactData: ContactData;
  contactHash: string;
  syncStatus: SyncStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface SyncContactsDto {
  contacts: ContactData[];
  fullSync?: boolean;
}

export interface SyncSettings {
  id: string;
  userId: string;
  deviceId: string;
  settings: Record<string, any>;
  syncedAt: Date;
}

export interface SyncSettingsDto {
  settings: Record<string, any>;
}
