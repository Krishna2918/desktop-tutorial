import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { AppDataSource } from '../config/data-source';
import { Message } from '../entities/Message';
import { Attachment } from '../entities/Attachment';
import { EmbeddingRecord } from '../entities/EmbeddingRecord';
import { Thread } from '../entities/Thread';

export interface StorageStats {
  totalSizeBytes: number;
  databaseSizeBytes: number;
  attachmentsSizeBytes: number;
  vectorDBSizeBytes: number;
  messageCount: number;
  attachmentCount: number;
  embeddingCount: number;
  quotaBytes: number;
  usagePercent: number;
}

export class StorageService {
  private readonly storagePath: string;
  private readonly quotaGB: number;
  private readonly quotaBytes: number;

  constructor() {
    this.storagePath = process.env.STORAGE_PATH || './data/attachments';
    this.quotaGB = parseInt(process.env.STORAGE_QUOTA_GB || '10');
    this.quotaBytes = this.quotaGB * 1024 * 1024 * 1024; // Convert GB to bytes
  }

  async initialize(): Promise<void> {
    // Ensure storage directory exists
    await fs.mkdir(this.storagePath, { recursive: true });
    console.log(`Storage initialized at: ${this.storagePath}`);
  }

  /**
   * Get current storage usage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const messageRepo = AppDataSource.getRepository(Message);
    const attachmentRepo = AppDataSource.getRepository(Attachment);
    const embeddingRepo = AppDataSource.getRepository(EmbeddingRecord);

    const [messageCount, attachmentCount, embeddingCount] = await Promise.all([
      messageRepo.count(),
      attachmentRepo.count(),
      embeddingRepo.count()
    ]);

    // Calculate database size
    const dbPath = process.env.DATABASE_PATH || './data/app.db';
    let databaseSizeBytes = 0;
    try {
      const dbStat = await fs.stat(dbPath);
      databaseSizeBytes = dbStat.size;
    } catch {
      // Database file might not exist yet
    }

    // Calculate attachments size
    const attachmentsSizeBytes = await this.getDirectorySize(this.storagePath);

    // Estimate vector DB size (approximate)
    const vectorDBSizeBytes = embeddingCount * 1536 * 4; // 1536 dims * 4 bytes per float

    const totalSizeBytes = databaseSizeBytes + attachmentsSizeBytes + vectorDBSizeBytes;
    const usagePercent = (totalSizeBytes / this.quotaBytes) * 100;

    return {
      totalSizeBytes,
      databaseSizeBytes,
      attachmentsSizeBytes,
      vectorDBSizeBytes,
      messageCount,
      attachmentCount,
      embeddingCount,
      quotaBytes: this.quotaBytes,
      usagePercent
    };
  }

  /**
   * Check if storage quota is exceeded
   */
  async isQuotaExceeded(): Promise<boolean> {
    const stats = await this.getStorageStats();
    return stats.totalSizeBytes >= this.quotaBytes;
  }

  /**
   * Check if a file can be added without exceeding quota
   */
  async canAddFile(fileSizeBytes: number): Promise<boolean> {
    const stats = await this.getStorageStats();
    return (stats.totalSizeBytes + fileSizeBytes) < this.quotaBytes;
  }

  /**
   * Archive old threads to free up space
   * Returns number of threads archived
   */
  async archiveOldThreads(olderThanDays: number = 180): Promise<number> {
    const threadRepo = AppDataSource.getRepository(Thread);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const threadsToArchive = await threadRepo
      .createQueryBuilder('thread')
      .where('thread.lastMessageAt < :cutoffDate', { cutoffDate })
      .andWhere('thread.isArchived = :isArchived', { isArchived: false })
      .andWhere('thread.isPinned = :isPinned', { isPinned: false })
      .getMany();

    for (const thread of threadsToArchive) {
      thread.isArchived = true;
      await threadRepo.save(thread);
    }

    console.log(`Archived ${threadsToArchive.length} old threads`);
    return threadsToArchive.length;
  }

  /**
   * Delete attachments for archived threads
   * Returns bytes freed
   */
  async cleanupArchivedThreadAttachments(): Promise<number> {
    const attachmentRepo = AppDataSource.getRepository(Attachment);
    const threadRepo = AppDataSource.getRepository(Thread);

    const archivedThreads = await threadRepo.find({
      where: { isArchived: true },
      select: ['id']
    });

    const archivedThreadIds = archivedThreads.map(t => t.id);

    if (archivedThreadIds.length === 0) {
      return 0;
    }

    const attachments = await attachmentRepo
      .createQueryBuilder('attachment')
      .where('attachment.threadId IN (:...threadIds)', { threadIds: archivedThreadIds })
      .getMany();

    let bytesFreed = 0;

    for (const attachment of attachments) {
      try {
        // Delete file from disk
        await fs.unlink(attachment.filePath);
        if (attachment.thumbnailPath) {
          await fs.unlink(attachment.thumbnailPath);
        }

        bytesFreed += Number(attachment.fileSize);

        // Delete database record
        await attachmentRepo.remove(attachment);
      } catch (error) {
        console.error(`Error deleting attachment ${attachment.id}:`, error);
      }
    }

    console.log(`Cleaned up ${attachments.length} attachments, freed ${this.formatBytes(bytesFreed)}`);
    return bytesFreed;
  }

