/**
 * Technical SEO Agent - Domain Models
 * 
 * Based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 3: Technical SEO Agent
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export enum RenderMode {
  HTML = 'html',
  JS = 'js',
}

export enum AuditStatus {
  PENDING = 'pending',
  CRAWLING = 'crawling',
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum IssueCategory {
  INDEXING = 'indexing',
  CANONICAL = 'canonical',
  DUPLICATE_CONTENT = 'duplicate_content',
  META_TAGS = 'meta_tags',
  HEADING_STRUCTURE = 'heading_structure',
  BROKEN_LINKS = 'broken_links',
  CORE_WEB_VITALS = 'core_web_vitals',
  ROBOTS = 'robots',
  STRUCTURED_DATA = 'structured_data',
}

// =============================================================================
// INPUT SCHEMAS (from Orchestrator)
// =============================================================================

/**
 * Technical Audit Task - Input from Orchestrator
 */
export const TechnicalAuditTaskSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  
  // Target website
  targetUrl: z.string().url(),
  
  // Crawl configuration
  crawlDepth: z.number().min(1).max(5).default(2),
  maxPages: z.number().min(1).max(100).default(20),
  
  // Render mode
  renderMode: z.nativeEnum(RenderMode).default(RenderMode.HTML),
  
  // Rate limiting
  requestDelayMs: z.number().min(100).max(5000).default(1000),
  
  // Options
  respectRobotsTxt: z.boolean().default(true),
  includeCoreWebVitals: z.boolean().default(true),
  userAgent: z.string().optional(),
  
  // Metadata
  createdAt: z.string().datetime().optional(),
});

export type TechnicalAuditTask = z.infer<typeof TechnicalAuditTaskSchema>;

// =============================================================================
// CRAWL MODELS
// =============================================================================

/**
 * Crawled page data
 */
export interface CrawledPage {
  url: string;
  statusCode: number;
  contentType: string;
  
  // HTML content
  html: string;
  
  // Parsed elements
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonicalUrl: string | null;
  
  // Headings
  h1: string[];
  h2: string[];
  h3: string[];
  
  // Links
  internalLinks: string[];
  externalLinks: string[];
  
  // Performance
  responseTimeMs: number;
  contentLength: number;
  
  // Crawl metadata
  depth: number;
  crawledAt: string;
}

/**
 * Crawl result
 */
export interface CrawlResult {
  startUrl: string;
  pages: CrawledPage[];
  robotsTxt: RobotsTxtInfo | null;
  crawlDurationMs: number;
  pagesFound: number;
  pagesCrawled: number;
  errors: CrawlError[];
}

/**
 * robots.txt info
 */
export interface RobotsTxtInfo {
  exists: boolean;
  content: string | null;
  sitemapUrls: string[];
  disallowedPaths: string[];
}

/**
 * Crawl error
 */
export interface CrawlError {
  url: string;
  error: string;
  statusCode?: number;
}

// =============================================================================
// ISSUE MODELS
// =============================================================================

/**
 * Detected SEO issue
 */
export interface SEOIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  
  // What was found
  title: string;
  description: string;
  
  // Where it was found
  affectedUrls: string[];
  
  // Evidence
  details: Record<string, unknown>;
  
  // Explainability
  impact: IssueImpact;
  
  // Suggested fix
  fix: IssueFix;
}

/**
 * Issue impact explanation
 */
export interface IssueImpact {
  summary: string;
  seoEffect: string;
  userEffect: string;
  ranking: 'direct' | 'indirect' | 'ux';
}

/**
 * Issue fix suggestion
 */
export interface IssueFix {
  summary: string;
  steps: string[];
  codeExamples?: CodeExample[];
}

/**
 * Code example for fix
 */
export interface CodeExample {
  language: 'html' | 'javascript' | 'nginx' | 'htaccess' | 'nextjs' | 'php';
  label: string;
  code: string;
}

// =============================================================================
// CORE WEB VITALS MODELS
// =============================================================================

/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  url: string;
  
  // LCP - Largest Contentful Paint
  lcp: MetricResult;
  
  // CLS - Cumulative Layout Shift
  cls: MetricResult;
  
  // INP - Interaction to Next Paint (replaces FID)
  inp: MetricResult | null;
  
  // Additional metrics
  fcp: MetricResult; // First Contentful Paint
  ttfb: MetricResult; // Time to First Byte
  si: MetricResult; // Speed Index
  tbt: MetricResult; // Total Blocking Time
  
  // Overall scores
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
}

/**
 * Individual metric result
 */
export interface MetricResult {
  value: number;
  unit: 'ms' | 's' | 'score';
  rating: 'good' | 'needs-improvement' | 'poor';
  percentile?: number;
}

// =============================================================================
// OUTPUT SCHEMAS (to Orchestrator)
// =============================================================================

/**
 * Technical Audit Result - Output to Orchestrator
 */
export interface TechnicalAuditResult {
  taskId: string;
  status: AuditStatus;
  
  // Crawl summary
  crawlSummary: {
    startUrl: string;
    pagesFound: number;
    pagesCrawled: number;
    crawlDurationMs: number;
    robotsTxtStatus: 'found' | 'not_found' | 'blocked';
  };
  
  // Detected issues
  issues: SEOIssue[];
  
  // Issue summary
  issueSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: Record<IssueCategory, number>;
  };
  
  // Core Web Vitals (if enabled)
  coreWebVitals: CoreWebVitals | null;
  
  // Timing
  processingTimeMs: number;
  
  // Error info
  error?: string;
  
  // Metadata
  metadata: {
    targetUrl: string;
    renderMode: RenderMode;
    maxPages: number;
    auditedAt: string;
  };
}

// =============================================================================
// INTERNAL MODELS
// =============================================================================

/**
 * Page analysis result
 */
export interface PageAnalysis {
  url: string;
  issues: SEOIssue[];
  metrics: {
    wordCount: number;
    imageCount: number;
    scriptCount: number;
    styleCount: number;
  };
}

/**
 * Detector context
 */
export interface DetectorContext {
  page: CrawledPage;
  allPages: CrawledPage[];
  robotsTxt: RobotsTxtInfo | null;
  config: TechnicalAuditTask;
}

/**
 * Detector result
 */
export interface DetectorResult {
  issues: SEOIssue[];
}
