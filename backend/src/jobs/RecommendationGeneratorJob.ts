/**
 * Recommendation Generator Job v1.0
 * 
 * Scheduled job that automatically generates SEO recommendations
 * by analyzing data from various sources.
 * 
 * Sources:
 * - CWV Results → Technical recommendations
 * - Crawl Results → Technical/Content recommendations  
 * - GSC Analytics → Keyword recommendations
 * - Traffic Metrics → Monitoring recommendations
 * 
 * Schedule: Runs daily at 6:00 AM (configurable)
 */

import { Pool } from 'pg';
import { Logger } from '../shared/Logger';
import { PostgresSEOMetricsRepository, SEORecommendation } from '../infrastructure/repositories/PostgresSEOMetricsRepository';

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratorConfig {
  enabled: boolean;
  projectIds?: string[]; // If empty, process all active projects
  maxRecommendationsPerProject: number;
  cleanupOldDays: number; // Delete pending recommendations older than this
}

export interface GenerationResult {
  projectId: string;
  projectName: string;
  generated: number;
  skipped: number;
  deleted: number;
  errors: string[];
  duration: number;
}

interface KeywordOpportunity {
  keyword: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  potential: 'high' | 'medium' | 'low';
}

// =============================================================================
// RECOMMENDATION GENERATOR
// =============================================================================

export class RecommendationGeneratorJob {
  private readonly logger: Logger;
  private readonly pool: Pool;
  private readonly metricsRepo: PostgresSEOMetricsRepository;
  private readonly config: GeneratorConfig;

  constructor(pool: Pool, config?: Partial<GeneratorConfig>) {
    this.logger = new Logger('RecommendationGeneratorJob');
    this.pool = pool;
    this.metricsRepo = new PostgresSEOMetricsRepository(pool);
    this.config = {
      enabled: true,
      maxRecommendationsPerProject: 20,
      cleanupOldDays: 30,
      ...config,
    };
  }

  // ===========================================================================
  // MAIN EXECUTION
  // ===========================================================================

  async run(): Promise<GenerationResult[]> {
    if (!this.config.enabled) {
      this.logger.info('Recommendation generator is disabled');
      return [];
    }

    const startTime = Date.now();
    this.logger.info('Starting recommendation generation job');

    const results: GenerationResult[] = [];

    try {
      // Get projects to process
      const projects = await this.getProjectsToProcess();
      this.logger.info(`Processing ${projects.length} projects`);

      for (const project of projects) {
        const result = await this.processProject(project);
        results.push(result);
      }

      const totalDuration = Date.now() - startTime;
      const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
      
      this.logger.info('Recommendation generation job completed', {
        projects: results.length,
        totalGenerated,
        totalDuration,
      });

      return results;
    } catch (error: any) {
      this.logger.error('Recommendation generation job failed', { error: error.message });
      throw error;
    }
  }

  // ===========================================================================
  // PROJECT PROCESSING
  // ===========================================================================

  private async getProjectsToProcess(): Promise<{ id: string; name: string; domain: string }[]> {
    // If specific project IDs are configured, use those
    if (this.config.projectIds && this.config.projectIds.length > 0) {
      const placeholders = this.config.projectIds.map((_, i) => `$${i + 1}`).join(', ');
      const query = `SELECT id, name, domain FROM projects WHERE id IN (${placeholders}) AND status = 'active'`;
      const result = await this.pool.query(query, this.config.projectIds);
      return result.rows;
    }

    // Otherwise, get all active projects
    const query = `SELECT id, name, domain FROM projects WHERE status = 'active'`;
    const result = await this.pool.query(query);
    return result.rows;
  }

