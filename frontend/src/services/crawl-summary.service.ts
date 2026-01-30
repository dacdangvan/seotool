/**
 * Crawl Summary Service
 * 
 * API calls for crawl dashboard data
 */

import { CrawlSummary } from '@/types/crawl-summary.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get crawl summary for a project
 */
export async function getCrawlSummary(projectId: string): Promise<CrawlSummary> {
  const url = `${API_BASE}/projects/${projectId}/crawl/summary`;
  console.log('[CrawlSummary] Fetching from:', url);
  
  try {
    const response = await fetch(url);
    console.log('[CrawlSummary] Response status:', response.status);
    
    if (!response.ok) {
      console.error('[CrawlSummary] API error:', response.status, response.statusText);
      // Return empty summary on error
      return getEmptyCrawlSummary(projectId);
    }
    const data = await response.json();
    console.log('[CrawlSummary] Data received:', data);
    
    // Transform the response to match frontend types
    return {
      projectId: data.projectId,
      projectName: data.projectName,
      kpis: {
        totalPages: data.kpis?.totalPages || 0,
        pagesWithIssues: data.kpis?.pagesWithIssues || 0,
        noindexPages: data.kpis?.noindexPages || 0,
        errorPages4xx: data.kpis?.errorPages4xx || 0,
        errorPages5xx: data.kpis?.errorPages5xx || 0,
        healthyPages: data.kpis?.healthyPages || 0,
        avgLoadTime: data.kpis?.avgLoadTime || 0,
        lastCrawlDate: data.kpis?.lastCrawlDate || null,
      },
      statusCodes: data.statusCodes || [],
      issues: data.issues || [],
      crawlStatus: data.crawlStatus || 'not_started',
      crawlProgress: data.crawlProgress,
    };
  } catch (error) {
    console.error('[CrawlSummary] Failed to fetch:', error);
    return getEmptyCrawlSummary(projectId);
  }
}

/**
 * Get empty summary for projects without crawl data
 */
export function getEmptyCrawlSummary(projectId: string): CrawlSummary {
  return {
    projectId,
    projectName: '',
    kpis: {
      totalPages: 0,
      pagesWithIssues: 0,
      noindexPages: 0,
      errorPages4xx: 0,
      errorPages5xx: 0,
      healthyPages: 0,
      avgLoadTime: 0,
      lastCrawlDate: null,
    },
    statusCodes: [],
    issues: [],
    crawlStatus: 'not_started',
  };
}
