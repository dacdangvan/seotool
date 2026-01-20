/**
 * SEO-safe Web Crawler Module
 * 
 * Following AI_SEO_TOOL_PROMPT_BOOK.md strictly
 * 
 * LEGAL & SAFETY REQUIREMENTS:
 * - Respects robots.txt strictly ✓
 * - Crawls public HTML pages only ✓
 * - No form submission ✓
 * - No authentication ✓
 * - No PII extraction ✓
 * - Rate-limited crawling ✓
 * - SEO audit use only ✓
 */

// NEW: SEO-safe crawler (v2)
export { SEOCrawler } from './seo_crawler';

// NEW: Models and types
export {
  CrawlConfig,
  CrawlJob,
  CrawlProgress,
  CrawlResult,
  CrawlSummary,
  CrawlStatus,
  PageSEOData,
  QueuedUrl,
  CrawlEvent,
  CrawlEventCallback,
  ImageSEOData,
  SEOIssue,
  SEOIssueType,
  RobotsTxtData,
  DEFAULT_CRAWL_CONFIG,
} from './models';

// NEW: Components
export { RobotsParser } from './robots';
export { RateLimiter, RateLimiterConfig } from './rate_limiter';
export { PageFetcher, FetchResult } from './fetcher';
export { LinkExtractor, ExtractedLink } from './link_extractor';
export { PageAnalyzer } from './analyzer';

// NEW: Auto Crawl per Project
export * from './crawl_job.types';
export { CrawlJobService } from './crawl_job.service';
export { CrawlerWorker, CrawlerWorkerConfig } from './crawler_worker';
export { CrawlScheduler, SchedulerConfig } from './crawl_scheduler';
export { CrawlStatusUpdater, CrawlStatusEvent, CrawlStatusEventType } from './crawl_status_updater';
export { CrawlController } from './crawl_controller';

// Full Site Crawler (v3) - Sitemap-first, hybrid URL discovery
export { FullSiteCrawler, CrawlProgress as FullCrawlProgress, FullCrawlResult, CrawlCallbacks } from './full_site_crawler';
export { SitemapParser, SitemapUrl, SitemapParseResult } from './sitemap_parser';
export { UrlFrontier, FrontierUrl, FrontierStats, UrlSource } from './url_frontier';
export { CrawlConfig as FullCrawlConfig, DEFAULT_CRAWL_CONFIG as FULL_CRAWL_DEFAULT_CONFIG, CRAWL_PRESETS, getCrawlConfig } from './crawl_config';

// Core Web Vitals (CWV) Module - Lab data collection
export {
  CWVStatus,
  DeviceProfile,
  MetricData,
  CoreWebVitals,
  CWVResult,
  CWVConfig,
  DEFAULT_CWV_CONFIG,
  CWV_THRESHOLDS,
  getCWVStatus,
  calculateOverallStatus,
  LighthouseAdapter,
  LighthouseResult,
  LighthouseAudit,
  extractVitals,
  getOverallStatus,
  formatVitalsForDisplay,
  getStatusColor,
  passesAssessment,
  getSuggestions,
  CWVRunner,
  CWVPageCandidate,
  CWVRunProgress,
  CWVRunnerCallbacks,
  selectRepresentativePages,
  CWVRepository,
  CWVSummary,
  CWVQueryOptions,
} from './cwv';

// LEGACY: Old crawler (will be removed in future)
export * from './types';
export * from './crawler';
export * from './html-parser';
export * from './robots-parser';
export * from './url-queue';
export * from './repository';
export * from './controller';
