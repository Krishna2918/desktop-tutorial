/**
 * Anthropic Claude Provider Adapter
 *
 * Production-ready implementation of AIProviderAdapter for Anthropic's Claude API.
 * Supports Claude 3 models (Opus, Sonnet, Haiku) with full streaming,
 * retry logic, rate limiting, and comprehensive error handling.
 */

import {
  AIProviderAdapter,
  ConversationMessage,
  MessageRequest,
  MessageResponse,
  MessageChunk,
  ModelInfo,
  ProviderConfig,
  TokenUsage,
  RateLimitInfo,
  ValidationResult,
} from '../base/AIProviderAdapter.interface';

/**
 * Anthropic-specific error types
 */
class AnthropicError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public type?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends AnthropicError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429, 'rate_limit_error', true);
    this.name = 'RateLimitError';
  }
}

/**
 * Anthropic API request/response types
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
  metadata?: {
    user_id?: string;
  };
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicContent {
  type: 'text';
  text: string;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

interface AnthropicStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping' | 'error';
  message?: AnthropicResponse;
  delta?: {
    type: 'text_delta';
    text: string;
    stop_reason?: string;
  };
  usage?: AnthropicUsage;
  index?: number;
  content_block?: {
    type: 'text';
    text: string;
  };
}

interface AnthropicModel {
  id: string;
  display_name: string;
  created_at: string;
}

interface AnthropicModelsResponse {
  data: AnthropicModel[];
}

/**
 * Model pricing and capabilities database
 */
interface ModelPricing {
  inputCostPer1KTokens: number;
  outputCostPer1KTokens: number;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsFunctions: boolean;
  description?: string;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-opus-20240229': {
    inputCostPer1KTokens: 0.015,
    outputCostPer1KTokens: 0.075,
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Most powerful Claude 3 model for highly complex tasks',
  },
  'claude-3-sonnet-20240229': {
    inputCostPer1KTokens: 0.003,
    outputCostPer1KTokens: 0.015,
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Balanced Claude 3 model for most tasks',
  },
  'claude-3-haiku-20240307': {
    inputCostPer1KTokens: 0.00025,
    outputCostPer1KTokens: 0.00125,
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Fastest and most compact Claude 3 model',
  },
  'claude-3-5-sonnet-20241022': {
    inputCostPer1KTokens: 0.003,
    outputCostPer1KTokens: 0.015,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Latest Claude 3.5 Sonnet with enhanced capabilities',
  },
  'claude-2.1': {
    inputCostPer1KTokens: 0.008,
    outputCostPer1KTokens: 0.024,
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Previous generation Claude model',
  },
  'claude-2.0': {
    inputCostPer1KTokens: 0.008,
    outputCostPer1KTokens: 0.024,
    contextWindow: 100000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Legacy Claude 2.0 model',
  },
  'claude-instant-1.2': {
    inputCostPer1KTokens: 0.0008,
    outputCostPer1KTokens: 0.0024,
    contextWindow: 100000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Fast and efficient Claude Instant model',
  },
};

/**
 * Anthropic Provider Adapter Implementation
 */
export class AnthropicAdapter implements AIProviderAdapter {
  readonly providerKey = 'anthropic';
  readonly providerName = 'Anthropic';

  private activeRequests: Map<string, AbortController> = new Map();
  private requestCounter = 0;
  private readonly ANTHROPIC_VERSION = '2023-06-01';

