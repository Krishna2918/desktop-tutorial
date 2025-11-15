/**
 * Provider Service
 *
 * Service layer that bridges AI provider adapters with the database.
 * Manages provider configurations, handles encryption/decryption,
 * and provides a unified interface for working with AI providers.
 */

import { Repository } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { AIProviderConfig } from '../entities/AIProviderConfig';
import { encryptionService } from './encryption.service';
import { providerRegistry } from '../adapters/ProviderRegistry';
import {
  AIProviderAdapter,
  ProviderConfig,
  MessageRequest,
  MessageResponse,
  MessageChunk,
  ModelInfo,
} from '../adapters/base/AIProviderAdapter.interface';

/**
 * Provider information for listing available providers
 */
export interface ProviderInfo {
  providerKey: string;
  providerName: string;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctions: boolean;
  isConfigured?: boolean;
}

/**
 * Data transfer object for creating provider configurations
 */
export interface CreateProviderConfigDTO {
  userId?: string;
  organizationId?: string;
  providerKey: string;
  displayName?: string;
  apiKey: string;
  apiEndpoint: string;
  settings?: Record<string, any>;
}

/**
 * Provider Service Error
 */
export class ProviderServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ProviderServiceError';
  }
}

/**
 * Provider Service
 */
export class ProviderService {
  private configRepository: Repository<AIProviderConfig>;

  constructor() {
    this.configRepository = AppDataSource.getRepository(AIProviderConfig);
  }

  /**
   * List all available providers from the registry
   */
  async listAvailableProviders(userId?: string): Promise<ProviderInfo[]> {
    const providerKeys = providerRegistry.getRegisteredProviders();
    const providers: ProviderInfo[] = [];

    // Get user's configured providers if userId is provided
    let configuredProviders: Set<string> = new Set();
    if (userId) {
      const configs = await this.configRepository.find({
        where: { userId, isActive: true },
        select: ['providerKey'],
      });
      configuredProviders = new Set(configs.map((c) => c.providerKey));
    }

    for (const providerKey of providerKeys) {
      const adapter = providerRegistry.createAdapter(providerKey);
      if (adapter) {
        providers.push({
          providerKey,
          providerName: adapter.providerName,
          supportsStreaming: adapter.supportsStreaming(),
          supportsVision: adapter.supportsVision(),
          supportsFunctions: adapter.supportsFunctions(),
          isConfigured: userId ? configuredProviders.has(providerKey) : undefined,
        });
      }
    }

    return providers;
  }

  /**
   * Get all provider configurations for a user
   */
  async getUserProviderConfigs(userId: string): Promise<AIProviderConfig[]> {
    if (!userId) {
      throw new ProviderServiceError(
        'User ID is required',
        'MISSING_USER_ID',
        400
      );
    }

    const configs = await this.configRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    return configs;
  }

  /**
   * Get a specific provider configuration by ID
   */
  async getProviderConfig(configId: string): Promise<AIProviderConfig> {
    const config = await this.configRepository.findOne({
      where: { id: configId },
    });

    if (!config) {
      throw new ProviderServiceError(
        `Provider configuration not found: ${configId}`,
        'CONFIG_NOT_FOUND',
        404
      );
    }

    return config;
  }

