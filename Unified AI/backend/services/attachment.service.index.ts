/**
 * Attachment Service Index
 *
 * Centralized exports for the Attachment Service and related utilities.
 */

// Main service
export {
  attachmentService,
  AttachmentService,
  AttachmentServiceError,
  UploadFileOptions,
  UploadFileResult,
  AttachmentFilters,
  UserStorageStats,
  ImageAnalysisResult
} from './attachment.service';

// File utilities
export {
  FileUtil,
  FileTypeCategory,
  FileTypeInfo,
  ALLOWED_MIME_TYPES,
  EXTENSION_TO_MIME
} from '../utils/file.util';

// Image utilities
export {
  ImageUtil,
  ExifMetadata,
  ImageInfo,
  ThumbnailOptions,
  ImageProcessOptions,
  THUMBNAIL_SIZES
} from '../utils/image.util';

// Re-export for convenience
export * from './attachment.service.example';
