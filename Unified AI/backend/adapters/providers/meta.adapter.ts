/**
 * Meta AI (Llama) Provider Adapter
 *
 * Production-ready implementation of AIProviderAdapter for Meta's Llama models.
 * Supports Llama 3 models (8B, 70B) via OpenAI-compatible API format.
 * Compatible with llama.cpp server, Ollama, and other deployment methods.
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
 * Meta-specific error types
 */
class MetaError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public type?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'MetaError';
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends MetaError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429, 'rate_limit_error', true);
    this.name = 'RateLimitError';
  }
}

/**
 * OpenAI-compatible API request/response types (used by llama.cpp, Ollama, etc.)
 */
interface MetaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

interface MetaRequest {
  model: string;
  messages: MetaMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

interface MetaUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface MetaChoice {
  message?: {
    role: string;
    content: string;
  };
  delta?: {
    role?: string;
    content?: string;
  };
  finish_reason: string | null;
  index: number;
}

interface MetaResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: MetaChoice[];
  usage?: MetaUsage;
}

/**
 * Model pricing and capabilities database
 * Note: Llama models are open source and self-hosted, so costs are $0
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
  'llama-3-8b': {
    inputCostPer1KTokens: 0, // Self-hosted, no API costs
    outputCostPer1KTokens: 0,
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Llama 3 8B - Efficient open-source model (self-hosted)',
  },
  'llama-3-70b': {
    inputCostPer1KTokens: 0, // Self-hosted, no API costs
    outputCostPer1KTokens: 0,
    contextWindow: 8192,
    maxOutputTokens: 2048,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Llama 3 70B - Powerful open-source model (self-hosted)',
  },
  'llama-3.1-8b': {
    inputCostPer1KTokens: 0,
    outputCostPer1KTokens: 0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'Llama 3.1 8B - Extended context, tool use (self-hosted)',
  },
  'llama-3.1-70b': {
    inputCostPer1KTokens: 0,
    outputCostPer1KTokens: 0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'Llama 3.1 70B - Extended context, tool use (self-hosted)',
  },
  'llama-3.1-405b': {
    inputCostPer1KTokens: 0,
    outputCostPer1KTokens: 0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'Llama 3.1 405B - Largest open-source model (self-hosted)',
  },
  'llama-3.2-1b': {
    inputCostPer1KTokens: 0,
    outputCostPer1KTokens: 0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Llama 3.2 1B - Ultra-lightweight model (self-hosted)',
  },
  'llama-3.2-3b': {
    inputCostPer1KTokens: 0,
    outputCostPer1KTokens: 0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Llama 3.2 3B - Lightweight model (self-hosted)',
  },
};

/**
 * Meta AI Provider Adapter Implementation
 */
export class MetaAdapter implements AIProviderAdapter {
  readonly providerKey = 'meta';
  readonly providerName = 'Meta AI (Llama)';

  private activeRequests: Map<string, AbortController> = new Map();
  private requestCounter = 0;