  /**
   * Create a new provider configuration
   */
  async createProviderConfig(
    dto: CreateProviderConfigDTO
  ): Promise<AIProviderConfig> {
    // Validate provider exists
    if (!providerRegistry.hasProvider(dto.providerKey)) {
      throw new ProviderServiceError(
        `Provider not found: ${dto.providerKey}`,
        'PROVIDER_NOT_FOUND',
        404
      );
    }

    // Ensure either userId or organizationId is provided
    if (!dto.userId && !dto.organizationId) {
      throw new ProviderServiceError(
        'Either userId or organizationId is required',
        'MISSING_OWNER',
        400
      );
    }

    // Validate API key and endpoint
    if (!dto.apiKey || dto.apiKey.trim() === '') {
      throw new ProviderServiceError(
        'API key is required',
        'MISSING_API_KEY',
        400
      );
    }

    if (!dto.apiEndpoint || dto.apiEndpoint.trim() === '') {
      throw new ProviderServiceError(
        'API endpoint is required',
        'MISSING_ENDPOINT',
        400
      );
    }

    // Encrypt the API key
    const apiKeyEncrypted = encryptionService.encrypt(dto.apiKey);

    // Create the configuration entity
    const config = this.configRepository.create({
      userId: dto.userId,
      organizationId: dto.organizationId,
      providerKey: dto.providerKey,
      displayName: dto.displayName || this.getDefaultDisplayName(dto.providerKey),
      apiKeyEncrypted,
      apiEndpoint: dto.apiEndpoint,
      settings: dto.settings || {},
      isActive: true,
    });

    // Save to database
    const savedConfig = await this.configRepository.save(config);

    return savedConfig;
  }

