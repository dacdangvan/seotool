/**
 * Core Web Vitals Types for Frontend
 * 
 * Types for displaying CWV data in UI
 */

export type CWVStatus = 'good' | 'needs_improvement' | 'poor';
export type DeviceProfile = 'mobile' | 'desktop';

// Individual metric
export interface CWVMetric {
  value: number;
  status: CWVStatus;
  displayValue: string;
}

// Core Web Vitals for a page
export interface PageCWV {
  url: string;
  device: DeviceProfile;
  
  // Primary metrics
  lcp: CWVMetric;          // Largest Contentful Paint
  inp: CWVMetric | null;   // Interaction to Next Paint (may be null in lab data)
  cls: CWVMetric;          // Cumulative Layout Shift
  
  // Additional metrics
  fcp: CWVMetric;          // First Contentful Paint
  ttfb: CWVMetric;         // Time to First Byte
  
  // Overall
  performanceScore: number; // 0-100
  overallStatus: CWVStatus;
  
  measuredAt: string;
}

// Thresholds for reference
export const CWV_THRESHOLDS = {
  lcp: {
    good: 2500,      // ≤ 2.5s
    poor: 4000,      // > 4s
    unit: 'ms',
    label: 'Largest Contentful Paint',
    description: 'Measures loading performance. To provide a good user experience, LCP should occur within 2.5 seconds of when the page first starts loading.',
  },
  inp: {
    good: 200,       // ≤ 200ms
    poor: 500,       // > 500ms
    unit: 'ms',
    label: 'Interaction to Next Paint',
    description: 'Measures interactivity. To provide a good user experience, pages should have an INP of 200 milliseconds or less.',
  },
  cls: {
    good: 0.1,       // ≤ 0.1
    poor: 0.25,      // > 0.25
    unit: '',
    label: 'Cumulative Layout Shift',
    description: 'Measures visual stability. To provide a good user experience, pages should maintain a CLS of 0.1 or less.',
  },
  fcp: {
    good: 1800,      // ≤ 1.8s
    poor: 3000,      // > 3s
    unit: 'ms',
    label: 'First Contentful Paint',
    description: 'Measures when the first content is painted on screen.',
  },
  ttfb: {
    good: 800,       // ≤ 800ms
    poor: 1800,      // > 1.8s
    unit: 'ms',
    label: 'Time to First Byte',
    description: 'Measures server response time.',
  },
};

// Status colors
export const CWV_STATUS_COLORS = {
  good: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
  needs_improvement: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  poor: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
};

// Helper to get status from value
export function getCWVStatus(
  metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb',
  value: number
): CWVStatus {
  const threshold = CWV_THRESHOLDS[metric];
  if (value <= threshold.good) return 'good';
  if (value > threshold.poor) return 'poor';
  return 'needs_improvement';
}

// Format value for display
export function formatCWVValue(
  metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb',
  value: number
): string {
  if (metric === 'cls') {
    return value.toFixed(3);
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.round(value)}ms`;
}
