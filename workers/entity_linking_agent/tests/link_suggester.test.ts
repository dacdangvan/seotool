/**
 * Link Suggester Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LinkSuggester } from '../src/link_suggester';
import {
  Entity,
  EntityType,
  TopicCluster,
  ParsedContent,
  ContentLinkAnalysis,
  ContentHealth,
} from '../src/models';
import { loadConfig } from '../src/config';
import pino from 'pino';
import { v4 as uuid } from 'uuid';

const logger = pino({ level: 'silent' });
const config = loadConfig();

describe('LinkSuggester', () => {
  let suggester: LinkSuggester;

  beforeEach(() => {
    suggester = new LinkSuggester(config, logger);
  });

  const createMockContent = (
    id: string,
    primaryKeyword: string,
    supportingKeywords: string[] = []
  ): ParsedContent => ({
    item: {
      id,
      url: `https://example.com/${id}`,
      title: `Content about ${primaryKeyword}`,
      content: `<p>Content</p>`,
      primaryKeyword,
      supportingKeywords,
    },
    textContent: `Content about ${primaryKeyword}`,
    existingLinks: [],
    wordCount: 500,
  });

  const createMockAnalysis = (
    contentId: string,
    health: ContentHealth,
    suggestedLinksTo: string[] = [],
    suggestedLinksFrom: string[] = []
  ): ContentLinkAnalysis => ({
    contentId,
    url: `https://example.com/${contentId}`,
    health,
    incomingLinks: health === ContentHealth.ORPHAN ? 0 : 3,
    outgoingLinks: 2,
    issues: [],
    suggestedLinksTo,
    suggestedLinksFrom,
  });

  const createMockEntity = (name: string, type: EntityType, contentIds: string[]): Entity => ({
    id: uuid(),
    name,
    normalizedName: name.toLowerCase(),
    type,
    mentions: contentIds.length,
    sourceContentIds: contentIds,
    confidence: 0.9,
    metadata: {},
  });

  const createMockCluster = (
    pillarTopic: Entity,
    pillarContentId: string,
    subtopics: Entity[],
    contentIds: string[]
  ): TopicCluster => ({
    id: uuid(),
    pillarTopic,
    pillarContentId,
    subtopics,
    relatedContentIds: contentIds,
    coherenceScore: 0.8,
  });

  describe('suggest', () => {
    it('should prioritize suggestions for orphan content', () => {
      const contents = [
        createMockContent('pillar', 'SEO guide', ['on-page', 'technical']),
        createMockContent('orphan', 'on-page SEO'),
      ];

      const pillarTopic = createMockEntity('SEO guide', EntityType.TOPIC, ['pillar']);
      const subtopic = createMockEntity('on-page SEO', EntityType.SUBTOPIC, ['orphan']);

      const analysis = [
        createMockAnalysis('pillar', ContentHealth.HEALTHY, ['orphan'], []),
        createMockAnalysis('orphan', ContentHealth.ORPHAN, [], ['pillar']),
      ];

      const clusters = [
        createMockCluster(pillarTopic, 'pillar', [subtopic], ['pillar', 'orphan']),
      ];

      const suggestions = suggester.suggest(contents, analysis, [pillarTopic, subtopic], clusters);

      // Should suggest linking from pillar to orphan
      const orphanSuggestion = suggestions.find(s => s.targetContentId === 'orphan');
      expect(orphanSuggestion).toBeDefined();
      expect(orphanSuggestion?.strength).toBe('strong');
    });

    it('should suggest links within topic clusters', () => {
      const contents = [
        createMockContent('pillar', 'SEO guide'),
        createMockContent('support1', 'on-page SEO'),
        createMockContent('support2', 'technical SEO'),
      ];

      const pillarTopic = createMockEntity('SEO guide', EntityType.TOPIC, ['pillar']);
      const subtopic1 = createMockEntity('on-page SEO', EntityType.SUBTOPIC, ['support1']);
      const subtopic2 = createMockEntity('technical SEO', EntityType.SUBTOPIC, ['support2']);

      const analysis = [
        createMockAnalysis('pillar', ContentHealth.HEALTHY, ['support1', 'support2'], []),
        createMockAnalysis('support1', ContentHealth.HEALTHY, ['pillar'], ['pillar']),
        createMockAnalysis('support2', ContentHealth.HEALTHY, ['pillar'], ['pillar']),
      ];

      const clusters = [
        createMockCluster(
          pillarTopic,
          'pillar',
          [subtopic1, subtopic2],
          ['pillar', 'support1', 'support2']
        ),
      ];

      const suggestions = suggester.suggest(
        contents,
        analysis,
        [pillarTopic, subtopic1, subtopic2],
        clusters
      );

      // Should have suggestions from pillar to supporting content
      const pillarToSupport1 = suggestions.find(
        s => s.sourceContentId === 'pillar' && s.targetContentId === 'support1'
      );
      expect(pillarToSupport1).toBeDefined();
    });

    it('should generate SEO-safe anchor suggestions', () => {
      const contents = [
        createMockContent('source', 'main topic'),
        createMockContent('target', 'related topic'),
      ];

      const topic1 = createMockEntity('main topic', EntityType.TOPIC, ['source']);
      const topic2 = createMockEntity('related topic', EntityType.TOPIC, ['target']);

      const analysis = [
        createMockAnalysis('source', ContentHealth.HEALTHY, ['target'], []),
        createMockAnalysis('target', ContentHealth.ORPHAN, [], ['source']),
      ];

      const clusters = [
        createMockCluster(topic1, 'source', [], ['source', 'target']),
      ];

      const suggestions = suggester.suggest(
        contents,
        analysis,
        [topic1, topic2],
        clusters
      );

      const suggestion = suggestions.find(s => s.targetContentId === 'target');
      expect(suggestion?.suggestedAnchors.length).toBeGreaterThan(0);
      
      // Should include natural anchor from title
      const naturalAnchor = suggestion?.suggestedAnchors.find(a => a.type === 'natural');
      expect(naturalAnchor).toBeDefined();
      expect(naturalAnchor?.seoSafeScore).toBeGreaterThan(0.7);
    });

    it('should provide reasoning for each suggestion', () => {
      const contents = [
        createMockContent('source', 'SEO'),
        createMockContent('target', 'SEO tips'),
      ];

      const topic = createMockEntity('SEO', EntityType.TOPIC, ['source', 'target']);

      const analysis = [
        createMockAnalysis('source', ContentHealth.HEALTHY, ['target'], []),
        createMockAnalysis('target', ContentHealth.ORPHAN, [], ['source']),
      ];

      const clusters = [
        createMockCluster(topic, 'source', [], ['source', 'target']),
      ];

      const suggestions = suggester.suggest(contents, analysis, [topic], clusters);

      const suggestion = suggestions[0];
      expect(suggestion?.reasoning).toBeDefined();
      expect(suggestion?.reasoning.topicRelevance).toBeDefined();
      expect(suggestion?.reasoning.authorityFlow).toBeDefined();
      expect(suggestion?.reasoning.userBenefit).toBeDefined();
      expect(suggestion?.reasoning.seoImpact).toBeDefined();
    });

    it('should filter suggestions by minimum relevance score', () => {
      const strictConfig = loadConfig({ minRelevanceScore: 0.9 });
      const strictSuggester = new LinkSuggester(strictConfig, logger);

      const contents = [
        createMockContent('source', 'topic A'),
        createMockContent('target', 'topic B'),
      ];

      const topic = createMockEntity('topic A', EntityType.TOPIC, ['source']);

      const analysis = [
        createMockAnalysis('source', ContentHealth.HEALTHY, ['target'], []),
        createMockAnalysis('target', ContentHealth.WEAK, [], ['source']),
      ];

      const suggestions = strictSuggester.suggest(contents, analysis, [topic], []);

      // All suggestions should meet minimum relevance
      suggestions.forEach(s => {
        expect(s.relevanceScore).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should deduplicate suggestions', () => {
      const contents = [
        createMockContent('source', 'topic'),
        createMockContent('target', 'topic'),
      ];

      const topic = createMockEntity('topic', EntityType.TOPIC, ['source', 'target']);

      const analysis = [
        createMockAnalysis('source', ContentHealth.HEALTHY, ['target'], []),
        createMockAnalysis('target', ContentHealth.ORPHAN, [], ['source']),
      ];

      const clusters = [
        createMockCluster(topic, 'source', [], ['source', 'target']),
      ];

      const suggestions = suggester.suggest(contents, analysis, [topic], clusters);

      // Check for duplicates
      const seen = new Set<string>();
      suggestions.forEach(s => {
        const key = `${s.sourceContentId}-${s.targetContentId}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      });
    });
  });
});
