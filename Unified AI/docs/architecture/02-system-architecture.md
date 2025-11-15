# System Architecture - Unified AI Hub

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Web App     │  │ Desktop App  │  │ Mobile App   │          │
│  │  (React)     │  │  (Electron)  │  │  (Future)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │
                    │   (Express.js)    │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                    Business Logic Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │Conversation │  │Orchestration │  │  Provider       │      │
│  │  Service    │  │   Service    │  │  Service        │      │
│  └─────────────┘  └──────────────┘  └─────────────────┘      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │    Auth     │  │    Sync      │  │ Subscription    │      │
│  │  Service    │  │  Service     │  │   Service       │      │
│  └─────────────┘  └──────────────┘  └─────────────────┘      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │ Attachment  │  │   Search     │  │    Audit        │      │
│  │  Service    │  │  Service     │  │   Service       │      │
│  └─────────────┘  └──────────────┘  └─────────────────┘      │
└───────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                  Provider Adapter Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │   OpenAI    │  │  Anthropic   │  │    Google       │      │
│  │  Adapter    │  │   Adapter    │  │   Adapter       │      │
│  └─────────────┘  └──────────────┘  └─────────────────┘      │
│  ┌─────────────┐  ┌──────────────┐                            │
│  │    Meta     │  │   Custom     │                            │
│  │  Adapter    │  │  Adapter     │                            │
│  └─────────────┘  └──────────────┘                            │
└───────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  External AI APIs │
                    │  (OpenAI, Claude, │
                    │   Gemini, etc.)   │
                    └───────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                    Storage Layer                              │
│  ┌─────────────────────┐  ┌──────────────────────┐           │
│  │   Local Storage     │  │   Cloud Storage      │           │
│  │   (Primary)         │  │   (Optional)         │           │
│  │                     │  │                      │           │
│  │ ┌─────────────────┐ │  │ ┌──────────────────┐ │           │
│  │ │ SQLite/DuckDB   │ │  │ │   PostgreSQL     │ │           │
│  │ │ (Relational)    │ │  │ │   (Relational)   │ │           │
│  │ └─────────────────┘ │  │ └──────────────────┘ │           │
│  │ ┌─────────────────┐ │  │ ┌──────────────────┐ │           │
│  │ │ Qdrant Embedded │ │  │ │  Qdrant Cloud    │ │           │
│  │ │ (Vector DB)     │ │  │ │  (Vector DB)     │ │           │
│  │ └─────────────────┘ │  │ └──────────────────┘ │           │
│  │ ┌─────────────────┐ │  │ ┌──────────────────┐ │           │
│  │ │  File System    │ │  │ │  S3-Compatible   │ │           │
│  │ │  (Attachments)  │ │  │ │  (Attachments)   │ │           │
│  │ └─────────────────┘ │  │ └──────────────────┘ │           │
│  └─────────────────────┘  └──────────────────────┘           │
└───────────────────────────────────────────────────────────────┘
```

---

## Layer Details

### 1. Client Layer

#### Web App (React + TypeScript)
- **Framework**: React 18+ with TypeScript
- **State Management**: Redux Toolkit + RTK Query
- **Routing**: React Router v6
- **Styling**: Tailwind CSS with dynamic theme system
- **Components**: Custom component library (config-driven)
- **Build**: Vite
- **Features**:
  - Progressive Web App (offline-first)
  - Service Workers for caching
  - IndexedDB for local state persistence
  - WebSocket for real-time updates

#### Desktop App (Electron)
- **Shell**: Electron with security hardening
- **IPC**: Secure main-renderer communication
- **Native Features**:
  - File system access (with permission dialog)
  - Native notifications
  - Auto-updater
  - System tray integration
- **Packaging**: electron-builder for multi-platform builds

#### Mobile App (Future)
- **Framework**: React Native or Flutter
- **Platform**: iOS + Android
- **Features**: Same core functionality with mobile-optimized UI

---

### 2. API Gateway Layer

#### Express.js API Server
- **Framework**: Express.js with TypeScript
- **Middleware Stack**:
  - helmet (security headers)
  - cors (configurable origins)
  - compression (gzip/brotli)
  - rate-limiter-flexible (DDoS protection)
  - express-validator (input validation)
  - morgan (request logging)

#### Endpoints Structure
```
/api/v1
  /auth
    POST   /login
    POST   /register
    POST   /logout
    POST   /refresh
    POST   /verify-email
    POST   /reset-password

  /users
    GET    /me
    PATCH  /me
    DELETE /me
    GET    /me/settings
    PATCH  /me/settings

  /organizations
    GET    /
    POST   /
    GET    /:id
    PATCH  /:id
    DELETE /:id
    GET    /:id/members
    POST   /:id/members
    DELETE /:id/members/:userId

  /workspaces
    GET    /
    POST   /
    GET    /:id
    PATCH  /:id
    DELETE /:id
    GET    /:id/projects

  /projects
    POST   /
    GET    /:id
    PATCH  /:id
    DELETE /:id
    GET    /:id/threads

  /threads
    POST   /
    GET    /:id
    PATCH  /:id
    DELETE /:id
    GET    /:id/messages
    POST   /:id/messages

  /messages
    GET    /:id
    PATCH  /:id
    DELETE /:id
    POST   /:id/attachments

  /providers
    GET    /
    POST   /configs
    GET    /configs
    GET    /configs/:id
    PATCH  /configs/:id
    DELETE /configs/:id
    POST   /configs/:id/test

  /orchestration
    POST   /flows
    GET    /flows/:id
    POST   /flows/:id/execute
    POST   /flows/:id/cancel

  /search
    POST   /messages
    POST   /semantic
    GET    /suggestions

  /attachments
    POST   /upload
    GET    /:id
    DELETE /:id
    POST   /:id/analyze

  /subscriptions
    GET    /plans
    POST   /subscribe
    POST   /cancel
    GET    /invoices
    POST   /webhooks/stripe

  /sync
    POST   /events
    GET    /events/since/:timestamp
    POST   /resolve-conflict
