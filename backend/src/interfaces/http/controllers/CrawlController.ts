/**
 * Crawl Controller
 * API endpoints for managing crawl operations
 * 
 * v1.0 - Add URLs to crawl queue
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { Logger } from '../../../shared/Logger';
import { NotFoundError, ValidationError } from '../../../shared/errors';

interface AddUrlsRequest {
  urls: string[];
  priority?: number;
}

interface CrawlQueueItem {
  id: string;
  url: string;
  status: string;
  priority: number;
  createdAt: Date;
}

export class CrawlController {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('CrawlController');
  }

  /**
   * Register routes
   */
  registerRoutes(app: FastifyInstance): void {
    // Add URLs to crawl queue
    app.post('/projects/:id/crawl/urls', this.addUrlsToCrawl.bind(this));
    
    // Get crawl queue for project
    app.get('/projects/:id/crawl/queue', this.getCrawlQueue.bind(this));
    
    // Remove URL from queue
    app.delete('/projects/:id/crawl/queue/:urlId', this.removeFromQueue.bind(this));
    
    // Clear pending queue
    app.delete('/projects/:id/crawl/queue', this.clearQueue.bind(this));
    
    // Get crawl status summary
    app.get('/projects/:id/crawl/status', this.getCrawlStatus.bind(this));
  }

  /**
   * POST /projects/:id/crawl/urls
   * Add multiple URLs to the crawl queue
   */
  async addUrlsToCrawl(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: AddUrlsRequest;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId } = request.params;
    const { urls, priority = 50 } = request.body;

    try {
      this.logger.info('Adding URLs to crawl queue', { projectId, urlCount: urls?.length });

      // Validate input
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        throw new ValidationError('At least one URL is required');
      }

      if (urls.length > 100) {
        throw new ValidationError('Maximum 100 URLs can be added at once');
      }

      // Validate project exists
      const projectResult = await this.pool.query(
        'SELECT id, name, base_url FROM projects WHERE id = $1',
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project', projectId);
      }

      const project = projectResult.rows[0];
      const baseUrl = project.base_url;

      // Validate and normalize URLs
      const validUrls: string[] = [];
      const invalidUrls: { url: string; reason: string }[] = [];

      for (const rawUrl of urls) {
        try {
          const trimmedUrl = rawUrl.trim();
          if (!trimmedUrl) continue;

          let normalizedUrl: string;

          // Handle relative URLs
          if (trimmedUrl.startsWith('/')) {
            normalizedUrl = new URL(trimmedUrl, baseUrl).href;
          } else if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            // Assume it's a path without leading slash
            normalizedUrl = new URL('/' + trimmedUrl, baseUrl).href;
          } else {
            normalizedUrl = new URL(trimmedUrl).href;
          }

          // Check if URL belongs to the project's domain
          const urlObj = new URL(normalizedUrl);
          const baseUrlObj = new URL(baseUrl);
          
          if (urlObj.hostname !== baseUrlObj.hostname) {
            invalidUrls.push({ url: rawUrl, reason: 'URL must be from the same domain as project' });
            continue;
          }

          validUrls.push(normalizedUrl);
        } catch (error) {
          invalidUrls.push({ url: rawUrl, reason: 'Invalid URL format' });
        }
      }

      if (validUrls.length === 0) {
        reply.status(400).send({
          success: false,
          error: {
            code: 'NO_VALID_URLS',
            message: 'No valid URLs provided',
          },
          invalidUrls,
        });
        return;
      }

      // Insert URLs into url_inventory (if not exists) and crawl_queue
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        const addedUrls: CrawlQueueItem[] = [];
        const skippedUrls: { url: string; reason: string }[] = [];

        for (const url of validUrls) {
          // First, ensure URL exists in url_inventory
          const inventoryResult = await client.query(`
            INSERT INTO url_inventory (project_id, url, state, discovered_from, first_seen_at)
            VALUES ($1, $2, 'QUEUED', 'manual', NOW())
            ON CONFLICT (project_id, url) 
            DO UPDATE SET state = CASE 
              WHEN url_inventory.state = 'CRAWLED' THEN 'QUEUED'
              ELSE url_inventory.state 
            END
            RETURNING id, state
          `, [projectId, url]);

          // Check if URL is already in queue (pending)
          const existingQueue = await client.query(`
            SELECT id FROM crawl_queue 
            WHERE project_id = $1 AND status = 'pending'
            AND id IN (
              SELECT cq.id FROM crawl_queue cq
              JOIN url_inventory ui ON ui.project_id = cq.project_id
              WHERE ui.url = $2
            )
          `, [projectId, url]);

          if (existingQueue.rows.length > 0) {
            skippedUrls.push({ url, reason: 'Already in queue' });
            continue;
          }

          // Add to crawl queue
          const queueResult = await client.query(`
            INSERT INTO crawl_queue (project_id, priority, status, scheduled_for)
            VALUES ($1, $2, 'pending', NOW())
            RETURNING id, priority, status, created_at
          `, [projectId, priority]);

          addedUrls.push({
            id: queueResult.rows[0].id,
            url,
            status: queueResult.rows[0].status,
            priority: queueResult.rows[0].priority,
            createdAt: queueResult.rows[0].created_at,
          });
        }

        await client.query('COMMIT');

        this.logger.info('URLs added to crawl queue', { 
          projectId, 
          added: addedUrls.length,
          skipped: skippedUrls.length,
          invalid: invalidUrls.length,
        });

        reply.send({
          success: true,
          data: {
            added: addedUrls,
            skipped: skippedUrls,
            invalid: invalidUrls,
            summary: {
              total: urls.length,
              added: addedUrls.length,
              skipped: skippedUrls.length,
              invalid: invalidUrls.length,
            },
          },
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error: any) {
      this.logger.error('Failed to add URLs to crawl', { error: error.message, projectId });
      
      if (error instanceof ValidationError) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.message },
        });
        return;
      }
      
      if (error instanceof NotFoundError) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }

      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add URLs to crawl queue' },
      });
    }
  }

  /**
   * GET /projects/:id/crawl/queue
   * Get current crawl queue for project
   */
  async getCrawlQueue(
    request: FastifyRequest<{ 
      Params: { id: string };
      Querystring: { status?: string; limit?: number; offset?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId } = request.params;
    const { status, limit = 50, offset = 0 } = request.query;

    try {
      let query = `
        SELECT 
          cq.id,
          cq.priority,
          cq.status,
          cq.scheduled_for,
          cq.started_at,
          cq.created_at
        FROM crawl_queue cq
        WHERE cq.project_id = $1
      `;
      const values: any[] = [projectId];
      let paramIndex = 2;

      if (status) {
        query += ` AND cq.status = $${paramIndex++}`;
        values.push(status);
      }

      query += ` ORDER BY cq.priority DESC, cq.created_at ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      values.push(limit, offset);

      const result = await this.pool.query(query, values);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM crawl_queue 
        WHERE project_id = $1 ${status ? 'AND status = $2' : ''}
      `;
      const countValues = status ? [projectId, status] : [projectId];
      const countResult = await this.pool.query(countQuery, countValues);

      reply.send({
        success: true,
        data: {
          items: result.rows,
          pagination: {
            total: parseInt(countResult.rows[0].total),
            limit,
            offset,
          },
        },
      });

    } catch (error: any) {
      this.logger.error('Failed to get crawl queue', { error: error.message, projectId });
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get crawl queue' },
      });
    }
  }

  /**
   * DELETE /projects/:id/crawl/queue/:urlId
   * Remove a specific URL from queue
   */
  async removeFromQueue(
    request: FastifyRequest<{ Params: { id: string; urlId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId, urlId } = request.params;

    try {
      const result = await this.pool.query(`
        DELETE FROM crawl_queue 
        WHERE id = $1 AND project_id = $2 AND status = 'pending'
        RETURNING id
      `, [urlId, projectId]);

      if (result.rows.length === 0) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Queue item not found or already processing' },
        });
        return;
      }

      reply.send({
        success: true,
        data: { removed: urlId },
      });

    } catch (error: any) {
      this.logger.error('Failed to remove from queue', { error: error.message, projectId, urlId });
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove from queue' },
      });
    }
  }

  /**
   * DELETE /projects/:id/crawl/queue
   * Clear all pending items from queue
   */
  async clearQueue(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId } = request.params;

    try {
      const result = await this.pool.query(`
        DELETE FROM crawl_queue 
        WHERE project_id = $1 AND status = 'pending'
      `, [projectId]);

      reply.send({
        success: true,
        data: { cleared: result.rowCount },
      });

    } catch (error: any) {
      this.logger.error('Failed to clear queue', { error: error.message, projectId });
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to clear queue' },
      });
    }
  }

  /**
   * GET /projects/:id/crawl/status
   * Get crawl status summary
   */
  async getCrawlStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id: projectId } = request.params;

    try {
      // Get queue stats
      const queueStats = await this.pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM crawl_queue
        WHERE project_id = $1
      `, [projectId]);

      // Get inventory stats
      const inventoryStats = await this.pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE state = 'DISCOVERED') as discovered,
          COUNT(*) FILTER (WHERE state = 'QUEUED') as queued,
          COUNT(*) FILTER (WHERE state = 'CRAWLED') as crawled,
          COUNT(*) FILTER (WHERE state = 'ERROR') as error
        FROM url_inventory
        WHERE project_id = $1
      `, [projectId]);

      // Get latest crawl job info
      const latestJob = await this.pool.query(`
        SELECT id, status, started_at, completed_at, stats
        FROM crawl_jobs
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [projectId]);

      reply.send({
        success: true,
        data: {
          queue: {
            total: parseInt(queueStats.rows[0].total),
            pending: parseInt(queueStats.rows[0].pending),
            processing: parseInt(queueStats.rows[0].processing),
            completed: parseInt(queueStats.rows[0].completed),
            failed: parseInt(queueStats.rows[0].failed),
          },
          inventory: {
            total: parseInt(inventoryStats.rows[0].total),
            discovered: parseInt(inventoryStats.rows[0].discovered),
            queued: parseInt(inventoryStats.rows[0].queued),
            crawled: parseInt(inventoryStats.rows[0].crawled),
            error: parseInt(inventoryStats.rows[0].error),
          },
          latestJob: latestJob.rows[0] || null,
        },
      });

    } catch (error: any) {
      this.logger.error('Failed to get crawl status', { error: error.message, projectId });
      reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get crawl status' },
      });
    }
  }
}
