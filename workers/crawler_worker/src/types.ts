/**
 * Crawl Job Types - Standalone Worker
 */

export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type CrawlTriggerType = 'manual' | 'scheduled' | 'api';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CrawlJobConfig {
  maxPages: number;
  maxDepth: number;
  requestDelay: number;
  timeout: number;
  userAgent: string;
  respectRobotsTxt: boolean;
  sameDomainOnly: boolean;
  storeRawHtml?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface CrawlJob {
  id: string;
  projectId: string;
  config: CrawlJobConfig;
  status: CrawlStatus;
  progress: number;
  totalUrlsDiscovered: number;
  crawledPages: number;
  failedPages: number;
  skippedPages: number;
  triggeredBy: CrawlTriggerType;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrawlQueueItem {
  id: string;
  projectId: string;
  jobId: string | null;
  priority: number;
  status: QueueItemStatus;
  scheduledFor: Date;
  startedAt: Date | null;
  createdAt: Date;
}

export interface CrawlProgressUpdate {
  jobId: string;
  progress: number;
  crawledPages: number;
  failedPages: number;
  skippedPages: number;
  totalUrlsDiscovered: number;
  currentUrl?: string;
}

export interface CrawlResultSummary {
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  skippedPages: number;
  duration: number;
  avgResponseTime: number;
  issuesCount: number;
  criticalIssues: number;
}

export const DEFAULT_CRAWL_CONFIG: CrawlJobConfig = {
  maxPages: 100,
  maxDepth: 3,
  requestDelay: 1000,
  timeout: 30000,
  userAgent: 'VIB-SEO-Bot/1.0 (respectful crawler)',
  respectRobotsTxt: true,
  sameDomainOnly: true,
  storeRawHtml: true,
};
