/**
 * Keyword Research Types
 * 
 * Type definitions for Keyword Research Overview
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

// =============================================================================
// SEARCH INTENT TYPES (Per Module 1)
// =============================================================================

export type SearchIntent = 
  | 'informational'  // User wants to learn/understand
  | 'commercial'     // User researching before purchase
  | 'transactional'  // User ready to buy/convert
  | 'navigational';  // User looking for specific site

export const SEARCH_INTENT_CONFIG: Record<SearchIntent, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  priority: number;
}> = {
  transactional: {
    label: 'Ready to Buy',
    description: 'Keywords indicating purchase intent',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    priority: 1,
  },
  commercial: {
    label: 'Considering',
    description: 'Keywords showing research/comparison behavior',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    priority: 2,
  },
  informational: {
    label: 'Learning',
    description: 'Keywords seeking information or education',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    priority: 3,
  },
  navigational: {
    label: 'Brand Search',
    description: 'Keywords looking for specific brands/sites',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    priority: 4,
  },
};

// =============================================================================
// KEYWORD DIFFICULTY TYPES
// =============================================================================

export type KeywordDifficulty = 'easy' | 'medium' | 'hard' | 'very_hard';

export const KEYWORD_DIFFICULTY_CONFIG: Record<KeywordDifficulty, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  range: [number, number];
}> = {
  easy: {
    label: 'Easy',
    description: 'Low competition, quick wins possible',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    range: [0, 30],
  },
  medium: {
    label: 'Medium',
    description: 'Moderate competition',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    range: [31, 60],
  },
  hard: {
    label: 'Hard',
    description: 'High competition, requires effort',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    range: [61, 80],
  },
  very_hard: {
    label: 'Very Hard',
    description: 'Highly competitive, long-term strategy needed',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    range: [81, 100],
  },
};

// =============================================================================
// KEYWORD OPPORTUNITY TYPES
// =============================================================================

export type OpportunityLevel = 'high' | 'medium' | 'low';

export const OPPORTUNITY_CONFIG: Record<OpportunityLevel, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  high: {
    label: 'High Opportunity',
    description: 'Good search volume with achievable difficulty',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  medium: {
    label: 'Medium Opportunity',
    description: 'Balanced potential and competition',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  low: {
    label: 'Low Opportunity',
    description: 'Limited potential or high competition',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
};

// =============================================================================
// KEYWORD DATA TYPES
// =============================================================================

export interface Keyword {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  difficultyLevel: KeywordDifficulty;
  intent: SearchIntent;
  opportunity: OpportunityLevel;
  currentRank: number | null;
  previousRank: number | null;
  rankChange: number | null;
  clusterId: string | null;
  clusterName: string | null;
  mappedUrl: string | null;
  cpc: number | null;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

export interface KeywordCluster {
  id: string;
  name: string;
  keywords: Keyword[];
  totalSearchVolume: number;
  avgDifficulty: number;
  primaryIntent: SearchIntent;
  mappedUrls: string[];
}

// =============================================================================
// KPI TYPES FOR OVERVIEW
// =============================================================================

export interface KeywordKPIs {
  totalKeywords: number;
  totalKeywordsChange: number;
  highOpportunityKeywords: number;
  highOpportunityChange: number;
  transactionalKeywords: number;
  transactionalChange: number;
  unmappedKeywords: number;
  unmappedChange: number;
  avgSearchVolume: number;
  avgDifficulty: number;
  totalSearchVolume: number;
  lastUpdated: string;
}

// =============================================================================
// CHART DATA TYPES
// =============================================================================

export interface SearchVolumeDistribution {
  range: string;
  count: number;
  totalVolume: number;
}

export interface DifficultyDistribution {
  difficulty: KeywordDifficulty;
  count: number;
  percentage: number;
}

export interface IntentDistribution {
  intent: SearchIntent;
  count: number;
  percentage: number;
  searchVolume: number;
}

export interface KeywordChartData {
  searchVolumeDistribution: SearchVolumeDistribution[];
  difficultyDistribution: DifficultyDistribution[];
  intentDistribution: IntentDistribution[];
  topOpportunities: Keyword[];
}

// =============================================================================
// OVERVIEW DATA TYPE
// =============================================================================

export interface KeywordOverviewData {
  kpis: KeywordKPIs;
  charts: KeywordChartData;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface KeywordFilters {
  intent?: SearchIntent | 'all';
  difficulty?: KeywordDifficulty | 'all';
  opportunity?: OpportunityLevel | 'all';
  mapped?: 'all' | 'mapped' | 'unmapped';
  search?: string;
  minVolume?: number;
  maxVolume?: number;
  minDifficulty?: number;
  maxDifficulty?: number;
}

export type KeywordSortField = 
  | 'keyword'
  | 'searchVolume'
  | 'difficulty'
  | 'opportunity'
  | 'currentRank';

export type SortDirection = 'asc' | 'desc';

export interface KeywordListParams {
  filters: KeywordFilters;
  sort: {
    field: KeywordSortField;
    direction: SortDirection;
  };
  pagination: {
    page: number;
    pageSize: number;
  };
}

export interface KeywordListResponse {
  keywords: Keyword[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
