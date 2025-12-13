/**
 * File Utility
 *
 * Provides file type detection, MIME validation, size formatting,
 * and other file-related helper functions.
 */

import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Supported file type categories
 */
export enum FileTypeCategory {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  ARCHIVE = 'ARCHIVE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  UNKNOWN = 'UNKNOWN'
}

/**
 * File type information
 */
export interface FileTypeInfo {
  category: FileTypeCategory;
  mimeType: string;
  extension: string;
  isSupported: boolean;
  supportsPreview: boolean;
  supportsThumbnail: boolean;
  supportsTextExtraction: boolean;
}

/**
 * Allowed MIME types with their configurations
 */
export const ALLOWED_MIME_TYPES: Record<string, FileTypeInfo> = {
  // Images
  'image/jpeg': {
    category: FileTypeCategory.IMAGE,
    mimeType: 'image/jpeg',
    extension: '.jpg',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: true
  },
  'image/png': {
    category: FileTypeCategory.IMAGE,
    mimeType: 'image/png',
    extension: '.png',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: true
  },
  'image/gif': {
    category: FileTypeCategory.IMAGE,
    mimeType: 'image/gif',
    extension: '.gif',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: false
  },
  'image/webp': {
    category: FileTypeCategory.IMAGE,
    mimeType: 'image/webp',
    extension: '.webp',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: true
  },
  'image/heic': {
    category: FileTypeCategory.IMAGE,
    mimeType: 'image/heic',
    extension: '.heic',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: true
  },
  'image/heif': {
    category: FileTypeCategory.IMAGE,
    mimeType: 'image/heif',
    extension: '.heif',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: true
  },

  // Documents
  'application/pdf': {
    category: FileTypeCategory.DOCUMENT,
    mimeType: 'application/pdf',
    extension: '.pdf',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: true
  },
  'text/plain': {
    category: FileTypeCategory.DOCUMENT,
    mimeType: 'text/plain',
    extension: '.txt',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: false,
    supportsTextExtraction: true
  },
  'text/markdown': {
    category: FileTypeCategory.DOCUMENT,
    mimeType: 'text/markdown',
    extension: '.md',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: false,
    supportsTextExtraction: true
  },

  // Archives
  'application/zip': {
    category: FileTypeCategory.ARCHIVE,
    mimeType: 'application/zip',
    extension: '.zip',
    isSupported: true,
    supportsPreview: false,
    supportsThumbnail: false,
    supportsTextExtraction: false
  },

  // Video
  'video/mp4': {
    category: FileTypeCategory.VIDEO,
    mimeType: 'video/mp4',
    extension: '.mp4',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: false
  },
  'video/webm': {
    category: FileTypeCategory.VIDEO,
    mimeType: 'video/webm',
    extension: '.webm',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: true,
    supportsTextExtraction: false
  },

  // Audio
  'audio/mpeg': {
    category: FileTypeCategory.AUDIO,
    mimeType: 'audio/mpeg',
    extension: '.mp3',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: false,
    supportsTextExtraction: false
  },
  'audio/wav': {
    category: FileTypeCategory.AUDIO,
    mimeType: 'audio/wav',
    extension: '.wav',
    isSupported: true,
    supportsPreview: true,
    supportsThumbnail: false,
    supportsTextExtraction: false
  }
};

/**
 * File extension to MIME type mapping
 */
export const EXTENSION_TO_MIME: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',

  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',

  // Archives
  '.zip': 'application/zip',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

/**
 * File Utility Class
 */
