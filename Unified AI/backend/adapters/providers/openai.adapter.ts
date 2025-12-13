/**
 * OpenAI Provider Adapter
 *
 * Production-ready implementation of AIProviderAdapter for OpenAI's API.
 * Supports GPT-4, GPT-3.5, and other OpenAI models with full streaming,
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
 * OpenAI-specific error types
 */
class OpenAIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public type?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends OpenAIError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429, 'rate_limit_error', true);
    this.name = 'RateLimitError';
  }
}

/**
 * OpenAI API request/response types
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChoice {
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

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModel[];
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
  'gpt-4': {
    inputCostPer1KTokens: 0.03,
    outputCostPer1KTokens: 0.06,
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'Most capable GPT-4 model',
  },
  'gpt-4-32k': {
    inputCostPer1KTokens: 0.06,
    outputCostPer1KTokens: 0.12,
    contextWindow: 32768,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'GPT-4 with extended context',
  },
  'gpt-4-turbo': {
    inputCostPer1KTokens: 0.01,
    outputCostPer1KTokens: 0.03,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Latest GPT-4 Turbo with vision',
  },
  'gpt-4-turbo-preview': {
    inputCostPer1KTokens: 0.01,
    outputCostPer1KTokens: 0.03,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'GPT-4 Turbo preview',
  },
  'gpt-4-vision-preview': {
    inputCostPer1KTokens: 0.01,
    outputCostPer1KTokens: 0.03,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctions: false,
    description: 'GPT-4 with vision capabilities',
  },
  'gpt-3.5-turbo': {
    inputCostPer1KTokens: 0.0005,
    outputCostPer1KTokens: 0.0015,
    contextWindow: 16385,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'Fast and efficient GPT-3.5',
  },
  'gpt-3.5-turbo-16k': {
    inputCostPer1KTokens: 0.003,
    outputCostPer1KTokens: 0.004,
    contextWindow: 16385,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: true,
    description: 'GPT-3.5 with extended context',
  },
  'gpt-3.5-turbo-instruct': {
    inputCostPer1KTokens: 0.0015,
    outputCostPer1KTokens: 0.002,
    contextWindow: 4096,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsFunctions: false,
    description: 'Instruction-following GPT-3.5',
  },
};

/**
 * OpenAI Provider Adapter Implementation
 */
export class OpenAIAdapter implements AIProviderAdapter {
  readonly providerKey = 'openai';
  readonly providerName = 'OpenAI';

  private activeRequests: Map<string, AbortController> = new Map();
  private requestCounter = 0;

