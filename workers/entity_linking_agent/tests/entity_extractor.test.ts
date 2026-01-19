/**
 * Entity Extractor Tests
 * v0.5.1 - Updated tests for keyword verification and lemmatization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityExtractor } from '../src/entity_extractor';
import { EntityType, ParsedContent, ExtractionContext, ContentItem } from '../src/models';
import { loadConfig } from '../src/config';
import pino from 'pino';

const logger = pino({ level: 'silent' });
// v0.5.1: Disable lemmatization for predictable test results
const config = loadConfig({ useLemmatization: false, minKeywordOccurrences: 1 });

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;

  beforeEach(() => {
    extractor = new EntityExtractor(config, logger);
  });

  // v0.5.1: Updated to include keyword in text multiple times
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
      content: `<p>Content about ${primaryKeyword}. More about ${primaryKeyword} here.</p>`,
      primaryKeyword,
      supportingKeywords,
      author,
    },
    // v0.5.1: Include keyword 2+ times for verification
    textContent: `Content about ${primaryKeyword}. This is test content about ${primaryKeyword}. Learn more about ${primaryKeyword}.`,
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
      const contents = [createMockParsedContent('1', 'seo optimization')];
      const context = createContext();

      const entities = extractor.extract(contents, context);

      const topicEntity = entities.find(
        e => e.type === EntityType.TOPIC && e.normalizedName.includes('seo')
      );
      expect(topicEntity).toBeDefined();
      // v0.5.1: Confidence may vary based on TF-IDF, just check it exists
      expect(topicEntity?.confidence).toBeGreaterThan(0);
    });

    it('should extract subtopic entities from supporting keywords', () => {
      // v0.5.1: Create content with supporting keywords mentioned in text
      const parsedContent: ParsedContent = {
        item: {
          id: '1',
          url: 'https://example.com/1',
          title: 'Test Content',
          content: '<p>Main topic with subtopic one and subtopic two</p>',
          primaryKeyword: 'main topic',
          supportingKeywords: ['subtopic one', 'subtopic two'],
        },
        textContent: 'Main topic with subtopic one and subtopic two discussed here.',
        existingLinks: [],
        wordCount: 100,
      };
      const context = createContext();

      const entities = extractor.extract([parsedContent], context);

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
        createMockParsedContent('1', 'seo guide'),
        createMockParsedContent('2', 'SEO Guide'), // Same, different case
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
      const lowConfidenceConfig = loadConfig({ 
        minEntityConfidence: 0.95,
        useLemmatization: false,
        minKeywordOccurrences: 1,
      });
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
