/**
 * CWV Service
 * 
 * API calls and mock data for Core Web Vitals
 */

import { PageCWV, DeviceProfile, getCWVStatus, formatCWVValue, CWVMetric, CWVStatus } from '@/types/cwv.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Transform backend CWV data to frontend format
 */
function transformCWVData(raw: any): PageCWV {
  const parseValue = (val: string | number): number => {
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
  };

  const createMetric = (value: string | number, status: CWVStatus, unit: string): CWVMetric => {
    const numValue = parseValue(value);
    return {
      value: numValue,
      status: status || 'good',
      displayValue: unit === 'ms' ? `${Math.round(numValue)}ms` : numValue.toFixed(2),
    };
  };

  return {
    url: raw.url,
    device: raw.device,
    lcp: createMetric(raw.lcp_value, raw.lcp_status, 'ms'),
    inp: raw.inp_value ? createMetric(raw.inp_value, raw.inp_status, 'ms') : null,
    cls: createMetric(raw.cls_value, raw.cls_status, ''),
    fcp: createMetric(raw.fcp_value, raw.fcp_status, 'ms'),
    ttfb: createMetric(raw.ttfb_value, raw.ttfb_status, 'ms'),
    performanceScore: raw.performance_score || 0,
    overallStatus: raw.overall_status || 'good',
    measuredAt: raw.measured_at || new Date().toISOString(),
  };
}

/**
 * Get CWV data for a page
 */
export async function getPageCWV(
  projectId: string,
  url: string,
  device: DeviceProfile = 'mobile'
): Promise<PageCWV[]> {
  try {
    const params = new URLSearchParams({ url, device });
    const response = await fetch(`${API_BASE}/projects/${projectId}/cwv?${params}`);
    
    if (!response.ok) {
      throw new Error(`CWV API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const rawData = data.cwvData || [];
    return rawData.map((item: any) => transformCWVData(item));
  } catch (error) {
    console.error('Error fetching CWV data:', error);
    return []; // Return empty array instead of mock data
  }
}

/**
 * Get CWV data for multiple pages (batch)
 */
export async function getBatchPageCWV(
  projectId: string,
  urls: string[],
  device: DeviceProfile = 'mobile'
): Promise<Map<string, PageCWV[]>> {
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/cwv/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, device }),
    });
    
    if (!response.ok) {
      throw new Error(`Batch CWV API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const result = new Map<string, PageCWV[]>();
    
    for (const [url, cwvDataArray] of Object.entries(data.cwvData || {})) {
      const transformedData = (cwvDataArray as any[]).map((item: any) => transformCWVData(item));
      result.set(url, transformedData);
    }
    
    // Ensure all requested URLs have entries
    for (const url of urls) {
      if (!result.has(url)) {
        result.set(url, []);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching batch CWV data:', error);
    // Return empty map instead of mock data
    const result = new Map<string, PageCWV[]>();
    for (const url of urls) {
      result.set(url, []);
    }
    return result;
  }
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
