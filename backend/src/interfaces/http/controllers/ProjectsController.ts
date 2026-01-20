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

  constructor(pool: Pool) {
    this.logger = new Logger('ProjectsController');
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
    app.get('/projects/:id/keywords', this.getKeywordRankings.bind(this));
    app.get('/projects/:id/health', this.getTechnicalHealth.bind(this));
    app.get('/projects/:id/backlinks', this.getBacklinkMetrics.bind(this));
    app.get('/projects/:id/kpi', this.getKPISnapshots.bind(this));
    app.get('/projects/:id/forecasts', this.getForecasts.bind(this));
    app.get('/projects/:id/recommendations', this.getRecommendations.bind(this));
    app.patch('/projects/:id/recommendations/:recId', this.updateRecommendationStatus.bind(this));
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
}
