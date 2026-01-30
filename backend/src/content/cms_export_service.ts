/**
 * CMS Export Service
 * Section 15: Export Content & Content Brief to CMS
 * 
 * Handles export to:
 * - WordPress
 * - Strapi
 * - Contentful
 * - Sanity
 * - Custom CMS
 */

import {
  ContentBrief,
  GeneratedContent,
  ContentQAResult,
  CMSExport,
  CMSConfig,
  CMSType,
  ExportPackage,
  ExportStatus,
  ExportGateCheck,
  ExportGateResult,
} from './types';

// Interface for CMS Adapter
export interface CMSAdapter {
  type: CMSType;
  export(exportPackage: ExportPackage, config: CMSConfig): Promise<CMSExportResponse>;
  validateConfig(config: CMSConfig): boolean;
}

export interface CMSExportResponse {
  success: boolean;
  content_id?: string;
  content_url?: string;
  error?: string;
  raw_response?: Record<string, any>;
}

/**
 * Export Gate Validator
 * Ensures all conditions are met before export (Section 15.2)
 */
export class ExportGateValidator {
  /**
   * Check all export gates
   */
  validateGates(
    brief: ContentBrief,
    content: GeneratedContent,
    qaResult: ContentQAResult
  ): ExportGateResult {
    const checks: ExportGateCheck[] = [];
    const blockingGates: string[] = [];

    // Gate 1: Brief must be APPROVED
    const briefApproved = brief.status === 'APPROVED';
    checks.push({
      gate: 'BRIEF_APPROVED',
      status: briefApproved ? 'PASS' : 'FAIL',
      message: briefApproved
        ? 'Content Brief is approved'
        : `Content Brief status is "${brief.status}" (required: APPROVED)`,
      details: { current_status: brief.status },
    });
    if (!briefApproved) blockingGates.push('BRIEF_APPROVED');

    // Gate 2: Content must be APPROVED
    const contentApproved = content.status === 'APPROVED';
    checks.push({
      gate: 'CONTENT_APPROVED',
      status: contentApproved ? 'PASS' : 'FAIL',
      message: contentApproved
        ? 'Content is approved'
        : `Content status is "${content.status}" (required: APPROVED)`,
      details: { current_status: content.status },
    });
    if (!contentApproved) blockingGates.push('CONTENT_APPROVED');

    // Gate 3: QA must be PASS (or WARN is acceptable)
    const qaPassedOrWarn = qaResult.qa_status === 'PASS' || qaResult.qa_status === 'WARN';
    const noBlockingIssues = qaResult.blocking_issues_count === 0;
    const qaPassed = qaPassedOrWarn && noBlockingIssues;

    checks.push({
      gate: 'QA_PASSED',
      status: qaPassed ? 'PASS' : 'FAIL',
      message: qaPassed
        ? `QA passed (status: ${qaResult.qa_status}, score: ${qaResult.overall_score})`
        : `QA failed: ${qaResult.blocking_issues_count} blocking issues`,
      details: {
        qa_status: qaResult.qa_status,
        score: qaResult.overall_score,
        blocking_issues: qaResult.blocking_issues_count,
      },
    });
    if (!qaPassed) blockingGates.push('QA_PASSED');

    return {
      can_export: blockingGates.length === 0,
      checks,
      blocking_gates: blockingGates,
    };
  }
}

/**
 * Export Package Builder
 * Creates the export package structure (Section 15.3)
 */
export class ExportPackageBuilder {
  /**
   * Build export package from content and brief
   */
  build(
    content: GeneratedContent,
    brief: ContentBrief,
    qaResult: ContentQAResult
  ): ExportPackage {
    // Extract headings from markdown
    const headings = this.extractHeadings(content.content_markdown);

    // Extract internal links
    const internalLinks = this.extractLinks(content.content_markdown);

    // Extract images
    const images = this.extractImages(content.content_markdown);

    return {
      // Metadata
      export_id: this.generateExportId(),
      exported_at: new Date().toISOString(),
      version: '1.0',

      // Brief context
      brief: {
        brief_id: brief.id,
        primary_keyword: brief.primary_keyword,
        secondary_keywords: brief.secondary_keywords,
        search_intent: brief.search_intent,
        content_type: brief.content_type,
        target_url: brief.target_url || '',
      },

      // Content
      content: {
        title: content.title,
        body_markdown: content.content_markdown,
        body_html: content.content_html || this.markdownToHtml(content.content_markdown),
        word_count: content.word_count,
      },

      // SEO
      seo: {
        meta_title: content.meta_title || content.title,
        meta_description: content.meta_description || '',
        focus_keyword: brief.primary_keyword,
        canonical_url: brief.target_url,
        robots: 'index, follow',
      },

      // Structure
      structure: {
        headings,
        internal_links: internalLinks,
        images,
      },

      // Schema (optional)
      schema: this.buildSchema(brief, content),

      // QA Summary
      qa_summary: {
        qa_status: qaResult.qa_status,
        overall_score: qaResult.overall_score,
        issues_count: {
          blocking: qaResult.blocking_issues_count,
          warning: qaResult.warning_issues_count,
          info: qaResult.info_issues_count,
        },
      },

      // Traceability
      traceability: {
        project_id: content.project_id,
        content_id: content.id,
        brief_id: content.brief_id,
        qa_result_id: qaResult.id,
      },
    };
  }

