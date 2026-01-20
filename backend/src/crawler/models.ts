/**
 * Crawler Models & Types
 * 
 * SEO-safe Web Crawler for www.vib.com.vn
 * Type definitions following AI_SEO_TOOL_PROMPT_BOOK.md
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface CrawlConfig {
  /** Base URL to crawl (e.g., https://www.vib.com.vn) */
  baseUrl: string;
  
  /** Project ID this crawl belongs to */
  projectId: string;
  
  /** Maximum number of pages to crawl (default: 50) */
  maxPages: number;
  
  /** Maximum depth of crawl (0 = only baseUrl, default: 3) */
  maxDepth: number;
  
  /** Minimum delay between requests in ms (default: 1000) */
  requestDelay: number;
  
  /** Request timeout in ms (default: 30000) */
  timeout: number;
  
  /** User agent string - identifies as SEO audit bot */
  userAgent: string;
  
  /** Strictly respect robots.txt (MANDATORY: always true) */
  respectRobotsTxt: true;
  
  /** Crawl only same domain (MANDATORY: always true for safety) */
  sameDomainOnly: true;
  
  /** URL patterns to include (regex strings) */
  includePatterns?: string[];
  
  /** URL patterns to exclude (regex strings) */
  excludePatterns?: string[];
  
  /** Enable JavaScript rendering via Playwright (default: false) */
  enableJsRendering?: boolean;
  
  /** Store raw HTML (default: false) */
  storeRawHtml?: boolean;
  
  /** Retry count for failed requests (default: 2) */
  retryCount?: number;
  
  /** Backoff multiplier for retries in ms (default: 2000) */
  backoffDelay?: number;
}

/** Default configuration with safety constraints */
export const DEFAULT_CRAWL_CONFIG: Omit<CrawlConfig, 'baseUrl' | 'projectId'> = {
  maxPages: 50,
  maxDepth: 3,
  requestDelay: 1000, // 1 request per second minimum
  timeout: 30000,
  userAgent: 'SEO-Audit-Bot/1.0 (respectful crawler; +https://www.vib.com.vn/seo-audit)',
  respectRobotsTxt: true,
  sameDomainOnly: true,
  enableJsRendering: false,
  storeRawHtml: false,
  retryCount: 2,
  backoffDelay: 2000,
};

// =============================================================================
// ROBOTS.TXT
// =============================================================================

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

export interface RobotsTxtData {
  /** Rules per user-agent */
  userAgents: Map<string, RobotsRules>;
  
  /** Sitemap URLs found */
  sitemaps: string[];
  
  /** Crawl delay in ms (if specified) */
  crawlDelay?: number;
  
  /** Raw content for debugging */
  rawContent?: string;
  
  /** Fetch timestamp */
  fetchedAt: Date;
}

// =============================================================================
// PAGE DATA
// =============================================================================

export interface PageSEOData {
  /** Unique identifier */
  id?: string;
  
  /** Project ID */
  projectId: string;
  
  /** Full URL of the page */
  url: string;
  
  /** HTTP status code */
  statusCode: number;
  
  /** Response time in ms */
  responseTime: number;
  
  /** Page title */
  title?: string;
  
  /** Title length */
  titleLength?: number;
  
  /** Meta description */
  metaDescription?: string;
  
  /** Meta description length */
  metaDescriptionLength?: number;
  
  /** Canonical URL */
  canonicalUrl?: string;
  
  /** Is self-referencing canonical */
  isSelfCanonical?: boolean;
  
  /** Meta robots directives */
  metaRobots?: string;
  
  /** Has noindex directive */
  hasNoindex: boolean;
  
  /** Has nofollow directive */
  hasNofollow: boolean;
  
  /** HTML lang attribute */
  language?: string;
  
  /** H1 headings (array) */
  h1Tags: string[];
  
  /** H1 count */
  h1Count: number;
  
  /** H2 headings */
  h2Tags: string[];
  
  /** H2 count */
  h2Count: number;
  
  /** H3 headings */
  h3Tags: string[];
  
  /** H3 count */
  h3Count: number;
  
  /** Word count of main content */
  wordCount: number;
  
  /** Content length in bytes */
  contentLength: number;
  
  /** Internal links found on page */
  internalLinks: string[];
  
  /** Internal links count */
  internalLinksCount: number;
  
  /** External links found on page */
  externalLinks: string[];
  
  /** External links count */
  externalLinksCount: number;
  
  /** Images data */
  images: ImageSEOData[];
  
  /** Images count */
  imagesCount: number;
  
  /** Images without alt count */
  imagesWithoutAlt: number;
  
  /** Open Graph data */
  openGraph?: OpenGraphData;
  
