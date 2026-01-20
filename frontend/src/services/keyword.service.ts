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
  if (USE_MOCK) {
    return generateMockKeywordList(params);
  }

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
  if (params.filters.minVolume !== undefined) {
    queryParams.set('minVolume', params.filters.minVolume.toString());
  }
  if (params.filters.maxVolume !== undefined) {
    queryParams.set('maxVolume', params.filters.maxVolume.toString());
  }
  if (params.filters.minDifficulty !== undefined) {
    queryParams.set('minDifficulty', params.filters.minDifficulty.toString());
  }
  if (params.filters.maxDifficulty !== undefined) {
    queryParams.set('maxDifficulty', params.filters.maxDifficulty.toString());
  }

  const response = await fetch(
    `${API_BASE}/projects/${projectId}/keywords?${queryParams.toString()}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch keyword list');
  }
  return response.json();
}

// =============================================================================
// MOCK KEYWORD LIST GENERATION
// =============================================================================

const MOCK_KEYWORDS: Keyword[] = generateFullMockKeywordList();

function generateFullMockKeywordList(): Keyword[] {
  const baseKeywords = [
    // Transactional - High opportunity
    { kw: 'mở thẻ tín dụng online', vol: 8100, diff: 35, intent: 'transactional' as SearchIntent, mapped: '/vn/the-tin-dung/dang-ky' },
    { kw: 'đăng ký vay tiêu dùng', vol: 6600, diff: 42, intent: 'transactional' as SearchIntent, mapped: '/vn/vay-tieu-dung' },
    { kw: 'mở tài khoản ngân hàng online', vol: 5400, diff: 28, intent: 'transactional' as SearchIntent, mapped: '/vn/tai-khoan' },
    { kw: 'gửi tiết kiệm lãi suất cao', vol: 4900, diff: 32, intent: 'transactional' as SearchIntent, mapped: '/vn/tiet-kiem' },
    { kw: 'vay mua nhà trả góp', vol: 4400, diff: 48, intent: 'transactional' as SearchIntent, mapped: '/vn/vay-mua-nha' },
    { kw: 'đăng ký thẻ visa', vol: 3800, diff: 38, intent: 'transactional' as SearchIntent, mapped: null },
    { kw: 'vay tín chấp online', vol: 3200, diff: 45, intent: 'transactional' as SearchIntent, mapped: '/vn/vay-tin-chap' },
    { kw: 'mở thẻ ghi nợ quốc tế', vol: 2900, diff: 30, intent: 'transactional' as SearchIntent, mapped: null },
    
    // Commercial - Medium opportunity  
    { kw: 'so sánh thẻ tín dụng 2024', vol: 7200, diff: 55, intent: 'commercial' as SearchIntent, mapped: '/vn/the-tin-dung/so-sanh' },
    { kw: 'thẻ tín dụng hoàn tiền tốt nhất', vol: 5800, diff: 52, intent: 'commercial' as SearchIntent, mapped: '/vn/the-tin-dung/cashback' },
    { kw: 'ngân hàng nào vay mua nhà tốt', vol: 4500, diff: 58, intent: 'commercial' as SearchIntent, mapped: null },
    { kw: 'lãi suất vay tiêu dùng 2024', vol: 4100, diff: 48, intent: 'commercial' as SearchIntent, mapped: '/vn/vay-tieu-dung/lai-suat' },
    { kw: 'thẻ tín dụng miễn phí thường niên', vol: 3600, diff: 45, intent: 'commercial' as SearchIntent, mapped: '/vn/the-tin-dung/mien-phi' },
    { kw: 'so sánh lãi suất tiết kiệm', vol: 3200, diff: 42, intent: 'commercial' as SearchIntent, mapped: null },
    { kw: 'review thẻ VIB cashback', vol: 2800, diff: 25, intent: 'commercial' as SearchIntent, mapped: '/vn/the-tin-dung/vib-cashback' },
    { kw: 'đánh giá dịch vụ vay VIB', vol: 2400, diff: 22, intent: 'commercial' as SearchIntent, mapped: null },
    
    // Informational
    { kw: 'thẻ tín dụng là gì', vol: 9500, diff: 65, intent: 'informational' as SearchIntent, mapped: '/vn/kien-thuc/the-tin-dung' },
    { kw: 'cách tính lãi suất vay', vol: 6800, diff: 58, intent: 'informational' as SearchIntent, mapped: '/vn/kien-thuc/lai-suat' },
    { kw: 'điều kiện vay tiêu dùng', vol: 5200, diff: 48, intent: 'informational' as SearchIntent, mapped: '/vn/vay-tieu-dung/dieu-kien' },
    { kw: 'hồ sơ mở thẻ tín dụng cần gì', vol: 4600, diff: 42, intent: 'informational' as SearchIntent, mapped: '/vn/the-tin-dung/ho-so' },
    { kw: 'lãi suất kép là gì', vol: 3800, diff: 55, intent: 'informational' as SearchIntent, mapped: null },
    { kw: 'CIC là gì', vol: 3400, diff: 52, intent: 'informational' as SearchIntent, mapped: '/vn/kien-thuc/cic' },
    { kw: 'cách nâng hạn mức thẻ tín dụng', vol: 2900, diff: 38, intent: 'informational' as SearchIntent, mapped: null },
    { kw: 'thẻ ghi nợ khác thẻ tín dụng như thế nào', vol: 2500, diff: 45, intent: 'informational' as SearchIntent, mapped: '/vn/kien-thuc/the-ghi-no' },
    
    // Navigational - Brand
    { kw: 'VIB online banking', vol: 12000, diff: 15, intent: 'navigational' as SearchIntent, mapped: '/vn/ngan-hang-so' },
    { kw: 'VIB MyVIB', vol: 8500, diff: 12, intent: 'navigational' as SearchIntent, mapped: '/vn/myvib' },
    { kw: 'thẻ VIB Premier Boundless', vol: 3200, diff: 18, intent: 'navigational' as SearchIntent, mapped: '/vn/the-tin-dung/premier-boundless' },
    { kw: 'VIB chi nhánh gần nhất', vol: 2100, diff: 20, intent: 'navigational' as SearchIntent, mapped: '/vn/chi-nhanh' },
    
    // Low opportunity - High difficulty
    { kw: 'ngân hàng tốt nhất việt nam', vol: 15000, diff: 85, intent: 'commercial' as SearchIntent, mapped: null },
    { kw: 'thẻ tín dụng uy tín', vol: 8800, diff: 78, intent: 'commercial' as SearchIntent, mapped: null },
    { kw: 'vay ngân hàng', vol: 22000, diff: 92, intent: 'transactional' as SearchIntent, mapped: null },
    { kw: 'lãi suất ngân hàng', vol: 18000, diff: 88, intent: 'informational' as SearchIntent, mapped: null },
  ];

  return baseKeywords.map((item, index) => {
    const difficultyLevel = getDifficultyLevel(item.diff);
    const opportunity = calculateOpportunity(item.vol, item.diff);
    const hasRank = Math.random() > 0.3;
    const currentRank = hasRank ? Math.floor(Math.random() * 50) + 1 : null;
    const rankChange = hasRank ? Math.floor(Math.random() * 10) - 5 : null;
    
    return {
      id: `kw-${index + 1}`,
      keyword: item.kw,
      searchVolume: item.vol,
      difficulty: item.diff,
      difficultyLevel,
      intent: item.intent,
      opportunity,
      currentRank,
      previousRank: currentRank && rankChange ? currentRank - rankChange : null,
      rankChange,
      clusterId: `cluster-${Math.floor(index / 5)}`,
      clusterName: ['Thẻ tín dụng', 'Vay tiêu dùng', 'Tiết kiệm', 'Tài khoản', 'Kiến thức'][Math.floor(index / 5) % 5],
      mappedUrl: item.mapped,
      cpc: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
      lastUpdated: new Date().toISOString(),
    };
  });
}

function generateMockKeywordList(params: KeywordListParams): KeywordListResponse {
  let filtered = [...MOCK_KEYWORDS];
  const { filters, sort, pagination } = params;

  // Apply filters
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(kw => kw.keyword.toLowerCase().includes(searchLower));
  }
  
  if (filters.intent && filters.intent !== 'all') {
    filtered = filtered.filter(kw => kw.intent === filters.intent);
  }
  
  if (filters.difficulty && filters.difficulty !== 'all') {
    filtered = filtered.filter(kw => kw.difficultyLevel === filters.difficulty);
  }
  
  if (filters.opportunity && filters.opportunity !== 'all') {
    filtered = filtered.filter(kw => kw.opportunity === filters.opportunity);
  }
  
  if (filters.mapped === 'mapped') {
    filtered = filtered.filter(kw => kw.mappedUrl !== null);
  } else if (filters.mapped === 'unmapped') {
    filtered = filtered.filter(kw => kw.mappedUrl === null);
  }
  
  if (filters.minVolume !== undefined) {
    filtered = filtered.filter(kw => kw.searchVolume >= filters.minVolume!);
  }
  
  if (filters.maxVolume !== undefined) {
    filtered = filtered.filter(kw => kw.searchVolume <= filters.maxVolume!);
  }
  
  if (filters.minDifficulty !== undefined) {
    filtered = filtered.filter(kw => kw.difficulty >= filters.minDifficulty!);
  }
  
  if (filters.maxDifficulty !== undefined) {
    filtered = filtered.filter(kw => kw.difficulty <= filters.maxDifficulty!);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sort.field) {
      case 'keyword':
        comparison = a.keyword.localeCompare(b.keyword);
        break;
      case 'searchVolume':
        comparison = a.searchVolume - b.searchVolume;
        break;
      case 'difficulty':
        comparison = a.difficulty - b.difficulty;
        break;
      case 'opportunity':
        const oppOrder = { high: 1, medium: 2, low: 3 };
        comparison = oppOrder[a.opportunity] - oppOrder[b.opportunity];
        break;
      case 'currentRank':
        const aRank = a.currentRank ?? 999;
        const bRank = b.currentRank ?? 999;
        comparison = aRank - bRank;
        break;
    }
    return sort.direction === 'asc' ? comparison : -comparison;
  });

  // Apply pagination
  const total = filtered.length;
  const totalPages = Math.ceil(total / pagination.pageSize);
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const paginatedKeywords = filtered.slice(startIndex, startIndex + pagination.pageSize);

  return {
    keywords: paginatedKeywords,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages,
  };
}
