# Unified AI Hub - System Architecture

## Overview
Production-ready, local-first, multi-AI provider orchestration platform with cross-platform support (web + desktop).

## Architecture Layers

### 1. Frontend Layer (React + TypeScript)
- **Web App**: Progressive Web App (PWA) with offline-first capabilities
- **Desktop App**: Electron wrapper with native file system access
- **Component Library**: Dynamic, theme-driven UI components
- **State Management**: Redux Toolkit with RTK Query for server state
- **Routing**: React Router with workspace/project/thread navigation

### 2. Backend Layer (Node.js + Express + TypeScript)
- **API Gateway**: RESTful + WebSocket endpoints
- **Business Logic Services**:
  - ConversationService: Thread/message management
  - OrchestratorService: Cross-AI coordination
  - ProviderService: AI adapter registry and routing
  - AuthService: Authentication and session management
  - StorageService: Data persistence abstraction
  - SyncService: Multi-device synchronization
  - SubscriptionService: Billing and plan management
  - AttachmentService: File/photo handling

### 3. Provider Adapter Layer
- **Standard Interface**: Uniform API for all AI providers
- **Adapters**:
  - OpenAI/ChatGPT Adapter
  - Anthropic/Claude Adapter
  - Google/Gemini Adapter
  - Meta AI Adapter
  - Custom Provider Template
- **Features**:
  - Streaming responses
  - Rate limiting and retries
  - Token counting and context management
  - Model enumeration
  - Error normalization

### 4. Storage Layer (Hybrid: Local + Cloud)
- **Local Storage** (Primary, ~10GB capacity):
  - SQLite/DuckDB: Relational data (conversations, users, configs)
  - Vector DB (Qdrant embedded): Embeddings for semantic search
  - File System: Attachments, cached media

- **Cloud Storage** (Optional, user-controlled):
  - PostgreSQL: Replicated relational data
  - S3-compatible: Large attachments
  - Vector DB cloud: Shared embeddings

### 5. Orchestration Engine
- **Flow Controller**: Manages multi-AI conversation flows
- **Context Manager**: Tracks shared context and permissions
- **Critique Engine**: Enables AI-to-AI evaluation
- **Workflow Templates**: Predefined cross-AI patterns

### 6. Security & Privacy Layer
- **Encryption**: AES-256 for data at rest, TLS 1.3 in transit
- **Secrets Management**: Environment-based config, encrypted storage
- **Permission Engine**: Fine-grained data sharing controls
- **Audit Logger**: Enterprise compliance tracking

## Data Flow

```
User Input
    ↓
Frontend (React)
    ↓
API Gateway (Express)
    ↓
Business Logic Layer
    ↓
Provider Adapter ←→ Orchestrator Engine
    ↓
AI Provider APIs (OpenAI/Claude/Gemini/Meta)
    ↓
Response Processing
    ↓
Storage Layer (Local + Cloud)
    ↓
Frontend Update (WebSocket/SSE)
```

## Cross-AI Orchestration Flow

```
User: "Ask GPT-4, then have Claude critique it"
    ↓
OrchestratorService.executeFlow({
  steps: [
    { provider: 'openai', model: 'gpt-4', action: 'generate' },
    { provider: 'anthropic', model: 'claude-3', action: 'critique', input: 'previous' }
  ]
})
    ↓
Step 1: OpenAI Adapter → GPT-4 Response
    ↓
Step 2: Claude Adapter (with GPT-4 output as context) → Critique
    ↓
Unified Response with Both Outputs
```

## Multi-Device Sync Strategy

### Local-First Approach
1. All data initially stored locally (SQLite + file system)
2. Each device maintains full local copy
3. Changes tracked with vector clocks/CRDTs
4. Sync only when user enables cloud backup

### Sync Protocol
- **Conflict Resolution**: Last-write-wins with manual resolution UI
- **Delta Sync**: Only changed records transmitted
- **Device Registration**: Each device has unique ID
- **Offline Support**: Full functionality without network

## Configuration-Driven Architecture

### No Hardcoded Values
All runtime values loaded from:
- Environment variables (.env files)
- Config files (JSON/YAML)
- Encrypted settings database
- User preferences

### Examples
```typescript
// ❌ Bad: Hardcoded
const apiKey = "sk-abc123...";

// ✅ Good: Config-driven
const apiKey = configService.getSecure('providers.openai.apiKey');
```

## Extensibility Patterns

### Adding New AI Provider
1. Implement `AIProviderAdapter` interface
2. Add config entry in `providers.config.json`
3. Register in `ProviderRegistry`
4. No changes to orchestration logic required

### Adding New Feature
1. Define in feature flags config
2. Check availability via `FeatureService`
3. UI adapts based on enabled features

## Technology Stack

### Frontend
- React 18+ with TypeScript
- Redux Toolkit + RTK Query
- TanStack Query (for advanced caching)
- Tailwind CSS (dynamic theming)
- shadcn/ui components (customizable)
- Electron (desktop)

### Backend
- Node.js 20+ LTS
- Express.js with TypeScript
- TypeORM (relational)
- Qdrant (vectors)
- ws (WebSocket)
- Bull (job queues)

### Storage
- SQLite (local relational)
- DuckDB (analytics)
- Qdrant Embedded (local vector)
- PostgreSQL (cloud relational)
- MinIO/S3 (cloud objects)

### Security
- bcrypt (password hashing)
- jsonwebtoken (JWT)
- node-forge (encryption)
- helmet (HTTP security)
- rate-limiter-flexible

### Testing
- Jest + Vitest
- React Testing Library
- Playwright (E2E)
- Supertest (API)
- MSW (mocking)

### DevOps
- GitHub Actions (CI/CD)
- Docker + Docker Compose
- Kubernetes (optional enterprise)
- Prometheus + Grafana (monitoring)

## Deployment Targets

### Development
- Local SQLite + embedded Qdrant
- Mock AI providers available
- Hot reload enabled

### Production (Individual)
- Desktop: Electron packaged app
- Web: Static hosting + serverless functions
- Data: User-controlled (local or cloud)

### Production (Enterprise)
- Kubernetes cluster
- PostgreSQL + Redis
- S3 storage
- Load balanced APIs
- Multi-region support

## Capacity Planning (~10 GB Local Storage)

### Allocation Strategy
- Conversations & Messages: 6 GB
- Embeddings (vector DB): 2 GB
- Attachments & Media: 1.5 GB
- Metadata & Indexes: 0.5 GB

### Pruning Logic
- Archive threads older than configurable threshold
- Compress historical data
- User-controlled deletion
- Export before cleanup
