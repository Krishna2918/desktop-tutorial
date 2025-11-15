/**
 * Conversation Service Index
 *
 * Centralized exports for conversation management functionality.
 */

// Main service
export {
  conversationService,
  ConversationService,
  ConversationServiceError
} from './conversation.service';

// Types and interfaces
export type {
  CreateThreadOptions,
  UpdateThreadOptions,
  ThreadFilters,
  AddMessageOptions,
  MessageSearchFilters,
  ThreadStats,
  UserThreadStats
} from './conversation.service';

// Message entity types
export {
  MessageRole,
  MessageContentType
} from '../entities/Message';

// Context utilities
export {
  estimateMessageTokens,
  estimateEntityTokens,
  truncateMessages,
  convertToConversationMessages,
  buildContext,
  calculateOptimalContextSize,
  getModelTokenLimits,
  TruncationStrategy
} from '../utils/context.util';

export type {
  TokenEstimate,
  TruncationOptions,
  ContextBuildOptions
} from '../utils/context.util';

// Search utilities
export {
  searchMessages,
  countSearchResults,
  searchWithHighlights,
  getSuggestedTerms,
  rebuildMessagesFTSIndex,
  optimizeFTSIndex,
  sanitizeFTS5Query,
  buildPhraseQuery,
  buildBooleanQuery
} from '../utils/search.util';

export type {
  SearchResult,
  SearchOptions,
  BooleanQueryOptions
} from '../utils/search.util';

// Re-export commonly used types from adapter interface
export type {
  ConversationMessage
} from '../adapters/base/AIProviderAdapter.interface';
