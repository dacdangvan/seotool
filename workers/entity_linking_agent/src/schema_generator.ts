/**
 * Schema Generator
 * 
 * Generates schema.org JSON-LD:
 * - Article schema
 * - Organization schema
 * - Person (Author) schema
 * - BreadcrumbList schema
 * 
 * Validates generated schemas
 */

import { v4 as uuid } from 'uuid';
import {
  Entity,
  EntityType,
  ParsedContent,
  GeneratedSchema,
} from './models';
import { Config } from './config';
import { Logger } from './logger';

// =============================================================================
// SCHEMA GENERATOR
// =============================================================================

export class SchemaGenerator {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
    private readonly brandName: string,
    private readonly siteUrl: string
  ) {}

  /**
   * Generate all applicable schemas
   */
  generate(
    contents: ParsedContent[],
    entities: Entity[]
  ): GeneratedSchema[] {
    if (!this.config.includeSchemaGeneration) {
      return [];
    }

    this.logger.info({ contentCount: contents.length }, 'Generating schemas');

    const schemas: GeneratedSchema[] = [];

    // Generate Organization schema (once for the site)
    const orgSchema = this.generateOrganizationSchema();
    schemas.push(orgSchema);

    // Generate Author schemas
    const authorEntities = entities.filter(e => e.type === EntityType.AUTHOR);
    for (const author of authorEntities) {
      schemas.push(this.generatePersonSchema(author));
    }

    // Generate Article schemas for each content
    for (const content of contents) {
      const articleSchema = this.generateArticleSchema(content, entities);
      schemas.push(articleSchema);
    }

    this.logger.info({ schemaCount: schemas.length }, 'Schema generation completed');
    return schemas;
  }

  /**
   * Generate Organization schema
   */
  private generateOrganizationSchema(): GeneratedSchema {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': this.brandName,
      'url': this.siteUrl,
      'logo': `${this.siteUrl}/logo.png`,
      'sameAs': [],
    };

    const { isValid, errors } = this.validateSchema(jsonLd, 'Organization');

    return {
      contentId: 'site',
      url: this.siteUrl,
      schemaType: 'Organization',
      jsonLd,
      isValid,
      validationErrors: errors,
    };
  }

  /**
   * Generate Person (Author) schema
   */
  private generatePersonSchema(author: Entity): GeneratedSchema {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      'name': author.name,
      'url': `${this.siteUrl}/author/${this.slugify(author.name)}`,
      'worksFor': {
        '@type': 'Organization',
        'name': this.brandName,
        'url': this.siteUrl,
      },
    };

    const { isValid, errors } = this.validateSchema(jsonLd, 'Person');

    return {
      contentId: author.id,
      url: `${this.siteUrl}/author/${this.slugify(author.name)}`,
      schemaType: 'Person',
      jsonLd,
      isValid,
      validationErrors: errors,
    };
  }

  /**
   * Generate Article schema
   */
  private generateArticleSchema(
    content: ParsedContent,
    entities: Entity[]
  ): GeneratedSchema {
    // Find author entity for this content
    const authorEntity = entities.find(e => 
      e.type === EntityType.AUTHOR && 
      e.sourceContentIds.includes(content.item.id)
    );

    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': content.item.title,
      'url': content.item.url,
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': content.item.url,
      },
      'publisher': {
        '@type': 'Organization',
        'name': this.brandName,
        'url': this.siteUrl,
        'logo': {
          '@type': 'ImageObject',
          'url': `${this.siteUrl}/logo.png`,
        },
      },
      'wordCount': content.wordCount,
      'keywords': [
        content.item.primaryKeyword,
        ...(content.item.supportingKeywords || []),
      ].join(', '),
    };

    // Add dates if available
    if (content.item.publishedAt) {
      jsonLd['datePublished'] = content.item.publishedAt;
    }
    if (content.item.updatedAt) {
      jsonLd['dateModified'] = content.item.updatedAt;
    }

    // Add author if available
    if (authorEntity) {
      jsonLd['author'] = {
        '@type': 'Person',
        'name': authorEntity.name,
        'url': `${this.siteUrl}/author/${this.slugify(authorEntity.name)}`,
      };
    } else if (content.item.author) {
      jsonLd['author'] = {
        '@type': 'Person',
        'name': content.item.author,
      };
    }

    // Add about (topics)
    const topicEntities = entities.filter(e => 
      (e.type === EntityType.TOPIC || e.type === EntityType.SUBTOPIC) &&
      e.sourceContentIds.includes(content.item.id)
    );

    if (topicEntities.length > 0) {
      jsonLd['about'] = topicEntities.map(t => ({
        '@type': 'Thing',
        'name': t.name,
      }));
    }

    const { isValid, errors } = this.validateSchema(jsonLd, 'Article');

    return {
      contentId: content.item.id,
      url: content.item.url,
      schemaType: 'Article',
      jsonLd,
      isValid,
      validationErrors: errors,
    };
  }

  /**
   * Validate schema structure
   */
  private validateSchema(
    jsonLd: Record<string, unknown>,
    schemaType: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required @context
    if (jsonLd['@context'] !== 'https://schema.org') {
      errors.push('Missing or invalid @context');
    }

    // Check required @type
    if (jsonLd['@type'] !== schemaType) {
      errors.push(`Invalid @type: expected ${schemaType}`);
    }

    // Type-specific validation
    switch (schemaType) {
      case 'Organization':
        if (!jsonLd['name']) errors.push('Organization missing "name"');
        if (!jsonLd['url']) errors.push('Organization missing "url"');
        break;

      case 'Person':
        if (!jsonLd['name']) errors.push('Person missing "name"');
        break;

      case 'Article':
        if (!jsonLd['headline']) errors.push('Article missing "headline"');
        if (!jsonLd['publisher']) errors.push('Article missing "publisher"');
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create URL-safe slug from name
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
