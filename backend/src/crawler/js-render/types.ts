/**
 * JS Render Types
 * 
 * Type definitions for browser-rendered HTML crawling
 */

export type RenderMode = 'html' | 'js_rendered';

export type ViewportType = 'mobile' | 'desktop';

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent: string;
}

export interface RenderOptions {
  viewport: ViewportType;
  timeout: number;
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle';
  waitForSelector?: string;
  waitForTimeout?: number;
  blockResources?: ('image' | 'stylesheet' | 'font' | 'media')[];
  /** SEO-ready wait configuration per § 10.4 */
  seoReadyConfig?: {
    maxWaitTime?: number;
    pollInterval?: number;
    /** § 10.2.1: Require valid title */
    requireTitle?: boolean;
    /** § 10.2.2: Require valid meta description */
    requireMetaDescription?: boolean;
    /** § 10.2.3: Require valid H1 */
    requireH1?: boolean;
    /** § 10.2.4: Require canonical (or self-canonical) */
    requireCanonical?: boolean;
    /** Page URL for self-canonical check */
    pageUrl?: string;
    debug?: boolean;
  };
}

export interface RenderDecision {
  shouldRender: boolean;
  reason: RenderDecisionReason;
  confidence: number; // 0-1
}

export type RenderDecisionReason =
  | 'config_force_js_render'
  | 'missing_title'
  | 'placeholder_title'
  | 'missing_h1'
  | 'spa_indicator'
  | 'heavy_js_detected'
  | 'known_spa_framework'
  | 'no_render_needed'
  | 'url_pattern_match';

export interface RawHtmlAnalysis {
  hasTitle: boolean;
  titleContent: string | null;
  isPlaceholderTitle: boolean;
  hasH1: boolean;
  h1Content: string | null;
  hasMetaDescription: boolean;
  metaDescriptionContent: string | null;
  spaIndicators: SpaIndicator[];
  jsFrameworkDetected: string | null;
  scriptCount: number;
  inlineScriptSize: number;
  externalScriptCount: number;
}

export interface SpaIndicator {
  type: 'root_div' | 'empty_body' | 'noscript_warning' | 'spa_framework' | 'heavy_js';
  selector?: string;
  details?: string;
}

export interface RenderedDom {
  html: string;
  url: string;
  finalUrl: string; // After redirects
  renderMode: RenderMode;
  viewport: ViewportType;
  renderTime: number; // ms
  timestamp: string;
  // Enhanced timing metrics
  timing?: RenderTimingMetrics;
}

/**
 * Detailed render timing metrics for debugging and transparency
 */
export interface RenderTimingMetrics {
  timeToDomReady: number;        // DOMContentLoaded event (ms)
  timeToNetworkIdle: number;     // Network idle state (ms)
  timeToSeoReady: number;        // SEO elements present (ms)
  totalRenderTime: number;       // Total from navigation start (ms)
  seoReadyTimedOut: boolean;     // Whether SEO wait timed out
}

/**
 * Source of an SEO element (raw HTML or JS-rendered)
 */
export type MetaSource = 'raw_html' | 'js_rendered' | 'not_found';

export interface ExtractedSeoData {
  // Meta tags
  title: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  canonical: string | null;
  robots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  
  // Heading structure
  h1: string[];
  h2: string[];
  h3: string[];
  headingStructure: HeadingNode[];
  
  // Links
  internalLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];
  
  // Content
  visibleTextLength: number;
  wordCount: number;
  
  // Structured data
  jsonLd: JsonLdData[];
  
  // Technical
  hasNoindex: boolean;
  hasNofollow: boolean;
  language: string | null;
  charset: string | null;
  
  // Render info
  renderMode: RenderMode;
  renderTime: number;
  
  // Meta source tracking per § 10.6 Signal Source Attribution
  metaSource?: {
    title: MetaSource;
    metaDescription: MetaSource;
    canonical: MetaSource;
    h1: MetaSource;
  };
  
  // Render timing details
  renderTiming?: RenderTimingMetrics;
}

export interface HeadingNode {
  level: number; // 1-6
  text: string;
  children?: HeadingNode[];
}

export interface ExtractedLink {
  href: string;
  text: string;
  rel: string | null;
  isNofollow: boolean;
  isSponsored: boolean;
  isUgc: boolean;
}

export interface JsonLdData {
  type: string;
  raw: Record<string, unknown>;
}

export interface SeoAnalysisResult {
  url: string;
  renderMode: RenderMode;
  extractedData: ExtractedSeoData;
  issues: SeoIssue[];
  score: number; // 0-100
  timestamp: string;
}

export interface SeoIssue {
  type: SeoIssueType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  recommendation?: string;
}

export type SeoIssueType =
  | 'missing_title'
  | 'title_too_short'
  | 'title_too_long'
  | 'duplicate_title'
  | 'missing_meta_description'
  | 'meta_description_too_short'
  | 'meta_description_too_long'
  | 'missing_h1'
  | 'multiple_h1'
  | 'h1_too_short'      // § 10.2.3: H1 must be ≥5 chars
  | 'h1_too_long'
  | 'heading_hierarchy_broken'
  | 'missing_canonical'
  | 'noindex_detected'
  | 'thin_content'
  | 'no_internal_links'
  | 'missing_lang_attribute'
  | 'missing_structured_data'
  | 'broken_structured_data';

