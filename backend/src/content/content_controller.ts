/**
 * Content API Controller
 * Sections 13, 14, 15, 16, 17 - REST API endpoints
 * 
 * Section 0.1: ALL DATA FROM DATABASE (populated by crawl)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import {
  ContentRepository,
  ContentBriefGenerator,
  ContentQAValidator,
  CMSExportService,
  ContentNormalizer,
  BriefStatus,
  ContentStatus,
  CMSConfig,
} from './index';

interface ContentControllerDeps {
  pool: Pool;
}

export function registerContentRoutes(fastify: FastifyInstance, deps: ContentControllerDeps) {
  const repository = new ContentRepository(deps.pool);
  const briefGenerator = new ContentBriefGenerator();
  const qaValidator = new ContentQAValidator();
  const cmsExporter = new CMSExportService();
  const normalizer = new ContentNormalizer();

  // ============================================================================
  // CONTENT BRIEFS (Section 13)
  // ============================================================================

  /**
   * Generate a new content brief from keyword data
   */
  fastify.post('/api/content/briefs/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      project_id: string;
      keyword: string;
      search_volume: number;
      difficulty: number;
      intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
      domain: string;
      brand_tone?: string;
      brand_formality?: string;
      forbidden_claims?: string[];
    };

    try {
      // Get existing pages from database (crawled data)
      const existingContent = await repository.getCrawledContentByProject(body.project_id, 100, 0);
      const existingPages = existingContent.map((c) => ({
        url: c.url,
        title: c.normalized_content.content.title,
        word_count: c.normalized_content.metrics.word_count,
        last_crawled: c.crawled_at,
      }));

      // Generate brief
      const brief = briefGenerator.generate(
        {
          keyword: body.keyword,
          search_volume: body.search_volume,
          difficulty: body.difficulty,
          intent: body.intent,
        },
        {
          project_id: body.project_id,
          domain: body.domain,
          brand_tone: body.brand_tone,
          brand_formality: body.brand_formality,
          forbidden_claims: body.forbidden_claims,
        },
        existingPages
      );

      // Save to database
      const savedBrief = await repository.createBrief(brief);

      return reply.code(201).send({
        success: true,
        data: savedBrief,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate brief',
      });
    }
  });

  /**
   * Get briefs for a project
   */
  fastify.get('/api/content/briefs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      project_id: string;
      status?: BriefStatus;
      limit?: string;
      offset?: string;
    };

    try {
      const briefs = await repository.getBriefsByProject(
        query.project_id,
        query.status,
        parseInt(query.limit || '50'),
        parseInt(query.offset || '0')
      );

      return reply.send({
        success: true,
        data: briefs,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch briefs',
      });
    }
  });

  /**
   * Get brief by ID
   */
  fastify.get('/api/content/briefs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    try {
      const brief = await repository.getBriefById(params.id);
      if (!brief) {
        return reply.code(404).send({
          success: false,
          error: 'Brief not found',
        });
      }

      return reply.send({
        success: true,
        data: brief,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch brief',
      });
    }
  });

  /**
   * Update brief status (approve/reject)
   */
  fastify.patch('/api/content/briefs/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { status: BriefStatus; approved_by?: string };

    try {
      const updated = await repository.updateBriefStatus(params.id, body.status, body.approved_by);
      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: 'Brief not found',
        });
      }

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update brief status',
      });
    }
  });

  // ============================================================================
  // GENERATED CONTENT (Section 14)
  // ============================================================================

  /**
   * Save generated content
   */
  fastify.post('/api/content/generated', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      project_id: string;
      brief_id: string;
      title: string;
      content_markdown: string;
      content_html?: string;
      meta_title?: string;
      meta_description?: string;
      model_used?: string;
      generation_params?: Record<string, any>;
    };

    try {
      // Calculate word count
      const wordCount = body.content_markdown
        .replace(/[#*_`\[\]()]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      const content = await repository.saveGeneratedContent({
        project_id: body.project_id,
        brief_id: body.brief_id,
        title: body.title,
        content_markdown: body.content_markdown,
        content_html: body.content_html,
        meta_title: body.meta_title,
        meta_description: body.meta_description,
        status: 'DRAFT',
        version: 1,
        generated_by: 'ai',
        model_used: body.model_used,
        generation_params: body.generation_params,
        word_count: wordCount,
        reading_time_minutes: Math.ceil(wordCount / 200),
      });

      return reply.code(201).send({
        success: true,
        data: content,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save content',
      });
    }
  });

  /**
   * Get content by project
   */
  fastify.get('/api/content/generated', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      project_id: string;
      status?: ContentStatus;
      limit?: string;
      offset?: string;
    };

    try {
      const content = await repository.getContentByProject(
        query.project_id,
        query.status,
        parseInt(query.limit || '50'),
        parseInt(query.offset || '0')
      );

      return reply.send({
        success: true,
        data: content,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch content',
      });
    }
  });

  /**
   * Get content by ID
   */
  fastify.get('/api/content/generated/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };

    try {
      const content = await repository.getGeneratedContentById(params.id);
      if (!content) {
        return reply.code(404).send({
          success: false,
          error: 'Content not found',
        });
      }

      return reply.send({
        success: true,
        data: content,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch content',
      });
    }
  });

  /**
   * Update content status
   */
  fastify.patch('/api/content/generated/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const body = request.body as { status: ContentStatus };

    try {
      const updated = await repository.updateContentStatus(params.id, body.status);
      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: 'Content not found',
        });
      }

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update content status',
      });
    }
  });

  // ============================================================================
  // QA VALIDATION (Section 16)
  // ============================================================================

  /**
   * Run QA validation on content
   */
  fastify.post('/api/content/qa/validate/:contentId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { contentId: string };

    try {
      // Get content
      const content = await repository.getGeneratedContentById(params.contentId);
      if (!content) {
        return reply.code(404).send({
          success: false,
          error: 'Content not found',
        });
      }

      // Get brief
      const brief = await repository.getBriefById(content.brief_id);
      if (!brief) {
        return reply.code(404).send({
          success: false,
          error: 'Brief not found',
        });
      }

      // Run validation
      const qaResult = qaValidator.validate(content, brief);

      // Save result
      const savedResult = await repository.saveQAResult(qaResult);

      return reply.send({
        success: true,
        data: savedResult,
        can_export: qaValidator.canExport(savedResult),
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate content',
      });
    }
  });

  /**
   * Get QA result for content
   */
  fastify.get('/api/content/qa/:contentId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { contentId: string };

    try {
      const qaResult = await repository.getQAResultByContentId(params.contentId);
      if (!qaResult) {
        return reply.code(404).send({
          success: false,
          error: 'QA result not found',
        });
      }

      return reply.send({
        success: true,
        data: qaResult,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch QA result',
      });
    }
  });

  // ============================================================================
  // CMS EXPORT (Section 15)
  // ============================================================================

  /**
   * Export content to CMS
   */
  fastify.post('/api/content/export/:contentId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { contentId: string };
    const body = request.body as { cms_config: CMSConfig };

    try {
      // Get content
      const content = await repository.getGeneratedContentById(params.contentId);
      if (!content) {
        return reply.code(404).send({
          success: false,
          error: 'Content not found',
        });
      }

      // Get brief
      const brief = await repository.getBriefById(content.brief_id);
      if (!brief) {
        return reply.code(404).send({
          success: false,
          error: 'Brief not found',
        });
      }

      // Get QA result
      const qaResult = await repository.getQAResultByContentId(params.contentId);
      if (!qaResult) {
        return reply.code(400).send({
          success: false,
          error: 'Content must be validated before export. Run QA validation first.',
        });
      }

      // Validate gates
      const gateResult = cmsExporter.validateGates(brief, content, qaResult);
      if (!gateResult.can_export) {
        return reply.code(400).send({
          success: false,
          error: 'Export blocked',
          gates: gateResult,
        });
      }

      // Export
      const { export: exportRecord, response } = await cmsExporter.export(
        content,
        brief,
        qaResult,
        body.cms_config
      );

      // Save export record
      if (exportRecord.project_id) {
        await repository.saveCMSExport(exportRecord as any);
      }

      return reply.send({
        success: response.success,
        data: {
          cms_content_id: response.content_id,
          cms_url: response.content_url,
          export_status: exportRecord.status,
        },
        error: response.error,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export content',
      });
    }
  });

  /**
   * Get export history for project
   */
  fastify.get('/api/content/exports', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      project_id: string;
      limit?: string;
      offset?: string;
    };

    try {
      const exports = await repository.getExportsByProject(
        query.project_id,
        parseInt(query.limit || '50'),
        parseInt(query.offset || '0')
      );

      return reply.send({
        success: true,
        data: exports,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch exports',
      });
    }
  });

  // ============================================================================
  // CRAWLED CONTENT (Section 17)
  // ============================================================================

  /**
   * Get crawled content for project
   */
  fastify.get('/api/content/crawled', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      project_id: string;
      limit?: string;
      offset?: string;
    };

    try {
      const content = await repository.getCrawledContentByProject(
        query.project_id,
        parseInt(query.limit || '50'),
        parseInt(query.offset || '0')
      );

      return reply.send({
        success: true,
        data: content,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch crawled content',
      });
    }
  });

  /**
   * Get crawled content by URL
   */
  fastify.get('/api/content/crawled/url', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      project_id: string;
      url: string;
    };

    try {
      const content = await repository.getCrawledContentByUrl(query.project_id, query.url);
      if (!content) {
        return reply.code(404).send({
          success: false,
          error: 'Crawled content not found for this URL',
        });
      }

      return reply.send({
        success: true,
        data: content,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch crawled content',
      });
    }
  });
}
