/**
 * Core Web Vitals Analyzer
 * Analyzes CWV results and generates SEO issues
 */

import { v4 as uuid } from 'uuid';
import {
  CoreWebVitals,
  SEOIssue,
  IssueCategory,
  IssueSeverity,
} from '../models';

// Thresholds based on Google's CWV guidelines
// https://web.dev/vitals/
const CWV_THRESHOLDS = {
  lcp: {
    good: 2500, // 2.5s
    needsImprovement: 4000, // 4s
  },
  cls: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  inp: {
    good: 200, // 200ms
    needsImprovement: 500, // 500ms
  },
  fcp: {
    good: 1800, // 1.8s
    needsImprovement: 3000, // 3s
  },
  ttfb: {
    good: 800, // 800ms
    needsImprovement: 1800, // 1.8s
  },
  tbt: {
    good: 200, // 200ms
    needsImprovement: 600, // 600ms
  },
};

export class CWVAnalyzer {
  /**
   * Analyze Core Web Vitals and generate SEO issues
   */
  analyze(cwv: CoreWebVitals): SEOIssue[] {
    const issues: SEOIssue[] = [];

    // Check LCP
    if (cwv.lcp.rating !== 'good') {
      issues.push(this.createLCPIssue(cwv.url, cwv.lcp.value, cwv.lcp.rating));
    }

    // Check CLS
    if (cwv.cls.rating !== 'good') {
      issues.push(this.createCLSIssue(cwv.url, cwv.cls.value, cwv.cls.rating));
    }

    // Check INP
    if (cwv.inp && cwv.inp.rating !== 'good') {
      issues.push(this.createINPIssue(cwv.url, cwv.inp.value, cwv.inp.rating));
    }

    // Check overall performance score
    if (cwv.performanceScore < 50) {
      issues.push(this.createLowPerformanceIssue(cwv.url, cwv.performanceScore));
    }

    // Check TTFB
    if (cwv.ttfb.rating !== 'good') {
      issues.push(this.createTTFBIssue(cwv.url, cwv.ttfb.value, cwv.ttfb.rating));
    }

    // Check TBT
    if (cwv.tbt.rating !== 'good') {
      issues.push(this.createTBTIssue(cwv.url, cwv.tbt.value, cwv.tbt.rating));
    }

    return issues;
  }

