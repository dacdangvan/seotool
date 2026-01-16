/**
 * Anthropic LLM Adapter
 * 
 * Implementation of LLMAdapter for Anthropic Claude models.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from './llm_adapter';
import { Logger } from '../logger';

const logger = new Logger('anthropic-adapter');

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(
    apiKey: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ) {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = options?.model || 'claude-3-5-sonnet-20241022';
    this.defaultTemperature = options?.temperature || 0.7;
    this.defaultMaxTokens = options?.maxTokens || 4096;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? this.defaultTemperature;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;

    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    logger.debug('Calling Anthropic API', { model, messageCount: chatMessages.length });

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: chatMessages,
      temperature,
      stop_sequences: options?.stopSequences,
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';

    logger.debug('Anthropic response received', {
      model: response.model,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });

    return {
      content: text,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason || 'unknown',
    };
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
    const jsonSystemPrompt = `${systemPrompt || ''}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code blocks.
Start directly with { or [ and end with } or ].`;

    const content = await this.completeText(prompt, jsonSystemPrompt.trim(), options);

    // Clean up response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    }
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    try {
      return JSON.parse(cleanedContent) as T;
    } catch (error) {
      logger.error('Failed to parse JSON response', { content: cleanedContent.slice(0, 200) });
      throw new Error(`Failed to parse LLM JSON response: ${error}`);
    }
  }
}
