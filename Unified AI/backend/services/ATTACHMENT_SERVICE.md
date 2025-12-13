# Attachment Service Documentation

## Overview

The Attachment Service provides comprehensive file upload, management, thumbnail generation, and AI-powered image analysis capabilities for the Unified AI Hub. It handles all aspects of file attachments including storage, permissions, metadata extraction, and intelligent image processing.

## Features

- **File Upload & Management**: Upload files with automatic validation, permission checks, and storage quota management
- **Thumbnail Generation**: Automatic thumbnail creation for images with multiple size options
- **AI-Powered Image Analysis**: OCR, object detection, and image description using vision-capable AI providers
- **EXIF Metadata Extraction**: Extract camera information, GPS coordinates, and other metadata from photos
- **Storage Management**: Track storage usage, enforce quotas, and manage user file limits
- **Security**: File type validation, MIME type verification, malicious file detection, and permission-based access
- **Privacy**: Optional EXIF metadata stripping for privacy-sensitive uploads

## Architecture

### Components

1. **AttachmentService** (`attachment.service.ts`) - Main service handling all attachment operations
2. **FileUtil** (`file.util.ts`) - File type detection, MIME validation, and file operations
3. **ImageUtil** (`image.util.ts`) - Image processing, thumbnail generation, and EXIF extraction using Sharp

### Dependencies

- **TypeORM**: Database operations for Attachment entity
- **StorageService**: File system operations and storage management
- **PermissionService**: Access control and permission checks
- **ProviderService**: AI provider integration for image analysis
- **Sharp**: High-performance image processing library

## File Type Support

### Images
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- HEIC/HEIF (.heic, .heif)

### Documents
- PDF (.pdf)
- Plain Text (.txt)
- Markdown (.md)

### Archives
- ZIP (.zip) - Metadata only, no extraction

### Video
- MP4 (.mp4)
- WebM (.webm)

### Audio
- MP3 (.mp3)
- WAV (.wav)

## Core Methods

### File Upload & Management

#### `uploadFile(file, userId, options)`

Upload a file attachment with automatic processing.

**Parameters:**
- `file`: File object with buffer, originalname, mimetype, and size
- `userId`: User ID performing the upload
- `options`: Upload options (optional)
  - `messageId`: Attach to a specific message
  - `threadId`: Attach to a thread
  - `stripMetadata`: Remove EXIF data for privacy (default: false)
  - `generateThumbnail`: Generate thumbnail for images (default: true)
  - `analyzeImage`: Perform AI analysis (default: false)
  - `customMetadata`: Custom metadata object

**Returns:** `Promise<UploadFileResult>`
- `attachment`: Created Attachment entity
- `thumbnailGenerated`: Boolean indicating if thumbnail was created
- `analyzed`: Boolean indicating if AI analysis was performed

**Example:**
```typescript
const result = await attachmentService.uploadFile(
  {
    buffer: fileBuffer,
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: fileBuffer.length
  },
  userId,
  {
    threadId: 'thread-123',
    generateThumbnail: true,
    analyzeImage: true,
    customMetadata: {
      tags: ['vacation', 'summer'],
      location: 'Hawaii'
    }
  }
);
```

#### `getAttachment(attachmentId, userId)`

Retrieve an attachment with permission check.

**Parameters:**
- `attachmentId`: Attachment ID
- `userId`: User ID requesting access

**Returns:** `Promise<Attachment>`

**Throws:**
- `ATTACHMENT_NOT_FOUND` (404): Attachment doesn't exist
- `PERMISSION_DENIED` (403): User lacks read permission

#### `listAttachments(filters, userId)`

List attachments with filtering and pagination.

**Parameters:**
- `filters`: Filter options
  - `threadId`: Filter by thread
  - `messageId`: Filter by message
  - `userId`: Filter by uploader
  - `mimeType`: Filter by MIME type
  - `category`: Filter by file category (IMAGE, DOCUMENT, etc.)
  - `startDate`: Filter by upload date (start)
  - `endDate`: Filter by upload date (end)
  - `limit`: Pagination limit
  - `offset`: Pagination offset
- `userId`: User ID requesting list

**Returns:** `Promise<{ attachments: Attachment[], total: number }>`

**Example:**
```typescript
const { attachments, total } = await attachmentService.listAttachments(
  {
    threadId: 'thread-123',
    category: FileTypeCategory.IMAGE,
    limit: 20,
    offset: 0
  },
  userId
);
```

#### `deleteAttachment(attachmentId, userId)`

Delete an attachment and its associated files.

**Parameters:**
- `attachmentId`: Attachment ID to delete
- `userId`: User ID performing deletion

**Requires:** Owner or delete permission on parent entity

#### `downloadAttachment(attachmentId, userId)`

Get a download stream for an attachment.

**Parameters:**
- `attachmentId`: Attachment ID
- `userId`: User ID requesting download

