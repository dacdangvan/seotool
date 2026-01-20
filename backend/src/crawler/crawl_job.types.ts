/**
 * Crawl Job Types
 * 
 * Type definitions for crawl job management
 * Following AI_SEO_TOOL_PROMPT_BOOK.md
 */

// =============================================================================
// CRAWL STATUS
// =============================================================================

export type CrawlStatus = 'not_started' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type CrawlTriggerType = 'manual' | 'scheduled' | 'api';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// =============================================================================
// PROJECT CRAWL STATE
// =============================================================================

export interface ProjectCrawlState {
  projectId: string;
  domain: string;
  crawlStatus: CrawlStatus;
  crawlProgress: number;
  lastCrawlAt: Date | null;
  lastCrawlJobId: string | null;
  crawlError: string | null;
  crawlSchedule: string | null; // cron expression or 'manual'
  nextScheduledCrawl: Date | null;
}

// =============================================================================
// CRAWL JOB
// =============================================================================

export interface CrawlJobConfig {
  maxPages: number;
  maxDepth: number;
  requestDelay: number;
  timeout: number;
  userAgent: string;
  respectRobotsTxt: true;
  sameDomainOnly: true;
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

export interface CreateCrawlJobInput {
  projectId: string;
  config?: Partial<CrawlJobConfig>;
  triggeredBy?: CrawlTriggerType;
}

// =============================================================================
// CRAWL QUEUE
// =============================================================================

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

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

// =============================================================================
// CRAWL LOG
// =============================================================================

export interface CrawlJobLog {
  id: string;
  jobId: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// =============================================================================
// CRAWL PROGRESS UPDATE
// =============================================================================

export interface CrawlProgressUpdate {
  jobId: string;
  progress: number;
  crawledPages: number;
  failedPages: number;
  skippedPages: number;
  totalUrlsDiscovered: number;
  currentUrl?: string;
}

// =============================================================================
// CRAWL RESULT SUMMARY
// =============================================================================

export interface CrawlResultSummary {
  jobId: string;
  projectId: string;
  status: CrawlStatus;
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  skippedPages: number;
  duration: number; // in milliseconds
  avgResponseTime: number;
  issuesCount: number;
  criticalIssues: number;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface TriggerCrawlResponse {
  success: boolean;
  jobId: string;
  message: string;
  status: CrawlStatus;
}

export interface CrawlStatusResponse {
  projectId: string;
  status: CrawlStatus;
  progress: number;
  currentJob: CrawlJob | null;
  lastCompletedJob: CrawlJob | null;
  lastCrawlAt: Date | null;
  isRunning: boolean;
  canTrigger: boolean;
}