  private generateExportId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private extractHeadings(markdown: string): Array<{ level: number; text: string }> {
    const headings: Array<{ level: number; text: string }> = [];
    const lines = markdown.split('\n');

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
        });
      }
    }

    return headings;
  }

  private extractLinks(markdown: string): Array<{ url: string; anchor: string }> {
    const links: Array<{ url: string; anchor: string }> = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
      links.push({
        anchor: match[1],
        url: match[2],
      });
    }

    return links;
  }

  private extractImages(markdown: string): Array<{ src: string; alt: string }> {
    const images: Array<{ src: string; alt: string }> = [];
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
      images.push({
        alt: match[1],
        src: match[2],
      });
    }

    return images;
  }

  private markdownToHtml(markdown: string): string {
    // Basic markdown to HTML conversion
    let html = markdown
      // Headers
      .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br />');

    return `<p>${html}</p>`;
  }

  private buildSchema(
    brief: ContentBrief,
    content: GeneratedContent
  ): { type: string; json_ld: object } | undefined {
    // Build Article schema by default
    if (brief.content_type === 'article' || brief.content_type === 'blog') {
      return {
        type: 'Article',
        json_ld: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: content.title,
          description: content.meta_description || '',
          keywords: [brief.primary_keyword, ...brief.secondary_keywords].join(', '),
          articleBody: content.content_markdown.slice(0, 500),
        },
      };
    }

    // FAQ schema for FAQ content
    if (brief.content_type === 'faq') {
      return {
        type: 'FAQPage',
        json_ld: {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [], // Would need to extract Q&A from content
        },
      };
    }

    return undefined;
  }
}

/**
 * WordPress CMS Adapter
 */
export class WordPressAdapter implements CMSAdapter {
  type: CMSType = 'wordpress';