```

#### WebSocket Server
- **Library**: ws (native WebSocket)
- **Events**:
  - `message:new` - New message in thread
  - `message:streaming` - Streaming AI response chunk
  - `thread:updated` - Thread metadata changed
  - `sync:event` - Multi-device sync notification
  - `orchestration:progress` - Flow execution update

---

### 3. Business Logic Layer

#### ConversationService
**Responsibilities:**
- Thread CRUD operations
- Message lifecycle management
- Context window management
- Message search and filtering
- Thread summarization

**Methods:**
```typescript
createThread(projectId, title, settings)
getThread(threadId)
listThreads(projectId, filters)
addMessage(threadId, content, role, metadata)
editMessage(messageId, newContent)
deleteMessage(messageId)
getThreadContext(threadId, maxTokens)
summarizeThread(threadId)
archiveThread(threadId)
```

#### OrchestratorService
**Responsibilities:**
- Multi-AI flow execution
- Step-by-step orchestration
- Context sharing between providers
- Critique and refinement workflows

**Methods:**
```typescript
createFlow(threadId, flowDefinition)
executeFlow(flowId)
executeStep(flowId, stepId, input)
cancelFlow(flowId)
getFlowStatus(flowId)
```

**Flow Types:**
```typescript
type FlowDefinition = {
  type: 'sequential' | 'parallel' | 'conditional' | 'critique' | 'refinement';
  steps: FlowStep[];
  contextPolicy: ContextSharingPolicy;
};

