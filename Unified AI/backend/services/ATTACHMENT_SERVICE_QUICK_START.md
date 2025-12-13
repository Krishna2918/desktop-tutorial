# Attachment Service - Quick Start Guide

## Installation

The Attachment Service is already integrated into the Unified AI Hub. No additional installation required.

### Dependencies

Ensure these packages are installed (already in package.json):
```bash
npm install sharp typeorm
```

## Basic Usage

### 1. Import the Service

```typescript
import { attachmentService } from './services/attachment.service';
```

### 2. Upload a File

```typescript
// Basic upload to a thread
const result = await attachmentService.uploadFile(
  {
    buffer: fileBuffer,           // File buffer from upload
    originalname: 'photo.jpg',    // Original file name
    mimetype: 'image/jpeg',       // MIME type
    size: fileBuffer.length       // File size in bytes
  },
  userId,                         // User performing upload
  {
    threadId: 'thread-123'        // Parent thread ID
  }
);

console.log('Uploaded:', result.attachment.id);
```

### 3. Upload with AI Analysis

```typescript
const result = await attachmentService.uploadFile(
  file,
  userId,
  {
    threadId: 'thread-123',
    generateThumbnail: true,      // Auto-generate thumbnail
    analyzeImage: true,           // Run AI analysis
    customMetadata: {
      tags: ['important'],
      category: 'work'
    }
  }
);

// Access AI analysis results
if (result.analyzed) {
  console.log('Description:', result.attachment.analysisResult?.description);
  console.log('Objects:', result.attachment.analysisResult?.objects);
  console.log('Text:', result.attachment.analysisResult?.text);
}
```

### 4. List Attachments

```typescript
const { attachments, total } = await attachmentService.listAttachments(
  {
    threadId: 'thread-123',
    limit: 20,
    offset: 0
  },
  userId
);

for (const attachment of attachments) {
  console.log(attachment.originalFileName, attachment.fileSize);
}
```

### 5. Download an Attachment

```typescript
const download = await attachmentService.downloadAttachment(attachmentId, userId);

// In Express.js:
res.setHeader('Content-Type', download.mimeType);
res.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
download.stream.pipe(res);
```

### 6. Get Thumbnail

```typescript
const thumbnail = await attachmentService.getThumbnail(attachmentId, userId);

// In Express.js:
res.setHeader('Content-Type', thumbnail.mimeType);
res.setHeader('Cache-Control', 'public, max-age=31536000');
thumbnail.stream.pipe(res);
```

## Express.js Integration

### Upload Route with Multer

```typescript
import express from 'express';
import multer from 'multer';
import { attachmentService } from './services/attachment.service';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/threads/:threadId/attachments', 
  upload.single('file'),
  async (req, res) => {
    try {
      const { threadId } = req.params;
      const userId = req.user.id; // From auth middleware

      const result = await attachmentService.uploadFile(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
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
        thumbnailGenerated: result.thumbnailGenerated,
        analyzed: result.analyzed
      });
    } catch (error) {
      res.status(error.statusCode || 500).json({ 
        error: error.message 
      });
    }
  }
);

export default router;
```

### Download Route

```typescript
router.get('/attachments/:id/download', async (req, res) => {
  try {
    const download = await attachmentService.downloadAttachment(
      req.params.id,
      req.user.id
    );

    res.setHeader('Content-Type', download.mimeType);
    res.setHeader('Content-Disposition', 
      `attachment; filename="${download.fileName}"`);
    res.setHeader('Content-Length', download.size);

    download.stream.pipe(res);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});
```

## Common Patterns

### Upload Multiple Files

```typescript
const files = [file1, file2, file3];

const results = await Promise.all(
  files.map(file => 
    attachmentService.uploadFile(file, userId, { threadId })
  )
);

console.log(`Uploaded ${results.length} files`);
```

### Filter by Type

```typescript
import { FileTypeCategory } from './utils/file.util';

const { attachments } = await attachmentService.listAttachments(
  {
    threadId,
    category: FileTypeCategory.IMAGE  // Only images
  },
  userId
);
```