**Returns:** `Promise<{ stream: Readable, fileName: string, mimeType: string, size: number }>`

**Example:**
```typescript
const download = await attachmentService.downloadAttachment(attachmentId, userId);

// In Express.js:
res.setHeader('Content-Type', download.mimeType);
res.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
res.setHeader('Content-Length', download.size);
download.stream.pipe(res);
```

### Thumbnail Generation

#### `generateThumbnail(attachmentId)`

Generate a thumbnail for an image attachment.

**Parameters:**
- `attachmentId`: Attachment ID

**Returns:** `Promise<{ path: string, width: number, height: number }>`

**Default Settings:**
- Size: 300x300 pixels
- Fit: Cover (crops to fill dimensions)
- Quality: 80%
- Format: JPEG

**Throws:**
- `THUMBNAIL_NOT_SUPPORTED` (400): File type doesn't support thumbnails

#### `getThumbnail(attachmentId, userId)`

Get thumbnail stream for an attachment.

**Parameters:**
- `attachmentId`: Attachment ID
- `userId`: User ID requesting thumbnail

**Returns:** `Promise<{ stream: Readable, mimeType: string }>`

**Auto-regeneration:** If thumbnail is missing, it will be automatically regenerated.

### Image Analysis (AI-Powered)

#### `analyzeImage(attachmentId, providerConfigId?)`

Analyze an image using AI vision capabilities.

**Parameters:**
- `attachmentId`: Attachment ID
- `providerConfigId`: AI provider configuration ID (optional, auto-selects if not provided)

**Returns:** `Promise<ImageAnalysisResult>`
- `description`: Detailed image description
- `objects`: Detected objects with confidence scores
- `text`: Extracted text via OCR
- `labels`: Descriptive tags/labels
- `colors`: Dominant colors (optional)
- `faces`: Face count (optional)

**Requirements:**
- Attachment must be an image
- User must have a configured vision-capable AI provider (e.g., GPT-4 Vision, Claude 3)

**Example:**
```typescript
const analysis = await attachmentService.analyzeImage(attachmentId);

console.log('Description:', analysis.description);
console.log('Objects:', analysis.objects);
console.log('Extracted Text:', analysis.text);
```

#### `extractText(attachmentId, providerConfigId?)`

Extract text from an image using OCR.

**Parameters:**
- `attachmentId`: Attachment ID
- `providerConfigId`: AI provider configuration ID (optional)

**Returns:** `Promise<string>` - Extracted text

#### `getImageMetadata(attachmentId)`

Extract EXIF and other metadata from an image.

**Parameters:**
- `attachmentId`: Attachment ID

**Returns:** `Promise<{ exif?, imageInfo?, dominantColor? }>`
- `exif`: EXIF metadata (camera, GPS, etc.)
- `imageInfo`: Image dimensions, format, size
- `dominantColor`: Dominant RGB color

**Example:**
```typescript
const metadata = await attachmentService.getImageMetadata(attachmentId);

if (metadata.exif?.gps) {
  console.log('Location:', metadata.exif.gps.latitude, metadata.exif.gps.longitude);
}

console.log('Dimensions:', metadata.imageInfo.width, 'x', metadata.imageInfo.height);
console.log('Dominant Color:', metadata.dominantColor);
```

### Metadata Management

#### `updateMetadata(attachmentId, userId, metadata)`

Update custom metadata for an attachment.

**Parameters:**
- `attachmentId`: Attachment ID
- `userId`: User ID performing update
- `metadata`: Metadata object to merge

**Returns:** `Promise<Attachment>`

**Example:**
```typescript
await attachmentService.updateMetadata(
  attachmentId,
  userId,
  {
    tags: ['important', 'reference'],
    category: 'work',
    customField: 'value'
  }
);
```

#### `getAttachmentStats(userId)`

Get storage statistics for a user.

**Parameters:**
- `userId`: User ID

**Returns:** `Promise<UserStorageStats>`
- `totalFiles`: Total number of files
- `totalSizeBytes`: Total size in bytes
- `totalSizeFormatted`: Human-readable total size
- `quotaBytes`: Storage quota in bytes
- `quotaFormatted`: Human-readable quota
- `usagePercent`: Percentage of quota used
- `filesByType`: Breakdown by file category

**Example:**
```typescript
const stats = await attachmentService.getAttachmentStats(userId);

console.log('Usage:', stats.usagePercent.toFixed(2) + '%');
console.log('Total:', stats.totalSizeFormatted, '/', stats.quotaFormatted);
```

## Permission Model

Attachments inherit permissions from their parent entity (Message or Thread):

### Upload
- Requires **write** permission on parent Thread
- Messages inherit permissions from Thread

### View/Download
- Requires **read** permission on parent Thread
- Owner always has access

### Delete
- Requires **delete** permission on parent Thread OR
- Must be the attachment owner (uploader)

