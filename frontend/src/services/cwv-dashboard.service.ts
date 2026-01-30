/**
 * CWV Dashboard Service
 * 
 * API service for fetching CWV dashboard data at project level
 */

import { CWVStatus, DeviceProfile } from '@/types/cwv.types';
import { CWVKpiData } from '@/components/cwv/CWVKpiCards';
import { CWVDistributionData, CWVUrlSamples, UrlSample } from '@/components/cwv/CWVDistributionChart';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// Types
export interface CWVDashboardData {
  projectId: string;
  projectName: string;
  device: DeviceProfile;
  lastUpdated: string;
  kpi: CWVKpiData;
  distribution: CWVDistributionData;
  urlSamples: CWVUrlSamples;
}

// Helper to generate random CWV values
function generateRandomCWV() {
  // Weighted towards realistic distribution
  const rand = Math.random();
  
  // LCP: 40% good, 35% needs improvement, 25% poor
  let lcp: number;
  if (rand < 0.4) {
    lcp = 1000 + Math.random() * 1500; // 1000-2500
  } else if (rand < 0.75) {
    lcp = 2500 + Math.random() * 1500; // 2500-4000
  } else {
    lcp = 4000 + Math.random() * 3000; // 4000-7000
  }
  
  // CLS: 50% good, 30% needs improvement, 20% poor
  let cls: number;
  if (rand < 0.5) {
    cls = Math.random() * 0.1;
  } else if (rand < 0.8) {
    cls = 0.1 + Math.random() * 0.15;
  } else {
    cls = 0.25 + Math.random() * 0.3;
  }
  
  // INP: 45% good, 35% needs improvement, 20% poor
  let inp: number;
  if (rand < 0.45) {
    inp = 50 + Math.random() * 150;
  } else if (rand < 0.8) {
    inp = 200 + Math.random() * 300;
  } else {
    inp = 500 + Math.random() * 500;
  }
  
  return { lcp, cls, inp };
}

