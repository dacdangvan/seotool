/**
 * Lighthouse Adapter
 * 
 * Programmatic interface to run Lighthouse via Playwright
 * Extracts Core Web Vitals from Lighthouse results
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  DeviceProfile,
  CWVConfig,
  DEFAULT_CWV_CONFIG,
} from './cwv_types';

// Lighthouse type definitions (simplified)
export interface LighthouseResult {
  lhr: {
    lighthouseVersion: string;
    userAgent: string;
    fetchTime: string;
    requestedUrl: string;
    finalUrl: string;
    categories: {
      performance?: { score: number };
      accessibility?: { score: number };
      'best-practices'?: { score: number };
      seo?: { score: number };
    };
    audits: Record<string, LighthouseAudit>;
  };
}

export interface LighthouseAudit {
  id: string;
  title: string;
  score: number | null;
  numericValue?: number;
  numericUnit?: string;
  displayValue?: string;
}

// Device emulation settings
const DEVICE_SETTINGS: Record<DeviceProfile, {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  userAgent: string;
}> = {
  mobile: {
    width: 412,
    height: 823,
    deviceScaleFactor: 2.625,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
  },
  desktop: {
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    isMobile: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
  },
};

// Throttling settings (Lighthouse defaults for mobile)
const THROTTLING_SETTINGS = {
  mobile: {
    cpuSlowdownMultiplier: 4,
    downloadThroughputKbps: 1600,
    uploadThroughputKbps: 750,
    latencyMs: 150,
  },
  desktop: {
    cpuSlowdownMultiplier: 1,
    downloadThroughputKbps: 10000,
    uploadThroughputKbps: 10000,
    latencyMs: 40,
  },
};

export class LighthouseAdapter {
  private config: CWVConfig;
  private browser: Browser | null = null;

  constructor(config: Partial<CWVConfig> = {}) {
    this.config = { ...DEFAULT_CWV_CONFIG, ...config };
  }

  /**
   * Initialize browser for Lighthouse runs
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log('[LighthouseAdapter] Launching browser...');
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }

  /**
   * Close browser and cleanup
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Run Lighthouse on a URL
   */
  async runLighthouse(
    url: string,
    device: DeviceProfile
  ): Promise<LighthouseResult | null> {
    if (!this.browser) {
      await this.initialize();
    }

    const deviceSettings = DEVICE_SETTINGS[device];
    const throttling = this.config.useThrottling ? THROTTLING_SETTINGS[device] : null;

    console.log(`[LighthouseAdapter] Running Lighthouse on ${url} (${device})`);

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Create context with device emulation
      context = await this.browser!.newContext({
        viewport: {
          width: deviceSettings.width,
          height: deviceSettings.height,
        },
        deviceScaleFactor: deviceSettings.deviceScaleFactor,
        isMobile: deviceSettings.isMobile,
        userAgent: deviceSettings.userAgent,
      });

      page = await context.newPage();

      // Set timeout
      page.setDefaultTimeout(this.config.timeout);

      // Apply network throttling if enabled
      if (throttling) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          downloadThroughput: (throttling.downloadThroughputKbps * 1024) / 8,
          uploadThroughput: (throttling.uploadThroughputKbps * 1024) / 8,
          latency: throttling.latencyMs,
        });

        // CPU throttling
        await cdp.send('Emulation.setCPUThrottlingRate', {
          rate: throttling.cpuSlowdownMultiplier,
        });
      }

      // Collect performance metrics
      const startTime = Date.now();
      
      // Navigate and wait for load
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);

      // Get performance timing
      const performanceTiming = await page.evaluate(() => {
        const timing = performance.timing;
        const paintEntries = performance.getEntriesByType('paint');
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        const layoutShiftEntries = performance.getEntriesByType('layout-shift');

        // Calculate CLS
        let cls = 0;
        layoutShiftEntries.forEach((entry: PerformanceEntry) => {
          // Type assertion for LayoutShift entry
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutShift.hadRecentInput) {
            cls += layoutShift.value ?? 0;
          }
        });

        return {
          ttfb: timing.responseStart - timing.requestStart,
          fcp: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime ?? 0,
          lcp: lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : 0,
          cls: cls,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          load: timing.loadEventEnd - timing.navigationStart,
        };
      });

      // Get TBT (approximate via long tasks)
      const tbt = await page.evaluate(() => {
        const longTasks = performance.getEntriesByType('longtask');
        let totalBlockingTime = 0;
        longTasks.forEach(task => {
          const blockingTime = task.duration - 50;
          if (blockingTime > 0) {
            totalBlockingTime += blockingTime;
          }
        });
        return totalBlockingTime;
      });

      const endTime = Date.now();

      // Build Lighthouse-like result
      const result: LighthouseResult = {
        lhr: {
          lighthouseVersion: '11.0.0', // Simulated
          userAgent: deviceSettings.userAgent,
          fetchTime: new Date().toISOString(),
          requestedUrl: url,
          finalUrl: page.url(),
          categories: {
            performance: { score: this.calculatePerformanceScore(performanceTiming) },
          },
          audits: {
            'largest-contentful-paint': {
              id: 'largest-contentful-paint',
              title: 'Largest Contentful Paint',
              score: this.getMetricScore('lcp', performanceTiming.lcp),
              numericValue: performanceTiming.lcp,
              numericUnit: 'millisecond',
              displayValue: `${(performanceTiming.lcp / 1000).toFixed(1)} s`,
            },
            'cumulative-layout-shift': {
              id: 'cumulative-layout-shift',
              title: 'Cumulative Layout Shift',
              score: this.getMetricScore('cls', performanceTiming.cls),
              numericValue: performanceTiming.cls,
              displayValue: performanceTiming.cls.toFixed(3),
            },
            'first-contentful-paint': {
              id: 'first-contentful-paint',
              title: 'First Contentful Paint',
              score: this.getMetricScore('fcp', performanceTiming.fcp),
              numericValue: performanceTiming.fcp,
              numericUnit: 'millisecond',
              displayValue: `${(performanceTiming.fcp / 1000).toFixed(1)} s`,
            },
            'server-response-time': {
              id: 'server-response-time',
              title: 'Initial Server Response Time',
              score: this.getMetricScore('ttfb', performanceTiming.ttfb),
              numericValue: performanceTiming.ttfb,
              numericUnit: 'millisecond',
              displayValue: `${performanceTiming.ttfb} ms`,
            },
            'total-blocking-time': {
              id: 'total-blocking-time',
              title: 'Total Blocking Time',
              score: this.getMetricScore('tbt', tbt),
              numericValue: tbt,
              numericUnit: 'millisecond',
              displayValue: `${tbt} ms`,
            },
            'speed-index': {
              id: 'speed-index',
              title: 'Speed Index',
              score: this.getMetricScore('si', performanceTiming.domContentLoaded),
              numericValue: performanceTiming.domContentLoaded,
              numericUnit: 'millisecond',
              displayValue: `${(performanceTiming.domContentLoaded / 1000).toFixed(1)} s`,
            },
            // INP is not available in lab data, would need real user interaction
            'interaction-to-next-paint': {
              id: 'interaction-to-next-paint',
              title: 'Interaction to Next Paint',
              score: null,
              numericValue: undefined,
              displayValue: 'N/A (lab data)',
            },
          },
        },
      };

      console.log(`[LighthouseAdapter] Completed in ${endTime - startTime}ms - LCP: ${performanceTiming.lcp}ms, CLS: ${performanceTiming.cls.toFixed(3)}`);

      return result;

    } catch (error) {
      console.error(`[LighthouseAdapter] Error running Lighthouse on ${url}:`, error);
      return null;
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  /**
   * Calculate performance score (0-1) based on metrics
   */
  private calculatePerformanceScore(metrics: {
    lcp: number;
    fcp: number;
    cls: number;
    ttfb: number;
  }): number {
    // Simplified scoring based on Lighthouse weights
    const lcpScore = this.getMetricScore('lcp', metrics.lcp);
    const fcpScore = this.getMetricScore('fcp', metrics.fcp);
    const clsScore = this.getMetricScore('cls', metrics.cls);

    // Weighted average (simplified)
    return (lcpScore * 0.25 + fcpScore * 0.10 + clsScore * 0.25 + 0.4) * 0.8;
  }

  /**
   * Get score (0-1) for a metric value
   */
  private getMetricScore(metric: string, value: number): number {
    const thresholds: Record<string, { good: number; poor: number }> = {
      lcp: { good: 2500, poor: 4000 },
      fcp: { good: 1800, poor: 3000 },
      cls: { good: 0.1, poor: 0.25 },
      ttfb: { good: 800, poor: 1800 },
      tbt: { good: 200, poor: 600 },
      si: { good: 3400, poor: 5800 },
    };

    const t = thresholds[metric];
    if (!t) return 0.5;

    if (value <= t.good) return 1;
    if (value >= t.poor) return 0;
    
    // Linear interpolation
    return 1 - ((value - t.good) / (t.poor - t.good));
  }
}

export default LighthouseAdapter;