  private createLCPIssue(
    url: string,
    value: number,
    rating: 'needs-improvement' | 'poor'
  ): SEOIssue {
    const severity = rating === 'poor' ? IssueSeverity.CRITICAL : IssueSeverity.HIGH;
    const valueSeconds = (value / 1000).toFixed(1);

    return {
      id: uuid(),
      category: IssueCategory.CORE_WEB_VITALS,
      severity,
      title: `Largest Contentful Paint is ${rating === 'poor' ? 'poor' : 'needs improvement'}`,
      description: `LCP is ${valueSeconds}s. Good LCP is under 2.5s, needs improvement is 2.5-4s, poor is over 4s.`,
      affectedUrls: [url],
      details: { metric: 'LCP', value, valueSeconds, threshold: CWV_THRESHOLDS.lcp },
      impact: {
        summary: 'LCP measures loading performance - how quickly the main content appears.',
        seoEffect: 'LCP is a Core Web Vital and a confirmed Google ranking factor. Poor LCP can negatively impact search rankings.',
        userEffect: 'Users perceive slow-loading pages as unresponsive, leading to higher bounce rates.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Optimize the largest content element to load faster.',
        steps: [
          'Identify the LCP element (usually a hero image or heading)',
          'Optimize images: Use modern formats (WebP/AVIF), proper sizing, lazy loading for below-fold images',
          'Preload critical resources: Add <link rel="preload"> for the LCP image',
          'Reduce server response time (TTFB)',
          'Remove render-blocking resources',
          'Optimize CSS delivery',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Preload LCP image',
            code: '<link rel="preload" as="image" href="/hero-image.webp" fetchpriority="high">',
          },
          {
            language: 'html',
            label: 'Optimize image with modern format',
            code: '<picture>\n  <source srcset="/image.avif" type="image/avif">\n  <source srcset="/image.webp" type="image/webp">\n  <img src="/image.jpg" alt="..." loading="eager" fetchpriority="high">\n</picture>',
          },
        ],
      },
    };
  }

  private createCLSIssue(
    url: string,
    value: number,
    rating: 'needs-improvement' | 'poor'
  ): SEOIssue {
    const severity = rating === 'poor' ? IssueSeverity.HIGH : IssueSeverity.MEDIUM;

    return {
      id: uuid(),
      category: IssueCategory.CORE_WEB_VITALS,
      severity,
      title: `Cumulative Layout Shift is ${rating === 'poor' ? 'poor' : 'needs improvement'}`,
      description: `CLS is ${value.toFixed(3)}. Good CLS is under 0.1, needs improvement is 0.1-0.25, poor is over 0.25.`,
      affectedUrls: [url],
      details: { metric: 'CLS', value, threshold: CWV_THRESHOLDS.cls },
      impact: {
        summary: 'CLS measures visual stability - how much the page shifts during load.',
        seoEffect: 'CLS is a Core Web Vital and a confirmed Google ranking factor.',
        userEffect: 'Layout shifts are frustrating, causing users to accidentally click wrong elements or lose their place.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Prevent layout shifts by reserving space for dynamic content.',
        steps: [
          'Set explicit width and height on images and videos',
          'Reserve space for ads and embeds',
          'Avoid inserting content above existing content',
          'Use CSS transform for animations instead of properties that trigger layout',
          'Preload fonts and use font-display: optional or swap',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Set image dimensions',
            code: '<img src="/image.jpg" width="800" height="600" alt="...">',
          },
          {
            language: 'html',
            label: 'Reserve space with aspect-ratio',
            code: '<div style="aspect-ratio: 16/9; width: 100%;">\n  <iframe src="..." style="width: 100%; height: 100%;"></iframe>\n</div>',
          },
        ],
      },
    };
  }

  private createINPIssue(
    url: string,
    value: number,
    rating: 'needs-improvement' | 'poor'
  ): SEOIssue {
    const severity = rating === 'poor' ? IssueSeverity.HIGH : IssueSeverity.MEDIUM;

    return {
      id: uuid(),
      category: IssueCategory.CORE_WEB_VITALS,
      severity,
      title: `Interaction to Next Paint is ${rating === 'poor' ? 'poor' : 'needs improvement'}`,
      description: `INP is ${value}ms. Good INP is under 200ms, needs improvement is 200-500ms, poor is over 500ms.`,
      affectedUrls: [url],
      details: { metric: 'INP', value, threshold: CWV_THRESHOLDS.inp },
      impact: {
        summary: 'INP measures responsiveness - how quickly the page responds to user interactions.',
        seoEffect: 'INP replaced FID as a Core Web Vital in March 2024 and is a ranking factor.',
        userEffect: 'Slow interactions feel laggy, making the site feel unresponsive.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Reduce JavaScript execution time and optimize event handlers.',
        steps: [
          'Break up long tasks into smaller chunks',
          'Minimize main thread work',
          'Reduce JavaScript payload size',
          'Use web workers for heavy computations',
          'Optimize or debounce event handlers',
        ],
        codeExamples: [
          {
            language: 'javascript',
            label: 'Break up long tasks with scheduler.yield()',
            code: 'async function processItems(items) {\n  for (const item of items) {\n    processItem(item);\n    // Yield to the main thread periodically\n    await scheduler.yield();\n  }\n}',
          },
        ],
      },
    };
  }

  private createLowPerformanceIssue(url: string, score: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CORE_WEB_VITALS,
      severity: score < 25 ? IssueSeverity.CRITICAL : IssueSeverity.HIGH,
      title: 'Low overall performance score',
      description: `The page has a performance score of ${score}/100. Aim for 90+ for optimal user experience.`,
      affectedUrls: [url],
      details: { score },
      impact: {
        summary: 'Performance score reflects overall page loading and responsiveness.',
        seoEffect: 'While individual CWV metrics are ranking factors, overall poor performance indicates multiple issues that need attention.',
        userEffect: 'Users experience slow, janky pages leading to poor engagement.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Address individual Core Web Vitals and follow performance best practices.',
        steps: [
          'Review and fix individual CWV metrics (LCP, CLS, INP)',
          'Reduce JavaScript and CSS payload',
          'Optimize images and fonts',
          'Enable compression and caching',
          'Consider using a CDN',
        ],
      },
    };
  }

  private createTTFBIssue(
    url: string,
    value: number,
    rating: 'needs-improvement' | 'poor'
  ): SEOIssue {
    const severity = rating === 'poor' ? IssueSeverity.MEDIUM : IssueSeverity.LOW;

    return {
      id: uuid(),
      category: IssueCategory.CORE_WEB_VITALS,
      severity,
      title: `Time to First Byte is ${rating === 'poor' ? 'poor' : 'slow'}`,
      description: `TTFB is ${value}ms. Good TTFB is under 800ms.`,
      affectedUrls: [url],
      details: { metric: 'TTFB', value, threshold: CWV_THRESHOLDS.ttfb },
      impact: {
        summary: 'TTFB measures server response time - a slow server delays everything else.',
        seoEffect: 'While not a direct ranking factor, TTFB affects LCP and overall crawlability.',
        userEffect: 'Users wait longer for the page to start loading.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Optimize server response time.',
        steps: [
          'Use a CDN to serve content closer to users',
          'Optimize database queries',
          'Implement caching (page cache, object cache)',
          'Upgrade server resources if needed',
          'Use HTTP/2 or HTTP/3',
        ],
      },
    };
  }

  private createTBTIssue(
    url: string,
    value: number,
    rating: 'needs-improvement' | 'poor'
  ): SEOIssue {
    const severity = rating === 'poor' ? IssueSeverity.MEDIUM : IssueSeverity.LOW;

    return {
      id: uuid(),
      category: IssueCategory.CORE_WEB_VITALS,
      severity,
      title: `Total Blocking Time is ${rating === 'poor' ? 'high' : 'elevated'}`,
      description: `TBT is ${value}ms. Good TBT is under 200ms.`,
      affectedUrls: [url],
      details: { metric: 'TBT', value, threshold: CWV_THRESHOLDS.tbt },
      impact: {
        summary: 'TBT measures how long the main thread was blocked by long tasks.',
        seoEffect: 'TBT correlates with INP. High TBT indicates the page may feel unresponsive.',
        userEffect: 'Clicks and interactions are delayed while long tasks execute.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Reduce main thread blocking time.',
        steps: [
          'Audit and remove unused JavaScript',
          'Code-split and lazy-load JavaScript',
          'Defer non-critical scripts',
          'Optimize third-party scripts',
          'Use web workers for CPU-intensive tasks',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Defer non-critical scripts',
            code: '<script src="/analytics.js" defer></script>',
          },
        ],
      },
    };
  }
}
