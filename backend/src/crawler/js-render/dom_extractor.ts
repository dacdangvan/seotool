/**
 * DOM Extractor
 * 
 * Extracts SEO-relevant data from rendered DOM HTML.
 * Works with both raw HTML and JS-rendered HTML.
 * 
 * IMPORTANT: Supports meta_source tracking for transparency (Section 9).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cheerio = require('cheerio');

import {
  ExtractedSeoData,
  ExtractedLink,
  HeadingNode,
  JsonLdData,
  RenderMode,
  MetaSource,
  RenderTimingMetrics
} from './types';

/**
 * Options for extraction with comparison support
 */
export interface ExtractOptions {
  /** Raw HTML extraction result for comparison */
  rawExtraction?: Partial<ExtractedSeoData>;
  /** Render timing metrics */
  renderTiming?: RenderTimingMetrics;
}

export class DomExtractor {
  /**
   * Extract all SEO-relevant data from HTML
   */
  extract(
    html: string, 
    baseUrl: string, 
    renderMode: RenderMode = 'html',
    renderTime = 0,
    options: ExtractOptions = {}
  ): ExtractedSeoData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $: any = cheerio.load(html);
    
    const title = this.extractTitle($);
    const metaDescription = this.extractMetaContent($, 'description');
    const canonical = this.extractCanonical($, baseUrl); // Pass baseUrl for § 10.5 normalization
    const h1 = this.extractHeadings($, 'h1');

    // Calculate meta sources for transparency
    const metaSource = this.calculateMetaSources(
      { title, metaDescription, canonical, h1 },
      options.rawExtraction,
      renderMode
    );

