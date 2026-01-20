/**
 * Crawl Summary Service
 * 
 * API calls for crawl dashboard data
 */

import { CrawlSummary, CrawlKPIs, StatusCodeData, IssueData } from '@/types/crawl-summary.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Get crawl summary for a project
 */
export async function getCrawlSummary(projectId: string): Promise<CrawlSummary> {
  // TODO: Replace with real API call
  // const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/crawl/summary`);
  // if (!response.ok) throw new Error('Failed to fetch crawl summary');
  // return response.json();

  // Mock data for MVP
  return getMockCrawlSummary(projectId);
}

/**
 * Mock data for development
 */
function getMockCrawlSummary(projectId: string): CrawlSummary {
  const kpis: CrawlKPIs = {
    totalPages: 247,
    pagesWithIssues: 34,
    noindexPages: 12,
    errorPages4xx: 8,
    errorPages5xx: 2,
    healthyPages: 191,
    avgLoadTime: 1850,
    lastCrawlDate: new Date().toISOString(),
  };

  const statusCodes: StatusCodeData[] = [
    { code: '2xx', count: 225, percentage: 91.1, label: 'Success', color: '#22c55e' },
    { code: '3xx', count: 12, percentage: 4.9, label: 'Redirect', color: '#3b82f6' },
    { code: '4xx', count: 8, percentage: 3.2, label: 'Client Error', color: '#f59e0b' },
    { code: '5xx', count: 2, percentage: 0.8, label: 'Server Error', color: '#ef4444' },
  ];

  const issues: IssueData[] = [
    {
      type: 'missing_meta_description',
      count: 15,
      severity: 'warning',
      label: 'Missing Meta Description',
      description: 'Pages without meta description may have lower CTR in search results',
    },
    {
      type: 'missing_h1',
      count: 8,
      severity: 'critical',
      label: 'Missing H1 Tag',
      description: 'Every page should have exactly one H1 tag for SEO',
    },
    {
      type: 'broken_links',
      count: 5,
      severity: 'critical',
      label: 'Broken Links',
      description: 'Internal links pointing to non-existent pages',
    },
    {
      type: 'slow_pages',
      count: 12,
      severity: 'warning',
      label: 'Slow Loading Pages',
      description: 'Pages taking more than 3 seconds to load',
    },
    {
      type: 'missing_alt',
      count: 23,
      severity: 'info',
      label: 'Images Missing Alt Text',
      description: 'Images should have descriptive alt text for accessibility',
    },
    {
      type: 'duplicate_title',
      count: 4,
      severity: 'warning',
      label: 'Duplicate Title Tags',
      description: 'Multiple pages share the same title tag',
    },
  ];

  return {
    projectId,
    projectName: 'VIB Website',
    kpis,
    statusCodes,
    issues,
    crawlStatus: 'completed',
    crawlProgress: 100,
  };
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