type FlowStep = {
  id: string;
  provider: string;
  model: string;
  action: 'generate' | 'critique' | 'refine' | 'summarize' | 'analyze';
  prompt: string | ((input: any) => string);
  inputFrom?: string; // stepId to take input from
  settings: Record<string, any>;
};
```

#### ProviderService
**Responsibilities:**
- Provider registration and discovery
- Config validation
- Adapter routing
- Health checks

**Methods:**
```typescript
listProviders()
getProvider(providerKey)
registerProviderConfig(userId, providerKey, config)
testConnection(configId)
getAvailableModels(configId)
routeRequest(configId, request)
```

#### AuthService
**Responsibilities:**
- User registration and login
- JWT token generation and validation
- Session management
- Password reset flows
- Multi-factor authentication (future)

**Methods:**
```typescript
register(email, password, displayName)
login(email, password)
logout(sessionId)
refreshToken(refreshToken)
verifyEmail(token)
resetPassword(email)
validateSession(accessToken)
```

#### SyncService
**Responsibilities:**
- Multi-device synchronization
- Conflict detection and resolution
- Delta computation
- Device registration

**Methods:**
```typescript
registerDevice(userId, deviceInfo)
recordSyncEvent(deviceId, entityType, entityId, operation, payload)
getSyncEventsSince(deviceId, timestamp)
detectConflicts(events)
resolveConflict(conflictId, strategy)
applyDelta(entityType, entityId, delta)
```

#### SubscriptionService
**Responsibilities:**
- Plan management
- Billing integration (Stripe)
- Feature flag evaluation
- Usage tracking

**Methods:**
```typescript
getAvailablePlans()
subscribe(userId, planType, billingInterval)
cancelSubscription(subscriptionId)
updatePaymentMethod(subscriptionId, paymentMethodId)
handleWebhook(event)
checkFeatureAccess(userId, featureKey)
getUsageStats(userId)
```

#### AttachmentService
**Responsibilities:**
- File upload and storage
- Thumbnail generation
- OCR and image analysis
- Permission-based access

**Methods:**
```typescript
uploadFile(file, userId, permissions)
getAttachment(attachmentId)
deleteAttachment(attachmentId)
generateThumbnail(attachmentId)
analyzeImage(attachmentId)
extractText(attachmentId)
```

#### SearchService
**Responsibilities:**
- Full-text search (SQLite FTS5)
- Semantic search (vector similarity)
- Hybrid search ranking
- Search suggestions

**Methods:**
```typescript
searchMessages(query, filters)
semanticSearch(query, limit)
hybridSearch(query, filters)
indexMessage(messageId)
getSuggestions(partialQuery)
```

#### AuditService
**Responsibilities:**
- Action logging
- Compliance reporting
- Anomaly detection

**Methods:**
```typescript
logAction(userId, action, entityType, entityId, metadata)
getAuditLog(organizationId, filters)
exportAuditLog(organizationId, startDate, endDate)
```

---

### 4. Provider Adapter Layer

#### Standard Adapter Interface
```typescript
interface AIProviderAdapter {
  // Core capabilities
  sendMessage(config: ProviderConfig, request: MessageRequest): Promise<MessageResponse>;
  streamMessage(config: ProviderConfig, request: MessageRequest): AsyncIterator<MessageChunk>;

  // Model discovery
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;
  getModelInfo(config: ProviderConfig, modelId: string): Promise<ModelInfo>;

  // Token management
  countTokens(text: string, model: string): number;
  getContextLimit(model: string): number;

  // Health and validation
  testConnection(config: ProviderConfig): Promise<boolean>;
  validateConfig(config: ProviderConfig): ValidationResult;

  // Rate limiting
  getRateLimits(): RateLimitInfo;

  // Cancellation
  cancelRequest(requestId: string): Promise<void>;
}

type MessageRequest = {
  messages: ConversationMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, any>;
};

type MessageResponse = {
  content: string;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
};

