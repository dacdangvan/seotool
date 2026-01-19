/**
 * Entity Extractor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityExtractor } from '../src/entity_extractor';
import { EntityType, ParsedContent, ExtractionContext, ContentItem } from '../src/models';
import { loadConfig } from '../src/config';
import pino from 'pino';

const logger = pino({ level: 'silent' });
const config = loadConfig();

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    extractor = new EntityExtractor(config, logger);
  });

  const createMockParsedContent = (
    id: string,
    primaryKeyword: string,
    supportingKeywords: string[] = [],
    author?: string
  ): ParsedContent => ({
    item: {
      id,
      url: `https://example.com/${id}`,
      title: `Test Content ${id}`,
      content: `<p>Content about ${primaryKeyword}</p>`,
      primaryKeyword,
      supportingKeywords,
      author,
    },
    textContent: `Content about ${primaryKeyword}. This is test content.`,
    existingLinks: [],
    wordCount: 100,
  });

  const createContext = (brandName = 'Test Brand'): ExtractionContext => ({
    brandName,
    siteUrl: 'https://example.com',
    allKeywords: ['keyword1', 'keyword2'],
  });

  describe('extract', () => {
    it('should extract brand entity', () => {
      const contents = [createMockParsedContent('1', 'test topic')];
      const context = createContext('Test Brand');

      const entities = extractor.extract(contents, context);

      const brandEntity = entities.find(e => e.type === EntityType.BRAND);
      expect(brandEntity).toBeDefined();
      expect(brandEntity?.name).toBe('Test Brand');
      expect(brandEntity?.confidence).toBe(1.0);
    });

    it('should extract topic entity from primary keyword', () => {
      const contents = [createMockParsedContent('1', 'SEO optimization')];
      const context = createContext();

      const entities = extractor.extract(contents, context);

      const topicEntity = entities.find(
        e => e.type === EntityType.TOPIC && e.normalizedName === 'seo optimization'
      );
      expect(topicEntity).toBeDefined();
      expect(topicEntity?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should extract subtopic entities from supporting keywords', () => {
      const contents = [
        createMockParsedContent('1', 'main topic', ['subtopic one', 'subtopic two']),
      ];
      const context = createContext();

      const entities = extractor.extract(contents, context);

      const subtopics = entities.filter(e => e.type === EntityType.SUBTOPIC);
      expect(subtopics.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract author entity when present', () => {
      const contents = [createMockParsedContent('1', 'topic', [], 'John Doe')];
      const context = createContext();

      const entities = extractor.extract(contents, context);

      const authorEntity = entities.find(e => e.type === EntityType.AUTHOR);
      expect(authorEntity).toBeDefined();
      expect(authorEntity?.name).toBe('John Doe');
    });

    it('should normalize and deduplicate entities', () => {
      const contents = [
        createMockParsedContent('1', 'SEO Guide'),
        createMockParsedContent('2', 'seo guide'), // Same, different case
      ];
      const context = createContext();

      const entities = extractor.extract(contents, context);

      const seoGuideEntities = entities.filter(
        e => e.normalizedName === 'seo guide'
      );
      expect(seoGuideEntities.length).toBe(1);
      expect(seoGuideEntities[0].sourceContentIds).toContain('1');
      expect(seoGuideEntities[0].sourceContentIds).toContain('2');
    });

    it('should track mentions across content', () => {
      const contents = [
        createMockParsedContent('1', 'shared topic'),
        createMockParsedContent('2', 'shared topic'),
        createMockParsedContent('3', 'shared topic'),
      ];
      const context = createContext();

      const entities = extractor.extract(contents, context);

      const sharedTopic = entities.find(
        e => e.normalizedName === 'shared topic'
      );
      expect(sharedTopic?.sourceContentIds.length).toBe(3);
    });

    it('should filter entities by minimum confidence', () => {
      const contents = [createMockParsedContent('1', 'test')];
      const lowConfidenceConfig = loadConfig({ minEntityConfidence: 0.95 });
      const strictExtractor = new EntityExtractor(lowConfidenceConfig, logger);
      const context = createContext();

      const entities = strictExtractor.extract(contents, context);

      // Only high confidence entities should pass
      entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });
  });
});
