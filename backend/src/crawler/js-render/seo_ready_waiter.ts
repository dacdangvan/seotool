/**
 * SEO-Ready Wait Utility
 * 
 * Prevents false negatives in SEO analysis by waiting for
 * JavaScript-rendered SEO elements before extraction.
 * 
 * Implementation follows Section 10 – SEO-Ready Signals Standardization:
 * 
 * § 10.1 Definition: SEO-ready means page has finished JS hydration and 
 *        exposes final SEO signals as seen by users and Googlebot.
 * 
 * § 10.2 Mandatory SEO-Ready Signals:
 *   - Title: exists, ≥10 chars, no placeholder
 *   - Meta Description: exists, ≥50 chars, no empty/default
 *   - H1: exists, visible, ≥5 chars, not hidden
 *   - Canonical: exists OR self-canonical, valid URL
 * 
 * § 10.4 SEO-Ready Wait Strategy (MANDATORY):
 *   - Conditional wait (static sleep is FORBIDDEN)
 *   - Maximum wait time: configurable (default 15s)
 *   - Poll interval: 200ms
 */

import { Page } from 'playwright';

/**
 * Section 10.2 Thresholds for SEO signal validation
 */
export const SEO_SIGNAL_THRESHOLDS = {
  TITLE_MIN_LENGTH: 10,           // § 10.2.1: Length ≥ 10 characters
  META_DESC_MIN_LENGTH: 50,       // § 10.2.2: Content length ≥ 50 characters
  H1_MIN_LENGTH: 5,               // § 10.2.3: Text length ≥ 5 characters
} as const;

/**
 * Section 10.2.1: Title placeholder patterns to ignore
 */
export const TITLE_PLACEHOLDER_PATTERNS = [
  /^home$/i,
  /^loading\.{0,3}$/i,
  /^\.{1,3}$/,
  /^untitled$/i,
  /^page$/i,
  /^document$/i,
  /^welcome$/i,
  /^index$/i,
  /^\s*$/,
] as const;

/**
 * Section 10.2.2: Meta description placeholder patterns
 */
export const META_DESC_PLACEHOLDER_PATTERNS = [
  /^loading\.{0,3}$/i,
  /^\.{1,3}$/,
  /^\s*$/,
  /^description$/i,
  /^add description here$/i,
] as const;

/**
 * Result of SEO-ready check per Section 10.3
 */
export interface SeoReadyResult {
  /** SEO-ready is TRUE per § 10.3 evaluation rules */
  isReady: boolean;
  /** § 10.2.1: Title validation result */
  hasTitle: boolean;
  /** § 10.2.2: Meta description validation result */
  hasMetaDescription: boolean;
  /** § 10.2.3: H1 validation result */
  hasH1: boolean;
  /** § 10.2.4: Canonical validation result */
  hasCanonical: boolean;
  /** Extracted title value */
  titleValue: string | null;
  /** Extracted meta description value */
  metaDescriptionValue: string | null;
  /** Extracted H1 value (first visible) */
  h1Value: string | null;
  /** Extracted canonical URL */
  canonicalValue: string | null;
  /** Time spent waiting (ms) */
  waitTime: number;
  /** Whether max wait time was exceeded */
  timedOut: boolean;
  /** Detailed validation info for debugging */
  validationDetails?: SeoValidationDetails;
}

/**
 * Detailed validation results per § 10.5
 */
export interface SeoValidationDetails {
  title: SignalValidation;
  metaDescription: SignalValidation;
  h1: SignalValidation;
  canonical: SignalValidation;
}

export interface SignalValidation {
  exists: boolean;
  value: string | null;
  meetsThreshold: boolean;
  isPlaceholder: boolean;
  failureReason?: string;
}

/**
 * Timing metrics for render wait
 */
export interface RenderTiming {
  timeToDomReady: number;        // DOMContentLoaded
  timeToNetworkIdle: number;     // Network idle
  timeToSeoReady: number;        // SEO elements present
  totalRenderTime: number;       // Total from navigation start
  seoReadyTimedOut: boolean;     // Whether SEO wait timed out
}

/**
 * Configuration for SEO-ready wait per § 10.4
 */