export class FileUtil {
  /**
   * Get file extension from filename
   */
  static getExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }

  /**
   * Get base name without extension
   */
  static getBaseName(fileName: string): string {
    return path.basename(fileName, path.extname(fileName));
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeTypeFromExtension(fileName: string): string | null {
    const ext = this.getExtension(fileName);
    return EXTENSION_TO_MIME[ext] || null;
  }

  /**
   * Get file type information from MIME type
   */
  static getFileTypeInfo(mimeType: string): FileTypeInfo | null {
    return ALLOWED_MIME_TYPES[mimeType] || null;
  }

  /**
   * Check if MIME type is allowed
   */
  static isAllowedMimeType(mimeType: string): boolean {
    return mimeType in ALLOWED_MIME_TYPES;
  }

  /**
   * Check if file extension is allowed
   */
  static isAllowedExtension(fileName: string): boolean {
    const ext = this.getExtension(fileName);
    return ext in EXTENSION_TO_MIME;
  }

  /**
   * Validate MIME type matches file extension
   */
  static validateMimeType(fileName: string, mimeType: string): boolean {
    const expectedMime = this.getMimeTypeFromExtension(fileName);
    if (!expectedMime) {
      return false;
    }
    return expectedMime === mimeType;
  }

  /**
   * Check if file is an image
   */
  static isImage(mimeType: string): boolean {
    const info = this.getFileTypeInfo(mimeType);
    return info?.category === FileTypeCategory.IMAGE;
  }

  /**
   * Check if file is a document
   */
  static isDocument(mimeType: string): boolean {
    const info = this.getFileTypeInfo(mimeType);
    return info?.category === FileTypeCategory.DOCUMENT;
  }

  /**
   * Check if file supports thumbnail generation
   */
  static supportsThumbnail(mimeType: string): boolean {
    const info = this.getFileTypeInfo(mimeType);
    return info?.supportsThumbnail || false;
  }

  /**
   * Check if file supports text extraction
   */
  static supportsTextExtraction(mimeType: string): boolean {
    const info = this.getFileTypeInfo(mimeType);
    return info?.supportsTextExtraction || false;
  }

  /**
   * Format file size to human-readable string
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Parse file size from human-readable string
   */
  static parseFileSize(sizeStr: string): number {
    const units: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
    if (!match) {
      throw new Error('Invalid file size format');
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (!(unit in units)) {
      throw new Error('Invalid file size unit');
    }

    return Math.floor(value * units[unit]);
  }

  /**
   * Generate a unique file name while preserving extension
   */
  static generateUniqueFileName(originalFileName: string): string {
    const ext = this.getExtension(originalFileName);
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
  }

  /**
   * Sanitize file name (remove dangerous characters)
   */
  static sanitizeFileName(fileName: string): string {
    // Remove path separators and null bytes
    let sanitized = fileName.replace(/[\/\\:\*\?"<>\|]/g, '_');

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Limit length to 255 characters
    if (sanitized.length > 255) {
      const ext = this.getExtension(sanitized);
      const baseName = sanitized.substring(0, 255 - ext.length);
      sanitized = baseName + ext;
    }

    return sanitized;
  }

  /**
   * Calculate file hash (SHA-256)
   */
  static calculateFileHash(buffer: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');
  }

  /**
   * Get file category from MIME type
   */
  static getFileCategory(mimeType: string): FileTypeCategory {
    const info = this.getFileTypeInfo(mimeType);
    return info?.category || FileTypeCategory.UNKNOWN;
  }

  /**
   * Check if file size is within limit
   */
  static isFileSizeValid(sizeBytes: number, maxSizeMB: number): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return sizeBytes <= maxSizeBytes;
  }

  /**
   * Get max file size from environment
   */
  static getMaxFileSize(): number {
    const maxSizeMB = parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '100');
    return maxSizeMB * 1024 * 1024;
  }

  /**
   * Validate file name
   */
  static validateFileName(fileName: string): { valid: boolean; error?: string } {
    if (!fileName || fileName.trim() === '') {
      return { valid: false, error: 'File name is required' };
    }

    if (fileName.length > 255) {
      return { valid: false, error: 'File name is too long (max 255 characters)' };
    }

    if (!/^[\w\-. ]+$/.test(fileName)) {
      return { valid: false, error: 'File name contains invalid characters' };
    }

    const ext = this.getExtension(fileName);
    if (!ext) {
      return { valid: false, error: 'File must have an extension' };
    }

    if (!this.isAllowedExtension(fileName)) {
      return { valid: false, error: `File type ${ext} is not supported` };
    }

    return { valid: true };
  }

  /**
   * Get content type for download
   */
  static getContentType(mimeType: string): string {
    // Force download for certain types
    if (mimeType === 'application/zip') {
      return 'application/octet-stream';
    }
    return mimeType;
  }

  /**
   * Get content disposition for download
   */
  static getContentDisposition(fileName: string, inline: boolean = false): string {
    const sanitized = this.sanitizeFileName(fileName);
    const disposition = inline ? 'inline' : 'attachment';
    return `${disposition}; filename="${sanitized}"`;
  }

  /**
   * Check if file is potentially malicious
   */
  static isSuspiciousFile(fileName: string, mimeType: string): boolean {
    // Check for double extensions
    const parts = fileName.split('.');
    if (parts.length > 2) {
      // Check if any part before the last is an executable extension
      const executableExts = ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar'];
      for (let i = 0; i < parts.length - 1; i++) {
        if (executableExts.includes('.' + parts[i].toLowerCase())) {
          return true;
        }
      }
    }

    // Check MIME type mismatch
    if (!this.validateMimeType(fileName, mimeType)) {
      return true;
    }

    return false;
  }
}
