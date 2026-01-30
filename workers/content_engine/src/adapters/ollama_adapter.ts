/**
 * Ollama LLM Adapter
 * 
 * Adapter for local Ollama LLM (FREE - no API key needed)
 */

import type { LLMAdapter, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from './llm_adapter';

export interface OllamaConfig {
  apiUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export class OllamaAdapter implements LLMAdapter {
  private apiUrl: string;
  private model: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: OllamaConfig) {
    this.apiUrl = config.apiUrl || 'http://127.0.0.1:11434/v1/chat/completions';
    this.model = config.model || 'llama3:8b';
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens ?? 4096;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min timeout

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || this.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? this.defaultTemperature,
          stream: false,
          options: {
            num_predict: options?.maxTokens ?? this.defaultMaxTokens,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(`Ollama API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || data.message?.content || '';

      return {
        content,
        model: this.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timeout (10 min)');
      }
      throw error;
    }
  }

  async completeText(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCompletionOptions
  ): Promise<string> {
    const messages: LLMMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await this.complete(messages, options);
    return result.content;
  }

  async completeJSON<T>(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCompletionOptions
  ): Promise<T> {
    const jsonSystemPrompt = `${systemPrompt || ''}\n\nYou MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.`;
    
    const result = await this.completeText(prompt, jsonSystemPrompt, options);
    
    // Try to extract JSON from response
    let jsonStr = result.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON from Ollama response: ${jsonStr.substring(0, 200)}...`);
    }
  }
}
