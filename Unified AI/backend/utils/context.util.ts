/**
 * Context Window Management Utility
 *
 * Handles token counting, context truncation, and context window management
 * for AI conversations across different providers and models.
 */

import { ConversationMessage } from '../adapters/base/AIProviderAdapter.interface';
import { Message, MessageRole } from '../entities/Message';
import { providerRegistry } from '../adapters/ProviderRegistry';

/**
 * Token estimation result
 */
export interface TokenEstimate {
  totalTokens: number;
  messageTokens: Map<string, number>;
  exceeds: boolean;
  limit: number;
}

/**
 * Context truncation strategy
 */
export enum TruncationStrategy {
  /** Remove oldest messages first, keep system message */
  OLDEST_FIRST = 'OLDEST_FIRST',
  /** Keep first N and last M messages */
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  /** Summarize old messages into a system message */
  SUMMARIZE = 'SUMMARIZE',
  /** Keep only the most important messages (highest scoring) */
  IMPORTANCE_BASED = 'IMPORTANCE_BASED'
}

/**
 * Context truncation options
 */
export interface TruncationOptions {
  strategy: TruncationStrategy;
  maxTokens: number;
  model: string;
  providerKey: string;
  /** For SLIDING_WINDOW: number of messages to keep at start */
  keepFirst?: number;
  /** For SLIDING_WINDOW: number of messages to keep at end */
  keepLast?: number;
  /** Always preserve system messages */
  preserveSystemMessages?: boolean;
}

/**
 * Estimate total tokens for a list of messages
 */
export function estimateMessageTokens(
  messages: ConversationMessage[],
  model: string,
  providerKey: string
): TokenEstimate {
  const adapter = providerRegistry.createAdapter(providerKey);

  if (!adapter) {
    throw new Error(`Provider not found: ${providerKey}`);
  }

  const limit = adapter.getContextLimit(model);
  const messageTokens = new Map<string, number>();
  let totalTokens = 0;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // Combine role and content for accurate token counting
    const fullText = `${message.role}: ${message.content}`;
    const tokens = adapter.countTokens(fullText, model);

    messageTokens.set(`${i}`, tokens);
    totalTokens += tokens;
  }

  return {
    totalTokens,
    messageTokens,
    exceeds: totalTokens > limit,
    limit
  };
}

/**
 * Estimate tokens for database Message entities
 */
export function estimateEntityTokens(
  messages: Message[],
  model: string,
  providerKey: string
): TokenEstimate {
  const conversationMessages: ConversationMessage[] = messages.map(m => ({
    role: m.role.toLowerCase() as 'system' | 'user' | 'assistant',
    content: m.content,
    metadata: m.metadata
  }));

  return estimateMessageTokens(conversationMessages, model, providerKey);
}

/**
 * Truncate messages to fit within token limit
 */
export function truncateMessages(
  messages: ConversationMessage[],
  options: TruncationOptions
): ConversationMessage[] {
  const { strategy, maxTokens, model, providerKey, preserveSystemMessages = true } = options;

  const adapter = providerRegistry.createAdapter(providerKey);
  if (!adapter) {
    throw new Error(`Provider not found: ${providerKey}`);
  }

  // Check if truncation is needed
  const estimate = estimateMessageTokens(messages, model, providerKey);
  if (!estimate.exceeds && estimate.totalTokens <= maxTokens) {
    return messages;
  }

  switch (strategy) {
    case TruncationStrategy.OLDEST_FIRST:
      return truncateOldestFirst(messages, maxTokens, model, adapter, preserveSystemMessages);

    case TruncationStrategy.SLIDING_WINDOW:
      return truncateSlidingWindow(
        messages,
        maxTokens,
        model,
        adapter,
        options.keepFirst || 1,
        options.keepLast || 10,
        preserveSystemMessages
      );

    case TruncationStrategy.IMPORTANCE_BASED:
      return truncateByImportance(messages, maxTokens, model, adapter, preserveSystemMessages);

    default:
      return truncateOldestFirst(messages, maxTokens, model, adapter, preserveSystemMessages);
  }
}

/**
 * Truncate by removing oldest messages first
 */
function truncateOldestFirst(
  messages: ConversationMessage[],
  maxTokens: number,
  model: string,
  adapter: any,
  preserveSystemMessages: boolean
): ConversationMessage[] {
  const result: ConversationMessage[] = [];
  const systemMessages: ConversationMessage[] = [];
  const nonSystemMessages: ConversationMessage[] = [];

  // Separate system messages
  for (const message of messages) {
    if (message.role === 'system' && preserveSystemMessages) {
      systemMessages.push(message);
    } else {
      nonSystemMessages.push(message);
    }
  }

  // Calculate system message tokens
  let totalTokens = 0;
  for (const msg of systemMessages) {
    totalTokens += adapter.countTokens(`${msg.role}: ${msg.content}`, model);
  }

  // Add non-system messages from the end (most recent)
  const selectedMessages: ConversationMessage[] = [];
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const message = nonSystemMessages[i];
    const tokens = adapter.countTokens(`${message.role}: ${message.content}`, model);

    if (totalTokens + tokens <= maxTokens) {
      selectedMessages.unshift(message);
      totalTokens += tokens;
    } else {
      break;
    }
  }

  return [...systemMessages, ...selectedMessages];
}

/**
 * Truncate using sliding window (keep first N and last M messages)
 */
