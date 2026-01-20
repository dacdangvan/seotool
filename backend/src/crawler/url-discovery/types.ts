/**
 * URL Discovery Types
 * 
 * Type definitions for Section 11 – Auto URL Discovery & Full SEO Crawl Pipeline
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6
 */

/**
 * § 11.4 URL Inventory States
 * Each URL MUST be tracked with a lifecycle state
 */
export type UrlInventoryState = 
  | 'DISCOVERED'        // URL found but not yet queued
  | 'QUEUED_FOR_CRAWL'  // In crawl queue
  | 'CRAWLED'           // Successfully crawled
  | 'FAILED'            // Crawl failed
  | 'BLOCKED_BY_POLICY'; // Excluded by rules

/**
 * § 11.2 URL Discovery Sources
 */
export type UrlDiscoverySource = 
  | 'HOMEPAGE'          // From homepage crawl
  | 'INTERNAL_LINK'     // From recursive internal link discovery
  | 'SITEMAP'           // From sitemap.xml
  | 'RENDERED_DOM'      // From JS-rendered page
  | 'SEED';             // Initial seed URL

/**
 * URL Inventory Entry per § 11
 */
export interface UrlInventoryEntry {
  /** Original discovered URL */
  originalUrl: string;
  /** Normalized URL per § 11.3 */
  normalizedUrl: string;
  /** Current state per § 11.4 */
  state: UrlInventoryState;
  /** Discovery source per § 11.2 */
  source: UrlDiscoverySource;
  /** Depth from seed URL */
  depth: number;
  /** Parent URL that led to discovery */
  parentUrl: string | null;
  /** Canonical URL (if discovered) */
  canonicalUrl: string | null;
  /** Discovery timestamp */
  discoveredAt: Date;
  /** Last state change timestamp */
  updatedAt: Date;
  /** Crawl attempt count */
  crawlAttempts: number;
  /** Last crawl timestamp (if crawled) */
  lastCrawledAt: Date | null;
  /** Error message (if failed) */
  errorMessage: string | null;
  /** Render mode used (if crawled) */
  renderMode: 'html_only' | 'js_rendered' | null;
  /** HTTP status code (if crawled) */
  statusCode: number | null;
  /** Policy block reason (if blocked) */
  blockReason: string | null;
}

/**
 * § 11.3 URL Normalization Options
 */
export interface UrlNormalizationConfig {
  /** Enforce HTTPS */
  enforceHttps: boolean;
  /** Preserve language paths (e.g., /vi/, /en/) */
  preserveLanguagePaths: boolean;
  /** Tracking parameters to remove */
  trackingParams: string[];
  /** Remove trailing slash */
  removeTrailingSlash: boolean;
  /** Remove default ports (80, 443) */
  removeDefaultPorts: boolean;
  /** Remove fragment/hash */
  removeFragment: boolean;
  /** Lowercase host */
  lowercaseHost: boolean;
}

/**
 * § 11.5 Crawl Scope Configuration
 */
export interface CrawlScopeConfig {
  /** Maximum crawl depth from seed */
  maxDepth: number;
  /** Maximum total URLs to crawl */
  maxUrls: number;
  /** Maximum URLs per minute (rate limit) */
  maxUrlsPerMinute: number;
  /** Include subdomains */
  includeSubdomains: boolean;
  /** URL patterns to exclude */
  excludePatterns: string[];
  /** URL patterns to include (whitelist mode) */
  includePatterns: string[];
  /** Respect robots.txt */
  respectRobotsTxt: boolean;
}

/**
 * URL Discovery Job Configuration
 */
export interface UrlDiscoveryConfig {
  /** Project identifier */
  projectId: string;
  /** Seed URL (homepage) */
  seedUrl: string;
  /** Domain to crawl */
  domain: string;
  /** Normalization config */
  normalization: UrlNormalizationConfig;
  /** Crawl scope config */
  scope: CrawlScopeConfig;
  /** Enable sitemap discovery */
  useSitemap: boolean;
  /** Enable JS rendering for link discovery */
  useJsRendering: boolean;
  /** Maximum concurrent requests */
  concurrency: number;
  /** Request timeout (ms) */
  timeout: number;
  /** User agent string */
  userAgent: string;
}

/**
 * § 11.8 Crawl Progress Statistics
 */
export interface UrlDiscoveryStats {
  /** Total URLs discovered */
  totalDiscovered: number;
  /** URLs by state */
  byState: Record<UrlInventoryState, number>;
  /** URLs by source */
  bySource: Record<UrlDiscoverySource, number>;
  /** Crawl coverage percentage */
  crawlCoverage: number;
  /** Current depth reached */
  maxDepthReached: number;
  /** Discovery started at */
  startedAt: Date;
  /** Discovery completed at */
  completedAt: Date | null;
  /** Current phase */
  phase: UrlDiscoveryPhase;
  /** Errors encountered */
  errorCount: number;
}

/**
 * Discovery Phase
 */
export type UrlDiscoveryPhase = 
  | 'INITIALIZING'
  | 'SITEMAP_DISCOVERY'
  | 'HOMEPAGE_CRAWL'
  | 'LINK_DISCOVERY'
  | 'COMPLETED'
  | 'PAUSED'
  | 'FAILED';

/**
 * Discovery Job Result
 */
export interface UrlDiscoveryResult {
  /** Job ID */
  jobId: string;
  /** Project ID */
  projectId: string;
  /** Final stats */
  stats: UrlDiscoveryStats;
  /** All discovered URLs */
  urls: UrlInventoryEntry[];
  /** Sitemap URLs found */
  sitemapUrls: string[];
  /** Robots.txt content */
  robotsTxt: string | null;
  /** Errors */
  errors: DiscoveryError[];
}

/**
 * Discovery Error
 */
export interface DiscoveryError {
  url: string;
  error: string;
  phase: UrlDiscoveryPhase;
  timestamp: Date;
}

/**
 * Default configuration values
 */
export const DEFAULT_NORMALIZATION_CONFIG: UrlNormalizationConfig = {
  enforceHttps: true,
  preserveLanguagePaths: true,
  trackingParams: [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
    '_ga', '_gl', 'ref', 'source', 'track', 'tracking_id',
  ],
  removeTrailingSlash: false, // Keep - important for SEO
  removeDefaultPorts: true,
  removeFragment: true,
  lowercaseHost: true,
};

export const DEFAULT_SCOPE_CONFIG: CrawlScopeConfig = {
  maxDepth: 10,
  maxUrls: 10000,
  maxUrlsPerMinute: 60,
  includeSubdomains: false,
  excludePatterns: [
    '/login', '/logout', '/signin', '/signout', '/register', '/signup',
    '/auth', '/oauth', '/api/', '/admin', '/wp-admin', '/cgi-bin',
    '/cart', '/checkout', '/my-account', '/profile', '/settings', '/dashboard',
    '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
    '.zip', '.rar', '.exe', '.doc', '.docx', '.xls', '.xlsx',
  ],
  includePatterns: [],
  respectRobotsTxt: true,
};

export const DEFAULT_DISCOVERY_CONFIG: Partial<UrlDiscoveryConfig> = {
  normalization: DEFAULT_NORMALIZATION_CONFIG,
  scope: DEFAULT_SCOPE_CONFIG,
  useSitemap: true,
  useJsRendering: true,
  concurrency: 5,
  timeout: 30000,
  userAgent: 'VIB-SEO-Crawler/2.6 (Section 11 Auto URL Discovery)',
};
