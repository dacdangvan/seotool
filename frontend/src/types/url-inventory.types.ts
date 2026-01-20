/**
 * URL Inventory Types
 * 
 * Types for Section 11 – Auto URL Discovery
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6
 */

/**
 * § 11.4 URL Inventory States
 */
export type UrlInventoryState =
  | 'DISCOVERED'
  | 'QUEUED_FOR_CRAWL'
  | 'CRAWLED'
  | 'FAILED'
  | 'BLOCKED_BY_POLICY';

/**
 * § 11.2 URL Discovery Sources
 */
export type UrlDiscoverySource =
  | 'HOMEPAGE'
  | 'INTERNAL_LINK'
  | 'SITEMAP'
  | 'RENDERED_DOM'
  | 'SEED';

/**
 * URL Inventory Entry (Frontend)
 */
export interface UrlInventoryItem {
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
  discoveredAt: string;
  /** Last state change timestamp */
  updatedAt: string;
  /** Crawl attempt count */
  crawlAttempts: number;
  /** Last crawl timestamp (if crawled) */
  lastCrawledAt: string | null;
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
 * § 11.8 URL Inventory Statistics
 */
export interface UrlInventoryStats {
  /** Total URLs discovered */
  totalDiscovered: number;
  /** URLs by state */
  byState: Record<UrlInventoryState, number>;
  /** URLs by source */
  bySource: Record<UrlDiscoverySource, number>;
  /** Crawl coverage percentage (crawled / total) */
  crawlCoverage: number;
  /** Maximum depth reached */
  maxDepthReached: number;
  /** Discovery started timestamp */
  startedAt: string | null;
  /** Discovery completed timestamp */
  completedAt: string | null;
  /** Current phase */
  phase: UrlDiscoveryPhase;
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
  | 'FAILED'
  | 'NOT_STARTED';

/**
 * Paginated URL Inventory Response
 */
export interface UrlInventoryResponse {
  /** URL inventory items */
  items: UrlInventoryItem[];
  /** Pagination info */
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  /** Statistics */
  stats: UrlInventoryStats;
}

/**
 * URL Inventory Query Filters
 */
export interface UrlInventoryFilters {
  /** Filter by state */
  state?: UrlInventoryState | 'all';
  /** Filter by source */
  source?: UrlDiscoverySource | 'all';
  /** Search query (URL pattern) */
  search?: string;
  /** Filter by depth */
  maxDepth?: number;
  /** Sort field */
  sortBy?: 'discoveredAt' | 'updatedAt' | 'depth' | 'url';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Crawl Coverage Summary
 * Per § 11.8 Frontend Transparency Requirements
 */
export interface CrawlCoverageSummary {
  /** Total URLs discovered */
  totalUrls: number;
  /** URLs successfully crawled */
  crawledUrls: number;
  /** Crawl coverage percentage */
  coveragePercent: number;
  /** URLs pending crawl */
  pendingUrls: number;
  /** URLs failed */
  failedUrls: number;
  /** URLs blocked by policy */
  blockedUrls: number;
  /** Is discovery complete? */
  discoveryComplete: boolean;
  /** Is crawl complete? */
  crawlComplete: boolean;
}

/**
 * State display configuration
 */
export const URL_STATE_CONFIG: Record<UrlInventoryState, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  DISCOVERED: {
    label: 'Discovered',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: 'URL found but not yet crawled',
  },
  QUEUED_FOR_CRAWL: {
    label: 'Queued',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'URL in crawl queue',
  },
  CRAWLED: {
    label: 'Crawled',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Successfully crawled',
  },
  FAILED: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Crawl failed',
  },
  BLOCKED_BY_POLICY: {
    label: 'Blocked',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Excluded by crawl policy',
  },
};

/**
 * Source display configuration
 */
export const URL_SOURCE_CONFIG: Record<UrlDiscoverySource, {
  label: string;
  icon: string;
  description: string;
}> = {
  SEED: {
    label: 'Seed',
    icon: 'Target',
    description: 'Initial seed URL',
  },
  HOMEPAGE: {
    label: 'Homepage',
    icon: 'Home',
    description: 'From homepage crawl',
  },
  INTERNAL_LINK: {
    label: 'Internal Link',
    icon: 'Link',
    description: 'From internal link discovery',
  },
  SITEMAP: {
    label: 'Sitemap',
    icon: 'Map',
    description: 'From sitemap.xml',
  },
  RENDERED_DOM: {
    label: 'Rendered DOM',
    icon: 'Globe',
    description: 'From JS-rendered page',
  },
};
