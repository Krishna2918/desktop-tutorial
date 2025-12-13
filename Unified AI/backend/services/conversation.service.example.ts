/**
 * ConversationService Usage Examples
 *
 * This file demonstrates how to use the ConversationService
 * for managing threads, messages, and conversation context.
 */

import {
  conversationService,
  CreateThreadOptions,
  AddMessageOptions,
  ThreadFilters
} from './conversation.service';
import { MessageRole, MessageContentType } from '../entities/Message';
import { TruncationStrategy } from '../utils/context.util';

/**
 * Example 1: Creating a new conversation thread
 */
async function createConversationThread() {
  const threadOptions: CreateThreadOptions = {
    projectId: 'project-uuid-here',
    userId: 'user-uuid-here',
    title: 'Planning Q4 Marketing Strategy',
    tags: ['marketing', 'planning', 'q4-2024'],
    settings: {
      systemPrompt: 'You are a marketing strategy expert.',
      defaultModel: 'gpt-4',
      defaultProvider: 'openai',
      temperature: 0.7,
      maxTokens: 4096
    }
  };

  try {
    const thread = await conversationService.createThread(threadOptions);
    console.log('Created thread:', thread.id);
    return thread;
  } catch (error) {
    console.error('Failed to create thread:', error);
    throw error;
  }
}

/**
 * Example 2: Adding messages to a thread
 */
async function addMessagesToThread(threadId: string, userId: string) {
  // Add user message
  const userMessageOptions: AddMessageOptions = {
    threadId,
    userId,
    content: 'What are the key trends in digital marketing for Q4 2024?',
    role: MessageRole.USER,
    metadata: {
      important: true,
      category: 'question'
    }
  };

  try {
    const userMessage = await conversationService.addMessage(userMessageOptions);
    console.log('Added user message:', userMessage.id);

    // Add assistant response
    const assistantMessageOptions: AddMessageOptions = {
      threadId,
      userId,
      content: 'Based on current trends, here are the key digital marketing trends for Q4 2024:\n\n' +
        '1. AI-powered personalization\n' +
        '2. Short-form video content\n' +
        '3. Voice search optimization\n' +
        '4. Sustainable and ethical marketing\n' +
        '5. Interactive content experiences',
      role: MessageRole.ASSISTANT,
      providerId: 'openai',
      model: 'gpt-4',
      metadata: {
        finishReason: 'stop',
        promptTokens: 150,
        completionTokens: 85
      }
    };

    const assistantMessage = await conversationService.addMessage(assistantMessageOptions);
    console.log('Added assistant message:', assistantMessage.id);

    return { userMessage, assistantMessage };
  } catch (error) {
    console.error('Failed to add messages:', error);
    throw error;
  }
}

/**
 * Example 3: Listing threads with filters
 */
async function listProjectThreads(projectId: string, userId: string) {
  // Get all pinned threads
  const pinnedFilters: ThreadFilters = {
    isPinned: true,
    isArchived: false
  };

  const pinnedThreads = await conversationService.listThreads(
    projectId,
    userId,
    pinnedFilters
  );

  console.log(`Found ${pinnedThreads.length} pinned threads`);

  // Get threads by tags
  const marketingFilters: ThreadFilters = {
    tags: ['marketing'],
    isArchived: false,
    createdAfter: new Date('2024-01-01')
  };

  const marketingThreads = await conversationService.listThreads(
    projectId,
    userId,
    marketingFilters
  );

  console.log(`Found ${marketingThreads.length} marketing threads`);

  return { pinnedThreads, marketingThreads };
}

/**
 * Example 4: Getting conversation context for AI
 */
async function getConversationContext(threadId: string) {
  try {
    // Get context with automatic truncation
    const context = await conversationService.getThreadContext(
      threadId,
      8000, // Max 8000 tokens
      {
        model: 'gpt-4',
        providerKey: 'openai',
        truncationStrategy: TruncationStrategy.OLDEST_FIRST
      }
    );

    console.log(`Context has ${context.length} messages`);

    // Estimate total tokens
    const totalTokens = await conversationService.estimateContextTokens(
      context,
      'gpt-4',
      'openai'
    );

    console.log(`Total tokens: ${totalTokens}`);

    return context;
  } catch (error) {
    console.error('Failed to get context:', error);
    throw error;
  }
}

/**
 * Example 5: Searching messages
 */
async function searchConversationHistory(userId: string) {
  try {
    const results = await conversationService.searchMessages(
      userId,
      'marketing strategy digital trends',
      {
        roles: [MessageRole.USER, MessageRole.ASSISTANT],
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date()
        }
      }
    );

    console.log(`Found ${results.length} matching messages`);

    results.forEach((result, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`  Rank: ${result.rank}`);
      console.log(`  Snippet: ${result.snippet}`);
      console.log(`  Created: ${result.entity.createdAt}`);
    });

    return results;
  } catch (error) {
    console.error('Failed to search messages:', error);
    throw error;
  }
}

/**
 * Example 6: Managing thread lifecycle
 */
async function manageThreadLifecycle(threadId: string, userId: string) {
  try {
    // Pin thread
    await conversationService.pinThread(threadId, userId, true);
    console.log('Thread pinned');

    // Update thread metadata
    await conversationService.updateThread(threadId, userId, {
      title: 'Q4 Marketing Strategy - Updated',
      tags: ['marketing', 'planning', 'q4-2024', 'in-progress'],
      settings: {
        temperature: 0.8
      }
    });
    console.log('Thread updated');

    // Get thread stats
    const stats = await conversationService.getThreadStats(threadId);
    console.log('Thread stats:', {
      messages: stats.messageCount,
      tokens: stats.totalTokens,
      providers: stats.providers,
      duration: `${Math.floor(stats.conversationDuration! / 1000 / 60)} minutes`
    });

    // Generate summary
    const summary = await conversationService.summarizeThread(threadId);
    console.log('Thread summary:', summary);

    // Archive thread when done
    await conversationService.archiveThread(threadId, userId);
    console.log('Thread archived');
  } catch (error) {
    console.error('Failed to manage thread:', error);
    throw error;
  }
}