  async export(exportPackage: ExportPackage, config: CMSConfig): Promise<CMSExportResponse> {
    try {
      const response = await fetch(`${config.api_url}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.auth_token}`,
          ...config.custom_headers,
        },
        body: JSON.stringify({
          title: exportPackage.content.title,
          content: exportPackage.content.body_html,
          status: 'draft',
          slug: this.generateSlug(exportPackage.content.title),
          meta: {
            _yoast_wpseo_title: exportPackage.seo.meta_title,
            _yoast_wpseo_metadesc: exportPackage.seo.meta_description,
            _yoast_wpseo_focuskw: exportPackage.seo.focus_keyword,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `WordPress API error: ${response.status} - ${error}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        content_id: result.id.toString(),
        content_url: result.link,
        raw_response: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `WordPress export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  validateConfig(config: CMSConfig): boolean {
    return !!(config.api_url && config.auth_token);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);
  }
}

/**
 * Strapi CMS Adapter
 */
export class StrapiAdapter implements CMSAdapter {
  type: CMSType = 'strapi';

  async export(exportPackage: ExportPackage, config: CMSConfig): Promise<CMSExportResponse> {
    try {
      const contentType = config.content_type_id || 'articles';

      const response = await fetch(`${config.api_url}/api/${contentType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.api_key}`,
          ...config.custom_headers,
        },
        body: JSON.stringify({
          data: {
            title: exportPackage.content.title,
            content: exportPackage.content.body_markdown,
            seo: {
              metaTitle: exportPackage.seo.meta_title,
              metaDescription: exportPackage.seo.meta_description,
              keywords: exportPackage.seo.focus_keyword,
            },
            slug: this.generateSlug(exportPackage.content.title),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Strapi API error: ${response.status} - ${error}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        content_id: result.data.id.toString(),
        content_url: `${config.api_url}/${contentType}/${result.data.id}`,
        raw_response: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Strapi export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  validateConfig(config: CMSConfig): boolean {
    return !!(config.api_url && config.api_key);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 100);
  }
}

/**
 * Contentful CMS Adapter
 */
export class ContentfulAdapter implements CMSAdapter {
  type: CMSType = 'contentful';

  async export(exportPackage: ExportPackage, config: CMSConfig): Promise<CMSExportResponse> {
    try {
      const spaceId = config.api_url; // Use api_url as space ID
      const contentTypeId = config.content_type_id || 'article';

      const response = await fetch(
        `https://api.contentful.com/spaces/${spaceId}/environments/master/entries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.contentful.management.v1+json',
            Authorization: `Bearer ${config.api_key}`,
            'X-Contentful-Content-Type': contentTypeId,
            ...config.custom_headers,
          },
          body: JSON.stringify({
            fields: {
              title: { 'en-US': exportPackage.content.title },
              body: { 'en-US': exportPackage.content.body_markdown },
              metaTitle: { 'en-US': exportPackage.seo.meta_title },
              metaDescription: { 'en-US': exportPackage.seo.meta_description },
              slug: { 'en-US': this.generateSlug(exportPackage.content.title) },
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Contentful API error: ${response.status} - ${error}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        content_id: result.sys.id,
        content_url: `https://app.contentful.com/spaces/${spaceId}/entries/${result.sys.id}`,
        raw_response: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Contentful export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  validateConfig(config: CMSConfig): boolean {
    return !!(config.api_url && config.api_key);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 100);
  }
}

/**
 * Main CMS Export Service
 */
export class CMSExportService {
  private gateValidator: ExportGateValidator;
  private packageBuilder: ExportPackageBuilder;
  private adapters: Map<CMSType, CMSAdapter>;

  constructor() {
    this.gateValidator = new ExportGateValidator();
    this.packageBuilder = new ExportPackageBuilder();
    this.adapters = new Map();

    // Register default adapters
    this.registerAdapter(new WordPressAdapter());
    this.registerAdapter(new StrapiAdapter());
    this.registerAdapter(new ContentfulAdapter());
  }

  /**
   * Register a CMS adapter
   */
  registerAdapter(adapter: CMSAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  /**
   * Validate export gates before export
   */
  validateGates(
    brief: ContentBrief,
    content: GeneratedContent,
    qaResult: ContentQAResult
  ): ExportGateResult {
    return this.gateValidator.validateGates(brief, content, qaResult);
  }

  /**
   * Build export package
   */
  buildPackage(
    content: GeneratedContent,
    brief: ContentBrief,
    qaResult: ContentQAResult
  ): ExportPackage {
    return this.packageBuilder.build(content, brief, qaResult);
  }

  /**
   * Export content to CMS
   */
  async export(
    content: GeneratedContent,
    brief: ContentBrief,
    qaResult: ContentQAResult,
    config: CMSConfig
  ): Promise<{
    export: Partial<CMSExport>;
    response: CMSExportResponse;
  }> {
    // Validate gates
    const gateResult = this.validateGates(brief, content, qaResult);
    if (!gateResult.can_export) {
      return {
        export: {
          status: 'BLOCKED',
          error_message: `Export blocked by gates: ${gateResult.blocking_gates.join(', ')}`,
        },
        response: {
          success: false,
          error: `Export blocked: ${gateResult.blocking_gates.join(', ')}`,
        },
      };
    }

    // Get adapter
    const adapter = this.adapters.get(config.cms_type);
    if (!adapter) {
      return {
        export: {
          status: 'FAILED',
          error_message: `No adapter found for CMS type: ${config.cms_type}`,
        },
        response: {
          success: false,
          error: `Unsupported CMS type: ${config.cms_type}`,
        },
      };
    }

    // Validate config
    if (!adapter.validateConfig(config)) {
      return {
        export: {
          status: 'FAILED',
          error_message: 'Invalid CMS configuration',
        },
        response: {
          success: false,
          error: 'CMS configuration is invalid or incomplete',
        },
      };
    }

    // Build package
    const exportPackage = this.buildPackage(content, brief, qaResult);

    // Export
    const response = await adapter.export(exportPackage, config);

    const exportRecord: Partial<CMSExport> = {
      project_id: content.project_id,
      content_id: content.id,
      brief_id: content.brief_id,
      qa_result_id: qaResult.id,
      cms_type: config.cms_type,
      cms_config: config,
      status: response.success ? 'SUCCESS' : 'FAILED',
      export_package: exportPackage,
      cms_response: response.raw_response,
      cms_content_id: response.content_id,
      cms_url: response.content_url,
      error_message: response.error,
      exported_at: response.success ? new Date() : undefined,
    };

    return { export: exportRecord, response };
  }
}

// Factory and singleton
export const cmsExportService = new CMSExportService();

export function createCMSExportService(): CMSExportService {
  return new CMSExportService();
}
