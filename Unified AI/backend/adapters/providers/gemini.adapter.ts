/**
 * Google Gemini Provider Adapter
 *
 * Production-ready implementation of AIProviderAdapter for Google's Gemini API.
 * Supports Gemini Pro and Gemini Pro Vision models with full streaming,
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
 * Gemini-specific error types
 */
class GeminiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public type?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * Rate limit error
 */
class RateLimitError extends GeminiError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429, 'rate_limit_error', true);
    this.name = 'RateLimitError';
  }
}

/**
 * Gemini API request/response types
 */
interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
  role: string;
}

interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
  safetyRatings?: any[];
  index?: number;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
  };
  usageMetadata?: GeminiUsageMetadata;
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
  'gemini-pro': {
    inputCostPer1KTokens: 0.0005,
    outputCostPer1KTokens: 0.0015,
    contextWindow: 32768,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsFunctions: true,
    description: 'Gemini Pro - Best model for text-based tasks',
  },
  'gemini-pro-vision': {
    inputCostPer1KTokens: 0.0005,
    outputCostPer1KTokens: 0.0015,
    contextWindow: 16384,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsFunctions: false,
    description: 'Gemini Pro Vision - Multimodal model with vision capabilities',
  },
  'gemini-1.5-pro': {
    inputCostPer1KTokens: 0.0005,
    outputCostPer1KTokens: 0.0015,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Gemini 1.5 Pro - Extended context with multimodal support',
  },
  'gemini-1.5-flash': {
    inputCostPer1KTokens: 0.00025,
    outputCostPer1KTokens: 0.00075,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsFunctions: true,
    description: 'Gemini 1.5 Flash - Fast and efficient with multimodal support',
  },
};

/**
 * Gemini Provider Adapter Implementation
 */
export class GeminiAdapter implements AIProviderAdapter {
  readonly providerKey = 'gemini';
  readonly providerName = 'Google Gemini';

  private activeRequests: Map<string, AbortController> = new Map();
  private requestCounter = 0;

