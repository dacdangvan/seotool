/**
 * Crawl Service
 * 
 * Service for fetching and managing crawl data
 */

import type { CrawlResult, CrawlSummary, PageSEOData } from '@/types/crawl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

// Cache for crawl data
let cachedCrawlResult: CrawlResult | null = null;

/**
 * Fetch crawl result data
 * In MVP mode, loads from static JSON file
 */
export async function fetchCrawlResult(): Promise<CrawlResult> {
  if (cachedCrawlResult) {
    return cachedCrawlResult;
  }
  
  if (USE_MOCK) {
    // Load from static file in public folder
    const response = await fetch('/crawl-data.json');
    if (!response.ok) {
      throw new Error('Failed to load crawl data');
    }
    cachedCrawlResult = await response.json();
    return cachedCrawlResult!;
  }
  
  // Production: fetch from API
  const response = await fetch(`${API_BASE}/crawl/latest`);
  if (!response.ok) {
    throw new Error('Failed to fetch crawl data');
  }
  cachedCrawlResult = await response.json();
  return cachedCrawlResult!;
}

/**
 * Get crawl summary
 */
export async function getCrawlSummary(): Promise<CrawlSummary> {
  const result = await fetchCrawlResult();
  return result.summary;
}

/**
 * Get all crawled pages
 */
export async function getCrawledPages(): Promise<PageSEOData[]> {
  const result = await fetchCrawlResult();
  return result.pages;
}

/**
 * Get pages with issues
 */
export async function getPagesWithIssues(severity?: 'critical' | 'warning' | 'info'): Promise<PageSEOData[]> {
  const result = await fetchCrawlResult();
  
  return result.pages.filter(page => {
    if (!severity) {
      return page.issues.length > 0;
    }
    return page.issues.some(issue => issue.severity === severity);
  });
}

/**
 * Get page by URL
 */
export async function getPageByUrl(url: string): Promise<PageSEOData | undefined> {
  const result = await fetchCrawlResult();
  return result.pages.find(page => page.url === url);
}

/**
 * Clear cache (for refresh)
 */
export function clearCrawlCache(): void {
  cachedCrawlResult = null;
}

/**
 * Calculate SEO health score from crawl data
 */
export function calculateSEOHealthScore(summary: CrawlSummary): {
  overall: number;
  technical: number;
  content: number;
  meta: number;
} {
  const { totalPages } = summary;
  
  if (totalPages === 0) {
    return { overall: 0, technical: 0, content: 0, meta: 0 };
  }
  
  // Technical score (based on response time and status codes)
  const successRate = summary.successfulPages / totalPages;
  const fastResponseRate = summary.avgResponseTime < 500 ? 1 : 
                          summary.avgResponseTime < 1000 ? 0.8 : 
                          summary.avgResponseTime < 2000 ? 0.6 : 0.4;
  const technical = Math.round((successRate * 0.6 + fastResponseRate * 0.4) * 100);
  
  // Content score (based on word count and thin content)
  const thinContentRate = summary.pagesWithThinContent / totalPages;
  const content = Math.round((1 - thinContentRate) * 100);
  
  // Meta score (based on title, description, H1)
  const titleScore = 1 - (summary.pagesWithoutTitle / totalPages);
  const descScore = 1 - (summary.pagesWithoutMetaDescription / totalPages);
  const h1Score = 1 - (summary.pagesWithoutH1 / totalPages);
  const multiH1Penalty = summary.pagesWithMultipleH1 / totalPages * 0.5;
  const meta = Math.round((titleScore * 0.35 + descScore * 0.35 + h1Score * 0.3 - multiH1Penalty) * 100);
  
  // Overall weighted score
  const overall = Math.round(technical * 0.3 + content * 0.35 + meta * 0.35);
  
  return {
    overall: Math.max(0, Math.min(100, overall)),
    technical: Math.max(0, Math.min(100, technical)),
    content: Math.max(0, Math.min(100, content)),
    meta: Math.max(0, Math.min(100, meta)),
  };
}

/**
 * Get issue statistics
 */
export function getIssueStats(pages: PageSEOData[]): {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byType: Record<string, number>;
} {
  const stats = {
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    byType: {} as Record<string, number>,
  };
  
  for (const page of pages) {
    for (const issue of page.issues) {
      stats.total++;
      stats[issue.severity]++;
      stats.byType[issue.type] = (stats.byType[issue.type] || 0) + 1;
    }
  }
  
  return stats;
}
