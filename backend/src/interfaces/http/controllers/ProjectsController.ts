/**
 * Projects Controller
 * API endpoints for project and SEO metrics management
 * 
 * RULE: Controllers are thin - no business logic here
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { PostgresProjectRepository, Project } from '../../../infrastructure/repositories/PostgresProjectRepository';
import { PostgresSEOMetricsRepository } from '../../../infrastructure/repositories/PostgresSEOMetricsRepository';
import {
  CacheKeys,
  buildCacheKey,
  getCached,
  setCached,
  getOrSetCached,
  invalidateProjectCache,
} from '../../../infrastructure/cache/redis';
import { Logger } from '../../../shared/Logger';
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  PROJECT: 300, // 5 minutes
  PROJECT_LIST: 60, // 1 minute
  METRICS: 180, // 3 minutes
  DASHBOARD: 120, // 2 minutes
};

export class ProjectsController {
  private readonly logger: Logger;
  private readonly projectRepo: PostgresProjectRepository;
  private readonly metricsRepo: PostgresSEOMetricsRepository;
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.logger = new Logger('ProjectsController');
    this.pool = pool;
    this.projectRepo = new PostgresProjectRepository(pool);
    this.metricsRepo = new PostgresSEOMetricsRepository(pool);
  }

  /**
   * Register routes
   */
  registerRoutes(app: FastifyInstance): void {
    // Project CRUD
    app.get('/projects', this.listProjects.bind(this));
    app.get('/projects/:id', this.getProject.bind(this));
    app.post('/projects', this.createProject.bind(this));
    app.patch('/projects/:id', this.updateProject.bind(this));
    app.delete('/projects/:id', this.deleteProject.bind(this));

    // Dashboard & Metrics
    app.get('/projects/:id/dashboard', this.getProjectDashboard.bind(this));
    app.get('/projects/:id/traffic', this.getTrafficMetrics.bind(this));
    app.get('/projects/:id/health', this.getTechnicalHealth.bind(this));
    app.get('/projects/:id/backlinks', this.getBacklinkMetrics.bind(this));
    app.get('/projects/:id/kpi', this.getKPISnapshots.bind(this));
    app.get('/projects/:id/forecasts', this.getForecasts.bind(this));
    app.get('/projects/:id/recommendations', this.getRecommendations.bind(this));
    app.patch('/projects/:id/recommendations/:recId', this.updateRecommendationStatus.bind(this));
    app.post('/projects/:id/recommendations', this.createRecommendations.bind(this)); // AI Agent endpoint

    // URL Inventory - Per § 11
    app.get('/projects/:id/urls', this.getUrlInventory.bind(this));
    app.get('/projects/:id/urls/coverage', this.getCrawlCoverage.bind(this));
    app.get('/projects/:id/urls/stats', this.getUrlStats.bind(this));

    // GA4 Integration
    app.get('/projects/:id/ga4/config', this.getGA4Config.bind(this));
    app.put('/projects/:id/ga4/config', this.updateGA4Config.bind(this));
    app.post('/projects/:id/ga4/sync', this.triggerGA4Sync.bind(this));
    app.get('/projects/:id/ga4/status', this.getGA4SyncStatus.bind(this));

    // GSC (Google Search Console) Integration
    app.get('/projects/:id/gsc/config', this.getGSCConfig.bind(this));
    app.put('/projects/:id/gsc/config', this.updateGSCConfig.bind(this));
    app.post('/projects/:id/gsc/sync', this.triggerGSCSync.bind(this));
    app.get('/projects/:id/gsc/status', this.getGSCSyncStatus.bind(this));
    app.get('/projects/:id/gsc/analytics', this.getGSCAnalytics.bind(this));
    
    // AI Configuration
    app.get('/projects/:id/ai/config', this.getAIConfig.bind(this));
    app.put('/projects/:id/ai/config', this.updateAIConfig.bind(this));
    app.post('/projects/:id/ai/test', this.testAIConnection.bind(this));
    
    // Keyword SEO Analysis - Enhanced recommendations
    app.get('/projects/:id/keywords/:keyword/analysis', this.getKeywordSEOAnalysis.bind(this));
    
    // Content Generation API
    app.post('/projects/:id/content/generate', this.generateContent.bind(this));
  }

  // ===========================================================================
  // PROJECT CRUD
  // ===========================================================================

  /**
   * GET /projects
   * List all active projects
   */
  async listProjects(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const cacheKey = CacheKeys.PROJECT_LIST;
      
      const projects = await getOrSetCached(
        cacheKey,
        () => this.projectRepo.findAllActive(),
        { ttl: CACHE_TTL.PROJECT_LIST }
      );

      reply.send({
        success: true,
        data: {
          projects: projects.map(p => this.serializeProject(p)),
          count: projects.length,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id
   * Get project by ID
   */
  async getProject(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const cacheKey = buildCacheKey(CacheKeys.PROJECT, id);

      const project = await getOrSetCached(
        cacheKey,
        () => this.projectRepo.findById(id),
        { ttl: CACHE_TTL.PROJECT }
      );

      if (!project) {
        throw new NotFoundError('Project', id);
      }

      reply.send({
        success: true,
        data: this.serializeProject(project),
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /projects
   * Create a new project
   */
  async createProject(
    request: FastifyRequest<{ 
      Body: { 
        name: string; 
        domain: string; 
        language?: string;
        settings?: any;
      } 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { name, domain, language, settings } = request.body;

      if (!name || !domain) {
        throw new ValidationError('Name and domain are required');
      }

      // Use a mock owner ID for now (will be replaced with auth)
      const ownerId = '11111111-1111-1111-1111-111111111111';

      const project = await this.projectRepo.create({
        name,
        domain,
        language,
        ownerId,
        settings,
      });

      // Invalidate cache
      await invalidateProjectCache(project.id);

      reply.status(201).send({
        success: true,
        data: this.serializeProject(project),
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * PATCH /projects/:id
   * Update a project
   */
  async updateProject(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: { 
        name?: string; 
        language?: string;
        status?: 'active' | 'paused' | 'archived';
        settings?: any;
      } 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const project = await this.projectRepo.update(id, request.body);

      if (!project) {
        throw new NotFoundError('Project', id);
      }

      // Invalidate cache
      await invalidateProjectCache(id);

      reply.send({
        success: true,
        data: this.serializeProject(project),
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * DELETE /projects/:id
   * Archive a project
   */
  async deleteProject(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const deleted = await this.projectRepo.delete(id);

      if (!deleted) {
        throw new NotFoundError('Project', id);
      }

      // Invalidate cache
      await invalidateProjectCache(id);

      reply.send({
        success: true,
        message: 'Project archived successfully',
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  // ===========================================================================
  // DASHBOARD & METRICS
  // ===========================================================================

  /**
   * GET /projects/:id/dashboard
   * Get comprehensive dashboard data for a project
   */
  async getProjectDashboard(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      
      // Verify project exists
      const project = await this.projectRepo.findById(id);
      if (!project) {
        throw new NotFoundError('Project', id);
      }

      const cacheKey = buildCacheKey(CacheKeys.DASHBOARD_SUMMARY, id);

      const dashboard = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getDashboardSummary(id),
        { ttl: CACHE_TTL.DASHBOARD }
      );

      reply.send({
        success: true,
        data: {
          project: this.serializeProject(project),
          ...dashboard,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/traffic
   * Get traffic metrics for a project
   */
  async getTrafficMetrics(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { days?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const days = parseInt(request.query.days || '30');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const cacheKey = buildCacheKey(CacheKeys.SEO_TRAFFIC, id, days);

      const metrics = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getTrafficMetrics(id, { startDate, endDate }),
        { ttl: CACHE_TTL.METRICS }
      );

      reply.send({
        success: true,
        data: {
          metrics,
          period: { days, startDate, endDate },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/keywords
   * Get keyword rankings for a project
   */
  async getKeywordRankings(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { tracked?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const tracked = request.query.tracked === 'true' ? true : undefined;
      const limit = request.query.limit ? parseInt(request.query.limit) : undefined;

      const cacheKey = buildCacheKey(CacheKeys.SEO_KEYWORDS, id, tracked?.toString() || 'all', limit || 'all');

      const keywords = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getKeywordRankings(id, { tracked, limit }),
        { ttl: CACHE_TTL.METRICS }
      );

      const stats = await this.metricsRepo.getKeywordStats(id);

      reply.send({
        success: true,
        data: {
          keywords,
          stats,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/health
   * Get technical health metrics for a project
   */
  async getTechnicalHealth(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { days?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const days = parseInt(request.query.days || '7');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const cacheKey = buildCacheKey(CacheKeys.SEO_HEALTH, id, days);

      const health = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getTechnicalHealth(id, { startDate, endDate }),
        { ttl: CACHE_TTL.METRICS }
      );

      reply.send({
        success: true,
        data: {
          health,
          period: { days, startDate, endDate },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/backlinks
   * Get backlink metrics for a project
   */
  async getBacklinkMetrics(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { days?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const days = parseInt(request.query.days || '30');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const cacheKey = buildCacheKey(CacheKeys.SEO_BACKLINKS, id, days);

      const backlinks = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getBacklinkMetrics(id, { startDate, endDate }),
        { ttl: CACHE_TTL.METRICS }
      );

      reply.send({
        success: true,
        data: {
          backlinks,
          period: { days, startDate, endDate },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/kpi
   * Get KPI snapshots for a project
   */
  async getKPISnapshots(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { days?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const days = parseInt(request.query.days || '30');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const cacheKey = buildCacheKey(CacheKeys.SEO_KPI, id, days);

      const kpi = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getKPISnapshots(id, { startDate, endDate }),
        { ttl: CACHE_TTL.METRICS }
      );

      reply.send({
        success: true,
        data: {
          kpi,
          period: { days, startDate, endDate },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/forecasts
   * Get forecasts for a project
   */
  async getForecasts(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { metric?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { metric } = request.query;

      const cacheKey = buildCacheKey(CacheKeys.SEO_FORECASTS, id, metric || 'all');

      const forecasts = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getForecasts(id, metric),
        { ttl: CACHE_TTL.METRICS }
      );

      reply.send({
        success: true,
        data: { forecasts },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/recommendations
   * Get SEO recommendations for a project
   */
  async getRecommendations(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { status?: string; priority?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { status, priority, limit } = request.query;

      const cacheKey = buildCacheKey(
        CacheKeys.SEO_RECOMMENDATIONS, 
        id, 
        status || 'all',
        priority || 'all',
        limit || 'all'
      );

      const recommendations = await getOrSetCached(
        cacheKey,
        () => this.metricsRepo.getRecommendations(id, {
          status,
          priority,
          limit: limit ? parseInt(limit) : undefined,
        }),
        { ttl: CACHE_TTL.METRICS }
      );

      reply.send({
        success: true,
        data: { recommendations },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /projects/:id/recommendations
   * Create recommendations from AI agents
   * 
   * Body: {
   *   source: 'technical_seo_agent' | 'keyword_intelligence' | 'monitoring_agent' | etc.
   *   recommendations: Array<{
   *     category: 'technical' | 'content' | 'keywords' | 'backlinks' | 'ux'
   *     title: string
   *     description: string
   *     impact: 'high' | 'medium' | 'low'
   *     effort: 'high' | 'medium' | 'low'
   *     priority?: 'critical' | 'high' | 'medium' | 'low'
   *     autoExecutable?: boolean
   *     actionData?: object
   *     estimatedTrafficGain?: number
   *     affectedUrls?: string[]
   *     relatedKeywords?: string[]
   *   }>
   *   options?: {
   *     refreshSource?: boolean  // Delete old recommendations from this source first
   *     skipDuplicates?: boolean
   *   }
   * }
   */
  async createRecommendations(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: {
        source: string;
        recommendations: Array<{
          category: string;
          title: string;
          description: string;
          impact: string;
          effort: string;
          priority?: string;
          autoExecutable?: boolean;
          actionData?: Record<string, any>;
          estimatedTrafficGain?: number;
          affectedUrls?: string[];
          relatedKeywords?: string[];
        }>;
        options?: {
          refreshSource?: boolean;
          skipDuplicates?: boolean;
        };
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;
      const { source, recommendations, options } = request.body;

      // Validate source
      const validSources = [
        'technical_seo_agent', 'keyword_intelligence', 'monitoring_agent',
        'portfolio_optimization', 'content_engine', 'cwv_worker', 
        'crawler_worker', 'manual'
      ];
      if (!validSources.includes(source)) {
        throw new ValidationError(`Invalid source. Must be one of: ${validSources.join(', ')}`);
      }

      // Validate recommendations
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new ValidationError('recommendations must be a non-empty array');
      }

      // Validate each recommendation
      const validCategories = ['technical', 'content', 'keywords', 'backlinks', 'ux'];
      const validImpacts = ['high', 'medium', 'low'];
      const validEfforts = ['high', 'medium', 'low'];
      const validPriorities = ['critical', 'high', 'medium', 'low'];

      for (const rec of recommendations) {
        if (!rec.title || !rec.description) {
          throw new ValidationError('Each recommendation must have title and description');
        }
        if (!validCategories.includes(rec.category)) {
          throw new ValidationError(`Invalid category: ${rec.category}`);
        }
        if (!validImpacts.includes(rec.impact)) {
          throw new ValidationError(`Invalid impact: ${rec.impact}`);
        }
        if (!validEfforts.includes(rec.effort)) {
          throw new ValidationError(`Invalid effort: ${rec.effort}`);
        }
        if (rec.priority && !validPriorities.includes(rec.priority)) {
          throw new ValidationError(`Invalid priority: ${rec.priority}`);
        }
      }

      // If refreshSource is true, delete old recommendations from this source first
      let deletedCount = 0;
      if (options?.refreshSource) {
        deletedCount = await this.metricsRepo.deleteRecommendations(projectId, { source });
      }

      // Helper function to calculate priority based on impact/effort matrix
      const calculatePriority = (impact: string, effort: string): string => {
        const matrix: Record<string, Record<string, string>> = {
          high: { low: 'critical', medium: 'high', high: 'high' },
          medium: { low: 'high', medium: 'medium', high: 'medium' },
          low: { low: 'medium', medium: 'low', high: 'low' },
        };
        return matrix[impact]?.[effort] || 'medium';
      };

      // Prepare recommendations for creation
      const toCreate = recommendations.map(rec => ({
        projectId,
        category: rec.category as any,
        priority: (rec.priority || calculatePriority(rec.impact, rec.effort)) as any,
        title: rec.title,
        description: rec.description,
        impact: rec.impact as any,
        effort: rec.effort as any,
        status: 'pending' as const,
        autoExecutable: rec.autoExecutable || false,
        actionData: {
          ...rec.actionData,
          source,
          estimatedTrafficGain: rec.estimatedTrafficGain,
          affectedUrls: rec.affectedUrls,
          relatedKeywords: rec.relatedKeywords,
          generatedAt: new Date().toISOString(),
        },
      }));

      // Create recommendations (with deduplication if skipDuplicates is true)
      let created;
      let skipped = 0;

      if (options?.skipDuplicates !== false) {
        // Get existing titles for deduplication
        const existing = await this.metricsRepo.getRecommendations(projectId, { status: 'pending' });
        const existingTitles = new Set(existing.map(r => r.title.toLowerCase()));
        
        const uniqueToCreate = toCreate.filter(rec => {
          if (existingTitles.has(rec.title.toLowerCase())) {
            skipped++;
            return false;
          }
          existingTitles.add(rec.title.toLowerCase());
          return true;
        });

        created = await this.metricsRepo.createRecommendations(uniqueToCreate);
      } else {
        created = await this.metricsRepo.createRecommendations(toCreate);
      }

      // Invalidate cache
      await invalidateProjectCache(projectId);

      this.logger.info('Recommendations created via API', {
        projectId,
        source,
        created: created.length,
        skipped,
        deletedPrevious: deletedCount,
      });

      reply.status(201).send({
        success: true,
        data: {
          created: created.length,
          skipped,
          deletedPrevious: deletedCount,
          recommendations: created,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * PATCH /projects/:id/recommendations/:recId
   * Update recommendation status
   */
  async updateRecommendationStatus(
    request: FastifyRequest<{ 
      Params: { id: string; recId: string };
      Body: { status: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id, recId } = request.params;
      const { status } = request.body;

      if (!['pending', 'in_progress', 'completed', 'dismissed'].includes(status)) {
        throw new ValidationError('Invalid status');
      }

      const updated = await this.metricsRepo.updateRecommendationStatus(recId, status);

      if (!updated) {
        throw new NotFoundError('Recommendation', recId);
      }

      // Invalidate recommendations cache
      await invalidateProjectCache(id);

      reply.send({
        success: true,
        message: 'Recommendation status updated',
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private serializeProject(project: Project) {
    return {
      id: project.id,
      name: project.name,
      domain: project.domain,
      language: project.language,
      status: project.status,
      ownerId: project.ownerId,
      settings: project.settings,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  // ===========================================================================
  // URL INVENTORY - Per § 11
  // ===========================================================================

  /**
   * GET /projects/:id/urls
   * Get URL inventory with pagination and filtering
   */
  async getUrlInventory(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: {
        page?: string;
        pageSize?: string;
        state?: string;
        source?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;
      const {
        page = '1',
        pageSize = '50',
        state,
        source,
        search,
        sortBy = 'first_seen_at',
        sortOrder = 'desc',
      } = request.query;

      const pageNum = parseInt(page);
      const limit = Math.min(parseInt(pageSize), 100);
      const offset = (pageNum - 1) * limit;

      // Build WHERE clause
      const conditions: string[] = ['ui.project_id = $1'];
      const params: any[] = [projectId];
      let paramIndex = 2;

      if (state && state !== 'all') {
        conditions.push(`ui.state = $${paramIndex++}`);
        params.push(state.toUpperCase());
      }
      if (source && source !== 'all') {
        conditions.push(`ui.discovered_from = $${paramIndex++}`);
        params.push(source);
      }
      if (search) {
        conditions.push(`ui.url ILIKE $${paramIndex++}`);
        params.push(`%${search}%`);
      }

      const whereClause = conditions.join(' AND ');
      const orderColumn = sortBy === 'url' ? 'ui.url' : sortBy === 'depth' ? 'ui.depth' : 'ui.first_seen_at';
      const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Get total count
      const countResult = await this.pool.query(
        `SELECT COUNT(*) as total FROM url_inventory ui WHERE ${whereClause}`,
        params
      );
      const totalItems = parseInt(countResult.rows[0].total);

      // Get items with content join
      const itemsResult = await this.pool.query(
        `SELECT 
          ui.id,
          ui.url as normalized_url,
          ui.state,
          ui.depth,
          ui.discovered_from as source,
          ui.first_seen_at as discovered_at,
          ui.last_crawled_at as updated_at,
          ui.http_status,
          pcn.title,
          pcn.meta_description
        FROM url_inventory ui
        LEFT JOIN page_content_normalized pcn ON ui.url = pcn.url AND ui.project_id = pcn.project_id
        WHERE ${whereClause}
        ORDER BY ${orderColumn} ${orderDir}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      );

      // Get stats
      const statsResult = await this.pool.query(
        `SELECT 
          COUNT(*) as total_discovered,
          COUNT(*) FILTER (WHERE state = 'CRAWLED') as total_crawled,
          COUNT(*) FILTER (WHERE state = 'FAILED') as total_failed,
          COUNT(*) FILTER (WHERE state = 'SKIPPED') as total_skipped,
          COUNT(*) FILTER (WHERE state = 'DISCOVERED') as total_pending
        FROM url_inventory WHERE project_id = $1`,
        [projectId]
      );

      const stats = statsResult.rows[0];
      const items = itemsResult.rows.map(row => ({
        id: row.id,
        normalizedUrl: row.normalized_url,
        state: row.state,
        depth: row.depth || 0,
        source: row.source || 'sitemap',
        discoveredAt: row.discovered_at?.toISOString() || new Date().toISOString(),
        updatedAt: row.updated_at?.toISOString() || row.discovered_at?.toISOString() || new Date().toISOString(),
        httpStatus: row.http_status,
        title: row.title,
        metaDescription: row.meta_description,
      }));

      reply.send({
        items,
        pagination: {
          page: pageNum,
          pageSize: limit,
          totalPages: Math.ceil(totalItems / limit),
          totalItems,
        },
        stats: {
          totalDiscovered: parseInt(stats.total_discovered) || 0,
          totalCrawled: parseInt(stats.total_crawled) || 0,
          totalFailed: parseInt(stats.total_failed) || 0,
          totalSkipped: parseInt(stats.total_skipped) || 0,
          totalPending: parseInt(stats.total_pending) || 0,
          byState: {
            DISCOVERED: parseInt(stats.total_pending) || 0,
            CRAWLED: parseInt(stats.total_crawled) || 0,
            FAILED: parseInt(stats.total_failed) || 0,
            SKIPPED: parseInt(stats.total_skipped) || 0,
          },
          bySource: {},
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/urls/coverage
   * Get crawl coverage summary
   */
  async getCrawlCoverage(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;

      const result = await this.pool.query(
        `SELECT 
          COUNT(*) as total_discovered,
          COUNT(*) FILTER (WHERE state = 'CRAWLED') as total_crawled,
          COUNT(*) FILTER (WHERE state = 'FAILED') as total_failed,
          COUNT(*) FILTER (WHERE state = 'SKIPPED') as total_skipped,
          COUNT(*) FILTER (WHERE state = 'DISCOVERED') as total_pending
        FROM url_inventory WHERE project_id = $1`,
        [projectId]
      );

      const stats = result.rows[0];
      const totalDiscovered = parseInt(stats.total_discovered) || 0;
      const totalCrawled = parseInt(stats.total_crawled) || 0;

      reply.send({
        totalDiscovered,
        totalCrawled,
        totalFailed: parseInt(stats.total_failed) || 0,
        totalSkipped: parseInt(stats.total_skipped) || 0,
        totalPending: parseInt(stats.total_pending) || 0,
        coveragePercent: totalDiscovered > 0 ? Math.round((totalCrawled / totalDiscovered) * 100) : 0,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/urls/stats
   * Get URL inventory statistics
   */
  async getUrlStats(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;

      const result = await this.pool.query(
        `SELECT 
          COUNT(*) as total_discovered,
          COUNT(*) FILTER (WHERE state = 'CRAWLED') as total_crawled,
          COUNT(*) FILTER (WHERE state = 'FAILED') as total_failed,
          COUNT(*) FILTER (WHERE state = 'SKIPPED') as total_skipped,
          COUNT(*) FILTER (WHERE state = 'DISCOVERED') as total_pending
        FROM url_inventory WHERE project_id = $1`,
        [projectId]
      );

      const stats = result.rows[0];

      reply.send({
        totalDiscovered: parseInt(stats.total_discovered) || 0,
        totalCrawled: parseInt(stats.total_crawled) || 0,
        totalFailed: parseInt(stats.total_failed) || 0,
        totalSkipped: parseInt(stats.total_skipped) || 0,
        totalPending: parseInt(stats.total_pending) || 0,
        byState: {
          DISCOVERED: parseInt(stats.total_pending) || 0,
          CRAWLED: parseInt(stats.total_crawled) || 0,
          FAILED: parseInt(stats.total_failed) || 0,
          SKIPPED: parseInt(stats.total_skipped) || 0,
        },
        bySource: {},
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  private handleError(error: unknown, reply: FastifyReply): void {
    if (error instanceof ValidationError) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details,
        },
      });
    } else if (error instanceof NotFoundError) {
      reply.status(404).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    } else if (error instanceof AppError) {
      reply.status(500).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    } else {
      this.logger.error('Unexpected error', { error });
      reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    }
  }

  // ===========================================================================
  // GA4 INTEGRATION
  // ===========================================================================

  /**
   * GET /projects/:id/ga4/config
   * Get GA4 configuration for a project (without sensitive credentials)
   */
  async getGA4Config(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;

      const result = await this.pool.query(`
        SELECT 
          ga4_property_id,
          ga4_credentials IS NOT NULL as has_credentials,
          CASE 
            WHEN ga4_credentials IS NOT NULL 
            THEN ga4_credentials->>'client_email' 
            ELSE NULL 
          END as service_account_email,
          ga4_last_sync_at,
          ga4_sync_enabled
        FROM projects
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const row = result.rows[0];
      reply.send({
        success: true,
        data: {
          propertyId: row.ga4_property_id,
          hasCredentials: row.has_credentials,
          serviceAccountEmail: row.service_account_email,
          lastSyncAt: row.ga4_last_sync_at,
          syncEnabled: row.ga4_sync_enabled,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * PUT /projects/:id/ga4/config
   * Update GA4 configuration for a project
   */
  async updateGA4Config(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: { 
        propertyId?: string;
        serviceAccountKey?: {
          client_email: string;
          private_key: string;
        };
        syncEnabled?: boolean;
      } 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { propertyId, serviceAccountKey, syncEnabled } = request.body;

      // Build dynamic update query
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (propertyId !== undefined) {
        updates.push(`ga4_property_id = $${paramIndex++}`);
        values.push(propertyId);
      }

      if (serviceAccountKey !== undefined) {
        if (!serviceAccountKey.client_email || !serviceAccountKey.private_key) {
          throw new ValidationError('Service account key must include client_email and private_key');
        }
        updates.push(`ga4_credentials = $${paramIndex++}`);
        values.push(JSON.stringify(serviceAccountKey));
      }

      if (syncEnabled !== undefined) {
        updates.push(`ga4_sync_enabled = $${paramIndex++}`);
        values.push(syncEnabled);
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.pool.query(`
        UPDATE projects 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING 
          ga4_property_id,
          ga4_credentials IS NOT NULL as has_credentials,
          CASE 
            WHEN ga4_credentials IS NOT NULL 
            THEN ga4_credentials->>'client_email' 
            ELSE NULL 
          END as service_account_email,
          ga4_last_sync_at,
          ga4_sync_enabled
      `, values);

      if (result.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const row = result.rows[0];
      reply.send({
        success: true,
        data: {
          propertyId: row.ga4_property_id,
          hasCredentials: row.has_credentials,
          serviceAccountEmail: row.service_account_email,
          lastSyncAt: row.ga4_last_sync_at,
          syncEnabled: row.ga4_sync_enabled,
        },
        message: 'GA4 configuration updated successfully',
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /projects/:id/ga4/sync
   * Trigger GA4 data sync for a project
   */
  async triggerGA4Sync(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: { days?: number } 
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { days = 30 } = request.body || {};

      // Get project GA4 config
      const configResult = await this.pool.query(`
        SELECT 
          ga4_property_id,
          ga4_credentials
        FROM projects
        WHERE id = $1
      `, [id]);

      if (configResult.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const config = configResult.rows[0];

      if (!config.ga4_property_id) {
        throw new ValidationError('GA4 Property ID not configured for this project');
      }

      if (!config.ga4_credentials) {
        throw new ValidationError('GA4 credentials not configured for this project');
      }

      // Run GA4 sync using child process
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const workerPath = `${process.cwd()}/../workers/ga4_worker`;
      const command = `cd "${workerPath}" && npm run sync-project -- --project-id=${id} --days=${days}`;

      this.logger.info('Triggering GA4 sync', { projectId: id, days, command });

      // Run sync in background and return immediately
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('GA4 sync failed', { projectId: id, error: error.message, stderr });
        } else {
          this.logger.info('GA4 sync completed', { projectId: id, stdout });
        }
      });

      // Update sync timestamp immediately (optimistic)
      await this.pool.query(`
        UPDATE projects 
        SET updated_at = NOW()
        WHERE id = $1
      `, [id]);

      reply.send({
        success: true,
        data: {
          status: 'syncing',
          projectId: id,
          days,
        },
        message: `GA4 sync started for ${days} days. Check status for progress.`,
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/ga4/status
   * Get GA4 sync status for a project
   */
  async getGA4SyncStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;

      // Get project GA4 config
      const configResult = await this.pool.query(`
        SELECT 
          ga4_property_id,
          ga4_credentials IS NOT NULL as has_credentials,
          ga4_last_sync_at,
          ga4_sync_enabled
        FROM projects
        WHERE id = $1
      `, [id]);

      if (configResult.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const config = configResult.rows[0];

      // Get sync stats
      const statsResult = await this.pool.query(`
        SELECT 
          MIN(date) as earliest_date,
          MAX(date) as latest_date,
          COUNT(DISTINCT date) as total_days,
          SUM(organic_traffic) as total_organic,
          SUM(total_traffic) as total_traffic
        FROM seo_traffic_metrics
        WHERE project_id = $1
      `, [id]);

      const stats = statsResult.rows[0];

      reply.send({
        success: true,
        data: {
          configured: !!config.ga4_property_id && config.has_credentials,
          propertyId: config.ga4_property_id,
          syncEnabled: config.ga4_sync_enabled,
          lastSyncAt: config.ga4_last_sync_at,
          dataRange: {
            from: stats.earliest_date,
            to: stats.latest_date,
            totalDays: parseInt(stats.total_days) || 0,
          },
          totals: {
            organicTraffic: parseInt(stats.total_organic) || 0,
            totalTraffic: parseInt(stats.total_traffic) || 0,
          },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  // ===========================================================================
  // GSC (GOOGLE SEARCH CONSOLE) INTEGRATION
  // ===========================================================================

  /**
   * GET /projects/:id/gsc/config
   * Get GSC configuration for a project
   */
  async getGSCConfig(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;

      const result = await this.pool.query(`
        SELECT 
          gsc_property_url,
          gsc_credentials IS NOT NULL as has_credentials,
          CASE WHEN gsc_credentials IS NOT NULL 
               THEN gsc_credentials->>'client_email' 
               ELSE NULL END as service_account_email,
          gsc_last_sync_at,
          gsc_sync_enabled
        FROM projects
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const config = result.rows[0];

      reply.send({
        success: true,
        data: {
          propertyUrl: config.gsc_property_url,
          hasCredentials: config.has_credentials,
          serviceAccountEmail: config.service_account_email,
          lastSyncAt: config.gsc_last_sync_at,
          syncEnabled: config.gsc_sync_enabled,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * PUT /projects/:id/gsc/config
   * Update GSC configuration
   */
  async updateGSCConfig(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        propertyUrl?: string;
        serviceAccountKey?: object;
        syncEnabled?: boolean;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { propertyUrl, serviceAccountKey, syncEnabled } = request.body;

      // Verify project exists
      const project = await this.projectRepo.findById(id);
      if (!project) {
        throw new NotFoundError('Project', id);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: (string | boolean | object)[] = [];
      let paramIndex = 1;

      if (propertyUrl !== undefined) {
        updates.push(`gsc_property_url = $${paramIndex++}`);
        values.push(propertyUrl);
      }

      if (serviceAccountKey !== undefined) {
        updates.push(`gsc_credentials = $${paramIndex++}`);
        values.push(JSON.stringify(serviceAccountKey));
      }

      if (syncEnabled !== undefined) {
        updates.push(`gsc_sync_enabled = $${paramIndex++}`);
        values.push(syncEnabled);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        await this.pool.query(`
          UPDATE projects
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `, values);
      }

      // Invalidate cache
      await invalidateProjectCache(id);

      reply.send({
        success: true,
        message: 'GSC configuration updated',
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /projects/:id/gsc/sync
   * Trigger GSC data sync
   */
  async triggerGSCSync(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { days?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { days = 30 } = request.body || {};

      // Verify project has GSC configured
      const result = await this.pool.query(`
        SELECT gsc_property_url, gsc_credentials
        FROM projects
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const config = result.rows[0];
      if (!config.gsc_property_url || !config.gsc_credentials) {
        throw new ValidationError('GSC not configured for this project');
      }

      // TODO: Trigger actual GSC sync worker
      // For now, return success - the worker will be triggered separately
      this.logger.info(`GSC sync triggered for project ${id} with ${days} days`);

      reply.send({
        success: true,
        message: `GSC sync initiated for last ${days} days`,
        data: {
          projectId: id,
          days,
          status: 'initiated',
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/gsc/status
   * Get GSC sync status and data summary
   */
  async getGSCSyncStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;

      // Get config
      const configResult = await this.pool.query(`
        SELECT 
          gsc_property_url,
          gsc_credentials IS NOT NULL as has_credentials,
          gsc_last_sync_at,
          gsc_sync_enabled
        FROM projects
        WHERE id = $1
      `, [id]);

      if (configResult.rows.length === 0) {
        throw new NotFoundError('Project', id);
      }

      const config = configResult.rows[0];

      // Get sync stats
      const statsResult = await this.pool.query(`
        SELECT 
          MIN(date) as earliest_date,
          MAX(date) as latest_date,
          COUNT(DISTINCT date) as total_days,
          SUM(clicks) as total_clicks,
          SUM(impressions) as total_impressions,
          AVG(ctr) as avg_ctr,
          AVG(position) as avg_position,
          COUNT(DISTINCT query) as unique_queries,
          COUNT(DISTINCT page) as unique_pages
        FROM gsc_search_analytics
        WHERE project_id = $1
      `, [id]);

      const stats = statsResult.rows[0];

      // Get top queries
      const topQueriesResult = await this.pool.query(`
        SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(position) as position
        FROM gsc_search_analytics
        WHERE project_id = $1 AND query IS NOT NULL
        GROUP BY query
        ORDER BY clicks DESC
        LIMIT 10
      `, [id]);

      reply.send({
        success: true,
        data: {
          configured: !!config.gsc_property_url && config.has_credentials,
          propertyUrl: config.gsc_property_url,
          syncEnabled: config.gsc_sync_enabled,
          lastSyncAt: config.gsc_last_sync_at,
          dataRange: {
            from: stats.earliest_date,
            to: stats.latest_date,
            totalDays: parseInt(stats.total_days) || 0,
          },
          totals: {
            clicks: parseInt(stats.total_clicks) || 0,
            impressions: parseInt(stats.total_impressions) || 0,
            avgCtr: parseFloat(stats.avg_ctr) || 0,
            avgPosition: parseFloat(stats.avg_position) || 0,
            uniqueQueries: parseInt(stats.unique_queries) || 0,
            uniquePages: parseInt(stats.unique_pages) || 0,
          },
          topQueries: topQueriesResult.rows.map(q => ({
            query: q.query,
            clicks: parseInt(q.clicks),
            impressions: parseInt(q.impressions),
            position: parseFloat(q.position).toFixed(1),
          })),
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/gsc/analytics
   * Get GSC search analytics data with filters
   */
  async getGSCAnalytics(
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: {
        startDate?: string;
        endDate?: string;
        dimension?: 'query' | 'page' | 'country' | 'device' | 'date';
        limit?: number;
        offset?: number;
        sortBy?: 'clicks' | 'impressions' | 'ctr' | 'position';
        sortOrder?: 'asc' | 'desc';
        search?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { 
        startDate, 
        endDate, 
        dimension = 'query',
        limit = 100,
        offset = 0,
        sortBy = 'clicks',
        sortOrder = 'desc',
        search,
      } = request.query;

      // Validate sortBy
      const validSortFields = ['clicks', 'impressions', 'ctr', 'position'];
      const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'clicks';
      const actualSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Build date filter
      let dateFilter = '';
      const params: (string | number)[] = [id];
      let paramIndex = 2;

      if (startDate) {
        dateFilter += ` AND date >= $${paramIndex++}`;
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ` AND date <= $${paramIndex++}`;
        params.push(endDate);
      }
      
      // Add search filter
      let searchFilter = '';
      if (search && (dimension === 'query' || dimension === 'page')) {
        searchFilter = ` AND ${dimension} ILIKE $${paramIndex++}`;
        params.push(`%${search}%`);
      }

      // Get aggregated data by dimension
      const query = `
        SELECT 
          ${dimension},
          SUM(clicks) as clicks,
          SUM(impressions) as impressions,
          AVG(ctr) as ctr,
          AVG(position) as position
        FROM gsc_search_analytics
        WHERE project_id = $1 AND ${dimension} IS NOT NULL ${dateFilter} ${searchFilter}
        GROUP BY ${dimension}
        ORDER BY ${actualSortBy} ${actualSortOrder}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      const countParams = params.slice(0, -2);
      const countQuery = `
        SELECT COUNT(DISTINCT ${dimension}) as total
        FROM gsc_search_analytics
        WHERE project_id = $1 AND ${dimension} IS NOT NULL ${dateFilter} ${searchFilter}
      `;
      const countResult = await this.pool.query(countQuery, countParams);

      reply.send({
        success: true,
        data: {
          dimension,
          items: result.rows.map(row => ({
            [dimension]: row[dimension],
            clicks: parseInt(row.clicks),
            impressions: parseInt(row.impressions),
            ctr: parseFloat(row.ctr),
            position: parseFloat(row.position),
          })),
          pagination: {
            total: parseInt(countResult.rows[0].total) || 0,
            limit,
            offset,
          },
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * GET /projects/:id/keywords/:keyword/analysis
   * Get comprehensive SEO analysis for a specific keyword
   * Combines: GSC data + Crawled pages + CWV results + SERP competitors
   */
  async getKeywordSEOAnalysis(
    request: FastifyRequest<{
      Params: { id: string; keyword: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id, keyword } = request.params;
      const decodedKeyword = decodeURIComponent(keyword);

      // 1. Get GSC data for this keyword
      const gscQuery = `
        SELECT 
          query,
          SUM(clicks) as clicks,
          SUM(impressions) as impressions,
          AVG(ctr) as ctr,
          AVG(position) as position,
          array_agg(DISTINCT page) as ranking_pages
        FROM gsc_search_analytics
        WHERE project_id = $1 AND query = $2
        GROUP BY query
      `;
      const gscResult = await this.pool.query(gscQuery, [id, decodedKeyword]);
      const gscData = gscResult.rows[0] || null;

      // 2. Get related keywords (similar queries)
      const relatedQuery = `
        SELECT 
          query,
          SUM(clicks) as clicks,
          SUM(impressions) as impressions,
          AVG(position) as position
        FROM gsc_search_analytics
        WHERE project_id = $1 
          AND query != $2
          AND (
            query ILIKE $3 
            OR query ILIKE $4
            OR similarity(query, $2) > 0.3
          )
        GROUP BY query
        ORDER BY impressions DESC
        LIMIT 10
      `;
      // Create search patterns from keyword words
      const keywordWords = decodedKeyword.split(' ').filter(w => w.length > 2);
      const searchPattern1 = `%${keywordWords[0] || decodedKeyword}%`;
      const searchPattern2 = keywordWords.length > 1 ? `%${keywordWords[1]}%` : `%${decodedKeyword}%`;
      
      let relatedKeywords: any[] = [];
      try {
        const relatedResult = await this.pool.query(relatedQuery, [id, decodedKeyword, searchPattern1, searchPattern2]);
        relatedKeywords = relatedResult.rows;
      } catch {
        // Similarity function might not be available, fallback to LIKE only
        const fallbackQuery = `
          SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(position) as position
          FROM gsc_search_analytics
          WHERE project_id = $1 AND query != $2 AND (query ILIKE $3 OR query ILIKE $4)
          GROUP BY query ORDER BY impressions DESC LIMIT 10
        `;
        const fallbackResult = await this.pool.query(fallbackQuery, [id, decodedKeyword, searchPattern1, searchPattern2]);
        relatedKeywords = fallbackResult.rows;
      }

      // 3. Get crawled page content that might be relevant
      const crawledPagesQuery = `
        SELECT 
          url,
          title,
          meta_description,
          headings,
          content_text,
          internal_links,
          external_links,
          http_status,
          response_time_ms,
          crawled_at
        FROM page_content_normalized
        WHERE project_id = $1 
          AND (
            title ILIKE $2
            OR meta_description ILIKE $2
            OR content_text ILIKE $2
            OR url ILIKE $3
          )
        ORDER BY crawled_at DESC
        LIMIT 5
      `;
      const crawledResult = await this.pool.query(crawledPagesQuery, [
        id, 
        `%${decodedKeyword}%`,
        `%${decodedKeyword.replace(/\s+/g, '-')}%`
      ]);

      // 4. Get CWV results for ranking pages
      let cwvData: any[] = [];
      if (gscData?.ranking_pages?.length > 0) {
        const cwvQuery = `
          SELECT 
            url,
            device,
            lcp_value, lcp_status,
            inp_value, inp_status,
            cls_value, cls_status,
            performance_score,
            overall_status,
            measured_at
          FROM cwv_results
          WHERE project_id = $1 AND url = ANY($2)
          ORDER BY measured_at DESC
        `;
        const cwvResult = await this.pool.query(cwvQuery, [id, gscData.ranking_pages]);
        cwvData = cwvResult.rows;
      }

      // 5. Get top competitors for this keyword from GSC (other pages ranking)
      const competitorQuery = `
        SELECT 
          page,
          AVG(position) as avg_position,
          SUM(clicks) as total_clicks,
          SUM(impressions) as total_impressions
        FROM gsc_search_analytics
        WHERE project_id = $1 AND query = $2 AND page IS NOT NULL
        GROUP BY page
        ORDER BY avg_position ASC
        LIMIT 10
      `;
      const competitorResult = await this.pool.query(competitorQuery, [id, decodedKeyword]);

      // 6. Analyze content gaps and generate recommendations
      const analysis = this.analyzeKeywordSEO(
        decodedKeyword,
        gscData,
        crawledResult.rows,
        cwvData,
        relatedKeywords
      );

      reply.send({
        success: true,
        data: {
          keyword: decodedKeyword,
          gsc: gscData ? {
            clicks: parseInt(gscData.clicks),
            impressions: parseInt(gscData.impressions),
            ctr: parseFloat(gscData.ctr),
            position: parseFloat(gscData.position),
            rankingPages: gscData.ranking_pages || [],
          } : null,
          relatedKeywords: relatedKeywords.map(k => ({
            query: k.query,
            clicks: parseInt(k.clicks),
            impressions: parseInt(k.impressions),
            position: parseFloat(k.position),
          })),
          crawledPages: crawledResult.rows.map(p => ({
            url: p.url,
            title: p.title,
            metaDescription: p.meta_description,
            headings: p.headings,
            hasKeywordInTitle: p.title?.toLowerCase().includes(decodedKeyword.toLowerCase()),
            hasKeywordInMeta: p.meta_description?.toLowerCase().includes(decodedKeyword.toLowerCase()),
            hasKeywordInH1: Array.isArray(p.headings) && p.headings.some((h: any) => 
              h.level === 1 && h.text?.toLowerCase().includes(decodedKeyword.toLowerCase())
            ),
            wordCount: p.content_text ? p.content_text.split(/\s+/).length : 0,
            internalLinksCount: Array.isArray(p.internal_links) ? p.internal_links.length : 0,
            externalLinksCount: Array.isArray(p.external_links) ? p.external_links.length : 0,
            httpStatus: p.http_status,
            responseTime: p.response_time_ms,
          })),
          cwv: cwvData.map(c => ({
            url: c.url,
            device: c.device,
            lcp: { value: c.lcp_value != null ? parseFloat(c.lcp_value) : null, status: c.lcp_status },
            inp: { value: c.inp_value != null ? parseFloat(c.inp_value) : null, status: c.inp_status },
            cls: { value: c.cls_value != null ? parseFloat(c.cls_value) : null, status: c.cls_status },
            performanceScore: c.performance_score != null ? parseFloat(c.performance_score) : null,
            overallStatus: c.overall_status,
          })),
          competitors: competitorResult.rows.map(c => ({
            page: c.page,
            avgPosition: parseFloat(c.avg_position),
            totalClicks: parseInt(c.total_clicks),
            totalImpressions: parseInt(c.total_impressions),
          })),
          analysis,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * Analyze keyword SEO and generate actionable recommendations
   */
  private analyzeKeywordSEO(
    keyword: string,
    gscData: any,
    crawledPages: any[],
    cwvData: any[],
    relatedKeywords: any[]
  ): {
    score: number;
    issues: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; message: string; action: string }>;
    recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      actions: string[];
      estimatedImpact: string;
    }>;
    contentBriefSuggestion: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    };
  } {
    const issues: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; message: string; action: string }> = [];
    const recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      actions: string[];
      estimatedImpact: string;
    }> = [];

    let score = 50; // Base score

    const position = gscData ? parseFloat(gscData.position) : 100;
    const ctr = gscData ? parseFloat(gscData.ctr) * 100 : 0;
    const impressions = gscData ? parseInt(gscData.impressions) : 0;

    // Check if any page targets this keyword
    const hasTargetingPage = crawledPages.length > 0;
    const bestPage = crawledPages[0];

    // ===================
    // CONTENT ANALYSIS
    // ===================

    if (!hasTargetingPage) {
      issues.push({
        type: 'content',
        severity: 'critical',
        message: `Không có trang nào target keyword "${keyword}"`,
        action: 'Tạo landing page mới cho keyword này',
      });
      score -= 20;

      recommendations.push({
        category: 'Tạo nội dung mới',
        priority: 'high',
        title: `Tạo Landing Page cho "${keyword}"`,
        description: 'Chưa có trang nào target từ khóa này. Cần tạo nội dung mới.',
        actions: [
          `Tạo trang mới với URL chứa từ khóa: /${keyword.replace(/\s+/g, '-')}/`,
          `Viết bài 2000-3000 từ về chủ đề "${keyword}"`,
          'Thêm hình ảnh, video minh họa',
          'Cấu trúc bài với H2, H3 rõ ràng',
          'Thêm FAQ section',
          'Sử dụng Schema Markup (Article, FAQ)',
        ],
        estimatedImpact: 'Có thể tăng traffic 50-200% cho từ khóa này',
      });
    } else {
      // Check on-page SEO elements
      if (!bestPage.hasKeywordInTitle) {
        issues.push({
          type: 'on-page',
          severity: 'warning',
          message: 'Keyword không có trong Title tag',
          action: `Thêm "${keyword}" vào đầu Title`,
        });
        score -= 10;
      } else {
        score += 5;
      }

      if (!bestPage.hasKeywordInMeta) {
        issues.push({
          type: 'on-page',
          severity: 'warning',
          message: 'Keyword không có trong Meta Description',
          action: `Thêm "${keyword}" vào Meta Description`,
        });
        score -= 5;
      } else {
        score += 5;
      }

      if (!bestPage.hasKeywordInH1) {
        issues.push({
          type: 'on-page',
          severity: 'warning',
          message: 'Keyword không có trong H1',
          action: `Đặt H1 chứa "${keyword}"`,
        });
        score -= 5;
      } else {
        score += 5;
      }

      // Word count analysis
      if (bestPage.wordCount < 1000) {
        issues.push({
          type: 'content',
          severity: 'warning',
          message: `Nội dung quá ngắn (${bestPage.wordCount} từ)`,
          action: 'Bổ sung nội dung lên ít nhất 1500-2000 từ',
        });
        score -= 10;

        recommendations.push({
          category: 'Tối ưu nội dung',
          priority: 'high',
          title: 'Mở rộng nội dung bài viết',
          description: `Bài viết hiện tại chỉ có ${bestPage.wordCount} từ. Nội dung dài hơn thường rank tốt hơn.`,
          actions: [
            'Thêm section giải thích chi tiết hơn',
            'Bổ sung case study hoặc ví dụ thực tế',
            'Thêm bảng so sánh nếu phù hợp',
            'Viết FAQ với 5-10 câu hỏi thường gặp',
            'Thêm infographic tổng hợp thông tin',
          ],
          estimatedImpact: 'Tăng 20-40% thời gian on-page và cải thiện ranking',
        });
      } else if (bestPage.wordCount >= 2000) {
        score += 10;
      }

      // Internal linking
      if (bestPage.internalLinksCount < 3) {
        issues.push({
          type: 'on-page',
          severity: 'info',
          message: `Ít internal links (${bestPage.internalLinksCount})`,
          action: 'Thêm 5-10 internal links đến các trang liên quan',
        });
      }
    }

    // ===================
    // TECHNICAL ANALYSIS
    // ===================

    if (cwvData.length > 0) {
      const latestCWV = cwvData[0];
      
      if (latestCWV.lcp?.status === 'poor' || latestCWV.lcp?.value > 4000) {
        issues.push({
          type: 'technical',
          severity: 'critical',
          message: `LCP quá chậm (${(latestCWV.lcp.value / 1000).toFixed(1)}s)`,
          action: 'Tối ưu LCP xuống dưới 2.5s',
        });
        score -= 15;

        recommendations.push({
          category: 'Technical SEO',
          priority: 'high',
          title: 'Cải thiện Core Web Vitals - LCP',
          description: `LCP hiện tại ${(latestCWV.lcp.value / 1000).toFixed(1)}s, cần giảm xuống < 2.5s`,
          actions: [
            'Tối ưu và nén hình ảnh (WebP, lazy loading)',
            'Sử dụng CDN cho static assets',
            'Preload font và critical CSS',
            'Giảm kích thước JavaScript bundles',
            'Enable browser caching',
          ],
          estimatedImpact: 'Cải thiện ranking và giảm bounce rate 10-30%',
        });
      } else if (latestCWV.lcp?.status === 'good') {
        score += 10;
      }

      if (latestCWV.cls?.status === 'poor' || (latestCWV.cls?.value != null && latestCWV.cls.value > 0.25)) {
        issues.push({
          type: 'technical',
          severity: 'warning',
          message: `CLS cao (${latestCWV.cls?.value != null ? latestCWV.cls.value.toFixed(3) : 'N/A'})`,
          action: 'Giảm CLS xuống dưới 0.1',
        });
        score -= 10;
      }

      if (latestCWV.performanceScore < 50) {
        issues.push({
          type: 'technical',
          severity: 'warning',
          message: `Performance score thấp (${latestCWV.performanceScore})`,
          action: 'Cải thiện performance score lên trên 80',
        });
        score -= 10;
      } else if (latestCWV.performanceScore >= 90) {
        score += 10;
      }
    }

    // ===================
    // RANKING ANALYSIS
    // ===================

    if (position <= 3) {
      score += 20;
      recommendations.push({
        category: 'Bảo vệ vị trí',
        priority: 'medium',
        title: 'Duy trì vị trí top 3',
        description: `Keyword đang rank tốt ở vị trí ${position.toFixed(1)}`,
        actions: [
          'Cập nhật nội dung định kỳ (hàng tháng)',
          'Theo dõi và phản hồi đối thủ mới',
          'Tăng internal links từ các trang mới',
          'Xây dựng thêm backlinks chất lượng',
        ],
        estimatedImpact: 'Duy trì traffic và tránh mất rank',
      });
    } else if (position <= 10 && position > 3) {
      recommendations.push({
        category: 'Quick Win',
        priority: 'high',
        title: `Đẩy từ vị trí ${position.toFixed(0)} lên top 3`,
        description: 'Keyword đã ở trang 1, chỉ cần tối ưu thêm để lên top 3',
        actions: [
          'Viết lại Title hấp dẫn hơn với power words',
          'Cải thiện Meta Description với CTA',
          'Thêm rich snippet (FAQ, How-to schema)',
          'Tăng internal links từ trang có traffic cao',
          'Xin 2-3 backlinks chất lượng từ trang uy tín',
        ],
        estimatedImpact: 'Tăng CTR 50-100% và traffic tương ứng',
      });
    } else if (position <= 20 && position > 10) {
      recommendations.push({
        category: 'Low Hanging Fruit',
        priority: 'high',
        title: `Đưa keyword từ trang 2 (vị trí ${position.toFixed(0)}) lên trang 1`,
        description: 'Keyword đang ở trang 2, gần tới trang 1',
        actions: [
          'Mở rộng nội dung thêm 500-1000 từ',
          'Thêm hình ảnh, video chất lượng',
          'Xây dựng 5-10 internal links',
          'Xin 3-5 backlinks từ các trang liên quan',
          'Cập nhật thông tin mới nhất',
        ],
        estimatedImpact: 'Tăng traffic 200-500% khi lên trang 1',
      });
    } else if (position > 20) {
      recommendations.push({
        category: 'Tiềm năng',
        priority: 'medium',
        title: 'Xây dựng chiến lược content dài hạn',
        description: `Keyword ở vị trí ${position.toFixed(0)}, cần chiến lược toàn diện`,
        actions: [
          'Tạo pillar page toàn diện về chủ đề này',
          'Xây dựng topic cluster với 5-10 bài liên quan',
          'Nghiên cứu và phân tích top 10 đối thủ',
          'Tạo nội dung unique và có giá trị khác biệt',
          'Chiến dịch link building có hệ thống',
        ],
        estimatedImpact: 'Xây dựng authority cho keyword trong 3-6 tháng',
      });
    }

    // CTR Optimization
    if (position <= 10 && ctr < 3) {
      issues.push({
        type: 'ctr',
        severity: 'warning',
        message: `CTR thấp (${ctr.toFixed(2)}%) dù rank top 10`,
        action: 'Cải thiện Title và Meta Description',
      });

      recommendations.push({
        category: 'Tối ưu CTR',
        priority: 'high',
        title: 'Cải thiện snippet để tăng CTR',
        description: `CTR chỉ ${ctr.toFixed(2)}% dù đang ở vị trí ${position.toFixed(0)}`,
        actions: [
          'Viết Title mới với số liệu cụ thể (vd: "10 cách...", "2026...")',
          'Thêm emoji hoặc ký tự đặc biệt vào Title nếu phù hợp',
          'Meta Description với benefit rõ ràng + CTA',
          'Thêm FAQ Schema để có rich snippet',
          'Test nhiều phiên bản Title/Description',
        ],
        estimatedImpact: 'Tăng CTR 50-150%, traffic tăng tương ứng',
      });
    }

    // ===================
    // LINK BUILDING
    // ===================

    if (position > 5 && impressions > 100) {
      recommendations.push({
        category: 'Link Building',
        priority: position > 10 ? 'high' : 'medium',
        title: 'Xây dựng backlinks chất lượng',
        description: 'Backlinks là yếu tố quan trọng để cải thiện ranking',
        actions: [
          'Guest posting trên các blog tài chính, ngân hàng uy tín',
          'Liên hệ báo chí để có coverage và backlinks',
          'Tạo infographic/research để thu hút natural links',
          'Broken link building: tìm và đề xuất thay thế link hỏng',
          'Xây dựng quan hệ với KOLs trong ngành',
          'Đăng ký trên các directory uy tín ngành tài chính',
        ],
        estimatedImpact: 'Mỗi backlink DA50+ có thể cải thiện 1-3 vị trí',
      });
    }

    // ===================
    // CONTENT BRIEF SUGGESTION
    // ===================

    const relatedToInclude = relatedKeywords.slice(0, 5).map(k => k.query);

    const contentBriefSuggestion = {
      suggestedTitle: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - Hướng dẫn chi tiết 2026 | VIB`,
      suggestedMetaDescription: `Tìm hiểu về ${keyword}. Hướng dẫn đầy đủ nhất với thông tin mới nhất 2026. Đăng ký ngay để nhận ưu đãi đặc biệt từ VIB!`,
      suggestedH1: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}: Tất cả những gì bạn cần biết`,
      suggestedOutline: [
        `1. ${keyword} là gì?`,
        `2. Tại sao nên quan tâm đến ${keyword}?`,
        '3. Lợi ích và ưu điểm',
        '4. Cách thức hoạt động',
        '5. So sánh các lựa chọn phổ biến',
        '6. Hướng dẫn từng bước',
        '7. Câu hỏi thường gặp (FAQ)',
        '8. Kết luận và bước tiếp theo',
      ],
      targetWordCount: position > 10 ? 2500 : 2000,
      relatedKeywordsToInclude: relatedToInclude,
    };

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      issues,
      recommendations,
      contentBriefSuggestion,
    };
  }

  // ===========================================================================
  // AI CONFIGURATION
  // ===========================================================================

  /**
   * GET /projects/:id/ai/config
   * Get AI configuration for a project
   */
  async getAIConfig(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;

      const result = await this.pool.query(
        `SELECT 
          ai_provider,
          moltbot_api_url,
          moltbot_model,
          anthropic_model,
          openai_model,
          gemini_model,
          custom_api_url,
          custom_api_model,
          max_tokens,
          temperature,
          -- Return masked API keys (only show last 4 chars)
          CASE WHEN moltbot_api_key IS NOT NULL AND moltbot_api_key != '' 
               THEN '****' || RIGHT(moltbot_api_key, 4) ELSE NULL END as moltbot_api_key_masked,
          CASE WHEN anthropic_api_key IS NOT NULL AND anthropic_api_key != '' 
               THEN '****' || RIGHT(anthropic_api_key, 4) ELSE NULL END as anthropic_api_key_masked,
          CASE WHEN openai_api_key IS NOT NULL AND openai_api_key != '' 
               THEN '****' || RIGHT(openai_api_key, 4) ELSE NULL END as openai_api_key_masked,
          CASE WHEN gemini_api_key IS NOT NULL AND gemini_api_key != '' 
               THEN '****' || RIGHT(gemini_api_key, 4) ELSE NULL END as gemini_api_key_masked,
          CASE WHEN custom_api_key IS NOT NULL AND custom_api_key != '' 
               THEN '****' || RIGHT(custom_api_key, 4) ELSE NULL END as custom_api_key_masked,
          -- Boolean flags for configured providers
          (moltbot_api_key IS NOT NULL AND moltbot_api_key != '') as moltbot_configured,
          (anthropic_api_key IS NOT NULL AND anthropic_api_key != '') as anthropic_configured,
          (openai_api_key IS NOT NULL AND openai_api_key != '') as openai_configured,
          (gemini_api_key IS NOT NULL AND gemini_api_key != '') as gemini_configured,
          (custom_api_key IS NOT NULL AND custom_api_key != '') as custom_configured,
          updated_at
        FROM project_ai_configs
        WHERE project_id = $1`,
        [projectId]
      );

      if (result.rows.length === 0) {
        // Return default config
        return reply.send({
          success: true,
          data: {
            ai_provider: 'auto',
            moltbot_api_url: 'https://api.moltbot.com/v1/chat/completions',
            moltbot_model: 'moltbot-pro',
            anthropic_model: 'claude-3-haiku-20240307',
            openai_model: 'gpt-4o-mini',
            gemini_model: 'gemini-1.5-flash',
            max_tokens: 4000,
            temperature: 0.7,
            moltbot_configured: false,
            anthropic_configured: false,
            openai_configured: false,
            gemini_configured: false,
            custom_configured: false,
          },
        });
      }

      return reply.send({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * PUT /projects/:id/ai/config
   * Update AI configuration for a project
   */
  async updateAIConfig(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        ai_provider?: string;
        moltbot_api_key?: string;
        moltbot_api_url?: string;
        moltbot_model?: string;
        anthropic_api_key?: string;
        anthropic_model?: string;
        openai_api_key?: string;
        openai_model?: string;
        gemini_api_key?: string;
        gemini_model?: string;
        custom_api_key?: string;
        custom_api_url?: string;
        custom_api_model?: string;
        max_tokens?: number;
        temperature?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;
      const config = request.body;

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [projectId];
      let paramIndex = 2;

      // Only update fields that are provided
      const fieldMappings: { [key: string]: string } = {
        ai_provider: 'ai_provider',
        moltbot_api_key: 'moltbot_api_key',
        moltbot_api_url: 'moltbot_api_url',
        moltbot_model: 'moltbot_model',
        anthropic_api_key: 'anthropic_api_key',
        anthropic_model: 'anthropic_model',
        openai_api_key: 'openai_api_key',
        openai_model: 'openai_model',
        gemini_api_key: 'gemini_api_key',
        gemini_model: 'gemini_model',
        custom_api_key: 'custom_api_key',
        custom_api_url: 'custom_api_url',
        custom_api_model: 'custom_api_model',
        max_tokens: 'max_tokens',
        temperature: 'temperature',
      };

      for (const [key, column] of Object.entries(fieldMappings)) {
        if (config[key as keyof typeof config] !== undefined) {
          updates.push(`${column} = $${paramIndex}`);
          values.push(config[key as keyof typeof config]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No fields to update',
        });
      }

      // Upsert query
      const query = `
        INSERT INTO project_ai_configs (project_id, ${Object.keys(fieldMappings).filter(k => config[k as keyof typeof config] !== undefined).join(', ')})
        VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(', ')})
        ON CONFLICT (project_id) 
        DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()
        RETURNING id, project_id, ai_provider, updated_at
      `;

      const result = await this.pool.query(query, values);

      return reply.send({
        success: true,
        message: 'AI configuration updated successfully',
        data: result.rows[0],
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * POST /projects/:id/ai/test
   * Test AI connection with configured API key
   */
  async testAIConnection(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        provider: 'moltbot' | 'anthropic' | 'openai' | 'gemini' | 'custom';
        api_key?: string; // Optional: use provided key or stored key
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;
      const { provider, api_key: providedApiKey } = request.body;

      // Get stored config if no API key provided
      let apiKey = providedApiKey;
      let apiUrl: string | undefined;
      let model: string | undefined;

      if (!apiKey) {
        const configResult = await this.pool.query(
          `SELECT 
            moltbot_api_key, moltbot_api_url, moltbot_model,
            anthropic_api_key, anthropic_model,
            openai_api_key, openai_model,
            gemini_api_key, gemini_model,
            custom_api_key, custom_api_url, custom_api_model
          FROM project_ai_configs
          WHERE project_id = $1`,
          [projectId]
        );

        if (configResult.rows.length > 0) {
          const config = configResult.rows[0];
          switch (provider) {
            case 'moltbot':
              apiKey = config.moltbot_api_key;
              apiUrl = config.moltbot_api_url;
              model = config.moltbot_model;
              break;
            case 'anthropic':
              apiKey = config.anthropic_api_key;
              model = config.anthropic_model;
              break;
            case 'openai':
              apiKey = config.openai_api_key;
              model = config.openai_model;
              break;
            case 'gemini':
              apiKey = config.gemini_api_key;
              model = config.gemini_model;
              break;
            case 'custom':
              apiKey = config.custom_api_key;
              apiUrl = config.custom_api_url;
              model = config.custom_api_model;
              break;
          }
        }
      }

      if (!apiKey) {
        return reply.status(400).send({
          success: false,
          error: `No API key configured for ${provider}`,
        });
      }

      // Test connection based on provider
      let testResult: { success: boolean; message: string; latency?: number };
      const startTime = Date.now();

      try {
        switch (provider) {
          case 'moltbot':
          case 'custom':
            testResult = await this.testOpenAICompatibleAPI(
              apiKey,
              apiUrl || 'https://api.moltbot.com/v1/chat/completions',
              model || 'moltbot-pro'
            );
            break;
          case 'anthropic':
            testResult = await this.testAnthropicAPI(apiKey, model || 'claude-3-haiku-20240307');
            break;
          case 'openai':
            testResult = await this.testOpenAIAPI(apiKey, model || 'gpt-4o-mini');
            break;
          case 'gemini':
            testResult = await this.testGeminiAPI(apiKey, model || 'gemini-1.5-flash');
            break;
          default:
            return reply.status(400).send({
              success: false,
              error: 'Invalid provider',
            });
        }
        testResult.latency = Date.now() - startTime;
      } catch (error) {
        testResult = {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
          latency: Date.now() - startTime,
        };
      }

      return reply.send({
        success: true,
        data: {
          provider,
          ...testResult,
        },
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * Test OpenAI-compatible API (MoltBot, custom)
   */
  private async testOpenAICompatibleAPI(apiKey: string, apiUrl: string, model: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "OK" to test connection.' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: `Connected successfully. Model: ${model}. Response: "${data.choices?.[0]?.message?.content || 'OK'}"`,
    };
  }

  /**
   * Test Anthropic API
   */
  private async testAnthropicAPI(apiKey: string, model: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "OK" to test connection.' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: `Connected successfully. Model: ${model}. Response: "${data.content?.[0]?.text || 'OK'}"`,
    };
  }

  /**
   * Test OpenAI API
   */
  private async testOpenAIAPI(apiKey: string, model: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "OK" to test connection.' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: `Connected successfully. Model: ${model}. Response: "${data.choices?.[0]?.message?.content || 'OK'}"`,
    };
  }

  /**
   * Test Gemini API
   */
  private async testGeminiAPI(apiKey: string, model: string): Promise<{ success: boolean; message: string }> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "OK" to test connection.' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      message: `Connected successfully. Model: ${model}. Response: "${data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK'}"`,
    };
  }

  /**
   * POST /projects/:id/content/generate
   * Generate content using AI based on crawled data and brief
   */
  async generateContent(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        keyword: string;
        brief: {
          suggestedTitle: string;
          suggestedMetaDescription: string;
          suggestedH1: string;
          suggestedOutline: string[];
          targetWordCount: number;
          relatedKeywordsToInclude: string[];
        };
        language?: 'vi' | 'en';
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id: projectId } = request.params;
      const { keyword, brief, language = 'vi' } = request.body;

      if (!keyword || !brief) {
        return reply.status(400).send({
          success: false,
          error: 'keyword and brief are required',
        });
      }

      // 1. Get crawled content related to keyword - prioritize relevant pages
      const crawledQuery = `
        SELECT 
          url,
          title,
          meta_description,
          headings,
          content_text,
          internal_links,
          external_links
        FROM page_content_normalized
        WHERE project_id = $1
          AND (
            title ILIKE $2
            OR meta_description ILIKE $2
            OR content_text ILIKE $2
            OR url ILIKE $2
          )
        ORDER BY 
          CASE 
            WHEN title ILIKE $2 THEN 1 
            WHEN url ILIKE $2 THEN 2
            ELSE 3 
          END,
          LENGTH(content_text) DESC
        LIMIT 10
      `;
      
      const crawledResult = await this.pool.query(crawledQuery, [
        projectId,
        `%${keyword}%`,
      ]);

      // If no keyword-specific results, get top pages by content length
      let additionalPages: any[] = [];
      if (crawledResult.rows.length < 3) {
        const topPagesQuery = `
          SELECT 
            url,
            title,
            meta_description,
            headings,
            content_text
          FROM page_content_normalized
          WHERE project_id = $1
            AND content_text IS NOT NULL
            AND LENGTH(content_text) > 500
          ORDER BY LENGTH(content_text) DESC
          LIMIT 5
        `;
        const topPagesResult = await this.pool.query(topPagesQuery, [projectId]);
        additionalPages = topPagesResult.rows;
      }

      // 2. Get related keywords from GSC
      const relatedKeywordsQuery = `
        SELECT DISTINCT query, SUM(clicks) as clicks
        FROM gsc_search_analytics
        WHERE project_id = $1
          AND query ILIKE $2
        GROUP BY query
        ORDER BY clicks DESC
        LIMIT 10
      `;
      
      const relatedResult = await this.pool.query(relatedKeywordsQuery, [
        projectId,
        `%${keyword}%`,
      ]);

      // 3. Build context from crawled data - combine keyword-specific and top pages
      const allPages = [...crawledResult.rows, ...additionalPages];
      const uniquePages = allPages.filter((page, index, self) => 
        index === self.findIndex(p => p.url === page.url)
      );

      const crawledContext = uniquePages.map(page => ({
        url: page.url,
        title: page.title,
        metaDescription: page.meta_description,
        headings: page.headings,
        // Increase content snippet for better context
        contentSnippet: page.content_text?.substring(0, 4000) || '',
      }));

      const relatedKeywords = relatedResult.rows.map(r => r.query);

      // 4. Get AI configuration from database first, fallback to env vars
      const aiConfigResult = await this.pool.query(
        `SELECT * FROM project_ai_configs WHERE project_id = $1`,
        [projectId]
      );
      const aiConfig = aiConfigResult.rows[0] || {};
      console.log(`[GenerateContent] AI Config loaded: provider=${aiConfig.ai_provider}, ollama_enabled=${aiConfig.ollama_enabled}`);

      // Determine which provider to use based on config or auto-detect
      const selectedProvider = aiConfig.ai_provider || 'auto';
      console.log(`[GenerateContent] Selected provider: ${selectedProvider}`);

      // Get API keys - prefer project config over environment variables
      const moltbotApiKey = aiConfig.moltbot_api_key || process.env.MOLTBOT_API_KEY;
      const moltbotApiUrl = aiConfig.moltbot_api_url || process.env.MOLTBOT_API_URL || 'https://api.moltbot.com/v1/chat/completions';
      const anthropicApiKey = aiConfig.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
      const openaiApiKey = aiConfig.openai_api_key || process.env.OPENAI_API_KEY;
      const geminiApiKey = aiConfig.gemini_api_key || process.env.GEMINI_API_KEY;
      
      // Ollama (local LLM - FREE, no API key needed)
      const ollamaEnabled = aiConfig.ollama_enabled !== false; // Default true
      const ollamaApiUrl = aiConfig.ollama_api_url || process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434/v1/chat/completions';
      const ollamaModel = aiConfig.ollama_model || process.env.OLLAMA_MODEL || 'llama3:8b';
      console.log(`[GenerateContent] Ollama config: enabled=${ollamaEnabled}, url=${ollamaApiUrl}, model=${ollamaModel}`);

      let content: string;
      let method: string;

      try {
        // If specific provider is selected, use that; otherwise auto-detect
        if (selectedProvider !== 'auto' && selectedProvider !== 'template') {
          // Use specific provider
          switch (selectedProvider) {
            case 'ollama':
              content = await this.generateContentWithOllama(
                ollamaApiUrl,
                ollamaModel,
                keyword,
                brief,
                crawledContext,
                relatedKeywords,
                language
              );
              method = 'ollama';
              break;
            case 'moltbot':
              if (!moltbotApiKey) throw new Error('MoltBot API key not configured');
              content = await this.generateContentWithMoltBot(
                moltbotApiKey,
                moltbotApiUrl,
                keyword,
                brief,
                crawledContext,
                relatedKeywords,
                language
              );
              method = 'moltbot';
              break;
            case 'anthropic':
              if (!anthropicApiKey) throw new Error('Anthropic API key not configured');
              content = await this.generateContentWithAnthropic(
                anthropicApiKey,
                keyword,
                brief,
                crawledContext,
                relatedKeywords,
                language
              );
              method = 'anthropic';
              break;
            case 'openai':
              if (!openaiApiKey) throw new Error('OpenAI API key not configured');
              content = await this.generateContentWithOpenAI(
                openaiApiKey,
                keyword,
                brief,
                crawledContext,
                relatedKeywords,
                language
              );
              method = 'openai';
              break;
            case 'gemini':
              if (!geminiApiKey) throw new Error('Gemini API key not configured');
              content = await this.generateContentWithGemini(
                geminiApiKey,
                keyword,
                brief,
                crawledContext,
                relatedKeywords,
                language
              );
              method = 'gemini';
              break;
            default:
              throw new Error(`Unknown provider: ${selectedProvider}`);
          }
        } else if (selectedProvider === 'template') {
          // Force template mode
          content = this.generateContentWithoutAI(keyword, brief, crawledContext, language);
          method = 'template';
        } else {
          // Auto-detect: Priority MOLTBOT > ANTHROPIC > OPENAI > GEMINI > Template
          if (moltbotApiKey) {
            content = await this.generateContentWithMoltBot(
              moltbotApiKey,
              moltbotApiUrl,
              keyword,
              brief,
              crawledContext,
              relatedKeywords,
              language
            );
            method = 'moltbot';
          } else if (anthropicApiKey) {
            content = await this.generateContentWithAnthropic(
              anthropicApiKey,
              keyword,
              brief,
              crawledContext,
              relatedKeywords,
              language
            );
            method = 'anthropic';
          } else if (openaiApiKey) {
            content = await this.generateContentWithOpenAI(
              openaiApiKey,
              keyword,
              brief,
              crawledContext,
              relatedKeywords,
              language
            );
            method = 'openai';
          } else if (geminiApiKey) {
            content = await this.generateContentWithGemini(
              geminiApiKey,
              keyword,
              brief,
              crawledContext,
              relatedKeywords,
              language
            );
            method = 'gemini';
          } else if (ollamaEnabled) {
            // Try Ollama (local LLM - FREE)
            try {
              content = await this.generateContentWithOllama(
                ollamaApiUrl,
                ollamaModel,
                keyword,
                brief,
                crawledContext,
                relatedKeywords,
                language
              );
              method = 'ollama';
            } catch (ollamaError) {
              // Ollama not available, use template
              this.logger.warn('Ollama not available, falling back to template', { error: ollamaError });
              content = this.generateContentWithoutAI(keyword, brief, crawledContext, language);
              method = 'template';
            }
          } else {
            // Fallback to template
            content = this.generateContentWithoutAI(keyword, brief, crawledContext, language);
            method = 'template';
          }
        }

        return reply.send({
          success: true,
          data: {
            content,
            wordCount: content.split(/\s+/).length,
            generatedAt: new Date().toISOString(),
            method,
            crawledPagesUsed: crawledContext.length,
          },
        });
      } catch (aiError) {
        this.logger.error('AI content generation failed, falling back to template', { error: aiError });
        // Fallback to template on AI error
        content = this.generateContentWithoutAI(keyword, brief, crawledContext, language);
        return reply.send({
          success: true,
          data: {
            content,
            wordCount: content.split(/\s+/).length,
            generatedAt: new Date().toISOString(),
            method: 'template',
            fallbackReason: aiError instanceof Error ? aiError.message : 'AI generation failed',
            crawledPagesUsed: crawledContext.length,
          },
        });
      }

    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * Build prompt for content generation
   */
  private buildContentPrompt(
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    relatedKeywords: string[],
    language: 'vi' | 'en'
  ): { systemPrompt: string; userPrompt: string } {
    // Format crawled data more clearly
    const crawledDataSummary = crawledContext.map((page, index) => 
      `=== TRANG ${index + 1} ===
URL: ${page.url}
Tiêu đề: ${page.title}
Mô tả: ${page.metaDescription || 'N/A'}
Nội dung chính:
${page.contentSnippet}
=== HẾT TRANG ${index + 1} ===`
    ).join('\n\n');

    const systemPrompt = language === 'vi' 
      ? `Bạn là chuyên gia viết nội dung SEO cho ngân hàng VIB (Ngân hàng Quốc Tế Việt Nam).

NGUYÊN TẮC QUAN TRỌNG - BẮT BUỘC TUÂN THỦ:
1. CHỈ sử dụng thông tin từ DỮ LIỆU THAM KHẢO được cung cấp bên dưới
2. KHÔNG BỊA thông tin về lãi suất, điều kiện vay, phí, hay bất kỳ con số cụ thể nào
3. KHÔNG viết thông tin mà bạn không thấy trong dữ liệu tham khảo
4. Nếu dữ liệu không đủ cho một section, hãy viết ngắn gọn và khuyến khích người đọc truy cập website để biết thêm chi tiết
5. Giữ nguyên các con số, tỷ lệ, điều kiện CHÍNH XÁC như trong dữ liệu nguồn
6. Format output bằng Markdown với H1, H2, H3 rõ ràng
7. Độ dài bài viết: ${brief.targetWordCount} từ
8. KHÔNG sử dụng các claim tuyệt đối như "tốt nhất", "số 1", "hàng đầu"`
      : `You are an SEO content specialist for VIB Bank (Vietnam International Bank).

CRITICAL RULES - MUST FOLLOW:
1. ONLY use information from the REFERENCE DATA provided below
2. DO NOT fabricate information about interest rates, loan conditions, fees, or any specific numbers
3. DO NOT write information that you cannot find in the reference data
4. If data is insufficient for a section, write briefly and encourage readers to visit the website for details
5. Keep all numbers, rates, and conditions EXACTLY as in the source data
6. Format output in Markdown with clear H1, H2, H3
7. Target word count: ${brief.targetWordCount} words
8. DO NOT use absolute claims like "best", "#1", "leading"`;

    const userPrompt = language === 'vi'
      ? `Viết bài blog về "${keyword}" dựa HOÀN TOÀN vào dữ liệu tham khảo bên dưới.

## YÊU CẦU BÀI VIẾT:
- Tiêu đề (H1): ${brief.suggestedTitle}
- Meta Description: ${brief.suggestedMetaDescription}
- Độ dài: ${brief.targetWordCount} từ

## CẤU TRÚC BÀI VIẾT:
${brief.suggestedOutline.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## TỪ KHÓA CẦN SỬ DỤNG TỰ NHIÊN:
${[keyword, ...brief.relatedKeywordsToInclude, ...relatedKeywords].slice(0, 10).join(', ')}

## DỮ LIỆU THAM KHẢO TỪ WEBSITE VIB (CHỈ SỬ DỤNG THÔNG TIN NÀY):
${crawledDataSummary || 'Không có dữ liệu crawl. Viết bài giới thiệu chung và hướng dẫn khách hàng truy cập vib.com.vn để biết thêm chi tiết.'}

## QUY TẮC VIẾT:
1. Trích xuất thông tin CỤ THỂ từ dữ liệu tham khảo (lãi suất, điều kiện, thời hạn, số tiền...)
2. Nếu thông tin không có trong dữ liệu, KHÔNG ĐƯỢC BỊA - thay vào đó viết "Để biết thông tin chi tiết, vui lòng truy cập [đường link từ dữ liệu]"
3. Giữ nguyên URL gốc từ dữ liệu để làm internal link
4. Viết tự nhiên, dễ hiểu, phù hợp người Việt
5. Kết thúc với CTA nhẹ nhàng hướng người đọc đến hotline 1800 8180 hoặc website vib.com.vn

CHỈ OUTPUT NỘI DUNG MARKDOWN, KHÔNG GIẢI THÍCH THÊM:`
      : `Write a blog article about "${keyword}" based ENTIRELY on the reference data below.

## ARTICLE REQUIREMENTS:
- Title (H1): ${brief.suggestedTitle}
- Meta Description: ${brief.suggestedMetaDescription}
- Length: ${brief.targetWordCount} words

## ARTICLE STRUCTURE:
${brief.suggestedOutline.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## KEYWORDS TO USE NATURALLY:
${[keyword, ...brief.relatedKeywordsToInclude, ...relatedKeywords].slice(0, 10).join(', ')}

## REFERENCE DATA FROM VIB WEBSITE (USE ONLY THIS INFORMATION):
${crawledDataSummary || 'No crawled data available. Write a general introduction and guide customers to visit vib.com.vn for more details.'}

## WRITING RULES:
1. Extract SPECIFIC information from reference data (rates, conditions, terms, amounts...)
2. If information is not in the data, DO NOT FABRICATE - instead write "For detailed information, please visit [link from data]"
3. Keep original URLs from data for internal links
4. Write naturally, easy to understand
5. End with a soft CTA directing readers to hotline 1800 8180 or website vib.com.vn

OUTPUT ONLY MARKDOWN CONTENT, NO EXPLANATIONS:`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Generate content using MoltBot API (OpenAI-compatible)
   */
  private async generateContentWithMoltBot(
    apiKey: string,
    apiUrl: string,
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    relatedKeywords: string[],
    language: 'vi' | 'en'
  ): Promise<string> {
    const { systemPrompt, userPrompt } = this.buildContentPrompt(
      keyword, brief, crawledContext, relatedKeywords, language
    );

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.MOLTBOT_MODEL || 'moltbot-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`MoltBot API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('MoltBot API call failed', { error });
      throw error;
    }
  }

  /**
   * Generate content using Ollama (Local LLM - FREE)
   * NOTE: llama3:8b on CPU needs ~70s for short prompts, so keep context minimal
   */
  private async generateContentWithOllama(
    apiUrl: string,
    model: string,
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    relatedKeywords: string[],
    language: 'vi' | 'en'
  ): Promise<string> {
    // For Ollama local LLM on CPU: Keep context MINIMAL for reasonable response time
    // ~70 seconds per 350 chars prompt, so target < 2000 chars total prompt
    const limitedContext = crawledContext.slice(0, 2).map(ctx => ({
      url: ctx.url,
      title: ctx.title,
      metaDescription: ctx.metaDescription,
      headings: null, // Skip headings to reduce size
      // VERY short content snippet
      contentSnippet: ctx.contentSnippet?.substring(0, 500) || '',
    }));

    // Use a simplified prompt for Ollama to reduce processing time
    const systemPrompt = language === 'vi'
      ? `Bạn là chuyên gia SEO VIB. Viết nội dung bằng tiếng Việt dựa trên dữ liệu được cung cấp. Chỉ sử dụng thông tin thực tế từ dữ liệu, KHÔNG được bịa đặt.`
      : `You are VIB SEO expert. Write content based on provided data only. Do NOT fabricate information.`;

    // Build compact user prompt
    const outlineStr = brief.suggestedOutline.slice(0, 3).join(', ');
    const contextStr = limitedContext.map(c => 
      `- ${c.title}: ${c.metaDescription || ''} ${c.contentSnippet.substring(0, 200)}`
    ).join('\n');

    const userPrompt = language === 'vi'
      ? `Viết bài ${brief.targetWordCount || 300} từ về "${keyword}"

Tiêu đề: ${brief.suggestedH1}
Outline: ${outlineStr}

Dữ liệu tham khảo:
${contextStr}

${relatedKeywords.length > 0 ? `Từ khóa liên quan: ${relatedKeywords.slice(0, 3).join(', ')}` : ''}

Yêu cầu: Sử dụng format Markdown với heading ##. CHỈ viết dựa trên dữ liệu ở trên.`
      : `Write ${brief.targetWordCount || 300} words about "${keyword}"

Title: ${brief.suggestedH1}
Outline: ${outlineStr}

Reference data:
${contextStr}

${relatedKeywords.length > 0 ? `Related keywords: ${relatedKeywords.slice(0, 3).join(', ')}` : ''}

Format: Use Markdown with ## headings. ONLY use information from the data above.`;

    const totalPromptLength = systemPrompt.length + userPrompt.length;
    console.log(`[Ollama] Compact prompt length: ${totalPromptLength}, Pages: ${limitedContext.length}`);
    console.log(`[Ollama] Starting API call - URL: ${apiUrl}, Model: ${model}`);

    try {
      // Ollama uses OpenAI-compatible API format
      // Timeout: 10 minutes for CPU-based inference
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes

      const startTime = Date.now();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          options: {
            num_predict: 1024, // Limit output tokens for faster response
          }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Ollama API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Ollama] API call completed in ${elapsed}s`);
      return data.choices?.[0]?.message?.content || data.message?.content || '';
    } catch (error: any) {
      const errMsg = error?.name === 'AbortError' ? 'Request timeout (10 min)' : error?.message;
      console.error(`[Ollama] API call failed: ${errMsg}`);
      this.logger.error('Ollama API call failed', { error: errMsg });
      throw error;
    }
  }

  /**
   * Generate content using Anthropic Claude API
   */
  private async generateContentWithAnthropic(
    apiKey: string,
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    relatedKeywords: string[],
    language: 'vi' | 'en'
  ): Promise<string> {
    const { systemPrompt, userPrompt } = this.buildContentPrompt(
      keyword, brief, crawledContext, relatedKeywords, language
    );

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      this.logger.error('Anthropic API call failed', { error });
      throw error;
    }
  }

  /**
   * Generate content using OpenAI API
   */
  private async generateContentWithOpenAI(
    apiKey: string,
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    relatedKeywords: string[],
    language: 'vi' | 'en'
  ): Promise<string> {
    const { systemPrompt, userPrompt } = this.buildContentPrompt(
      keyword, brief, crawledContext, relatedKeywords, language
    );

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('OpenAI API call failed', { error });
      throw error;
    }
  }

  /**
   * Generate content using Google Gemini API
   */
  private async generateContentWithGemini(
    apiKey: string,
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    relatedKeywords: string[],
    language: 'vi' | 'en'
  ): Promise<string> {
    const { systemPrompt, userPrompt } = this.buildContentPrompt(
      keyword, brief, crawledContext, relatedKeywords, language
    );

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\n${userPrompt}` }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4000,
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      this.logger.error('Gemini API call failed', { error });
      throw error;
    }
  }

  /**
   * Generate content without AI - using templates and crawled data
   */
  private generateContentWithoutAI(
    keyword: string,
    brief: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    },
    crawledContext: Array<{
      url: string;
      title: string;
      metaDescription: string;
      headings: any;
      contentSnippet: string;
    }>,
    language: 'vi' | 'en'
  ): string {
    // Helper to clean content - remove HTML entities, extra whitespace, etc.
    const cleanContent = (text: string): string => {
      if (!text) return '';
      return text
        // Remove HTML-like patterns (Z7_xxx, etc.)
        .replace(/Z\d+_[A-Z0-9]+/g, '')
        // Remove multiple spaces
        .replace(/\s+/g, ' ')
        // Remove lines that are too short or look like navigation
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 30 && 
                 !trimmed.match(/^(Đăng ký|Table of contents|Nội dung chính|Menu|Navigation)/i);
        })
        .join('\n')
        .trim();
    };

    // Extract meaningful sentences from content
    const extractSentences = (text: string, maxSentences: number = 5): string => {
      const cleaned = cleanContent(text);
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences.slice(0, maxSentences).map(s => s.trim() + '.').join(' ');
    };

    let content = `# ${brief.suggestedH1}\n\n`;

    // Introduction using meta descriptions from crawled pages
    const introMeta = crawledContext.find(p => p.metaDescription)?.metaDescription || '';
    if (language === 'vi') {
      content += `${keyword} là một trong những sản phẩm/dịch vụ được nhiều khách hàng quan tâm tại VIB. `;
      if (introMeta && cleanContent(introMeta).length > 50) {
        content += cleanContent(introMeta) + '\n\n';
      } else {
        content += `Trong bài viết này, VIB sẽ cung cấp cho bạn thông tin chi tiết và hữu ích nhất về ${keyword}.\n\n`;
      }
    } else {
      content += `${keyword} is one of the most popular products/services at VIB. `;
      content += `In this article, VIB will provide you with the most detailed and useful information.\n\n`;
    }

    // Generate sections from outline
    for (const heading of brief.suggestedOutline) {
      content += `## ${heading}\n\n`;

      // Find relevant crawled content for this section
      const headingKeyword = heading.toLowerCase().split(' ').slice(0, 2).join(' ');
      const relevantPages = crawledContext.filter(page => {
        const titleMatch = page.title?.toLowerCase().includes(headingKeyword);
        const contentMatch = page.contentSnippet?.toLowerCase().includes(headingKeyword);
        return titleMatch || contentMatch;
      });

      if (relevantPages.length > 0) {
        // Combine content from relevant pages
        for (const page of relevantPages.slice(0, 2)) {
          if (page.contentSnippet) {
            const cleanedSnippet = extractSentences(page.contentSnippet, 4);
            if (cleanedSnippet.length > 100) {
              content += `${cleanedSnippet}\n\n`;
              content += `📌 *Xem chi tiết: [${cleanContent(page.title)}](${page.url})*\n\n`;
            }
          }
        }
        
        // If no usable content, use placeholder
        if (content.endsWith(`## ${heading}\n\n`)) {
          if (language === 'vi') {
            content += `Phần này cung cấp thông tin chi tiết về ${heading.toLowerCase()}. `;
            content += `Liên hệ VIB để được tư vấn cụ thể về ${keyword}.\n\n`;
          } else {
            content += `This section provides detailed information about ${heading.toLowerCase()}. `;
            content += `Contact VIB for specific advice about ${keyword}.\n\n`;
          }
        }
      } else {
        // Generate content from headings if available
        const pageWithHeadings = crawledContext.find(p => Array.isArray(p.headings) && p.headings.length > 0);
        if (pageWithHeadings && Array.isArray(pageWithHeadings.headings)) {
          const relevantHeadings = pageWithHeadings.headings
            .filter((h: any) => h.text && h.text.toLowerCase().includes(headingKeyword.split(' ')[0]))
            .map((h: any) => h.text)
            .slice(0, 3);
          
          if (relevantHeadings.length > 0) {
            content += `Các nội dung chính:\n`;
            relevantHeadings.forEach((h: string) => {
              content += `- ${cleanContent(h)}\n`;
            });
            content += `\n`;
          }
        }
        
        // Default placeholder
        if (language === 'vi') {
          content += `Thông tin về ${heading.toLowerCase()} là một phần quan trọng khi tìm hiểu về ${keyword}. `;
          content += `VIB cam kết cung cấp các sản phẩm và dịch vụ phù hợp nhất với nhu cầu của bạn.\n\n`;
        } else {
          content += `Information about ${heading.toLowerCase()} is an important part of understanding ${keyword}. `;
          content += `VIB is committed to providing products and services that best fit your needs.\n\n`;
        }
      }
    }

    // Related keywords section
    if (brief.relatedKeywordsToInclude.length > 0) {
      if (language === 'vi') {
        content += `## Các chủ đề liên quan\n\n`;
        content += `Ngoài ${keyword}, bạn cũng có thể quan tâm đến các chủ đề sau:\n`;
        brief.relatedKeywordsToInclude.slice(0, 5).forEach(kw => {
          content += `- ${kw}\n`;
        });
        content += `\n`;
      } else {
        content += `## Related Topics\n\n`;
        content += `Besides ${keyword}, you might also be interested in:\n`;
        brief.relatedKeywordsToInclude.slice(0, 5).forEach(kw => {
          content += `- ${kw}\n`;
        });
        content += `\n`;
      }
    }

    // Add internal links section
    const uniqueUrls = [...new Set(crawledContext.map(p => p.url))].slice(0, 5);
    if (uniqueUrls.length > 0) {
      if (language === 'vi') {
        content += `## Tham khảo thêm\n\n`;
        crawledContext.slice(0, 5).forEach(page => {
          if (page.title && page.url) {
            content += `- [${cleanContent(page.title)}](${page.url})\n`;
          }
        });
        content += `\n`;
      }
    }

    // CTA
    if (language === 'vi') {
      content += `## Kết luận\n\n`;
      content += `Hy vọng bài viết đã cung cấp cho bạn thông tin hữu ích về ${keyword}. `;
      content += `VIB luôn sẵn sàng hỗ trợ và tư vấn để bạn có được sản phẩm phù hợp nhất. `;
      content += `Hãy liên hệ hotline 1800 8180 hoặc truy cập [vib.com.vn](https://www.vib.com.vn) để được hỗ trợ.\n`;
    } else {
      content += `## Conclusion\n\n`;
      content += `We hope this article has provided you with useful information about ${keyword}. `;
      content += `VIB is always ready to support and advise you to find the most suitable product. `;
      content += `Please contact hotline 1800 8180 or visit [vib.com.vn](https://www.vib.com.vn) for assistance.\n`;
    }

    return content;
  }
}