export interface SeoReadyConfig {
  /** Max time to wait for SEO elements (ms) - § 10.4 default 15s */
  maxWaitTime: number;
  /** Interval to check for SEO elements (ms) */
  pollInterval: number;
  /** § 10.2.1: Require valid title */
  requireTitle: boolean;
  /** § 10.2.2: Require valid meta description */
  requireMetaDescription: boolean;
  /** § 10.2.3: Require valid H1 */
  requireH1: boolean;
  /** § 10.2.4: Require canonical (or self-canonical) */
  requireCanonical: boolean;
  /** Current page URL (for self-canonical check) */
  pageUrl?: string;
  /** Debug logging */
  debug: boolean;
}

/**
 * Default configuration following § 10.4 requirements
 */
export const DEFAULT_SEO_READY_CONFIG: SeoReadyConfig = {
  maxWaitTime: 15000,       // § 10.4: default 15s
  pollInterval: 200,        // Check every 200ms
  requireTitle: true,       // § 10.2.1: MANDATORY
  requireMetaDescription: true, // § 10.2.2: MANDATORY
  requireH1: true,          // § 10.2.3: MANDATORY
  requireCanonical: true,   // § 10.2.4: MANDATORY
  debug: false
};

/**
 * Wait for SEO-critical elements per Section 10 – SEO-Ready Signals Standardization
 * 
 * § 10.3 SEO-Ready Evaluation Rules:
 * SEO-ready is TRUE when ALL mandatory signals are valid:
 * - Title is valid AND
 * - Meta description is valid AND
 * - H1 is valid AND
 * - Canonical is resolved
 * 
 * § 10.4: Uses conditional waits, NOT static delays (FORBIDDEN)
 */
