/**
 * Vitals Extractor
 * 
 * Extract Core Web Vitals from Lighthouse results
 * Normalize values and determine status (good/needs_improvement/poor)
 */

import {
  CoreWebVitals,
  CWVStatus,
  CWV_THRESHOLDS,
} from './cwv_types';
import { LighthouseResult, LighthouseAudit } from './lighthouse_adapter';

/**
 * Extract Core Web Vitals from Lighthouse result
 */
export function extractVitals(lighthouseResult: LighthouseResult): CoreWebVitals {
  const { audits, categories } = lighthouseResult.lhr;

  // LCP
  const lcpAudit = audits['largest-contentful-paint'];
  const lcpValue = lcpAudit?.numericValue ?? 0;
  const lcpStatus = getStatus(lcpValue, CWV_THRESHOLDS.lcp);

  // CLS
  const clsAudit = audits['cumulative-layout-shift'];
  const clsValue = clsAudit?.numericValue ?? 0;
  const clsStatus = getStatus(clsValue, CWV_THRESHOLDS.cls);

  // FCP
  const fcpAudit = audits['first-contentful-paint'];
  const fcpValue = fcpAudit?.numericValue ?? 0;
  const fcpStatus = getStatus(fcpValue, CWV_THRESHOLDS.fcp);

  // TTFB
  const ttfbAudit = audits['server-response-time'];
  const ttfbValue = ttfbAudit?.numericValue ?? 0;
  const ttfbStatus = getStatus(ttfbValue, CWV_THRESHOLDS.ttfb);

  // INP (may not be available in lab data)
  const inpAudit = audits['interaction-to-next-paint'];
  let inp: CoreWebVitals['inp'] = null;
  if (inpAudit?.numericValue !== undefined) {
    inp = {
      value: inpAudit.numericValue,
      unit: 'ms',
      status: getStatus(inpAudit.numericValue, CWV_THRESHOLDS.inp),
      displayValue: `${inpAudit.numericValue}ms`,
    };
  }

  // TBT (Total Blocking Time)
  const tbtAudit = audits['total-blocking-time'];
  const tbtValue = tbtAudit?.numericValue ?? 0;
  const tbtStatus = getStatus(tbtValue, CWV_THRESHOLDS.tbt);

  // SI (Speed Index)
  const siAudit = audits['speed-index'];
  const siValue = siAudit?.numericValue ?? 0;
  const siStatus = getStatus(siValue, CWV_THRESHOLDS.si);

  // Performance score
  const performanceScore = categories?.performance?.score 
    ? Math.round(categories.performance.score * 100)
    : 0;

  return {
    lcp: {
      value: lcpValue,
      unit: 'ms',
      status: lcpStatus,
      displayValue: `${(lcpValue / 1000).toFixed(2)}s`,
    },
    inp,
    cls: {
      value: clsValue,
      unit: 'ratio',
      status: clsStatus,
      displayValue: clsValue.toFixed(3),
    },
    fcp: {
      value: fcpValue,
      unit: 'ms',
      status: fcpStatus,
      displayValue: `${(fcpValue / 1000).toFixed(2)}s`,
    },
    ttfb: {
      value: ttfbValue,
      unit: 'ms',
      status: ttfbStatus,
      displayValue: `${ttfbValue}ms`,
    },
    si: {
      value: siValue,
      unit: 'ms',
      status: siStatus,
      displayValue: `${(siValue / 1000).toFixed(2)}s`,
    },
    tbt: {
      value: tbtValue,
      unit: 'ms',
      status: tbtStatus,
      displayValue: `${tbtValue}ms`,
    },
    performanceScore,
  };
}

/**
 * Determine status based on thresholds
 */
function getStatus(value: number, threshold: { good: number; poor: number }): CWVStatus {
  if (value <= threshold.good) return 'good';
  if (value >= threshold.poor) return 'poor';
  return 'needs_improvement';
}

/**
 * Get overall CWV status from individual metrics
 * Uses the "75th percentile" approach - status is worst of LCP, CLS, INP
 */
export function getOverallStatus(vitals: CoreWebVitals): CWVStatus {
  const statuses: CWVStatus[] = [
    vitals.lcp.status,
    vitals.cls.status,
  ];

  if (vitals.inp) {
    statuses.push(vitals.inp.status);
  }

  if (statuses.includes('poor')) return 'poor';
  if (statuses.includes('needs_improvement')) return 'needs_improvement';
  return 'good';
}

/**
 * Format vitals for display
 */
export function formatVitalsForDisplay(vitals: CoreWebVitals): {
  lcp: string;
  inp: string;
  cls: string;
  fcp: string;
  ttfb: string;
  score: string;
} {
  return {
    lcp: `${(vitals.lcp.value / 1000).toFixed(2)}s`,
    inp: vitals.inp ? `${vitals.inp.value}ms` : 'N/A',
    cls: vitals.cls.value.toFixed(3),
    fcp: `${(vitals.fcp.value / 1000).toFixed(2)}s`,
    ttfb: `${vitals.ttfb.value}ms`,
    score: `${vitals.performanceScore}/100`,
  };
}

/**
 * Get CSS class/color based on status
 */
export function getStatusColor(status: CWVStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'good':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-500',
      };
    case 'needs_improvement':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-500',
      };
    case 'poor':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-500',
      };
  }
}

/**
 * Check if vitals pass Core Web Vitals assessment
 * Passes if LCP, CLS, and INP (if available) are all "good" or "needs_improvement"
 */
export function passesAssessment(vitals: CoreWebVitals): boolean {
  const coreMetrics: CWVStatus[] = [
    vitals.lcp.status,
    vitals.cls.status,
  ];

  if (vitals.inp) {
    coreMetrics.push(vitals.inp.status);
  }

  // Pass if none are "poor"
  return !coreMetrics.includes('poor');
}

/**
 * Get improvement suggestions based on vitals
 */
export function getSuggestions(vitals: CoreWebVitals): string[] {
  const suggestions: string[] = [];

  if (vitals.lcp.status !== 'good') {
    suggestions.push('Optimize LCP: Consider optimizing images, reducing server response time, or preloading critical resources');
  }

  if (vitals.cls.status !== 'good') {
    suggestions.push('Reduce CLS: Set explicit dimensions for images/videos, avoid inserting content above existing content');
  }

  if (vitals.inp && vitals.inp.status !== 'good') {
    suggestions.push('Improve INP: Reduce JavaScript execution time, break up long tasks, optimize event handlers');
  }

  if (vitals.fcp.status !== 'good') {
    suggestions.push('Optimize FCP: Eliminate render-blocking resources, minimize critical CSS, preconnect to required origins');
  }

  if (vitals.ttfb.status !== 'good') {
    suggestions.push('Reduce TTFB: Consider CDN, optimize server response time, use caching');
  }

  return suggestions;
}

export default {
  extractVitals,
  getOverallStatus,
  formatVitalsForDisplay,
  getStatusColor,
  passesAssessment,
  getSuggestions,
};
