/**
 * Phase 3 - AI Provider Adapters Tests
 *
 * Comprehensive test suite validating:
 * - Adapter Interface Compliance (all 4 adapters)
 * - Provider Registry
 * - Configuration Management
 * - Provider-Specific Features
 * - Rate Limiting and Retry Logic
 * - Streaming Support
 * - Cost Calculation
 * - Provider Neutrality (orchestration uses only interface)
 * - Encryption of API Keys
 */

import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { encryptionService } from '../services/encryption.service';
import { providerService, ProviderServiceError } from '../services/provider.service';
import { providerRegistry } from '../adapters/ProviderRegistry';
import { openaiAdapter } from '../adapters/providers/openai.adapter';
import { anthropicAdapter } from '../adapters/providers/anthropic.adapter';
import { geminiAdapter } from '../adapters/providers/gemini.adapter';
import { metaAdapter } from '../adapters/providers/meta.adapter';
import {
  AIProviderAdapter,
  ProviderConfig,
  MessageRequest,
  MessageResponse,
  MessageChunk,
  ModelInfo,
} from '../adapters/base/AIProviderAdapter.interface';
import { User } from '../entities/User';
import { AIProviderConfig } from '../entities/AIProviderConfig';

// Mock fetch globally
global.fetch = jest.fn();