// Generate mock data for development
function generateMockDashboardData(projectId: string, device: DeviceProfile): CWVDashboardData {
  const sampleUrls = [
    '/home',
    '/products',
    '/products/category/electronics',
    '/products/detail/12345',
    '/about',
    '/contact',
    '/blog',
    '/blog/post-1',
    '/blog/post-2',
    '/services',
    '/pricing',
    '/faq',
    '/terms',
    '/privacy',
    '/checkout',
    '/cart',
    '/account',
    '/login',
    '/signup',
    '/search',
  ];

  // Generate CWV data for each URL
  const urlCWVData = sampleUrls.map(url => ({
    url: `https://example.com${url}`,
    ...generateRandomCWV()
  }));

  // Calculate distribution
  const lcpDistribution = { good: 0, needsImprovement: 0, poor: 0 };
  const inpDistribution = { good: 0, needsImprovement: 0, poor: 0 };
  const clsDistribution = { good: 0, needsImprovement: 0, poor: 0 };

  const lcpWorst: UrlSample[] = [];
  const inpWorst: UrlSample[] = [];
  const clsWorst: UrlSample[] = [];

  urlCWVData.forEach(({ url, lcp, cls, inp }) => {
    // LCP
    let lcpStatus: CWVStatus;
    if (lcp <= 2500) {
      lcpDistribution.good++;
      lcpStatus = 'good';
    } else if (lcp <= 4000) {
      lcpDistribution.needsImprovement++;
      lcpStatus = 'needs_improvement';
    } else {
      lcpDistribution.poor++;
      lcpStatus = 'poor';
    }

    // CLS
    let clsStatus: CWVStatus;
    if (cls <= 0.1) {
      clsDistribution.good++;
      clsStatus = 'good';
    } else if (cls <= 0.25) {
      clsDistribution.needsImprovement++;
      clsStatus = 'needs_improvement';
    } else {
      clsDistribution.poor++;
      clsStatus = 'poor';
    }

    // INP
    let inpStatus: CWVStatus;
    if (inp <= 200) {
      inpDistribution.good++;
      inpStatus = 'good';
    } else if (inp <= 500) {
      inpDistribution.needsImprovement++;
      inpStatus = 'needs_improvement';
    } else {
      inpDistribution.poor++;
      inpStatus = 'poor';
    }

    // Collect worst URLs
    lcpWorst.push({ url, value: Math.round(lcp), status: lcpStatus });
    inpWorst.push({ url, value: Math.round(inp), status: inpStatus });
    clsWorst.push({ url, value: cls, status: clsStatus });
  });

  // Sort by worst first
  lcpWorst.sort((a, b) => b.value - a.value);
  inpWorst.sort((a, b) => b.value - a.value);
  clsWorst.sort((a, b) => b.value - a.value);

  // Calculate KPIs
  const totalUrls = urlCWVData.length;
  const avgLcp = urlCWVData.reduce((sum, d) => sum + d.lcp, 0) / totalUrls;
  const avgCls = urlCWVData.reduce((sum, d) => sum + d.cls, 0) / totalUrls;
  const avgInp = urlCWVData.reduce((sum, d) => sum + d.inp, 0) / totalUrls;

  // Count URLs passing all CWV
  let passingUrls = 0;
  urlCWVData.forEach(({ lcp, cls, inp }) => {
    if (lcp <= 2500 && cls <= 0.1 && inp <= 200) {
      passingUrls++;
    }
  });

  // Calculate overall status based on averages
  let goodUrls = 0;
  let needsImprovementUrls = 0;
  let poorUrls = 0;

  urlCWVData.forEach(({ lcp, cls, inp }) => {
    const lcpStatus = lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs_improvement' : 'poor';
    const clsStatus = cls <= 0.1 ? 'good' : cls <= 0.25 ? 'needs_improvement' : 'poor';
    const inpStatus = inp <= 200 ? 'good' : inp <= 500 ? 'needs_improvement' : 'poor';

    // Overall status is worst of all metrics
    if (lcpStatus === 'poor' || clsStatus === 'poor' || inpStatus === 'poor') {
      poorUrls++;
    } else if (lcpStatus === 'needs_improvement' || clsStatus === 'needs_improvement' || inpStatus === 'needs_improvement') {
      needsImprovementUrls++;
    } else {
      goodUrls++;
    }
  });

  // Performance score (simplified calculation)
  const avgPerformanceScore = Math.round(
    Math.max(0, Math.min(100,
      100 - (avgLcp / 100) - (avgCls * 100) - (avgInp / 10)
    ))
  );

  return {
    projectId,
    projectName: 'Example Project',
    device,
    lastUpdated: new Date().toISOString(),
    kpi: {
      totalUrls,
      goodUrls,
      needsImprovementUrls,
      poorUrls,
      avgPerformanceScore,
      avgLcp: Math.round(avgLcp),
      avgCls: avgCls,
      avgInp: Math.round(avgInp),
      passRate: (passingUrls / totalUrls) * 100
    },
    distribution: {
      lcp: lcpDistribution,
      inp: inpDistribution,
      cls: clsDistribution
    },
    urlSamples: {
      lcp: { worst: lcpWorst.slice(0, 5) },
      inp: { worst: inpWorst.slice(0, 5) },
      cls: { worst: clsWorst.slice(0, 5) }
    }
  };
}

/**
 * Fetch CWV dashboard data for a project
 */
export async function getCWVDashboard(
  projectId: string, 
  device: DeviceProfile = 'mobile'
): Promise<CWVDashboardData> {
  // Return mock data if USE_MOCK is true
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockDashboardData(projectId, device);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/cwv/dashboard?projectId=${projectId}&device=${device}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch CWV dashboard: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching CWV dashboard:', error);
    // Fallback to mock data on error
    return generateMockDashboardData(projectId, device);
  }
}

/**
 * Get filtered URLs by CWV status
 */
export async function getCWVFilteredUrls(
  projectId: string,
  device: DeviceProfile,
  metric: 'lcp' | 'inp' | 'cls' | 'all',
  status: CWVStatus
): Promise<UrlSample[]> {
  // In development, return mock data
  if (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_API_URL) {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate filtered mock data
    const mockData = generateMockDashboardData(projectId, device);
    
    if (metric === 'all') {
      // Filter by overall status - simplified mock
      return mockData.urlSamples.lcp.worst
        .filter(u => u.status === status)
        .slice(0, 10);
    }
    
    return mockData.urlSamples[metric].worst
      .filter(u => u.status === status)
      .slice(0, 10);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/cwv/urls?projectId=${projectId}&device=${device}&metric=${metric}&status=${status}`,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch filtered URLs: ${response.statusText}`);
  }

  return response.json();
}
