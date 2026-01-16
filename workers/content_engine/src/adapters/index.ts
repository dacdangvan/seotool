/**
 * LLM Adapters
 * 
 * Exports all LLM adapter implementations.
 */

// Interface
export type {
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMAdapter,
} from './llm_adapter';

// Implementations
export { OpenAIAdapter } from './openai_adapter';
export { AnthropicAdapter } from './anthropic_adapter';
export { MockLLMAdapter, createSEOMockAdapter } from './mock_adapter';

import type { LLMAdapter } from './llm_adapter';
import { OpenAIAdapter } from './openai_adapter';
import { AnthropicAdapter } from './anthropic_adapter';
import { MockLLMAdapter, createSEOMockAdapter } from './mock_adapter';
import { loadConfig } from '../config';

export type LLMProvider = 'openai' | 'anthropic' | 'mock';

/**
 * Create LLM adapter based on configuration
 */
export function createLLMAdapter(provider?: LLMProvider): LLMAdapter {
  const config = loadConfig();
  const selectedProvider = provider || config.llmProvider;

  switch (selectedProvider) {
    case 'openai':
      if (!config.openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required for OpenAI provider');
      }
      return new OpenAIAdapter(config.openaiApiKey, {
        model: config.contentModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case 'anthropic':
      if (!config.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
      }
      return new AnthropicAdapter(config.anthropicApiKey, {
        model: config.contentModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case 'mock':
      return createSEOMockAdapter();

    default:
      throw new Error(`Unknown LLM provider: ${selectedProvider}`);
  }
}
