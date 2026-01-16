/**
 * Mock LLM Adapter
 * 
 * Deterministic adapter for testing without API calls.
 */

import type { LLMAdapter, LLMMessage, LLMCompletionOptions, LLMCompletionResult } from './llm_adapter';
import { Logger } from '../logger';

const logger = new Logger('mock-adapter');

export interface MockResponse {
  pattern: RegExp | string;
  response: string;
}

export class MockLLMAdapter implements LLMAdapter {
  private responses: MockResponse[] = [];
  private defaultResponse: string = '{"error": "No mock response configured"}';
  private callHistory: Array<{ messages: LLMMessage[]; options?: LLMCompletionOptions }> = [];

  constructor(responses?: MockResponse[], defaultResponse?: string) {
    if (responses) {
      this.responses = responses;
    }
    if (defaultResponse) {
      this.defaultResponse = defaultResponse;
    }
  }

  /**
   * Add a mock response pattern
   */
  addResponse(pattern: RegExp | string, response: string): void {
    this.responses.push({ pattern, response });
  }

  /**
   * Set default response when no pattern matches
   */
  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  /**
   * Get call history for assertions
   */
  getCallHistory(): Array<{ messages: LLMMessage[]; options?: LLMCompletionOptions }> {
    return [...this.callHistory];
  }

  /**
   * Clear call history
   */
  clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * Find matching response based on message content
   */
  private findResponse(messages: LLMMessage[]): string {
    const fullContent = messages.map((m) => m.content).join('\n');

    for (const { pattern, response } of this.responses) {
      if (typeof pattern === 'string') {
        if (fullContent.includes(pattern)) {
          return response;
        }
      } else {
        if (pattern.test(fullContent)) {
          return response;
        }
      }
    }

    return this.defaultResponse;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    this.callHistory.push({ messages, options });

    const response = this.findResponse(messages);

    logger.debug('Mock response returned', {
      messageCount: messages.length,
      responseLength: response.length,
    });

    // Simulate token counts
    const promptTokens = messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
    const completionTokens = Math.ceil(response.length / 4);

    return {
      content: response,
      model: options?.model || 'mock-model',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop',
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
    const content = await this.completeText(prompt, systemPrompt, options);

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
      throw new Error(`Failed to parse mock JSON response: ${error}`);
    }
  }
}

/**
 * Create mock adapter with SEO content responses
 */
export function createSEOMockAdapter(): MockLLMAdapter {
  const adapter = new MockLLMAdapter();

  // Order matters! More specific patterns first.

  // FAQ generation - matches "Create FAQ schema questions and answers"
  adapter.addResponse(/FAQ.*schema|FAQ.*questions/i, JSON.stringify({
    questions: [
      {
        question: 'What is the mock question?',
        answer: 'This is the mock answer for testing purposes.',
      },
      {
        question: 'How does this work?',
        answer: 'It works by matching patterns in the prompt and returning predefined responses.',
      },
    ],
  }));

  // Meta generation - matches "Create SEO meta title and description"
  adapter.addResponse(/meta.*title.*description|Create SEO meta/i, JSON.stringify({
    metaTitle: 'Mock Meta Title | SEO Tool',
    metaDescription: 'This is a mock meta description for testing. It contains relevant keywords and is within the recommended length.',
  }));

  // Article generation - matches "Write a complete SEO article based on"
  // Check for this BEFORE outline since it's more specific  
  adapter.addResponse(/Write a complete SEO article based/i, `# Mock Article Title

## Introduction

This is a mock introduction paragraph for testing purposes. It covers the basics of the topic to set the stage for readers.

## Main Content

Here is the main content of the article with relevant information. This section dives deeper into the subject matter and provides valuable insights.

### Subsection 1

Detailed information about the first subtopic. This includes specific examples and practical advice.

### Subsection 2

Additional details covering related aspects. Users will find actionable tips here.

## Conclusion

A summary of the key points covered in this article. The reader should now have a comprehensive understanding of the topic.
`);

  // Outline generation - matches "Create a comprehensive SEO article outline"
  adapter.addResponse(/Create a comprehensive SEO article outline/i, JSON.stringify({
    title: 'Mock Article Title',
    sections: [
      {
        heading: 'Introduction',
        keyPoints: ['Overview of the topic'],
        subsections: [],
      },
      {
        heading: 'Main Content',
        keyPoints: ['Key point 1', 'Key point 2'],
        subsections: [
          { heading: 'Subsection 1', keyPoints: ['Detail 1'] },
        ],
      },
      {
        heading: 'Conclusion',
        keyPoints: ['Summary'],
        subsections: [],
      },
    ],
  }));

  return adapter;
}
