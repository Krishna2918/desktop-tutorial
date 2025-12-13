/**
 * Conversation Service
 *
 * Comprehensive service for managing conversation threads and messages.
 * Handles thread lifecycle, message management, context management,
 * and analytics with full permission checking and data sharing policies.
 */

import { Repository, DataSource, In, IsNull, Not } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { Thread } from '../entities/Thread';
import { Message, MessageRole, MessageContentType } from '../entities/Message';
import { Project } from '../entities/Project';
import { DataSharingPolicy } from '../entities/DataSharingPolicy';
import { permissionService, PermissionAction } from './permission.service';
import { providerService } from './provider.service';
import { PermissionEntityType } from '../entities/PermissionSet';
import {
  buildContext,
  estimateEntityTokens,
  truncateMessages,
  TruncationStrategy,
  convertToConversationMessages,
  getModelTokenLimits,
  calculateOptimalContextSize
} from '../utils/context.util';
import {
  searchMessages,
  countSearchResults,
  SearchOptions,
  SearchResult
} from '../utils/search.util';
import { ConversationMessage } from '../adapters/base/AIProviderAdapter.interface';

/**
 * Thread creation options
 */
export interface CreateThreadOptions {
  projectId: string;
  userId: string;
  title: string;
  settings?: {
    systemPrompt?: string;
    defaultModel?: string;
    defaultProvider?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  };
  tags?: string[];
}

/**
 * Thread update options
 */
export interface UpdateThreadOptions {
  title?: string;
  tags?: string[];
  settings?: Record<string, any>;
  summary?: string;
}

/**
 * Thread list filters
 */
export interface ThreadFilters {
  isPinned?: boolean;
  isArchived?: boolean;
  tags?: string[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Add message options
 */
export interface AddMessageOptions {
  threadId: string;
  userId: string;
  content: string;
  role: MessageRole;
  metadata?: Record<string, any>;
  providerId?: string;
  model?: string;
  contentType?: MessageContentType;
  parentId?: string;
}

/**
 * Search filters
 */
export interface MessageSearchFilters {
  threadIds?: string[];
  roles?: MessageRole[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  hasAttachments?: boolean;
  providers?: string[];
}

/**
 * Thread statistics
 */
export interface ThreadStats {
  messageCount: number;
  totalTokens: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  providers: string[];
  models: string[];
  averageTokensPerMessage: number;
  firstMessageAt?: Date;
  lastMessageAt?: Date;
  conversationDuration?: number; // milliseconds
}

/**
 * User thread statistics
 */
export interface UserThreadStats {
  totalThreads: number;
  activeThreads: number;
  archivedThreads: number;
  pinnedThreads: number;
  totalMessages: number;
  totalTokens: number;
  uniqueProviders: string[];
  averageMessagesPerThread: number;
}

/**
 * Conversation Service Error
 */
export class ConversationServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ConversationServiceError';
  }
}

/**
 * Conversation Service
 */
export class ConversationService {
  private threadRepository: Repository<Thread>;
  private messageRepository: Repository<Message>;
  private projectRepository: Repository<Project>;
  private dataSharingRepository: Repository<DataSharingPolicy>;
  private dataSource: DataSource;

  constructor() {
    this.dataSource = AppDataSource;
    this.threadRepository = this.dataSource.getRepository(Thread);
    this.messageRepository = this.dataSource.getRepository(Message);
    this.projectRepository = this.dataSource.getRepository(Project);
    this.dataSharingRepository = this.dataSource.getRepository(DataSharingPolicy);
  }

  // ============================================================================
  // THREAD MANAGEMENT
  // ============================================================================

