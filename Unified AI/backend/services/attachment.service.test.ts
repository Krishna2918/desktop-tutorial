/**
 * Attachment Service Tests
 *
 * Unit and integration tests for the AttachmentService.
 * Note: These tests require a test database and test files.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { attachmentService, AttachmentServiceError } from './attachment.service';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { Thread } from '../entities/Thread';
import { Project } from '../entities/Project';
import { Workspace } from '../entities/Workspace';
import { FileTypeCategory } from '../utils/file.util';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('AttachmentService', () => {
  let testUser: User;
  let testThread: Thread;
  let testWorkspace: Workspace;
  let testProject: Project;

  beforeEach(async () => {
    // Initialize test database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Create test user
    const userRepo = AppDataSource.getRepository(User);
    testUser = await userRepo.save({
      email: 'test@example.com',
      passwordHash: 'hashed',
      displayName: 'Test User'
    });

    // Create test workspace
    const workspaceRepo = AppDataSource.getRepository(Workspace);
    testWorkspace = await workspaceRepo.save({
      name: 'Test Workspace',
      ownerType: 'USER',
      userId: testUser.id
    });

    // Create test project
    const projectRepo = AppDataSource.getRepository(Project);
    testProject = await projectRepo.save({
      name: 'Test Project',
      workspaceId: testWorkspace.id
    });

    // Create test thread
    const threadRepo = AppDataSource.getRepository(Thread);
    testThread = await threadRepo.save({
      title: 'Test Thread',
      projectId: testProject.id,
      createdById: testUser.id
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('uploadFile', () => {
    it('should upload a valid image file', async () => {
      const testImage = Buffer.from('fake-image-data');

      const result = await attachmentService.uploadFile(
        {
          buffer: testImage,
          originalname: 'test-image.jpg',
          mimetype: 'image/jpeg',
          size: testImage.length
        },
        testUser.id,
        {
          threadId: testThread.id,
          generateThumbnail: false,
          analyzeImage: false
        }
      );

      expect(result.attachment).toBeDefined();
      expect(result.attachment.originalFileName).toBe('test-image.jpg');
      expect(result.attachment.mimeType).toBe('image/jpeg');
      expect(result.attachment.uploadedById).toBe(testUser.id);
      expect(result.attachment.threadId).toBe(testThread.id);
    });

    it('should reject upload when user not found', async () => {
      const testFile = Buffer.from('test');

      await expect(
        attachmentService.uploadFile(
          {
            buffer: testFile,
            originalname: 'test.jpg',
            mimetype: 'image/jpeg',
            size: testFile.length
          },
          'non-existent-user',
          { threadId: testThread.id }
        )
      ).rejects.toThrow(AttachmentServiceError);
    });

    it('should reject upload when thread not found', async () => {
      const testFile = Buffer.from('test');

      await expect(
        attachmentService.uploadFile(
          {
            buffer: testFile,
            originalname: 'test.jpg',
            mimetype: 'image/jpeg',
            size: testFile.length
          },
          testUser.id,
          { threadId: 'non-existent-thread' }
        )
      ).rejects.toThrow(AttachmentServiceError);
    });

    it('should reject unsupported file types', async () => {
      const testFile = Buffer.from('test');

      await expect(
        attachmentService.uploadFile(
          {
            buffer: testFile,
            originalname: 'malware.exe',
            mimetype: 'application/x-msdownload',
            size: testFile.length
          },
          testUser.id,
          { threadId: testThread.id }
        )
      ).rejects.toThrow(AttachmentServiceError);
    });

    it('should reject files exceeding size limit', async () => {
      const largeFile = Buffer.alloc(200 * 1024 * 1024); // 200 MB

      await expect(
        attachmentService.uploadFile(
          {
            buffer: largeFile,
            originalname: 'large-file.jpg',
            mimetype: 'image/jpeg',
            size: largeFile.length
          },
          testUser.id,
          { threadId: testThread.id }
        )
      ).rejects.toThrow(AttachmentServiceError);
    });

    it('should sanitize file names', async () => {
      const testFile = Buffer.from('test');

      const result = await attachmentService.uploadFile(
        {
          buffer: testFile,
          originalname: '../../../etc/passwd.jpg',
          mimetype: 'image/jpeg',
          size: testFile.length
        },
        testUser.id,
        {
          threadId: testThread.id,
          generateThumbnail: false
        }
      );

      expect(result.attachment.originalFileName).not.toContain('../');
    });

    it('should store custom metadata', async () => {
      const testFile = Buffer.from('test');
      const customMetadata = {
        tags: ['test', 'important'],
        category: 'work'
      };

      const result = await attachmentService.uploadFile(
        {
          buffer: testFile,
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          size: testFile.length
        },
        testUser.id,
        {
          threadId: testThread.id,
          customMetadata,
          generateThumbnail: false
        }
      );

      expect(result.attachment.metadata).toMatchObject(customMetadata);
    });
  });

  describe('getAttachment', () => {
    it('should retrieve attachment with valid permissions', async () => {
      const testFile = Buffer.from('test');

      const uploadResult = await attachmentService.uploadFile(
        {
          buffer: testFile,
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          size: testFile.length
        },
        testUser.id,
        {
          threadId: testThread.id,
          generateThumbnail: false
        }
      );

      const attachment = await attachmentService.getAttachment(
        uploadResult.attachment.id,
        testUser.id
      );

      expect(attachment.id).toBe(uploadResult.attachment.id);
    });

    it('should throw error when attachment not found', async () => {
      await expect(
        attachmentService.getAttachment('non-existent-id', testUser.id)
      ).rejects.toThrow(AttachmentServiceError);
    });
  });

  describe('listAttachments', () => {
    it('should list attachments in a thread', async () => {
      // Upload multiple test files
      const files = ['test1.jpg', 'test2.png', 'test3.pdf'];

      for (const fileName of files) {
        const buffer = Buffer.from(fileName);
        const mimetype = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

        await attachmentService.uploadFile(
          {
            buffer,
            originalname: fileName,
            mimetype,
            size: buffer.length
          },
          testUser.id,
          {
            threadId: testThread.id,
            generateThumbnail: false
          }
        );
      }

      const { attachments, total } = await attachmentService.listAttachments(
        { threadId: testThread.id },
        testUser.id
      );

      expect(total).toBe(3);
      expect(attachments).toHaveLength(3);
    });

    it('should filter attachments by category', async () => {
      // Upload image and document
      await attachmentService.uploadFile(
        {
          buffer: Buffer.from('image'),
          originalname: 'image.jpg',
          mimetype: 'image/jpeg',
          size: 5
        },
        testUser.id,
        { threadId: testThread.id, generateThumbnail: false }
      );

      await attachmentService.uploadFile(
        {
          buffer: Buffer.from('document'),
          originalname: 'doc.pdf',
          mimetype: 'application/pdf',
          size: 8
        },
        testUser.id,
        { threadId: testThread.id }
      );

      const { attachments, total } = await attachmentService.listAttachments(
        {
          threadId: testThread.id,
          category: FileTypeCategory.IMAGE
        },
        testUser.id
      );

      expect(total).toBe(1);
      expect(attachments[0].mimeType).toBe('image/jpeg');
    });

    it('should paginate results', async () => {
      // Upload 10 files
      for (let i = 0; i < 10; i++) {
        await attachmentService.uploadFile(
          {
            buffer: Buffer.from(`test-${i}`),
            originalname: `test-${i}.jpg`,
            mimetype: 'image/jpeg',
            size: 10
          },
          testUser.id,
          { threadId: testThread.id, generateThumbnail: false }
        );
      }

      const page1 = await attachmentService.listAttachments(
        { threadId: testThread.id, limit: 5, offset: 0 },
        testUser.id
      );

      const page2 = await attachmentService.listAttachments(
        { threadId: testThread.id, limit: 5, offset: 5 },
        testUser.id
      );

      expect(page1.total).toBe(10);
      expect(page1.attachments).toHaveLength(5);
      expect(page2.attachments).toHaveLength(5);
      expect(page1.attachments[0].id).not.toBe(page2.attachments[0].id);
    });
  });

  describe('deleteAttachment', () => {
    it('should delete attachment when user is owner', async () => {
      const uploadResult = await attachmentService.uploadFile(
        {
          buffer: Buffer.from('test'),
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          size: 4
        },
        testUser.id,
        { threadId: testThread.id, generateThumbnail: false }
      );

      await attachmentService.deleteAttachment(
        uploadResult.attachment.id,
        testUser.id
      );

      // Verify deletion
      await expect(
        attachmentService.getAttachment(uploadResult.attachment.id, testUser.id)
      ).rejects.toThrow(AttachmentServiceError);
    });
  });

  describe('getAttachmentStats', () => {
    it('should calculate user storage statistics', async () => {
      // Upload multiple files
      await attachmentService.uploadFile(
        {
          buffer: Buffer.from('test1'),
          originalname: 'test1.jpg',
          mimetype: 'image/jpeg',
          size: 5
        },
        testUser.id,
        { threadId: testThread.id, generateThumbnail: false }
      );

      await attachmentService.uploadFile(
        {
          buffer: Buffer.from('test2'),
          originalname: 'test2.png',
          mimetype: 'image/png',
          size: 5
        },
        testUser.id,
        { threadId: testThread.id, generateThumbnail: false }
      );

      const stats = await attachmentService.getAttachmentStats(testUser.id);

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSizeBytes).toBe(10);
      expect(stats.filesByType).toHaveProperty(FileTypeCategory.IMAGE);
      expect(stats.usagePercent).toBeGreaterThan(0);
    });
  });

  describe('updateMetadata', () => {
    it('should update attachment metadata', async () => {
      const uploadResult = await attachmentService.uploadFile(
        {
          buffer: Buffer.from('test'),
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          size: 4
        },
        testUser.id,
        { threadId: testThread.id, generateThumbnail: false }
      );

      const newMetadata = {
        tags: ['updated', 'metadata'],
        category: 'personal'
      };

      const updated = await attachmentService.updateMetadata(
        uploadResult.attachment.id,
        testUser.id,
        newMetadata
      );

      expect(updated.metadata).toMatchObject(newMetadata);
    });
  });
});

describe('FileUtil', () => {
  const { FileUtil } = require('../utils/file.util');

  describe('getExtension', () => {
    it('should extract file extension', () => {
      expect(FileUtil.getExtension('test.jpg')).toBe('.jpg');
      expect(FileUtil.getExtension('document.PDF')).toBe('.pdf');
      expect(FileUtil.getExtension('no-extension')).toBe('');
    });
  });

  describe('isAllowedMimeType', () => {
    it('should validate allowed MIME types', () => {
      expect(FileUtil.isAllowedMimeType('image/jpeg')).toBe(true);
      expect(FileUtil.isAllowedMimeType('application/pdf')).toBe(true);
      expect(FileUtil.isAllowedMimeType('application/x-msdownload')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes to human-readable string', () => {
      expect(FileUtil.formatFileSize(0)).toBe('0 Bytes');
      expect(FileUtil.formatFileSize(1024)).toBe('1 KB');
      expect(FileUtil.formatFileSize(1048576)).toBe('1 MB');
      expect(FileUtil.formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove dangerous characters', () => {
      expect(FileUtil.sanitizeFileName('../../etc/passwd')).not.toContain('..');
      expect(FileUtil.sanitizeFileName('file:name')).not.toContain(':');
      expect(FileUtil.sanitizeFileName('file*name')).not.toContain('*');
    });
  });

  describe('isSuspiciousFile', () => {
    it('should detect suspicious files', () => {
      expect(FileUtil.isSuspiciousFile('file.exe.jpg', 'image/jpeg')).toBe(true);
      expect(FileUtil.isSuspiciousFile('normal.jpg', 'image/jpeg')).toBe(false);
    });
  });
});

describe('ImageUtil', () => {
  const { ImageUtil } = require('../utils/image.util');

  // Note: These tests require actual image files and the sharp library
  // For demonstration purposes, they are outlined but may need test fixtures

  describe('getImageInfo', () => {
    it('should extract image information', async () => {
      // Test would require actual image file
      // const info = await ImageUtil.getImageInfo('./test-fixtures/test.jpg');
      // expect(info.width).toBeGreaterThan(0);
      // expect(info.height).toBeGreaterThan(0);
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail from image', async () => {
      // Test would require actual image file
      // const result = await ImageUtil.generateThumbnail(
      //   './test-fixtures/test.jpg',
      //   './test-output/thumb.jpg'
      // );
      // expect(result.width).toBeLessThanOrEqual(300);
      // expect(result.height).toBeLessThanOrEqual(300);
    });
  });

  describe('validateImage', () => {
    it('should validate image files', async () => {
      // Test would require actual files
      // const valid = await ImageUtil.validateImage('./test-fixtures/valid.jpg');
      // expect(valid.valid).toBe(true);
      //
      // const invalid = await ImageUtil.validateImage('./test-fixtures/corrupt.jpg');
      // expect(invalid.valid).toBe(false);
    });
  });
});
