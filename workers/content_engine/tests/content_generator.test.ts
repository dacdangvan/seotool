/**
 * Content Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContentGenerator } from '../src/content_generator';
import { createSEOMockAdapter } from '../src/adapters';
import { SearchIntent, ContentType, ContentStatus, type ContentGenerationTask } from '../src/models';
import { v4 as uuidv4 } from 'uuid';

describe('ContentGenerator', () => {
  let generator: ContentGenerator;

  beforeEach(() => {
    const mockAdapter = createSEOMockAdapter();
    generator = new ContentGenerator(mockAdapter);
  });

  const createTestTask = (): ContentGenerationTask => ({
    id: uuidv4(),
    planId: uuidv4(),
    primaryKeyword: {
      text: 'test keyword',
      searchVolume: 1000,
      intent: SearchIntent.INFORMATIONAL,
    },
    supportingKeywords: [
      { text: 'related keyword 1' },
      { text: 'related keyword 2' },
    ],
    searchIntent: SearchIntent.INFORMATIONAL,
    targetLanguage: 'en-US',
    contentType: ContentType.ARTICLE,
  });

  describe('generate', () => {
    it('should generate complete content from task', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.taskId).toBe(task.id);
      expect(result.status).toBe(ContentStatus.COMPLETED);
      expect(result.content).not.toBeNull();
    });

    it('should return outline with H1 and sections', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.content?.outline).toBeDefined();
      expect(result.content?.outline.h1).toBeDefined();
      expect(result.content?.outline.sections.length).toBeGreaterThan(0);
    });

    it('should return markdown content', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.content?.markdownContent).toBeDefined();
      expect(result.content?.markdownContent.length).toBeGreaterThan(0);
    });

    it('should return SEO metadata', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.content?.seoMetadata).toBeDefined();
      expect(result.content?.seoMetadata.metaTitle).toBeDefined();
      expect(result.content?.seoMetadata.metaDescription).toBeDefined();
    });

    it('should return FAQ schema', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.content?.faqSchema).toBeDefined();
      expect(result.content?.faqSchema['@type']).toBe('FAQPage');
      expect(result.content?.faqSchema.mainEntity.length).toBeGreaterThan(0);
    });

    it('should calculate word count', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.content?.wordCount).toBeDefined();
      expect(result.content?.wordCount).toBeGreaterThan(0);
    });

    it('should record processing time', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.processingTimeMs).toBeDefined();
      // Processing time can be 0 for fast mock adapter
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata in result', async () => {
      const task = createTestTask();
      const result = await generator.generate(task);

      expect(result.metadata.primaryKeyword).toBe(task.primaryKeyword.text);
      expect(result.metadata.targetLanguage).toBe(task.targetLanguage);
      expect(result.metadata.contentType).toBe(task.contentType);
      expect(result.metadata.generatedAt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return failed status on error', async () => {
      // Create adapter that throws
      const errorAdapter = {
        complete: async () => { throw new Error('LLM Error'); },
        completeText: async () => { throw new Error('LLM Error'); },
        completeJSON: async () => { throw new Error('LLM Error'); },
      };

      const errorGenerator = new ContentGenerator(errorAdapter);
      const task = createTestTask();
      const result = await errorGenerator.generate(task);

      expect(result.status).toBe(ContentStatus.FAILED);
      expect(result.content).toBeNull();
      expect(result.error).toBe('LLM Error');
    });
  });
});
