/**
 * Schema Generator
 * 
 * v0.5.1 - Fixed schema.org compliance issues:
 * - Added image property to Article
 * - Added description property
 * - Fixed Organization logo as ImageObject
 * - Added BreadcrumbList generation
 * - Added author @id for E-E-A-T
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
      
      // v0.5.1: Generate BreadcrumbList for each content
      if (this.config.includeBreadcrumbs) {
        const breadcrumbSchema = this.generateBreadcrumbSchema(content);
        schemas.push(breadcrumbSchema);
      }
    }

    this.logger.info({ schemaCount: schemas.length }, 'Schema generation completed');
    return schemas;
  }

  /**
   * Generate Organization schema
   * v0.5.1: Fixed logo as ImageObject
   */
  private generateOrganizationSchema(): GeneratedSchema {
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${this.siteUrl}/#organization`,
      'name': this.brandName,
      'url': this.siteUrl,
      // v0.5.1: Logo must be ImageObject for rich snippets
      'logo': {
        '@type': 'ImageObject',
        'url': `${this.siteUrl}/logo.png`,
        'width': 600,
        'height': 60,
      },
    };
    
    // v0.5.1: Don't include empty sameAs array

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
   * v0.5.1: Added @id for E-E-A-T linking
   */
  private generatePersonSchema(author: Entity): GeneratedSchema {
    const authorUrl = `${this.siteUrl}/author/${this.slugify(author.name)}`;
    
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': `${authorUrl}#author`,  // v0.5.1: Add @id for cross-referencing
      'name': author.name,
      'url': authorUrl,
      'worksFor': {
        '@type': 'Organization',
        '@id': `${this.siteUrl}/#organization`,
        'name': this.brandName,
      },
    };

    // v0.5.1: Add sameAs if author has social profiles in metadata
    if (author.metadata?.socialProfiles && Array.isArray(author.metadata.socialProfiles)) {
      jsonLd['sameAs'] = author.metadata.socialProfiles;
    }

    const { isValid, errors } = this.validateSchema(jsonLd, 'Person');

    return {
      contentId: author.id,
      url: authorUrl,
      schemaType: 'Person',
      jsonLd,
      isValid,
      validationErrors: errors,
    };
  }

  /**
   * Generate Article schema
   * v0.5.1: Added image, description, improved author linking
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
      'headline': this.truncateHeadline(content.item.title),
      'url': content.item.url,
      // v0.5.1: Add description (use first 160 chars of content)
      'description': this.generateDescription(content),
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': content.item.url,
      },
      // v0.5.1: Add image property (required for rich snippets)
      'image': this.generateImageObject(content),
      'publisher': {
        '@type': 'Organization',
        '@id': `${this.siteUrl}/#organization`,
        'name': this.brandName,
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

    // Add dates - use current date as fallback
    const now = new Date().toISOString();
    jsonLd['datePublished'] = content.item.publishedAt || now;
    jsonLd['dateModified'] = content.item.updatedAt || content.item.publishedAt || now;

    // v0.5.1: Improved author with @id for E-E-A-T
    if (authorEntity) {
      const authorUrl = `${this.siteUrl}/author/${this.slugify(authorEntity.name)}`;
      jsonLd['author'] = {
        '@type': 'Person',
        '@id': `${authorUrl}#author`,
        'name': authorEntity.name,
        'url': authorUrl,
      };
    } else if (content.item.author) {
      jsonLd['author'] = {
        '@type': 'Person',
        'name': content.item.author,
        'url': `${this.siteUrl}/author/${this.slugify(content.item.author)}`,
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
   * v0.5.1: Generate BreadcrumbList schema
   */
  private generateBreadcrumbSchema(content: ParsedContent): GeneratedSchema {
    // Parse URL path to create breadcrumb items
    const breadcrumbs = this.parseBreadcrumbsFromUrl(content.item.url);
    
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'name': crumb.name,
        'item': crumb.url,
      })),
    };

    const { isValid, errors } = this.validateSchema(jsonLd, 'BreadcrumbList');

    return {
      contentId: `${content.item.id}-breadcrumb`,
      url: content.item.url,
      schemaType: 'BreadcrumbList',
      jsonLd,
      isValid,
      validationErrors: errors,
    };
  }

  /**
   * v0.5.1: Parse URL to generate breadcrumb items
   */
  private parseBreadcrumbsFromUrl(url: string): Array<{ name: string; url: string }> {
    const breadcrumbs: Array<{ name: string; url: string }> = [];
    
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);
      
      // Always start with Home
      breadcrumbs.push({
        name: 'Home',
        url: `${parsed.origin}/`,
      });
      
      // Build breadcrumb for each path segment
      let currentPath = '';
      for (const part of pathParts) {
        currentPath += `/${part}`;
        breadcrumbs.push({
          name: this.formatBreadcrumbName(part),
          url: `${parsed.origin}${currentPath}`,
        });
      }
    } catch {
      // Fallback: just Home and current page
      breadcrumbs.push({ name: 'Home', url: this.siteUrl });
    }
    
    return breadcrumbs;
  }

  /**
   * v0.5.1: Format URL segment as readable breadcrumb name
   */
  private formatBreadcrumbName(segment: string): string {
    return segment
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * v0.5.1: Generate description from content
   */
  private generateDescription(content: ParsedContent): string {
    // Use first 155-160 characters of text content
    const text = content.textContent
      .replace(/\s+/g, ' ')
      .trim();
    
    if (text.length <= 160) {
      return text;
    }
    
    // Truncate at word boundary
    const truncated = text.substring(0, 157);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + '...';
  }

  /**
   * v0.5.1: Generate image object (placeholder - should be provided by content)
   */
  private generateImageObject(content: ParsedContent): Record<string, unknown> {
    // Try to extract image from content metadata
    const imageUrl = (content.item as Record<string, unknown>).featuredImage as string
      || `${this.siteUrl}/images/${this.slugify(content.item.title)}.jpg`;
    
    return {
      '@type': 'ImageObject',
      'url': imageUrl,
      'width': 1200,
      'height': 630,
    };
  }

  /**
   * v0.5.1: Truncate headline to 110 chars (Google's max display)
   */
  private truncateHeadline(title: string): string {
    if (title.length <= 110) {
      return title;
    }
    return title.substring(0, 107) + '...';
  }

  /**
   * Validate schema structure
   * v0.5.1: Added validation for image and BreadcrumbList
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
        if (!jsonLd['logo']) errors.push('Organization missing "logo"');
        break;

      case 'Person':
        if (!jsonLd['name']) errors.push('Person missing "name"');
        break;

      case 'Article':
        if (!jsonLd['headline']) errors.push('Article missing "headline"');
        if (!jsonLd['publisher']) errors.push('Article missing "publisher"');
        // v0.5.1: Validate required fields for rich snippets
        if (!jsonLd['image']) errors.push('Article missing "image" (required for rich snippets)');
        if (!jsonLd['datePublished']) errors.push('Article missing "datePublished"');
        if (!jsonLd['author']) errors.push('Article missing "author" (required for E-E-A-T)');
        break;
        
      case 'BreadcrumbList':
        if (!jsonLd['itemListElement']) errors.push('BreadcrumbList missing "itemListElement"');
        const items = jsonLd['itemListElement'] as Array<Record<string, unknown>>;
        if (items && items.length === 0) errors.push('BreadcrumbList has no items');
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
