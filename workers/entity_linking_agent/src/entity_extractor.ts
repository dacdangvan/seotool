/**
 * Entity Extractor
 * 
 * v0.5.1 - Fixed entity extraction accuracy:
 * - Added keyword verification (must appear in content)
 * - Added TF-IDF style confidence scoring
 * - Added lemmatization support
 * - Added SEO synonym mapping
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
  ExtractionContext,
  ParsedContent,
} from './models';
import { Config } from './config';
import { Logger } from './logger';

// =============================================================================
// SEO SYNONYM MAPPINGS (v0.5.1)
// =============================================================================

const SEO_SYNONYMS: Record<string, string[]> = {
  'seo': ['search engine optimization', 'search optimization', 'organic search'],
  'serp': ['search engine results page', 'search results'],
  'ctr': ['click through rate', 'click-through rate'],
  'sem': ['search engine marketing', 'paid search'],
  'ppc': ['pay per click', 'pay-per-click', 'paid advertising'],
  'backlink': ['inbound link', 'incoming link', 'external link'],
  'keyword': ['search term', 'query', 'search query'],
  'meta': ['metadata', 'meta tag', 'meta tags'],
  'content': ['article', 'blog post', 'page content'],
  'ranking': ['position', 'search ranking', 'serp position'],
};

// Common word stems for lemmatization (v0.5.1)
const LEMMA_MAP: Record<string, string> = {
  'guides': 'guide',
  'guiding': 'guide',
  'guided': 'guide',
  'optimization': 'optimize',
  'optimizing': 'optimize',
  'optimized': 'optimize',
  'rankings': 'ranking',
  'ranked': 'ranking',
  'keywords': 'keyword',
  'strategies': 'strategy',
  'strategic': 'strategy',
  'analyzing': 'analysis',
  'analyzed': 'analysis',
  'analyses': 'analysis',
  'marketing': 'market',
  'marketed': 'market',
  'links': 'link',
  'linking': 'link',
  'linked': 'link',
  'contents': 'content',
  'searches': 'search',
  'searching': 'search',
  'searched': 'search',
};

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
      const entities = this.extractFromContent(content, context, parsedContents);
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
   * v0.5.1: Added keyword verification and corpus-aware scoring
   */
  private extractFromContent(
    content: ParsedContent,
    context: ExtractionContext,
    allContents: ParsedContent[]
  ): Entity[] {
    const entities: Entity[] = [];
    const text = content.textContent.toLowerCase();

    // v0.5.1: Extract topic entity with verification
    if (content.item.primaryKeyword) {
      const keyword = content.item.primaryKeyword;
      const occurrences = this.countOccurrences(text, keyword);
      
      // v0.5.1: Verify keyword actually appears in content
      if (occurrences >= this.config.minKeywordOccurrences) {
        const confidence = this.calculateKeywordConfidence(
          keyword, 
          occurrences, 
          content.wordCount,
          allContents
        );
        
        entities.push(this.createTopicEntity(
          keyword,
          [content.item.id],
          confidence,
          EntityType.TOPIC,
          { occurrences, verified: true }
        ));
      } else {
        // Still create entity but with lower confidence
        this.logger.warn({ 
          keyword, 
          occurrences,
          contentId: content.item.id 
        }, 'Primary keyword has low occurrence in content');
        
        entities.push(this.createTopicEntity(
          keyword,
          [content.item.id],
          0.5, // Lower confidence for unverified
          EntityType.TOPIC,
          { occurrences, verified: false }
        ));
      }
    }

    // v0.5.1: Extract subtopic entities with verification
    if (content.item.supportingKeywords) {
      for (const keyword of content.item.supportingKeywords) {
        const occurrences = this.countOccurrences(text, keyword);
        const verified = occurrences >= 1;
        const confidence = verified ? 0.85 : 0.5;
        
        entities.push(this.createTopicEntity(
          keyword,
          [content.item.id],
          confidence,
          EntityType.SUBTOPIC,
          { occurrences, verified }
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
   * v0.5.1: Count keyword occurrences (including synonyms and lemmas)
   */
  private countOccurrences(text: string, keyword: string): number {
    const normalizedKeyword = keyword.toLowerCase();
    let count = 0;
    
    // Direct match
    const regex = new RegExp('\\b' + this.escapeRegex(normalizedKeyword) + '\\b', 'gi');
    const matches = text.match(regex);
    count += matches ? matches.length : 0;
    
    // v0.5.1: Check synonyms
    const synonyms = SEO_SYNONYMS[normalizedKeyword] || [];
    for (const synonym of synonyms) {
      const synRegex = new RegExp('\\b' + this.escapeRegex(synonym) + '\\b', 'gi');
      const synMatches = text.match(synRegex);
      count += synMatches ? synMatches.length : 0;
    }
    
    // v0.5.1: Check lemmatized forms if enabled
    if (this.config.useLemmatization) {
      const words = normalizedKeyword.split(' ');
      for (const word of words) {
        // Find lemma variants
        for (const [variant, lemma] of Object.entries(LEMMA_MAP)) {
          if (lemma === word || variant === word) {
            const lemmaRegex = new RegExp('\\b' + this.escapeRegex(variant) + '\\b', 'gi');
            const lemmaMatches = text.match(lemmaRegex);
            if (lemmaMatches && variant !== word) {
              count += lemmaMatches.length;
            }
          }
        }
      }
    }
    
    return count;
  }

  /**
   * v0.5.1: Calculate keyword confidence using TF-IDF style scoring
   */
  private calculateKeywordConfidence(
    keyword: string,
    occurrences: number,
    wordCount: number,
    allContents: ParsedContent[]
  ): number {
    // Term Frequency: occurrences / total words (normalized)
    const tf = Math.min(occurrences / Math.max(wordCount / 100, 1), 1);
    
    // Inverse Document Frequency: how unique is this keyword across documents
    const totalDocs = allContents.length;
    const docsWithKeyword = allContents.filter(c => 
      c.textContent.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    // v0.5.1: Handle edge case when only 1 document (IDF = 1 for single doc)
    let idf = 1.0;
    if (totalDocs > 1) {
      idf = Math.log(totalDocs / Math.max(docsWithKeyword, 1)) / Math.log(totalDocs);
      idf = Math.max(0, Math.min(1, idf)); // Clamp to 0-1
    }
    
    // TF-IDF score (0-1 range)
    const tfIdf = tf * (0.5 + 0.5 * idf);
    
    // Base confidence + TF-IDF boost
    const baseConfidence = 0.7;
    const confidence = Math.min(baseConfidence + tfIdf * 0.3, 0.98);
    
    return confidence;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Create a topic entity
   * v0.5.1: Added metadata parameter for verification info
   */
  private createTopicEntity(
    name: string,
    sourceContentIds: string[],
    confidence: number,
    type: EntityType = EntityType.TOPIC,
    metadata: Record<string, unknown> = {}
  ): Entity {
    return {
      id: uuid(),
      name,
      normalizedName: this.normalize(name),
      type,
      mentions: 1,
      sourceContentIds,
      confidence,
      metadata,
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
      'first', 'second', 'third', 'finally',
      'when', 'where', 'what', 'why', 'how',
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
      // v0.5.1: Merge metadata
      existing.metadata = { ...existing.metadata, ...entity.metadata };
    } else {
      map.set(entity.normalizedName, entity);
    }
  }

  /**
   * Normalize entity name for deduplication
   * v0.5.1: Added lemmatization support
   */
  private normalize(name: string): string {
    let normalized = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
    
    // v0.5.1: Apply lemmatization if enabled
    if (this.config.useLemmatization) {
      const words = normalized.split(' ');
      const lemmatized = words.map(w => LEMMA_MAP[w] || w);
      normalized = lemmatized.join(' ');
    }
    
    return normalized;
  }
}