type MessageChunk = {
  content: string;
  done: boolean;
  usage?: MessageResponse['usage'];
};
```

#### Concrete Adapters

**OpenAI Adapter**
- Models: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- Streaming: Server-Sent Events
- Special features: Function calling, vision

**Anthropic Adapter**
- Models: Claude 3 Opus, Sonnet, Haiku
- Streaming: Server-Sent Events
- Special features: 200K context window

**Google Gemini Adapter**
- Models: Gemini Pro, Gemini Ultra
- Streaming: Server-Sent Events
- Special features: Multimodal (image + text)

**Meta AI Adapter**
- Models: Llama 3.x series
- Streaming: Custom implementation
- Special features: Open-source models

---

### 5. Storage Layer

#### Local Storage (Primary)

**SQLite Database**
- **File**: `~/.unified-ai/data/app.db`
- **Schemas**: All domain entities
- **Features**:
  - FTS5 for full-text search
  - JSON1 extension for JSON columns
  - WAL mode for concurrent access
  - Encrypted with SQLCipher

**DuckDB (Analytics)**
- **File**: `~/.unified-ai/data/analytics.duckdb`
- **Purpose**: Fast analytical queries on large datasets
- **Use cases**: Usage reports, cost analysis, trend detection

**Qdrant Embedded (Vector DB)**
- **Storage**: `~/.unified-ai/data/vectors/`
- **Collections**:
  - `messages` - Message embeddings
  - `documents` - Document embeddings
  - `attachments` - Analyzed attachment embeddings
- **Model**: text-embedding-ada-002 or local model

**File System**
- **Root**: `~/.unified-ai/attachments/`
- **Structure**:
  ```
  attachments/
    {userId}/
      {attachmentId}/
        original.{ext}
        thumbnail.jpg
        metadata.json
  ```

#### Cloud Storage (Optional)

**PostgreSQL**
- Replica of SQLite schema
- Enables multi-device sync
- Conflict resolution via SyncService

**S3-Compatible Storage**
- Large attachments
- Backup exports
- Shared workspace files

**Qdrant Cloud**
- Centralized vector search
- Shared embeddings across devices

---

### 6. Configuration Architecture

#### Environment Variables (.env)
```env
# App
NODE_ENV=development
APP_PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=file:./data/app.db
DATABASE_ENCRYPTION_KEY=...

# JWT
JWT_SECRET=...
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Storage
STORAGE_PATH=./data/attachments
MAX_ATTACHMENT_SIZE_MB=50

# Vector DB
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=...

# External APIs (optional, user-provided)
# Users add these via UI, stored encrypted
```

#### Config Files (JSON/YAML)

**providers.config.json**
```json
{
  "providers": [
    {
      "key": "openai",
      "name": "OpenAI",
      "apiEndpoint": "https://api.openai.com/v1",
      "requiresApiKey": true,
      "supportedFeatures": ["streaming", "functions", "vision"],
      "models": [
        {
          "id": "gpt-4",
          "name": "GPT-4",
          "contextLimit": 8192,
          "costPer1KTokens": { "prompt": 0.03, "completion": 0.06 }
        }
      ]
    },
    {
      "key": "anthropic",
      "name": "Anthropic",
      "apiEndpoint": "https://api.anthropic.com/v1",
      "requiresApiKey": true,
      "supportedFeatures": ["streaming", "extended_context"],
      "models": [
        {
          "id": "claude-3-opus-20240229",
          "name": "Claude 3 Opus",
          "contextLimit": 200000,
          "costPer1KTokens": { "prompt": 0.015, "completion": 0.075 }
        }
      ]
    }
  ]
}
```

**features.config.json**
```json
{
  "free": {
    "maxThreads": 50,
    "maxMessages": 1000,
    "maxAttachmentSizeMB": 10,
    "providers": ["openai"],
    "orchestration": false,
    "multiDevice": false,
    "export": true
  },
  "individual_basic": {
    "maxThreads": 500,
    "maxMessages": 10000,
    "maxAttachmentSizeMB": 50,
    "providers": ["openai", "anthropic", "google"],
    "orchestration": true,
    "multiDevice": true,
    "export": true,
    "cloudSync": false
  },
  "individual_pro": {
    "maxThreads": -1,
    "maxMessages": -1,
    "maxAttachmentSizeMB": 100,
    "providers": "*",
    "orchestration": true,
    "multiDevice": true,
    "export": true,
    "cloudSync": true,
    "prioritySupport": true
  },
  "enterprise": {
    "maxThreads": -1,
    "maxMessages": -1,
    "maxAttachmentSizeMB": 500,
    "providers": "*",
    "orchestration": true,
    "multiDevice": true,
    "export": true,
    "cloudSync": true,
    "sharedWorkspaces": true,
    "rbac": true,
    "auditLogs": true,
    "sso": true,
    "prioritySupport": true,
    "sla": "99.9%"
  }
}
```

**themes.config.json**
```json
{
  "themes": [
    {
      "id": "light",
      "name": "Light",
      "colors": {
        "primary": "#3b82f6",
        "secondary": "#8b5cf6",
        "background": "#ffffff",
        "surface": "#f9fafb",
        "text": "#111827",
        "textSecondary": "#6b7280",
        "border": "#e5e7eb",
        "error": "#ef4444",
        "success": "#10b981"
      },
      "typography": {
        "fontFamily": "Inter, system-ui, sans-serif",
        "fontSize": "14px",
        "lineHeight": "1.5"
      },
      "spacing": {
        "unit": 8
      }
    }
  ]
}
```

---

## Data Flow Diagrams

### User Message Flow
```
1. User types message in UI
   ↓
