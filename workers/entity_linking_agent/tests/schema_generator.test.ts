/**
 * Schema Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaGenerator } from '../src/schema_generator';
import { Entity, EntityType, ParsedContent } from '../src/models';
import { loadConfig } from '../src/config';
import pino from 'pino';
import { v4 as uuid } from 'uuid';

const logger = pino({ level: 'silent' });
const config = loadConfig();

describe('SchemaGenerator', () => {
  let generator: SchemaGenerator;
  const brandName = 'Test Brand';
  const siteUrl = 'https://example.com';

  beforeEach(() => {
    generator = new SchemaGenerator(config, logger, brandName, siteUrl);
  });

  const createMockContent = (
    id: string,
    title: string,
    author?: string,
    publishedAt?: string
  ): ParsedContent => ({
    item: {
      id,
      url: `${siteUrl}/${id}`,
      title,
      content: '<p>Content</p>',
      primaryKeyword: 'test keyword',
      supportingKeywords: ['keyword1', 'keyword2'],
      author,
      publishedAt,
      updatedAt: publishedAt,
    },
    textContent: 'Test content text',
    existingLinks: [],
    wordCount: 500,
  });

  const createAuthorEntity = (name: string, contentIds: string[]): Entity => ({
    id: uuid(),
    name,
    normalizedName: name.toLowerCase(),
    type: EntityType.AUTHOR,
    mentions: contentIds.length,
    sourceContentIds: contentIds,
    confidence: 0.9,
    metadata: {},
  });

  const createTopicEntity = (name: string, contentIds: string[]): Entity => ({
    id: uuid(),
    name,
    normalizedName: name.toLowerCase(),
    type: EntityType.TOPIC,
    mentions: contentIds.length,
    sourceContentIds: contentIds,
    confidence: 0.9,
    metadata: {},
  });

  describe('generate', () => {
    it('should generate Organization schema', () => {
      const schemas = generator.generate([], []);

      const orgSchema = schemas.find(s => s.schemaType === 'Organization');
      expect(orgSchema).toBeDefined();
      expect(orgSchema?.jsonLd['@type']).toBe('Organization');
      expect(orgSchema?.jsonLd['name']).toBe(brandName);
      expect(orgSchema?.jsonLd['url']).toBe(siteUrl);
      expect(orgSchema?.isValid).toBe(true);
    });

    it('should generate Person schema for authors', () => {
      const author = createAuthorEntity('John Doe', ['1']);
      const schemas = generator.generate([], [author]);

      const personSchema = schemas.find(s => s.schemaType === 'Person');
      expect(personSchema).toBeDefined();
      expect(personSchema?.jsonLd['@type']).toBe('Person');
      expect(personSchema?.jsonLd['name']).toBe('John Doe');
      expect(personSchema?.isValid).toBe(true);
    });

    it('should generate Article schema for each content', () => {
      const contents = [
        createMockContent('article-1', 'Test Article', 'John Doe', '2024-01-15T10:00:00Z'),
      ];
      const author = createAuthorEntity('John Doe', ['article-1']);

      const schemas = generator.generate(contents, [author]);

      const articleSchema = schemas.find(s => s.schemaType === 'Article');
      expect(articleSchema).toBeDefined();
      expect(articleSchema?.jsonLd['@type']).toBe('Article');
      expect(articleSchema?.jsonLd['headline']).toBe('Test Article');
      expect(articleSchema?.jsonLd['datePublished']).toBe('2024-01-15T10:00:00Z');
      expect(articleSchema?.isValid).toBe(true);
    });

    it('should include author in Article schema', () => {
      const contents = [createMockContent('1', 'Test Article', 'Jane Doe')];
      const author = createAuthorEntity('Jane Doe', ['1']);

      const schemas = generator.generate(contents, [author]);

      const articleSchema = schemas.find(s => s.schemaType === 'Article');
      const articleAuthor = articleSchema?.jsonLd['author'] as Record<string, unknown>;
      expect(articleAuthor?.['@type']).toBe('Person');
      expect(articleAuthor?.['name']).toBe('Jane Doe');
    });

    it('should include topics in Article about field', () => {
      const contents = [createMockContent('1', 'SEO Guide')];
      const topic = createTopicEntity('SEO', ['1']);

      const schemas = generator.generate(contents, [topic]);

      const articleSchema = schemas.find(s => s.schemaType === 'Article');
      const about = articleSchema?.jsonLd['about'] as Array<Record<string, unknown>>;
      expect(about).toBeDefined();
      expect(about?.length).toBeGreaterThan(0);
      expect(about?.[0]['@type']).toBe('Thing');
      expect(about?.[0]['name']).toBe('SEO');
    });

    it('should include publisher in Article schema', () => {
      const contents = [createMockContent('1', 'Test Article')];

      const schemas = generator.generate(contents, []);

      const articleSchema = schemas.find(s => s.schemaType === 'Article');
      const publisher = articleSchema?.jsonLd['publisher'] as Record<string, unknown>;
      expect(publisher?.['@type']).toBe('Organization');
      expect(publisher?.['name']).toBe(brandName);
    });

    it('should include word count in Article schema', () => {
      const contents = [createMockContent('1', 'Test Article')];

      const schemas = generator.generate(contents, []);

      const articleSchema = schemas.find(s => s.schemaType === 'Article');
      expect(articleSchema?.jsonLd['wordCount']).toBe(500);
    });

    it('should include keywords in Article schema', () => {
      const contents = [createMockContent('1', 'Test Article')];

      const schemas = generator.generate(contents, []);

      const articleSchema = schemas.find(s => s.schemaType === 'Article');
      const keywords = articleSchema?.jsonLd['keywords'] as string;
      expect(keywords).toContain('test keyword');
      expect(keywords).toContain('keyword1');
    });

    it('should validate schema structure', () => {
      const contents = [createMockContent('1', 'Test Article')];

      const schemas = generator.generate(contents, []);

      schemas.forEach(schema => {
        expect(schema.jsonLd['@context']).toBe('https://schema.org');
        expect(schema.jsonLd['@type']).toBeDefined();
      });
    });

    it('should not generate schemas when disabled', () => {
      const disabledConfig = loadConfig({ includeSchemaGeneration: false });
      const disabledGenerator = new SchemaGenerator(disabledConfig, logger, brandName, siteUrl);
      const contents = [createMockContent('1', 'Test Article')];

      const schemas = disabledGenerator.generate(contents, []);

      expect(schemas.length).toBe(0);
    });
  });
});
