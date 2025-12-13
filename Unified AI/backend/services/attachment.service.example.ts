/**
 * Attachment Service Usage Examples
 *
 * This file demonstrates how to use the AttachmentService for various
 * file upload, management, and AI-powered analysis tasks.
 */

import { attachmentService } from './attachment.service';
import { FileTypeCategory } from '../utils/file.util';
import * as fs from 'fs/promises';

/**
 * Example 1: Upload an image with thumbnail generation and AI analysis
 */
async function uploadImageWithAnalysis() {
  const userId = 'user-123';
  const threadId = 'thread-456';

  // Read file from disk (in a real app, this would come from a multipart upload)
  const fileBuffer = await fs.readFile('./path/to/image.jpg');

  const result = await attachmentService.uploadFile(
    {
      buffer: fileBuffer,
      originalname: 'vacation-photo.jpg',
      mimetype: 'image/jpeg',
      size: fileBuffer.length
    },
    userId,
    {
      threadId,
      generateThumbnail: true,
      analyzeImage: true,
      stripMetadata: false, // Keep EXIF data
      customMetadata: {
        tags: ['vacation', 'summer', '2024'],
        location: 'Hawaii'
      }
    }
  );

  console.log('Uploaded attachment:', result.attachment.id);
  console.log('Thumbnail generated:', result.thumbnailGenerated);
  console.log('AI analysis completed:', result.analyzed);

  if (result.attachment.analysisResult) {
    console.log('Description:', result.attachment.analysisResult.description);
    console.log('Objects detected:', result.attachment.analysisResult.objects);
  }
}

/**
 * Example 2: Upload a document to a message
 */
async function uploadDocumentToMessage() {
  const userId = 'user-123';
  const messageId = 'message-789';

  const fileBuffer = await fs.readFile('./path/to/document.pdf');

  const result = await attachmentService.uploadFile(
    {
      buffer: fileBuffer,
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      size: fileBuffer.length
    },
    userId,
    {
      messageId,
      customMetadata: {
        documentType: 'report',
        year: 2024
      }
    }
  );

  console.log('Document uploaded:', result.attachment.id);
}

/**
 * Example 3: List all attachments in a thread
 */
async function listThreadAttachments() {
  const userId = 'user-123';
  const threadId = 'thread-456';

  const { attachments, total } = await attachmentService.listAttachments(
    {
      threadId,
      limit: 20,
      offset: 0
    },
    userId
  );

  console.log(`Found ${total} attachments in thread`);

  for (const attachment of attachments) {
    console.log(`- ${attachment.originalFileName} (${attachment.mimeType})`);
    console.log(`  Uploaded by: ${attachment.uploadedBy.displayName}`);
    console.log(`  Size: ${attachment.fileSize} bytes`);
  }
}

/**
 * Example 4: Filter attachments by type and date range
 */
async function filterAttachmentsByTypeAndDate() {
  const userId = 'user-123';
  const threadId = 'thread-456';

  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  const { attachments, total } = await attachmentService.listAttachments(
    {
      threadId,
      category: FileTypeCategory.IMAGE,
      startDate,
      endDate,
      limit: 50
    },
    userId
  );

  console.log(`Found ${total} images from 2024`);
}

/**
 * Example 5: Download an attachment
 */
async function downloadAttachment() {
  const userId = 'user-123';
  const attachmentId = 'attachment-abc';

  const download = await attachmentService.downloadAttachment(attachmentId, userId);

  console.log('Downloading:', download.fileName);
  console.log('MIME type:', download.mimeType);
  console.log('Size:', download.size, 'bytes');

  // In a real HTTP response:
  // res.setHeader('Content-Type', download.mimeType);
  // res.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
  // res.setHeader('Content-Length', download.size);
  // download.stream.pipe(res);
}

/**
 * Example 6: Get and display thumbnail
 */
async function getThumbnail() {
  const userId = 'user-123';
  const attachmentId = 'attachment-abc';

  const thumbnail = await attachmentService.getThumbnail(attachmentId, userId);

  console.log('Thumbnail MIME type:', thumbnail.mimeType);

  // In a real HTTP response:
  // res.setHeader('Content-Type', thumbnail.mimeType);
  // res.setHeader('Cache-Control', 'public, max-age=31536000');
  // thumbnail.stream.pipe(res);
}

