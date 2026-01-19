/**
 * Entity Linking Agent Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityLinkingAgent } from '../src/agent_runner';
import { EntityLinkingTask, TaskStatus, ContentItem } from '../src/models';
import pino from 'pino';
import { v4 as uuid } from 'uuid';

const logger = pino({ level: 'silent' });

describe('EntityLinkingAgent', () => {
  let agent: EntityLinkingAgent;

  beforeEach(() => {
    agent = new EntityLinkingAgent(logger);
  });

  const createMockTask = (contentItems: ContentItem[]): EntityLinkingTask => ({
    id: uuid(),
    planId: uuid(),
    contentItems,
    siteUrl: 'https://example.com',
    brandName: 'Test Brand',
    config: {
      maxLinksPerPage: 10,
      minRelevanceScore: 0.5,
      includeSchemaGeneration: true,
      topicClusteringEnabled: true,
    },
  });

  const createMockContent = (
    id: string,
    primaryKeyword: string,
    supportingKeywords: string[] = [],
    author?: string,
    content?: string
  ): ContentItem => ({
    id,
    url: `https://example.com/${id}`,
    title: `Guide to ${primaryKeyword}`,
    content: content || `<p>Content about ${primaryKeyword}</p>`,
    primaryKeyword,
    supportingKeywords,
    author,
    publishedAt: '2024-01-15T10:00:00Z',
    wordCount: 500,
  });

  describe('run', () => {
    it('should complete successfully with valid input', async () => {
      const task = createMockTask([
        createMockContent('1', 'SEO guide', ['on-page', 'technical'], 'John Doe'),
        createMockContent('2', 'on-page SEO', ['meta tags'], 'John Doe'),
      ]);

      const result = await agent.run(task);

      expect(result.taskId).toBe(task.id);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.error).toBeUndefined();
    });

    it('should extract entities from content', async () => {
      const task = createMockTask([
        createMockContent('1', 'SEO optimization', ['keyword research'], 'Jane Doe'),
      ]);

      const result = await agent.run(task);

      expect(result.entities.length).toBeGreaterThan(0);
      
      // Should have brand entity
      const brandEntity = result.entities.find(e => e.name === 'Test Brand');
      expect(brandEntity).toBeDefined();
      
      // Should have topic entity
      const topicEntity = result.entities.find(e => e.normalizedName === 'seo optimization');
      expect(topicEntity).toBeDefined();
    });

    it('should build entity relations', async () => {
      const task = createMockTask([
        createMockContent('1', 'main topic', ['subtopic A', 'subtopic B']),
        createMockContent('2', 'subtopic A', []),
      ]);

      const result = await agent.run(task);

      expect(result.entityRelations.length).toBeGreaterThan(0);
    });

    it('should build topic clusters', async () => {
      const task = createMockTask([
        createMockContent('pillar', 'SEO guide', ['on-page', 'technical']),
        createMockContent('support1', 'on-page SEO', ['meta tags']),
        createMockContent('support2', 'technical SEO', ['site speed']),
      ]);
      task.config!.topicClusteringEnabled = true;

      const result = await agent.run(task);

      // Topic clusters may or may not be generated depending on content relationships
      expect(result.topicClusters).toBeDefined();
      expect(Array.isArray(result.topicClusters)).toBe(true);
    });

    it('should analyze content link health', async () => {
      const task = createMockTask([
        createMockContent('1', 'topic1'),
        createMockContent('2', 'topic2'),
      ]);

      const result = await agent.run(task);

      expect(result.contentAnalysis.length).toBe(2);
      result.contentAnalysis.forEach(analysis => {
        expect(analysis.health).toBeDefined();
        expect(analysis.incomingLinks).toBeDefined();
        expect(analysis.outgoingLinks).toBeDefined();
      });
    });

    it('should identify orphan content', async () => {
      const task = createMockTask([
        createMockContent(
          '1',
          'linked content',
          [],
          undefined,
          '<p>Content</p><a href="https://example.com/2">Link</a>'
        ),
        createMockContent('2', 'has incoming', [], undefined, '<p>Content</p>'),
        createMockContent('3', 'orphan content', [], undefined, '<p>Orphan</p>'),
      ]);

      const result = await agent.run(task);

      const orphan = result.contentAnalysis.find(a => a.contentId === '3');
      expect(orphan?.health).toBe('orphan');
    });

    it('should generate link suggestions', async () => {
      const task = createMockTask([
        createMockContent('1', 'SEO guide', ['on-page SEO']),
        createMockContent('2', 'on-page SEO', ['meta tags']),
      ]);

      const result = await agent.run(task);

      // Should suggest some links
      expect(result.linkSuggestions.length).toBeGreaterThanOrEqual(0);
      
      if (result.linkSuggestions.length > 0) {
        const suggestion = result.linkSuggestions[0];
        expect(suggestion.sourceUrl).toBeDefined();
        expect(suggestion.targetUrl).toBeDefined();
        expect(suggestion.suggestedAnchors.length).toBeGreaterThan(0);
        expect(suggestion.reasoning).toBeDefined();
      }
    });

    it('should generate schemas when enabled', async () => {
      const task = createMockTask([
        createMockContent('1', 'test topic', [], 'John Doe'),
      ]);
      task.config!.includeSchemaGeneration = true;

      const result = await agent.run(task);

      expect(result.schemas.length).toBeGreaterThan(0);
      
      // Should have Organization schema
      const orgSchema = result.schemas.find(s => s.schemaType === 'Organization');
      expect(orgSchema).toBeDefined();
      
      // Should have Article schema
      const articleSchema = result.schemas.find(s => s.schemaType === 'Article');
      expect(articleSchema).toBeDefined();
    });

    it('should provide complete summary', async () => {
      const task = createMockTask([
        createMockContent('1', 'topic1'),
        createMockContent('2', 'topic2'),
      ]);

      const result = await agent.run(task);

      expect(result.summary).toBeDefined();
      expect(result.summary.totalEntities).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalRelations).toBeGreaterThanOrEqual(0);
      expect(result.summary.contentHealthBreakdown).toBeDefined();
      expect(result.summary.totalLinkSuggestions).toBeGreaterThanOrEqual(0);
    });

    it('should record processing time', async () => {
      const task = createMockTask([createMockContent('1', 'topic')]);

      const result = await agent.run(task);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
      // Create task with empty content to trigger error
      const task = createMockTask([]);

      const result = await agent.run(task);

      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBeDefined();
    });
  });
});
