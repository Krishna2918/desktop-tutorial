/**
 * Provider Registry
 *
 * Central registry for all AI provider adapters.
 * Implements the factory pattern for adapter creation.
 */

import {
  AIProviderAdapter,
  ProviderAdapterFactory
} from './base/AIProviderAdapter.interface';

export class ProviderRegistry implements ProviderAdapterFactory {
  private static instance: ProviderRegistry;
  private adapters: Map<string, AIProviderAdapter> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register an adapter for a provider
   */
  registerAdapter(providerKey: string, adapter: AIProviderAdapter): void {
    if (this.adapters.has(providerKey)) {
      console.warn(`Provider adapter '${providerKey}' is already registered. Overwriting...`);
    }

    this.adapters.set(providerKey, adapter);
    console.log(`Registered AI provider adapter: ${providerKey}`);
  }

  /**
   * Create (retrieve) an adapter instance for a provider
   */
  createAdapter(providerKey: string): AIProviderAdapter | null {
    const adapter = this.adapters.get(providerKey);

    if (!adapter) {
      console.error(`No adapter registered for provider: ${providerKey}`);
      return null;
    }

    return adapter;
  }

  /**
   * Get all registered provider keys
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(providerKey: string): boolean {
    return this.adapters.has(providerKey);
  }

  /**
   * Unregister a provider adapter
   */
  unregisterAdapter(providerKey: string): boolean {
    return this.adapters.delete(providerKey);
  }

  /**
   * Clear all registered adapters
   */
  clearAll(): void {
    this.adapters.clear();
  }

  /**
   * Get adapter count
   */
  getAdapterCount(): number {
    return this.adapters.size;
  }
}

// Singleton instance
export const providerRegistry = ProviderRegistry.getInstance();