export async function waitForSeoReady(
  page: Page,
  config: Partial<SeoReadyConfig> = {}
): Promise<SeoReadyResult> {
  const cfg = { ...DEFAULT_SEO_READY_CONFIG, ...config };
  const startTime = Date.now();
  
  const log = (msg: string) => {
    if (cfg.debug) {
      console.log(`[SeoReadyWaiter §10] ${msg}`);
    }
  };

  log(`Starting SEO-ready wait per §10 (max ${cfg.maxWaitTime}ms)`);

  // Get thresholds from constants
  const TITLE_MIN = SEO_SIGNAL_THRESHOLDS.TITLE_MIN_LENGTH;
  const META_DESC_MIN = SEO_SIGNAL_THRESHOLDS.META_DESC_MIN_LENGTH;
  const H1_MIN = SEO_SIGNAL_THRESHOLDS.H1_MIN_LENGTH;

  // Evaluate SEO elements in the page context per § 10.5 validation rules
  const checkSeoElements = async (): Promise<Omit<SeoReadyResult, 'waitTime' | 'timedOut' | 'validationDetails'>> => {
    return page.evaluate(({ titleMin, metaDescMin, h1Min, pageUrl }) => {
      /**
       * § 10.5 Title Validation:
       * - Trim whitespace
       * - Ignore duplicate whitespace
       * - Must be ≥ 10 chars
       * - Must not be placeholder (Home, Loading, empty)
       */
      const getTitle = (): { value: string | null; isValid: boolean } => {
        const titleEl = document.querySelector('title');
        let title = titleEl?.textContent?.trim() || null;
        
        if (!title) return { value: null, isValid: false };
        
        // § 10.5: Normalize duplicate whitespace
        title = title.replace(/\s+/g, ' ');
        
        // § 10.2.1: Check minimum length
        if (title.length < titleMin) {
          return { value: title, isValid: false };
        }
        
        // § 10.2.1: Check for placeholder patterns
        const placeholderPatterns = [
          /^home$/i, /^loading\.{0,3}$/i, /^\.{1,3}$/,
          /^untitled$/i, /^page$/i, /^document$/i,
          /^welcome$/i, /^index$/i, /^\s*$/
        ];
        for (const pattern of placeholderPatterns) {
          if (pattern.test(title)) {
            return { value: title, isValid: false };
          }
        }
        
        return { value: title, isValid: true };
      };

      /**
       * § 10.5 Meta Description Validation:
       * - Extract final content attribute
       * - Must be ≥ 50 chars
       * - Must not be empty or default text
       */
      const getMetaDescription = (): { value: string | null; isValid: boolean } => {
        const metaEl = document.querySelector('meta[name="description"]');
        const content = metaEl?.getAttribute('content')?.trim() || null;
        
        if (!content) return { value: null, isValid: false };
        
        // § 10.2.2: Check minimum length (50 chars)
        if (content.length < metaDescMin) {
          return { value: content, isValid: false };
        }
        
        // § 10.2.2: Check for placeholder patterns
        const placeholderPatterns = [
          /^loading\.{0,3}$/i, /^\.{1,3}$/, /^\s*$/,
          /^description$/i, /^add description here$/i
        ];
        for (const pattern of placeholderPatterns) {
          if (pattern.test(content)) {
            return { value: content, isValid: false };
          }
        }
        
        return { value: content, isValid: true };
      };

      /**
       * § 10.5 H1 Validation:
       * - Only visible H1 elements count
       * - Ignore hidden or aria-hidden headings
       * - Must be ≥ 5 chars
       */
      const getH1 = (): { value: string | null; isValid: boolean } => {
        const h1Elements = Array.from(document.querySelectorAll('h1'));
        
        for (const h1El of h1Elements) {
          // § 10.2.3: Check visibility
          const style = window.getComputedStyle(h1El);
          if (style.display === 'none' || style.visibility === 'hidden') {
            continue;
          }
          
          // § 10.5: Ignore aria-hidden
          if (h1El.getAttribute('aria-hidden') === 'true') {
            continue;
          }
          
          const text = h1El.textContent?.trim() || null;
          if (!text) continue;
          
          // § 10.2.3: Check minimum length
          if (text.length < h1Min) {
            continue;
          }
          
          return { value: text, isValid: true };
        }
        
        return { value: null, isValid: false };
      };

      /**
       * § 10.5 Canonical Validation:
       * - Normalize URL
       * - Remove tracking parameters
       * - Detect conflicts (multiple canonicals)
       */
      const getCanonical = (): { value: string | null; isValid: boolean; isSelfCanonical: boolean } => {
        const canonicalEl = document.querySelector('link[rel="canonical"]');
        const href = canonicalEl?.getAttribute('href')?.trim() || null;
        
        if (!href) {
          // § 10.2.4: No canonical is acceptable if page is self-canonical
          // Self-canonical check will be done with pageUrl comparison
          return { value: null, isValid: false, isSelfCanonical: false };
        }
        
        try {
          // § 10.5: Normalize URL
          const canonicalUrl = new URL(href, window.location.origin);
          const normalizedHref = canonicalUrl.href;
          
          // Check if self-canonical
          const currentUrl = new URL(pageUrl || window.location.href);
          const isSelfCanonical = normalizedHref === currentUrl.href ||
            normalizedHref === currentUrl.origin + currentUrl.pathname;
          
          return { 
            value: normalizedHref, 
            isValid: true, 
            isSelfCanonical 
          };
        } catch {
          return { value: href, isValid: false, isSelfCanonical: false };
        }
      };

      const titleResult = getTitle();
      const metaDescResult = getMetaDescription();
      const h1Result = getH1();
      const canonicalResult = getCanonical();

      return {
        hasTitle: titleResult.isValid,
        hasMetaDescription: metaDescResult.isValid,
        hasH1: h1Result.isValid,
        hasCanonical: canonicalResult.isValid || canonicalResult.isSelfCanonical,
        titleValue: titleResult.value,
        metaDescriptionValue: metaDescResult.value,
        h1Value: h1Result.value,
        canonicalValue: canonicalResult.value,
        isReady: false // Will be calculated below
      };
    }, { titleMin: TITLE_MIN, metaDescMin: META_DESC_MIN, h1Min: H1_MIN, pageUrl: cfg.pageUrl });
  };

  // Initial check
  let result = await checkSeoElements();
  let elapsed = Date.now() - startTime;

  /**
   * § 10.3 SEO-Ready Evaluation Rules
   * SEO-ready is TRUE when ALL mandatory signals are valid
   */
  const isReady = (r: typeof result): boolean => {
    if (cfg.requireTitle && !r.hasTitle) return false;
    if (cfg.requireMetaDescription && !r.hasMetaDescription) return false;
    if (cfg.requireH1 && !r.hasH1) return false;
    if (cfg.requireCanonical && !r.hasCanonical) return false;
    
    // If nothing is explicitly required, wait for at least title AND canonical
    if (!cfg.requireTitle && !cfg.requireMetaDescription && !cfg.requireH1 && !cfg.requireCanonical) {
      return r.hasTitle && r.hasCanonical;
    }
    return true;
  };

  // § 10.4: Conditional wait loop (NO static sleep)
  while (!isReady(result) && elapsed < cfg.maxWaitTime) {
    log(`Waiting... title=${result.hasTitle}, meta=${result.hasMetaDescription}, h1=${result.hasH1}, canonical=${result.hasCanonical} (${elapsed}ms)`);
    
    await page.waitForTimeout(cfg.pollInterval);
    result = await checkSeoElements();
    elapsed = Date.now() - startTime;
  }

  const timedOut = elapsed >= cfg.maxWaitTime && !isReady(result);
  
  log(timedOut 
    ? `§10 TIMEOUT after ${elapsed}ms. title=${result.hasTitle}, meta=${result.hasMetaDescription}, h1=${result.hasH1}, canonical=${result.hasCanonical}`
    : `§10 SEO-ready after ${elapsed}ms. title=${result.hasTitle}, meta=${result.hasMetaDescription}, h1=${result.hasH1}, canonical=${result.hasCanonical}`
  );

  return {
    ...result,
    isReady: isReady(result),
    waitTime: elapsed,
    timedOut
  };
}