function truncateSlidingWindow(
  messages: ConversationMessage[],
  maxTokens: number,
  model: string,
  adapter: any,
  keepFirst: number,
  keepLast: number,
  preserveSystemMessages: boolean
): ConversationMessage[] {
  const systemMessages: ConversationMessage[] = [];
  const nonSystemMessages: ConversationMessage[] = [];

  // Separate system messages
  for (const message of messages) {
    if (message.role === 'system' && preserveSystemMessages) {
      systemMessages.push(message);
    } else {
      nonSystemMessages.push(message);
    }
  }

  if (nonSystemMessages.length <= keepFirst + keepLast) {
    return messages;
  }

  // Get first N and last M messages
  const firstMessages = nonSystemMessages.slice(0, keepFirst);
  const lastMessages = nonSystemMessages.slice(-keepLast);

  const result = [...systemMessages, ...firstMessages, ...lastMessages];

  // Check if it fits
  const estimate = estimateMessageTokens(result, model, adapter.providerKey);
  if (estimate.totalTokens <= maxTokens) {
    return result;
  }

  // If still too large, fall back to oldest first
  return truncateOldestFirst(result, maxTokens, model, adapter, preserveSystemMessages);
}

/**
 * Truncate based on message importance
 * Importance is determined by:
 * - System messages (highest)
 * - Messages with metadata.important = true
 * - Recent messages (decay over time)
 * - Longer messages (more content)
 */
function truncateByImportance(
  messages: ConversationMessage[],
  maxTokens: number,
  model: string,
  adapter: any,
  preserveSystemMessages: boolean
): ConversationMessage[] {
  interface ScoredMessage {
    message: ConversationMessage;
    index: number;
    tokens: number;
    score: number;
  }

  const scoredMessages: ScoredMessage[] = messages.map((message, index) => {
    const tokens = adapter.countTokens(`${message.role}: ${message.content}`, model);

    let score = 0;

    // System messages always get highest priority
    if (message.role === 'system' && preserveSystemMessages) {
      score = 1000;
    } else {
      // Recency score (newer = higher)
      const recencyScore = (index / messages.length) * 50;

      // Length score (longer = more important, but with diminishing returns)
      const lengthScore = Math.min(tokens / 100, 30);

      // Explicit importance marker
      const importanceScore = message.metadata?.important ? 50 : 0;

      // Role score (user questions are important)
      const roleScore = message.role === 'user' ? 20 : 10;

      score = recencyScore + lengthScore + importanceScore + roleScore;
    }

    return { message, index, tokens, score };
  });

  // Sort by score (highest first), but maintain relative order for equal scores
  scoredMessages.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 0.1) {
      return a.index - b.index;
    }
    return b.score - a.score;
  });

  // Select messages until we hit token limit
  const selected: ScoredMessage[] = [];
  let totalTokens = 0;

  for (const scored of scoredMessages) {
    if (totalTokens + scored.tokens <= maxTokens) {
      selected.push(scored);
      totalTokens += scored.tokens;
    }
  }

  // Sort by original index to maintain conversation order
  selected.sort((a, b) => a.index - b.index);

  return selected.map(s => s.message);
}

/**
 * Convert database Message entities to ConversationMessage format
 */
export function convertToConversationMessages(
  messages: Message[]
): ConversationMessage[] {
  return messages
    .filter(m => !m.isDeleted)
    .map(m => ({
      role: m.role.toLowerCase() as 'system' | 'user' | 'assistant',
      content: m.content,
      name: m.user?.email,
      metadata: m.metadata
    }));
}

/**
 * Build context for AI with token management
 */
export interface ContextBuildOptions {
  maxTokens: number;
  model: string;
  providerKey: string;
  truncationStrategy?: TruncationStrategy;
  systemPrompt?: string;
  includeMetadata?: boolean;
}

export function buildContext(
  messages: Message[],
  options: ContextBuildOptions
): ConversationMessage[] {
  const {
    maxTokens,
    model,
    providerKey,
    truncationStrategy = TruncationStrategy.OLDEST_FIRST,
    systemPrompt,
    includeMetadata = false
  } = options;

  // Convert to conversation messages
  let conversationMessages = convertToConversationMessages(messages);

  // Add system prompt if provided
  if (systemPrompt) {
    conversationMessages.unshift({
      role: 'system',
      content: systemPrompt
    });
  }

  // Truncate if needed
  const truncated = truncateMessages(conversationMessages, {
    strategy: truncationStrategy,
    maxTokens,
    model,
    providerKey,
    preserveSystemMessages: true
  });

  // Remove metadata if not needed
  if (!includeMetadata) {
    return truncated.map(m => ({
      role: m.role,
      content: m.content,
      name: m.name
    }));
  }

  return truncated;
}

/**
 * Calculate optimal context window size
 * Leaves room for the response
 */
export function calculateOptimalContextSize(
  totalContextWindow: number,
  maxResponseTokens: number = 4096
): number {
  // Reserve space for response + safety margin (10%)
  const safetyMargin = Math.floor(totalContextWindow * 0.1);
  return totalContextWindow - maxResponseTokens - safetyMargin;
}

/**
 * Get model info for token calculations
 */
export function getModelTokenLimits(
  providerKey: string,
  model: string
): { contextWindow: number; maxOutputTokens: number } {
  const adapter = providerRegistry.createAdapter(providerKey);

  if (!adapter) {
    throw new Error(`Provider not found: ${providerKey}`);
  }

  const contextWindow = adapter.getContextLimit(model);

  // Default max output tokens (can be overridden by model info)
  const maxOutputTokens = Math.min(4096, Math.floor(contextWindow * 0.25));

  return { contextWindow, maxOutputTokens };
}
