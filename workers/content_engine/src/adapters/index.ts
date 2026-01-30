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
export { OllamaAdapter } from './ollama_adapter';
export { MockLLMAdapter, createSEOMockAdapter } from './mock_adapter';

import type { LLMAdapter } from './llm_adapter';
import { OpenAIAdapter } from './openai_adapter';
import { AnthropicAdapter } from './anthropic_adapter';
import { OllamaAdapter } from './ollama_adapter';
import { MockLLMAdapter, createSEOMockAdapter } from './mock_adapter';

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'mock';

/**
 * AI Configuration from database
 */
export interface AIConfig {
  provider: LLMProvider;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  ollamaApiUrl?: string;
  ollamaModel?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Create LLM adapter based on configuration
 * Now accepts config from database instead of env vars
 */
export function createLLMAdapter(config: AIConfig): LLMAdapter {
  const provider = config.provider || 'mock';

  switch (provider) {
    case 'openai':
      if (!config.openaiApiKey) {
        console.warn('OpenAI API key not configured, falling back to mock');
        return createSEOMockAdapter();
      }
      return new OpenAIAdapter(config.openaiApiKey, {
        model: config.model || 'gpt-4o',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 4096,
      });

    case 'anthropic':
      if (!config.anthropicApiKey) {
        console.warn('Anthropic API key not configured, falling back to mock');
        return createSEOMockAdapter();
      }
      return new AnthropicAdapter(config.anthropicApiKey, {
        model: config.model || 'claude-3-sonnet-20240229',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 4096,
      });

    case 'ollama':
      return new OllamaAdapter({
        apiUrl: config.ollamaApiUrl || 'http://127.0.0.1:11434/v1/chat/completions',
        model: config.ollamaModel || 'llama3:8b',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 4096,
      });

    case 'mock':
      return createSEOMockAdapter();

    default:
      console.warn(`Unknown LLM provider: ${provider}, falling back to mock`);
      return createSEOMockAdapter();
  }
}

/**
 * Create adapter from legacy env-based config (for backward compatibility)
 */
export function createLLMAdapterFromEnv(): LLMAdapter {
  // Default to mock for now - actual config comes from database per request
  return createSEOMockAdapter();
}
