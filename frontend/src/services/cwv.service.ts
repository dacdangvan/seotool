/**
 * CWV Service
 * 
 * API calls and mock data for Core Web Vitals
 */

import { PageCWV, DeviceProfile, getCWVStatus, formatCWVValue } from '@/types/cwv.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Get CWV data for a page
 */
export async function getPageCWV(
  projectId: string,
  url: string,
  device?: DeviceProfile
): Promise<PageCWV[]> {
  // TODO: Replace with real API call
  // const params = new URLSearchParams({ url });
  // if (device) params.set('device', device);
  // const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/cwv?${params}`);
  // return response.json();

  return getMockPageCWV(url);
}

/**
 * Get CWV data for multiple pages (batch)
 */
export async function getBatchPageCWV(
  projectId: string,
  urls: string[]
): Promise<Map<string, PageCWV[]>> {
  // TODO: Real API
  const result = new Map<string, PageCWV[]>();
  
  for (const url of urls) {
    result.set(url, getMockPageCWV(url));
  }
  
  return result;
}

/**
 * Mock CWV data generator
 */
function getMockPageCWV(url: string): PageCWV[] {
  // Generate semi-random but consistent values based on URL
  const hash = url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Vary metrics slightly based on URL
  const lcpBase = 1500 + (hash % 3500);
  const clsBase = 0.02 + (hash % 100) / 400;
  const fcpBase = 800 + (hash % 2200);
  const ttfbBase = 200 + (hash % 800);
  
  const createMetric = (value: number, metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb') => ({
    value,
    status: getCWVStatus(metric, value),
    displayValue: formatCWVValue(metric, value),
  });

  // Mobile data (usually slower)
  const mobile: PageCWV = {
    url,
    device: 'mobile',
    lcp: createMetric(lcpBase * 1.3, 'lcp'),
    inp: Math.random() > 0.3 ? createMetric(150 + (hash % 250), 'inp') : null,
    cls: createMetric(clsBase * 1.2, 'cls'),
    fcp: createMetric(fcpBase * 1.2, 'fcp'),
    ttfb: createMetric(ttfbBase, 'ttfb'),
    performanceScore: Math.max(20, 95 - Math.floor((lcpBase / 100) + (clsBase * 100))),
    overallStatus: getCWVStatus('lcp', lcpBase * 1.3),
    measuredAt: new Date().toISOString(),
  };

  // Desktop data (usually faster)
  const desktop: PageCWV = {
    url,
    device: 'desktop',
    lcp: createMetric(lcpBase * 0.7, 'lcp'),
    inp: Math.random() > 0.3 ? createMetric(80 + (hash % 150), 'inp') : null,
    cls: createMetric(clsBase * 0.8, 'cls'),
    fcp: createMetric(fcpBase * 0.8, 'fcp'),
    ttfb: createMetric(ttfbBase * 0.9, 'ttfb'),
    performanceScore: Math.min(100, Math.max(40, 100 - Math.floor((lcpBase * 0.7 / 100) + (clsBase * 50)))),
    overallStatus: getCWVStatus('lcp', lcpBase * 0.7),
    measuredAt: new Date().toISOString(),
  };

  return [mobile, desktop];
}

/**
 * Get CWV summary for sorting pages
 */
export function getCWVSortValue(cwvData: PageCWV[] | undefined, device: DeviceProfile = 'mobile'): number {
  if (!cwvData || cwvData.length === 0) return 999999;
  
  const data = cwvData.find(d => d.device === device);
  if (!data) return 999999;
  
  // Lower score = worse performance (for sorting worst first)
  return 100 - data.performanceScore;
}
