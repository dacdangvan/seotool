/**
 * Chrome UX Report (CrUX) API Client
 * 
 * Fetches real user metrics (Field Data) from Chrome UX Report
 * This is different from Lighthouse (Lab Data) - CrUX provides actual user experience data
 * 
 * API Documentation: https://developers.google.com/web/tools/chrome-user-experience-report/api/reference
 */

export interface CrUXMetric {
  histogram: Array<{
    start: number;
    end?: number;
    density: number;
  }>;
  percentiles: {
    p75: number;
  };
}

export interface CrUXRecord {
  key: {
    url?: string;
    origin?: string;
    formFactor?: 'PHONE' | 'DESKTOP' | 'TABLET';
  };
  metrics: {
    largest_contentful_paint?: CrUXMetric;
    cumulative_layout_shift?: CrUXMetric;
    interaction_to_next_paint?: CrUXMetric;
    first_contentful_paint?: CrUXMetric;
    first_input_delay?: CrUXMetric;
    time_to_first_byte?: CrUXMetric;
  };
  collectionPeriod: {
    firstDate: { year: number; month: number; day: number };
    lastDate: { year: number; month: number; day: number };
  };
}

export interface CrUXResponse {
  record?: CrUXRecord;
  urlNormalizationDetails?: {
    originalUrl: string;
    normalizedUrl: string;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface CrUXData {
  url: string;
  formFactor: 'mobile' | 'desktop';
  lcp: number;  // p75 in ms
  cls: number;  // p75
  inp: number;  // p75 in ms
  fcp: number;  // p75 in ms
  ttfb: number; // p75 in ms
  lcpStatus: 'good' | 'needs_improvement' | 'poor';
  clsStatus: 'good' | 'needs_improvement' | 'poor';
  inpStatus: 'good' | 'needs_improvement' | 'poor';
  fcpStatus: 'good' | 'needs_improvement' | 'poor';
  ttfbStatus: 'good' | 'needs_improvement' | 'poor';
  collectionPeriodStart: string;
  collectionPeriodEnd: string;
}

// CrUX API thresholds (same as Web Vitals)
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  cls: { good: 0.1, poor: 0.25 },
  inp: { good: 200, poor: 500 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
};

export class CrUXClient {
  private apiKey: string;
  private baseUrl = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('CrUX API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Get CrUX data for a specific URL
   */
  async getUrlMetrics(url: string, formFactor: 'PHONE' | 'DESKTOP' = 'PHONE'): Promise<CrUXData | null> {
    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://www.vib.com.vn',
        },
        body: JSON.stringify({
          url,
          formFactor,
        }),
      });

      const data = await response.json() as CrUXResponse;

      if (data.error) {
        // URL not in CrUX dataset (not enough traffic)
        if (data.error.code === 404) {
          console.log(`[CrUX] No data for URL: ${url}`);
          return null;
        }
        throw new Error(`CrUX API error: ${data.error.message}`);
      }

      if (!data.record) {
        return null;
      }

      return this.transformRecord(data.record, url);
    } catch (error) {
      console.error(`[CrUX] Error fetching URL metrics:`, error);
      throw error;
    }
  }

  /**
   * Get CrUX data for an origin (domain-level)
   */
  async getOriginMetrics(origin: string, formFactor: 'PHONE' | 'DESKTOP' = 'PHONE'): Promise<CrUXData | null> {
    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://www.vib.com.vn',
        },
        body: JSON.stringify({
          origin,
          formFactor,
        }),
      });

      const data = await response.json() as CrUXResponse;

      if (data.error) {
        if (data.error.code === 404) {
          console.log(`[CrUX] No data for origin: ${origin}`);
          return null;
        }
        throw new Error(`CrUX API error: ${data.error.message}`);
      }

      if (!data.record) {
        return null;
      }

      return this.transformRecord(data.record, origin);
    } catch (error) {
      console.error(`[CrUX] Error fetching origin metrics:`, error);
      throw error;
    }
  }

  /**
   * Get CrUX data for multiple URLs (batch)
   */
  async getBatchUrlMetrics(urls: string[], formFactor: 'PHONE' | 'DESKTOP' = 'PHONE'): Promise<Map<string, CrUXData>> {
    const results = new Map<string, CrUXData>();
    
    // CrUX API doesn't support batch requests, so we need to make individual calls
    // Add delay between requests to avoid rate limiting
    for (const url of urls) {
      try {
        const data = await this.getUrlMetrics(url, formFactor);
        if (data) {
          results.set(url, data);
        }
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[CrUX] Error for ${url}:`, error);
      }
    }

    return results;
  }

  /**
   * Transform CrUX API record to our data format
   */
  private transformRecord(record: CrUXRecord, url: string): CrUXData {
    const metrics = record.metrics;
    const formFactor = record.key.formFactor === 'DESKTOP' ? 'desktop' : 'mobile';

    // Extract p75 values (or 0 if not available)
    const lcp = metrics.largest_contentful_paint?.percentiles.p75 || 0;
    const cls = metrics.cumulative_layout_shift?.percentiles.p75 || 0;
    const inp = metrics.interaction_to_next_paint?.percentiles.p75 || 0;
    const fcp = metrics.first_contentful_paint?.percentiles.p75 || 0;
    const ttfb = metrics.time_to_first_byte?.percentiles.p75 || 0;

    // Format collection period dates
    const startDate = record.collectionPeriod.firstDate;
    const endDate = record.collectionPeriod.lastDate;
    const collectionPeriodStart = `${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
    const collectionPeriodEnd = `${endDate.year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}`;

    return {
      url,
      formFactor,
      lcp,
      cls,
      inp,
      fcp,
      ttfb,
      lcpStatus: this.getStatus(lcp, THRESHOLDS.lcp),
      clsStatus: this.getStatus(cls, THRESHOLDS.cls),
      inpStatus: this.getStatus(inp, THRESHOLDS.inp),
      fcpStatus: this.getStatus(fcp, THRESHOLDS.fcp),
      ttfbStatus: this.getStatus(ttfb, THRESHOLDS.ttfb),
      collectionPeriodStart,
      collectionPeriodEnd,
    };
  }

  /**
   * Get status based on thresholds
   */
  private getStatus(value: number, thresholds: { good: number; poor: number }): 'good' | 'needs_improvement' | 'poor' {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs_improvement';
    return 'poor';
  }
}
