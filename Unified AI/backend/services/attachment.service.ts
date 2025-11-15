/**
 * Attachment Service
 *
 * Comprehensive service for handling file uploads, photo access, thumbnails,
 * and AI-powered image analysis for the Unified AI Hub.
 *
 * Features:
 * - File upload and management with permission checks
 * - Thumbnail generation for images
 * - AI-powered image analysis (OCR, description, object detection)
 * - EXIF metadata extraction
 * - Storage quota management
 * - Malicious file detection
 */

import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { AppDataSource } from '../config/data-source';
import { Attachment } from '../entities/Attachment';
import { Message } from '../entities/Message';
import { Thread } from '../entities/Thread';
import { User } from '../entities/User';
import { storageService } from './storage.service';
import { permissionService } from './permission.service';
import { providerService } from './provider.service';
import { PermissionEntityType } from '../entities/PermissionSet';
import { FileUtil, FileTypeCategory } from '../utils/file.util';
import { ImageUtil } from '../utils/image.util';

/**
 * File upload options
 */
export interface UploadFileOptions {
  messageId?: string;
  threadId?: string;
  stripMetadata?: boolean;
  generateThumbnail?: boolean;
  analyzeImage?: boolean;
  customMetadata?: Record<string, any>;
}

/**
 * File upload result
 */
export interface UploadFileResult {
  attachment: Attachment;
  thumbnailGenerated: boolean;
  analyzed: boolean;
}

/**
 * Attachment filter options
 */
export interface AttachmentFilters {
  threadId?: string;
  messageId?: string;
  userId?: string;
  mimeType?: string;
  category?: FileTypeCategory;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Storage statistics for a user
 */
export interface UserStorageStats {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  quotaBytes: number;
  quotaFormatted: string;
  usagePercent: number;
  filesByType: Record<string, { count: number; sizeBytes: number }>;
}

/**
 * Image analysis result
 */
export interface ImageAnalysisResult {
  description?: string;
  objects?: Array<{ name: string; confidence: number }>;
  text?: string;
  labels?: string[];
  colors?: Array<{ color: string; percent: number }>;
  faces?: number;
  isAdult?: boolean;
  isRacy?: boolean;
  isGory?: boolean;
}

/**
 * Attachment Service Error
 */
export class AttachmentServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AttachmentServiceError';
  }
}

/**
 * Attachment Service
 */
export class AttachmentService {
  private attachmentRepository: Repository<Attachment>;
  private messageRepository: Repository<Message>;
  private threadRepository: Repository<Thread>;
  private userRepository: Repository<User>;

  constructor() {
    this.attachmentRepository = AppDataSource.getRepository(Attachment);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.threadRepository = AppDataSource.getRepository(Thread);
    this.userRepository = AppDataSource.getRepository(User);
  }

  // ============================================================================
  // FILE UPLOAD & MANAGEMENT
  // ============================================================================