### Metadata Update
- Requires **write** permission on parent Thread OR
- Must be the attachment owner

## Security Features

### File Validation
- MIME type validation against whitelist
- Extension validation
- MIME type vs. extension matching
- File size limits (configurable via `MAX_ATTACHMENT_SIZE_MB`)
- Dimension limits for images (max 20,000 pixels)

### Malicious File Detection
- Double extension detection (e.g., `file.exe.jpg`)
- MIME type spoofing detection
- Suspicious file patterns

### Storage Quota
- Per-user storage limits
- Global storage quota enforcement
- Automatic cleanup of archived content

### Privacy
- Optional EXIF metadata stripping
- GPS coordinate removal
- Camera information removal

## Configuration

### Environment Variables

```bash
# Storage configuration
STORAGE_PATH=./data/attachments
MAX_ATTACHMENT_SIZE_MB=100
STORAGE_QUOTA_GB=10
```

### Default Limits

- **Max file size**: 100 MB (configurable)
- **Storage quota**: 10 GB (configurable)
- **Max image dimensions**: 20,000 pixels
- **Thumbnail size**: 300x300 pixels
- **Thumbnail quality**: 80%

## Error Handling

All service methods throw `AttachmentServiceError` with:
- `message`: Human-readable error message
- `code`: Machine-readable error code
- `statusCode`: HTTP status code

### Common Error Codes

- `USER_NOT_FOUND` (404): User doesn't exist
- `MISSING_PARENT` (400): Neither messageId nor threadId provided
- `MESSAGE_NOT_FOUND` (404): Message doesn't exist
- `THREAD_NOT_FOUND` (404): Thread doesn't exist
- `PERMISSION_DENIED` (403): User lacks required permission
- `INVALID_FILE` (400): File validation failed
- `QUOTA_EXCEEDED` (413): Storage quota exceeded
- `SUSPICIOUS_FILE` (400): Potentially malicious file detected
- `ATTACHMENT_NOT_FOUND` (404): Attachment doesn't exist
- `THUMBNAIL_NOT_SUPPORTED` (400): File type doesn't support thumbnails
- `NOT_AN_IMAGE` (400): File is not an image
- `NO_VISION_PROVIDER` (400): No vision-capable AI provider configured
- `ANALYSIS_FAILED` (500): AI analysis failed

## Best Practices

### 1. Always Generate Thumbnails for Images
```typescript
await attachmentService.uploadFile(file, userId, {
  threadId,
  generateThumbnail: true // Enable for images
});
```

### 2. Strip Metadata for Privacy-Sensitive Content
```typescript
await attachmentService.uploadFile(file, userId, {
  threadId,
  stripMetadata: true // Remove EXIF/GPS data
});
```

### 3. Use Pagination for Large Lists
```typescript
const { attachments, total } = await attachmentService.listAttachments(
  {
    threadId,
    limit: 20,
    offset: page * 20
  },
  userId
);
```

### 4. Handle Errors Gracefully
```typescript
try {
  const attachment = await attachmentService.getAttachment(id, userId);
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    // Handle permission error
  } else if (error.code === 'ATTACHMENT_NOT_FOUND') {
    // Handle not found
  }
}
```

### 5. Analyze Images Selectively
```typescript
// Only analyze when user explicitly requests it
const analyze = userRequestedAnalysis;

await attachmentService.uploadFile(file, userId, {
  threadId,
  analyzeImage: analyze // AI analysis is expensive
});
```

## Integration Examples

### Express.js Route Handler

See `attachment.service.example.ts` for complete Express.js integration examples including:
- File upload with multer
- Download endpoints
- Thumbnail serving
- List and filter endpoints

### React Component (Frontend)

```typescript
// Upload component
async function uploadFile(file: File, threadId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('analyze', 'true');

  const response = await fetch(`/api/threads/${threadId}/attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });

  return response.json();
}
```

## Performance Considerations

### Thumbnail Generation
- Thumbnails are generated asynchronously
- Use cached thumbnails when available
- Set appropriate cache headers for thumbnail endpoints

### AI Analysis
- AI analysis is expensive (time and cost)
- Only analyze when explicitly requested
- Cache analysis results in attachment metadata
- Consider background job queue for large batches

### Storage Management
- Implement regular cleanup of archived content
- Monitor storage usage and alert when quota exceeded
- Use stream-based downloads for large files

## Future Enhancements

Potential improvements for future versions:
- Video thumbnail extraction
- Audio waveform generation
- PDF text extraction and indexing
- Virus scanning integration
- CDN integration for downloads
- Automatic image optimization
- Background processing queue
- Multi-part upload for large files
- Resume interrupted uploads

## Support

For issues or questions about the Attachment Service, please refer to:
- Main documentation: `/docs`
- API reference: `/api/docs`
- Example code: `attachment.service.example.ts`