  /** Has Open Graph tags */
  hasOpenGraph: boolean;
  
  /** Structured data (JSON-LD) */
  structuredData?: object[];
  
  /** Has structured data */
  hasStructuredData: boolean;
  
  /** Content hash for change detection */
  contentHash: string;
  
  /** Content type header */
  contentType?: string;
  
  /** Crawl depth from start URL */
  crawlDepth: number;
  
  /** Timestamp of crawl */
  crawledAt: Date;
  
  /** SEO issues found */
  issues: SEOIssue[];
  
  /** Raw HTML (optional, if storeRawHtml enabled) */
  rawHtml?: string;
}

export interface ImageSEOData {
  src: string;
  alt?: string;
  hasAlt: boolean;
  isExternal: boolean;
  width?: number;
  height?: number;
}

export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  url?: string;
  siteName?: string;
}

// =============================================================================
// SEO ISSUES
// =============================================================================

export interface SEOIssue {
  type: SEOIssueType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
  recommendation?: string;
}

export type SEOIssueType =
  // Title issues
  | 'missing_title'
  | 'title_too_long'
  | 'title_too_short'
  | 'duplicate_title'
  // Meta description issues
  | 'missing_meta_description'
  | 'meta_description_too_long'
  | 'meta_description_too_short'
  | 'duplicate_meta_description'
  // Heading issues
  | 'missing_h1'
  | 'multiple_h1'
  | 'empty_h1'
  // Canonical issues
  | 'missing_canonical'
  | 'invalid_canonical'
  // Indexing issues
  | 'noindex_page'
  | 'blocked_by_robots'
  // Content issues
  | 'thin_content'
  | 'no_content'
  // Image issues
  | 'missing_alt_text'
  | 'empty_alt_text'
  // Technical issues
  | 'slow_response'
  | 'server_error'
  | 'client_error'
  | 'redirect'
  // Structured data
  | 'missing_structured_data'
  | 'missing_open_graph'
  // Language
  | 'missing_lang_attribute';

// =============================================================================
// CRAWL JOB
// =============================================================================

export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CrawlJob {
  id: string;
  projectId: string;
  config: CrawlConfig;
  status: CrawlStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalUrlsDiscovered: number;
  crawledPages: number;
  failedPages: number;
  skippedPages: number;
  errorMessage?: string;
  createdAt: Date;
}

export interface CrawlProgress {
  jobId: string;
  status: CrawlStatus;
  totalUrlsDiscovered: number;
  crawledPages: number;
  failedPages: number;
  skippedPages: number;
  currentUrl?: string;
  queueSize: number;
  estimatedTimeRemaining?: number;
  pagesPerMinute: number;
  elapsedTime: number;
}

// =============================================================================
// CRAWL RESULT
// =============================================================================

export interface CrawlResult {
  job: CrawlJob;
  pages: PageSEOData[];
  summary: CrawlSummary;
  robotsTxt?: RobotsTxtData;
}

export interface CrawlSummary {
  // General stats
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  skippedPages: number;
  
  // Timing
  totalCrawlTime: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  
  // Content
  avgWordCount: number;
  avgContentLength: number;
  
  // Links
  totalInternalLinks: number;
  totalExternalLinks: number;
  uniqueInternalLinks: number;
  
  // Images
  totalImages: number;
  imagesWithoutAlt: number;
  altTextCoverage: number;
  
  // SEO Issues
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  issuesByType: Map<SEOIssueType, number>;
  
  // Content issues
  pagesWithoutTitle: number;
  pagesWithoutMetaDescription: number;
  pagesWithoutH1: number;
  pagesWithMultipleH1: number;
  pagesWithThinContent: number;
  pagesWithNoindex: number;
  
  // Duplicates
  duplicateTitles: number;
  duplicateDescriptions: number;
  
  // Status codes
  statusCodeDistribution: Map<number, number>;
}

// =============================================================================
// URL QUEUE
// =============================================================================

export interface QueuedUrl {
  url: string;
  depth: number;
  priority: number;
  addedAt: Date;
  sourceUrl?: string;
}

// =============================================================================
// EVENTS
// =============================================================================

export type CrawlEventType = 
  | 'crawl:start'
  | 'crawl:progress'
  | 'crawl:page'
  | 'crawl:skip'
  | 'crawl:error'
  | 'crawl:complete'
  | 'crawl:cancel';

export interface CrawlEvent {
  type: CrawlEventType;
  timestamp: Date;
  data: CrawlProgress | PageSEOData | CrawlResult | Error | { url: string; reason: string };
}

export type CrawlEventCallback = (event: CrawlEvent) => void;