2. Frontend dispatches action
   ↓
3. API POST /threads/:id/messages
   ↓
4. ConversationService.addMessage()
   ↓
5. Save to local SQLite
   ↓
6. ProviderService.routeRequest()
   ↓
7. OpenAIAdapter.streamMessage()
   ↓
8. WebSocket sends chunks to client
   ↓
9. Frontend updates UI in real-time
   ↓
10. Save AI response to SQLite
    ↓
11. SearchService.indexMessage()
    ↓
12. Generate embedding (async)
    ↓
13. Store in Qdrant
```

### Cross-AI Orchestration Flow
```
1. User: "Ask GPT-4, then Claude critiques"
   ↓
2. OrchestratorService.createFlow({
     steps: [
       { provider: 'openai', model: 'gpt-4', action: 'generate' },
       { provider: 'anthropic', model: 'claude-3-opus', action: 'critique', inputFrom: 'step1' }
     ]
   })
   ↓
3. Execute Step 1:
   - OpenAIAdapter.sendMessage()
   - Save result as Message
   ↓
4. Execute Step 2:
   - Build prompt with Step 1 output
   - AnthropicAdapter.sendMessage()
   - Save critique as Message
   ↓
5. Return combined result to user
```

### Multi-Device Sync Flow
```
Device A:
1. User edits message
   ↓
2. Update local SQLite
   ↓
3. SyncService.recordSyncEvent({
     operation: 'UPDATE',
     entityType: 'Message',
     entityId: '...',
     payload: { ... },
     vectorClock: { deviceA: 5, deviceB: 3 }
   })
   ↓
4. POST /sync/events to server
   ↓
5. Server stores event
   ↓
6. WebSocket broadcast to other devices

Device B:
7. Receives WebSocket event
   ↓
8. GET /sync/events/since/:lastSync
   ↓
9. SyncService.applyDelta()
   ↓
10. Update local SQLite
    ↓
11. If conflict detected:
    - Show conflict resolution UI
    - User chooses strategy
    - SyncService.resolveConflict()
```

---

## Security Architecture

### Authentication Flow
```
1. User submits email + password
   ↓
2. AuthService.login()
   ↓
3. Verify password hash (bcrypt)
   ↓
4. Generate JWT access token (15m expiry)
   ↓
5. Generate JWT refresh token (7d expiry)
   ↓
6. Store refresh token in httpOnly cookie
   ↓
7. Return access token to client
   ↓
8. Client stores access token in memory
   ↓
