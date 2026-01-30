/**
 * Crawl Service
 * 
 * Service for fetching and managing crawl data
 */

import type { CrawlResult, CrawlSummary, PageSEOData } from '@/types/crawl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// Cache for crawl data
let cachedCrawlResult: CrawlResult | null = null;

/**
 * Fetch crawl result data
 * Always fetch from API - no mock data in production
 */
export async function fetchCrawlResult(): Promise<CrawlResult> {
  if (cachedCrawlResult) {
    return cachedCrawlResult;
  }
  
  // Always fetch from API - mock data removed per crawl-centric architecture
  const response = await fetch(`${API_BASE}/crawl/latest`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch crawl data: ${response.status} ${errorText}`);
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
 * Dynamically calculate from pages data since summary may not have all fields
 */
export function calculateSEOHealthScore(summary: CrawlSummary, pages?: PageSEOData[]): {
  overall: number;
  technical: number;
  content: number;
  meta: number;
} {
  const totalPages = summary.totalPages || pages?.length || 0;
  
  if (totalPages === 0) {
    return { overall: 0, technical: 0, content: 0, meta: 0 };
  }
  
  // If we have pages data, calculate from it
  if (pages && pages.length > 0) {
    // Technical score (based on response time and status codes)
    const successfulPages = pages.filter(p => p.statusCode >= 200 && p.statusCode < 400).length;
    const successRate = successfulPages / totalPages;
    const avgResponseTime = pages.reduce((sum, p) => sum + p.responseTime, 0) / totalPages;
    const fastResponseRate = avgResponseTime < 500 ? 1 : 
                            avgResponseTime < 1000 ? 0.8 : 
                            avgResponseTime < 2000 ? 0.6 : 0.4;
    const technical = Math.round((successRate * 0.6 + fastResponseRate * 0.4) * 100);
    
    // Content score (based on word count and thin content)
    const thinContentPages = pages.filter(p => p.wordCount < 300).length;
    const thinContentRate = thinContentPages / totalPages;
    const content = Math.round((1 - thinContentRate) * 100);
    
    // Meta score (based on title, description, H1)
    const pagesWithoutTitle = pages.filter(p => !p.title || p.title.length === 0).length;
    const pagesWithoutMetaDescription = pages.filter(p => !p.metaDescription || p.metaDescription.length === 0).length;
    const pagesWithoutH1 = pages.filter(p => p.h1Count === 0).length;
    const pagesWithMultipleH1 = pages.filter(p => p.h1Count > 1).length;
    
    const titleScore = 1 - (pagesWithoutTitle / totalPages);
    const descScore = 1 - (pagesWithoutMetaDescription / totalPages);
    const h1Score = 1 - (pagesWithoutH1 / totalPages);
    const multiH1Penalty = (pagesWithMultipleH1 / totalPages) * 0.5;
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
  
  // Fallback to summary fields if pages not available
  const successfulPages = summary.successfulPages ?? (summary as { crawledPages?: number }).crawledPages ?? totalPages;
  const successRate = successfulPages / totalPages;
  const fastResponseRate = summary.avgResponseTime < 500 ? 1 : 
                          summary.avgResponseTime < 1000 ? 0.8 : 
                          summary.avgResponseTime < 2000 ? 0.6 : 0.4;
  const technical = Math.round((successRate * 0.6 + fastResponseRate * 0.4) * 100);
  
  // Content score
  const thinContentRate = (summary.pagesWithThinContent ?? 0) / totalPages;
  const content = Math.round((1 - thinContentRate) * 100);
  
  // Meta score
  const titleScore = 1 - ((summary.pagesWithoutTitle ?? 0) / totalPages);
  const descScore = 1 - ((summary.pagesWithoutMetaDescription ?? 0) / totalPages);
  const h1Score = 1 - ((summary.pagesWithoutH1 ?? 0) / totalPages);
  const multiH1Penalty = ((summary.pagesWithMultipleH1 ?? 0) / totalPages) * 0.5;
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
