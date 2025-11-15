/**
 * AI Provider Adapters - Central Export
 *
 * This file initializes and exports all provider adapters.
 * Import this file to ensure all adapters are registered.
 */

import { providerRegistry } from './ProviderRegistry';
import { openaiAdapter } from './providers/openai.adapter';
import { anthropicAdapter } from './providers/anthropic.adapter';
import { geminiAdapter } from './providers/gemini.adapter';
import { metaAdapter } from './providers/meta.adapter';

/**
 * Initialize and register all provider adapters
 */
export function initializeProviderAdapters(): void {
  // Register all adapters
  providerRegistry.registerAdapter('openai', openaiAdapter);
  providerRegistry.registerAdapter('anthropic', anthropicAdapter);
  providerRegistry.registerAdapter('google', geminiAdapter); // Use 'google' as key for Gemini
  providerRegistry.registerAdapter('meta', metaAdapter);

  console.log(`Initialized ${providerRegistry.getAdapterCount()} AI provider adapters`);
}

// Auto-initialize on import
initializeProviderAdapters();

// Re-export everything for convenience
export { providerRegistry, ProviderRegistry } from './ProviderRegistry';
export { openaiAdapter } from './providers/openai.adapter';
export { anthropicAdapter } from './providers/anthropic.adapter';
export { geminiAdapter } from './providers/gemini.adapter';
export { metaAdapter } from './providers/meta.adapter';
export * from './base/AIProviderAdapter.interface';
