# Domain Model - Unified AI Hub

## Core Entities

### User Management Domain

#### User
- **id**: UUID
- **email**: string (unique)
- **passwordHash**: string (bcrypt)
- **displayName**: string
- **avatarUrl**: string (nullable)
- **emailVerified**: boolean
- **createdAt**: timestamp
- **updatedAt**: timestamp
- **lastLoginAt**: timestamp
- **preferences**: JSON (dynamic user settings)
- **subscriptionId**: UUID (FK to SubscriptionPlan)

**Relationships:**
- belongs to zero or more Organizations
- owns multiple Workspaces
- has multiple Devices
- has multiple AIProviderConfigs
- has multiple Sessions

#### Organization
- **id**: UUID
- **name**: string
- **slug**: string (unique)
- **ownerId**: UUID (FK to User)
- **plan**: enum (FREE, TEAM, ENTERPRISE)
- **maxSeats**: integer
- **settings**: JSON (org-wide configurations)
- **createdAt**: timestamp
- **updatedAt**: timestamp

**Relationships:**
- has many Members (User + Role)
- has many Workspaces
- has one SubscriptionPlan

#### OrganizationMember
- **id**: UUID
- **organizationId**: UUID
- **userId**: UUID
- **role**: enum (OWNER, ADMIN, MEMBER, VIEWER)
- **permissions**: JSON (granular permissions)
- **joinedAt**: timestamp

#### Device
- **id**: UUID
- **userId**: UUID
- **deviceName**: string
- **deviceType**: enum (DESKTOP, WEB, MOBILE)
- **platform**: string (Windows, macOS, Linux, Browser)
- **lastSyncAt**: timestamp
- **registeredAt**: timestamp
- **isActive**: boolean

**Relationships:**
- belongs to one User
- has multiple SyncEvents

---

### Workspace & Project Domain

#### Workspace
- **id**: UUID
- **name**: string
- **description**: text (nullable)
- **ownerId**: UUID (FK to User or Organization)
- **ownerType**: enum (USER, ORGANIZATION)
- **icon**: string (emoji or icon identifier)
- **color**: string (hex color)
- **settings**: JSON (workspace preferences)
- **isArchived**: boolean
- **createdAt**: timestamp
- **updatedAt**: timestamp

**Relationships:**
- has many Projects
- has many Members (via WorkspaceMember)
- owned by User or Organization

#### WorkspaceMember
- **id**: UUID
- **workspaceId**: UUID
- **userId**: UUID
- **role**: enum (OWNER, EDITOR, VIEWER)
- **permissions**: JSON
- **addedAt**: timestamp

#### Project
- **id**: UUID
- **workspaceId**: UUID
- **name**: string
- **description**: text (nullable)
- **icon**: string
- **color**: string
- **tags**: string[] (array of tags)
- **isPinned**: boolean
- **isArchived**: boolean
- **settings**: JSON
- **createdAt**: timestamp
- **updatedAt**: timestamp

**Relationships:**
- belongs to one Workspace
- has many Threads
- has many Documents

---

### Conversation Domain

#### Thread
- **id**: UUID
- **projectId**: UUID
- **title**: string
- **summary**: text (auto-generated)
- **tags**: string[]
- **isPinned**: boolean
- **isArchived**: boolean
- **createdById**: UUID (FK to User)
- **createdAt**: timestamp
- **updatedAt**: timestamp
- **lastMessageAt**: timestamp
- **messageCount**: integer
- **participatingProviders**: string[] (list of AI providers used)
- **contextSettings**: JSON (which data can be shared)

**Relationships:**
- belongs to one Project
- has many Messages
- has many Attachments
- created by one User

#### Message
- **id**: UUID
- **threadId**: UUID
- **parentId**: UUID (nullable, for threaded replies)
- **role**: enum (USER, ASSISTANT, SYSTEM)
- **providerId**: string (nullable, e.g., 'openai', 'anthropic')
- **model**: string (e.g., 'gpt-4', 'claude-3-opus')
- **content**: text
- **contentType**: enum (TEXT, CODE, IMAGE, FILE)
- **metadata**: JSON (provider-specific data)
- **tokenCount**: integer
- **createdAt**: timestamp
- **editedAt**: timestamp (nullable)
- **isDeleted**: boolean

**Relationships:**
- belongs to one Thread
- created by one User (if role=USER) or one AIProviderConfig (if role=ASSISTANT)
- has many Attachments
- references one parent Message (optional)
- tracked by one AIInteraction

#### Attachment
- **id**: UUID
- **messageId**: UUID (nullable)
- **threadId**: UUID (nullable)
- **fileName**: string
- **originalFileName**: string
- **mimeType**: string
- **fileSize**: integer (bytes)
- **filePath**: string (local or cloud storage path)
- **thumbnailPath**: string (nullable)
- **metadata**: JSON (EXIF for images, duration for videos, etc.)
- **uploadedById**: UUID
- **uploadedAt**: timestamp
- **isAnalyzed**: boolean
- **analysisResult**: JSON (OCR text, image description, etc.)

