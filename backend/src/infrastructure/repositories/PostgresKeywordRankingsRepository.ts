/**
 * Postgres Keyword Rankings Repository
 *
 * Repository for accessing keyword rankings data from database
 * Following crawl-centric data architecture from AI_SEO_TOOL_PROMPT_BOOK.md
 */

import { Pool } from 'pg';
import { Logger } from '../../shared/Logger';

export interface KeywordRanking {
  id: string;
  project_id: string;
  keyword: string;
  search_volume?: number;
  current_position?: number;
  previous_position?: number;
  best_position?: number;
  url?: string;
  intent?: string;
  difficulty?: number;
  is_tracked: boolean;
  last_updated: string;
  created_at: string;
}

export interface KeywordOverview {
  totalKeywords: number;
  totalKeywordsChange: number;
  highOpportunityKeywords: number;
  highOpportunityChange: number;
  transactionalKeywords: number;
  transactionalChange: number;
  unmappedKeywords: number;
  unmappedChange: number;
  avgPosition: number;
  avgPositionChange: number;
  avgDifficulty: number;
  avgDifficultyChange: number;
  avgSearchVolume: number;
  avgSearchVolumeChange: number;
  totalSearchVolume: number;
  totalSearchVolumeChange: number;
}

export class PostgresKeywordRankingsRepository {
  private readonly logger: Logger;

  constructor(private readonly pool: Pool) {
    this.logger = new Logger('PostgresKeywordRankingsRepository');
  }

