import { Repository } from 'typeorm';
import { DataSharingPolicy } from '../entities/DataSharingPolicy';
import { User } from '../entities/User';
import { Session } from '../entities/Session';
import { Message } from '../entities/Message';
import { Document } from '../entities/Document';
import { Attachment } from '../entities/Attachment';
import { AppDataSource } from '../config/data-source';
import { auditService } from './audit.service';
import { AuditAction } from '../entities/AuditLog';

export interface DataSharingPolicyInput {
  providerKey: string;
  allowConversationHistory?: boolean;
  allowAttachments?: boolean;
  allowCrossProviderContext?: boolean;
  retentionDays?: number;
  settings?: Record<string, any>;
}

export interface UserDataExport {
  user: {
    id: string;
    email: string;
    displayName: string;
    createdAt: string;
    lastLoginAt?: string;
  };
  sessions: Array<{
    id: string;
    deviceId?: string;
    createdAt: string;
    lastActivityAt: string;
  }>;
  messages: Array<{
    id: string;
    content: string;
    role: string;
    timestamp: string;
    sessionId: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
  dataSharingPolicies: Array<{
    providerKey: string;
    allowConversationHistory: boolean;
    allowAttachments: boolean;
    allowCrossProviderContext: boolean;
    retentionDays?: number;
    updatedAt: string;
  }>;
  exportedAt: string;
}

/**
 * Privacy Service - Data sharing controls and GDPR compliance
 *
 * Implements privacy-first features:
 * - Per-provider data sharing policies
 * - GDPR right to access (data export)
 * - GDPR right to erasure (data deletion)
 * - Data retention management
 * - Privacy-respecting defaults
 */
export class PrivacyService {
  private dataSharingPolicyRepository: Repository<DataSharingPolicy>;
  private userRepository: Repository<User>;
  private sessionRepository: Repository<Session>;
  private messageRepository: Repository<Message>;
  private documentRepository: Repository<Document>;
  private attachmentRepository: Repository<Attachment>;

  constructor() {
    this.dataSharingPolicyRepository = AppDataSource.getRepository(DataSharingPolicy);
    this.userRepository = AppDataSource.getRepository(User);
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.messageRepository = AppDataSource.getRepository(Message);
    this.documentRepository = AppDataSource.getRepository(Document);
    this.attachmentRepository = AppDataSource.getRepository(Attachment);
  }

  /**
   * Get all data sharing policies for a user
   */
  async getUserDataSharingPolicies(userId: string): Promise<DataSharingPolicy[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const policies = await this.dataSharingPolicyRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' }
    });