**Relationships:**
- belongs to one Message or Thread
- uploaded by one User

---

### AI Provider Domain

#### AIProviderConfig
- **id**: UUID
- **userId**: UUID
- **organizationId**: UUID (nullable, for shared configs)
- **providerKey**: string (e.g., 'openai', 'anthropic', 'google', 'meta')
- **displayName**: string
- **apiKey**: string (encrypted)
- **apiEndpoint**: string (configurable endpoint)
- **settings**: JSON (model preferences, temperature, etc.)
- **isActive**: boolean
- **createdAt**: timestamp
- **updatedAt**: timestamp
- **lastUsedAt**: timestamp

**Relationships:**
- belongs to one User or Organization
- tracks many AIInteractions

#### AIInteraction
- **id**: UUID
- **messageId**: UUID
- **providerConfigId**: UUID
- **model**: string
- **promptTokens**: integer
- **completionTokens**: integer
- **totalTokens**: integer
- **latencyMs**: integer
- **cost**: decimal (calculated cost)
- **status**: enum (SUCCESS, ERROR, TIMEOUT, CANCELLED)
- **errorMessage**: text (nullable)
- **requestPayload**: JSON (sanitized request)
- **responsePayload**: JSON (sanitized response)
- **createdAt**: timestamp

**Relationships:**
- belongs to one Message
- uses one AIProviderConfig

---

### Orchestration Domain