  /**
   * Update a provider configuration
   */
  async updateProviderConfig(
    configId: string,
    updates: {
      displayName?: string;
      apiKey?: string;
      apiEndpoint?: string;
      settings?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<AIProviderConfig> {
    const config = await this.getProviderConfig(configId);

    // Apply updates
    if (updates.displayName !== undefined) {
      config.displayName = updates.displayName;
    }

    if (updates.apiKey !== undefined) {
      config.apiKeyEncrypted = encryptionService.encrypt(updates.apiKey);
    }

    if (updates.apiEndpoint !== undefined) {
      config.apiEndpoint = updates.apiEndpoint;
    }

    if (updates.settings !== undefined) {
      config.settings = updates.settings;
    }

    if (updates.isActive !== undefined) {
      config.isActive = updates.isActive;
    }

    // Save updates
    const updatedConfig = await this.configRepository.save(config);

    return updatedConfig;
  }

  /**
   * Delete a provider configuration
   */
  async deleteProviderConfig(configId: string): Promise<void> {
    const config = await this.getProviderConfig(configId);

    // Soft delete by setting isActive to false
    config.isActive = false;
    await this.configRepository.save(config);

    // Or hard delete if preferred
    // await this.configRepository.remove(config);
  }

  /**
   * Test a provider configuration's connection
   */
  async testProviderConnection(configId: string): Promise<boolean> {
    const config = await this.getProviderConfig(configId);

    // Get the adapter
    const adapter = this.getAdapter(config.providerKey);

    // Decrypt API key and build provider config
    const providerConfig = this.buildProviderConfig(config);

    // Test the connection
    try {
      const result = await adapter.testConnection(providerConfig);
      return result;
    } catch (error) {
      throw new ProviderServiceError(
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONNECTION_TEST_FAILED',
        500
      );
    }
  }

  /**
   * Send a message using a provider configuration
   */
  async sendMessage(
    configId: string,
    request: MessageRequest
  ): Promise<MessageResponse> {
    const config = await this.getProviderConfig(configId);

    if (!config.isActive) {
      throw new ProviderServiceError(
        'Provider configuration is not active',
        'CONFIG_INACTIVE',
        400
      );
    }

    // Get the adapter
    const adapter = this.getAdapter(config.providerKey);

    // Decrypt API key and build provider config
    const providerConfig = this.buildProviderConfig(config);

    // Send the message
    try {
      const response = await adapter.sendMessage(providerConfig, request);

      // Update last used timestamp
      config.lastUsedAt = new Date();
      await this.configRepository.save(config);

      return response;
    } catch (error) {
      throw new ProviderServiceError(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEND_MESSAGE_FAILED',
        500
      );
    }
  }

  /**
   * Stream a message using a provider configuration
   */
  async *streamMessage(
    configId: string,
    request: MessageRequest
  ): AsyncGenerator<MessageChunk, void, unknown> {
    const config = await this.getProviderConfig(configId);

    if (!config.isActive) {
      throw new ProviderServiceError(
        'Provider configuration is not active',
        'CONFIG_INACTIVE',
        400
      );
    }

    // Get the adapter
    const adapter = this.getAdapter(config.providerKey);

    // Decrypt API key and build provider config
    const providerConfig = this.buildProviderConfig(config);

    // Stream the message
    try {
      const stream = adapter.streamMessage(providerConfig, request);

      for await (const chunk of stream) {
        yield chunk;
      }

      // Update last used timestamp
      config.lastUsedAt = new Date();
      await this.configRepository.save(config);
    } catch (error) {
      throw new ProviderServiceError(
        `Failed to stream message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STREAM_MESSAGE_FAILED',
        500
      );
    }
  }

  /**
   * Get available models for a provider configuration
   */
  async getModels(configId: string): Promise<ModelInfo[]> {
    const config = await this.getProviderConfig(configId);

    // Get the adapter
    const adapter = this.getAdapter(config.providerKey);

    // Decrypt API key and build provider config
    const providerConfig = this.buildProviderConfig(config);

    // Get models
    try {
      const models = await adapter.listModels(providerConfig);
      return models;
    } catch (error) {
      throw new ProviderServiceError(
        `Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LIST_MODELS_FAILED',
        500
      );
    }
  }

  /**
   * Get model information for a specific model
   */
  async getModelInfo(
    configId: string,
    modelId: string
  ): Promise<ModelInfo | null> {
    const config = await this.getProviderConfig(configId);

    // Get the adapter
    const adapter = this.getAdapter(config.providerKey);

    // Decrypt API key and build provider config
    const providerConfig = this.buildProviderConfig(config);

    // Get model info
    try {
      const modelInfo = await adapter.getModelInfo(providerConfig, modelId);
      return modelInfo;
    } catch (error) {
      throw new ProviderServiceError(
        `Failed to get model info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GET_MODEL_INFO_FAILED',
        500
      );
    }
  }

  /**
   * Estimate cost for a request
   */
  async estimateCost(
    configId: string,
    promptTokens: number,
    completionTokens: number,
    model: string
  ): Promise<number> {
    const config = await this.getProviderConfig(configId);

    // Get the adapter
    const adapter = this.getAdapter(config.providerKey);

    // Estimate cost
    try {
      const cost = adapter.estimateCost(promptTokens, completionTokens, model);
      return cost;
    } catch (error) {
      throw new ProviderServiceError(
        `Failed to estimate cost: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ESTIMATE_COST_FAILED',
        500
      );
    }
  }

  /**
   * Private helper methods
   */

  private getAdapter(providerKey: string): AIProviderAdapter {
    const adapter = providerRegistry.createAdapter(providerKey);

    if (!adapter) {
      throw new ProviderServiceError(
        `Provider adapter not found: ${providerKey}`,
        'ADAPTER_NOT_FOUND',
        404
      );
    }

    return adapter;
  }

  private buildProviderConfig(config: AIProviderConfig): ProviderConfig {
    // Decrypt API key
    const apiKey = encryptionService.decrypt(config.apiKeyEncrypted);

    // Build provider config
    const providerConfig: ProviderConfig = {
      apiKey,
      apiEndpoint: config.apiEndpoint,
      organizationId: config.settings?.organizationId,
      customHeaders: config.settings?.customHeaders,
      timeout: config.settings?.timeout,
      retryAttempts: config.settings?.retryAttempts,
      retryDelay: config.settings?.retryDelay,
      metadata: config.settings?.metadata,
    };

    return providerConfig;
  }

  private getDefaultDisplayName(providerKey: string): string {
    const adapter = providerRegistry.createAdapter(providerKey);
    return adapter?.providerName || providerKey;
  }
}

/**
 * Singleton instance
 */
export const providerService = new ProviderService();