    return {
      // Meta tags
      title,
      metaDescription,
      metaKeywords: this.extractMetaContent($, 'keywords'),
      canonical,
      robots: this.extractMetaContent($, 'robots'),
      ogTitle: this.extractMetaProperty($, 'og:title'),
      ogDescription: this.extractMetaProperty($, 'og:description'),
      ogImage: this.extractMetaProperty($, 'og:image'),

      // Headings
      h1,
      h2: this.extractHeadings($, 'h2'),
      h3: this.extractHeadings($, 'h3'),
      headingStructure: this.extractHeadingStructure($),

      // Links
      ...this.extractLinks($, baseUrl),

      // Content
      visibleTextLength: this.extractVisibleTextLength($),
      wordCount: this.extractWordCount($),

      // Structured data
      jsonLd: this.extractJsonLd($),

      // Technical
      hasNoindex: this.hasNoindex($),
      hasNofollow: this.hasNofollow($),
      language: this.extractLanguage($),
      charset: this.extractCharset($),

      // Render info
      renderMode,
      renderTime,
      
      // Meta source tracking (Section 9 transparency)
      metaSource,
      
      // Render timing
      renderTiming: options.renderTiming
    };
  }
  
  /**
   * Calculate meta sources for transparency
   * Determines whether each SEO element came from raw HTML or JS rendering
   */
  private calculateMetaSources(
    current: { 
      title: string | null; 
      metaDescription: string | null; 
      canonical: string | null; 
      h1: string[];
    },
    rawExtraction: Partial<ExtractedSeoData> | undefined,
    renderMode: RenderMode
  ): ExtractedSeoData['metaSource'] {
    // For HTML-only mode, source is always raw_html or not_found
    if (renderMode === 'html') {
      return {
        title: current.title ? 'raw_html' : 'not_found',
        metaDescription: current.metaDescription ? 'raw_html' : 'not_found',
        canonical: current.canonical ? 'raw_html' : 'not_found',
        h1: current.h1.length > 0 ? 'raw_html' : 'not_found'
      };
    }
    
    // For JS-rendered mode, compare with raw extraction
    const determineSource = (
      currentValue: string | string[] | null,
      rawValue: string | string[] | null | undefined
    ): MetaSource => {
      const hasCurrentValue = Array.isArray(currentValue) 
        ? currentValue.length > 0 
        : !!currentValue;
      const hasRawValue = Array.isArray(rawValue)
        ? rawValue.length > 0
        : !!rawValue;
      
      if (!hasCurrentValue) return 'not_found';
      if (hasRawValue) return 'raw_html';
      return 'js_rendered';
    };
    
    return {
      title: determineSource(current.title, rawExtraction?.title),
      metaDescription: determineSource(current.metaDescription, rawExtraction?.metaDescription),
      canonical: determineSource(current.canonical, rawExtraction?.canonical),
      h1: determineSource(current.h1, rawExtraction?.h1)
    };
  }

  /**
   * Extract page title
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTitle($: any): string | null {
    const title = $('title').first().text().trim();
    return title || null;
  }

  /**
   * Extract meta content by name
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractMetaContent($: any, name: string): string | null {
    const content = $(`meta[name="${name}"]`).attr('content');
    return content?.trim() || null;
  }

  /**
   * Extract meta property (OpenGraph)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractMetaProperty($: any, property: string): string | null {
    const content = $(`meta[property="${property}"]`).attr('content');
    return content?.trim() || null;
  }

  /**
   * Extract canonical URL per § 10.5 Signal Validation Rules:
   * - Normalize URL
   * - Remove tracking parameters
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractCanonical($: any, pageUrl?: string): string | null {
    const href = $('link[rel="canonical"]').attr('href');
    if (!href?.trim()) return null;
    
    try {
      // § 10.5: Normalize URL
      const baseUrl = pageUrl || 'https://example.com';
      const canonicalUrl = new URL(href.trim(), baseUrl);
      
      // § 10.5: Remove common tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
      trackingParams.forEach(param => canonicalUrl.searchParams.delete(param));
      
      return canonicalUrl.href;
    } catch {
      // Return original if URL parsing fails
      return href.trim();
    }
  }

  /**
   * Extract headings by tag
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractHeadings($: any, tag: string): string[] {
    const headings: string[] = [];
    $(tag).each((_: number, el: unknown) => {
      const text = $(el).text().trim();
      if (text) {
        headings.push(text);
      }
    });
    return headings;
  }

  /**
   * Extract heading structure (hierarchy)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractHeadingStructure($: any): HeadingNode[] {
    const structure: HeadingNode[] = [];
    const headings: { level: number; text: string }[] = [];

    $('h1, h2, h3, h4, h5, h6').each((_: number, el: unknown) => {
      const tagName = $(el).prop('tagName')?.toLowerCase() || '';
      const level = parseInt(tagName.replace('h', ''), 10);
      const text = $(el).text().trim();
      
      if (text && !isNaN(level)) {
        headings.push({ level, text });
      }
    });

    // Build tree structure
    const stack: HeadingNode[] = [];
    
    for (const { level, text } of headings) {
      const node: HeadingNode = { level, text };
      
      // Find parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        structure.push(node);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      }

      stack.push(node);
    }

    return structure;
  }

  /**
   * Extract internal and external links
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractLinks($: any, baseUrl: string): {
    internalLinks: ExtractedLink[];
    externalLinks: ExtractedLink[];
  } {
    const internalLinks: ExtractedLink[] = [];
    const externalLinks: ExtractedLink[] = [];
    const seenHrefs = new Set<string>();

    let baseDomain: string;
    try {
      baseDomain = new URL(baseUrl).hostname.replace(/^www\./, '');
    } catch {
      baseDomain = '';
    }

    $('a[href]').each((_: number, el: unknown) => {
      const $el = $(el);
      const href = $el.attr('href')?.trim();
      
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      // Normalize URL
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, baseUrl).href;
      } catch {
        return; // Invalid URL
      }

      // Deduplicate
      if (seenHrefs.has(absoluteUrl)) {
        return;
      }
      seenHrefs.add(absoluteUrl);

      const rel = $el.attr('rel') ?? null;
      const relValues = rel?.toLowerCase().split(/\s+/) ?? [];

      const link: ExtractedLink = {
        href: absoluteUrl,
        text: $el.text().trim(),
        rel,
        isNofollow: relValues.includes('nofollow'),
        isSponsored: relValues.includes('sponsored'),
        isUgc: relValues.includes('ugc')
      };

      // Determine if internal or external
      try {
        const linkDomain = new URL(absoluteUrl).hostname.replace(/^www\./, '');
        if (linkDomain === baseDomain) {
          internalLinks.push(link);
        } else {
          externalLinks.push(link);
        }
      } catch {
        // If URL parsing fails, treat as external
        externalLinks.push(link);
      }
    });

    return { internalLinks, externalLinks };
  }

  /**
   * Extract visible text length
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractVisibleTextLength($: any): number {
    // Remove script, style, and hidden elements
    $('script, style, noscript, [hidden], [style*="display:none"], [style*="display: none"]').remove();
    
    const text = $('body').text();
    return text.replace(/\s+/g, ' ').trim().length;
  }

  /**
   * Extract word count
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractWordCount($: any): number {
    // Remove script, style, and hidden elements
    const $clone = cheerio.load($.html());
    $clone('script, style, noscript, [hidden]').remove();
    
    const text = $clone('body').text();
    const words = text.split(/\s+/).filter((w: string) => w.length > 0);
    return words.length;
  }

  /**
   * Extract JSON-LD structured data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractJsonLd($: any): JsonLdData[] {
    const jsonLdData: JsonLdData[] = [];

    $('script[type="application/ld+json"]').each((_: number, el: unknown) => {
      const content = $(el).html();
      if (!content) return;

      try {
        const data = JSON.parse(content) as Record<string, unknown>;
        
        // Handle single object
        if (data['@type']) {
          jsonLdData.push({
            type: String(data['@type']),
            raw: data
          });
        }
        
        // Handle @graph array
        if (Array.isArray(data['@graph'])) {
          for (const item of data['@graph']) {
            if (item && typeof item === 'object' && '@type' in item) {
              jsonLdData.push({
                type: String((item as Record<string, unknown>)['@type']),
                raw: item as Record<string, unknown>
              });
            }
          }
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    });

    return jsonLdData;
  }

  /**
   * Check for noindex directive
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hasNoindex($: any): boolean {
    const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase() ?? '';
    const googlebotMeta = $('meta[name="googlebot"]').attr('content')?.toLowerCase() ?? '';
    
    return robotsMeta.includes('noindex') || googlebotMeta.includes('noindex');
  }

  /**
   * Check for nofollow directive
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hasNofollow($: any): boolean {
    const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase() ?? '';
    const googlebotMeta = $('meta[name="googlebot"]').attr('content')?.toLowerCase() ?? '';
    
    return robotsMeta.includes('nofollow') || googlebotMeta.includes('nofollow');
  }

  /**
   * Extract language attribute
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractLanguage($: any): string | null {
    const htmlLang = $('html').attr('lang');
    const contentLanguage = $('meta[http-equiv="content-language"]').attr('content');
    
    return htmlLang?.trim() || contentLanguage?.trim() || null;
  }

  /**
   * Extract charset
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractCharset($: any): string | null {
    const metaCharset = $('meta[charset]').attr('charset');
    const contentType = $('meta[http-equiv="Content-Type"]').attr('content');
    
    if (metaCharset) {
      return metaCharset.trim();
    }
    
    if (contentType) {
      const match = contentType.match(/charset=([^\s;]+)/i);
      return match?.[1]?.trim() || null;
    }
    
    return null;
  }
}

export default DomExtractor;