#### OrchestrationFlow
- **id**: UUID
- **threadId**: UUID
- **name**: string
- **description**: text
- **flowType**: enum (SEQUENTIAL, PARALLEL, CONDITIONAL, CRITIQUE, REFINEMENT)
- **steps**: JSON (array of step definitions)
- **currentStepIndex**: integer
- **status**: enum (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- **createdAt**: timestamp
- **startedAt**: timestamp (nullable)
- **completedAt**: timestamp (nullable)
- **result**: JSON (final output)

**Flow Step Structure (JSON):**
```json
{
  "stepId": "step-1",
  "provider": "openai",
  "model": "gpt-4",
  "action": "generate",
  "prompt": "...",
  "inputFrom": null,
  "settings": {...}
}
```

**Relationships:**
- belongs to one Thread
- tracks many OrchestrationStepResult

#### OrchestrationStepResult
- **id**: UUID
- **flowId**: UUID
- **stepId**: string
- **messageId**: UUID (the generated message)
- **status**: enum (SUCCESS, FAILED, SKIPPED)
- **output**: text
- **metadata**: JSON
- **executedAt**: timestamp

---

### Knowledge & Search Domain

#### EmbeddingRecord
- **id**: UUID
- **sourceType**: enum (MESSAGE, DOCUMENT, ATTACHMENT)
- **sourceId**: UUID
- **content**: text (the embedded content)
- **embedding**: vector (1536 or 3072 dimensions)
- **model**: string (embedding model used)
- **metadata**: JSON (chunk info, etc.)
- **createdAt**: timestamp

**Relationships:**
- references Message, Document, or Attachment

#### Document
- **id**: UUID
- **projectId**: UUID
- **title**: string
- **content**: text
- **contentType**: enum (MARKDOWN, RICH_TEXT, CODE)
- **tags**: string[]
- **createdById**: UUID
- **createdAt**: timestamp
- **updatedAt**: timestamp
- **isPublished**: boolean

**Relationships:**
- belongs to one Project
- has many EmbeddingRecords

---

### Security & Privacy Domain

#### PermissionSet
- **id**: UUID
- **entityType**: enum (WORKSPACE, PROJECT, THREAD)
- **entityId**: UUID
- **userId**: UUID (nullable)
- **roleId**: UUID (nullable)
- **permissions**: JSON (read, write, delete, share, export)
- **grantedAt**: timestamp
- **expiresAt**: timestamp (nullable)

#### DataSharingPolicy
- **id**: UUID
- **userId**: UUID
- **providerKey**: string
- **allowConversationHistory**: boolean
- **allowAttachments**: boolean
- **allowCrossProviderContext**: boolean
- **retentionDays**: integer (nullable, 0 = forever)
- **settings**: JSON
- **updatedAt**: timestamp

#### AuditLog
- **id**: UUID
- **userId**: UUID
- **organizationId**: UUID (nullable)
- **action**: enum (CREATE, READ, UPDATE, DELETE, EXPORT, SHARE, LOGIN, LOGOUT)
- **entityType**: string
- **entityId**: UUID
- **metadata**: JSON (details of the action)
- **ipAddress**: string
- **userAgent**: string
- **timestamp**: timestamp

---

### Subscription & Billing Domain

#### SubscriptionPlan
- **id**: UUID
- **userId**: UUID (nullable)
- **organizationId**: UUID (nullable)
- **planType**: enum (FREE, INDIVIDUAL_BASIC, INDIVIDUAL_PRO, TEAM, ENTERPRISE)
- **status**: enum (TRIAL, ACTIVE, CANCELLED, EXPIRED, PAST_DUE)
- **billingInterval**: enum (MONTHLY, YEARLY)
- **amount**: decimal
- **currency**: string (ISO code)
- **currentPeriodStart**: timestamp
- **currentPeriodEnd**: timestamp
- **cancelAtPeriodEnd**: boolean
- **trialEndsAt**: timestamp (nullable)
- **features**: JSON (enabled feature flags)
- **externalSubscriptionId**: string (Stripe subscription ID)
- **createdAt**: timestamp
- **updatedAt**: timestamp

**Relationships:**
- belongs to User or Organization
- has many Invoices

#### Invoice
- **id**: UUID
- **subscriptionId**: UUID
- **invoiceNumber**: string
- **amount**: decimal
- **currency**: string
- **status**: enum (DRAFT, PAID, VOID, UNCOLLECTIBLE)
- **paidAt**: timestamp (nullable)
- **externalInvoiceId**: string
- **pdfUrl**: string (nullable)
- **metadata**: JSON
- **createdAt**: timestamp

---

### Sync & Conflict Resolution Domain

#### SyncEvent
- **id**: UUID
- **deviceId**: UUID
- **entityType**: string
- **entityId**: UUID
- **operation**: enum (CREATE, UPDATE, DELETE)
- **vectorClock**: JSON (for conflict resolution)
- **payload**: JSON (delta or full entity)
- **syncedAt**: timestamp
- **conflictResolved**: boolean
- **conflictResolutionStrategy**: enum (LAST_WRITE_WINS, MANUAL, MERGE)

---

### Settings & Telemetry Domain

#### UserSettings
- **id**: UUID
- **userId**: UUID
- **category**: string (e.g., 'ui', 'ai', 'privacy')
- **key**: string
- **value**: JSON
- **updatedAt**: timestamp

#### TelemetryEvent
- **id**: UUID
- **userId**: UUID (nullable, for anonymous)
- **sessionId**: UUID
- **eventType**: string (e.g., 'feature_used', 'error_occurred')
- **eventData**: JSON
- **timestamp**: timestamp
- **isAnonymous**: boolean

---

## Entity Relationship Summary

```
User ─┬─< Organization (via OrganizationMember)
      ├─< Workspace (owner)
      ├─< Device
      ├─< AIProviderConfig
      ├─< Thread (creator)
      ├─< UserSettings
      └─< SubscriptionPlan

Organization ─┬─< Workspace (owner)
              └─< SubscriptionPlan

Workspace ─┬─< Project
           └─< WorkspaceMember

Project ─┬─< Thread
         └─< Document

Thread ─┬─< Message
        ├─< Attachment
        └─< OrchestrationFlow

Message ─┬─< Attachment
         ├─< AIInteraction
         └─< EmbeddingRecord

OrchestrationFlow ─< OrchestrationStepResult

AIProviderConfig ─< AIInteraction

SubscriptionPlan ─< Invoice
```

---

## Key Design Decisions

### 1. Flexible Ownership Model
- Workspaces can be owned by Users OR Organizations
- Supports both individual and team/enterprise use cases

### 2. Local-First with Sync Support
- All entities have local IDs (UUIDs)
- SyncEvent tracks changes for multi-device sync
- Vector clocks for conflict resolution

### 3. Provider Agnostic
- AIProviderConfig stores encrypted credentials per provider
- AIInteraction normalizes metrics across providers
- OrchestrationFlow operates on abstract provider interface

### 4. Fine-Grained Permissions
- PermissionSet allows entity-level access control
- DataSharingPolicy gives users control over AI data sharing
- AuditLog tracks all sensitive operations

### 5. Extensible Settings
- JSON columns for dynamic configuration
- No hardcoded feature flags or limits
- UserSettings supports arbitrary key-value pairs

### 6. Cost Tracking
- AIInteraction records token counts and calculated costs
- Enables budget alerts and usage analytics

### 7. Rich Attachments
- Attachments can belong to Messages or Threads
- Analyzed content stored for AI consumption
- Metadata preserves original file information

---

## Storage Size Estimates (~10 GB)

### Breakdown
- **Messages & Threads**: 6 GB
  - 1M messages × 6 KB average = 6 GB
- **Embeddings**: 2 GB
  - 500K vectors × 1536 dims × 4 bytes = 3 GB (with compression ~2 GB)
- **Attachments**: 1.5 GB
  - User-uploaded files (thumbnails, small docs)
- **Metadata**: 0.5 GB
  - Users, configs, audit logs, sync events

### Pruning Strategy
- Archive threads older than user-configured threshold (default 6 months)
- Compress message content with gzip
- Delete embeddings for archived content
- Export to cloud before local deletion