  /**
   * Get keyword overview for a project
   */
  async getKeywordOverview(projectId: string): Promise<KeywordOverview> {
    try {
      this.logger.info('Getting keyword overview', { projectId });

      // Get current keyword stats
      const currentQuery = `
        SELECT
          COUNT(*) as total_keywords,
          COUNT(*) FILTER (WHERE search_volume > 1000 AND difficulty < 50) as high_opportunity,
          COUNT(*) FILTER (WHERE intent = 'transactional') as transactional,
          COUNT(*) FILTER (WHERE current_position IS NULL) as unmapped,
          AVG(current_position) as avg_position,
          AVG(difficulty) as avg_difficulty,
          AVG(search_volume) as avg_search_volume,
          SUM(search_volume) as total_search_volume
        FROM seo_keyword_rankings
        WHERE project_id = $1 AND is_tracked = true
      `;
      const currentResult = await this.pool.query(currentQuery, [projectId]);
      const current = currentResult.rows[0];

      // Get previous period stats (last 30 days)
      const previousQuery = `
        SELECT
          COUNT(*) as total_keywords,
          COUNT(*) FILTER (WHERE search_volume > 1000 AND difficulty < 50) as high_opportunity,
          COUNT(*) FILTER (WHERE intent = 'transactional') as transactional,
          COUNT(*) FILTER (WHERE current_position IS NULL) as unmapped,
          AVG(current_position) as avg_position,
          AVG(difficulty) as avg_difficulty,
          AVG(search_volume) as avg_search_volume,
          SUM(search_volume) as total_search_volume
        FROM seo_keyword_rankings
        WHERE project_id = $1 AND is_tracked = true
          AND last_updated < NOW() - INTERVAL '30 days'
      `;
      const previousResult = await this.pool.query(previousQuery, [projectId]);
      const previous = previousResult.rows[0];

      // Calculate changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        totalKeywords: parseInt(current.total_keywords) || 0,
        totalKeywordsChange: calculateChange(
          parseInt(current.total_keywords) || 0,
          parseInt(previous.total_keywords) || 0
        ),
        highOpportunityKeywords: parseInt(current.high_opportunity) || 0,
        highOpportunityChange: calculateChange(
          parseInt(current.high_opportunity) || 0,
          parseInt(previous.high_opportunity) || 0
        ),
        transactionalKeywords: parseInt(current.transactional) || 0,
        transactionalChange: calculateChange(
          parseInt(current.transactional) || 0,
          parseInt(previous.transactional) || 0
        ),
        unmappedKeywords: parseInt(current.unmapped) || 0,
        unmappedChange: calculateChange(
          parseInt(current.unmapped) || 0,
          parseInt(previous.unmapped) || 0
        ),
        avgPosition: Math.round(parseFloat(current.avg_position) || 0),
        avgPositionChange: calculateChange(
          parseFloat(current.avg_position) || 0,
          parseFloat(previous.avg_position) || 0
        ),
        avgDifficulty: Math.round(parseFloat(current.avg_difficulty) || 0),
        avgDifficultyChange: calculateChange(
          parseFloat(current.avg_difficulty) || 0,
          parseFloat(previous.avg_difficulty) || 0
        ),
        avgSearchVolume: Math.round(parseFloat(current.avg_search_volume) || 0),
        avgSearchVolumeChange: calculateChange(
          parseFloat(current.avg_search_volume) || 0,
          parseFloat(previous.avg_search_volume) || 0
        ),
        totalSearchVolume: Math.round(parseFloat(current.total_search_volume) || 0),
        totalSearchVolumeChange: calculateChange(
          parseFloat(current.total_search_volume) || 0,
          parseFloat(previous.total_search_volume) || 0
        ),
      };
    } catch (error) {
      this.logger.error('Error getting keyword overview', { error, projectId });
      throw error;
    }
  }

  /**
   * Get all keywords for a project
   */
  async getKeywords(projectId: string, limit = 100): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM seo_keyword_rankings
        WHERE project_id = $1 AND is_tracked = true
        ORDER BY search_volume DESC NULLS LAST, keyword ASC
        LIMIT $2
      `;
      const result = await this.pool.query(query, [projectId, limit]);
      
      // Add evaluation fields to each keyword
      return result.rows.map(keyword => this.evaluateKeyword(keyword));
    } catch (error) {
      this.logger.error('Error getting keywords', { error, projectId });
      throw error;
    }
  }

  /**
   * Save or update keyword rankings
   */
  async saveKeywordRankings(projectId: string, keywords: Partial<KeywordRanking>[]): Promise<void> {
    try {
      this.logger.info('Saving keyword rankings', { projectId, count: keywords.length });

      for (const keyword of keywords) {
        const query = `
          INSERT INTO seo_keyword_rankings (
            project_id, keyword, search_volume, current_position,
            previous_position, best_position, url, intent, difficulty, is_tracked
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (project_id, keyword)
          DO UPDATE SET
            search_volume = EXCLUDED.search_volume,
            current_position = EXCLUDED.current_position,
            previous_position = seo_keyword_rankings.current_position,
            best_position = GREATEST(seo_keyword_rankings.best_position, EXCLUDED.best_position),
            url = EXCLUDED.url,
            intent = EXCLUDED.intent,
            difficulty = EXCLUDED.difficulty,
            last_updated = NOW()
        `;
        await this.pool.query(query, [
          projectId,
          keyword.keyword,
          keyword.search_volume,
          keyword.current_position,
          keyword.previous_position,
          keyword.best_position,
          keyword.url,
          keyword.intent,
          keyword.difficulty,
          keyword.is_tracked ?? true,
        ]);
      }

      this.logger.info('Keyword rankings saved successfully', { projectId, count: keywords.length });
    } catch (error) {
      this.logger.error('Error saving keyword rankings', { error, projectId });
      throw error;
    }
  }

  /**
   * Evaluate keyword with derived metrics
   */
  private evaluateKeyword(keyword: KeywordRanking): any {
    const difficulty = parseFloat(keyword.difficulty?.toString() || '0');
    const currentPosition = keyword.current_position || null;
    const previousPosition = keyword.previous_position || null;
    
    // Calculate difficulty level
    let difficultyLevel: string;
    if (difficulty < 30) difficultyLevel = 'easy';
    else if (difficulty < 50) difficultyLevel = 'medium';
    else if (difficulty < 70) difficultyLevel = 'hard';
    else difficultyLevel = 'very_hard';
    
    // Calculate opportunity level
    let opportunity: string;
    const searchVolume = keyword.search_volume || 0;
    if (searchVolume > 1000 && difficulty < 50) opportunity = 'high';
    else if (searchVolume > 100 && difficulty < 70) opportunity = 'medium';
    else opportunity = 'low';
    
    // Calculate rank change
    let rankChange: number | null = null;
    if (currentPosition && previousPosition) {
      rankChange = previousPosition - currentPosition; // Positive = improvement
    }
    
    // Calculate trend
    let trend: string;
    if (!rankChange) trend = 'stable';
    else if (rankChange > 0) trend = 'up';
    else if (rankChange < 0) trend = 'down';
    else trend = 'stable';
    
    return {
      ...keyword,
      difficulty: difficulty,
      difficultyLevel,
      opportunity,
      currentRank: currentPosition,
      previousRank: previousPosition,
      rankChange,
      trend,
      clusterId: null, // TODO: implement clustering
      clusterName: null,
      mappedUrl: keyword.url,
      cpc: null, // TODO: implement CPC data
      lastUpdated: keyword.last_updated,
    };
  }
}