/**
 * Example 7: Generate thumbnail for existing attachment
 */
async function generateThumbnailManually() {
  const attachmentId = 'attachment-abc';

  const result = await attachmentService.generateThumbnail(attachmentId);

  console.log('Thumbnail generated at:', result.path);
  console.log('Dimensions:', result.width, 'x', result.height);
}

/**
 * Example 8: Analyze image with AI
 */
async function analyzeImageWithAI() {
  const attachmentId = 'attachment-abc';

  const analysis = await attachmentService.analyzeImage(attachmentId);

  console.log('Analysis Results:');
  console.log('Description:', analysis.description);
  console.log('Detected Objects:', analysis.objects);
  console.log('Labels:', analysis.labels);
  console.log('Extracted Text (OCR):', analysis.text);
}

/**
 * Example 9: Extract text from image (OCR only)
 */
async function extractTextFromImage() {
  const attachmentId = 'attachment-abc';

  const text = await attachmentService.extractText(attachmentId);

  console.log('Extracted text:', text);
}

/**
 * Example 10: Get image metadata (EXIF)
 */
async function getImageMetadata() {
  const attachmentId = 'attachment-abc';

  const metadata = await attachmentService.getImageMetadata(attachmentId);

  console.log('Image Info:', metadata.imageInfo);
  console.log('EXIF Data:', metadata.exif);
  console.log('Dominant Color:', metadata.dominantColor);

  if (metadata.exif?.gps) {
    console.log('GPS Location:', metadata.exif.gps.latitude, metadata.exif.gps.longitude);
  }
}

/**
 * Example 11: Update attachment metadata
 */
async function updateAttachmentMetadata() {
  const userId = 'user-123';
  const attachmentId = 'attachment-abc';

  const updatedAttachment = await attachmentService.updateMetadata(
    attachmentId,
    userId,
    {
      tags: ['important', 'reference'],
      category: 'work',
      description: 'Updated description',
      customField: 'custom value'
    }
  );

  console.log('Metadata updated:', updatedAttachment.metadata);
}

/**
 * Example 12: Get user storage statistics
 */
async function getUserStorageStats() {
  const userId = 'user-123';

  const stats = await attachmentService.getAttachmentStats(userId);

  console.log('Storage Statistics:');
  console.log('Total Files:', stats.totalFiles);
  console.log('Total Size:', stats.totalSizeFormatted);
  console.log('Quota:', stats.quotaFormatted);
  console.log('Usage:', stats.usagePercent.toFixed(2) + '%');
  console.log('\nBreakdown by Type:');

  for (const [type, info] of Object.entries(stats.filesByType)) {
    console.log(`- ${type}: ${info.count} files, ${info.sizeBytes} bytes`);
  }
}

/**
 * Example 13: Delete an attachment
 */
async function deleteAttachment() {
  const userId = 'user-123';
  const attachmentId = 'attachment-abc';

  await attachmentService.deleteAttachment(attachmentId, userId);

  console.log('Attachment deleted successfully');
}

/**
 * Example 14: Upload image with privacy (strip EXIF metadata)
 */
async function uploadImageWithPrivacy() {
  const userId = 'user-123';
  const threadId = 'thread-456';

  const fileBuffer = await fs.readFile('./path/to/photo.jpg');

  const result = await attachmentService.uploadFile(
    {
      buffer: fileBuffer,
      originalname: 'private-photo.jpg',
      mimetype: 'image/jpeg',
      size: fileBuffer.length
    },
    userId,
    {
      threadId,
      stripMetadata: true, // Remove GPS and other EXIF data
      generateThumbnail: true,
      analyzeImage: false
    }
  );

  console.log('Photo uploaded with privacy protection:', result.attachment.id);
}

/**
 * Example 15: Bulk upload multiple files
 */
