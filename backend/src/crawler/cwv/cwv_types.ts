/**
 * Core Web Vitals Types
 * 
 * Type definitions for CWV measurement results
 */

// CWV Status thresholds based on Google's guidelines
export type CWVStatus = 'good' | 'needs_improvement' | 'poor';

export type DeviceProfile = 'mobile' | 'desktop';

// Individual metric data
export interface MetricData {
  value: number;
  unit: 'ms' | 'score' | 'ratio';
  status: CWVStatus;
  displayValue?: string;
}

// Core Web Vitals results per page
export interface CoreWebVitals {
  // Primary CWV metrics
  lcp: MetricData;        // Largest Contentful Paint (ms)
  inp: MetricData | null; // Interaction to Next Paint (ms) - may not be available in lab
  cls: MetricData;        // Cumulative Layout Shift (ratio)
  
  // Additional performance metrics
  fcp: MetricData;        // First Contentful Paint (ms)
  ttfb: MetricData;       // Time to First Byte (ms)
  si: MetricData;         // Speed Index (ms)
  tbt: MetricData;        // Total Blocking Time (ms)
  
  // Lighthouse scores
  performanceScore: number; // 0-100
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
}

// Full CWV result for a URL
export interface CWVResult {
  id?: string;
  projectId: string;
  url: string;
  device: DeviceProfile;
  vitals: CoreWebVitals;
  
  // Overall status based on primary CWV
  overallStatus: CWVStatus;
  
  // Metadata
  measuredAt: Date;
  lighthouseVersion: string;
  userAgent: string;
  
  // Raw Lighthouse report (optional, for debugging)
  rawReport?: object;
  
  // Errors
  error?: string;
}

// Configuration for CWV collection
export interface CWVConfig {
  // Device profiles to test
  devices: DeviceProfile[];
  
  // Throttling (use Lighthouse defaults)
  useThrottling: boolean;
  
  // Max pages to run CWV per crawl
  maxCWVPages: number;
  
  // Rate limit between Lighthouse runs (ms)
  delayBetweenRuns: number;
  
  // Timeout for each Lighthouse run (ms)
  timeout: number;
  
  // Store raw Lighthouse report
  storeRawReport: boolean;
  
  // Page selection strategy
  pageSelectionStrategy: 'all' | 'representative' | 'priority_only';
}

export const DEFAULT_CWV_CONFIG: CWVConfig = {
  devices: ['mobile', 'desktop'],
  useThrottling: true,
  maxCWVPages: 20,
  delayBetweenRuns: 5000, // 5 seconds between runs
  timeout: 60000, // 60 seconds per run
  storeRawReport: false,
  pageSelectionStrategy: 'representative',
};

// Thresholds for CWV status (based on Google's guidelines)
export const CWV_THRESHOLDS = {
  lcp: {
    good: 2500,      // ≤ 2.5s
    poor: 4000,      // > 4s
  },
  inp: {
    good: 200,       // ≤ 200ms
    poor: 500,       // > 500ms
  },
  cls: {
    good: 0.1,       // ≤ 0.1
    poor: 0.25,      // > 0.25
  },
  fcp: {
    good: 1800,      // ≤ 1.8s
    poor: 3000,      // > 3s
  },
  ttfb: {
    good: 800,       // ≤ 800ms
    poor: 1800,      // > 1.8s
  },
  si: {
    good: 3400,      // ≤ 3.4s
    poor: 5800,      // > 5.8s
  },
  tbt: {
    good: 200,       // ≤ 200ms
    poor: 600,       // > 600ms
  },
};

/**
 * Determine CWV status based on value and thresholds
 */
export function getCWVStatus(
  metricName: keyof typeof CWV_THRESHOLDS,
  value: number
): CWVStatus {
  const thresholds = CWV_THRESHOLDS[metricName];
  if (value <= thresholds.good) return 'good';
  if (value > thresholds.poor) return 'poor';
  return 'needs_improvement';
}

/**
 * Calculate overall CWV status from primary metrics
 */
export function calculateOverallStatus(vitals: CoreWebVitals): CWVStatus {
  const primaryMetrics = [
    vitals.lcp.status,
    vitals.cls.status,
    vitals.inp?.status ?? 'good', // INP might not be available in lab
  ];

  if (primaryMetrics.some(s => s === 'poor')) return 'poor';
  if (primaryMetrics.some(s => s === 'needs_improvement')) return 'needs_improvement';
  return 'good';
}