  /**
   * Upload a file attachment
   */
  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    userId: string,
    options: UploadFileOptions = {}
  ): Promise<UploadFileResult> {
    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AttachmentServiceError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Validate that either messageId or threadId is provided
    if (!options.messageId && !options.threadId) {
      throw new AttachmentServiceError(
        'Either messageId or threadId is required',
        'MISSING_PARENT',
        400
      );
    }

    // Validate parent entity exists and check permissions
    let message: Message | null = null;
    let thread: Thread | null = null;

    if (options.messageId) {
      message = await this.messageRepository.findOne({
        where: { id: options.messageId },
        relations: ['thread']
      });

      if (!message) {
        throw new AttachmentServiceError('Message not found', 'MESSAGE_NOT_FOUND', 404);
      }

      thread = message.thread;

      // Check write permission on thread (messages inherit from thread)
      const canWrite = await permissionService.canUserAccess(
        userId,
        PermissionEntityType.THREAD,
        message.threadId,
        'write'
      );

      if (!canWrite) {
        throw new AttachmentServiceError(
          'Permission denied: cannot upload to this message',
          'PERMISSION_DENIED',
          403
        );
      }
    } else if (options.threadId) {
      thread = await this.threadRepository.findOne({
        where: { id: options.threadId }
      });

      if (!thread) {
        throw new AttachmentServiceError('Thread not found', 'THREAD_NOT_FOUND', 404);
      }

      // Check write permission on thread
      const canWrite = await permissionService.canUserAccess(
        userId,
        PermissionEntityType.THREAD,
        options.threadId,
        'write'
      );

      if (!canWrite) {
        throw new AttachmentServiceError(
          'Permission denied: cannot upload to this thread',
          'PERMISSION_DENIED',
          403
        );
      }
    }

    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new AttachmentServiceError(validation.error!, 'INVALID_FILE', 400);
    }

    // Check storage quota
    const canAdd = await storageService.canAddFile(file.size);
    if (!canAdd) {
      throw new AttachmentServiceError(
        'Storage quota exceeded',
        'QUOTA_EXCEEDED',
        413
      );
    }

    // Check for malicious files
    if (FileUtil.isSuspiciousFile(file.originalname, file.mimetype)) {
      throw new AttachmentServiceError(
        'Suspicious file detected',
        'SUSPICIOUS_FILE',
        400
      );
    }

    // Create attachment record
    const attachment = this.attachmentRepository.create({
      originalFileName: FileUtil.sanitizeFileName(file.originalname),
      fileName: FileUtil.generateUniqueFileName(file.originalname),
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedById: userId,
      messageId: options.messageId,
      threadId: options.threadId || thread?.id,
      metadata: options.customMetadata || {}
    });

    // Save to get ID
    const savedAttachment = await this.attachmentRepository.save(attachment);

    // Create directory and save file
    const dirPath = await storageService.createAttachmentDirectory(userId, savedAttachment.id);
    const filePath = path.join(dirPath, attachment.fileName);
    await fs.writeFile(filePath, file.buffer);

    // Update file path
    savedAttachment.filePath = filePath;
    await this.attachmentRepository.save(savedAttachment);

    let thumbnailGenerated = false;
    let analyzed = false;

    // Process image if applicable
    if (FileUtil.isImage(file.mimetype)) {
      // Extract EXIF metadata
      try {
        const exif = await ImageUtil.extractExif(filePath);
        const imageInfo = await ImageUtil.getImageInfo(filePath);

        savedAttachment.metadata = {
          ...savedAttachment.metadata,
          exif,
          imageInfo
        };
        await this.attachmentRepository.save(savedAttachment);
      } catch (error) {
        console.error('Failed to extract image metadata:', error);
      }

      // Strip metadata if requested
      if (options.stripMetadata) {
        try {
          const strippedPath = filePath + '.stripped';
          await ImageUtil.stripMetadata(filePath, strippedPath);
          await fs.unlink(filePath);
          await fs.rename(strippedPath, filePath);
        } catch (error) {
          console.error('Failed to strip metadata:', error);
        }
      }

      // Generate thumbnail
      if (options.generateThumbnail !== false) {
        try {
          await this.generateThumbnail(savedAttachment.id);
          thumbnailGenerated = true;
        } catch (error) {
          console.error('Failed to generate thumbnail:', error);
        }
      }

      // Analyze image with AI
      if (options.analyzeImage) {
        try {
          await this.analyzeImage(savedAttachment.id);
          analyzed = true;
        } catch (error) {
          console.error('Failed to analyze image:', error);
        }
      }
    }

    return {
      attachment: savedAttachment,
      thumbnailGenerated,
      analyzed
    };
  }

  /**
   * Get an attachment by ID with permission check
   */
  async getAttachment(attachmentId: string, userId: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId },
      relations: ['uploadedBy', 'message', 'thread']
    });

    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found', 'ATTACHMENT_NOT_FOUND', 404);
    }

    // Check permissions
    const hasPermission = await this.checkAttachmentPermission(attachment, userId, 'read');
    if (!hasPermission) {
      throw new AttachmentServiceError(
        'Permission denied: cannot access this attachment',
        'PERMISSION_DENIED',
        403
      );
    }

    return attachment;
  }

  /**
   * List attachments with filters
   */
  async listAttachments(
    filters: AttachmentFilters,
    userId: string
  ): Promise<{ attachments: Attachment[]; total: number }> {
    const query = this.attachmentRepository.createQueryBuilder('attachment')
      .leftJoinAndSelect('attachment.uploadedBy', 'user')
      .leftJoinAndSelect('attachment.message', 'message')
      .leftJoinAndSelect('attachment.thread', 'thread');

    // Apply filters
    if (filters.threadId) {
      query.andWhere('attachment.threadId = :threadId', { threadId: filters.threadId });

      // Check thread permission
      const canRead = await permissionService.canUserAccess(
        userId,
        PermissionEntityType.THREAD,
        filters.threadId,
        'read'
      );

      if (!canRead) {
        throw new AttachmentServiceError(
          'Permission denied: cannot access this thread',
          'PERMISSION_DENIED',
          403
        );
      }
    }

    if (filters.messageId) {
      query.andWhere('attachment.messageId = :messageId', { messageId: filters.messageId });
    }

    if (filters.userId) {
      query.andWhere('attachment.uploadedById = :userId', { userId: filters.userId });
    }

    if (filters.mimeType) {
      query.andWhere('attachment.mimeType = :mimeType', { mimeType: filters.mimeType });
    }

    if (filters.category) {
      const typeInfo = Object.values(FileUtil['ALLOWED_MIME_TYPES'])
        .filter(info => info.category === filters.category)
        .map(info => info.mimeType);

      if (typeInfo.length > 0) {
        query.andWhere('attachment.mimeType IN (:...mimeTypes)', { mimeTypes: typeInfo });
      }
    }

    if (filters.startDate) {
      query.andWhere('attachment.uploadedAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('attachment.uploadedAt <= :endDate', { endDate: filters.endDate });
    }

    // Get total count
    const total = await query.getCount();

    // Apply pagination
    if (filters.limit) {
      query.take(filters.limit);
    }

    if (filters.offset) {
      query.skip(filters.offset);
    }

    // Order by upload date (newest first)
    query.orderBy('attachment.uploadedAt', 'DESC');

    const attachments = await query.getMany();

    return { attachments, total };
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId },
      relations: ['thread']
    });

    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found', 'ATTACHMENT_NOT_FOUND', 404);
    }

    // Check permissions (must be owner or have delete permission on parent)
    const hasPermission = await this.checkAttachmentPermission(attachment, userId, 'delete');
    if (!hasPermission) {
      throw new AttachmentServiceError(
        'Permission denied: cannot delete this attachment',
        'PERMISSION_DENIED',
        403
      );
    }

    // Delete files from disk
    try {
      await fs.unlink(attachment.filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }

    if (attachment.thumbnailPath) {
      try {
        await fs.unlink(attachment.thumbnailPath);
      } catch (error) {
        console.error('Failed to delete thumbnail:', error);
      }
    }

    // Delete database record
    await this.attachmentRepository.remove(attachment);
  }

  /**
   * Get download stream for an attachment
   */
  async downloadAttachment(attachmentId: string, userId: string): Promise<{
    stream: Readable;
    fileName: string;
    mimeType: string;
    size: number;
  }> {
    const attachment = await this.getAttachment(attachmentId, userId);

    // Check if file exists
    try {
      await fs.access(attachment.filePath);
    } catch {
      throw new AttachmentServiceError('File not found on disk', 'FILE_NOT_FOUND', 404);
    }

    // Create read stream
    const stream = require('fs').createReadStream(attachment.filePath);

    return {
      stream,
      fileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      size: Number(attachment.fileSize)
    };
  }

  // ============================================================================
  // THUMBNAIL GENERATION
  // ============================================================================

  /**
   * Generate thumbnail for an attachment
   */
  async generateThumbnail(attachmentId: string): Promise<{ path: string; width: number; height: number }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId }
    });

    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found', 'ATTACHMENT_NOT_FOUND', 404);
    }

    // Check if file supports thumbnails
    if (!FileUtil.supportsThumbnail(attachment.mimeType)) {
      throw new AttachmentServiceError(
        'File type does not support thumbnails',
        'THUMBNAIL_NOT_SUPPORTED',
        400
      );
    }

    // Generate thumbnail path
    const dirPath = path.dirname(attachment.filePath);
    const thumbnailFileName = `thumb_${attachment.fileName}`.replace(/\.[^.]+$/, '.jpg');
    const thumbnailPath = path.join(dirPath, thumbnailFileName);

    // Generate thumbnail
    const result = await ImageUtil.generateThumbnail(
      attachment.filePath,
      thumbnailPath,
      {
        width: 300,
        height: 300,
        fit: 'cover',
        quality: 80,
        format: 'jpeg'
      }
    );

    // Update attachment record
    attachment.thumbnailPath = thumbnailPath;
    await this.attachmentRepository.save(attachment);

    return {
      path: thumbnailPath,
      width: result.width,
      height: result.height
    };
  }

  /**
   * Get thumbnail for an attachment
   */
  async getThumbnail(attachmentId: string, userId: string): Promise<{
    stream: Readable;
    mimeType: string;
  }> {
    const attachment = await this.getAttachment(attachmentId, userId);

    if (!attachment.thumbnailPath) {
      throw new AttachmentServiceError(
        'Thumbnail not available for this attachment',
        'THUMBNAIL_NOT_FOUND',
        404
      );
    }

    // Check if thumbnail exists
    try {
      await fs.access(attachment.thumbnailPath);
    } catch {
      // Try to regenerate thumbnail
      try {
        await this.generateThumbnail(attachmentId);
        const updatedAttachment = await this.attachmentRepository.findOne({
          where: { id: attachmentId }
        });
        if (!updatedAttachment?.thumbnailPath) {
          throw new Error('Failed to regenerate thumbnail');
        }
        attachment.thumbnailPath = updatedAttachment.thumbnailPath;
      } catch (error) {
        throw new AttachmentServiceError(
          'Thumbnail file not found',
          'THUMBNAIL_NOT_FOUND',
          404
        );
      }
    }

    // Create read stream
    const stream = require('fs').createReadStream(attachment.thumbnailPath);

    return {
      stream,
      mimeType: 'image/jpeg'
    };
  }

  // ============================================================================
  // IMAGE ANALYSIS (AI-POWERED)
  // ============================================================================

  /**
   * Analyze image with AI (OCR, description, object detection)
   */
  async analyzeImage(
    attachmentId: string,
    providerConfigId?: string
  ): Promise<ImageAnalysisResult> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId }
    });

    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found', 'ATTACHMENT_NOT_FOUND', 404);
    }

    // Check if file is an image
    if (!FileUtil.isImage(attachment.mimeType)) {
      throw new AttachmentServiceError(
        'File is not an image',
        'NOT_AN_IMAGE',
        400
      );
    }

    // Find a vision-capable provider if not specified
    if (!providerConfigId) {
      const providers = await providerService.listAvailableProviders(attachment.uploadedById);
      const visionProvider = providers.find(p => p.supportsVision && p.isConfigured);

      if (!visionProvider) {
        throw new AttachmentServiceError(
          'No vision-capable AI provider configured',
          'NO_VISION_PROVIDER',
          400
        );
      }

      // Get the first configured provider of this type
      const configs = await providerService.getUserProviderConfigs(attachment.uploadedById);
      const providerConfig = configs.find(c => c.providerKey === visionProvider.providerKey);

      if (!providerConfig) {
        throw new AttachmentServiceError(
          'Provider configuration not found',
          'PROVIDER_NOT_CONFIGURED',
          400
        );
      }

      providerConfigId = providerConfig.id;
    }

    // Read image file as base64
    const imageBuffer = await fs.readFile(attachment.filePath);
    const base64Image = imageBuffer.toString('base64');

    // Construct vision prompt
    const analysisPrompt = `Analyze this image and provide:
1. A detailed description of what's in the image
2. Any text visible in the image (OCR)
3. Key objects or elements present
4. The overall scene or context

Format your response as JSON with these fields:
- description: string (detailed description)
- text: string (any text found via OCR, or empty string)
- objects: array of { name: string, confidence: number } (key objects detected)
- labels: array of strings (descriptive labels/tags)`;

    try {
      // Send to AI provider
      const response = await providerService.sendMessage(providerConfigId, {
        model: 'gpt-4-vision-preview', // This will be adapted by the provider
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${attachment.mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      // Parse response
      let analysisResult: ImageAnalysisResult;
      try {
        analysisResult = JSON.parse(response.content);
      } catch {
        // If not JSON, create structured result from text
        analysisResult = {
          description: response.content,
          objects: [],
          labels: []
        };
      }

      // Update attachment with analysis result
      attachment.isAnalyzed = true;
      attachment.analysisResult = analysisResult;
      await this.attachmentRepository.save(attachment);

      return analysisResult;
    } catch (error) {
      throw new AttachmentServiceError(
        `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANALYSIS_FAILED',
        500
      );
    }
  }

  /**
   * Extract text from image (OCR)
   */
  async extractText(attachmentId: string, providerConfigId?: string): Promise<string> {
    const analysisResult = await this.analyzeImage(attachmentId, providerConfigId);
    return analysisResult.text || '';
  }

  /**
   * Get image metadata (EXIF)
   */
  async getImageMetadata(attachmentId: string): Promise<{
    exif?: any;
    imageInfo?: any;
    dominantColor?: { r: number; g: number; b: number };
  }> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId }
    });

    if (!attachment) {
      throw new AttachmentServiceError('Attachment not found', 'ATTACHMENT_NOT_FOUND', 404);
    }

    // Check if file is an image
    if (!FileUtil.isImage(attachment.mimeType)) {
      throw new AttachmentServiceError(
        'File is not an image',
        'NOT_AN_IMAGE',
        400
      );
    }

    const metadata: any = {
      exif: attachment.metadata?.exif,
      imageInfo: attachment.metadata?.imageInfo
    };

    // Extract dominant color if not already cached
    if (!attachment.metadata?.dominantColor) {
      try {
        const dominantColor = await ImageUtil.extractDominantColor(attachment.filePath);
        metadata.dominantColor = dominantColor;

        // Cache it
        attachment.metadata = {
          ...attachment.metadata,
          dominantColor
        };
        await this.attachmentRepository.save(attachment);
      } catch (error) {
        console.error('Failed to extract dominant color:', error);
      }
    } else {
      metadata.dominantColor = attachment.metadata.dominantColor;
    }

    return metadata;
  }

  // ============================================================================
  // ATTACHMENT METADATA
  // ============================================================================

  /**
   * Update custom metadata for an attachment
   */
  async updateMetadata(
    attachmentId: string,
    userId: string,
    metadata: Record<string, any>
  ): Promise<Attachment> {
    const attachment = await this.getAttachment(attachmentId, userId);

    // Check write permission
    const hasPermission = await this.checkAttachmentPermission(attachment, userId, 'write');
    if (!hasPermission) {
      throw new AttachmentServiceError(
        'Permission denied: cannot update this attachment',
        'PERMISSION_DENIED',
        403
      );
    }

    // Merge metadata (preserve system metadata)
    attachment.metadata = {
      ...attachment.metadata,
      ...metadata
    };

    return await this.attachmentRepository.save(attachment);
  }

  /**
   * Get storage statistics for a user
   */
  async getAttachmentStats(userId: string): Promise<UserStorageStats> {
    const attachments = await this.attachmentRepository.find({
      where: { uploadedById: userId }
    });

    const stats: UserStorageStats = {
      totalFiles: attachments.length,
      totalSizeBytes: 0,
      totalSizeFormatted: '0 Bytes',
      quotaBytes: storageService['quotaBytes'],
      quotaFormatted: storageService.formatBytes(storageService['quotaBytes']),
      usagePercent: 0,
      filesByType: {}
    };

    for (const attachment of attachments) {
      const size = Number(attachment.fileSize);
      stats.totalSizeBytes += size;

      const category = FileUtil.getFileCategory(attachment.mimeType);
      if (!stats.filesByType[category]) {
        stats.filesByType[category] = { count: 0, sizeBytes: 0 };
      }

      stats.filesByType[category].count++;
      stats.filesByType[category].sizeBytes += size;
    }

    stats.totalSizeFormatted = FileUtil.formatFileSize(stats.totalSizeBytes);
    stats.usagePercent = (stats.totalSizeBytes / stats.quotaBytes) * 100;

    return stats;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate file before upload
   */
  private validateFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): { valid: boolean; error?: string } {
    // Check file name
    const nameValidation = FileUtil.validateFileName(file.originalname);
    if (!nameValidation.valid) {
      return nameValidation;
    }

    // Check MIME type
    if (!FileUtil.isAllowedMimeType(file.mimetype)) {
      return { valid: false, error: `File type ${file.mimetype} is not supported` };
    }

    // Check file size
    const maxSize = FileUtil.getMaxFileSize();
    if (!FileUtil.isFileSizeValid(file.size, maxSize / (1024 * 1024))) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${FileUtil.formatFileSize(maxSize)}`
      };
    }

    // Validate MIME type matches extension
    if (!FileUtil.validateMimeType(file.originalname, file.mimetype)) {
      return { valid: false, error: 'File extension does not match MIME type' };
    }

    return { valid: true };
  }

  /**
   * Check if user has permission to access an attachment
   */
  private async checkAttachmentPermission(
    attachment: Attachment,
    userId: string,
    action: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    // Owner has full access
    if (attachment.uploadedById === userId) {
      return true;
    }

    // Check permission on parent entity
    let parentType: PermissionEntityType;
    let parentId: string;

    if (attachment.messageId) {
      // For message attachments, check thread permission (messages inherit from thread)
      const message = await this.messageRepository.findOne({
        where: { id: attachment.messageId }
      });
      if (!message) {
        return false;
      }
      parentType = PermissionEntityType.THREAD;
      parentId = message.threadId;
    } else if (attachment.threadId) {
      parentType = PermissionEntityType.THREAD;
      parentId = attachment.threadId;
    } else {
      return false;
    }

    return await permissionService.canUserAccess(userId, parentType, parentId, action);
  }
}

/**
 * Singleton instance
 */
export const attachmentService = new AttachmentService();
