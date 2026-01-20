/**
 * JS Render Module Index
 * 
 * Browser-rendered HTML crawling for SPA/JS-heavy websites
 * Includes Section 9 Diff Report functionality
 * Includes Section 10 SEO-Ready Signals Standardization
 */

// Types
export * from './types';

// Core components
export { JsRenderEngine, getJsRenderEngine, closeJsRenderEngine } from './js_render_engine';
export { RenderDecider } from './render_decider';
export { DomExtractor } from './dom_extractor';
export type { ExtractOptions } from './dom_extractor';
export { SeoAnalyzer } from './seo_analyzer';

// Section 10: SEO-ready wait utility (prevents false negatives for JS-rendered meta tags)
export { 
  waitForSeoReady, 
  waitForSeoElement, 
  navigateAndWaitForSeo,
  DEFAULT_SEO_READY_CONFIG,
  SEO_SIGNAL_THRESHOLDS,
  TITLE_PLACEHOLDER_PATTERNS,
  META_DESC_PLACEHOLDER_PATTERNS
} from './seo_ready_waiter';
export type { 
  SeoReadyResult, 
  SeoReadyConfig,
  RenderTiming,
  SeoValidationDetails,
  SignalValidation
} from './seo_ready_waiter';

// Section 9: Diff Report
export { HtmlDomDiffer, htmlDomDiffer } from './html_dom_differ';
export { DiffRiskClassifier, diffRiskClassifier } from './diff_risk_classifier';

// Main crawler
export { RenderedCrawler, createRenderedCrawler } from './rendered_crawler';
export type { RenderedCrawlerConfig, CrawlOptions } from './rendered_crawler';