export interface CrawlPageResult {
  url: string;
  statusCode: number;
  renderMode: RenderMode;
  rawHtml?: string;
  renderedHtml?: string;
  seoData: ExtractedSeoData;
  seoAnalysis: SeoAnalysisResult;
  loadTime: number;
  renderTime: number;
  timestamp: string;
  error?: string;
}

export interface JsRenderConfig {
  enabled: boolean;
  forceJsRender: boolean;
  maxJsRenderPages: number;
  defaultViewport: ViewportType;
  timeout: number;
  browserPoolSize: number;
  blockResources: ('image' | 'stylesheet' | 'font' | 'media')[];
  urlPatterns: {
    alwaysRender: string[];
    neverRender: string[];
  };
}

export const DEFAULT_JS_RENDER_CONFIG: JsRenderConfig = {
  enabled: true,
  forceJsRender: false,
  maxJsRenderPages: 100,
  defaultViewport: 'mobile',
  timeout: 30000,
  browserPoolSize: 3,
  blockResources: ['image', 'font', 'media'],
  urlPatterns: {
    alwaysRender: [],
    neverRender: ['/api/', '/static/', '/assets/']
  }
};

export const VIEWPORT_CONFIGS: Record<ViewportType, ViewportConfig> = {
  mobile: {
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  desktop: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

/**
 * SEO thresholds per § 10.2 Mandatory SEO-Ready Signals
 * 
 * Note: These are ANALYSIS thresholds for quality assessment.
 * For SEO-ready VALIDATION thresholds, see seo_ready_waiter.ts SEO_SIGNAL_THRESHOLDS
 */
export const SEO_THRESHOLDS = {
  title: {
    // § 10.2.1: SEO-ready requires ≥10 chars
    // Analysis: Google displays ~50-60 chars
    minLength: 10,           // § 10.2.1 minimum (for SEO-ready)
    maxLength: 60,
    optimalLength: { min: 50, max: 60 }
  },
  metaDescription: {
    // § 10.2.2: SEO-ready requires ≥50 chars
    // Analysis: Google displays ~155-160 chars
    minLength: 50,           // § 10.2.2 minimum (for SEO-ready)
    maxLength: 160,
    optimalLength: { min: 120, max: 155 }
  },
  h1: {
    // § 10.2.3: SEO-ready requires ≥5 chars
    minLength: 5,            // § 10.2.3 minimum (for SEO-ready)
    maxLength: 70
  },
  content: {
    minWordCount: 300,
    thinContentThreshold: 200
  }
};

// ==========================================
// SECTION 9: Raw HTML vs Rendered DOM Diff
// ==========================================

/**
 * Diff category for comparing raw HTML vs rendered DOM
 */
export type DiffCategory = 
  | 'ADDED_BY_JS'       // Present only in rendered DOM
  | 'MISSING_IN_RENDER' // Present in raw HTML but missing after render
  | 'CHANGED_BY_JS'     // Present in both but different values
  | 'IDENTICAL';        // No difference

/**
 * JS Dependency Risk Level
 */
export type JsDependencyRisk = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Individual element diff result
 */
export interface ElementDiff {
  category: DiffCategory;
  rawValue: string | number | null;
  renderedValue: string | number | null;
}

/**
 * Links count comparison
 */
export interface LinksDiff {
  category: DiffCategory;
  raw: number;
  rendered: number;
  difference: number;
  percentChange: number;
}

/**
 * Diff summary comparing raw HTML vs rendered DOM
 */
export interface DiffSummary {
  title: DiffCategory;
  metaDescription: DiffCategory;
  canonical: DiffCategory;
  robots: DiffCategory;
  h1: DiffCategory;
  h1Count: {
    raw: number;
    rendered: number;
  };
  internalLinks: LinksDiff;
  externalLinks: LinksDiff;
  structuredData: DiffCategory;
  structuredDataTypes: {
    raw: string[];
    rendered: string[];
  };
  visibleTextLength: {
    raw: number;
    rendered: number;
    difference: number;
  };
}

/**
 * Detailed diff with actual values
 */
export interface DetailedDiff {
  title: ElementDiff;
  metaDescription: ElementDiff;
  canonical: ElementDiff;
  robots: ElementDiff;
  h1: ElementDiff;
  internalLinks: LinksDiff;
  externalLinks: LinksDiff;
  structuredData: ElementDiff;
}

/**
 * Full diff report for a crawled URL
 */
export interface DiffReport {
  url: string;
  renderMode: RenderMode;
  diffSummary: DiffSummary;
  detailedDiff: DetailedDiff;
  jsDependencyRisk: JsDependencyRisk;
  riskFactors: string[];
  timestamp: string;
}

/**
 * Updated CrawlPageResult with diff report
 */
export interface CrawlPageResultWithDiff extends CrawlPageResult {
  diffReport?: DiffReport;
}
