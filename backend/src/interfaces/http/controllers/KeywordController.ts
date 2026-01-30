/**
 * Keyword Controller
 *
 * REST API endpoints for keyword research and rankings
 * Following AI_SEO_TOOL_PROMPT_BOOK.md - Module 1
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresKeywordRankingsRepository } from '../../../infrastructure/repositories/PostgresKeywordRankingsRepository';

export class KeywordController {
  constructor(private readonly keywordRepo: PostgresKeywordRankingsRepository) {}

  /**
   * Register routes with Fastify
   */
  registerRoutes(app: FastifyInstance): void {
    // Get keyword overview
    app.get<{
      Params: { id: string };
    }>('/projects/:id/keywords/overview', this.getKeywordOverview.bind(this));

    // Get keyword list
    app.get<{
      Params: { id: string };
      Querystring: { limit?: number };
    }>('/projects/:id/keywords', this.getKeywords.bind(this));

    // Trigger keyword research crawl
    app.post<{
      Params: { id: string };
      Body: { keywords?: string[]; maxKeywords?: number };
    }>('/projects/:id/keywords/crawl', this.triggerKeywordCrawl.bind(this));
  }

  /**
   * GET /projects/:id/keywords/overview
   * Get keyword overview statistics
   */
  private async getKeywordOverview(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;

    // Handle "default" projectId - map to VIB Main Website project
    const actualProjectId = projectId === 'default' 
      ? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
      : projectId;

    try {
      const overview = await this.keywordRepo.getKeywordOverview(actualProjectId);
      
      // Transform to frontend expected format
      return {
        kpis: {
          totalKeywords: overview.totalKeywords,
          totalKeywordsChange: overview.totalKeywordsChange,
          highOpportunityKeywords: overview.highOpportunityKeywords,
          highOpportunityChange: overview.highOpportunityChange,
          transactionalKeywords: overview.transactionalKeywords,
          transactionalChange: overview.transactionalChange,
          unmappedKeywords: overview.unmappedKeywords,
          unmappedChange: overview.unmappedChange,
          avgSearchVolume: overview.avgSearchVolume || 0,
          avgDifficulty: overview.avgDifficulty,
          totalSearchVolume: overview.totalSearchVolume || 0,
          lastUpdated: new Date().toISOString(),
        },
        charts: {
          searchVolumeDistribution: [], // TODO: implement
          difficultyDistribution: [], // TODO: implement
          intentDistribution: [], // TODO: implement
          topOpportunities: [], // TODO: implement
        },
      };
    } catch (error) {
      console.error('[KeywordController] Get keyword overview error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }

  /**
   * GET /projects/:id/keywords
   * Get keyword list with rankings
   */
  private async getKeywords(
    request: FastifyRequest<{ 
      Params: { id: string }; 
      Querystring: { 
        limit?: number;
        page?: number;
        pageSize?: number;
        sortField?: string;
        sortDirection?: string;
        search?: string;
        intent?: string;
        difficulty?: string;
        opportunity?: string;
        mapped?: string;
      } 
    }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    const {
      page = 1,
      pageSize = 20,
      sortField = 'searchVolume',
      sortDirection = 'desc',
      search,
      intent,
      difficulty,
      opportunity,
      mapped,
    } = request.query;

    // Handle "default" projectId - map to VIB Main Website project
    const actualProjectId = projectId === 'default' 
      ? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
      : projectId;

    try {
      // For now, get all keywords and apply filtering/sorting/pagination in memory
      // TODO: Implement proper database-level filtering and sorting
      let allKeywords = await this.keywordRepo.getKeywords(actualProjectId, 1000); // Get more to allow filtering
      
      // Apply search filter
      if (search) {
        allKeywords = allKeywords.filter(k => 
          k.keyword.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      // Apply intent filter
      if (intent && intent !== 'all') {
        allKeywords = allKeywords.filter(k => k.intent === intent);
      }
      
      // Apply difficulty filter
      if (difficulty && difficulty !== 'all') {
        allKeywords = allKeywords.filter(k => k.difficultyLevel === difficulty);
      }
      
      // Apply opportunity filter
      if (opportunity && opportunity !== 'all') {
        allKeywords = allKeywords.filter(k => k.opportunity === opportunity);
      }
      
      // Apply mapped filter
      if (mapped && mapped !== 'all') {
        const isMapped = mapped === 'mapped';
        allKeywords = allKeywords.filter(k => 
          isMapped ? k.mappedUrl !== null : k.mappedUrl === null
        );
      }
      
      // Apply sorting
      allKeywords.sort((a, b) => {
        let aValue: any = a[sortField as keyof typeof a];
        let bValue: any = b[sortField as keyof typeof b];
        
        // Handle null values
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        
        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        
        // Handle numeric comparison
        const numComparison = aValue - bValue;
        return sortDirection === 'asc' ? numComparison : -numComparison;
      });
      
      // Apply pagination
      const total = allKeywords.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedKeywords = allKeywords.slice(startIndex, endIndex);
      
      // Transform field names from snake_case to camelCase for frontend
      const transformedKeywords = paginatedKeywords.map(keyword => ({
        id: keyword.id,
        keyword: keyword.keyword,
        searchVolume: keyword.search_volume,
        difficulty: keyword.difficulty,
        difficultyLevel: keyword.difficultyLevel,
        intent: keyword.intent,
        opportunity: keyword.opportunity,
        currentRank: keyword.currentRank,
        previousRank: keyword.previousRank,
        rankChange: keyword.rankChange,
        trend: keyword.trend,
        clusterId: keyword.clusterId,
        clusterName: keyword.clusterName,
        mappedUrl: keyword.mappedUrl,
        cpc: keyword.cpc,
        lastUpdated: keyword.lastUpdated,
      }));
      
      return {
        keywords: transformedKeywords,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error('[KeywordController] Get keywords error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }

  /**
   * POST /projects/:id/keywords/crawl
   * Trigger keyword research crawl
   */
  private async triggerKeywordCrawl(
    request: FastifyRequest<{ Params: { id: string }; Body: { keywords?: string[]; maxKeywords?: number } }>,
    reply: FastifyReply
  ): Promise<unknown> {
    const { id: projectId } = request.params;
    const { keywords = [], maxKeywords = 50 } = request.body || {};

    // Handle "default" projectId - map to VIB Main Website project
    const actualProjectId = projectId === 'default' 
      ? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 
      : projectId;

    try {
      // For now, generate some sample keyword data
      // In production, this would trigger the Keyword Intelligence Agent
      const sampleKeywords = this.generateSampleKeywords(keywords, maxKeywords);

      await this.keywordRepo.saveKeywordRankings(actualProjectId, sampleKeywords);

      return {
        success: true,
        message: `Keyword research completed. Added ${sampleKeywords.length} keywords.`,
        keywordsAdded: sampleKeywords.length,
      };
    } catch (error) {
      console.error('[KeywordController] Trigger keyword crawl error:', error);
      reply.status(500);
      return { error: error instanceof Error ? error.message : 'Internal server error' };
    }
  }

  /**
   * Generate sample keyword data for testing
   * In production, this would come from the Keyword Intelligence Agent
   */
  private generateSampleKeywords(seedKeywords: string[], maxKeywords: number): any[] {
    const baseKeywords = seedKeywords.length > 0 ? seedKeywords : [
      'lãi suất ngân hàng',
      'thẻ tín dụng',
      'vay tín chấp',
      'bảo hiểm nhân thọ',
      'đầu tư chứng khoán',
      'mở tài khoản ngân hàng',
      'chuyển tiền online',
      'thẻ ghi nợ',
      'vay mua nhà',
      'tiết kiệm ngân hàng',
    ];

    const keywords = [];
    const intents = ['informational', 'transactional', 'commercial', 'navigational'];
    const difficulties = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

    for (let i = 0; i < Math.min(maxKeywords, baseKeywords.length * 3); i++) {
      const baseKeyword = baseKeywords[i % baseKeywords.length];
      const variation = i < baseKeywords.length ? '' : ` ${['online', '2024', 'hướng dẫn', 'so sánh'][i % 4]}`;

      keywords.push({
        keyword: baseKeyword + variation,
        search_volume: Math.floor(Math.random() * 10000) + 100,
        current_position: Math.floor(Math.random() * 50) + 1,
        previous_position: Math.floor(Math.random() * 50) + 1,
        best_position: Math.floor(Math.random() * 20) + 1,
        url: `https://www.vib.com.vn/vn/${baseKeyword.replace(/\s+/g, '-')}`,
        intent: intents[Math.floor(Math.random() * intents.length)],
        difficulty: difficulties[Math.floor(Math.random() * difficulties.length)],
        is_tracked: true,
      });
    }

    return keywords;
  }
}