describe('Phase 3: AI Provider Adapters', () => {
  let dataSource: DataSource;
  let testUser: User;

  beforeAll(async () => {
    // Initialize test database
    dataSource = await AppDataSource.initialize();

    // Create test user
    const userRepo = dataSource.getRepository(User);
    testUser = userRepo.create({
      email: 'provider-test@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Provider Test User',
      emailVerified: true,
    });
    testUser = await userRepo.save(testUser);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(() => {
    // Clear mock calls before each test
    jest.clearAllMocks();
  });

  describe('Test Suite 1: Adapter Interface Compliance', () => {
    const adapters: Array<{ name: string; adapter: AIProviderAdapter }> = [
      { name: 'OpenAI', adapter: openaiAdapter },
      { name: 'Anthropic', adapter: anthropicAdapter },
      { name: 'Gemini', adapter: geminiAdapter },
      { name: 'Meta', adapter: metaAdapter },
    ];

    adapters.forEach(({ name, adapter }) => {
      describe(`${name} Adapter`, () => {
        test('1.1 Adapter has required properties', () => {
          expect(adapter.providerKey).toBeDefined();
          expect(typeof adapter.providerKey).toBe('string');
          expect(adapter.providerName).toBeDefined();
          expect(typeof adapter.providerName).toBe('string');
        });

        test('1.2 Adapter implements core methods', () => {
          expect(typeof adapter.sendMessage).toBe('function');
          expect(typeof adapter.streamMessage).toBe('function');
          expect(typeof adapter.listModels).toBe('function');
          expect(typeof adapter.getModelInfo).toBe('function');
          expect(typeof adapter.countTokens).toBe('function');
          expect(typeof adapter.getContextLimit).toBe('function');
          expect(typeof adapter.estimateCost).toBe('function');
          expect(typeof adapter.testConnection).toBe('function');
          expect(typeof adapter.validateConfig).toBe('function');
          expect(typeof adapter.getRateLimits).toBe('function');
          expect(typeof adapter.cancelRequest).toBe('function');
        });

        test('1.3 Adapter implements capability methods', () => {
          expect(typeof adapter.supportsStreaming).toBe('function');
          expect(typeof adapter.supportsVision).toBe('function');
          expect(typeof adapter.supportsFunctions).toBe('function');

          // All methods should return boolean
          expect(typeof adapter.supportsStreaming()).toBe('boolean');
          expect(typeof adapter.supportsVision()).toBe('boolean');
          expect(typeof adapter.supportsFunctions()).toBe('boolean');
        });

        test('1.4 validateConfig detects missing API key', () => {
          const config: ProviderConfig = {
            apiKey: '',
            apiEndpoint: 'https://api.example.com',
          };

          const result = adapter.validateConfig(config);
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some((e) => e.toLowerCase().includes('api key'))).toBe(true);
        });

        test('1.5 validateConfig detects missing endpoint', () => {
          const config: ProviderConfig = {
            apiKey: 'test-key',
            apiEndpoint: '',
          };

          const result = adapter.validateConfig(config);
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some((e) => e.toLowerCase().includes('endpoint'))).toBe(true);
        });

        test('1.6 validateConfig accepts valid config', () => {
          const config: ProviderConfig = {
            apiKey: 'test-key-12345',
            apiEndpoint: 'https://api.example.com',
          };

          const result = adapter.validateConfig(config);
          expect(result.valid).toBe(true);
          expect(result.errors.length).toBe(0);
        });

        test('1.7 getRateLimits returns valid structure', () => {
          const rateLimits = adapter.getRateLimits();
          expect(rateLimits).toBeDefined();
          expect(typeof rateLimits.requestsPerMinute).toBe('number');
          expect(typeof rateLimits.tokensPerMinute).toBe('number');
          expect(rateLimits.requestsPerMinute).toBeGreaterThan(0);
          expect(rateLimits.tokensPerMinute).toBeGreaterThan(0);
        });

        test('1.8 countTokens returns positive number', () => {
          const text = 'Hello, world! This is a test message.';
          const tokens = adapter.countTokens(text, 'test-model');
          expect(typeof tokens).toBe('number');
          expect(tokens).toBeGreaterThan(0);
        });

        test('1.9 getContextLimit returns positive number', () => {
          const limit = adapter.getContextLimit('test-model');
          expect(typeof limit).toBe('number');
          expect(limit).toBeGreaterThan(0);
        });

        test('1.10 estimateCost returns non-negative number', () => {
          const cost = adapter.estimateCost(100, 50, 'test-model');
          expect(typeof cost).toBe('number');
          expect(cost).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe('Test Suite 2: Provider Registry', () => {
    test('2.1 Registry is a singleton', () => {
      const registry1 = providerRegistry;
      const registry2 = providerRegistry;
      expect(registry1).toBe(registry2);
    });

    test('2.2 Registry has all 4 providers registered', () => {
      const providers = providerRegistry.getRegisteredProviders();
      expect(providers.length).toBeGreaterThanOrEqual(4);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google'); // Gemini uses 'google' key
      expect(providers).toContain('meta');
    });

    test('2.3 Registry can create adapters', () => {
      const openai = providerRegistry.createAdapter('openai');
      expect(openai).toBeDefined();
      expect(openai?.providerKey).toBe('openai');

      const anthropic = providerRegistry.createAdapter('anthropic');
      expect(anthropic).toBeDefined();
      expect(anthropic?.providerKey).toBe('anthropic');
    });

    test('2.4 Registry returns null for unknown provider', () => {
      const unknown = providerRegistry.createAdapter('unknown-provider');
      expect(unknown).toBeNull();
    });

    test('2.5 Registry can check provider existence', () => {
      expect(providerRegistry.hasProvider('openai')).toBe(true);
      expect(providerRegistry.hasProvider('anthropic')).toBe(true);
      expect(providerRegistry.hasProvider('unknown')).toBe(false);
    });

    test('2.6 Registry can register new adapter', () => {
      // Create a mock adapter
      const mockAdapter: AIProviderAdapter = {
        providerKey: 'test-provider',
        providerName: 'Test Provider',
        sendMessage: jest.fn(),
        streamMessage: jest.fn(),
        listModels: jest.fn(),
        getModelInfo: jest.fn(),
        countTokens: jest.fn(),
        getContextLimit: jest.fn(),
        estimateCost: jest.fn(),
        testConnection: jest.fn(),
        validateConfig: jest.fn(),
        getRateLimits: jest.fn(),
        cancelRequest: jest.fn(),
        supportsStreaming: () => true,
        supportsVision: () => false,
        supportsFunctions: () => true,
      };

      // Register the adapter
      providerRegistry.registerAdapter('test-provider', mockAdapter);

      // Verify it was registered
      expect(providerRegistry.hasProvider('test-provider')).toBe(true);

      const retrieved = providerRegistry.createAdapter('test-provider');
      expect(retrieved).toBe(mockAdapter);

      // Clean up
      providerRegistry.unregisterAdapter('test-provider');
    });
  });

  describe('Test Suite 3: Configuration Management', () => {
    let configId: string;

    test('3.1 Create provider configuration', async () => {
      const config = await providerService.createProviderConfig({
        userId: testUser.id,
        providerKey: 'openai',
        displayName: 'My OpenAI Config',
        apiKey: 'sk-test-key-12345',
        apiEndpoint: 'https://api.openai.com/v1',
        settings: {
          timeout: 30000,
        },
      });

      expect(config.id).toBeDefined();
      expect(config.userId).toBe(testUser.id);
      expect(config.providerKey).toBe('openai');
      expect(config.displayName).toBe('My OpenAI Config');
      expect(config.apiEndpoint).toBe('https://api.openai.com/v1');
      expect(config.isActive).toBe(true);
      expect(config.apiKeyEncrypted).toBeDefined();
      expect(config.apiKeyEncrypted).not.toBe('sk-test-key-12345');

      configId = config.id;
    });

    test('3.2 API key is encrypted in database', async () => {
      const configRepo = dataSource.getRepository(AIProviderConfig);
      const config = await configRepo.findOne({ where: { id: configId } });

      expect(config).toBeDefined();
      expect(config!.apiKeyEncrypted).toBeDefined();
      expect(config!.apiKeyEncrypted).not.toBe('sk-test-key-12345');

      // Verify we can decrypt it
      const decrypted = encryptionService.decrypt(config!.apiKeyEncrypted);
      expect(decrypted).toBe('sk-test-key-12345');
    });

    test('3.3 List user provider configurations', async () => {
      const configs = await providerService.getUserProviderConfigs(testUser.id);

      expect(configs.length).toBeGreaterThan(0);
      expect(configs.some((c) => c.id === configId)).toBe(true);
    });

    test('3.4 Get single provider configuration', async () => {
      const config = await providerService.getProviderConfig(configId);

      expect(config).toBeDefined();
      expect(config.id).toBe(configId);
      expect(config.providerKey).toBe('openai');
    });

    test('3.5 Update provider configuration', async () => {
      const updated = await providerService.updateProviderConfig(configId, {
        displayName: 'Updated OpenAI Config',
        settings: {
          timeout: 60000,
          retryAttempts: 5,
        },
      });

      expect(updated.displayName).toBe('Updated OpenAI Config');
      expect(updated.settings?.timeout).toBe(60000);
      expect(updated.settings?.retryAttempts).toBe(5);
    });

    test('3.6 Update API key re-encrypts', async () => {
      const configRepo = dataSource.getRepository(AIProviderConfig);
      const originalConfig = await configRepo.findOne({ where: { id: configId } });
      const originalEncrypted = originalConfig!.apiKeyEncrypted;

      await providerService.updateProviderConfig(configId, {
        apiKey: 'sk-new-key-67890',
      });

      const updatedConfig = await configRepo.findOne({ where: { id: configId } });
      expect(updatedConfig!.apiKeyEncrypted).not.toBe(originalEncrypted);

      const decrypted = encryptionService.decrypt(updatedConfig!.apiKeyEncrypted);
      expect(decrypted).toBe('sk-new-key-67890');
    });

    test('3.7 Cannot create config for unknown provider', async () => {
      await expect(
        providerService.createProviderConfig({
          userId: testUser.id,
          providerKey: 'unknown-provider',
          apiKey: 'test-key',
          apiEndpoint: 'https://api.example.com',
        })
      ).rejects.toThrow(ProviderServiceError);
    });

    test('3.8 Cannot create config without userId or organizationId', async () => {
      await expect(
        providerService.createProviderConfig({
          providerKey: 'openai',
          apiKey: 'test-key',
          apiEndpoint: 'https://api.example.com',
        })
      ).rejects.toThrow(ProviderServiceError);
    });

    test('3.9 Cannot create config without API key', async () => {
      await expect(
        providerService.createProviderConfig({
          userId: testUser.id,
          providerKey: 'openai',
          apiKey: '',
          apiEndpoint: 'https://api.example.com',
        })
      ).rejects.toThrow(ProviderServiceError);
    });

    test('3.10 Delete provider configuration', async () => {
      await providerService.deleteProviderConfig(configId);

      const config = await providerService.getProviderConfig(configId);
      expect(config.isActive).toBe(false);
    });
  });

  describe('Test Suite 4: Provider-Specific Features', () => {
    test('4.1 OpenAI adapter reports correct capabilities', () => {
      expect(openaiAdapter.supportsStreaming()).toBe(true);
      expect(openaiAdapter.supportsVision()).toBe(true);
      expect(openaiAdapter.supportsFunctions()).toBe(true);
    });

    test('4.2 Anthropic adapter reports correct capabilities', () => {
      expect(anthropicAdapter.supportsStreaming()).toBe(true);
      expect(anthropicAdapter.supportsVision()).toBe(true);
      expect(anthropicAdapter.supportsFunctions()).toBe(true);
    });

    test('4.3 Gemini adapter reports correct capabilities', () => {
      expect(geminiAdapter.supportsStreaming()).toBe(true);
      // Capabilities may vary
      expect(typeof geminiAdapter.supportsVision()).toBe('boolean');
      expect(typeof geminiAdapter.supportsFunctions()).toBe('boolean');
    });

    test('4.4 Meta adapter reports correct capabilities', () => {
      expect(metaAdapter.supportsStreaming()).toBe(true);
      // Capabilities may vary
      expect(typeof metaAdapter.supportsVision()).toBe('boolean');
      expect(typeof metaAdapter.supportsFunctions()).toBe('boolean');
    });

    test('4.5 Each adapter has unique provider key', () => {
      const keys = new Set([
        openaiAdapter.providerKey,
        anthropicAdapter.providerKey,
        geminiAdapter.providerKey,
        metaAdapter.providerKey,
      ]);

      expect(keys.size).toBe(4);
    });
  });

  describe('Test Suite 5: Rate Limiting and Retry Logic', () => {
    test('5.1 OpenAI adapter handles rate limit error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // First call returns rate limit error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'retry-after': '1' }),
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
          },
        }),
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Hello!' },
              finish_reason: 'stop',
              index: 0,
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      } as Response);

      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.openai.com/v1',
        retryAttempts: 2,
        retryDelay: 100,
      };

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
      };

      const response = await openaiAdapter.sendMessage(config, request);
      expect(response.content).toBe('Hello!');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('5.2 Adapter retries on server error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // First call returns server error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: {
            message: 'Internal server error',
            type: 'server_error',
          },
        }),
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Recovered!' },
              finish_reason: 'stop',
              index: 0,
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      } as Response);

      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.openai.com/v1',
        retryAttempts: 2,
        retryDelay: 100,
      };

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
      };

      const response = await openaiAdapter.sendMessage(config, request);
      expect(response.content).toBe('Recovered!');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('5.3 Adapter fails after max retries', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // All calls return server error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: {
            message: 'Internal server error',
            type: 'server_error',
          },
        }),
      } as Response);

      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.openai.com/v1',
        retryAttempts: 2,
        retryDelay: 100,
      };

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
      };

      await expect(openaiAdapter.sendMessage(config, request)).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Test Suite 6: Streaming Support', () => {
    test('6.1 OpenAI adapter streams messages', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // Create a mock readable stream
      const stream = new ReadableStream({
        start(controller) {
          const chunks = [
            'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null,"index":0}]}\n\n',
            'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null,"index":0}]}\n\n',
            'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop","index":0}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\n\n',
            'data: [DONE]\n\n',
          ];

          chunks.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
      } as Response);

      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.openai.com/v1',
      };

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        stream: true,
      };

      const chunks: MessageChunk[] = [];
      for await (const chunk of openaiAdapter.streamMessage(config, request)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);

      // Check content chunks
      const contentChunks = chunks.filter((c) => !c.done);
      expect(contentChunks.length).toBeGreaterThan(0);
      expect(contentChunks.some((c) => c.content.includes('Hello'))).toBe(true);

      // Check final chunk
      const finalChunk = chunks[chunks.length - 1];
      expect(finalChunk.done).toBe(true);
      expect(finalChunk.usage).toBeDefined();
    });

    test('6.2 All streaming-capable adapters implement AsyncGenerator', () => {
      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.example.com',
      };

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
      };

      // Check that streamMessage returns an async generator
      const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, metaAdapter];

      adapters.forEach((adapter) => {
        if (adapter.supportsStreaming()) {
          const stream = adapter.streamMessage(config, request);
          expect(stream[Symbol.asyncIterator]).toBeDefined();
          expect(typeof stream[Symbol.asyncIterator]).toBe('function');
        }
      });
    });
  });

  describe('Test Suite 7: Cost Calculation', () => {
    test('7.1 Cost calculation is consistent', () => {
      const promptTokens = 1000;
      const completionTokens = 500;

      const adapters = [
        { name: 'OpenAI', adapter: openaiAdapter, model: 'gpt-4' },
        { name: 'Anthropic', adapter: anthropicAdapter, model: 'claude-3-opus-20240229' },
        { name: 'Gemini', adapter: geminiAdapter, model: 'gemini-pro' },
        { name: 'Meta', adapter: metaAdapter, model: 'llama-2-70b' },
      ];

      adapters.forEach(({ name, adapter, model }) => {
        const cost = adapter.estimateCost(promptTokens, completionTokens, model);
        expect(typeof cost).toBe('number');
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(1000); // Sanity check

        // Cost should scale linearly with tokens
        const doubleCost = adapter.estimateCost(promptTokens * 2, completionTokens * 2, model);
        expect(doubleCost).toBeCloseTo(cost * 2, 5);
      });
    });

    test('7.2 Zero tokens result in zero cost', () => {
      const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, metaAdapter];

      adapters.forEach((adapter) => {
        const cost = adapter.estimateCost(0, 0, 'test-model');
        expect(cost).toBe(0);
      });
    });
  });

  describe('Test Suite 8: Provider Neutrality', () => {
    test('8.1 Orchestration can use any adapter via interface', () => {
      // Simulate an orchestration layer that only knows about the interface
      function processWithProvider(adapter: AIProviderAdapter, model: string): number {
        // This function only uses interface methods
        const tokens = adapter.countTokens('Test message', model);
        const limit = adapter.getContextLimit(model);
        const cost = adapter.estimateCost(tokens, tokens, model);

        return cost;
      }

      // All adapters should work identically from orchestration perspective
      const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, metaAdapter];

      adapters.forEach((adapter) => {
        const result = processWithProvider(adapter, 'test-model');
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
      });
    });

    test('8.2 Adding new provider requires no orchestration changes', () => {
      // Create a new mock adapter
      const newAdapter: AIProviderAdapter = {
        providerKey: 'new-provider',
        providerName: 'New Provider',
        sendMessage: async () => ({
          content: 'Test',
          model: 'test',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }),
        streamMessage: async function* () {
          yield { content: 'Test', done: true };
        },
        listModels: async () => [],
        getModelInfo: async () => null,
        countTokens: () => 10,
        getContextLimit: () => 8192,
        estimateCost: () => 0.001,
        testConnection: async () => true,
        validateConfig: () => ({ valid: true, errors: [] }),
        getRateLimits: () => ({
          requestsPerMinute: 100,
          tokensPerMinute: 10000,
        }),
        cancelRequest: async () => {},
        supportsStreaming: () => true,
        supportsVision: () => false,
        supportsFunctions: () => false,
      };

      // Register the new adapter
      providerRegistry.registerAdapter('new-provider', newAdapter);

      // The same orchestration code should work
      function orchestrate(providerKey: string): boolean {
        const adapter = providerRegistry.createAdapter(providerKey);
        if (!adapter) return false;

        // Use interface methods
        const tokens = adapter.countTokens('Test', 'model');
        const canStream = adapter.supportsStreaming();

        return tokens > 0 && typeof canStream === 'boolean';
      }

      // Works with existing providers
      expect(orchestrate('openai')).toBe(true);
      expect(orchestrate('anthropic')).toBe(true);

      // Works with new provider without code changes
      expect(orchestrate('new-provider')).toBe(true);

      // Clean up
      providerRegistry.unregisterAdapter('new-provider');
    });

    test('8.3 All adapters handle same message request structure', () => {
      const request: MessageRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 100,
      };

      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.example.com',
      };

      const adapters = [openaiAdapter, anthropicAdapter, geminiAdapter, metaAdapter];

      // All adapters should validate the same config structure
      adapters.forEach((adapter) => {
        const validation = adapter.validateConfig(config);
        expect(validation).toHaveProperty('valid');
        expect(validation).toHaveProperty('errors');
        expect(Array.isArray(validation.errors)).toBe(true);
      });
    });
  });

  describe('Test Suite 9: Service Layer Integration', () => {
    let testConfigId: string;

    beforeAll(async () => {
      // Create a test configuration
      const config = await providerService.createProviderConfig({
        userId: testUser.id,
        providerKey: 'openai',
        displayName: 'Integration Test Config',
        apiKey: 'sk-integration-test-key',
        apiEndpoint: 'https://api.openai.com/v1',
      });
      testConfigId = config.id;
    });

    afterAll(async () => {
      // Clean up
      try {
        await providerService.deleteProviderConfig(testConfigId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('9.1 Service layer lists available providers', async () => {
      const providers = await providerService.listAvailableProviders();

      expect(providers.length).toBeGreaterThanOrEqual(4);
      expect(providers.every((p) => p.providerKey)).toBe(true);
      expect(providers.every((p) => p.providerName)).toBe(true);
      expect(providers.every((p) => typeof p.supportsStreaming === 'boolean')).toBe(true);
    });

    test('9.2 Service layer lists providers with user context', async () => {
      const providers = await providerService.listAvailableProviders(testUser.id);

      expect(providers.length).toBeGreaterThanOrEqual(4);

      // At least one should be configured (our test config)
      expect(providers.some((p) => p.isConfigured === true)).toBe(true);
      expect(providers.some((p) => p.providerKey === 'openai' && p.isConfigured === true)).toBe(
        true
      );
    });

    test('9.3 Service layer decrypts API keys for adapter calls', async () => {
      const config = await providerService.getProviderConfig(testConfigId);

      // API key should be encrypted in database
      expect(config.apiKeyEncrypted).toBeDefined();
      expect(config.apiKeyEncrypted).not.toBe('sk-integration-test-key');

      // But when we decrypt it, we should get the original
      const decrypted = encryptionService.decrypt(config.apiKeyEncrypted);
      expect(decrypted).toBe('sk-integration-test-key');
    });

    test('9.4 Service layer test connection uses adapter', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      const result = await providerService.testProviderConnection(testConfigId);

      expect(typeof result).toBe('boolean');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.openai.com/v1'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-integration-test-key',
          }),
        })
      );
    });

    test('9.5 Service prevents using inactive configurations', async () => {
      // Deactivate config
      await providerService.updateProviderConfig(testConfigId, { isActive: false });

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4',
      };

      // Should throw error
      await expect(providerService.sendMessage(testConfigId, request)).rejects.toThrow(
        ProviderServiceError
      );

      // Reactivate for cleanup
      await providerService.updateProviderConfig(testConfigId, { isActive: true });
    });
  });

  describe('Test Suite 10: Error Handling', () => {
    test('10.1 Service handles missing configuration gracefully', async () => {
      await expect(providerService.getProviderConfig('non-existent-id')).rejects.toThrow(
        ProviderServiceError
      );
    });

    test('10.2 Service validates provider existence', async () => {
      await expect(
        providerService.createProviderConfig({
          userId: testUser.id,
          providerKey: 'invalid-provider',
          apiKey: 'test',
          apiEndpoint: 'https://api.example.com',
        })
      ).rejects.toThrow(ProviderServiceError);
    });

    test('10.3 Adapters handle malformed responses', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}), // Malformed response
      } as Response);

      const config: ProviderConfig = {
        apiKey: 'test-key',
        apiEndpoint: 'https://api.openai.com/v1',
      };

      const request: MessageRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4',
      };

      await expect(openaiAdapter.sendMessage(config, request)).rejects.toThrow();
    });
  });
});