  /**
   * Send a message to Anthropic API (non-streaming)
   */
  async sendMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): Promise<MessageResponse> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new AnthropicError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const response = await this.sendWithRetry(
        config,
        request,
        abortController,
        false
      );
      return response;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Stream messages from Anthropic API using Server-Sent Events
   */
  async *streamMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): AsyncGenerator<MessageChunk, void, unknown> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new AnthropicError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const apiRequest = this.buildAnthropicRequest(request, true);
      const timeout = config.timeout || 120000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const response = await fetch(
          `${config.apiEndpoint}/v1/messages`,
          {
            method: 'POST',
            headers: this.buildHeaders(config),
            body: JSON.stringify(apiRequest),
            signal: abortController.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw error;
        }

        if (!response.body) {
          throw new AnthropicError('Response body is null', 500, 'stream_error');
        }

        let accumulatedContent = '';
        let usage: TokenUsage | undefined;
        let finishReason: MessageResponse['finishReason'] | undefined;

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();

              if (!trimmedLine || trimmedLine.startsWith(':')) {
                continue;
              }

              if (trimmedLine.startsWith('event:')) {
                // Event type line, continue
                continue;
              }

              if (trimmedLine.startsWith('data: ')) {
                const jsonData = trimmedLine.substring(6);

                try {
                  const parsed: AnthropicStreamEvent = JSON.parse(jsonData);

                  if (parsed.type === 'error') {
                    throw new AnthropicError(
                      'Stream error',
                      500,
                      'stream_error'
                    );
                  }

                  if (parsed.type === 'message_start' && parsed.message) {
                    // Initial message metadata
                    if (parsed.message.usage) {
                      usage = this.mapUsage(parsed.message.usage);
                    }
                  }

                  if (parsed.type === 'content_block_delta' && parsed.delta) {
                    const content = parsed.delta.text || '';
                    if (content) {
                      accumulatedContent += content;
                      yield {
                        content,
                        done: false,
                      };
                    }
                  }

                  if (parsed.type === 'message_delta' && parsed.delta) {
                    if (parsed.delta.stop_reason) {
                      finishReason = this.mapFinishReason(parsed.delta.stop_reason);
                    }
                    if (parsed.usage) {
                      // Update usage with final output tokens
                      const currentUsage = usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
                      const deltaUsage = this.mapUsage(parsed.usage);
                      usage = {
                        promptTokens: currentUsage.promptTokens,
                        completionTokens: deltaUsage.outputTokens || deltaUsage.completionTokens,
                        totalTokens: currentUsage.promptTokens + (deltaUsage.outputTokens || deltaUsage.completionTokens),
                      };
                    }
                  }

                  if (parsed.type === 'message_stop') {
                    // End of stream
                    break;
                  }
                } catch (parseError) {
                  if (parseError instanceof AnthropicError) {
                    throw parseError;
                  }
                  console.error('Failed to parse SSE data:', jsonData, parseError);
                }
              }
            }
          }

          if (!usage) {
            usage = this.estimateUsage(request, accumulatedContent);
          }

          yield {
            content: '',
            done: true,
            usage,
            finishReason: finishReason || 'stop',
          };
        } finally {
          reader.releaseLock();
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * List available models from Anthropic API
   */
  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new AnthropicError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    // Anthropic doesn't provide a models endpoint, so we return our known models
    return Object.keys(MODEL_PRICING).map((modelId) => {
      const info = this.buildModelInfo(modelId);
      return info;
    }).filter((info): info is ModelInfo => info !== null);
  }

  /**
   * Get information about a specific model
   */
  async getModelInfo(
    config: ProviderConfig,
    modelId: string
  ): Promise<ModelInfo | null> {
    return this.buildModelInfo(modelId);
  }

  /**
   * Count tokens in text
   * Uses character-based estimation (approximately 3.5 chars per token for Claude)
   */
  countTokens(text: string, model: string): number {
    const avgCharsPerToken = 3.5;
    const charCount = text.length;
    const estimatedTokens = Math.ceil(charCount / avgCharsPerToken);

    return estimatedTokens;
  }

  /**
   * Get context window limit for a model
   */
  getContextLimit(model: string): number {
    const pricing = this.getModelPricing(model);
    return pricing.contextWindow;
  }

  /**
   * Estimate cost based on token usage
   */
  estimateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    const pricing = this.getModelPricing(model);

    const inputCost = (promptTokens / 1000) * pricing.inputCostPer1KTokens;
    const outputCost = (completionTokens / 1000) * pricing.outputCostPer1KTokens;

    return inputCost + outputCost;
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const abortController = new AbortController();
      const timeout = config.timeout || 10000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        // Send a minimal test request
        const testRequest: AnthropicRequest = {
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        };

        const response = await fetch(`${config.apiEndpoint}/v1/messages`, {
          method: 'POST',
          headers: this.buildHeaders(config),
          body: JSON.stringify(testRequest),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate provider configuration
   */
  validateConfig(config: ProviderConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.apiKey || config.apiKey.trim() === '') {
      errors.push('API key is required');
    }

    if (!config.apiEndpoint || config.apiEndpoint.trim() === '') {
      errors.push('API endpoint is required');
    } else {
      try {
        new URL(config.apiEndpoint);
      } catch {
        errors.push('API endpoint must be a valid URL');
      }
    }

    if (config.timeout !== undefined && config.timeout < 0) {
      errors.push('Timeout must be a positive number');
    }

    if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
      errors.push('Retry attempts must be a non-negative number');
    }

    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      errors.push('Retry delay must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get rate limit information
   */
  getRateLimits(): RateLimitInfo {
    return {
      requestsPerMinute: 50,
      tokensPerMinute: 100000,
      requestsPerDay: 1000,
    };
  }

  /**
   * Cancel an active request
   */
  async cancelRequest(requestId: string): Promise<void> {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * Check if vision is supported
   */
  supportsVision(): boolean {
    return true;
  }

  /**
   * Check if functions are supported
   */
  supportsFunctions(): boolean {
    return true;
  }

  /**
   * Private helper methods
   */

  private generateRequestId(): string {
    return `anthropic_${Date.now()}_${++this.requestCounter}`;
  }

  private buildHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': this.ANTHROPIC_VERSION,
    };

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  private buildAnthropicRequest(
    request: MessageRequest,
    stream: boolean
  ): AnthropicRequest {
    // Separate system messages from conversation messages
    const systemMessages = request.messages.filter(msg => msg.role === 'system');
    const conversationMessages = request.messages.filter(msg => msg.role !== 'system');

    // Anthropic requires at least one user message and doesn't support 'system' role in messages array
    const anthropicMessages: AnthropicMessage[] = conversationMessages.map((msg) => {
      if (msg.role === 'system') {
        // This shouldn't happen due to filtering, but handle it just in case
        return { role: 'user' as const, content: msg.content };
      }
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    });

    // Ensure we have at least one message
    if (anthropicMessages.length === 0) {
      anthropicMessages.push({
        role: 'user',
        content: 'Hello',
      });
    }

    // Ensure first message is from user
    if (anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({
        role: 'user',
        content: 'Continue',
      });
    }

    const anthropicRequest: AnthropicRequest = {
      model: request.model,
      messages: anthropicMessages,
      max_tokens: request.maxTokens || 4096,
      stream,
    };

    // Add system message if present
    if (systemMessages.length > 0) {
      anthropicRequest.system = systemMessages.map(msg => msg.content).join('\n\n');
    }

    if (request.temperature !== undefined) {
      anthropicRequest.temperature = request.temperature;
    }

    if (request.topP !== undefined) {
      anthropicRequest.top_p = request.topP;
    }

    if (request.stopSequences && request.stopSequences.length > 0) {
      anthropicRequest.stop_sequences = request.stopSequences;
    }

    return anthropicRequest;
  }

  private async sendWithRetry(
    config: ProviderConfig,
    request: MessageRequest,
    abortController: AbortController,
    isRetry: boolean
  ): Promise<MessageResponse> {
    const maxRetries = config.retryAttempts ?? 3;
    const baseDelay = config.retryDelay ?? 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }

        const response = await this.sendSingleRequest(
          config,
          request,
          abortController
        );
        return response;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AnthropicError) {
          if (!error.retryable || attempt >= maxRetries) {
            throw error;
          }

          if (error instanceof RateLimitError && error.retryAfter) {
            await this.sleep(error.retryAfter * 1000);
          }
        } else if (error instanceof Error && error.name === 'AbortError') {
          throw new AnthropicError('Request timeout', 408, 'timeout');
        } else {
          if (attempt >= maxRetries) {
            throw error;
          }
        }
      }
    }

    throw lastError || new AnthropicError('Request failed after retries', 500, 'retry_exhausted');
  }

  private async sendSingleRequest(
    config: ProviderConfig,
    request: MessageRequest,
    abortController: AbortController
  ): Promise<MessageResponse> {
    const apiRequest = this.buildAnthropicRequest(request, false);
    const timeout = config.timeout || 60000;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const response = await fetch(
        `${config.apiEndpoint}/v1/messages`,
        {
          method: 'POST',
          headers: this.buildHeaders(config),
          body: JSON.stringify(apiRequest),
          signal: abortController.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw error;
      }

      const data: AnthropicResponse = await response.json();
      return this.mapAnthropicResponse(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseErrorResponse(response: Response): Promise<AnthropicError> {
    let errorMessage = `Anthropic API error: ${response.status} ${response.statusText}`;
    let errorType = 'api_error';
    let retryable = false;

    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error.message || errorMessage;
        errorType = errorData.error.type || errorType;
      }
    } catch {
      // Failed to parse error response, use default message
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return new RateLimitError(
        errorMessage,
        retryAfter ? parseInt(retryAfter, 10) : 60
      );
    }

    if (response.status >= 500 || response.status === 529) {
      retryable = true;
    }

    return new AnthropicError(errorMessage, response.status, errorType, retryable);
  }

  private mapAnthropicResponse(data: AnthropicResponse): MessageResponse {
    if (!data.content || data.content.length === 0) {
      throw new AnthropicError('No content in response', 500, 'invalid_response');
    }

    const content = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const finishReason = this.mapFinishReason(data.stop_reason || 'end_turn');

    const usage: TokenUsage = data.usage
      ? this.mapUsage(data.usage)
      : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
      content,
      model: data.model,
      finishReason,
      usage,
      metadata: {
        id: data.id,
        stopSequence: data.stop_sequence,
      },
    };
  }

  private mapFinishReason(
    reason: string | null
  ): MessageResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private mapUsage(usage: AnthropicUsage): TokenUsage {
    return {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }

  private estimateUsage(
    request: MessageRequest,
    completion: string
  ): TokenUsage {
    const promptText = request.messages
      .map((msg) => msg.content)
      .join(' ');

    const promptTokens = this.countTokens(promptText, request.model);
    const completionTokens = this.countTokens(completion, request.model);

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  private getModelPricing(model: string): ModelPricing {
    const normalizedModel = model.toLowerCase();

    // Try exact match first
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel === key.toLowerCase()) {
        return pricing;
      }
    }

    // Try partial match
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedModel)) {
        return pricing;
      }
    }

    // Default to Claude 3.5 Sonnet pricing for unknown models
    if (normalizedModel.includes('opus')) {
      return MODEL_PRICING['claude-3-opus-20240229'];
    }

    if (normalizedModel.includes('sonnet')) {
      return MODEL_PRICING['claude-3-5-sonnet-20241022'];
    }

    if (normalizedModel.includes('haiku')) {
      return MODEL_PRICING['claude-3-haiku-20240307'];
    }

    if (normalizedModel.includes('claude-2')) {
      return MODEL_PRICING['claude-2.1'];
    }

    if (normalizedModel.includes('instant')) {
      return MODEL_PRICING['claude-instant-1.2'];
    }

    // Default fallback
    return {
      inputCostPer1KTokens: 0.003,
      outputCostPer1KTokens: 0.015,
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsFunctions: true,
      description: 'Unknown Claude model',
    };
  }

  private buildModelInfo(modelId: string): ModelInfo | null {
    const pricing = this.getModelPricing(modelId);

    return {
      id: modelId,
      name: modelId,
      description: pricing.description || `Anthropic ${modelId}`,
      contextWindow: pricing.contextWindow,
      maxOutputTokens: pricing.maxOutputTokens,
      inputCostPer1KTokens: pricing.inputCostPer1KTokens,
      outputCostPer1KTokens: pricing.outputCostPer1KTokens,
      supportsStreaming: true,
      supportsVision: pricing.supportsVision,
      supportsFunctions: pricing.supportsFunctions,
      metadata: {
        provider: 'anthropic',
        anthropicVersion: this.ANTHROPIC_VERSION,
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Export singleton instance
 */
export const anthropicAdapter = new AnthropicAdapter();
