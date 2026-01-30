/**
 * Keyword Service
 * 
 * Service for fetching keyword research data
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

import type {
  KeywordOverviewData,
  KeywordKPIs,
  KeywordChartData,
  Keyword,
  SearchVolumeDistribution,
  DifficultyDistribution,
  IntentDistribution,
  SearchIntent,
  KeywordDifficulty,
  OpportunityLevel,
  KeywordListParams,
  KeywordListResponse,
  KeywordFilters,
  KeywordClusterDetail,
  ClusterListResponse,
} from '@/types/keyword.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/**
 * Fetch keyword overview data for a project
 */
export async function fetchKeywordOverview(projectId: string): Promise<KeywordOverviewData> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/keywords/overview`);
    if (!response.ok) {
      throw new Error('Failed to fetch keyword overview');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching keyword overview:', error);
    // Return empty data instead of mock data
    return {
      kpis: {
        totalKeywords: 0,
        totalKeywordsChange: 0,
        highOpportunityKeywords: 0,
        highOpportunityChange: 0,
        transactionalKeywords: 0,
        transactionalChange: 0,
        unmappedKeywords: 0,
        unmappedChange: 0,
        avgSearchVolume: 0,
        avgDifficulty: 0,
        totalSearchVolume: 0,
        lastUpdated: new Date().toISOString(),
      },
      charts: {
        searchVolumeDistribution: [],
        difficultyDistribution: [],
        intentDistribution: [],
        topOpportunities: [],
      },
    };
  }
}

/**
 * Fetch keyword KPIs only
 */
export async function fetchKeywordKPIs(projectId: string): Promise<KeywordKPIs> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/keywords/kpis`);
    if (!response.ok) {
      throw new Error('Failed to fetch keyword KPIs');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching keyword KPIs:', error);
    // Return empty data instead of mock data
    return {
      totalKeywords: 0,
      totalKeywordsChange: 0,
      highOpportunityKeywords: 0,
      highOpportunityChange: 0,
      transactionalKeywords: 0,
      transactionalChange: 0,
      unmappedKeywords: 0,
      unmappedChange: 0,
      avgSearchVolume: 0,
      avgDifficulty: 0,
      totalSearchVolume: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// =============================================================================
// KEYWORD LIST API
// =============================================================================

/**
 * Fetch keyword list with filtering, sorting, and pagination
 */
export async function fetchKeywordList(
  projectId: string,
  params: KeywordListParams
): Promise<KeywordListResponse> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('page', params.pagination.page.toString());
    queryParams.set('pageSize', params.pagination.pageSize.toString());
    queryParams.set('sortField', params.sort.field);
    queryParams.set('sortDirection', params.sort.direction);
    
    // Add filters
    if (params.filters.search) queryParams.set('search', params.filters.search);
    if (params.filters.intent && params.filters.intent !== 'all') {
      queryParams.set('intent', params.filters.intent);
    }
    if (params.filters.difficulty && params.filters.difficulty !== 'all') {
      queryParams.set('difficulty', params.filters.difficulty);
    }
    if (params.filters.opportunity && params.filters.opportunity !== 'all') {
      queryParams.set('opportunity', params.filters.opportunity);
    }
    if (params.filters.mapped && params.filters.mapped !== 'all') {
      queryParams.set('mapped', params.filters.mapped);
    }
    
    const response = await fetch(`${API_BASE}/projects/${projectId}/keywords?${queryParams}`);
    if (!response.ok) {
      throw new Error('Failed to fetch keyword list');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching keyword list:', error);
    // Return empty data instead of mock data
    return {
      keywords: [],
      total: 0,
      page: params.pagination.page,
      pageSize: params.pagination.pageSize,
      totalPages: 0,
    };
  }
}

// =============================================================================
// KEYWORD CLUSTER API
// =============================================================================

/**
 * Fetch keyword clusters for a project
 */
export async function fetchKeywordClusters(
  projectId: string
): Promise<ClusterListResponse> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/keywords/clusters`);
    if (!response.ok) {
      throw new Error('Failed to fetch keyword clusters');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching keyword clusters:', error);
    // Return empty data instead of mock data
    return {
      clusters: [],
      total: 0,
    };
  }
}

/**
 * Fetch single cluster detail with all keywords
 */
export async function fetchClusterDetail(
  projectId: string,
  clusterId: string
): Promise<KeywordClusterDetail> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/keywords/clusters/${clusterId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch cluster detail');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching cluster detail:', error);
    throw error; // Don't return mock data
  }
}

// =============================================================================
// MOCK DATA REMOVED
// =============================================================================

// Removed all mock data generation functions per crawl-centric architecture
// All data must come from database/crawl results

/**
 * Calculate opportunity level from volume and difficulty
 */
export function calculateOpportunity(
  searchVolume: number,
  difficulty: number
): OpportunityLevel {
  // High opportunity: good volume (500+) with achievable difficulty (<50)
  if (searchVolume >= 500 && difficulty < 50) return 'high';
  // Medium: decent volume (100+) OR low difficulty
  if (searchVolume >= 100 || difficulty < 30) return 'medium';
  return 'low';
}

/**
 * Get difficulty level from score
 */
export function getDifficultyLevel(score: number): KeywordDifficulty {
  if (score <= 30) return 'easy';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'hard';
  return 'very_hard';
}