    return policies;
  }

  /**
   * Get data sharing policy for a specific provider
   */
  async getDataSharingPolicy(
    userId: string,
    providerKey: string
  ): Promise<DataSharingPolicy | null> {
    if (!userId || !providerKey) {
      throw new Error('User ID and provider key are required');
    }

    const policy = await this.dataSharingPolicyRepository.findOne({
      where: { userId, providerKey }
    });

    return policy;
  }

  /**
   * Set or update data sharing policy for a provider
   */
  async setDataSharingPolicy(
    userId: string,
    input: DataSharingPolicyInput
  ): Promise<DataSharingPolicy> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const {
      providerKey,
      allowConversationHistory = true,
      allowAttachments = true,
      allowCrossProviderContext = false,
      retentionDays,
      settings
    } = input;

    if (!providerKey) {
      throw new Error('Provider key is required');
    }

    // Check if policy exists
    let policy = await this.dataSharingPolicyRepository.findOne({
      where: { userId, providerKey }
    });

    if (policy) {
      // Update existing policy
      policy.allowConversationHistory = allowConversationHistory;
      policy.allowAttachments = allowAttachments;
      policy.allowCrossProviderContext = allowCrossProviderContext;
      policy.retentionDays = retentionDays;
      policy.settings = settings;
    } else {
      // Create new policy
      policy = this.dataSharingPolicyRepository.create({
        userId,
        providerKey,
        allowConversationHistory,
        allowAttachments,
        allowCrossProviderContext,
        retentionDays,
        settings
      });
    }

    const savedPolicy = await this.dataSharingPolicyRepository.save(policy);

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'DataSharingPolicy',
      entityId: savedPolicy.id,
      metadata: {
        providerKey,
        allowConversationHistory,
        allowAttachments,
        allowCrossProviderContext,
        retentionDays
      }
    });

    return savedPolicy;
  }

  /**
   * Check if data sharing is allowed for a specific provider and data type
   */
  async checkDataSharingAllowed(
    userId: string,
    providerKey: string,
    dataType: 'conversationHistory' | 'attachments' | 'crossProviderContext'
  ): Promise<boolean> {
    if (!userId || !providerKey || !dataType) {
      throw new Error('User ID, provider key, and data type are required');
    }

    // Get policy for provider
    const policy = await this.getDataSharingPolicy(userId, providerKey);

    // If no policy exists, use privacy-first defaults
    if (!policy) {
      // Default: allow conversation history and attachments, but not cross-provider context
      switch (dataType) {
        case 'conversationHistory':
          return true;
        case 'attachments':
          return true;
        case 'crossProviderContext':
          return false;
        default:
          return false;
      }
    }

    // Check specific permission
    switch (dataType) {
      case 'conversationHistory':
        return policy.allowConversationHistory;
      case 'attachments':
        return policy.allowAttachments;
      case 'crossProviderContext':
        return policy.allowCrossProviderContext;
      default:
        return false;
    }
  }

  /**
   * Export all user data (GDPR right to access)
   */
  async exportUserData(
    userId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<UserDataExport | string> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get all user data
    const [sessions, messages, documents, attachments, policies] = await Promise.all([
      this.sessionRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' }
      }),
      this.messageRepository.find({
        where: { userId },
        order: { timestamp: 'DESC' }
      }),
      this.documentRepository.find({
        where: { userId },
        order: { uploadedAt: 'DESC' }
      }),
      this.attachmentRepository.find({
        where: { userId },
        order: { uploadedAt: 'DESC' }
      }),
      this.dataSharingPolicyRepository.find({
        where: { userId },
        order: { updatedAt: 'DESC' }
      })
    ]);

    // Format export data
    const exportData: UserDataExport = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString()
      },
      sessions: sessions.map(session => ({
        id: session.id,
        deviceId: session.deviceId,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString()
      })),
      messages: messages.map(message => ({
        id: message.id,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp.toISOString(),
        sessionId: message.sessionId
      })),
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        size: doc.size,
        uploadedAt: doc.uploadedAt.toISOString()
      })),
      attachments: attachments.map(att => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        size: att.size,
        uploadedAt: att.uploadedAt.toISOString()
      })),
      dataSharingPolicies: policies.map(policy => ({
        providerKey: policy.providerKey,
        allowConversationHistory: policy.allowConversationHistory,
        allowAttachments: policy.allowAttachments,
        allowCrossProviderContext: policy.allowCrossProviderContext,
        retentionDays: policy.retentionDays,
        updatedAt: policy.updatedAt.toISOString()
      })),
      exportedAt: new Date().toISOString()
    };

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.EXPORT,
      entityType: 'UserData',
      entityId: userId,
      metadata: {
        format,
        itemCounts: {
          sessions: sessions.length,
          messages: messages.length,
          documents: documents.length,
          attachments: attachments.length
        }
      }
    });

    if (format === 'csv') {
      return this.convertExportToCSV(exportData);
    }

    return exportData;
  }

  /**
   * Delete all user data (GDPR right to erasure / right to be forgotten)
   */
  async deleteUserData(
    userId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    deletedItems: {
      sessions: number;
      messages: number;
      documents: number;
      attachments: number;
      policies: number;
    };
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Audit log before deletion
    await auditService.logAction({
      userId,
      action: AuditAction.DELETE,
      entityType: 'UserData',
      entityId: userId,
      metadata: {
        reason: reason || 'User requested data deletion',
        deletionType: 'complete'
      }
    });

    // Delete all user data in transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Count items before deletion
      const [
        sessionsCount,
        messagesCount,
        documentsCount,
        attachmentsCount,
        policiesCount
      ] = await Promise.all([
        this.sessionRepository.count({ where: { userId } }),
        this.messageRepository.count({ where: { userId } }),
        this.documentRepository.count({ where: { userId } }),
        this.attachmentRepository.count({ where: { userId } }),
        this.dataSharingPolicyRepository.count({ where: { userId } })
      ]);

      // Delete related data (CASCADE should handle most of this, but being explicit)
      await queryRunner.manager.delete(Session, { userId });
      await queryRunner.manager.delete(Message, { userId });
      await queryRunner.manager.delete(Document, { userId });
      await queryRunner.manager.delete(Attachment, { userId });
      await queryRunner.manager.delete(DataSharingPolicy, { userId });

      // Mark user as deleted (soft delete to preserve referential integrity)
      await queryRunner.manager.update(User, userId, {
        isDeleted: true,
        email: `deleted_${userId}@deleted.com`,
        displayName: 'Deleted User',
        passwordHash: '',
        emailVerificationToken: undefined,
        passwordResetToken: undefined
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        deletedItems: {
          sessions: sessionsCount,
          messages: messagesCount,
          documents: documentsCount,
          attachments: attachmentsCount,
          policies: policiesCount
        }
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Apply data retention policy
   * Delete data older than retention period
   */
  async applyDataRetention(userId: string): Promise<{
    deletedMessages: number;
    deletedDocuments: number;
    deletedAttachments: number;
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get all data sharing policies with retention periods
    const policies = await this.dataSharingPolicyRepository.find({
      where: { userId }
    });

    let totalDeletedMessages = 0;
    let totalDeletedDocuments = 0;
    let totalDeletedAttachments = 0;

    for (const policy of policies) {
      if (policy.retentionDays && policy.retentionDays > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // Delete old messages
        const deletedMessages = await this.messageRepository
          .createQueryBuilder()
          .delete()
          .where('userId = :userId', { userId })
          .andWhere('timestamp < :cutoffDate', { cutoffDate })
          .execute();

        totalDeletedMessages += deletedMessages.affected || 0;

        // Delete old documents
        const deletedDocuments = await this.documentRepository
          .createQueryBuilder()
          .delete()
          .where('userId = :userId', { userId })
          .andWhere('uploadedAt < :cutoffDate', { cutoffDate })
          .execute();

        totalDeletedDocuments += deletedDocuments.affected || 0;

        // Delete old attachments
        const deletedAttachments = await this.attachmentRepository
          .createQueryBuilder()
          .delete()
          .where('userId = :userId', { userId })
          .andWhere('uploadedAt < :cutoffDate', { cutoffDate })
          .execute();

        totalDeletedAttachments += deletedAttachments.affected || 0;
      }
    }

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.DELETE,
      entityType: 'RetentionPolicyData',
      entityId: userId,
      metadata: {
        deletedMessages: totalDeletedMessages,
        deletedDocuments: totalDeletedDocuments,
        deletedAttachments: totalDeletedAttachments
      }
    });

    return {
      deletedMessages: totalDeletedMessages,
      deletedDocuments: totalDeletedDocuments,
      deletedAttachments: totalDeletedAttachments
    };
  }

  /**
   * Get privacy dashboard data
   */
  async getPrivacyDashboard(userId: string): Promise<{
    dataSharingPolicies: DataSharingPolicy[];
    dataStats: {
      totalSessions: number;
      totalMessages: number;
      totalDocuments: number;
      totalAttachments: number;
      totalStorageBytes: number;
    };
    retentionSettings: Array<{
      providerKey: string;
      retentionDays?: number;
      oldestData?: Date;
    }>;
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get policies
    const policies = await this.getUserDataSharingPolicies(userId);

    // Get data statistics
    const [sessionsCount, messagesCount, documents, attachments] = await Promise.all([
      this.sessionRepository.count({ where: { userId } }),
      this.messageRepository.count({ where: { userId } }),
      this.documentRepository.find({ where: { userId } }),
      this.attachmentRepository.find({ where: { userId } })
    ]);

    const totalStorageBytes =
      documents.reduce((sum, doc) => sum + doc.size, 0) +
      attachments.reduce((sum, att) => sum + att.size, 0);

    // Get retention settings with oldest data
    const retentionSettings = await Promise.all(
      policies.map(async policy => {
        const oldestMessage = await this.messageRepository.findOne({
          where: { userId },
          order: { timestamp: 'ASC' }
        });

        return {
          providerKey: policy.providerKey,
          retentionDays: policy.retentionDays,
          oldestData: oldestMessage?.timestamp
        };
      })
    );

    return {
      dataSharingPolicies: policies,
      dataStats: {
        totalSessions: sessionsCount,
        totalMessages: messagesCount,
        totalDocuments: documents.length,
        totalAttachments: attachments.length,
        totalStorageBytes
      },
      retentionSettings
    };
  }

  // Private helper methods

  /**
   * Convert export data to CSV format
   */
  private convertExportToCSV(data: UserDataExport): string {
    const sections: string[] = [];

    // User section
    sections.push('USER INFORMATION');
    sections.push('ID,Email,Display Name,Created At,Last Login At');
    sections.push(
      `${data.user.id},${data.user.email},${data.user.displayName},${data.user.createdAt},${data.user.lastLoginAt || ''}`
    );
    sections.push('');

    // Messages section
    sections.push('MESSAGES');
    sections.push('ID,Content,Role,Timestamp,Session ID');
    data.messages.forEach(msg => {
      sections.push(
        `${msg.id},"${msg.content.replace(/"/g, '""')}",${msg.role},${msg.timestamp},${msg.sessionId}`
      );
    });
    sections.push('');

    // Documents section
    sections.push('DOCUMENTS');
    sections.push('ID,File Name,MIME Type,Size,Uploaded At');
    data.documents.forEach(doc => {
      sections.push(
        `${doc.id},${doc.fileName},${doc.mimeType},${doc.size},${doc.uploadedAt}`
      );
    });
    sections.push('');

    // Data sharing policies section
    sections.push('DATA SHARING POLICIES');
    sections.push(
      'Provider Key,Allow Conversation History,Allow Attachments,Allow Cross Provider Context,Retention Days,Updated At'
    );
    data.dataSharingPolicies.forEach(policy => {
      sections.push(
        `${policy.providerKey},${policy.allowConversationHistory},${policy.allowAttachments},${policy.allowCrossProviderContext},${policy.retentionDays || ''},${policy.updatedAt}`
      );
    });

    return sections.join('\n');
  }
}

// Singleton instance
export const privacyService = new PrivacyService();
