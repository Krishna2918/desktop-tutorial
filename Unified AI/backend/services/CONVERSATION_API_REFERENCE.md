# ConversationService API Quick Reference

## Import

```typescript
import { conversationService, MessageRole } from './services/conversation.service.index';
```

## Thread Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `createThread()` | `CreateThreadOptions` | `Thread` | Create new thread |
| `getThread()` | `threadId, userId` | `Thread` | Get thread by ID |
| `listThreads()` | `projectId, userId, filters?` | `Thread[]` | List filtered threads |
| `updateThread()` | `threadId, userId, updates` | `Thread` | Update thread |
| `archiveThread()` | `threadId, userId` | `Thread` | Archive thread |
| `deleteThread()` | `threadId, userId` | `void` | Delete thread |
| `pinThread()` | `threadId, userId, pinned` | `Thread` | Pin/unpin thread |

## Message Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `addMessage()` | `AddMessageOptions` | `Message` | Add message |
| `editMessage()` | `messageId, userId, content` | `Message` | Edit message |
| `deleteMessage()` | `messageId, userId` | `void` | Delete message |
| `getMessages()` | `threadId, userId, limit?, offset?` | `Message[]` | Get messages |
| `getMessageById()` | `messageId, userId` | `Message` | Get single message |
| `searchMessages()` | `userId, query, filters?` | `SearchResult[]` | Search messages |

## Context Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getThreadContext()` | `threadId, maxTokens, options?` | `ConversationMessage[]` | Get AI context |
| `summarizeThread()` | `threadId` | `string` | Generate summary |
| `truncateContext()` | `messages, maxTokens, model?, provider?` | `ConversationMessage[]` | Truncate context |
| `estimateContextTokens()` | `messages, model?, provider?` | `number` | Estimate tokens |

## Analytics Operations

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `getThreadStats()` | `threadId` | `ThreadStats` | Get thread stats |
| `getUserThreadStats()` | `userId` | `UserThreadStats` | Get user stats |

## Common Patterns

### 1. Create Thread & Add Messages

```typescript
const thread = await conversationService.createThread({
  projectId: 'proj-123',
  userId: 'user-123',
  title: 'My Chat',
  settings: { defaultModel: 'gpt-4' }
});

await conversationService.addMessage({
  threadId: thread.id,
  userId: 'user-123',
  content: 'Hello!',
  role: MessageRole.USER
});
```

### 2. Get Context for AI Call

```typescript
const context = await conversationService.getThreadContext(
  threadId,
  8000,
  { model: 'gpt-4', providerKey: 'openai' }
);

const response = await providerService.sendMessage(configId, {
  messages: context,
  model: 'gpt-4'
});
```

### 3. Search & Filter

```typescript
const results = await conversationService.searchMessages(
  userId,
  'important topic',
  {
    dateRange: { from: new Date('2024-01-01') },
    roles: [MessageRole.USER]
  }
);
```

### 4. List Active Threads

```typescript
const threads = await conversationService.listThreads(
  projectId,
  userId,
  { isArchived: false, isPinned: true }
);
```

### 5. Get Statistics

```typescript
const stats = await conversationService.getThreadStats(threadId);
console.log(`${stats.messageCount} messages, ${stats.totalTokens} tokens`);
```

## Types Reference

### CreateThreadOptions

```typescript
{
  projectId: string;
  userId: string;
  title: string;
  tags?: string[];
  settings?: {
    systemPrompt?: string;
    defaultModel?: string;
    defaultProvider?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```

### AddMessageOptions

```typescript
{
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
```

### ThreadFilters

```typescript
{
  isPinned?: boolean;
  isArchived?: boolean;
  tags?: string[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}
```

### MessageRole

```typescript
enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
  SYSTEM = 'SYSTEM'
}
```

### TruncationStrategy

```typescript
enum TruncationStrategy {
  OLDEST_FIRST = 'OLDEST_FIRST',
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  IMPORTANCE_BASED = 'IMPORTANCE_BASED'
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_INPUT` | 400 | Missing/invalid parameters |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `THREAD_NOT_FOUND` | 404 | Thread doesn't exist |
| `MESSAGE_NOT_FOUND` | 404 | Message doesn't exist |
| `PROJECT_NOT_FOUND` | 404 | Project doesn't exist |
| `PROVIDER_NOT_FOUND` | 404 | Provider doesn't exist |

## Permission Checks

All operations automatically check:
- Thread ownership (creator has all permissions)
- Project-level permissions (inherited)
- Workspace-level permissions (inherited)
- Direct permission grants

Required permissions by operation:
- **Read**: `getThread`, `getMessages`, `searchMessages`
- **Write**: `createThread`, `addMessage`, `editMessage`, `updateThread`, `archiveThread`, `pinThread`
- **Delete**: `deleteThread`, `deleteMessage`

## Best Practices

1. **Always handle errors**
   ```typescript
   try {
     await conversationService.createThread(options);
   } catch (error) {
     if (error instanceof ConversationServiceError) {
       console.error(`Error ${error.code}:`, error.message);
     }
   }
   ```

2. **Use appropriate truncation**
   - Simple chats: `OLDEST_FIRST`
   - Long conversations: `SLIDING_WINDOW`
   - Important context: `IMPORTANCE_BASED`

3. **Monitor token usage**
   ```typescript
   const stats = await conversationService.getThreadStats(threadId);
   if (stats.totalTokens > 100000) {
     await conversationService.summarizeThread(threadId);
   }
   ```

4. **Paginate large result sets**
   ```typescript
   const messages = await conversationService.getMessages(
     threadId,
     userId,
     50,  // limit
     0    // offset
   );
   ```

5. **Archive old threads**
   ```typescript
   const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
   const oldThreads = await conversationService.listThreads(
     projectId,
     userId,
     { createdBefore: oldDate }
   );
   ```

## Performance Tips

- Use pagination for large datasets
- Cache frequently accessed threads
- Batch message additions when possible
- Clean up archived threads periodically
- Use FTS5 search for text queries
- Monitor token usage per thread
- Set appropriate context windows

## See Also

- Full Documentation: `CONVERSATION_SERVICE.md`
- Examples: `conversation.service.example.ts`
- Implementation: `conversation.service.ts`
- Context Utils: `context.util.ts`
- Search Utils: `search.util.ts`
