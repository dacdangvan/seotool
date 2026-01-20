/**
 * URL Discovery Module Index
 * 
 * Section 11 – Auto URL Discovery & Full SEO Crawl Pipeline
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6
 * 
 * This module MUST be used before any SEO crawl or analysis.
 * 
 * § 11.1 Core Principle:
 * SEO crawling MUST follow this order:
 * 1. Discover all valid public URLs
 * 2. Build a canonical URL graph
 * 3. Crawl each URL with SEO-ready validation
 * 4. Store and analyze SEO signals
 */

// Types
export * from './types';

// URL Normalizer
export { UrlNormalizer, createUrlNormalizer } from './url_normalizer';

// URL Inventory Store
export { 
  InMemoryUrlInventoryStore, 
  createUrlInventoryStore 
} from './url_inventory_store';
export type { IUrlInventoryStore } from './url_inventory_store';

// URL Discovery Engine
export { 
  UrlDiscoveryEngine, 
  createUrlDiscoveryEngine 
} from './url_discovery_engine';
export type { UrlDiscoveryEngineConfig } from './url_discovery_engine';

// Full SEO Crawl Pipeline (§ 11.6)
export {
  FullSeoCrawlPipeline,
  createFullSeoCrawlPipeline,
  validateUrlInInventory,
} from './full_seo_crawl_pipeline';
export type {
  FullSeoCrawlConfig,
  FullSeoCrawlResult,
  UrlCrawlResult,
  PipelinePhase,
  PipelineProgress,
} from './full_seo_crawl_pipeline';
