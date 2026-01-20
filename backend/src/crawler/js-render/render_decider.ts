/**
 * Render Decider
 * 
 * Decides whether a URL needs JS rendering based on:
 * - Raw HTML analysis
 * - SPA indicators
 * - Project configuration
 * - URL patterns
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cheerio = require('cheerio');
import {
  RenderDecision,
  RenderDecisionReason,
  RawHtmlAnalysis,
  SpaIndicator,
  JsRenderConfig,
  DEFAULT_JS_RENDER_CONFIG
} from './types';

// Common placeholder titles that indicate JS-rendered content
const PLACEHOLDER_TITLES = [
  'loading',
  'loading...',
  'please wait',
  'untitled',
  'document',
  'react app',
  'vue app',
  'angular',
  'app',
  'web app',
  'single page application',
  'spa',
  '{{',
  '${',
  '__title__',
  '%title%'
];

// SPA framework indicators
const SPA_FRAMEWORK_INDICATORS = [
  { name: 'React', patterns: ['__NEXT_DATA__', 'data-reactroot', '_reactRootContainer', '__REACT_DEVTOOLS'] },
  { name: 'Vue', patterns: ['__VUE__', 'data-v-', '__vue__', 'Vue.js'] },
  { name: 'Angular', patterns: ['ng-version', 'ng-app', '_nghost', '_ngcontent', 'angular.js'] },
  { name: 'Svelte', patterns: ['__svelte', 'svelte-'] },
  { name: 'Nuxt', patterns: ['__NUXT__', 'nuxt'] },
  { name: 'Gatsby', patterns: ['___gatsby', 'gatsby-'] },
  { name: 'Next.js', patterns: ['__NEXT_DATA__', 'next/'] },
];

// Root div selectors commonly used by SPAs
const SPA_ROOT_SELECTORS = [
  '#app',
  '#root',
  '#__next',
  '#__nuxt',
  '#main-app',
  '#application',
  '[data-reactroot]',
  '[ng-app]',
  '[ng-controller]'
];

export class RenderDecider {
  private config: JsRenderConfig;

  constructor(config: Partial<JsRenderConfig> = {}) {
    this.config = { ...DEFAULT_JS_RENDER_CONFIG, ...config };
  }

  /**
   * Decide whether a URL needs JS rendering
   */
  decide(url: string, rawHtml: string): RenderDecision {
    // Check if JS rendering is disabled
    if (!this.config.enabled) {
      return {
        shouldRender: false,
        reason: 'no_render_needed',
        confidence: 1.0
      };
    }

    // Check URL patterns
    const patternDecision = this.checkUrlPatterns(url);
    if (patternDecision) {
      return patternDecision;
    }

    // Check force JS render config
    if (this.config.forceJsRender) {
      return {
        shouldRender: true,
        reason: 'config_force_js_render',
        confidence: 1.0
      };
    }

    // Analyze raw HTML
    const analysis = this.analyzeRawHtml(rawHtml);

    // Decision logic based on analysis
    return this.makeDecision(analysis);
  }

  /**
   * Check URL against configured patterns
   */
  private checkUrlPatterns(url: string): RenderDecision | null {
    const { alwaysRender, neverRender } = this.config.urlPatterns;

    // Check never render patterns first
    for (const pattern of neverRender) {
      if (url.includes(pattern) || this.matchPattern(url, pattern)) {
        return {
          shouldRender: false,
          reason: 'url_pattern_match',
          confidence: 1.0
        };
      }
    }

    // Check always render patterns
    for (const pattern of alwaysRender) {
      if (url.includes(pattern) || this.matchPattern(url, pattern)) {
        return {
          shouldRender: true,
          reason: 'url_pattern_match',
          confidence: 1.0
        };
      }
    }

    return null;
  }

  /**
   * Match URL against glob-like pattern
   */
  private matchPattern(url: string, pattern: string): boolean {
    // Convert simple glob to regex
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\//g, '\\/')
    );
    return regex.test(url);
  }

  /**
   * Analyze raw HTML for SPA indicators
   */
  analyzeRawHtml(html: string): RawHtmlAnalysis {
    const $ = cheerio.load(html);
    const analysis: RawHtmlAnalysis = {
      hasTitle: false,
      titleContent: null,
      isPlaceholderTitle: false,
      hasH1: false,
      h1Content: null,
      hasMetaDescription: false,
      metaDescriptionContent: null,
      spaIndicators: [],
      jsFrameworkDetected: null,
      scriptCount: 0,
      inlineScriptSize: 0,
      externalScriptCount: 0
    };

    // Check title
    const titleEl = $('title');
    if (titleEl.length > 0) {
      analysis.hasTitle = true;
      analysis.titleContent = titleEl.text().trim();
      analysis.isPlaceholderTitle = this.isPlaceholderTitle(analysis.titleContent ?? '');
    }

    // Check H1
    const h1El = $('h1');
    if (h1El.length > 0) {
      analysis.hasH1 = true;
      analysis.h1Content = h1El.first().text().trim();
    }

    // Check meta description
    const metaDesc = $('meta[name="description"]');
    if (metaDesc.length > 0) {
      analysis.hasMetaDescription = true;
      analysis.metaDescriptionContent = metaDesc.attr('content') ?? null;
    }

    // Count scripts
    const scripts = $('script');
    analysis.scriptCount = scripts.length;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scripts.each((_: number, el: any) => {
      const script = $(el);
      if (script.attr('src')) {
        analysis.externalScriptCount++;
      } else {
        analysis.inlineScriptSize += (script.html() ?? '').length;
      }
    });

    // Check for SPA indicators
    analysis.spaIndicators = this.detectSpaIndicators($, html);

    // Detect JS framework
    analysis.jsFrameworkDetected = this.detectJsFramework(html);

    return analysis;
  }

  /**
   * Check if title is a placeholder
   */
  private isPlaceholderTitle(title: string): boolean {
    if (!title) return true;
    
    const normalizedTitle = title.toLowerCase().trim();
    
    // Check against known placeholders
    if (PLACEHOLDER_TITLES.some(p => normalizedTitle.includes(p))) {
      return true;
    }

    // Check for template syntax
    if (/\{\{.*\}\}|\$\{.*\}|%.*%/.test(title)) {
      return true;
    }

    // Very short titles might be placeholders
    if (normalizedTitle.length < 3) {
      return true;
    }

    return false;
  }

  /**
   * Detect SPA indicators in the HTML
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private detectSpaIndicators($: any, html: string): SpaIndicator[] {
    const indicators: SpaIndicator[] = [];

    // Check for SPA root divs
    for (const selector of SPA_ROOT_SELECTORS) {
      const el = $(selector);
      if (el.length > 0) {
        const innerHTML = el.html() ?? '';
        // Empty or minimal content in root div
        if (innerHTML.trim().length < 50) {
          indicators.push({
            type: 'root_div',
            selector,
            details: `Root div ${selector} has minimal content`
          });
        }
      }
    }

    // Check for empty body
    const bodyContent = $('body').text().trim();
    if (bodyContent.length < 100) {
      indicators.push({
        type: 'empty_body',
        details: `Body has only ${bodyContent.length} characters of text`
      });
    }

    // Check for noscript warning
    const noscript = $('noscript').text().toLowerCase();
    if (noscript.includes('javascript') || noscript.includes('enable')) {
      indicators.push({
        type: 'noscript_warning',
        details: 'Page has noscript warning about JavaScript'
      });
    }

    // Check for heavy JS
    const scripts = $('script');
    let totalJsSize = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scripts.each((_: number, el: any) => {
      const script = $(el);
      totalJsSize += (script.html() ?? '').length;
    });

    if (totalJsSize > 50000 || scripts.length > 20) {
      indicators.push({
        type: 'heavy_js',
        details: `Heavy JS detected: ${scripts.length} scripts, ~${Math.round(totalJsSize / 1024)}KB inline`
      });
    }

    // Check for SPA framework
    for (const framework of SPA_FRAMEWORK_INDICATORS) {
      for (const pattern of framework.patterns) {
        if (html.includes(pattern)) {
          indicators.push({
            type: 'spa_framework',
            details: `${framework.name} framework detected (${pattern})`
          });
          break;
        }
      }
    }

    return indicators;
  }

  /**
   * Detect which JS framework is being used
   */
  private detectJsFramework(html: string): string | null {
    for (const framework of SPA_FRAMEWORK_INDICATORS) {
      for (const pattern of framework.patterns) {
        if (html.includes(pattern)) {
          return framework.name;
        }
      }
    }
    return null;
  }

  /**
   * Make final render decision based on analysis
   */
  private makeDecision(analysis: RawHtmlAnalysis): RenderDecision {
    // Missing title - high confidence need for rendering
    if (!analysis.hasTitle) {
      return {
        shouldRender: true,
        reason: 'missing_title',
        confidence: 0.9
      };
    }

    // Placeholder title - high confidence
    if (analysis.isPlaceholderTitle) {
      return {
        shouldRender: true,
        reason: 'placeholder_title',
        confidence: 0.85
      };
    }

    // Missing H1 - medium confidence
    if (!analysis.hasH1) {
      return {
        shouldRender: true,
        reason: 'missing_h1',
        confidence: 0.7
      };
    }

    // SPA framework detected - high confidence
    if (analysis.jsFrameworkDetected) {
      return {
        shouldRender: true,
        reason: 'known_spa_framework',
        confidence: 0.8
      };
    }

    // Multiple SPA indicators
    const significantIndicators = analysis.spaIndicators.filter(
      i => i.type !== 'heavy_js'
    );

    if (significantIndicators.length >= 2) {
      return {
        shouldRender: true,
        reason: 'spa_indicator',
        confidence: 0.75
      };
    }

    // Heavy JS alone - lower confidence
    if (analysis.spaIndicators.some(i => i.type === 'heavy_js')) {
      return {
        shouldRender: true,
        reason: 'heavy_js_detected',
        confidence: 0.5
      };
    }

    // No rendering needed
    return {
      shouldRender: false,
      reason: 'no_render_needed',
      confidence: 0.9
    };
  }

  /**
   * Get detailed analysis for debugging
   */
  getDetailedAnalysis(url: string, rawHtml: string): {
    decision: RenderDecision;
    analysis: RawHtmlAnalysis;
  } {
    const analysis = this.analyzeRawHtml(rawHtml);
    const decision = this.decide(url, rawHtml);
    
    return { decision, analysis };
  }
}

export default RenderDecider;
