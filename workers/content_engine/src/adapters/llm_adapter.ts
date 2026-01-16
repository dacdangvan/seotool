/**
 * LLM Adapter Interface
 * 
 * Defines the contract for LLM providers.
 * Allows switching between OpenAI, Anthropic, or Mock implementations.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

/**
 * LLM Adapter Interface
 */
export interface LLMAdapter {
  /**
   * Generate completion from messages
   */
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /**
   * Generate completion from a simple prompt
   */
  completeText(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCompletionOptions
  ): Promise<string>;

  /**
   * Generate structured JSON output
   */
  completeJSON<T>(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCompletionOptions
  ): Promise<T>;
}
