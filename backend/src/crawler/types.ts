/**
 * Crawler Types
 * 
 * Type definitions for web crawler module
 */

export interface CrawlConfig {
  /** Base URL to crawl (e.g., https://www.vib.com.vn) */
  baseUrl: string;
  
  /** Project ID this crawl belongs to */
  projectId: string;
  
  /** Maximum number of pages to crawl */
  maxPages?: number;
  
  /** Maximum depth of crawl (0 = only baseUrl) */
  maxDepth?: number;
  
  /** Delay between requests in ms */
  requestDelay?: number;
  
  /** Request timeout in ms */
  timeout?: number;
  
  /** User agent string */
  userAgent?: string;
  
  /** Respect robots.txt */
  respectRobotsTxt?: boolean;
  
  /** URL patterns to include (regex) */
  includePatterns?: string[];
  
  /** URL patterns to exclude (regex) */
  excludePatterns?: string[];
  
  /** Crawl only same domain */
  sameDomainOnly?: boolean;
}

export interface PageData {
  /** Unique ID */
  id?: string;
  
  /** Project ID */
  projectId: string;
  
  /** Full URL of the page */
  url: string;
  
  /** Canonical URL if different */
  canonicalUrl?: string;
  
  /** HTTP status code */
  statusCode: number;
  
  /** Response time in ms */
  responseTime: number;
  
  /** Page title */
  title?: string;
  
  /** Meta description */
  metaDescription?: string;
  
  /** Meta keywords */
  metaKeywords?: string;
  
  /** Meta robots directives */
  metaRobots?: string;
  
  /** Open Graph data */
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
  };
  
  /** H1 headings */
  h1Tags: string[];
  
  /** H2 headings */
  h2Tags: string[];
  
  /** H3 headings */
  h3Tags: string[];
  
  /** Word count of main content */
  wordCount: number;
  
  /** Internal links found on page */
  internalLinks: string[];
  
  /** External links found on page */
  externalLinks: string[];
  
  /** Images on page */
  images: ImageData[];
  
  /** Structured data (JSON-LD) */
  structuredData?: object[];
  
  /** Content hash for change detection */
  contentHash?: string;
  
  /** Last modified header */
  lastModified?: string;
  
  /** Content type */
  contentType?: string;
  
  /** Page size in bytes */
  pageSize: number;
  
  /** Crawl depth from start URL */
  crawlDepth: number;
  
  /** Timestamp of crawl */
  crawledAt: Date;
  
  /** SEO issues found */
  issues: SEOIssue[];
}

export interface ImageData {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  hasAlt: boolean;
  isExternal: boolean;
}

export interface SEOIssue {
  type: SEOIssueType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

export type SEOIssueType =
  | 'missing_title'
  | 'title_too_long'
  | 'title_too_short'
  | 'missing_meta_description'
  | 'meta_description_too_long'
  | 'meta_description_too_short'
  | 'missing_h1'
  | 'multiple_h1'
  | 'missing_canonical'
  | 'broken_link'
  | 'redirect_chain'
  | 'missing_alt_text'
  | 'thin_content'
  | 'duplicate_content'
  | 'slow_response'
  | 'missing_structured_data'
  | 'missing_open_graph'
  | 'noindex_page'
  | 'blocked_by_robots';

export interface CrawlJob {
  id: string;
  projectId: string;
  config: CrawlConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  totalPages: number;
  crawledPages: number;
  failedPages: number;
  errorMessage?: string;
  createdAt: Date;
}

export interface CrawlProgress {
  jobId: string;
  status: CrawlJob['status'];
  totalPages: number;
  crawledPages: number;
  failedPages: number;
  currentUrl?: string;
  estimatedTimeRemaining?: number;
  pagesPerMinute?: number;
}

export interface CrawlResult {
  job: CrawlJob;
  pages: PageData[];
  summary: CrawlSummary;
}

export interface CrawlSummary {
  totalPages: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  avgResponseTime: number;
  avgWordCount: number;
  totalInternalLinks: number;
  totalExternalLinks: number;
  totalImages: number;
  imagesWithoutAlt: number;
  pagesWithoutTitle: number;
  pagesWithoutMetaDescription: number;
  pagesWithoutH1: number;
  duplicateTitles: number;
  duplicateDescriptions: number;
}

export interface RobotsTxt {
  userAgents: Map<string, RobotsRules>;
  sitemaps: string[];
  crawlDelay?: number;
}

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}
