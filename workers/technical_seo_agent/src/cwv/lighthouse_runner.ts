/**
 * Lighthouse Runner
 * Runs Lighthouse audits for Core Web Vitals measurement
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { Logger } from '../logger';
import { CoreWebVitals, MetricResult } from '../models';

export interface LighthouseOptions {
  chromePath?: string;
  timeout: number;
}

export class LighthouseRunner {
  constructor(
    private readonly options: LighthouseOptions,
    private readonly logger: Logger
  ) {}

  /**
   * Run Lighthouse audit on a URL
   */
  async run(url: string): Promise<CoreWebVitals | null> {
    let chrome: chromeLauncher.LaunchedChrome | null = null;

    try {
      this.logger.info({ url }, 'Starting Lighthouse audit');

      // Launch Chrome
      chrome = await chromeLauncher.launch({
        chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox'],
        chromePath: this.options.chromePath,
      });

      this.logger.debug({ port: chrome.port }, 'Chrome launched');

      // Run Lighthouse
      const result = await lighthouse(
        url,
        {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        },
        {
          extends: 'lighthouse:default',
          settings: {
            maxWaitForFcp: this.options.timeout,
            maxWaitForLoad: this.options.timeout,
            throttlingMethod: 'simulate',
            formFactor: 'desktop',
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false,
            },
          },
        }
      );

      if (!result || !result.lhr) {
        this.logger.error({ url }, 'Lighthouse returned no results');
        return null;
      }

      const lhr = result.lhr;
      this.logger.info({ url, score: lhr.categories.performance?.score }, 'Lighthouse audit completed');

      return this.parseLighthouseResult(url, lhr);
    } catch (error) {
      this.logger.error({ url, error }, 'Lighthouse audit failed');
      return null;
    } finally {
      if (chrome) {
        await chrome.kill();
        this.logger.debug('Chrome killed');
      }
    }
  }

  private parseLighthouseResult(url: string, lhr: LH.Result): CoreWebVitals {
    const audits = lhr.audits;

    return {
      url,

      // LCP - Largest Contentful Paint
      lcp: this.parseMetric(audits['largest-contentful-paint'], 'ms'),

      // CLS - Cumulative Layout Shift
      cls: this.parseMetric(audits['cumulative-layout-shift'], 'score'),

      // INP - Interaction to Next Paint (may not be available in all Lighthouse versions)
      inp: audits['interaction-to-next-paint'] 
        ? this.parseMetric(audits['interaction-to-next-paint'], 'ms')
        : null,

      // Additional metrics
      fcp: this.parseMetric(audits['first-contentful-paint'], 'ms'),
      ttfb: this.parseMetric(audits['server-response-time'], 'ms'),
      si: this.parseMetric(audits['speed-index'], 'ms'),
      tbt: this.parseMetric(audits['total-blocking-time'], 'ms'),

      // Overall scores (0-1 range, multiply by 100 for percentage)
      performanceScore: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibilityScore: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPracticesScore: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seoScore: Math.round((lhr.categories.seo?.score || 0) * 100),
    };
  }

  private parseMetric(audit: LH.Audit.Result | undefined, unit: 'ms' | 's' | 'score'): MetricResult {
    if (!audit) {
      return {
        value: 0,
        unit,
        rating: 'poor',
      };
    }

    const value = audit.numericValue || 0;
    const rating = this.getRating(audit.score);

    return {
      value: Math.round(value * 100) / 100, // Round to 2 decimal places
      unit,
      rating,
    };
  }

  private getRating(score: number | null | undefined): 'good' | 'needs-improvement' | 'poor' {
    if (score === null || score === undefined) return 'poor';
    if (score >= 0.9) return 'good';
    if (score >= 0.5) return 'needs-improvement';
    return 'poor';
  }
}

// Type declarations for Lighthouse (simplified)
declare namespace LH {
  interface Result {
    audits: Record<string, Audit.Result>;
    categories: Record<string, Category | undefined>;
  }

  namespace Audit {
    interface Result {
      score: number | null;
      numericValue?: number;
      displayValue?: string;
    }
  }

  interface Category {
    score: number | null;
  }
}