  /**
   * Prune old embeddings for archived content
   * Returns number of embeddings deleted
   */
  async pruneOldEmbeddings(): Promise<number> {
    const embeddingRepo = AppDataSource.getRepository(EmbeddingRecord);
    const messageRepo = AppDataSource.getRepository(Message);

    // Get messages from archived threads
    const archivedMessages = await messageRepo
      .createQueryBuilder('message')
      .innerJoin('message.thread', 'thread')
      .where('thread.isArchived = :isArchived', { isArchived: true })
      .select('message.id')
      .getMany();

    const archivedMessageIds = archivedMessages.map(m => m.id);

    if (archivedMessageIds.length === 0) {
      return 0;
    }

    // Delete embeddings for archived messages
    const result = await embeddingRepo
      .createQueryBuilder()
      .delete()
      .where('sourceType = :sourceType', { sourceType: 'MESSAGE' })
      .andWhere('sourceId IN (:...sourceIds)', { sourceIds: archivedMessageIds })
      .execute();

    console.log(`Pruned ${result.affected || 0} old embeddings`);
    return result.affected || 0;
  }

  /**
   * Comprehensive cleanup to free space
   * Returns total bytes freed
   */
  async performMaintenance(): Promise<{ bytesFreed: number; threadsArchived: number; embeddingsPruned: number }> {
    console.log('Starting storage maintenance...');

    const threadsArchived = await this.archiveOldThreads();
    const bytesFreed = await this.cleanupArchivedThreadAttachments();
    const embeddingsPruned = await this.pruneOldEmbeddings();

    console.log(`Maintenance complete: ${this.formatBytes(bytesFreed)} freed`);

    return { bytesFreed, threadsArchived, embeddingsPruned };
  }

  /**
   * Get attachment file path for a user and attachment ID
   */
  getAttachmentPath(userId: string, attachmentId: string, fileName: string): string {
    return path.join(this.storagePath, userId, attachmentId, fileName);
  }

  /**
   * Generate a safe file path for an attachment
   */
  async createAttachmentDirectory(userId: string, attachmentId: string): Promise<string> {
    const dirPath = path.join(this.storagePath, userId, attachmentId);
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
  }

  /**
   * Generate a unique filename while preserving extension
   */
  generateUniqueFileName(originalFileName: string): string {
    const ext = path.extname(originalFileName);
    const hash = crypto.randomBytes(8).toString('hex');
    return `${hash}${ext}`;
  }

  /**
   * Calculate directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      let size = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
          size += await this.getDirectorySize(filePath);
        } else {
          const stat = await fs.stat(filePath);
          size += stat.size;
        }
      }

      return size;
    } catch {
      return 0;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportUserData(userId: string, exportPath: string): Promise<string> {
    const messageRepo = AppDataSource.getRepository(Message);
    const threadRepo = AppDataSource.getRepository(Thread);
    const attachmentRepo = AppDataSource.getRepository(Attachment);

    // Get all user data
    const [threads, messages, attachments] = await Promise.all([
      threadRepo.find({
        where: { createdById: userId },
        relations: ['project']
      }),
      messageRepo.find({
        where: { userId },
        relations: ['thread']
      }),
      attachmentRepo.find({
        where: { uploadedById: userId }
      })
    ]);

    // Create export package
    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      threads: threads.map(t => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
        messageCount: t.messageCount
      })),
      messages: messages.map(m => ({
        id: m.id,
        content: m.content,
        role: m.role,
        createdAt: m.createdAt
      })),
      attachments: attachments.map(a => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        uploadedAt: a.uploadedAt
      }))
    };

    // Write to file
    const exportFilePath = path.join(exportPath, `export-${userId}-${Date.now()}.json`);
    await fs.mkdir(exportPath, { recursive: true });
    await fs.writeFile(exportFilePath, JSON.stringify(exportData, null, 2));

    console.log(`User data exported to: ${exportFilePath}`);
    return exportFilePath;
  }

  /**
   * Delete all user data (GDPR compliance)
   */
  async deleteUserData(userId: string): Promise<void> {
    const attachmentRepo = AppDataSource.getRepository(Attachment);

    // Get user attachments
    const attachments = await attachmentRepo.find({
      where: { uploadedById: userId }
    });

    // Delete attachment files
    for (const attachment of attachments) {
      try {
        await fs.unlink(attachment.filePath);
        if (attachment.thumbnailPath) {
          await fs.unlink(attachment.thumbnailPath);
        }
      } catch (error) {
        console.error(`Error deleting attachment file ${attachment.id}:`, error);
      }
    }

    // Database records will be deleted via cascading deletes when user is deleted
    console.log(`Deleted ${attachments.length} attachment files for user ${userId}`);
  }
}

// Singleton instance
export const storageService = new StorageService();
