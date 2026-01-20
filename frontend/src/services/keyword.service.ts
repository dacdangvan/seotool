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
} from '@/types/keyword.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

/**
 * Fetch keyword overview data for a project
 */
export async function fetchKeywordOverview(projectId: string): Promise<KeywordOverviewData> {
  if (USE_MOCK) {
    return generateMockOverviewData(projectId);
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/keywords/overview`);
  if (!response.ok) {
    throw new Error('Failed to fetch keyword overview');
  }
  return response.json();
}

/**
 * Fetch keyword KPIs only
 */
export async function fetchKeywordKPIs(projectId: string): Promise<KeywordKPIs> {
  if (USE_MOCK) {
    return generateMockKPIs();
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/keywords/kpis`);
  if (!response.ok) {
    throw new Error('Failed to fetch keyword KPIs');
  }
  return response.json();
}

// =============================================================================
// MOCK DATA GENERATION
// =============================================================================

function generateMockKPIs(): KeywordKPIs {
  return {
    totalKeywords: 1247,
    totalKeywordsChange: 12.5,
    highOpportunityKeywords: 156,
    highOpportunityChange: 8.3,
    transactionalKeywords: 342,
    transactionalChange: 15.2,
    unmappedKeywords: 89,
    unmappedChange: -5.1,
    avgSearchVolume: 2840,
    avgDifficulty: 45,
    totalSearchVolume: 3541680,
    lastUpdated: new Date().toISOString(),
  };
}

function generateMockSearchVolumeDistribution(): SearchVolumeDistribution[] {
  return [
    { range: '0-100', count: 312, totalVolume: 15600 },
    { range: '100-500', count: 428, totalVolume: 128400 },
    { range: '500-1K', count: 256, totalVolume: 192000 },
    { range: '1K-5K', count: 178, totalVolume: 445000 },
    { range: '5K-10K', count: 52, totalVolume: 364000 },
    { range: '10K+', count: 21, totalVolume: 630000 },
  ];
}

function generateMockDifficultyDistribution(): DifficultyDistribution[] {
  return [
    { difficulty: 'easy', count: 312, percentage: 25 },
    { difficulty: 'medium', count: 498, percentage: 40 },
    { difficulty: 'hard', count: 312, percentage: 25 },
    { difficulty: 'very_hard', count: 125, percentage: 10 },
  ];
}

function generateMockIntentDistribution(): IntentDistribution[] {
  return [
    { intent: 'informational', count: 498, percentage: 40, searchVolume: 1416672 },
    { intent: 'commercial', count: 374, percentage: 30, searchVolume: 1062504 },
    { intent: 'transactional', count: 342, percentage: 27.4, searchVolume: 971181 },
    { intent: 'navigational', count: 33, percentage: 2.6, searchVolume: 91323 },
  ];
}

function generateMockTopOpportunities(): Keyword[] {
  const keywords: Keyword[] = [
    {
      id: '1',
      keyword: 'thẻ tín dụng hoàn tiền',
      searchVolume: 8100,
      difficulty: 35,
      difficultyLevel: 'medium',
      intent: 'commercial',
      opportunity: 'high',
      currentRank: 12,
      previousRank: 15,
      rankChange: 3,
      clusterId: 'credit-cards',
      clusterName: 'Thẻ tín dụng',
      mappedUrl: '/vn/the-tin-dung/vib-cashback',
      cpc: 2.5,
      trend: 'up',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: '2',
      keyword: 'vay mua nhà lãi suất thấp',
      searchVolume: 6600,
      difficulty: 42,
      difficultyLevel: 'medium',
      intent: 'transactional',
      opportunity: 'high',
      currentRank: 8,
      previousRank: 11,
      rankChange: 3,
      clusterId: 'home-loans',
      clusterName: 'Vay mua nhà',
      mappedUrl: '/vn/vay-von/vay-mua-nha',
      cpc: 3.2,
      trend: 'up',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: '3',
      keyword: 'tiết kiệm online lãi cao',
      searchVolume: 5400,
      difficulty: 28,
      difficultyLevel: 'easy',
      intent: 'transactional',
      opportunity: 'high',
      currentRank: 15,
      previousRank: 18,
      rankChange: 3,
      clusterId: 'savings',
      clusterName: 'Tiết kiệm',
      mappedUrl: '/vn/tiet-kiem/tiet-kiem-online',
      cpc: 1.8,
      trend: 'up',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: '4',
      keyword: 'mở thẻ visa online',
      searchVolume: 4400,
      difficulty: 32,
      difficultyLevel: 'medium',
      intent: 'transactional',
      opportunity: 'high',
      currentRank: null,
      previousRank: null,
      rankChange: null,
      clusterId: 'debit-cards',
      clusterName: 'Thẻ ghi nợ',
      mappedUrl: null,
      cpc: 2.1,
      trend: 'stable',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: '5',
      keyword: 'so sánh thẻ tín dụng 2024',
      searchVolume: 3600,
      difficulty: 38,
      difficultyLevel: 'medium',
      intent: 'commercial',
      opportunity: 'high',
      currentRank: 25,
      previousRank: 30,
      rankChange: 5,
      clusterId: 'credit-cards',
      clusterName: 'Thẻ tín dụng',
      mappedUrl: '/vn/the-tin-dung',
      cpc: 2.8,
      trend: 'up',
      lastUpdated: new Date().toISOString(),
    },
  ];
  
  return keywords;
}

function generateMockOverviewData(projectId: string): KeywordOverviewData {
  return {
    kpis: generateMockKPIs(),
    charts: {
      searchVolumeDistribution: generateMockSearchVolumeDistribution(),
      difficultyDistribution: generateMockDifficultyDistribution(),
      intentDistribution: generateMockIntentDistribution(),
      topOpportunities: generateMockTopOpportunities(),
    },
  };
}

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
