/**
 * OpenAI LLM Adapter
 * 
 * Implementation of LLMAdapter for OpenAI GPT models.
 */

import OpenAI from 'openai';
import type { LLMAdapter, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from './llm_adapter';
import { Logger } from '../logger';

const logger = new Logger('openai-adapter');

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
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
    this.client = new OpenAI({ apiKey });
    this.defaultModel = options?.model || 'gpt-4o';
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

    logger.debug('Calling OpenAI API', { model, messageCount: messages.length });

    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
      stop: options?.stopSequences,
    });

    const choice = response.choices[0];

    logger.debug('OpenAI response received', {
      model: response.model,
      tokens: response.usage?.total_tokens,
    });

    return {
      content: choice.message.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: choice.finish_reason || 'unknown',
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

    // Clean up response (remove markdown code blocks if present)
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
