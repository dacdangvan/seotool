/**
 * GA4 Client - Google Analytics 4 Data API Client
 * 
 * Fetches real traffic data from Google Analytics 4
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GoogleAuth } from 'google-auth-library';

export interface GA4Config {
  propertyId: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
  keyFilePath?: string;
}

export interface TrafficData {
  date: string;
  organicTraffic: number;
  totalTraffic: number;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  pageviews: number;
}

export interface PagePerformanceData {
  pagePath: string;
  pageTitle: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  entrances: number;
  bounceRate: number;
  exitRate: number;
}

export interface CWVData {
  pagePath: string;
  device: 'mobile' | 'desktop';
  lcp: number;
  cls: number;
  inp?: number;
  fcp: number;
  ttfb: number;
  eventCount: number;
  avgSessionDuration?: number;
}

export class GA4Client {
  private client: BetaAnalyticsDataClient;
  private propertyId: string;

  constructor(config: GA4Config) {
    this.propertyId = config.propertyId;

    if (config.credentials) {
      // Use service account credentials directly
      this.client = new BetaAnalyticsDataClient({
        credentials: {
          client_email: config.credentials.client_email,
          private_key: config.credentials.private_key.replace(/\\n/g, '\n'),
        },
      });
    } else if (config.keyFilePath) {
      // Use key file
      this.client = new BetaAnalyticsDataClient({
        keyFilename: config.keyFilePath,
      });
    } else {
      // Use default credentials (ADC)
      this.client = new BetaAnalyticsDataClient();
    }
  }

  /**
   * Get daily traffic metrics for a date range
   */
  async getDailyTraffic(startDate: string, endDate: string): Promise<TrafficData[]> {
    console.log(`[GA4] Fetching daily traffic: ${startDate} to ${endDate}`);

    const [response] = await this.client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    // Get organic traffic separately (filtered by session source/medium)
    const [organicResponse] = await this.client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          stringFilter: {
            matchType: 'EXACT',
            value: 'Organic Search',
          },
        },
      },
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    });

    // Build organic traffic map
    const organicMap = new Map<string, number>();
    if (organicResponse.rows) {
      for (const row of organicResponse.rows) {
        const date = row.dimensionValues?.[0]?.value || '';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        organicMap.set(date, sessions);
      }
    }

    // Combine data
    const results: TrafficData[] = [];
    if (response.rows) {
      for (const row of response.rows) {
        const date = row.dimensionValues?.[0]?.value || '';
        const totalSessions = parseInt(row.metricValues?.[0]?.value || '0');
        
        results.push({
          date: this.formatDate(date), // Convert YYYYMMDD to YYYY-MM-DD
          organicTraffic: organicMap.get(date) || 0,
          totalTraffic: totalSessions,
          sessions: totalSessions,
          users: parseInt(row.metricValues?.[1]?.value || '0'),
          newUsers: parseInt(row.metricValues?.[2]?.value || '0'),
          bounceRate: parseFloat(row.metricValues?.[3]?.value || '0'),
          avgSessionDuration: parseFloat(row.metricValues?.[4]?.value || '0'),
          pagesPerSession: parseFloat(row.metricValues?.[5]?.value || '0'),
          pageviews: parseInt(row.metricValues?.[6]?.value || '0'),
        });
      }
    }

    console.log(`[GA4] Fetched ${results.length} days of traffic data`);
    return results;
  }

  /**
   * Get top pages performance
   */
  async getTopPages(startDate: string, endDate: string, limit = 100): Promise<PagePerformanceData[]> {
    console.log(`[GA4] Fetching top pages: ${startDate} to ${endDate}`);

    const [response] = await this.client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' }, // unique pageviews approximation
        { name: 'userEngagementDuration' },
        { name: 'entrances' },
        { name: 'bounceRate' },
        { name: 'exits' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit,
    });

    const results: PagePerformanceData[] = [];
    if (response.rows) {
      for (const row of response.rows) {
        const pageviews = parseInt(row.metricValues?.[0]?.value || '0');
        const exits = parseInt(row.metricValues?.[5]?.value || '0');
        
        results.push({
          pagePath: row.dimensionValues?.[0]?.value || '',
          pageTitle: row.dimensionValues?.[1]?.value || '',
          pageviews,
          uniquePageviews: parseInt(row.metricValues?.[1]?.value || '0'),
          avgTimeOnPage: parseFloat(row.metricValues?.[2]?.value || '0'),
          entrances: parseInt(row.metricValues?.[3]?.value || '0'),
          bounceRate: parseFloat(row.metricValues?.[4]?.value || '0'),
          exitRate: pageviews > 0 ? (exits / pageviews) * 100 : 0,
        });
      }
    }

    console.log(`[GA4] Fetched ${results.length} pages`);
    return results;
  }

  /**
   * Get traffic by channel/source
   */
  async getTrafficByChannel(startDate: string, endDate: string): Promise<Map<string, number>> {
    const [response] = await this.client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    const channels = new Map<string, number>();
    if (response.rows) {
      for (const row of response.rows) {
        const channel = row.dimensionValues?.[0]?.value || 'Unknown';
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        channels.set(channel, sessions);
      }
    }

    return channels;
  }

  /**
   * Get real-time active users (optional)
   */
  async getRealtimeActiveUsers(): Promise<number> {
    try {
      const [response] = await this.client.runRealtimeReport({
        property: `properties/${this.propertyId}`,
        metrics: [{ name: 'activeUsers' }],
      });

      return parseInt(response.rows?.[0]?.metricValues?.[0]?.value || '0');
    } catch (error) {
      console.error('[GA4] Realtime API error:', error);
      return 0;
    }
  }

  /**
   * Get Core Web Vitals data from GA4 web vitals events
   */
  async getWebVitalsData(startDate: string, endDate: string): Promise<CWVData[]> {
    console.log(`[GA4] Fetching web vitals data: ${startDate} to ${endDate}`);

    try {
      // Get LCP data
      const [lcpResponse] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'deviceCategory' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' } // LCP value in milliseconds
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'LCP' }
          }
        }
      });

      // Get CLS data
      const [clsResponse] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'deviceCategory' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' } // CLS value
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'CLS' }
          }
        }
      });

      // Get INP data (if available)
      const [inpResponse] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'deviceCategory' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' } // INP value in milliseconds
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'INP' }
          }
        }
      });

      // Get FCP data
      const [fcpResponse] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'deviceCategory' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' } // FCP value in milliseconds
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'FCP' }
          }
        }
      });

      // Get TTFB data
      const [ttfbResponse] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'deviceCategory' }
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventValue' } // TTFB value in milliseconds
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { matchType: 'EXACT', value: 'TTFB' }
          }
        }
      });

      // Aggregate data by page and device
      const cwvMap = new Map<string, CWVData>();

      // Process LCP data
      lcpResponse.rows?.forEach(row => {
        const pagePath = row.dimensionValues?.[0]?.value || '';
        const device = (row.dimensionValues?.[1]?.value || 'desktop') as 'mobile' | 'desktop';
        const key = `${pagePath}-${device}`;
        const eventCount = parseInt(row.metricValues?.[0]?.value || '0');
        const lcpValue = parseFloat(row.metricValues?.[1]?.value || '0');

        if (!cwvMap.has(key)) {
          cwvMap.set(key, {
            pagePath,
            device,
            lcp: 0,
            cls: 0,
            fcp: 0,
            ttfb: 0,
            eventCount: 0
          });
        }

        const data = cwvMap.get(key)!;
        data.lcp = lcpValue;
        data.eventCount += eventCount;
      });

      // Process CLS data
      clsResponse.rows?.forEach(row => {
        const pagePath = row.dimensionValues?.[0]?.value || '';
        const device = (row.dimensionValues?.[1]?.value || 'desktop') as 'mobile' | 'desktop';
        const key = `${pagePath}-${device}`;
        const clsValue = parseFloat(row.metricValues?.[1]?.value || '0');

        if (cwvMap.has(key)) {
          cwvMap.get(key)!.cls = clsValue;
        }
      });

      // Process INP data
      inpResponse.rows?.forEach(row => {
        const pagePath = row.dimensionValues?.[0]?.value || '';
        const device = (row.dimensionValues?.[1]?.value || 'desktop') as 'mobile' | 'desktop';
        const key = `${pagePath}-${device}`;
        const inpValue = parseFloat(row.metricValues?.[1]?.value || '0');

        if (cwvMap.has(key)) {
          cwvMap.get(key)!.inp = inpValue;
        }
      });

      // Process FCP data
      fcpResponse.rows?.forEach(row => {
        const pagePath = row.dimensionValues?.[0]?.value || '';
        const device = (row.dimensionValues?.[1]?.value || 'desktop') as 'mobile' | 'desktop';
        const key = `${pagePath}-${device}`;
        const fcpValue = parseFloat(row.metricValues?.[1]?.value || '0');

        if (cwvMap.has(key)) {
          cwvMap.get(key)!.fcp = fcpValue;
        }
      });

      // Process TTFB data
      ttfbResponse.rows?.forEach(row => {
        const pagePath = row.dimensionValues?.[0]?.value || '';
        const device = (row.dimensionValues?.[1]?.value || 'desktop') as 'mobile' | 'desktop';
        const key = `${pagePath}-${device}`;
        const ttfbValue = parseFloat(row.metricValues?.[1]?.value || '0');

        if (cwvMap.has(key)) {
          cwvMap.get(key)!.ttfb = ttfbValue;
        }
      });

      const results = Array.from(cwvMap.values());
      console.log(`[GA4] Found ${results.length} pages with web vitals data`);
      return results;

    } catch (error) {
      console.error('[GA4] Error fetching web vitals data:', error);
      return [];
    }
  }

  /**
   * Convert YYYYMMDD to YYYY-MM-DD
   */
  private formatDate(yyyymmdd: string): string {
    if (yyyymmdd.length !== 8) return yyyymmdd;
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }
}