### Check Storage Usage

```typescript
const stats = await attachmentService.getAttachmentStats(userId);

console.log(`Using ${stats.usagePercent.toFixed(1)}% of quota`);
console.log(`${stats.totalSizeFormatted} / ${stats.quotaFormatted}`);

if (stats.usagePercent > 90) {
  console.warn('Storage quota almost full!');
}
```

### Privacy-Aware Upload

```typescript
// Strip EXIF/GPS metadata for privacy
const result = await attachmentService.uploadFile(
  file,
  userId,
  {
    threadId,
    stripMetadata: true,  // Remove all metadata
    generateThumbnail: true
  }
);
```

## Error Handling

```typescript
import { AttachmentServiceError } from './services/attachment.service';

try {
  const attachment = await attachmentService.getAttachment(id, userId);
} catch (error) {
  if (error instanceof AttachmentServiceError) {
    switch (error.code) {
      case 'ATTACHMENT_NOT_FOUND':
        console.error('Attachment does not exist');
        break;
      case 'PERMISSION_DENIED':
        console.error('Access denied');
        break;
      case 'QUOTA_EXCEEDED':
        console.error('Storage quota exceeded');
        break;
      default:
        console.error('Error:', error.message);
    }
  }
}
```

## File Type Detection

```typescript
import { FileUtil } from './utils/file.util';

// Check if file type is supported
if (!FileUtil.isAllowedMimeType(file.mimetype)) {
  throw new Error('Unsupported file type');
}

// Check if it's an image
if (FileUtil.isImage(file.mimetype)) {
  console.log('This is an image file');
}

// Format file size
const sizeStr = FileUtil.formatFileSize(file.size);
console.log('File size:', sizeStr);
```

## Image Processing

```typescript
import { ImageUtil } from './utils/image.util';

// Get image info
const info = await ImageUtil.getImageInfo(filePath);
console.log(`${info.width}x${info.height} ${info.format}`);

// Generate custom thumbnail
await ImageUtil.generateThumbnail(
  inputPath,
  outputPath,
  {
    width: 500,
    height: 500,
    fit: 'cover',
    quality: 90
  }
);

// Extract dominant color
const color = await ImageUtil.extractDominantColor(filePath);
console.log(`RGB: ${color.r}, ${color.g}, ${color.b}`);
```

## Configuration

### Environment Variables

```bash
# In .env file
STORAGE_PATH=./data/attachments
MAX_ATTACHMENT_SIZE_MB=100
STORAGE_QUOTA_GB=10
```

### Supported File Types

**Images**: JPG, PNG, GIF, WebP, HEIC
**Documents**: PDF, TXT, MD
**Archives**: ZIP
**Video**: MP4, WebM
**Audio**: MP3, WAV

## API Methods Reference

### File Management
- `uploadFile(file, userId, options)` - Upload file
- `getAttachment(id, userId)` - Get attachment
- `listAttachments(filters, userId)` - List with filters
- `deleteAttachment(id, userId)` - Delete attachment
- `downloadAttachment(id, userId)` - Get download stream
- `updateMetadata(id, userId, metadata)` - Update metadata

### Thumbnails
- `generateThumbnail(id)` - Generate thumbnail
- `getThumbnail(id, userId)` - Get thumbnail stream

### AI Analysis
- `analyzeImage(id, providerId?)` - Full AI analysis
- `extractText(id, providerId?)` - OCR only
- `getImageMetadata(id)` - EXIF data

### Statistics
- `getAttachmentStats(userId)` - Storage stats

## Next Steps

1. See `attachment.service.example.ts` for 18+ detailed examples
2. Read `ATTACHMENT_SERVICE.md` for complete documentation
3. Check `attachment.service.test.ts` for testing patterns
4. Integrate with your Express.js routes

## Support

For issues or questions:
- Check the full documentation in `ATTACHMENT_SERVICE.md`
- Review examples in `attachment.service.example.ts`
- See test patterns in `attachment.service.test.ts`