  /**
   * Create a new conversation thread
   */
  async createThread(options: CreateThreadOptions): Promise<Thread> {
    const { projectId, userId, title, settings, tags } = options;

    // Validate inputs
    if (!projectId || !userId || !title) {
      throw new ConversationServiceError(
        'projectId, userId, and title are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check if project exists
    const project = await this.projectRepository.findOne({
      where: { id: projectId }
    });

    if (!project) {
      throw new ConversationServiceError(
        `Project not found: ${projectId}`,
        'PROJECT_NOT_FOUND',
        404
      );
    }

    // Check if user has write permission on project
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.PROJECT,
      projectId,
      'write'
    );

    if (!canWrite) {
      throw new ConversationServiceError(
        'Insufficient permissions to create thread in this project',
        'PERMISSION_DENIED',
        403
      );
    }

    // Create thread
    const thread = this.threadRepository.create({
      projectId,
      createdById: userId,
      title: title.trim(),
      tags: tags || [],
      contextSettings: settings || {},
      isPinned: false,
      isArchived: false,
      messageCount: 0,
      participatingProviders: []
    });

    const savedThread = await this.threadRepository.save(thread);

    return savedThread;
  }

  /**
   * Get a thread by ID with permission check
   */
  async getThread(threadId: string, userId: string): Promise<Thread> {
    if (!threadId || !userId) {
      throw new ConversationServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canRead = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'read'
    );

    if (!canRead) {
      throw new ConversationServiceError(
        'Insufficient permissions to access this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: ['project', 'createdBy']
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    return thread;
  }

  /**
   * List threads with filtering
   */
  async listThreads(
    projectId: string,
    userId: string,
    filters: ThreadFilters = {}
  ): Promise<Thread[]> {
    if (!projectId || !userId) {
      throw new ConversationServiceError(
        'projectId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check project permission
    const canRead = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.PROJECT,
      projectId,
      'read'
    );

    if (!canRead) {
      throw new ConversationServiceError(
        'Insufficient permissions to access this project',
        'PERMISSION_DENIED',
        403
      );
    }

    // Build query
    const queryBuilder = this.threadRepository
      .createQueryBuilder('thread')
      .where('thread.projectId = :projectId', { projectId })
      .leftJoinAndSelect('thread.createdBy', 'createdBy');

    // Apply filters
    if (filters.isPinned !== undefined) {
      queryBuilder.andWhere('thread.isPinned = :isPinned', {
        isPinned: filters.isPinned
      });
    }

    if (filters.isArchived !== undefined) {
      queryBuilder.andWhere('thread.isArchived = :isArchived', {
        isArchived: filters.isArchived
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      // SQLite JSON query
      const tagConditions = filters.tags.map(
        (tag, idx) => `json_extract(thread.tags, '$[${idx}]') = :tag${idx}`
      );

      filters.tags.forEach((tag, idx) => {
        queryBuilder.setParameter(`tag${idx}`, tag);
      });
    }

    if (filters.search) {
      queryBuilder.andWhere('thread.title LIKE :search', {
        search: `%${filters.search}%`
      });
    }

    if (filters.createdAfter) {
      queryBuilder.andWhere('thread.createdAt >= :createdAfter', {
        createdAfter: filters.createdAfter
      });
    }

    if (filters.createdBefore) {
      queryBuilder.andWhere('thread.createdAt <= :createdBefore', {
        createdBefore: filters.createdBefore
      });
    }

    // Order by pinned first, then most recent
    queryBuilder.orderBy('thread.isPinned', 'DESC');
    queryBuilder.addOrderBy('thread.lastMessageAt', 'DESC', 'NULLS LAST');
    queryBuilder.addOrderBy('thread.createdAt', 'DESC');

    const threads = await queryBuilder.getMany();

    return threads;
  }

  /**
   * Update thread metadata
   */
  async updateThread(
    threadId: string,
    userId: string,
    updates: UpdateThreadOptions
  ): Promise<Thread> {
    if (!threadId || !userId) {
      throw new ConversationServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'write'
    );

    if (!canWrite) {
      throw new ConversationServiceError(
        'Insufficient permissions to update this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Apply updates
    if (updates.title !== undefined) {
      thread.title = updates.title.trim();
    }

    if (updates.tags !== undefined) {
      thread.tags = updates.tags;
    }

    if (updates.settings !== undefined) {
      thread.contextSettings = {
        ...thread.contextSettings,
        ...updates.settings
      };
    }

    if (updates.summary !== undefined) {
      thread.summary = updates.summary;
    }

    const updatedThread = await this.threadRepository.save(thread);

    return updatedThread;
  }

  /**
   * Archive a thread
   */
  async archiveThread(threadId: string, userId: string): Promise<Thread> {
    if (!threadId || !userId) {
      throw new ConversationServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'write'
    );

    if (!canWrite) {
      throw new ConversationServiceError(
        'Insufficient permissions to archive this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    thread.isArchived = true;
    thread.isPinned = false; // Unpin when archiving

    const updatedThread = await this.threadRepository.save(thread);

    return updatedThread;
  }

  /**
   * Delete a thread (soft delete)
   */
  async deleteThread(threadId: string, userId: string): Promise<void> {
    if (!threadId || !userId) {
      throw new ConversationServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canDelete = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'delete'
    );

    if (!canDelete) {
      throw new ConversationServiceError(
        'Insufficient permissions to delete this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Soft delete all messages in thread
    await this.messageRepository.update(
      { threadId },
      {
        isDeleted: true,
        deletedAt: new Date()
      }
    );

    // Hard delete thread (will cascade delete messages due to foreign key)
    await this.threadRepository.remove(thread);
  }

  /**
   * Pin or unpin a thread
   */
  async pinThread(
    threadId: string,
    userId: string,
    pinned: boolean
  ): Promise<Thread> {
    if (!threadId || !userId) {
      throw new ConversationServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'write'
    );

    if (!canWrite) {
      throw new ConversationServiceError(
        'Insufficient permissions to pin/unpin this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    thread.isPinned = pinned;

    const updatedThread = await this.threadRepository.save(thread);

    return updatedThread;
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  /**
   * Add a message to a thread
   */
  async addMessage(options: AddMessageOptions): Promise<Message> {
    const {
      threadId,
      userId,
      content,
      role,
      metadata,
      providerId,
      model,
      contentType = MessageContentType.TEXT,
      parentId
    } = options;

    // Validate inputs
    if (!threadId || !userId || !content || !role) {
      throw new ConversationServiceError(
        'threadId, userId, content, and role are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'write'
    );

    if (!canWrite) {
      throw new ConversationServiceError(
        'Insufficient permissions to add message to this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    // Get thread
    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Estimate token count (if provider and model are available)
    let tokenCount = 0;
    if (providerId && model) {
      try {
        const adapter = await this.getProviderAdapter(providerId);
        if (adapter) {
          tokenCount = adapter.countTokens(content, model);
        }
      } catch (error) {
        // If token counting fails, just log and continue
        console.warn('Failed to count tokens:', error);
      }
    }

    // Create message
    const message = this.messageRepository.create({
      threadId,
      userId,
      content: content.trim(),
      role,
      contentType,
      metadata,
      providerId,
      model,
      tokenCount,
      parentId,
      isDeleted: false
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update thread metadata
    await this.updateThreadMetadata(threadId, providerId);

    return savedMessage;
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: string,
    userId: string,
    newContent: string
  ): Promise<Message> {
    if (!messageId || !userId || !newContent) {
      throw new ConversationServiceError(
        'messageId, userId, and newContent are required',
        'INVALID_INPUT',
        400
      );
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId }
    });

    if (!message) {
      throw new ConversationServiceError(
        `Message not found: ${messageId}`,
        'MESSAGE_NOT_FOUND',
        404
      );
    }

    // Check permission on thread
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      message.threadId,
      'write'
    );

    if (!canWrite) {
      throw new ConversationServiceError(
        'Insufficient permissions to edit this message',
        'PERMISSION_DENIED',
        403
      );
    }

    // Only allow editing own messages
    if (message.userId !== userId) {
      throw new ConversationServiceError(
        'You can only edit your own messages',
        'PERMISSION_DENIED',
        403
      );
    }

    // Update content
    message.content = newContent.trim();
    message.editedAt = new Date();

    // Recalculate token count if possible
    if (message.providerId && message.model) {
      try {
        const adapter = await this.getProviderAdapter(message.providerId);
        if (adapter) {
          message.tokenCount = adapter.countTokens(newContent, message.model);
        }
      } catch (error) {
        console.warn('Failed to recount tokens:', error);
      }
    }

    const updatedMessage = await this.messageRepository.save(message);

    return updatedMessage;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!messageId || !userId) {
      throw new ConversationServiceError(
        'messageId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId }
    });

    if (!message) {
      throw new ConversationServiceError(
        `Message not found: ${messageId}`,
        'MESSAGE_NOT_FOUND',
        404
      );
    }

    // Check permission
    const canDelete = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      message.threadId,
      'delete'
    );

    if (!canDelete) {
      throw new ConversationServiceError(
        'Insufficient permissions to delete this message',
        'PERMISSION_DENIED',
        403
      );
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();

    await this.messageRepository.save(message);

    // Update thread message count
    await this.updateThreadMetadata(message.threadId);
  }

  /**
   * Get messages from a thread with pagination
   */
  async getMessages(
    threadId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    if (!threadId || !userId) {
      throw new ConversationServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check permission
    const canRead = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'read'
    );

    if (!canRead) {
      throw new ConversationServiceError(
        'Insufficient permissions to read messages from this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    const messages = await this.messageRepository.find({
      where: {
        threadId,
        isDeleted: false
      },
      relations: ['user'],
      order: {
        createdAt: 'ASC'
      },
      take: limit,
      skip: offset
    });

    return messages;
  }

  /**
   * Get a single message by ID
   */
  async getMessageById(messageId: string, userId: string): Promise<Message> {
    if (!messageId || !userId) {
      throw new ConversationServiceError(
        'messageId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['user', 'thread']
    });

    if (!message) {
      throw new ConversationServiceError(
        `Message not found: ${messageId}`,
        'MESSAGE_NOT_FOUND',
        404
      );
    }

    // Check permission
    const canRead = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      message.threadId,
      'read'
    );

    if (!canRead) {
      throw new ConversationServiceError(
        'Insufficient permissions to read this message',
        'PERMISSION_DENIED',
        403
      );
    }

    return message;
  }

  /**
   * Search messages with full-text search
   */
  async searchMessages(
    userId: string,
    query: string,
    filters: MessageSearchFilters = {}
  ): Promise<SearchResult<Message>[]> {
    if (!userId || !query) {
      throw new ConversationServiceError(
        'userId and query are required',
        'INVALID_INPUT',
        400
      );
    }

    // Build search options
    const searchOptions: SearchOptions = {
      limit: 50,
      offset: 0,
      userId
    };

    if (filters.dateRange) {
      searchOptions.dateRange = filters.dateRange;
    }

    // If specific threads are provided, search within those
    if (filters.threadIds && filters.threadIds.length > 0) {
      // Check permissions for each thread
      const accessibleThreadIds: string[] = [];

      for (const threadId of filters.threadIds) {
        const canRead = await permissionService.canUserAccess(
          userId,
          PermissionEntityType.THREAD,
          threadId,
          'read'
        );

        if (canRead) {
          accessibleThreadIds.push(threadId);
        }
      }

      if (accessibleThreadIds.length === 0) {
        return [];
      }

      // Search in the first thread only (limitation of current search implementation)
      // For multiple threads, we'd need to run multiple searches and merge results
      searchOptions.threadId = accessibleThreadIds[0];
    }

    // Perform search
    const results = await searchMessages(this.dataSource, query, searchOptions);

    // Filter by role if specified
    if (filters.roles && filters.roles.length > 0) {
      return results.filter(r =>
        filters.roles!.includes(r.entity.role)
      );
    }

    return results;
  }

  // ============================================================================
  // CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Get thread context for AI with token management
   */
  async getThreadContext(
    threadId: string,
    maxTokens: number,
    options: {
      model?: string;
      providerKey?: string;
      includeAttachments?: boolean;
      truncationStrategy?: TruncationStrategy;
    } = {}
  ): Promise<ConversationMessage[]> {
    if (!threadId) {
      throw new ConversationServiceError(
        'threadId is required',
        'INVALID_INPUT',
        400
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Get all messages
    const messages = await this.messageRepository.find({
      where: {
        threadId,
        isDeleted: false
      },
      relations: ['user'],
      order: {
        createdAt: 'ASC'
      }
    });

    // Get default provider and model from thread settings or parameters
    const providerKey = options.providerKey ||
      thread.contextSettings?.defaultProvider ||
      'openai';

    const model = options.model ||
      thread.contextSettings?.defaultModel ||
      'gpt-4';

    // Build context
    const context = buildContext(messages, {
      maxTokens,
      model,
      providerKey,
      truncationStrategy: options.truncationStrategy || TruncationStrategy.OLDEST_FIRST,
      systemPrompt: thread.contextSettings?.systemPrompt,
      includeMetadata: false
    });

    return context;
  }

  /**
   * Summarize a thread
   */
  async summarizeThread(threadId: string): Promise<string> {
    if (!threadId) {
      throw new ConversationServiceError(
        'threadId is required',
        'INVALID_INPUT',
        400
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Get all messages
    const messages = await this.messageRepository.find({
      where: {
        threadId,
        isDeleted: false
      },
      order: {
        createdAt: 'ASC'
      }
    });

    if (messages.length === 0) {
      return 'No messages in this conversation.';
    }

    // Generate a simple summary
    const userMessages = messages.filter(m => m.role === MessageRole.USER).length;
    const assistantMessages = messages.filter(m => m.role === MessageRole.ASSISTANT).length;
    const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    const duration = lastMessage.createdAt.getTime() - firstMessage.createdAt.getTime();
    const durationMinutes = Math.floor(duration / 1000 / 60);

    const summary = `Conversation with ${messages.length} messages (${userMessages} from user, ${assistantMessages} from assistant). ` +
      `Total tokens: ${totalTokens}. ` +
      `Duration: ${durationMinutes} minutes. ` +
      `Started: ${firstMessage.createdAt.toISOString()}.`;

    // Update thread summary
    thread.summary = summary;
    await this.threadRepository.save(thread);

    return summary;
  }

  /**
   * Truncate context to fit token limit
   */
  async truncateContext(
    messages: ConversationMessage[],
    maxTokens: number,
    model?: string,
    providerKey?: string
  ): Promise<ConversationMessage[]> {
    const provider = providerKey || 'openai';
    const modelName = model || 'gpt-4';

    return truncateMessages(messages, {
      strategy: TruncationStrategy.OLDEST_FIRST,
      maxTokens,
      model: modelName,
      providerKey: provider
    });
  }

  /**
   * Estimate context tokens
   */
  async estimateContextTokens(
    messages: ConversationMessage[],
    model?: string,
    providerKey?: string
  ): Promise<number> {
    const provider = providerKey || 'openai';
    const modelName = model || 'gpt-4';

    const adapter = await this.getProviderAdapter(provider);

    if (!adapter) {
      throw new ConversationServiceError(
        `Provider not found: ${provider}`,
        'PROVIDER_NOT_FOUND',
        404
      );
    }

    let totalTokens = 0;
    for (const message of messages) {
      const text = `${message.role}: ${message.content}`;
      totalTokens += adapter.countTokens(text, modelName);
    }

    return totalTokens;
  }

  // ============================================================================
  // THREAD ANALYTICS
  // ============================================================================

  /**
   * Get thread statistics
   */
  async getThreadStats(threadId: string): Promise<ThreadStats> {
    if (!threadId) {
      throw new ConversationServiceError(
        'threadId is required',
        'INVALID_INPUT',
        400
      );
    }

    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      throw new ConversationServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Get all messages
    const messages = await this.messageRepository.find({
      where: {
        threadId,
        isDeleted: false
      },
      order: {
        createdAt: 'ASC'
      }
    });

    const messageCount = messages.length;
    const totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
    const userMessages = messages.filter(m => m.role === MessageRole.USER).length;
    const assistantMessages = messages.filter(m => m.role === MessageRole.ASSISTANT).length;
    const systemMessages = messages.filter(m => m.role === MessageRole.SYSTEM).length;

    const providers = [...new Set(messages.map(m => m.providerId).filter(p => p))];
    const models = [...new Set(messages.map(m => m.model).filter(m => m))];

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    const conversationDuration = firstMessage && lastMessage
      ? lastMessage.createdAt.getTime() - firstMessage.createdAt.getTime()
      : 0;

    return {
      messageCount,
      totalTokens,
      userMessages,
      assistantMessages,
      systemMessages,
      providers: providers as string[],
      models: models as string[],
      averageTokensPerMessage: messageCount > 0 ? totalTokens / messageCount : 0,
      firstMessageAt: firstMessage?.createdAt,
      lastMessageAt: lastMessage?.createdAt,
      conversationDuration
    };
  }

  /**
   * Get user's overall thread statistics
   */
  async getUserThreadStats(userId: string): Promise<UserThreadStats> {
    if (!userId) {
      throw new ConversationServiceError(
        'userId is required',
        'INVALID_INPUT',
        400
      );
    }

    // Get all threads created by user
    const threads = await this.threadRepository.find({
      where: { createdById: userId }
    });

    const totalThreads = threads.length;
    const activeThreads = threads.filter(t => !t.isArchived).length;
    const archivedThreads = threads.filter(t => t.isArchived).length;
    const pinnedThreads = threads.filter(t => t.isPinned).length;

    // Get all messages from user's threads
    const threadIds = threads.map(t => t.id);

    let totalMessages = 0;
    let totalTokens = 0;
    const providersSet = new Set<string>();

    if (threadIds.length > 0) {
      const messages = await this.messageRepository.find({
        where: {
          threadId: In(threadIds),
          isDeleted: false
        }
      });

      totalMessages = messages.length;
      totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);

      messages.forEach(m => {
        if (m.providerId) {
          providersSet.add(m.providerId);
        }
      });
    }

    return {
      totalThreads,
      activeThreads,
      archivedThreads,
      pinnedThreads,
      totalMessages,
      totalTokens,
      uniqueProviders: Array.from(providersSet),
      averageMessagesPerThread: totalThreads > 0 ? totalMessages / totalThreads : 0
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Update thread metadata (message count, last message time, providers)
   */
  private async updateThreadMetadata(
    threadId: string,
    newProviderId?: string
  ): Promise<void> {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId }
    });

    if (!thread) {
      return;
    }

    // Count non-deleted messages
    const messageCount = await this.messageRepository.count({
      where: {
        threadId,
        isDeleted: false
      }
    });

    // Get last message
    const lastMessage = await this.messageRepository.findOne({
      where: {
        threadId,
        isDeleted: false
      },
      order: {
        createdAt: 'DESC'
      }
    });

    thread.messageCount = messageCount;
    thread.lastMessageAt = lastMessage?.createdAt;

    // Update participating providers
    if (newProviderId && !thread.participatingProviders.includes(newProviderId)) {
      thread.participatingProviders = [
        ...thread.participatingProviders,
        newProviderId
      ];
    }

    await this.threadRepository.save(thread);
  }

  /**
   * Get provider adapter
   */
  private async getProviderAdapter(providerKey: string): Promise<any> {
    const { providerRegistry } = await import('../adapters/ProviderRegistry');
    return providerRegistry.createAdapter(providerKey);
  }
}

/**
 * Singleton instance
 */
export const conversationService = new ConversationService();
