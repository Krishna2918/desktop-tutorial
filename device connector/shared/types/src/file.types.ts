/**
 * File transfer and storage types
 */

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'deleted';
export type VirusScanStatus = 'pending' | 'clean' | 'infected' | 'failed';
export type ShareStatus = 'pending' | 'transferred' | 'failed' | 'cancelled';

export interface FileMetadata {
  originalPath?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  tags?: string[];
}

export interface File {
  id: string;
  userId: string;
  sourceDeviceId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  fileHash: string;
  storageKey: string;
  storageBucket: string;
  encryptionKeyId?: string;
  uploadStatus: UploadStatus;
  uploadProgress: number;
  metadata: FileMetadata;
  virusScanStatus?: VirusScanStatus;
  virusScanResult?: any;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface InitiateUploadDto {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  fileHash: string;
  targetDeviceId?: string;
  metadata?: FileMetadata;
}

export interface InitiateUploadResponse {
  uploadId: string;
  fileId: string;
  presignedUrls: {
    partNumber: number;
    url: string;
  }[];
}

export interface UploadPartDto {
  uploadId: string;
  partNumber: number;
  etag: string;
}

export interface CompleteUploadDto {
  uploadId: string;
  parts: {
    partNumber: number;
    etag: string;
  }[];
}

export interface FileShare {
  id: string;
  fileId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  shareStatus: ShareStatus;
  transferProgress: number;
  bytesTransferred: number;
  transferSpeedBps?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface ShareFileDto {
  fileId: string;
  targetDeviceIds: string[];
}

export interface DownloadFileResponse {
  presignedUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: Date;
}