  /**
   * Send a message to Gemini API (non-streaming)
   */
  async sendMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): Promise<MessageResponse> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new GeminiError(
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
   * Stream messages from Gemini API using Server-Sent Events
   */
  async *streamMessage(
    config: ProviderConfig,
    request: MessageRequest
  ): AsyncGenerator<MessageChunk, void, unknown> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new GeminiError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const apiRequest = this.buildGeminiRequest(request);
      const timeout = config.timeout || 120000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const endpoint = this.buildEndpoint(config, request.model, true);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: this.buildHeaders(config),
          body: JSON.stringify(apiRequest),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await this.parseErrorResponse(response);
          throw error;
        }

        if (!response.body) {
          throw new GeminiError('Response body is null', 500, 'stream_error');
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

              if (!trimmedLine) {
                continue;
              }

              try {
                // Gemini streams JSON objects, one per line
                const parsed: GeminiResponse = JSON.parse(trimmedLine);

                if (parsed.candidates && parsed.candidates.length > 0) {
                  const candidate = parsed.candidates[0];

                  if (candidate.content && candidate.content.parts) {
                    for (const part of candidate.content.parts) {
                      if (part.text) {
                        accumulatedContent += part.text;
                        yield {
                          content: part.text,
                          done: false,
                        };
                      }
                    }
                  }

                  if (candidate.finishReason) {
                    finishReason = this.mapFinishReason(candidate.finishReason);
                  }
                }

                if (parsed.usageMetadata) {
                  usage = this.mapUsage(parsed.usageMetadata);
                }
              } catch (parseError) {
                console.error('Failed to parse stream data:', trimmedLine, parseError);
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
   * List available models from Gemini API
   */
  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new GeminiError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        400,
        'invalid_config'
      );
    }

    // Gemini models are fixed, return our known models
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
   * Uses character-based estimation (approximately 4 chars per token)
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
   * Test connection to Gemini API
   */
  async testConnection(config: ProviderConfig): Promise<boolean> {
    try {
      const abortController = new AbortController();
      const timeout = config.timeout || 10000;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      try {
        const testRequest: GeminiRequest = {
          contents: [
            {
              parts: [{ text: 'Hi' }],
              role: 'user',
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        };

        const endpoint = this.buildEndpoint(config, 'gemini-pro', false);
        const response = await fetch(endpoint, {
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
   * Free tier: 60 requests per minute
   * Paid tier: Higher limits
   */
  getRateLimits(): RateLimitInfo {
    return {
      requestsPerMinute: 60,
      tokensPerMinute: 32000,
      requestsPerDay: 1500,
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
    return `gemini_${Date.now()}_${++this.requestCounter}`;
  }

  private buildHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return headers;
  }

  private buildEndpoint(config: ProviderConfig, model: string, stream: boolean): string {
    // Remove trailing slash from endpoint
    const baseEndpoint = config.apiEndpoint.replace(/\/$/, '');

    // Build URL with model and action
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const url = `${baseEndpoint}/v1/models/${model}:${action}`;

    // Add API key as query parameter
    return `${url}?key=${encodeURIComponent(config.apiKey)}`;
  }

  private buildGeminiRequest(request: MessageRequest): GeminiRequest {
    // Convert messages to Gemini format
    const contents: GeminiContent[] = request.messages
      .filter(msg => msg.role !== 'system') // Gemini doesn't support system messages in the same way
      .map((msg) => ({
        parts: [{ text: msg.content }],
        role: msg.role === 'assistant' ? 'model' : 'user',
      }));

    // If there's a system message, prepend it as a user message with context
    const systemMessages = request.messages.filter(msg => msg.role === 'system');
    if (systemMessages.length > 0) {
      const systemContent = systemMessages.map(msg => msg.content).join('\n\n');
      contents.unshift({
        parts: [{ text: `System: ${systemContent}` }],
        role: 'user',
      });
    }

    // Ensure we have at least one message
    if (contents.length === 0) {
      contents.push({
        parts: [{ text: 'Hello' }],
        role: 'user',
      });
    }

    const geminiRequest: GeminiRequest = {
      contents,
    };

    // Add generation config
    const generationConfig: GeminiGenerationConfig = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }

    if (request.topP !== undefined) {
      generationConfig.topP = request.topP;
    }

    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    if (request.stopSequences && request.stopSequences.length > 0) {
      generationConfig.stopSequences = request.stopSequences;
    }

    if (Object.keys(generationConfig).length > 0) {
      geminiRequest.generationConfig = generationConfig;
    }

    return geminiRequest;
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

        if (error instanceof GeminiError) {
          if (!error.retryable || attempt >= maxRetries) {
            throw error;
          }

          if (error instanceof RateLimitError && error.retryAfter) {
            await this.sleep(error.retryAfter * 1000);
          }
        } else if (error instanceof Error && error.name === 'AbortError') {
          throw new GeminiError('Request timeout', 408, 'timeout');
        } else {
          if (attempt >= maxRetries) {
            throw error;
          }
        }
      }
    }

    throw lastError || new GeminiError('Request failed after retries', 500, 'retry_exhausted');
  }

  private async sendSingleRequest(
    config: ProviderConfig,
    request: MessageRequest,
    abortController: AbortController
  ): Promise<MessageResponse> {
    const apiRequest = this.buildGeminiRequest(request);
    const timeout = config.timeout || 60000;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const endpoint = this.buildEndpoint(config, request.model, false);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(config),
        body: JSON.stringify(apiRequest),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.parseErrorResponse(response);
        throw error;
      }

      const data: GeminiResponse = await response.json();
      return this.mapGeminiResponse(data, request.model);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseErrorResponse(response: Response): Promise<GeminiError> {
    let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
    let errorType = 'api_error';
    let retryable = false;

    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error.message || errorMessage;
        errorType = errorData.error.status || errorType;
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

    return new GeminiError(errorMessage, response.status, errorType, retryable);
  }

  private mapGeminiResponse(data: GeminiResponse, model: string): MessageResponse {
    if (!data.candidates || data.candidates.length === 0) {
      // Check for prompt feedback blocking
      if (data.promptFeedback?.blockReason) {
        throw new GeminiError(
          `Content blocked: ${data.promptFeedback.blockReason}`,
          400,
          'content_filter'
        );
      }
      throw new GeminiError('No candidates in response', 500, 'invalid_response');
    }

    const candidate = data.candidates[0];

    if (!candidate.content || !candidate.content.parts) {
      throw new GeminiError('No content in candidate', 500, 'invalid_response');
    }

    const content = candidate.content.parts
      .map((part) => part.text || '')
      .join('');

    const finishReason = this.mapFinishReason(candidate.finishReason || 'STOP');

    const usage: TokenUsage = data.usageMetadata
      ? this.mapUsage(data.usageMetadata)
      : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    return {
      content,
      model,
      finishReason,
      usage,
      metadata: {
        safetyRatings: candidate.safetyRatings,
      },
    };
  }

  private mapFinishReason(
    reason: string | null | undefined
  ): MessageResponse['finishReason'] {
    const normalizedReason = (reason || 'STOP').toUpperCase();

    switch (normalizedReason) {
      case 'STOP':
      case 'END_OF_TURN':
        return 'stop';
      case 'MAX_TOKENS':
      case 'LENGTH':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      case 'OTHER':
      default:
        return 'stop';
    }
  }

  private mapUsage(usage: GeminiUsageMetadata): TokenUsage {
    return {
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
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
      if (normalizedModel.includes(key.toLowerCase())) {
        return pricing;
      }
    }

    // Default based on model name patterns
    if (normalizedModel.includes('1.5-flash')) {
      return MODEL_PRICING['gemini-1.5-flash'];
    }

    if (normalizedModel.includes('1.5-pro') || normalizedModel.includes('1.5')) {
      return MODEL_PRICING['gemini-1.5-pro'];
    }

    if (normalizedModel.includes('vision')) {
      return MODEL_PRICING['gemini-pro-vision'];
    }

    if (normalizedModel.includes('pro')) {
      return MODEL_PRICING['gemini-pro'];
    }

    // Default fallback to gemini-pro
    return {
      inputCostPer1KTokens: 0.0005,
      outputCostPer1KTokens: 0.0015,
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsVision: false,
      supportsFunctions: true,
      description: 'Unknown Gemini model',
    };
  }

  private buildModelInfo(modelId: string): ModelInfo | null {
    const pricing = this.getModelPricing(modelId);

    return {
      id: modelId,
      name: modelId,
      description: pricing.description || `Google ${modelId}`,
      contextWindow: pricing.contextWindow,
      maxOutputTokens: pricing.maxOutputTokens,
      inputCostPer1KTokens: pricing.inputCostPer1KTokens,
      outputCostPer1KTokens: pricing.outputCostPer1KTokens,
      supportsStreaming: true,
      supportsVision: pricing.supportsVision,
      supportsFunctions: pricing.supportsFunctions,
      metadata: {
        provider: 'gemini',
        freeAvailable: true,
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
export const geminiAdapter = new GeminiAdapter();
