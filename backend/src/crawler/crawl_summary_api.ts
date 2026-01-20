/**
 * Crawl Summary API
 * 
 * Endpoints for crawl dashboard data
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';

interface CrawlSummaryParams {
  projectId: string;
}

/**
 * Register crawl summary routes
 */
export async function registerCrawlSummaryRoutes(
  fastify: FastifyInstance,
  pool: Pool
) {
  /**
   * GET /api/v1/projects/:projectId/crawl/summary
   * 
   * Get crawl summary for dashboard
   */
  fastify.get<{ Params: CrawlSummaryParams }>(
    '/api/v1/projects/:projectId/crawl/summary',
    async (request: FastifyRequest<{ Params: CrawlSummaryParams }>, reply: FastifyReply) => {
      const { projectId } = request.params;

      try {
        // Get project info
        const projectResult = await pool.query(
          'SELECT id, name, website_url FROM projects WHERE id = $1',
          [projectId]
        );

        if (projectResult.rows.length === 0) {
          return reply.status(404).send({ error: 'Project not found' });
        }

        const project = projectResult.rows[0];

        // Get crawl job status
        const crawlJobResult = await pool.query(
          `SELECT status, progress, started_at, completed_at 
           FROM crawl_jobs 
           WHERE project_id = $1 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [projectId]
        );

        const crawlJob = crawlJobResult.rows[0] || null;

        // Get page stats
        const pageStatsResult = await pool.query(
          `SELECT 
             COUNT(*) as total_pages,
             COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500) as error_4xx,
             COUNT(*) FILTER (WHERE status_code >= 500) as error_5xx,
             COUNT(*) FILTER (WHERE is_indexable = false) as noindex_pages,
             AVG(load_time_ms) as avg_load_time
           FROM crawl_pages
           WHERE project_id = $1`,
          [projectId]
        );

        const pageStats = pageStatsResult.rows[0];

        // Get status code distribution
        const statusCodeResult = await pool.query(
          `SELECT 
             CASE 
               WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
               WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
               WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
               WHEN status_code >= 500 THEN '5xx'
               ELSE 'unknown'
             END as code_group,
             COUNT(*) as count
           FROM crawl_pages
           WHERE project_id = $1
           GROUP BY code_group
           ORDER BY code_group`,
          [projectId]
        );

        // Get issue counts
        const issueResult = await pool.query(
          `SELECT 
             issue_type,
             severity,
             COUNT(*) as count
           FROM crawl_page_issues
           WHERE project_id = $1
           GROUP BY issue_type, severity
           ORDER BY 
             CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
             count DESC`,
          [projectId]
        );

        // Build response
        const totalPages = parseInt(pageStats.total_pages) || 0;
        const error4xx = parseInt(pageStats.error_4xx) || 0;
        const error5xx = parseInt(pageStats.error_5xx) || 0;
        const noindexPages = parseInt(pageStats.noindex_pages) || 0;

        // Calculate pages with issues
        const uniquePagesWithIssues = await pool.query(
          `SELECT COUNT(DISTINCT page_url) as count 
           FROM crawl_page_issues 
           WHERE project_id = $1`,
          [projectId]
        );
        const pagesWithIssues = parseInt(uniquePagesWithIssues.rows[0]?.count) || 0;

        // Status code distribution
        const statusCodeLabels: Record<string, { label: string; color: string }> = {
          '2xx': { label: 'Success', color: '#22c55e' },
          '3xx': { label: 'Redirect', color: '#3b82f6' },
          '4xx': { label: 'Client Error', color: '#f59e0b' },
          '5xx': { label: 'Server Error', color: '#ef4444' },
        };

        const statusCodes = statusCodeResult.rows.map((row) => ({
          code: row.code_group,
          count: parseInt(row.count),
          percentage: totalPages > 0 ? (parseInt(row.count) / totalPages) * 100 : 0,
          label: statusCodeLabels[row.code_group]?.label || 'Unknown',
          color: statusCodeLabels[row.code_group]?.color || '#9ca3af',
        }));

        // Issue labels
        const issueLabels: Record<string, { label: string; description: string }> = {
          missing_meta_description: {
            label: 'Missing Meta Description',
            description: 'Pages without meta description may have lower CTR',
          },
          missing_h1: {
            label: 'Missing H1 Tag',
            description: 'Every page should have exactly one H1 tag',
          },
          broken_links: {
            label: 'Broken Links',
            description: 'Internal links pointing to non-existent pages',
          },
          slow_pages: {
            label: 'Slow Loading Pages',
            description: 'Pages taking more than 3 seconds to load',
          },
          missing_alt: {
            label: 'Images Missing Alt Text',
            description: 'Images should have descriptive alt text',
          },
          duplicate_title: {
            label: 'Duplicate Title Tags',
            description: 'Multiple pages share the same title',
          },
          long_title: {
            label: 'Title Too Long',
            description: 'Title tags exceeding 60 characters',
          },
          short_content: {
            label: 'Thin Content',
            description: 'Pages with less than 300 words',
          },
        };

        const issues = issueResult.rows.map((row) => ({
          type: row.issue_type,
          count: parseInt(row.count),
          severity: row.severity,
          label: issueLabels[row.issue_type]?.label || row.issue_type,
          description: issueLabels[row.issue_type]?.description || '',
        }));

        const response = {
          projectId,
          projectName: project.name,
          kpis: {
            totalPages,
            pagesWithIssues,
            noindexPages,
            errorPages4xx: error4xx,
            errorPages5xx: error5xx,
            healthyPages: totalPages - pagesWithIssues - error4xx - error5xx,
            avgLoadTime: Math.round(parseFloat(pageStats.avg_load_time) || 0),
            lastCrawlDate: crawlJob?.completed_at || null,
          },
          statusCodes,
          issues,
          crawlStatus: crawlJob?.status || 'not_started',
          crawlProgress: crawlJob?.progress || 0,
        };

        return reply.send(response);
      } catch (error) {
        fastify.log.error({ error }, 'Error fetching crawl summary');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

export default registerCrawlSummaryRoutes;