9. Include in Authorization header for API calls
```

### Data Encryption
- **At Rest**:
  - SQLite encrypted with SQLCipher
  - API keys encrypted with AES-256
  - Attachments optionally encrypted
- **In Transit**:
  - TLS 1.3 for all HTTPS
  - WSS for WebSocket

### Permission Checks
```typescript
// Every API endpoint
async function checkPermission(userId, entityType, entityId, action) {
  const permissions = await PermissionService.getUserPermissions(userId, entityType, entityId);
  if (!permissions.includes(action)) {
    throw new ForbiddenError();
  }
}
```

---

## Extensibility Patterns

### Adding a New AI Provider

**Step 1**: Implement adapter
```typescript
// src/adapters/my-provider.adapter.ts
export class MyProviderAdapter implements AIProviderAdapter {
  async sendMessage(config, request) { ... }
  async streamMessage(config, request) { ... }
  // ... implement all interface methods
}
```

**Step 2**: Register in config
```json
// config/providers.config.json
{
  "providers": [
    {
      "key": "my-provider",
      "name": "My Provider",
      "apiEndpoint": "https://api.myprovider.com",
      ...
    }
  ]
}
```

**Step 3**: Register in registry
```typescript
// src/services/provider.service.ts
providerRegistry.register('my-provider', new MyProviderAdapter());
```

**No changes needed in:**
- OrchestrationService
- ConversationService
- Frontend UI (dynamic provider list)

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript | UI framework |
| Frontend State | Redux Toolkit + RTK Query | State management |
| Frontend Styling | Tailwind CSS | Dynamic theming |
| Frontend Build | Vite | Fast builds |
| Desktop | Electron | Native app |
| Backend | Node.js 20 + Express | API server |
| Backend Language | TypeScript | Type safety |
| Local DB | SQLite + SQLCipher | Relational data |
| Analytics DB | DuckDB | Fast analytics |
| Vector DB | Qdrant Embedded | Semantic search |
| Cloud DB | PostgreSQL | Replicated data |
| Cloud Storage | S3-compatible | Large files |
| Auth | JWT + bcrypt | Authentication |
| Testing | Jest + Vitest | Unit tests |
| E2E Testing | Playwright | End-to-end tests |
| API Mocking | MSW | Development |
| Job Queue | Bull | Background jobs |
| WebSocket | ws | Real-time updates |
| Validation | Zod | Schema validation |
| Encryption | node-forge | Crypto |
| Rate Limiting | rate-limiter-flexible | DDoS protection |
| CI/CD | GitHub Actions | Automation |
| Containerization | Docker | Deployment |
| Monitoring | Prometheus + Grafana | Observability |

---

## Deployment Architectures

### Individual User (Desktop App)
```
User's Computer
  ├─ Electron App (Frontend + Backend in one process)
  ├─ Local SQLite (~/.unified-ai/data/app.db)
  ├─ Local Qdrant (~/.unified-ai/data/vectors/)
  └─ Local Attachments (~/.unified-ai/attachments/)
```

### Individual User (Web + Cloud)
```
Client Browser
  ↓ HTTPS
Static Hosting (Vercel/Netlify)
  ↓ API Calls
Serverless Functions (Vercel Functions/AWS Lambda)
  ↓
User's Cloud Storage
  ├─ PostgreSQL (Supabase/Neon)
  ├─ Qdrant Cloud
  └─ S3 (AWS/Backblaze)
```

### Enterprise (Kubernetes)
```
Load Balancer
  ↓
Ingress (HTTPS + WebSocket)
  ↓
┌──────────────────────────────┐
│  Frontend Pods (3 replicas)  │
│  (Nginx serving React build) │
└──────────────────────────────┘
  ↓
┌──────────────────────────────┐
│  Backend Pods (5 replicas)   │
│  (Node.js + Express)         │
└──────────────────────────────┘
  ↓
┌──────────────────────────────┐
│  PostgreSQL (StatefulSet)    │
│  Qdrant (StatefulSet)        │
│  Redis (for sessions/cache)  │
│  MinIO (S3-compatible)       │
└──────────────────────────────┘
```

---

## Capacity and Performance

### Local Storage (~10 GB)
- Messages: 6 GB (1M messages)
- Vectors: 2 GB (500K embeddings)
- Attachments: 1.5 GB
- Metadata: 0.5 GB

### Performance Targets
- API response time: < 200ms (p95)
- Message search: < 100ms (p95)
- Semantic search: < 500ms (p95)
- Message streaming: < 50ms first token
- UI interaction: < 16ms (60 FPS)

### Scalability
- **Vertical**: Single desktop app supports 10GB local data
- **Horizontal**: Cloud deployment supports 100K+ concurrent users
- **Database**: PostgreSQL supports 10M+ messages per tenant
- **Vector DB**: Qdrant supports millions of vectors with HNSW

---

This architecture supports all requirements: multi-provider, local-first, cross-AI orchestration, dynamic UI, secure, extensible, and production-ready.