  /**
   * Send a message to OpenAI API (non-streaming)
   */
  async sendMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): Promise<MessageResponse> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new OpenAIError(
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
   * Stream messages from OpenAI API using Server-Sent Events
   */
  async *streamMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): AsyncGenerator<MessageChunk, void, unknown> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new OpenAIError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const apiRequest = this.buildOpenAIRequest(request, true);
      const timeout = config.timeout || 120000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const response = await fetch(
          `${config.apiEndpoint}/chat/completions`,
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
          throw new OpenAIError('Response body is null', 500, 'stream_error');
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
                  const parsed: OpenAIResponse = JSON.parse(jsonData);

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
   * List available models from OpenAI API
   */
  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new OpenAIError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    try {
      const abortController = new AbortController();
      const timeout = config.timeout || 30000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const response = await fetch(`${config.apiEndpoint}/models`, {
          method: 'GET',
          headers: this.buildHeaders(config),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw error;
        }

        const data: OpenAIModelsResponse = await response.json();

        return data.data
          .filter((model) => model.id.startsWith('gpt-'))
          .map((model) => this.buildModelInfo(model.id))
          .filter((info): info is ModelInfo => info !== null);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof OpenAIError) {
        throw error;
      }
      throw new OpenAIError(
        `Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'list_models_error'
      );
    }
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
   * Uses character-based estimation (approximately 4 chars per token for English)
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
   * Test connection to OpenAI API
   */
  async testConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const abortController = new AbortController();
      const timeout = config.timeout || 10000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const response = await fetch(`${config.apiEndpoint}/models`, {
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
      requestsPerMinute: 3500,
      tokensPerMinute: 90000,
      requestsPerDay: 10000,
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
    return `openai_${Date.now()}_${++this.requestCounter}`;
  }

  private buildHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    if (config.organizationId) {
      headers['OpenAI-Organization'] = config.organizationId;
    }

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  private buildOpenAIRequest(
    request: MessageRequest,
    stream: boolean
  ): OpenAIRequest {
    const openaiRequest: OpenAIRequest = {
      model: request.model,
      messages: request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
      })),
      stream,
    };

    if (request.temperature !== undefined) {
      openaiRequest.temperature = request.temperature;
    }

    if (request.maxTokens !== undefined) {
      openaiRequest.max_tokens = request.maxTokens;
    }

    if (request.topP !== undefined) {
      openaiRequest.top_p = request.topP;
    }

    if (request.frequencyPenalty !== undefined) {
      openaiRequest.frequency_penalty = request.frequencyPenalty;
    }

    if (request.presencePenalty !== undefined) {
      openaiRequest.presence_penalty = request.presencePenalty;
    }

    if (request.stopSequences && request.stopSequences.length > 0) {
      openaiRequest.stop = request.stopSequences;
    }

    return openaiRequest;
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

        if (error instanceof OpenAIError) {
          if (!error.retryable || attempt >= maxRetries) {
            throw error;
          }

          if (error instanceof RateLimitError && error.retryAfter) {
            await this.sleep(error.retryAfter * 1000);
          }
        } else if (error instanceof Error && error.name === 'AbortError') {
          throw new OpenAIError('Request timeout', 408, 'timeout');
        } else {
          if (attempt >= maxRetries) {
            throw error;
          }
        }
      }
    }

    throw lastError || new OpenAIError('Request failed after retries', 500, 'retry_exhausted');
  }

  private async sendSingleRequest(
    config: ProviderConfig,
    request: MessageRequest,
    abortController: AbortController
  ): Promise<MessageResponse> {
    const apiRequest = this.buildOpenAIRequest(request, false);
    const timeout = config.timeout || 60000;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const response = await fetch(
        `${config.apiEndpoint}/chat/completions`,
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

      const data: OpenAIResponse = await response.json();
      return this.mapOpenAIResponse(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseErrorResponse(response: Response): Promise<OpenAIError> {
    let errorMessage = `OpenAI API error: ${response.status} ${response.statusText}`;
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

    return new OpenAIError(errorMessage, response.status, errorType, retryable);
  }

  private mapOpenAIResponse(data: OpenAIResponse): MessageResponse {
    if (!data.choices || data.choices.length === 0) {
      throw new OpenAIError('No choices in response', 500, 'invalid_response');
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

  private mapUsage(usage: OpenAIUsage): TokenUsage {
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

    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key) || normalizedModel === key) {
        return pricing;
      }
    }

    if (normalizedModel.includes('gpt-4')) {
      return MODEL_PRICING['gpt-4-turbo'];
    }

    if (normalizedModel.includes('gpt-3.5')) {
      return MODEL_PRICING['gpt-3.5-turbo'];
    }

    return {
      inputCostPer1KTokens: 0.01,
      outputCostPer1KTokens: 0.03,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsFunctions: true,
      description: 'Unknown model',
    };
  }

  private buildModelInfo(modelId: string): ModelInfo | null {
    const pricing = this.getModelPricing(modelId);

    return {
      id: modelId,
      name: modelId,
      description: pricing.description || `OpenAI ${modelId}`,
      contextWindow: pricing.contextWindow,
      maxOutputTokens: pricing.maxOutputTokens,
      inputCostPer1KTokens: pricing.inputCostPer1KTokens,
      outputCostPer1KTokens: pricing.outputCostPer1KTokens,
      supportsStreaming: true,
      supportsVision: pricing.supportsVision,
      supportsFunctions: pricing.supportsFunctions,
      metadata: {
        provider: 'openai',
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
export const openaiAdapter = new OpenAIAdapter();