async function bulkUploadFiles() {
  const userId = 'user-123';
  const threadId = 'thread-456';

  const files = [
    { path: './file1.jpg', name: 'photo1.jpg', mimetype: 'image/jpeg' },
    { path: './file2.png', name: 'screenshot.png', mimetype: 'image/png' },
    { path: './file3.pdf', name: 'document.pdf', mimetype: 'application/pdf' }
  ];

  const results = await Promise.all(
    files.map(async (file) => {
      const buffer = await fs.readFile(file.path);

      return attachmentService.uploadFile(
        {
          buffer,
          originalname: file.name,
          mimetype: file.mimetype,
          size: buffer.length
        },
        userId,
        {
          threadId,
          generateThumbnail: file.mimetype.startsWith('image/'),
          analyzeImage: false
        }
      );
    })
  );

  console.log(`Uploaded ${results.length} files successfully`);
}

/**
 * Example 16: Get specific attachment with error handling
 */
async function getAttachmentWithErrorHandling() {
  const userId = 'user-123';
  const attachmentId = 'attachment-abc';

  try {
    const attachment = await attachmentService.getAttachment(attachmentId, userId);
    console.log('Attachment found:', attachment.originalFileName);

    // Access metadata
    if (attachment.metadata?.tags) {
      console.log('Tags:', attachment.metadata.tags);
    }

    // Check if analyzed
    if (attachment.isAnalyzed) {
      console.log('Analysis:', attachment.analysisResult);
    }

  } catch (error: any) {
    if (error.code === 'ATTACHMENT_NOT_FOUND') {
      console.error('Attachment does not exist');
    } else if (error.code === 'PERMISSION_DENIED') {
      console.error('User does not have permission to access this attachment');
    } else {
      console.error('Error:', error.message);
    }
  }
}

/**
 * Example 17: Search attachments by custom metadata
 */
async function searchAttachmentsByMetadata() {
  const userId = 'user-123';
  const threadId = 'thread-456';

  const { attachments } = await attachmentService.listAttachments(
    { threadId },
    userId
  );

  // Filter by custom metadata (client-side for now)
  const taggedAttachments = attachments.filter(
    attachment => attachment.metadata?.tags?.includes('important')
  );

  console.log(`Found ${taggedAttachments.length} important attachments`);
}

/**
 * Example 18: Using attachment service in an Express route
 */
/*
import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload endpoint
router.post('/threads/:threadId/attachments', upload.single('file'), async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.id; // From auth middleware
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const result = await attachmentService.uploadFile(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      },
      userId,
      {
        threadId,
        generateThumbnail: true,
        analyzeImage: req.body.analyze === 'true'
      }
    );

    res.json({
      id: result.attachment.id,
      fileName: result.attachment.originalFileName,
      size: result.attachment.fileSize,
      mimeType: result.attachment.mimeType,
      thumbnailGenerated: result.thumbnailGenerated,
      analyzed: result.analyzed
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Download endpoint
router.get('/attachments/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const download = await attachmentService.downloadAttachment(id, userId);

    res.setHeader('Content-Type', download.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    res.setHeader('Content-Length', download.size);

    download.stream.pipe(res);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// Thumbnail endpoint
router.get('/attachments/:id/thumbnail', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const thumbnail = await attachmentService.getThumbnail(id, userId);

    res.setHeader('Content-Type', thumbnail.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    thumbnail.stream.pipe(res);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// List attachments endpoint
router.get('/threads/:threadId/attachments', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.id;

    const { attachments, total } = await attachmentService.listAttachments(
      {
        threadId,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0
      },
      userId
    );

    res.json({ attachments, total });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
*/

// Export all examples
export {
  uploadImageWithAnalysis,
  uploadDocumentToMessage,
  listThreadAttachments,
  filterAttachmentsByTypeAndDate,
  downloadAttachment,
  getThumbnail,
  generateThumbnailManually,
  analyzeImageWithAI,
  extractTextFromImage,
  getImageMetadata,
  updateAttachmentMetadata,
  getUserStorageStats,
  deleteAttachment,
  uploadImageWithPrivacy,
  bulkUploadFiles,
  getAttachmentWithErrorHandling,
  searchAttachmentsByMetadata
};
