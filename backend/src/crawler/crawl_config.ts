/**
 * Crawl Configuration
 * 
 * Configurable crawl settings for full-site SEO audits
 */

export interface CrawlConfig {
  // ========= Crawl Limits =========
  /** Maximum pages to crawl (default: 300) */
  maxPages: number;
  
  /** Maximum crawl depth (default: 6) */
  maxDepth: number;
  
  /** Request rate limit in ms (default: 1000 = 1 req/sec) */
  rateLimit: number;
  
  /** Request timeout in ms (default: 30000) */
  timeout: number;

  // ========= Sitemap Settings =========
  /** Enable sitemap-first crawling (default: true) */
  useSitemap: boolean;
  
  /** Maximum sitemaps to parse (default: 50) */
  maxSitemaps: number;
  
  /** Sitemap fetch timeout in ms (default: 30000) */
  sitemapTimeout: number;

  // ========= URL Discovery =========
  /** Follow links discovered in HTML (default: true) */
  followLinks: boolean;
  
  /** Respect robots.txt (default: true) */
  respectRobotsTxt: boolean;

  // ========= Safety Settings =========
  /** Abort crawl if error rate exceeds this (default: 0.3 = 30%) */
  maxErrorRate: number;
  
  /** Minimum pages before checking error rate (default: 10) */
  minPagesForErrorCheck: number;
  
  /** Maximum consecutive errors before abort (default: 10) */
  maxConsecutiveErrors: number;

  // ========= User Agent =========
  userAgent: string;
  
  // ========= JS Rendering (optional) =========
  /** Enable JS rendering for some pages (default: false) */
  enableJsRendering: boolean;
  
  /** Max pages to JS-render per crawl (default: 20) */
  maxJsRenderPages: number;
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  // Crawl Limits
  maxPages: 300,
  maxDepth: 6,
  rateLimit: 1000, // 1 request per second
  timeout: 30000,

  // Sitemap Settings
  useSitemap: true,
  maxSitemaps: 50,
  sitemapTimeout: 30000,

  // URL Discovery
  followLinks: true,
  respectRobotsTxt: true,

  // Safety Settings
  maxErrorRate: 0.3,
  minPagesForErrorCheck: 10,
  maxConsecutiveErrors: 10,

  // User Agent
  userAgent: 'VIB-SEO-Crawler/1.0 (+https://vib.com.vn/bot)',

  // JS Rendering
  enableJsRendering: false,
  maxJsRenderPages: 20,
};

/**
 * Preset configurations for different crawl scenarios
 */
export const CRAWL_PRESETS = {
  // Quick audit - small sample
  quick: {
    ...DEFAULT_CRAWL_CONFIG,
    maxPages: 50,
    maxDepth: 3,
    useSitemap: true,
    followLinks: false,
  },

  // Standard audit - balanced
  standard: {
    ...DEFAULT_CRAWL_CONFIG,
    maxPages: 300,
    maxDepth: 6,
  },

  // Full audit - comprehensive
  full: {
    ...DEFAULT_CRAWL_CONFIG,
    maxPages: 1000,
    maxDepth: 10,
    maxSitemaps: 100,
  },

  // Sitemap only - no link following
  sitemapOnly: {
    ...DEFAULT_CRAWL_CONFIG,
    maxPages: 500,
    useSitemap: true,
    followLinks: false,
  },
};

export type CrawlPreset = keyof typeof CRAWL_PRESETS;

/**
 * Get crawl config from preset or custom
 */
export function getCrawlConfig(
  preset: CrawlPreset | 'custom' = 'standard',
  customConfig: Partial<CrawlConfig> = {}
): CrawlConfig {
  const baseConfig = preset === 'custom' 
    ? DEFAULT_CRAWL_CONFIG 
    : CRAWL_PRESETS[preset];
    
  return { ...baseConfig, ...customConfig };
}

export default CrawlConfig;
