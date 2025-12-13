# ConversationService Documentation

Comprehensive service for managing conversation threads and messages in the Unified AI Hub.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Thread Management](#thread-management)
- [Message Management](#message-management)
- [Context Management](#context-management)
- [Analytics](#analytics)
- [Full-Text Search](#full-text-search)
- [Security & Permissions](#security--permissions)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Overview

The ConversationService provides a complete solution for managing AI conversations with support for:

- **Thread Management** - Create, update, archive, pin, and delete conversation threads
- **Message Management** - Add, edit, delete, and retrieve messages with full metadata
- **Context Management** - Intelligent context window management with multiple truncation strategies
- **Analytics** - Thread and user statistics, token usage tracking
- **Full-Text Search** - FTS5-powered search across all messages
- **Permissions** - Integration with permission service for access control
- **Data Policies** - Support for data sharing policies

## Architecture

### Components

```
ConversationService
├── Thread Management (CRUD operations)
├── Message Management (CRUD operations)
├── Context Management (token counting, truncation)
├── Analytics (statistics, summaries)
└── Utilities
    ├── context.util.ts (token management)
    └── search.util.ts (FTS5 search)
```

### Dependencies

- **TypeORM** - Database operations
- **PermissionService** - Access control
- **ProviderService** - AI provider integration
- **ProviderRegistry** - Token counting and model info

## Thread Management

### Create Thread

```typescript
const thread = await conversationService.createThread({
  projectId: 'project-uuid',
  userId: 'user-uuid',
  title: 'Marketing Strategy Discussion',
  tags: ['marketing', 'planning'],
  settings: {
    systemPrompt: 'You are a marketing expert.',
    defaultModel: 'gpt-4',
    defaultProvider: 'openai',
    temperature: 0.7,
    maxTokens: 4096
  }
});
```

### Get Thread

```typescript
const thread = await conversationService.getThread(threadId, userId);
```

### List Threads

```typescript
const threads = await conversationService.listThreads(
  projectId,
  userId,
  {
    isPinned: true,
    isArchived: false,
    tags: ['marketing'],
    search: 'strategy',
    createdAfter: new Date('2024-01-01')
  }
);
```

### Update Thread

```typescript
const updated = await conversationService.updateThread(
  threadId,
  userId,
  {
    title: 'Updated Title',
    tags: ['new', 'tags'],
    settings: { temperature: 0.8 },
    summary: 'Thread summary'
  }
);
```

### Archive Thread

```typescript
await conversationService.archiveThread(threadId, userId);
```

### Delete Thread

```typescript
// Soft delete - marks all messages as deleted
await conversationService.deleteThread(threadId, userId);
```

### Pin Thread

```typescript
// Pin thread
await conversationService.pinThread(threadId, userId, true);

// Unpin thread
await conversationService.pinThread(threadId, userId, false);
```

## Message Management

### Add Message

```typescript
const message = await conversationService.addMessage({
  threadId: 'thread-uuid',
  userId: 'user-uuid',
  content: 'What are the latest AI trends?',
  role: MessageRole.USER,
  metadata: {
    important: true,
    category: 'question'
  }
});
```

### Add Assistant Response

```typescript
const response = await conversationService.addMessage({
  threadId: 'thread-uuid',
  userId: 'user-uuid',
  content: 'Here are the latest AI trends...',
  role: MessageRole.ASSISTANT,
  providerId: 'openai',
  model: 'gpt-4',
  metadata: {
    finishReason: 'stop',
    promptTokens: 150,
    completionTokens: 200
  }
});
```

### Edit Message

```typescript
const edited = await conversationService.editMessage(
  messageId,
  userId,
  'Updated message content'
);
```

### Delete Message

```typescript
// Soft delete
await conversationService.deleteMessage(messageId, userId);
```

### Get Messages

```typescript
// Get messages with pagination
const messages = await conversationService.getMessages(
  threadId,
  userId,
  50,  // limit
  0    // offset
);
```

### Get Single Message

```typescript
const message = await conversationService.getMessageById(messageId, userId);
```

## Context Management

### Get Thread Context

```typescript
const context = await conversationService.getThreadContext(
  threadId,
  8000,  // max tokens
  {
    model: 'gpt-4',
    providerKey: 'openai',
    truncationStrategy: TruncationStrategy.OLDEST_FIRST
  }
);
```

### Truncation Strategies

#### OLDEST_FIRST
Removes oldest messages first, always preserves system messages.

```typescript
TruncationStrategy.OLDEST_FIRST
```

#### SLIDING_WINDOW
Keeps first N and last M messages.

```typescript
TruncationStrategy.SLIDING_WINDOW
```

#### IMPORTANCE_BASED
Keeps most important messages based on:
- System messages (highest priority)
- Messages marked as important
- Recent messages
- User questions

```typescript
TruncationStrategy.IMPORTANCE_BASED
```

### Estimate Tokens

```typescript
const totalTokens = await conversationService.estimateContextTokens(
  conversationMessages,
  'gpt-4',
  'openai'
);
```

### Truncate Context

```typescript
const truncated = await conversationService.truncateContext(
  messages,
  4000,  // max tokens
  'gpt-4',
  'openai'
);
```

### Summarize Thread

```typescript
const summary = await conversationService.summarizeThread(threadId);
// Returns: "Conversation with 15 messages (8 from user, 7 from assistant)..."
```

## Analytics

### Thread Statistics

```typescript
const stats = await conversationService.getThreadStats(threadId);

// Returns:
{
  messageCount: 15,
  totalTokens: 12500,
  userMessages: 8,
  assistantMessages: 7,
  systemMessages: 0,
  providers: ['openai', 'anthropic'],
  models: ['gpt-4', 'claude-3-opus'],
  averageTokensPerMessage: 833.33,
  firstMessageAt: Date,
  lastMessageAt: Date,
  conversationDuration: 3600000  // milliseconds
}
```

### User Statistics

```typescript
const userStats = await conversationService.getUserThreadStats(userId);

// Returns:
{
  totalThreads: 25,
  activeThreads: 18,
  archivedThreads: 7,
  pinnedThreads: 3,
  totalMessages: 450,
  totalTokens: 250000,
  uniqueProviders: ['openai', 'anthropic', 'google'],
  averageMessagesPerThread: 18
}
```

## Full-Text Search

### Search Messages

```typescript
const results = await conversationService.searchMessages(
  userId,
  'AI trends machine learning',
  {
    roles: [MessageRole.USER, MessageRole.ASSISTANT],
    dateRange: {
      from: new Date('2024-01-01'),
      to: new Date()
    },
    threadIds: ['thread-1', 'thread-2']
  }
);

// Each result contains:
{
  id: 'message-uuid',
  rank: 0.85,
  snippet: 'Latest <mark>AI trends</mark> include...',
  entity: Message
}
```

### Advanced Search Features

```typescript
import {
  buildBooleanQuery,
  buildPhraseQuery
} from '../utils/search.util';

// Exact phrase search
const phraseQuery = buildPhraseQuery('machine learning');

// Boolean search
const boolQuery = buildBooleanQuery({
  mustHave: ['AI', 'trends'],
  shouldHave: ['2024', 'future'],
  mustNotHave: ['deprecated']
});
```

## Security & Permissions

All operations check permissions using the PermissionService:

```typescript
// Automatic permission checks
const canRead = await permissionService.canUserAccess(
  userId,
  PermissionEntityType.THREAD,
  threadId,
  'read'
);

const canWrite = await permissionService.canUserAccess(
  userId,
  PermissionEntityType.THREAD,
  threadId,
  'write'
);

const canDelete = await permissionService.canUserAccess(
  userId,
  PermissionEntityType.THREAD,
  threadId,
  'delete'
);
```

### Permission Hierarchy

1. **Owner** - Thread creator has all permissions
2. **Project Permissions** - Inherited from project
3. **Workspace Permissions** - Inherited from workspace
4. **Direct Permissions** - Explicitly granted

## Error Handling

All errors are wrapped in `ConversationServiceError`:

```typescript
try {
  await conversationService.createThread(options);
} catch (error) {
  if (error instanceof ConversationServiceError) {
    console.error(`Error ${error.code}:`, error.message);
    console.error(`HTTP Status:`, error.statusCode);
  }
}
```

### Error Codes

- `INVALID_INPUT` (400) - Missing or invalid parameters
- `PERMISSION_DENIED` (403) - Insufficient permissions
- `THREAD_NOT_FOUND` (404) - Thread doesn't exist
- `MESSAGE_NOT_FOUND` (404) - Message doesn't exist
- `PROJECT_NOT_FOUND` (404) - Project doesn't exist
- `PROVIDER_NOT_FOUND` (404) - AI provider doesn't exist

## Examples

### Complete Conversation Flow

```typescript
// 1. Create thread
const thread = await conversationService.createThread({
  projectId: 'project-id',
  userId: 'user-id',
  title: 'AI Discussion',
  settings: {
    systemPrompt: 'You are a helpful AI assistant.',
    defaultModel: 'gpt-4',
    defaultProvider: 'openai'
  }
});

// 2. Add user message
const userMsg = await conversationService.addMessage({
  threadId: thread.id,
  userId: 'user-id',
  content: 'Explain quantum computing',
  role: MessageRole.USER
});

// 3. Get context for AI
const context = await conversationService.getThreadContext(
  thread.id,
  8000,
  { model: 'gpt-4', providerKey: 'openai' }
);

// 4. Send to AI provider
const response = await providerService.sendMessage(
  configId,
  {
    messages: context,
    model: 'gpt-4',
    temperature: 0.7
  }
);

// 5. Save AI response
await conversationService.addMessage({
  threadId: thread.id,
  userId: 'user-id',
  content: response.content,
  role: MessageRole.ASSISTANT,
  providerId: 'openai',
  model: 'gpt-4',
  metadata: {
    usage: response.usage
  }
});

// 6. Get statistics
const stats = await conversationService.getThreadStats(thread.id);
console.log(`Thread has ${stats.messageCount} messages using ${stats.totalTokens} tokens`);
```

### Message Streaming Support

```typescript
// For streaming responses, save partial chunks
let fullContent = '';

for await (const chunk of providerService.streamMessage(configId, request)) {
  fullContent += chunk.content;

  if (chunk.done) {
    // Save complete message
    await conversationService.addMessage({
      threadId: thread.id,
      userId: 'user-id',
      content: fullContent,
      role: MessageRole.ASSISTANT,
      providerId: 'openai',
      model: 'gpt-4',
      metadata: {
        usage: chunk.usage,
        streaming: true
      }
    });
  }
}
```

### Context Window Management

```typescript
import {
  getModelTokenLimits,
  calculateOptimalContextSize
} from '../utils/context.util';

// Get model limits
const { contextWindow, maxOutputTokens } = getModelTokenLimits('openai', 'gpt-4');
// { contextWindow: 8192, maxOutputTokens: 2048 }

// Calculate optimal context size (leaves room for response)
const optimalSize = calculateOptimalContextSize(contextWindow, maxOutputTokens);
// Returns: 5324 (8192 - 2048 - 10% safety margin)

// Get context that fits
const context = await conversationService.getThreadContext(
  threadId,
  optimalSize,
  { model: 'gpt-4', providerKey: 'openai' }
);
```

## Best Practices

### 1. Always Use Transaction for Multi-Step Operations

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Multiple operations
  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
} finally {
  await queryRunner.release();
}
```

### 2. Batch Operations When Possible

```typescript
// Instead of individual saves, batch them
const messages = messageData.map(data =>
  messageRepository.create(data)
);
await messageRepository.save(messages);
```

### 3. Use Appropriate Truncation Strategy

- **OLDEST_FIRST** - Simple conversations, sequential flow
- **SLIDING_WINDOW** - Long conversations, need context from start and recent messages
- **IMPORTANCE_BASED** - Complex conversations with critical information

### 4. Monitor Token Usage

```typescript
const stats = await conversationService.getThreadStats(threadId);

if (stats.totalTokens > 100000) {
  // Consider archiving or summarizing
  await conversationService.summarizeThread(threadId);
}
```

### 5. Clean Up Regularly

```typescript
// Archive old threads
const oldThreads = await conversationService.listThreads(
  projectId,
  userId,
  {
    createdBefore: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    isArchived: false
  }
);

for (const thread of oldThreads) {
  await conversationService.archiveThread(thread.id, userId);
}
```

## Performance Considerations

### Database Indexes

Ensure these indexes exist:
- `threads(projectId, createdAt)`
- `threads(createdById)`
- `messages(threadId, createdAt)`
- `messages_fts` (FTS5 virtual table)

### Caching

PermissionService includes built-in caching (5-minute TTL).

### Query Optimization

Use pagination for large result sets:

```typescript
const pageSize = 50;
let offset = 0;

while (true) {
  const messages = await conversationService.getMessages(
    threadId,
    userId,
    pageSize,
    offset
  );

  if (messages.length === 0) break;

  // Process messages

  offset += pageSize;
}
```

## Testing

See `conversation.service.example.ts` for comprehensive usage examples.

## Support

For issues or questions, refer to:
- Main documentation
- PermissionService documentation
- ProviderService documentation
- Entity schemas in `/backend/entities/`

## License

Part of the Unified AI Hub project.
