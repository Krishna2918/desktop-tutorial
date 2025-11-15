/**
 * Standard AI Provider Adapter Interface
 *
 * All AI provider adapters MUST implement this interface.
 * The orchestration engine only interacts with this interface,
 * ensuring provider-agnostic orchestration.
 */

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface MessageRequest {
  messages: ConversationMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
  metadata?: Record<string, any>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface MessageResponse {
  content: string;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  usage: TokenUsage;
  metadata?: Record<string, any>;
}

export interface MessageChunk {
  content: string;
  done: boolean;
  usage?: TokenUsage;
  finishReason?: MessageResponse['finishReason'];
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1KTokens: number;
  outputCostPer1KTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctions: boolean;
  metadata?: Record<string, any>;
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProviderConfig {
  apiKey: string;
  apiEndpoint: string;
  organizationId?: string;
  customHeaders?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  metadata?: Record<string, any>;
}

/**
 * AI Provider Adapter Interface
 */
export interface AIProviderAdapter {
  /**
   * Provider identification
   */
  readonly providerKey: string;
  readonly providerName: string;

  /**
   * Core messaging capabilities
   */
  sendMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): Promise<MessageResponse>;

  streamMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): AsyncGenerator<MessageChunk, void, unknown>;

  /**
   * Model discovery and information
   */
  listModels(config: ProviderConfig): Promise<ModelInfo[]>;

  getModelInfo(
    config: ProviderConfig,
    modelId: string
  ): Promise<ModelInfo | null>;

  /**
   * Token management
   */
  countTokens(text: string, model: string): number;

  getContextLimit(model: string): number;

  estimateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number;

  /**
   * Health and validation
   */
  testConnection(config: ProviderConfig): Promise<boolean>;

  validateConfig(config: ProviderConfig): ValidationResult;

  /**
   * Rate limiting information
   */
  getRateLimits(): RateLimitInfo;

  /**
   * Request cancellation
   */
  cancelRequest(requestId: string): Promise<void>;

  /**
   * Supported features
   */
  supportsStreaming(): boolean;
  supportsVision(): boolean;
  supportsFunctions(): boolean;
}

/**
 * Provider adapter factory
 */
export interface ProviderAdapterFactory {
  createAdapter(providerKey: string): AIProviderAdapter | null;
  registerAdapter(providerKey: string, adapter: AIProviderAdapter): void;
  getRegisteredProviders(): string[];
}