  /**
   * Send a message to Meta/Llama API (non-streaming)
   */
  async sendMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): Promise<MessageResponse> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new MetaError(
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
   * Stream messages from Meta/Llama API using Server-Sent Events
   */
  async *streamMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): AsyncGenerator<MessageChunk, void, unknown> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new MetaError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const apiRequest = this.buildMetaRequest(request, true);
      const timeout = config.timeout || 120000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const response = await fetch(
          `${config.apiEndpoint}/v1/chat/completions`,
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
          throw new MetaError('Response body is null', 500, 'stream_error');
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

              if (!trimmedLine || trimmedLine === 'data: [DONE]') {
                continue;
              }

              if (trimmedLine.startsWith('data: ')) {
                const jsonData = trimmedLine.substring(6);

                try {
                  const parsed: MetaResponse = JSON.parse(jsonData);

                  if (parsed.choices && parsed.choices.length > 0) {
                    const choice = parsed.choices[0];
                    const content = choice.delta?.content || '';

                    if (content) {
                      accumulatedContent += content;
                      yield {
                        content,
                        done: false,
                      };
                    }

                    if (choice.finish_reason) {
                      finishReason = this.mapFinishReason(choice.finish_reason);
                    }
                  }

                  if (parsed.usage) {
                    usage = this.mapUsage(parsed.usage);
                  }
                } catch (parseError) {
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
   * List available models
   * Returns known Llama models since the endpoint may not provide a models list
   */
  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new MetaError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    // Try to fetch from the API endpoint if available
    try {
      const abortController = new AbortController();
      const timeout = config.timeout || 10000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const response = await fetch(`${config.apiEndpoint}/v1/models`, {
          method: 'GET',
          headers: this.buildHeaders(config),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data: any = await response.json();
          if (data.data && Array.isArray(data.data)) {
            return data.data
              .map((model: any) => this.buildModelInfo(model.id))
              .filter((info): info is ModelInfo => info !== null);
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // If fetching fails, fall back to known models
      console.warn('Failed to fetch models from endpoint, using known models');
    }

    // Return known Llama models
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
   * Uses character-based estimation (approximately 4 chars per token for Llama)
   */
  countTokens(text: string, model: string): number {
    const avgCharsPerToken = 4;
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
   * Note: Llama models are self-hosted and open source, so API costs are $0
   */
  estimateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    // Self-hosted models have no API costs
    return 0;
  }

  /**
   * Test connection to Meta/Llama API
   */
  async testConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const abortController = new AbortController();
      const timeout = config.timeout || 10000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        // Try to fetch models endpoint
        const response = await fetch(`${config.apiEndpoint}/v1/models`, {
          method: 'GET',
          headers: this.buildHeaders(config),
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

    // API key is optional for self-hosted endpoints
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
   * Self-hosted endpoints typically don't have rate limits, but we provide conservative defaults
   */
  getRateLimits(): RateLimitInfo {
    return {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000,
      requestsPerDay: 100000,
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
   * Llama 3 base models do not support vision
   */
  supportsVision(): boolean {
    return false;
  }

  /**
   * Check if functions are supported
   * Llama 3.1+ supports tool use
   */
  supportsFunctions(): boolean {
    return false; // Generally false, but 3.1+ can support it
  }

  /**
   * Private helper methods
   */

  private generateRequestId(): string {
    return `meta_${Date.now()}_${++this.requestCounter}`;
  }

  private buildHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided (some endpoints require it, others don't)
    if (config.apiKey && config.apiKey.trim() !== '') {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  private buildMetaRequest(
    request: MessageRequest,
    stream: boolean
  ): MetaRequest {
    const metaRequest: MetaRequest = {
      model: request.model,
      messages: request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
      })),
      stream,
    };

    if (request.temperature !== undefined) {
      metaRequest.temperature = request.temperature;
    }

    if (request.maxTokens !== undefined) {
      metaRequest.max_tokens = request.maxTokens;
    }

    if (request.topP !== undefined) {
      metaRequest.top_p = request.topP;
    }

    if (request.frequencyPenalty !== undefined) {
      metaRequest.frequency_penalty = request.frequencyPenalty;
    }

    if (request.presencePenalty !== undefined) {
      metaRequest.presence_penalty = request.presencePenalty;
    }

    if (request.stopSequences && request.stopSequences.length > 0) {
      metaRequest.stop = request.stopSequences;
    }

    return metaRequest;
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

        if (error instanceof MetaError) {
          if (!error.retryable || attempt >= maxRetries) {
            throw error;
          }

          if (error instanceof RateLimitError && error.retryAfter) {
            await this.sleep(error.retryAfter * 1000);
          }
        } else if (error instanceof Error && error.name === 'AbortError') {
          throw new MetaError('Request timeout', 408, 'timeout');
        } else {
          if (attempt >= maxRetries) {
            throw error;
          }
        }
      }
    }

    throw lastError || new MetaError('Request failed after retries', 500, 'retry_exhausted');
  }

  private async sendSingleRequest(
    config: ProviderConfig,
    request: MessageRequest,
    abortController: AbortController
  ): Promise<MessageResponse> {
    const apiRequest = this.buildMetaRequest(request, false);
    const timeout = config.timeout || 60000;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const response = await fetch(
        `${config.apiEndpoint}/v1/chat/completions`,
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

      const data: MetaResponse = await response.json();
      return this.mapMetaResponse(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseErrorResponse(response: Response): Promise<MetaError> {
    let errorMessage = `Meta/Llama API error: ${response.status} ${response.statusText}`;
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

    if (response.status >= 500) {
      retryable = true;
    }

    return new MetaError(errorMessage, response.status, errorType, retryable);
  }

  private mapMetaResponse(data: MetaResponse): MessageResponse {
    if (!data.choices || data.choices.length === 0) {
      throw new MetaError('No choices in response', 500, 'invalid_response');
    }

    const choice = data.choices[0];
    const content = choice.message?.content || '';
    const finishReason = this.mapFinishReason(choice.finish_reason || 'stop');

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
        created: data.created,
      },
    };
  }

  private mapFinishReason(
    reason: string | null
  ): MessageResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private mapUsage(usage: MetaUsage): TokenUsage {
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
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

    // Default based on model patterns
    if (normalizedModel.includes('3.2') && normalizedModel.includes('1b')) {
      return MODEL_PRICING['llama-3.2-1b'];
    }

    if (normalizedModel.includes('3.2') && normalizedModel.includes('3b')) {
      return MODEL_PRICING['llama-3.2-3b'];
    }

    if (normalizedModel.includes('3.1') && normalizedModel.includes('405b')) {
      return MODEL_PRICING['llama-3.1-405b'];
    }

    if (normalizedModel.includes('3.1') && normalizedModel.includes('70b')) {
      return MODEL_PRICING['llama-3.1-70b'];
    }

    if (normalizedModel.includes('3.1') && normalizedModel.includes('8b')) {
      return MODEL_PRICING['llama-3.1-8b'];
    }

    if (normalizedModel.includes('70b')) {
      return MODEL_PRICING['llama-3-70b'];
    }

    if (normalizedModel.includes('8b')) {
      return MODEL_PRICING['llama-3-8b'];
    }

    // Default fallback to llama-3-8b
    return {
      inputCostPer1KTokens: 0,
      outputCostPer1KTokens: 0,
      contextWindow: 8192,
      maxOutputTokens: 2048,
      supportsVision: false,
      supportsFunctions: false,
      description: 'Unknown Llama model (self-hosted)',
    };
  }

  private buildModelInfo(modelId: string): ModelInfo | null {
    const pricing = this.getModelPricing(modelId);

    return {
      id: modelId,
      name: modelId,
      description: pricing.description || `Meta ${modelId}`,
      contextWindow: pricing.contextWindow,
      maxOutputTokens: pricing.maxOutputTokens,
      inputCostPer1KTokens: pricing.inputCostPer1KTokens,
      outputCostPer1KTokens: pricing.outputCostPer1KTokens,
      supportsStreaming: true,
      supportsVision: pricing.supportsVision,
      supportsFunctions: pricing.supportsFunctions,
      metadata: {
        provider: 'meta',
        openSource: true,
        selfHosted: true,
        apiCost: 0,
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
export const metaAdapter = new MetaAdapter();