/**
 * Example 7: Editing and deleting messages
 */
async function editAndDeleteMessages(messageId: string, userId: string) {
  try {
    // Edit a message
    const updatedMessage = await conversationService.editMessage(
      messageId,
      userId,
      'What are the TOP key trends in digital marketing for Q4 2024?'
    );
    console.log('Message edited at:', updatedMessage.editedAt);

    // Later, if needed, delete the message
    // await conversationService.deleteMessage(messageId, userId);
    // console.log('Message deleted');
  } catch (error) {
    console.error('Failed to edit/delete message:', error);
    throw error;
  }
}

/**
 * Example 8: Getting user statistics
 */
async function getUserStatistics(userId: string) {
  try {
    const stats = await conversationService.getUserThreadStats(userId);

    console.log('User Statistics:');
    console.log(`  Total Threads: ${stats.totalThreads}`);
    console.log(`  Active Threads: ${stats.activeThreads}`);
    console.log(`  Archived Threads: ${stats.archivedThreads}`);
    console.log(`  Pinned Threads: ${stats.pinnedThreads}`);
    console.log(`  Total Messages: ${stats.totalMessages}`);
    console.log(`  Total Tokens: ${stats.totalTokens}`);
    console.log(`  Avg Messages/Thread: ${stats.averageMessagesPerThread.toFixed(2)}`);
    console.log(`  Providers Used: ${stats.uniqueProviders.join(', ')}`);

    return stats;
  } catch (error) {
    console.error('Failed to get user stats:', error);
    throw error;
  }
}

/**
 * Example 9: Complete conversation flow
 */
async function completeConversationFlow() {
  const userId = 'user-123';
  const projectId = 'project-456';

  try {
    // 1. Create thread
    console.log('\n=== Creating Thread ===');
    const thread = await conversationService.createThread({
      projectId,
      userId,
      title: 'AI Assistant Conversation',
      tags: ['ai', 'general'],
      settings: {
        systemPrompt: 'You are a helpful AI assistant.',
        defaultModel: 'gpt-4',
        defaultProvider: 'openai'
      }
    });

    // 2. Add messages
    console.log('\n=== Adding Messages ===');
    await conversationService.addMessage({
      threadId: thread.id,
      userId,
      content: 'Hello! Can you help me understand quantum computing?',
      role: MessageRole.USER
    });

    await conversationService.addMessage({
      threadId: thread.id,
      userId,
      content: 'Of course! Quantum computing is a type of computing that uses quantum mechanics...',
      role: MessageRole.ASSISTANT,
      providerId: 'openai',
      model: 'gpt-4'
    });

    // 3. Get messages
    console.log('\n=== Retrieving Messages ===');
    const messages = await conversationService.getMessages(thread.id, userId);
    console.log(`Retrieved ${messages.length} messages`);

    // 4. Get context for next AI call
    console.log('\n=== Getting Context ===');
    const context = await conversationService.getThreadContext(
      thread.id,
      4000,
      { model: 'gpt-4', providerKey: 'openai' }
    );
    console.log(`Context contains ${context.length} messages`);

    // 5. Get statistics
    console.log('\n=== Getting Statistics ===');
    const threadStats = await conversationService.getThreadStats(thread.id);
    console.log('Thread stats:', threadStats);

    // 6. Pin important thread
    console.log('\n=== Pinning Thread ===');
    await conversationService.pinThread(thread.id, userId, true);

    return thread;
  } catch (error) {
    console.error('Complete flow failed:', error);
    throw error;
  }
}

/**
 * Example 10: Advanced context management
 */
async function advancedContextManagement(threadId: string) {
  try {
    // Get thread with sliding window strategy
    const slidingContext = await conversationService.getThreadContext(
      threadId,
      4000,
      {
        model: 'gpt-4',
        providerKey: 'openai',
        truncationStrategy: TruncationStrategy.SLIDING_WINDOW
      }
    );

    console.log(`Sliding window context: ${slidingContext.length} messages`);

    // Get thread with importance-based strategy
    const importanceContext = await conversationService.getThreadContext(
      threadId,
      4000,
      {
        model: 'gpt-4',
        providerKey: 'openai',
        truncationStrategy: TruncationStrategy.IMPORTANCE_BASED
      }
    );

    console.log(`Importance-based context: ${importanceContext.length} messages`);

    return { slidingContext, importanceContext };
  } catch (error) {
    console.error('Advanced context management failed:', error);
    throw error;
  }
}

// Export examples for testing
export {
  createConversationThread,
  addMessagesToThread,
  listProjectThreads,
  getConversationContext,
  searchConversationHistory,
  manageThreadLifecycle,
  editAndDeleteMessages,
  getUserStatistics,
  completeConversationFlow,
  advancedContextManagement
};

/**
 * Run all examples (for testing)
 */
async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('ConversationService Examples');
  console.log('='.repeat(60));

  try {
    // Note: Replace with actual IDs in production
    const userId = 'example-user-id';
    const projectId = 'example-project-id';

    // Run complete flow
    await completeConversationFlow();

    console.log('\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('\n✗ Examples failed:', error);
  }
}

// Uncomment to run examples
// runAllExamples();
