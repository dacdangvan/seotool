/**
 * Entity Graph Builder
 * 
 * Builds relationships between entities:
 * - Topic ↔ Subtopic
 * - Article ↔ Topic  
 * - Brand ↔ Topic
 * - Author ↔ Article
 * 
 * Groups content into topic clusters for topical authority
 */

import { v4 as uuid } from 'uuid';
import {
  Entity,
  EntityRelation,
  EntityType,
  RelationType,
  TopicCluster,
  ParsedContent,
} from './models';
import { Config } from './config';
import { Logger } from './logger';

// =============================================================================
// ENTITY GRAPH BUILDER
// =============================================================================

export class EntityGraphBuilder {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger
  ) {}

  /**
   * Build entity relations
   */
  buildRelations(
    entities: Entity[],
    contents: ParsedContent[]
  ): EntityRelation[] {
    this.logger.info({ entityCount: entities.length }, 'Building entity relations');

    const relations: EntityRelation[] = [];

    // Group entities by type for faster lookup
    const topicEntities = entities.filter(e => e.type === EntityType.TOPIC);
    const subtopicEntities = entities.filter(e => e.type === EntityType.SUBTOPIC);
    const brandEntities = entities.filter(e => e.type === EntityType.BRAND);
    const authorEntities = entities.filter(e => e.type === EntityType.AUTHOR);

    // Build Topic ↔ Subtopic relations
    for (const topic of topicEntities) {
      for (const subtopic of subtopicEntities) {
        if (this.hasOverlappingContent(topic, subtopic)) {
          relations.push(this.createRelation(
            topic.id,
            subtopic.id,
            RelationType.TOPIC_SUBTOPIC,
            this.calculateTopicSimilarity(topic, subtopic)
          ));
        }
      }
    }

    // Build Brand ↔ Topic relations
    for (const brand of brandEntities) {
      for (const topic of topicEntities) {
        if (this.hasOverlappingContent(brand, topic)) {
          relations.push(this.createRelation(
            brand.id,
            topic.id,
            RelationType.BRAND_TOPIC,
            0.8 // Brand always has strong connection to its topics
          ));
        }
      }
    }

    // Build Author ↔ Article relations (via content)
    for (const author of authorEntities) {
      for (const contentId of author.sourceContentIds) {
        const content = contents.find(c => c.item.id === contentId);
        if (content) {
          // Find topic entity for this content
          const contentTopic = topicEntities.find(t => 
            t.sourceContentIds.includes(contentId)
          );
          if (contentTopic) {
            relations.push(this.createRelation(
              author.id,
              contentTopic.id,
              RelationType.AUTHOR_ARTICLE,
              0.9
            ));
          }
        }
      }
    }

    // Build related topic relations based on keyword similarity
    for (let i = 0; i < topicEntities.length; i++) {
      for (let j = i + 1; j < topicEntities.length; j++) {
        const similarity = this.calculateTopicSimilarity(
          topicEntities[i],
          topicEntities[j]
        );
        if (similarity >= this.config.clusterSimilarityThreshold) {
          relations.push(this.createRelation(
            topicEntities[i].id,
            topicEntities[j].id,
            RelationType.RELATED_TO,
            similarity
          ));
        }
      }
    }

    this.logger.info({ relationCount: relations.length }, 'Entity relations built');
    return relations;
  }

  /**
   * Build topic clusters (topical authority)
   */
  buildTopicClusters(
    entities: Entity[],
    relations: EntityRelation[],
    contents: ParsedContent[]
  ): TopicCluster[] {
    this.logger.info('Building topic clusters');

    const clusters: TopicCluster[] = [];
    const topicEntities = entities.filter(e => e.type === EntityType.TOPIC);
    const processedTopics = new Set<string>();

    // Sort topics by number of content pieces (pillar candidates)
    const sortedTopics = [...topicEntities].sort(
      (a, b) => b.sourceContentIds.length - a.sourceContentIds.length
    );

    for (const topic of sortedTopics) {
      if (processedTopics.has(topic.id)) continue;

      // Find related subtopics
      const relatedSubtopics = this.findRelatedSubtopics(topic, entities, relations);
      
      // Find all content in this cluster
      const clusterContentIds = new Set<string>([
        ...topic.sourceContentIds,
        ...relatedSubtopics.flatMap(s => s.sourceContentIds),
      ]);

      // Skip small clusters
      if (clusterContentIds.size < this.config.minClusterSize) {
        continue;
      }

      // Find pillar content (longest/most comprehensive)
      const pillarContentId = this.findPillarContent(
        Array.from(clusterContentIds),
        contents
      );

      clusters.push({
        id: uuid(),
        pillarTopic: topic,
        pillarContentId,
        subtopics: relatedSubtopics,
        relatedContentIds: Array.from(clusterContentIds),
        coherenceScore: this.calculateClusterCoherence(
          topic,
          relatedSubtopics,
          relations
        ),
      });

      // Mark topics as processed
      processedTopics.add(topic.id);
      relatedSubtopics.forEach(s => processedTopics.add(s.id));
    }

    this.logger.info({ clusterCount: clusters.length }, 'Topic clusters built');
    return clusters;
  }

  /**
   * Create an entity relation
   */
  private createRelation(
    sourceId: string,
    targetId: string,
    type: RelationType,
    weight: number
  ): EntityRelation {
    return {
      id: uuid(),
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      relationType: type,
      weight,
      metadata: {},
    };
  }

  /**
   * Check if two entities share content
   */
  private hasOverlappingContent(a: Entity, b: Entity): boolean {
    return a.sourceContentIds.some(id => b.sourceContentIds.includes(id));
  }

  /**
   * Calculate similarity between two topic entities
   * v0.5.1: Added lemmatization and SEO synonym support
   */
  private calculateTopicSimilarity(a: Entity, b: Entity): number {
    // v0.5.1: Get lemmatized words
    const wordsA = this.lemmatizeAndExpand(a.normalizedName);
    const wordsB = this.lemmatizeAndExpand(b.normalizedName);
    
    // Word overlap including synonyms
    const intersection = wordsA.filter(w => 
      wordsB.includes(w) || this.areSynonyms(w, wordsB)
    );
    const union = new Set([...wordsA, ...wordsB]);
    const jaccardSimilarity = intersection.length / Math.max(union.size, 1);

    // Content overlap
    const contentOverlap = a.sourceContentIds.filter(
      id => b.sourceContentIds.includes(id)
    ).length;
    const totalContent = new Set([
      ...a.sourceContentIds,
      ...b.sourceContentIds,
    ]).size;
    const contentSimilarity = contentOverlap / Math.max(totalContent, 1);

    // v0.5.1: Also check for partial word match (n-gram)
    const ngramSimilarity = this.calculateNgramSimilarity(
      a.normalizedName, 
      b.normalizedName
    );

    // Weighted average (adjusted for v0.5.1)
    return jaccardSimilarity * 0.4 + contentSimilarity * 0.3 + ngramSimilarity * 0.3;
  }

  /**
   * v0.5.1: Lemmatize words and expand with synonyms
   */
  private lemmatizeAndExpand(name: string): string[] {
    const words = name.split(' ').filter(w => w.length > 2);
    const expanded: string[] = [...words];
    
    // Add lemmatized forms
    const lemmaMap: Record<string, string> = {
      'guides': 'guide', 'guiding': 'guide', 'guided': 'guide',
      'optimization': 'optimize', 'optimizing': 'optimize', 'optimized': 'optimize',
      'rankings': 'ranking', 'ranked': 'ranking',
      'keywords': 'keyword', 'strategies': 'strategy',
      'links': 'link', 'linking': 'link', 'linked': 'link',
    };
    
    for (const word of words) {
      if (lemmaMap[word]) {
        expanded.push(lemmaMap[word]);
      }
      // Also add the word as its own lemma target
      for (const [variant, lemma] of Object.entries(lemmaMap)) {
        if (lemma === word) {
          expanded.push(variant);
        }
      }
    }
    
    return [...new Set(expanded)];
  }

  /**
   * v0.5.1: Check if word has synonym in word list
   */
  private areSynonyms(word: string, wordList: string[]): boolean {
    const synonymMap: Record<string, string[]> = {
      'seo': ['search', 'optimization', 'organic'],
      'guide': ['tutorial', 'howto', 'introduction'],
      'keyword': ['term', 'query', 'phrase'],
      'link': ['backlink', 'hyperlink', 'url'],
      'content': ['article', 'post', 'page'],
      'ranking': ['position', 'serp'],
    };
    
    const synonyms = synonymMap[word] || [];
    return synonyms.some(syn => wordList.includes(syn));
  }

  /**
   * v0.5.1: Calculate character n-gram similarity (for partial matches)
   */
  private calculateNgramSimilarity(a: string, b: string): number {
    const n = 3; // trigrams
    const ngramsA = this.getNgrams(a, n);
    const ngramsB = this.getNgrams(b, n);
    
    if (ngramsA.size === 0 || ngramsB.size === 0) return 0;
    
    let overlap = 0;
    for (const gram of ngramsA) {
      if (ngramsB.has(gram)) overlap++;
    }
    
    return overlap / Math.max(ngramsA.size, ngramsB.size);
  }

  /**
   * v0.5.1: Extract character n-grams from string
   */
  private getNgrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    const clean = str.replace(/\s+/g, '').toLowerCase();
    
    for (let i = 0; i <= clean.length - n; i++) {
      ngrams.add(clean.substring(i, i + n));
    }
    
    return ngrams;
  }

  /**
   * Find subtopics related to a topic
   */
  private findRelatedSubtopics(
    topic: Entity,
    entities: Entity[],
    relations: EntityRelation[]
  ): Entity[] {
    const subtopics: Entity[] = [];
    
    // Find via relations
    const relatedIds = relations
      .filter(r => 
        r.sourceEntityId === topic.id && 
        r.relationType === RelationType.TOPIC_SUBTOPIC
      )
      .map(r => r.targetEntityId);

    for (const id of relatedIds) {
      const subtopic = entities.find(e => e.id === id);
      if (subtopic && subtopic.type === EntityType.SUBTOPIC) {
        subtopics.push(subtopic);
      }
    }

    // Also find subtopics with overlapping content
    const subtopicEntities = entities.filter(e => e.type === EntityType.SUBTOPIC);
    for (const subtopic of subtopicEntities) {
      if (!subtopics.find(s => s.id === subtopic.id)) {
        if (this.hasOverlappingContent(topic, subtopic)) {
          subtopics.push(subtopic);
        }
      }
    }

    return subtopics;
  }

  /**
   * Find the pillar content in a cluster
   */
  private findPillarContent(
    contentIds: string[],
    contents: ParsedContent[]
  ): string | null {
    if (contentIds.length === 0) return null;

    // Find content with highest word count (most comprehensive)
    let pillarId = contentIds[0];
    let maxWordCount = 0;

    for (const id of contentIds) {
      const content = contents.find(c => c.item.id === id);
      if (content && content.wordCount > maxWordCount) {
        maxWordCount = content.wordCount;
        pillarId = id;
      }
    }

    return pillarId;
  }

  /**
   * Calculate cluster coherence score
   */
  private calculateClusterCoherence(
    pillar: Entity,
    subtopics: Entity[],
    relations: EntityRelation[]
  ): number {
    if (subtopics.length === 0) return 0.5;

    // Average relation weight to subtopics
    let totalWeight = 0;
    let relationCount = 0;

    for (const subtopic of subtopics) {
      const relation = relations.find(r =>
        r.sourceEntityId === pillar.id && r.targetEntityId === subtopic.id
      );
      if (relation) {
        totalWeight += relation.weight;
        relationCount++;
      }
    }

    return relationCount > 0 ? totalWeight / relationCount : 0.5;
  }
}
