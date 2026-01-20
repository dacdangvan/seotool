/**
 * Crawl Summary Types
 * 
 * Type definitions for crawl dashboard data
 */

// KPI Data
export interface CrawlKPIs {
  totalPages: number;
  pagesWithIssues: number;
  noindexPages: number;
  errorPages4xx: number;
  errorPages5xx: number;
  healthyPages: number;
  avgLoadTime: number; // ms
  lastCrawlDate: string | null;
}

// Status code distribution
export interface StatusCodeData {
  code: string;      // '2xx', '3xx', '4xx', '5xx'
  count: number;
  percentage: number;
  label: string;     // 'Success', 'Redirect', 'Client Error', 'Server Error'
  color: string;     // Chart color
}

// Issue breakdown
export interface IssueData {
  type: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  label: string;
  description: string;
}

// Full crawl summary response
export interface CrawlSummary {
  projectId: string;
  projectName: string;
  kpis: CrawlKPIs;
  statusCodes: StatusCodeData[];
  issues: IssueData[];
  crawlStatus: 'not_started' | 'running' | 'completed' | 'failed';
  crawlProgress?: number;
}

// Chart colors
export const STATUS_CODE_COLORS = {
  '2xx': '#22c55e', // green
  '3xx': '#3b82f6', // blue
  '4xx': '#f59e0b', // amber
  '5xx': '#ef4444', // red
};

export const SEVERITY_COLORS = {
  critical: '#ef4444', // red
  warning: '#f59e0b',  // amber
  info: '#3b82f6',     // blue
};
