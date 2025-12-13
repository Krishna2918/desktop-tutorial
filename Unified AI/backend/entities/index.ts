// User Management Domain
export { User } from './User';
export { Session } from './Session';
export { Organization } from './Organization';
export { OrganizationMember } from './OrganizationMember';

// Workspace & Project Domain
export { Workspace } from './Workspace';
export { WorkspaceMember } from './WorkspaceMember';
export { Project } from './Project';

// Conversation Domain
export { Thread } from './Thread';
export { Message, MessageRole, MessageContentType } from './Message';
export { Attachment } from './Attachment';

// AI Provider Domain
export { AIProviderConfig } from './AIProviderConfig';
export { AIInteraction, AIInteractionStatus } from './AIInteraction';

// Orchestration Domain
export {
  OrchestrationFlow,
  OrchestrationFlowType,
  OrchestrationFlowStatus
} from './OrchestrationFlow';
export {
  OrchestrationStepResult,
  OrchestrationStepStatus
} from './OrchestrationStepResult';

// Knowledge & Search Domain
export {
  EmbeddingRecord,
  EmbeddingSourceType
} from './EmbeddingRecord';
export {
  Document,
  DocumentContentType
} from './Document';

// Security & Privacy Domain
export {
  PermissionSet,
  PermissionEntityType
} from './PermissionSet';
export { DataSharingPolicy } from './DataSharingPolicy';
export {
  AuditLog,
  AuditAction
} from './AuditLog';

// Subscription & Billing Domain
export {
  SubscriptionPlan,
  PlanType,
  SubscriptionStatus,
  BillingInterval
} from './SubscriptionPlan';
export {
  Invoice,
  InvoiceStatus
} from './Invoice';

// Multi-Device & Sync Domain
export {
  Device,
  DeviceType
} from './Device';
export {
  SyncEvent,
  SyncOperation,
  ConflictResolutionStrategy
} from './SyncEvent';

// Settings & Telemetry Domain
export { UserSettings } from './UserSettings';
export { TelemetryEvent } from './TelemetryEvent';

// Array of all entities for TypeORM DataSource configuration
export const entities = [
  // User Management
  User,
  Session,
  Organization,
  OrganizationMember,

  // Workspace & Project
  Workspace,
  WorkspaceMember,
  Project,

  // Conversation
  Thread,
  Message,
  Attachment,

  // AI Provider
  AIProviderConfig,
  AIInteraction,

  // Orchestration
  OrchestrationFlow,
  OrchestrationStepResult,

  // Knowledge & Search
  EmbeddingRecord,
  Document,

  // Security & Privacy
  PermissionSet,
  DataSharingPolicy,
  AuditLog,

  // Subscription & Billing
  SubscriptionPlan,
  Invoice,

  // Multi-Device & Sync
  Device,
  SyncEvent,

  // Settings & Telemetry
  UserSettings,
  TelemetryEvent
];
