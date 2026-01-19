/**
 * Entity Extractor
 * 
 * Extracts entities from content:
 * - Brand entities
 * - Topic entities  
 * - Author entities
 * - Product, Location, etc.
 */

import { v4 as uuid } from 'uuid';
import { 
  Entity, 
  EntityType, 
  ContentItem, 
  ExtractionContext,
  ParsedContent,
} from './models';
import { Config } from './config';
import { Logger } from './logger';

// =============================================================================
// ENTITY EXTRACTOR
// =============================================================================

export class EntityExtractor {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger
  ) {}

  /**
   * Extract entities from all content items
   */
  extract(
    parsedContents: ParsedContent[],
    context: ExtractionContext
  ): Entity[] {
    this.logger.info({ contentCount: parsedContents.length }, 'Starting entity extraction');

    const entityMap = new Map<string, Entity>();

    // Extract brand entity
    const brandEntity = this.extractBrandEntity(context.brandName, parsedContents);
    this.addToMap(entityMap, brandEntity);

    // Extract from each content
    for (const content of parsedContents) {
      const entities = this.extractFromContent(content, context);
      for (const entity of entities) {
        this.addToMap(entityMap, entity);
      }
    }

    // Filter by confidence
    const allEntities = Array.from(entityMap.values())
      .filter(e => e.confidence >= this.config.minEntityConfidence);

    this.logger.info({ entityCount: allEntities.length }, 'Entity extraction completed');
    return allEntities;
  }

  /**
   * Extract brand entity
   */
  private extractBrandEntity(
    brandName: string,
    contents: ParsedContent[]
  ): Entity {
    const normalizedName = this.normalize(brandName);
    const mentionCount = contents.filter(c => 
      c.textContent.toLowerCase().includes(normalizedName)
    ).length;

    return {
      id: uuid(),
      name: brandName,
      normalizedName,
      type: EntityType.BRAND,
      mentions: mentionCount,
      sourceContentIds: contents
        .filter(c => c.textContent.toLowerCase().includes(normalizedName))
        .map(c => c.item.id),
      confidence: 1.0, // Brand is always high confidence
      metadata: { isBrand: true },
    };
  }

  /**
   * Extract entities from a single content item
   */
  private extractFromContent(
    content: ParsedContent,
    context: ExtractionContext
  ): Entity[] {
    const entities: Entity[] = [];
    const text = content.textContent;

    // Extract topic entity from primary keyword
    if (content.item.primaryKeyword) {
      entities.push(this.createTopicEntity(
        content.item.primaryKeyword,
        [content.item.id],
        0.95
      ));
    }

    // Extract subtopic entities from supporting keywords
    if (content.item.supportingKeywords) {
      for (const keyword of content.item.supportingKeywords) {
        entities.push(this.createTopicEntity(
          keyword,
          [content.item.id],
          0.85,
          EntityType.SUBTOPIC
        ));
      }
    }

    // Extract author entity
    if (content.item.author) {
      entities.push(this.createAuthorEntity(
        content.item.author,
        [content.item.id]
      ));
    }

    // Extract potential entities from text using patterns
    const patternEntities = this.extractPatternEntities(text, content.item.id);
    entities.push(...patternEntities);

    return entities;
  }

  /**
   * Create a topic entity
   */
  private createTopicEntity(
    name: string,
    sourceContentIds: string[],
    confidence: number,
    type: EntityType = EntityType.TOPIC
  ): Entity {
    return {
      id: uuid(),
      name,
      normalizedName: this.normalize(name),
      type,
      mentions: 1,
      sourceContentIds,
      confidence,
      metadata: {},
    };
  }

  /**
   * Create an author entity
   */
  private createAuthorEntity(
    name: string,
    sourceContentIds: string[]
  ): Entity {
    return {
      id: uuid(),
      name,
      normalizedName: this.normalize(name),
      type: EntityType.AUTHOR,
      mentions: sourceContentIds.length,
      sourceContentIds,
      confidence: 0.9,
      metadata: { isAuthor: true },
    };
  }

  /**
   * Extract entities using regex patterns
   */
  private extractPatternEntities(text: string, contentId: string): Entity[] {
    const entities: Entity[] = [];

    // Capitalized phrases (potential named entities)
    const capitalizedPattern = /(?:^|[.!?]\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g;
    const matches = text.matchAll(capitalizedPattern);
    
    for (const match of matches) {
      const phrase = match[1];
      // Skip common sentence starters
      if (this.isCommonPhrase(phrase)) continue;
      
      entities.push({
        id: uuid(),
        name: phrase,
        normalizedName: this.normalize(phrase),
        type: this.inferEntityType(phrase),
        mentions: 1,
        sourceContentIds: [contentId],
        confidence: 0.6,
        metadata: { extractedBy: 'pattern' },
      });
    }

    return entities.slice(0, this.config.maxEntitiesPerContent);
  }

  /**
   * Infer entity type from name
   */
  private inferEntityType(name: string): EntityType {
    const lower = name.toLowerCase();
    
    // Location indicators
    if (/city|country|state|region|street|avenue|road/i.test(lower)) {
      return EntityType.LOCATION;
    }
    
    // Event indicators
    if (/conference|summit|event|festival|workshop/i.test(lower)) {
      return EntityType.EVENT;
    }
    
    // Product indicators
    if (/product|tool|software|app|platform/i.test(lower)) {
      return EntityType.PRODUCT;
    }
    
    return EntityType.CONCEPT;
  }

  /**
   * Check if phrase is a common non-entity phrase
   */
  private isCommonPhrase(phrase: string): boolean {
    const commonPhrases = [
      'the', 'this', 'that', 'these', 'those',
      'however', 'therefore', 'moreover', 'furthermore',
      'in addition', 'for example', 'in conclusion',
    ];
    return commonPhrases.some(p => phrase.toLowerCase().startsWith(p));
  }

  /**
   * Add entity to map, merging if exists
   */
  private addToMap(map: Map<string, Entity>, entity: Entity): void {
    const existing = map.get(entity.normalizedName);
    
    if (existing) {
      // Merge entities
      existing.mentions += entity.mentions;
      existing.sourceContentIds = [
        ...new Set([...existing.sourceContentIds, ...entity.sourceContentIds])
      ];
      existing.confidence = Math.max(existing.confidence, entity.confidence);
    } else {
      map.set(entity.normalizedName, entity);
    }
  }

  /**
   * Normalize entity name for deduplication
   */
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  }
}
