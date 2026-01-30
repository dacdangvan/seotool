/**
 * Content Repository
 * Section 0.1: Crawl-Centric Data Architecture
 * 
 * ALL DATA MUST BE FROM DATABASE (populated by crawl)
 * No mock data in production.
 */

import { Pool } from 'pg';
import {
  ContentBrief,
  BriefStatus,
  GeneratedContent,
  ContentStatus,
  ContentQAResult,
  CMSExport,
  CrawledContent,
  NormalizedContent,
} from './types';

export class ContentRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ============================================================================
  // CRAWLED CONTENT (Section 17)
  // ============================================================================

  /**
   * Save normalized content from crawl
   */
  async saveCrawledContent(content: Omit<CrawledContent, 'id' | 'created_at' | 'updated_at'>): Promise<CrawledContent> {
    const query = `
      INSERT INTO crawled_content (
        project_id, crawl_job_id, url, render_mode, language,
        raw_rendered_html, normalized_content, title, headings, sections,
        paragraphs, lists, tables, images, embedded_media,
        internal_links, external_links, structured_data, schema_types,
        word_count, reading_time_minutes, crawled_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
      ON CONFLICT (crawl_job_id, url) DO UPDATE SET
        render_mode = EXCLUDED.render_mode,
        language = EXCLUDED.language,
        raw_rendered_html = EXCLUDED.raw_rendered_html,
        normalized_content = EXCLUDED.normalized_content,
        title = EXCLUDED.title,
        headings = EXCLUDED.headings,
        sections = EXCLUDED.sections,
        paragraphs = EXCLUDED.paragraphs,
        lists = EXCLUDED.lists,
        tables = EXCLUDED.tables,
        images = EXCLUDED.images,
        embedded_media = EXCLUDED.embedded_media,
        internal_links = EXCLUDED.internal_links,
        external_links = EXCLUDED.external_links,
        structured_data = EXCLUDED.structured_data,
        schema_types = EXCLUDED.schema_types,
        word_count = EXCLUDED.word_count,
        reading_time_minutes = EXCLUDED.reading_time_minutes,
        crawled_at = EXCLUDED.crawled_at,
        updated_at = NOW()
      RETURNING *
    `;

    const normalized = content.normalized_content;
    const values = [
      content.project_id,
      content.crawl_job_id,
      content.url,
      content.render_mode,
      content.language || normalized.language,
      content.raw_rendered_html,
      JSON.stringify(normalized),
      normalized.content.title,
      JSON.stringify(normalized.content.headings),
      JSON.stringify(normalized.content.sections),
      JSON.stringify(normalized.content.paragraphs),
      JSON.stringify(normalized.content.lists),
      JSON.stringify(normalized.content.tables),
      JSON.stringify(normalized.media.images),
      JSON.stringify(normalized.media.embedded_media),
      JSON.stringify(normalized.links.internal),
      JSON.stringify(normalized.links.external),
      JSON.stringify(normalized.structured_data.json_ld),
      JSON.stringify(normalized.structured_data.schema_types),
      normalized.metrics.word_count,
      normalized.metrics.reading_time_minutes,
      content.crawled_at,
    ];

    const result = await this.pool.query(query, values);
    return this.mapCrawledContent(result.rows[0]);
  }

  /**
   * Get crawled content by URL
   */
  async getCrawledContentByUrl(projectId: string, url: string): Promise<CrawledContent | null> {
    const query = `
      SELECT * FROM crawled_content
      WHERE project_id = $1 AND url = $2
      ORDER BY crawled_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [projectId, url]);
    return result.rows[0] ? this.mapCrawledContent(result.rows[0]) : null;
  }

  /**
   * Get all crawled content for a project
   */
  async getCrawledContentByProject(projectId: string, limit = 100, offset = 0): Promise<CrawledContent[]> {
    const query = `
      SELECT * FROM crawled_content
      WHERE project_id = $1
      ORDER BY crawled_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [projectId, limit, offset]);
    return result.rows.map((row) => this.mapCrawledContent(row));
  }

  // ============================================================================
  // CONTENT BRIEFS (Section 13)
  // ============================================================================

  /**
   * Create a new content brief
   */
  async createBrief(brief: Omit<ContentBrief, 'id' | 'created_at' | 'updated_at'>): Promise<ContentBrief> {
    const query = `
      INSERT INTO content_briefs (
        project_id, content_mode, status, objective, target_audience, content_type,
        primary_keyword, secondary_keywords, related_entities, search_intent, target_url,
        cannibalization_risk, differentiation_angle, recommended_structure,
        internal_links_plan, word_count_min, word_count_max, reading_level,
        tone, formality, cta_style, seo_constraints, risks, success_metrics
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING *
    `;

    const values = [
      brief.project_id,
      brief.content_mode,
      brief.status,
      brief.objective,
      brief.target_audience,
      brief.content_type,
      brief.primary_keyword,
      JSON.stringify(brief.secondary_keywords),
      JSON.stringify(brief.related_entities),
      brief.search_intent,
      brief.target_url,
      brief.cannibalization_risk,
      brief.differentiation_angle,
      JSON.stringify(brief.recommended_structure),
      JSON.stringify(brief.internal_links_plan),
      brief.word_count_min,
      brief.word_count_max,
      brief.reading_level,
      brief.tone,
      brief.formality,
      brief.cta_style,
      JSON.stringify(brief.seo_constraints),
      JSON.stringify(brief.risks),
      JSON.stringify(brief.success_metrics),
    ];

    const result = await this.pool.query(query, values);
    return this.mapBrief(result.rows[0]);
  }

  /**
   * Get brief by ID
   */
  async getBriefById(id: string): Promise<ContentBrief | null> {
    const query = 'SELECT * FROM content_briefs WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] ? this.mapBrief(result.rows[0]) : null;
  }

  /**
   * Get briefs by project
   */
  async getBriefsByProject(
    projectId: string,
    status?: BriefStatus,
    limit = 50,
    offset = 0
  ): Promise<ContentBrief[]> {
    let query = 'SELECT * FROM content_briefs WHERE project_id = $1';
    const values: any[] = [projectId];

    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapBrief(row));
  }

  /**
   * Update brief status
   */
  async updateBriefStatus(
    id: string,
    status: BriefStatus,
    approvedBy?: string
  ): Promise<ContentBrief | null> {
    const query = `
      UPDATE content_briefs
      SET status = $2, approved_by = $3, approved_at = CASE WHEN $2 = 'APPROVED' THEN NOW() ELSE approved_at END, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query(query, [id, status, approvedBy]);
    return result.rows[0] ? this.mapBrief(result.rows[0]) : null;
  }

  // ============================================================================
  // GENERATED CONTENT (Section 14)
  // ============================================================================

  /**
   * Save generated content
   */
  async saveGeneratedContent(
    content: Omit<GeneratedContent, 'id' | 'created_at' | 'updated_at'>
  ): Promise<GeneratedContent> {
    const query = `
      INSERT INTO generated_content (
        project_id, brief_id, title, content_markdown, content_html,
        meta_title, meta_description, status, version,
        generated_by, model_used, generation_params, word_count, reading_time_minutes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `;

    const values = [
      content.project_id,
      content.brief_id,
      content.title,
      content.content_markdown,
      content.content_html,
      content.meta_title,
      content.meta_description,
      content.status,
      content.version,
      content.generated_by,
      content.model_used,
      JSON.stringify(content.generation_params),
      content.word_count,
      content.reading_time_minutes,
    ];

    const result = await this.pool.query(query, values);
    return this.mapGeneratedContent(result.rows[0]);
  }

  /**
   * Get generated content by ID
   */
  async getGeneratedContentById(id: string): Promise<GeneratedContent | null> {
    const query = 'SELECT * FROM generated_content WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] ? this.mapGeneratedContent(result.rows[0]) : null;
  }

  /**
   * Get content by brief
   */
  async getContentByBrief(briefId: string): Promise<GeneratedContent[]> {
    const query = 'SELECT * FROM generated_content WHERE brief_id = $1 ORDER BY version DESC';
    const result = await this.pool.query(query, [briefId]);
    return result.rows.map((row) => this.mapGeneratedContent(row));
  }

  /**
   * Update content status
   */
  async updateContentStatus(id: string, status: ContentStatus): Promise<GeneratedContent | null> {
    const query = `
      UPDATE generated_content
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query(query, [id, status]);
    return result.rows[0] ? this.mapGeneratedContent(result.rows[0]) : null;
  }

  /**
   * Get content by project
   */
  async getContentByProject(
    projectId: string,
    status?: ContentStatus,
    limit = 50,
    offset = 0
  ): Promise<GeneratedContent[]> {
    let query = 'SELECT * FROM generated_content WHERE project_id = $1';
    const values: any[] = [projectId];

    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2);
    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    return result.rows.map((row) => this.mapGeneratedContent(row));
  }

  // ============================================================================
  // QA RESULTS (Section 16)
  // ============================================================================

  /**
   * Save QA result
   */
  async saveQAResult(qaResult: Omit<ContentQAResult, 'id' | 'created_at'>): Promise<ContentQAResult> {
    const query = `
      INSERT INTO content_qa_results (
        project_id, content_id, brief_id, qa_status, overall_score,
        structure_status, structure_score, structure_issues,
        seo_status, seo_score, seo_issues,
        intent_status, intent_score, intent_issues,
        brand_status, brand_score, brand_issues,
        technical_status, technical_score, technical_issues,
        all_issues, blocking_issues_count, warning_issues_count, info_issues_count,
        validated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      RETURNING *
    `;

    const values = [
      qaResult.project_id,
      qaResult.content_id,
      qaResult.brief_id,
      qaResult.qa_status,
      qaResult.overall_score,
      qaResult.structure.status,
      qaResult.structure.score,
      JSON.stringify(qaResult.structure.issues),
      qaResult.seo.status,
      qaResult.seo.score,
      JSON.stringify(qaResult.seo.issues),
      qaResult.intent.status,
      qaResult.intent.score,
      JSON.stringify(qaResult.intent.issues),
      qaResult.brand.status,
      qaResult.brand.score,
      JSON.stringify(qaResult.brand.issues),
      qaResult.technical.status,
      qaResult.technical.score,
      JSON.stringify(qaResult.technical.issues),
      JSON.stringify(qaResult.all_issues),
      qaResult.blocking_issues_count,
      qaResult.warning_issues_count,
      qaResult.info_issues_count,
      qaResult.validated_at,
    ];

    const result = await this.pool.query(query, values);
    return this.mapQAResult(result.rows[0]);
  }

  /**
   * Get QA result by content ID
   */
  async getQAResultByContentId(contentId: string): Promise<ContentQAResult | null> {
    const query = `
      SELECT * FROM content_qa_results
      WHERE content_id = $1
      ORDER BY validated_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [contentId]);
    return result.rows[0] ? this.mapQAResult(result.rows[0]) : null;
  }

  // ============================================================================
  // CMS EXPORTS (Section 15)
  // ============================================================================

  /**
   * Save CMS export record
   */
  async saveCMSExport(exportRecord: Omit<CMSExport, 'id' | 'created_at' | 'updated_at'>): Promise<CMSExport> {
    const query = `
      INSERT INTO cms_exports (
        project_id, content_id, brief_id, qa_result_id,
        cms_type, cms_config, status, export_package,
        cms_response, cms_content_id, cms_url, error_message, retry_count, exported_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `;

    const values = [
      exportRecord.project_id,
      exportRecord.content_id,
      exportRecord.brief_id,
      exportRecord.qa_result_id,
      exportRecord.cms_type,
      JSON.stringify(exportRecord.cms_config),
      exportRecord.status,
      JSON.stringify(exportRecord.export_package),
      exportRecord.cms_response ? JSON.stringify(exportRecord.cms_response) : null,
      exportRecord.cms_content_id,
      exportRecord.cms_url,
      exportRecord.error_message,
      exportRecord.retry_count,
      exportRecord.exported_at,
    ];

    const result = await this.pool.query(query, values);
    return this.mapCMSExport(result.rows[0]);
  }

  /**
   * Get exports by project
   */
  async getExportsByProject(projectId: string, limit = 50, offset = 0): Promise<CMSExport[]> {
    const query = `
      SELECT * FROM cms_exports
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [projectId, limit, offset]);
    return result.rows.map((row) => this.mapCMSExport(row));
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapCrawledContent(row: any): CrawledContent {
    return {
      id: row.id,
      project_id: row.project_id,
      crawl_job_id: row.crawl_job_id,
      url: row.url,
      render_mode: row.render_mode,
      language: row.language,
      raw_rendered_html: row.raw_rendered_html,
      normalized_content: row.normalized_content,
      crawled_at: new Date(row.crawled_at),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapBrief(row: any): ContentBrief {
    return {
      id: row.id,
      project_id: row.project_id,
      content_mode: row.content_mode,
      status: row.status,
      objective: row.objective,
      target_audience: row.target_audience,
      content_type: row.content_type,
      primary_keyword: row.primary_keyword,
      secondary_keywords: row.secondary_keywords || [],
      related_entities: row.related_entities || [],
      search_intent: row.search_intent,
      target_url: row.target_url,
      cannibalization_risk: row.cannibalization_risk,
      differentiation_angle: row.differentiation_angle,
      recommended_structure: row.recommended_structure || {},
      internal_links_plan: row.internal_links_plan || [],
      word_count_min: row.word_count_min,
      word_count_max: row.word_count_max,
      reading_level: row.reading_level,
      tone: row.tone,
      formality: row.formality,
      cta_style: row.cta_style,
      seo_constraints: row.seo_constraints || {},
      risks: row.risks || {},
      success_metrics: row.success_metrics || {},
      approved_by: row.approved_by,
      approved_at: row.approved_at ? new Date(row.approved_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapGeneratedContent(row: any): GeneratedContent {
    return {
      id: row.id,
      project_id: row.project_id,
      brief_id: row.brief_id,
      title: row.title,
      content_markdown: row.content_markdown,
      content_html: row.content_html,
      meta_title: row.meta_title,
      meta_description: row.meta_description,
      status: row.status,
      version: row.version,
      generated_by: row.generated_by,
      model_used: row.model_used,
      generation_params: row.generation_params || {},
      word_count: row.word_count,
      reading_time_minutes: row.reading_time_minutes,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapQAResult(row: any): ContentQAResult {
    return {
      id: row.id,
      project_id: row.project_id,
      content_id: row.content_id,
      brief_id: row.brief_id,
      qa_status: row.qa_status,
      overall_score: parseFloat(row.overall_score),
      structure: {
        status: row.structure_status,
        score: parseFloat(row.structure_score),
        issues: row.structure_issues || [],
      },
      seo: {
        status: row.seo_status,
        score: parseFloat(row.seo_score),
        issues: row.seo_issues || [],
      },
      intent: {
        status: row.intent_status,
        score: parseFloat(row.intent_score),
        issues: row.intent_issues || [],
      },
      brand: {
        status: row.brand_status,
        score: parseFloat(row.brand_score),
        issues: row.brand_issues || [],
      },
      technical: {
        status: row.technical_status,
        score: parseFloat(row.technical_score),
        issues: row.technical_issues || [],
      },
      all_issues: row.all_issues || [],
      blocking_issues_count: row.blocking_issues_count,
      warning_issues_count: row.warning_issues_count,
      info_issues_count: row.info_issues_count,
      validated_at: new Date(row.validated_at),
      created_at: new Date(row.created_at),
    };
  }

  private mapCMSExport(row: any): CMSExport {
    return {
      id: row.id,
      project_id: row.project_id,
      content_id: row.content_id,
      brief_id: row.brief_id,
      qa_result_id: row.qa_result_id,
      cms_type: row.cms_type,
      cms_config: row.cms_config,
      status: row.status,
      export_package: row.export_package,
      cms_response: row.cms_response,
      cms_content_id: row.cms_content_id,
      cms_url: row.cms_url,
      error_message: row.error_message,
      retry_count: row.retry_count,
      exported_at: row.exported_at ? new Date(row.exported_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

// Factory function
export function createContentRepository(pool: Pool): ContentRepository {
  return new ContentRepository(pool);
}
