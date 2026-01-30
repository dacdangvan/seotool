/**
 * Crawl Data Types
 * 
 * Types for SEO crawl results display in frontend
 */

// SEO Issue severity
export type SEOIssueSeverity = 'critical' | 'warning' | 'info';

// SEO Issue type
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
  | 'thin_content'
  | 'noindex'
  | 'images_without_alt'
  | 'slow_response'
  | 'server_error'
  | 'client_error';

// Single SEO issue
export interface SEOIssue {
  type: SEOIssueType;
  severity: SEOIssueSeverity;
  message: string;
  details?: string;
}

// Image data
export interface ImageSEOData {
  src: string;
  alt: string;
  hasAlt: boolean;
  isExternal: boolean;
}

// Single page SEO data
export interface PageSEOData {
  projectId: string;
  url: string;
  statusCode: number;
  responseTime: number;
  loadTime: number; // Total page load time (loadEventEnd - navigationStart)
  
  // Meta tags
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaRobots: string | null;
  canonical: string | null;
  hasNoindex: boolean;
  hasNofollow: boolean;
  language: string | null;
  
  // Headings
  h1Tags: string[];
  h1Count: number;
  h2Tags: string[];
  h2Count: number;
  h3Tags: string[];
  h3Count: number;
  
  // Content
  wordCount: number;
  contentLength: number;
  
  // Links
  internalLinks: string[];
  internalLinksCount: number;
  externalLinks: string[];
  externalLinksCount: number;
  
  // Images
  images: ImageSEOData[];
  imagesCount: number;
  imagesWithoutAlt: number;
  
  // Issues
  issues: SEOIssue[];
  
  // Metadata
  crawledAt: string;
  depth: number;
}

// Crawl job configuration
export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  requestDelay: number;
  timeout: number;
  userAgent: string;
  baseUrl: string;
}

// Crawl job status
export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Crawl job
export interface CrawlJob {
  id: string;
  projectId: string;
  config: CrawlConfig;
  status: CrawlStatus;
  totalUrlsDiscovered: number;
  crawledPages: number;
  failedPages: number;
  skippedPages: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

// Crawl summary statistics
export interface CrawlSummary {
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  skippedPages: number;
  totalCrawlTime: number;
  
  // Performance
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
  
  // Issues
  totalIssues: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  issuesByType: Record<string, number>;
  
  // Meta issues
  pagesWithoutTitle: number;
  pagesWithoutMetaDescription: number;
  pagesWithoutH1: number;
  pagesWithMultipleH1: number;
  pagesWithThinContent: number;
  pagesWithNoindex: number;
  duplicateTitles: number;
  duplicateDescriptions: number;
  
  // Status codes
  statusCodeDistribution: Record<number, number>;
}

// Complete crawl result
export interface CrawlResult {
  job: CrawlJob;
  pages: PageSEOData[];
  summary: CrawlSummary;
}