  private async processProject(project: { id: string; name: string; domain: string }): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      projectId: project.id,
      projectName: project.name,
      generated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
      duration: 0,
    };

    this.logger.info(`Processing project: ${project.name}`, { projectId: project.id });

    try {
      // 1. Cleanup old recommendations
      result.deleted = await this.cleanupOldRecommendations(project.id);

      // 2. Generate recommendations from different sources
      const allRecommendations: Omit<SEORecommendation, 'id' | 'createdAt'>[] = [];

      // CWV-based recommendations
      const cwvRecs = await this.generateCWVRecommendations(project.id);
      allRecommendations.push(...cwvRecs);

      // Crawl-based recommendations
      const crawlRecs = await this.generateCrawlRecommendations(project.id);
      allRecommendations.push(...crawlRecs);

      // Keyword opportunity recommendations
      const keywordRecs = await this.generateKeywordRecommendations(project.id);
      allRecommendations.push(...keywordRecs);

      // Traffic anomaly recommendations
      const trafficRecs = await this.generateTrafficRecommendations(project.id);
      allRecommendations.push(...trafficRecs);

      // 3. Deduplicate and limit
      const existingRecs = await this.metricsRepo.getRecommendations(project.id, { status: 'pending' });
      const existingTitles = new Set(existingRecs.map(r => r.title.toLowerCase()));

      const uniqueRecs = allRecommendations.filter(rec => {
        if (existingTitles.has(rec.title.toLowerCase())) {
          result.skipped++;
          return false;
        }
        existingTitles.add(rec.title.toLowerCase());
        return true;
      });

      // Limit total recommendations
      const limitedRecs = uniqueRecs.slice(0, this.config.maxRecommendationsPerProject);
      result.skipped += uniqueRecs.length - limitedRecs.length;

      // 4. Save to database
      if (limitedRecs.length > 0) {
        await this.metricsRepo.createRecommendations(limitedRecs);
        result.generated = limitedRecs.length;
      }

    } catch (error: any) {
      result.errors.push(error.message);
      this.logger.error(`Failed to process project ${project.name}`, { error: error.message });
    }

    result.duration = Date.now() - startTime;
    this.logger.info(`Project ${project.name} processed`, { 
      generated: result.generated, 
      skipped: result.skipped, 
      deleted: result.deleted,
      duration: result.duration 
    });
    return result;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  private async cleanupOldRecommendations(projectId: string): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupOldDays);

    return this.metricsRepo.deleteRecommendations(projectId, {
      olderThan: cutoffDate,
    });
  }

  // ===========================================================================
  // CWV RECOMMENDATIONS
  // ===========================================================================

  private async generateCWVRecommendations(projectId: string): Promise<Omit<SEORecommendation, 'id' | 'createdAt'>[]> {
    const recommendations: Omit<SEORecommendation, 'id' | 'createdAt'>[] = [];

    try {
      // Get latest CWV results - using actual table schema
      const query = `
        SELECT 
          url,
          device,
          lcp_value, lcp_status,
          cls_value, cls_status,
          inp_value, inp_status,
          fcp_value, fcp_status,
          ttfb_value, ttfb_status,
          performance_score,
          overall_status,
          created_at
        FROM cwv_results 
        WHERE project_id = $1 
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
      `;
      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length === 0) return recommendations;

      // Aggregate CWV issues by metric
      const lcpPoor: { url: string; value: number }[] = [];
      const lcpNeedsImprovement: { url: string; value: number }[] = [];
      const clsPoor: { url: string; value: number }[] = [];
      const clsNeedsImprovement: { url: string; value: number }[] = [];
      const inpPoor: { url: string; value: number }[] = [];
      const ttfbPoor: { url: string; value: number }[] = [];

      for (const row of result.rows) {
        // LCP analysis
        if (row.lcp_status === 'poor') {
          lcpPoor.push({ url: row.url, value: parseFloat(row.lcp_value) });
        } else if (row.lcp_status === 'needs_improvement') {
          lcpNeedsImprovement.push({ url: row.url, value: parseFloat(row.lcp_value) });
        }

        // CLS analysis
        if (row.cls_status === 'poor') {
          clsPoor.push({ url: row.url, value: parseFloat(row.cls_value) });
        } else if (row.cls_status === 'needs_improvement') {
          clsNeedsImprovement.push({ url: row.url, value: parseFloat(row.cls_value) });
        }

        // INP analysis
        if (row.inp_status === 'poor' && row.inp_value) {
          inpPoor.push({ url: row.url, value: parseFloat(row.inp_value) });
        }

        // TTFB analysis
        if (row.ttfb_status === 'poor') {
          ttfbPoor.push({ url: row.url, value: parseFloat(row.ttfb_value) });
        }
      }

      // Generate LCP recommendations
      if (lcpPoor.length > 0) {
        const avgLCP = lcpPoor.reduce((sum, d) => sum + d.value, 0) / lcpPoor.length;
        recommendations.push({
          projectId,
          category: 'technical',
          priority: 'critical',
          title: `Cải thiện LCP - ${lcpPoor.length} trang có điểm kém`,
          description: `Largest Contentful Paint trung bình là ${avgLCP.toFixed(0)}ms (ngưỡng: 2500ms). ${lcpPoor.length} trang cần được tối ưu hình ảnh, font, và critical rendering path.`,
          impact: 'high',
          effort: 'medium',
          status: 'pending',
          autoExecutable: false,
          actionData: {
            source: 'cwv_analysis',
            metric: 'LCP',
            avgValue: avgLCP,
            threshold: 2500,
            poorCount: lcpPoor.length,
            affectedUrls: lcpPoor.slice(0, 5).map(d => d.url),
            suggestions: [
              'Optimize and compress images (WebP format)',
              'Preload critical resources',
              'Use lazy loading for below-fold images',
              'Minimize render-blocking CSS/JS',
            ],
          },
        });
      } else if (lcpNeedsImprovement.length > 2) {
        recommendations.push({
          projectId,
          category: 'technical',
          priority: 'high',
          title: `Tối ưu LCP cho ${lcpNeedsImprovement.length} trang`,
          description: `Có ${lcpNeedsImprovement.length} trang cần cải thiện LCP. Nên tối ưu để đạt rating "Good" (<2.5s).`,
          impact: 'medium',
          effort: 'medium',
          status: 'pending',
          autoExecutable: false,
          actionData: {
            source: 'cwv_analysis',
            metric: 'LCP',
            needsImprovementCount: lcpNeedsImprovement.length,
            affectedUrls: lcpNeedsImprovement.slice(0, 5).map(d => d.url),
          },
        });
      }

      // Generate CLS recommendations
      if (clsPoor.length > 0) {
        const avgCLS = clsPoor.reduce((sum, d) => sum + d.value, 0) / clsPoor.length;
        recommendations.push({
          projectId,
          category: 'technical',
          priority: 'critical',
          title: `Cải thiện CLS - ${clsPoor.length} trang có layout shift cao`,
          description: `Cumulative Layout Shift trung bình là ${avgCLS.toFixed(3)} (ngưỡng: 0.1). Cần set kích thước cố định cho images/ads và tránh inject content động.`,
          impact: 'high',
          effort: 'low',
          status: 'pending',
          autoExecutable: false,
          actionData: {
            source: 'cwv_analysis',
            metric: 'CLS',
            avgValue: avgCLS,
            threshold: 0.1,
            poorCount: clsPoor.length,
            affectedUrls: clsPoor.slice(0, 5).map(d => d.url),
            suggestions: [
              'Set explicit dimensions for images and videos',
              'Reserve space for ads and embeds',
              'Avoid inserting content above existing content',
              'Use CSS transform for animations',
            ],
          },
        });
      }

      // Generate INP recommendations
      if (inpPoor.length > 0) {
        const avgINP = inpPoor.reduce((sum, d) => sum + d.value, 0) / inpPoor.length;
        recommendations.push({
          projectId,
          category: 'technical',
          priority: 'high',
          title: `Cải thiện INP - ${inpPoor.length} trang phản hồi chậm`,
          description: `Interaction to Next Paint trung bình là ${avgINP.toFixed(0)}ms (ngưỡng: 200ms). Cần tối ưu JavaScript execution và event handlers.`,
          impact: 'high',
          effort: 'high',
          status: 'pending',
          autoExecutable: false,
          actionData: {
            source: 'cwv_analysis',
            metric: 'INP',
            avgValue: avgINP,
            threshold: 200,
            poorCount: inpPoor.length,
            affectedUrls: inpPoor.slice(0, 5).map(d => d.url),
            suggestions: [
              'Optimize event handlers',
              'Break up long JavaScript tasks',
              'Use requestIdleCallback for non-urgent work',
              'Minimize JavaScript execution time',
            ],
          },
        });
      }

      // Generate TTFB recommendations
      if (ttfbPoor.length > 0) {
        const avgTTFB = ttfbPoor.reduce((sum, d) => sum + d.value, 0) / ttfbPoor.length;
        recommendations.push({
          projectId,
          category: 'technical',
          priority: 'medium',
          title: `Cải thiện TTFB - ${ttfbPoor.length} trang có server response chậm`,
          description: `Time to First Byte trung bình là ${avgTTFB.toFixed(0)}ms (ngưỡng: 800ms). Cần tối ưu server response time và caching.`,
          impact: 'medium',
          effort: 'medium',
          status: 'pending',
          autoExecutable: false,
          actionData: {
            source: 'cwv_analysis',
            metric: 'TTFB',
            avgValue: avgTTFB,
            threshold: 800,
            poorCount: ttfbPoor.length,
            affectedUrls: ttfbPoor.slice(0, 5).map(d => d.url),
            suggestions: [
              'Optimize server-side code',
              'Use CDN for static assets',
              'Enable server-side caching',
              'Optimize database queries',
            ],
          },
        });
      }

    } catch (error: any) {
      this.logger.warn('Failed to generate CWV recommendations', { error: error.message, projectId });
    }

    return recommendations;
  }

  // ===========================================================================
  // CRAWL RECOMMENDATIONS
  // ===========================================================================

  private async generateCrawlRecommendations(projectId: string): Promise<Omit<SEORecommendation, 'id' | 'createdAt'>[]> {
    const recommendations: Omit<SEORecommendation, 'id' | 'createdAt'>[] = [];

    try {
      // Get crawled pages with issues from crawled_pages table
      const query = `
        SELECT 
          url,
          status_code,
          title,
          meta_description,
          h1_tags,
          issues,
          crawled_at
        FROM crawled_pages
        WHERE project_id = $1 
          AND crawled_at > NOW() - INTERVAL '7 days'
        ORDER BY crawled_at DESC
        LIMIT 500
      `;
      
      const result = await this.pool.query(query, [projectId]);

      if (result.rows.length === 0) return recommendations;

      // Analyze issues
      const issueStats: Record<string, { count: number; urls: string[]; severity: string }> = {
        'broken_link': { count: 0, urls: [], severity: 'error' },
        'missing_title': { count: 0, urls: [], severity: 'error' },
        'missing_meta_description': { count: 0, urls: [], severity: 'warning' },
        'missing_h1': { count: 0, urls: [], severity: 'warning' },
        'multiple_h1': { count: 0, urls: [], severity: 'warning' },
        'duplicate_title': { count: 0, urls: [], severity: 'warning' },
        'title_too_long': { count: 0, urls: [], severity: 'notice' },
        'title_too_short': { count: 0, urls: [], severity: 'notice' },
        'meta_description_too_long': { count: 0, urls: [], severity: 'notice' },
        'meta_description_too_short': { count: 0, urls: [], severity: 'notice' },
        'redirect': { count: 0, urls: [], severity: 'warning' },
        'server_error': { count: 0, urls: [], severity: 'critical' },
      };

      for (const row of result.rows) {
        const url = row.url;

        // Check status code
        if (row.status_code === 404) {
          issueStats['broken_link'].count++;
          issueStats['broken_link'].urls.push(url);
        } else if (row.status_code >= 500) {
          issueStats['server_error'].count++;
          issueStats['server_error'].urls.push(url);
        } else if (row.status_code >= 300 && row.status_code < 400) {
          issueStats['redirect'].count++;
          issueStats['redirect'].urls.push(url);
        }

        // Check title
        if (!row.title || row.title.trim() === '') {
          issueStats['missing_title'].count++;
          issueStats['missing_title'].urls.push(url);
        } else if (row.title.length > 60) {
          issueStats['title_too_long'].count++;
          issueStats['title_too_long'].urls.push(url);
        } else if (row.title.length < 30) {
          issueStats['title_too_short'].count++;
          issueStats['title_too_short'].urls.push(url);
        }

        // Check meta description
        if (!row.meta_description || row.meta_description.trim() === '') {
          issueStats['missing_meta_description'].count++;
          issueStats['missing_meta_description'].urls.push(url);
        } else if (row.meta_description.length > 160) {
          issueStats['meta_description_too_long'].count++;
          issueStats['meta_description_too_long'].urls.push(url);
        } else if (row.meta_description.length < 70) {
          issueStats['meta_description_too_short'].count++;
          issueStats['meta_description_too_short'].urls.push(url);
        }

        // Check H1
        const h1Tags = row.h1_tags || [];
        if (h1Tags.length === 0) {
          issueStats['missing_h1'].count++;
          issueStats['missing_h1'].urls.push(url);
        } else if (h1Tags.length > 1) {
          issueStats['multiple_h1'].count++;
          issueStats['multiple_h1'].urls.push(url);
        }

        // Process stored issues from crawl
        const issues = row.issues || [];
        for (const issue of issues) {
          const issueType = issue.type || issue.code;
          if (issueType && issueStats[issueType]) {
            issueStats[issueType].count++;
            if (!issueStats[issueType].urls.includes(url)) {
              issueStats[issueType].urls.push(url);
            }
          }
        }
      }

      // Generate recommendations for significant issues
      for (const [issueType, stats] of Object.entries(issueStats)) {
        if (stats.count === 0) continue;

        const description = this.getCrawlIssueDescription(issueType);
        const category = this.getCrawlIssueCategory(issueType);
        const priority = this.mapSeverityToPriority(stats.severity);

        // Only create recommendation if count is significant
        if (stats.count >= 1 && (stats.severity === 'critical' || stats.severity === 'error')) {
          recommendations.push({
            projectId,
            category,
            priority,
            title: `Fix ${stats.count} ${issueType.replace(/_/g, ' ')} issues`,
            description: `${description}\n\nTìm thấy ${stats.count} URL bị ảnh hưởng.`,
            impact: stats.severity === 'critical' ? 'high' : stats.severity === 'error' ? 'high' : 'medium',
            effort: stats.count > 10 ? 'high' : stats.count > 3 ? 'medium' : 'low',
            status: 'pending',
            autoExecutable: false,
            actionData: {
              source: 'crawler_analysis',
              issueType,
              severity: stats.severity,
              count: stats.count,
              affectedUrls: stats.urls.slice(0, 10),
            },
          });
        } else if (stats.count >= 3 && stats.severity === 'warning') {
          recommendations.push({
            projectId,
            category,
            priority,
            title: `Fix ${stats.count} ${issueType.replace(/_/g, ' ')} issues`,
            description: `${description}\n\nTìm thấy ${stats.count} URL bị ảnh hưởng.`,
            impact: 'medium',
            effort: stats.count > 10 ? 'medium' : 'low',
            status: 'pending',
            autoExecutable: false,
            actionData: {
              source: 'crawler_analysis',
              issueType,
              severity: stats.severity,
              count: stats.count,
              affectedUrls: stats.urls.slice(0, 10),
            },
          });
        } else if (stats.count >= 10 && stats.severity === 'notice') {
          recommendations.push({
            projectId,
            category,
            priority: 'low',
            title: `Optimize ${stats.count} pages: ${issueType.replace(/_/g, ' ')}`,
            description: `${description}\n\nTìm thấy ${stats.count} URL cần tối ưu.`,
            impact: 'low',
            effort: 'low',
            status: 'pending',
            autoExecutable: false,
            actionData: {
              source: 'crawler_analysis',
              issueType,
              severity: stats.severity,
              count: stats.count,
              affectedUrls: stats.urls.slice(0, 10),
            },
          });
        }
      }
    } catch (error: any) {
      this.logger.warn('Failed to generate crawl recommendations', { error: error.message, projectId });
    }

    return recommendations;
  }

  private getCrawlIssueDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'broken_link': 'Internal links pointing to 404 pages. These harm user experience and waste crawl budget.',
      'missing_meta_title': 'Pages without meta title. This impacts CTR and rankings.',
      'missing_meta_description': 'Pages without meta description. This affects CTR in search results.',
      'duplicate_title': 'Multiple pages with the same title. This causes keyword cannibalization.',
      'duplicate_content': 'Significant duplicate content detected. Consider canonical tags or content consolidation.',
      'missing_h1': 'Pages without H1 heading. H1 is important for SEO and accessibility.',
      'multiple_h1': 'Pages with multiple H1 tags. Best practice is one H1 per page.',
      'missing_alt_text': 'Images without alt text. This impacts accessibility and image SEO.',
      'redirect_chain': 'Redirect chains detected. Each redirect adds latency and loses link equity.',
      'orphan_page': 'Pages with no internal links pointing to them. These are hard to discover.',
    };
    return descriptions[type] || `Issue type: ${type}`;
  }

  private getCrawlIssueCategory(type: string): 'technical' | 'content' | 'keywords' | 'backlinks' | 'ux' {
    const categories: Record<string, 'technical' | 'content' | 'keywords' | 'backlinks' | 'ux'> = {
      'broken_link': 'technical',
      'missing_title': 'content',
      'missing_meta_description': 'content',
      'duplicate_title': 'content',
      'duplicate_content': 'content',
      'missing_h1': 'content',
      'multiple_h1': 'content',
      'missing_alt_text': 'content',
      'redirect': 'technical',
      'redirect_chain': 'technical',
      'orphan_page': 'technical',
      'server_error': 'technical',
      'title_too_long': 'content',
      'title_too_short': 'content',
      'meta_description_too_long': 'content',
      'meta_description_too_short': 'content',
    };
    return categories[type] || 'technical';
  }

  private mapSeverityToPriority(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    const mapping: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      'critical': 'critical',
      'error': 'high',
      'warning': 'medium',
      'notice': 'low',
    };
    return mapping[severity] || 'medium';
  }

  // ===========================================================================
  // KEYWORD RECOMMENDATIONS
  // ===========================================================================

  private async generateKeywordRecommendations(projectId: string): Promise<Omit<SEORecommendation, 'id' | 'createdAt'>[]> {
    const recommendations: Omit<SEORecommendation, 'id' | 'createdAt'>[] = [];

    try {
      // Find keywords with high impressions but low CTR (opportunity)
      const query = `
        SELECT 
          query as keyword,
          AVG(position) as avg_position,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          AVG(ctr) as avg_ctr
        FROM gsc_search_analytics
        WHERE project_id = $1
          AND date > NOW() - INTERVAL '30 days'
        GROUP BY query
        HAVING SUM(impressions) > 100
        ORDER BY SUM(impressions) DESC
        LIMIT 50
      `;

      const result = await this.pool.query(query, [projectId]);

      for (const row of result.rows) {
        const opportunity: KeywordOpportunity = {
          keyword: row.keyword,
          position: parseFloat(row.avg_position),
          impressions: parseInt(row.total_impressions),
          clicks: parseInt(row.total_clicks),
          ctr: parseFloat(row.avg_ctr),
          potential: this.assessKeywordPotential(row),
        };

        // High impressions but low CTR - title/description optimization opportunity
        if (opportunity.impressions > 500 && opportunity.ctr < 0.02 && opportunity.position < 20) {
          recommendations.push({
            projectId,
            category: 'keywords',
            priority: opportunity.impressions > 2000 ? 'high' : 'medium',
            title: `Cải thiện CTR cho "${opportunity.keyword}"`,
            description: `Từ khóa có ${opportunity.impressions.toLocaleString()} impressions nhưng CTR chỉ ${(opportunity.ctr * 100).toFixed(2)}%. Cần tối ưu title và meta description để tăng CTR.`,
            impact: opportunity.impressions > 2000 ? 'high' : 'medium',
            effort: 'low',
            status: 'pending',
            autoExecutable: false,
            actionData: {
              source: 'keyword_analysis',
              keyword: opportunity.keyword,
              currentPosition: opportunity.position,
              impressions: opportunity.impressions,
              currentCTR: opportunity.ctr,
              targetCTR: 0.05,
              estimatedClickGain: Math.round(opportunity.impressions * 0.03),
            },
          });
        }

        // Position 4-10 - opportunity to reach top 3
        if (opportunity.position >= 4 && opportunity.position <= 10 && opportunity.impressions > 300) {
          recommendations.push({
            projectId,
            category: 'keywords',
            priority: opportunity.impressions > 1000 ? 'high' : 'medium',
            title: `Đưa "${opportunity.keyword}" lên Top 3`,
            description: `Hiện rank #${opportunity.position.toFixed(0)}, có ${opportunity.impressions.toLocaleString()} impressions/tháng. Có thể đạt top 3 bằng cách cải thiện content và internal linking.`,
            impact: 'high',
            effort: 'medium',
            status: 'pending',
            autoExecutable: false,
            actionData: {
              source: 'keyword_analysis',
              keyword: opportunity.keyword,
              currentPosition: opportunity.position,
              targetPosition: 3,
              impressions: opportunity.impressions,
              estimatedTrafficGain: Math.round(opportunity.impressions * 0.15),
            },
          });
        }

        // Position 11-20 - quick win to page 1
        if (opportunity.position >= 11 && opportunity.position <= 20 && opportunity.impressions > 200) {
          recommendations.push({
            projectId,
            category: 'keywords',
            priority: 'medium',
            title: `Đưa "${opportunity.keyword}" lên trang 1`,
            description: `Hiện rank #${opportunity.position.toFixed(0)} (trang 2). Có thể lên trang 1 với một số cải thiện nhỏ về content và backlinks.`,
            impact: 'medium',
            effort: 'medium',
            status: 'pending',
            autoExecutable: false,
            actionData: {
              source: 'keyword_analysis',
              keyword: opportunity.keyword,
              currentPosition: opportunity.position,
              targetPosition: 10,
              impressions: opportunity.impressions,
            },
          });
        }
      }
    } catch (error: any) {
      this.logger.warn('Failed to generate keyword recommendations', { error: error.message, projectId });
    }

    // Limit keyword recommendations
    return recommendations.slice(0, 5);
  }

  private assessKeywordPotential(row: any): 'high' | 'medium' | 'low' {
    const impressions = parseInt(row.total_impressions);
    const position = parseFloat(row.avg_position);
    
    if (impressions > 1000 && position < 20) return 'high';
    if (impressions > 300 && position < 30) return 'medium';
    return 'low';
  }

  // ===========================================================================
  // TRAFFIC RECOMMENDATIONS
  // ===========================================================================

  private async generateTrafficRecommendations(projectId: string): Promise<Omit<SEORecommendation, 'id' | 'createdAt'>[]> {
    const recommendations: Omit<SEORecommendation, 'id' | 'createdAt'>[] = [];

    try {
      // Compare recent traffic with previous period
      const query = `
        SELECT 
          SUM(CASE WHEN date > NOW() - INTERVAL '7 days' THEN organic_traffic ELSE 0 END) as recent_traffic,
          SUM(CASE WHEN date <= NOW() - INTERVAL '7 days' AND date > NOW() - INTERVAL '14 days' THEN organic_traffic ELSE 0 END) as previous_traffic
        FROM seo_traffic_metrics
        WHERE project_id = $1
          AND date > NOW() - INTERVAL '14 days'
      `;

      const result = await this.pool.query(query, [projectId]);
      
      if (result.rows.length > 0) {
        const recent = parseInt(result.rows[0].recent_traffic) || 0;
        const previous = parseInt(result.rows[0].previous_traffic) || 0;

        if (previous > 0) {
          const changePercent = ((recent - previous) / previous) * 100;

          // Significant traffic drop
          if (changePercent < -10) {
            recommendations.push({
              projectId,
              category: 'technical',
              priority: changePercent < -20 ? 'critical' : 'high',
              title: `Cảnh báo: Traffic giảm ${Math.abs(changePercent).toFixed(1)}% trong 7 ngày qua`,
              description: `Organic traffic giảm từ ${previous.toLocaleString()} xuống ${recent.toLocaleString()}. Cần kiểm tra: ranking changes, technical issues, algorithm updates.`,
              impact: 'high',
              effort: 'medium',
              status: 'pending',
              autoExecutable: false,
              actionData: {
                source: 'traffic_analysis',
                alertType: 'traffic_drop',
                recentTraffic: recent,
                previousTraffic: previous,
                changePercent,
                suggestedActions: [
                  'Check GSC for ranking drops',
                  'Review recent site changes',
                  'Check for crawl errors',
                  'Monitor competitor activities',
                ],
              },
            });
          }

          // Traffic growth opportunity
          if (changePercent > 15) {
            recommendations.push({
              projectId,
              category: 'keywords',
              priority: 'medium',
              title: `Traffic tăng ${changePercent.toFixed(1)}% - Cơ hội mở rộng`,
              description: `Traffic đang tăng tốt. Đây là thời điểm tốt để mở rộng content và target thêm keywords liên quan.`,
              impact: 'medium',
              effort: 'medium',
              status: 'pending',
              autoExecutable: false,
              actionData: {
                source: 'traffic_analysis',
                alertType: 'traffic_growth',
                recentTraffic: recent,
                previousTraffic: previous,
                changePercent,
                suggestedActions: [
                  'Identify growing keywords',
                  'Create supporting content',
                  'Expand internal linking',
                ],
              },
            });
          }
        }
      }
    } catch (error: any) {
      this.logger.warn('Failed to generate traffic recommendations', { error: error.message, projectId });
    }

    return recommendations;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createRecommendationGeneratorJob(
  pool: Pool,
  config?: Partial<GeneratorConfig>
): RecommendationGeneratorJob {
  return new RecommendationGeneratorJob(pool, config);
}