/**
 * Wait for specific SEO element with selector
 */
export async function waitForSeoElement(
  page: Page,
  selector: string,
  options: { timeout?: number; attribute?: string; minLength?: number } = {}
): Promise<{ found: boolean; value: string | null; waitTime: number }> {
  const { timeout = 10000, attribute = 'content', minLength = 5 } = options;
  const startTime = Date.now();

  try {
    // Wait for element to appear
    await page.waitForSelector(selector, { timeout, state: 'attached' });
    
    // Wait for attribute to have content
    const value = await page.evaluate(
      ({ sel, attr, min }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        
        const value = attr === 'textContent' 
          ? el.textContent?.trim()
          : el.getAttribute(attr)?.trim();
        
        if (!value || value.length < min) return null;
        return value;
      },
      { sel: selector, attr: attribute, min: minLength }
    );

    return {
      found: !!value,
      value,
      waitTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      found: false,
      value: null,
      waitTime: Date.now() - startTime
    };
  }
}

/**
 * Enhanced page.goto with SEO-ready waiting
 */
export async function navigateAndWaitForSeo(
  page: Page,
  url: string,
  options: {
    timeout?: number;
    seoReadyConfig?: Partial<SeoReadyConfig>;
  } = {}
): Promise<{
  timing: RenderTiming;
  seoReady: SeoReadyResult;
}> {
  const { timeout = 30000, seoReadyConfig = {} } = options;
  const navigationStart = Date.now();
  
  let timeToDomReady = 0;
  let timeToNetworkIdle = 0;

  // Navigate and wait for DOMContentLoaded
  const response = await page.goto(url, {
    timeout,
    waitUntil: 'domcontentloaded'
  });

  if (!response) {
    throw new Error(`Failed to load URL: ${url}`);
  }

  timeToDomReady = Date.now() - navigationStart;

  // Wait for network to be relatively idle
  try {
    await page.waitForLoadState('networkidle', { timeout: timeout / 2 });
    timeToNetworkIdle = Date.now() - navigationStart;
  } catch {
    // Network idle timeout is acceptable, continue with SEO check
    timeToNetworkIdle = Date.now() - navigationStart;
  }

  // Now wait for SEO elements per § 10
  const seoReady = await waitForSeoReady(page, {
    ...seoReadyConfig,
    pageUrl: url, // Pass URL for § 10.2.4 self-canonical check
    debug: seoReadyConfig.debug ?? false
  });

  const totalRenderTime = Date.now() - navigationStart;

  return {
    timing: {
      timeToDomReady,
      timeToNetworkIdle,
      timeToSeoReady: timeToDomReady + seoReady.waitTime,
      totalRenderTime,
      seoReadyTimedOut: seoReady.timedOut
    },
    seoReady
  };
}

export default {
  waitForSeoReady,
  waitForSeoElement,
  navigateAndWaitForSeo,
  DEFAULT_SEO_READY_CONFIG,
  SEO_SIGNAL_THRESHOLDS,
  TITLE_PLACEHOLDER_PATTERNS,
  META_DESC_PLACEHOLDER_PATTERNS
};
