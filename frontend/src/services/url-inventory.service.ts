/**
 * URL Inventory Service
 * 
 * Service for fetching URL inventory data per § 11
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6
 */

import type {
  UrlInventoryResponse,
  UrlInventoryFilters,
  UrlInventoryStats,
  UrlInventoryItem,
  CrawlCoverageSummary,
  UrlInventoryState,
  UrlDiscoverySource,
} from '@/types/url-inventory.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

/**
 * Fetch URL inventory for a project
 * GET /projects/:projectId/urls
 */
export async function fetchUrlInventory(
  projectId: string,
  page: number = 1,
  pageSize: number = 50,
  filters?: UrlInventoryFilters
): Promise<UrlInventoryResponse> {
  if (USE_MOCK) {
    return generateMockInventory(projectId, page, pageSize, filters);
  }

  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (filters?.state && filters.state !== 'all') {
    params.append('state', filters.state);
  }
  if (filters?.source && filters.source !== 'all') {
    params.append('source', filters.source);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }
  if (filters?.maxDepth !== undefined) {
    params.append('maxDepth', filters.maxDepth.toString());
  }
  if (filters?.sortBy) {
    params.append('sortBy', filters.sortBy);
  }
  if (filters?.sortOrder) {
    params.append('sortOrder', filters.sortOrder);
  }

  const response = await fetch(
    `${API_BASE}/projects/${projectId}/urls?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch URL inventory');
  }

  return response.json();
}

/**
 * Get crawl coverage summary for a project
 * Per § 11.8 - Always show crawl coverage
 */
export async function getCrawlCoverage(projectId: string): Promise<CrawlCoverageSummary> {
  if (USE_MOCK) {
    return generateMockCoverage(projectId);
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/urls/coverage`);

  if (!response.ok) {
    throw new Error('Failed to fetch crawl coverage');
  }

  return response.json();
}

/**
 * Get URL inventory statistics
 */
export async function getUrlInventoryStats(projectId: string): Promise<UrlInventoryStats> {
  if (USE_MOCK) {
    const inventory = await generateMockInventory(projectId, 1, 1);
    return inventory.stats;
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/urls/stats`);

  if (!response.ok) {
    throw new Error('Failed to fetch URL inventory stats');
  }

  return response.json();
}

// ============ Mock Data Generation ============

// Mock data cache to ensure consistency across requests
let mockInventoryCache: Map<string, UrlInventoryItem[]> = new Map();

function generateMockInventory(
  projectId: string,
  page: number,
  pageSize: number,
  filters?: UrlInventoryFilters
): UrlInventoryResponse {
  // Generate or get cached mock data
  if (!mockInventoryCache.has(projectId)) {
    mockInventoryCache.set(projectId, generateMockUrls(projectId));
  }

  let items = mockInventoryCache.get(projectId)!;

  // Apply filters
  if (filters?.state && filters.state !== 'all') {
    items = items.filter(item => item.state === filters.state);
  }
  if (filters?.source && filters.source !== 'all') {
    items = items.filter(item => item.source === filters.source);
  }
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    items = items.filter(item => 
      item.normalizedUrl.toLowerCase().includes(searchLower)
    );
  }
  if (filters?.maxDepth !== undefined) {
    items = items.filter(item => item.depth <= filters.maxDepth!);
  }

  // Apply sorting
  const sortBy = filters?.sortBy || 'discoveredAt';
  const sortOrder = filters?.sortOrder || 'desc';
  items = [...items].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortBy) {
      case 'url':
        aVal = a.normalizedUrl;
        bVal = b.normalizedUrl;
        break;
      case 'depth':
        aVal = a.depth;
        bVal = b.depth;
        break;
      case 'updatedAt':
        aVal = a.updatedAt;
        bVal = b.updatedAt;
        break;
      case 'discoveredAt':
      default:
        aVal = a.discoveredAt;
        bVal = b.discoveredAt;
    }

    if (sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  // Calculate pagination
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = items.slice(startIndex, startIndex + pageSize);

  // Calculate stats from full data
  const allItems = mockInventoryCache.get(projectId)!;
  const stats = calculateStats(allItems);

  return {
    items: paginatedItems,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    stats,
  };
}

function generateMockUrls(projectId: string): UrlInventoryItem[] {
  const baseUrl = 'https://www.vib.com.vn';
  const items: UrlInventoryItem[] = [];
  const now = new Date();

  // Seed URL
  items.push(createMockItem(
    `${baseUrl}/vn`,
    'SEED',
    'CRAWLED',
    0,
    null,
    now
  ));

  // Homepage-discovered URLs (depth 1)
  const homepageUrls = [
    '/vn/the-tin-dung',
    '/vn/the-ghi-no',
    '/vn/vay-von',
    '/vn/tiet-kiem',
    '/vn/bao-hiem',
    '/vn/dau-tu',
    '/vn/ve-vib',
    '/vn/tuyen-dung',
    '/vn/tin-tuc',
    '/vn/lien-he',
  ];

  homepageUrls.forEach((path, idx) => {
    items.push(createMockItem(
      `${baseUrl}${path}`,
      'HOMEPAGE',
      idx < 6 ? 'CRAWLED' : idx < 8 ? 'QUEUED_FOR_CRAWL' : 'DISCOVERED',
      1,
      `${baseUrl}/vn`,
      new Date(now.getTime() - idx * 60000)
    ));
  });

  // Internal link discovery (depth 2-4)
  const productPages = [
    // Credit cards
    '/vn/the-tin-dung/vib-ivycard',
    '/vn/the-tin-dung/vib-cashback',
    '/vn/the-tin-dung/vib-rewards',
    '/vn/the-tin-dung/vib-premier-infinite',
    '/vn/the-tin-dung/vib-family-link',
    '/vn/the-tin-dung/vib-travel-elite',
    '/vn/the-tin-dung/vib-online-plus',
    '/vn/the-tin-dung/vib-lazcard',
    '/vn/the-tin-dung/vib-financial-free',
    '/vn/the-tin-dung/vib-supercard',
    // Debit cards
    '/vn/the-ghi-no/vib-visa-debit',
    '/vn/the-ghi-no/vib-mastercard-debit',
    // Loans
    '/vn/vay-von/vay-mua-nha',
    '/vn/vay-von/vay-mua-o-to',
    '/vn/vay-von/vay-tieu-dung',
    '/vn/vay-von/vay-the-chap',
    '/vn/vay-von/vay-kinh-doanh',
    // Savings
    '/vn/tiet-kiem/tiet-kiem-online',
    '/vn/tiet-kiem/tiet-kiem-linh-hoat',
    '/vn/tiet-kiem/tiet-kiem-dinh-ky',
    // Insurance
    '/vn/bao-hiem/bao-hiem-nhan-tho',
    '/vn/bao-hiem/bao-hiem-xe-may',
    '/vn/bao-hiem/bao-hiem-o-to',
    '/vn/bao-hiem/bao-hiem-du-lich',
  ];

  productPages.forEach((path, idx) => {
    const parentPath = path.split('/').slice(0, 4).join('/');
    items.push(createMockItem(
      `${baseUrl}${path}`,
      'INTERNAL_LINK',
      idx < 15 ? 'CRAWLED' : idx < 20 ? 'QUEUED_FOR_CRAWL' : 'DISCOVERED',
      2,
      `${baseUrl}${parentPath}`,
      new Date(now.getTime() - (10 + idx) * 60000)
    ));
  });

  // Sitemap URLs
  const sitemapUrls = [
    '/vn/khach-hang-ca-nhan',
    '/vn/khach-hang-doanh-nghiep',
    '/vn/dich-vu-ngan-hang-dien-tu',
    '/vn/mang-luoi-chi-nhanh',
    '/vn/cau-hoi-thuong-gap',
    '/vn/dieu-khoan-su-dung',
    '/vn/chinh-sach-bao-mat',
    '/vn/bieu-phi-dich-vu',
    '/vn/lai-suat',
    '/vn/ty-gia',
    '/vn/tin-tuc/2024/01/vib-ra-mat-san-pham-moi',
    '/vn/tin-tuc/2024/02/vib-tang-lai-suat-tiet-kiem',
    '/vn/tin-tuc/2024/03/vib-hop-tac-lazada',
    '/vn/tuyen-dung/chuyen-vien-it',
    '/vn/tuyen-dung/chuyen-vien-marketing',
    '/vn/tuyen-dung/chuyen-vien-tai-chinh',
  ];

  sitemapUrls.forEach((path, idx) => {
    items.push(createMockItem(
      `${baseUrl}${path}`,
      'SITEMAP',
      idx < 8 ? 'CRAWLED' : idx < 12 ? 'QUEUED_FOR_CRAWL' : 'DISCOVERED',
      3,
      null,
      new Date(now.getTime() - (30 + idx) * 60000)
    ));
  });

  // Rendered DOM discovered URLs
  const renderedDomUrls = [
    '/vn/the-tin-dung/vib-ivycard/dang-ky',
    '/vn/the-tin-dung/vib-ivycard/uu-dai',
    '/vn/the-tin-dung/vib-ivycard/dieu-kien',
    '/vn/vay-von/vay-mua-nha/tinh-lai',
    '/vn/vay-von/vay-mua-nha/dang-ky',
    '/vn/tiet-kiem/tiet-kiem-online/mo-tai-khoan',
    '/vn/dang-nhap',
    '/vn/dang-ky',
    '/vn/quen-mat-khau',
  ];

  renderedDomUrls.forEach((path, idx) => {
    // Some rendered DOM URLs may be blocked by policy
    let state: UrlInventoryState = 'DISCOVERED';
    let blockReason: string | null = null;

    if (path.includes('dang-nhap') || path.includes('dang-ky') || path.includes('quen-mat-khau')) {
      state = 'BLOCKED_BY_POLICY';
      blockReason = 'Authentication/login page excluded';
    } else if (idx < 3) {
      state = 'CRAWLED';
    } else if (idx < 5) {
      state = 'QUEUED_FOR_CRAWL';
    }

    const item = createMockItem(
      `${baseUrl}${path}`,
      'RENDERED_DOM',
      state,
      4,
      `${baseUrl}${path.split('/').slice(0, 5).join('/')}`,
      new Date(now.getTime() - (50 + idx) * 60000)
    );
    item.blockReason = blockReason;
    items.push(item);
  });

  // Add some failed URLs
  const failedUrls = [
    '/vn/page-not-found-test',
    '/vn/old-promotion-expired',
  ];

  failedUrls.forEach((path, idx) => {
    const item = createMockItem(
      `${baseUrl}${path}`,
      'INTERNAL_LINK',
      'FAILED',
      2,
      `${baseUrl}/vn`,
      new Date(now.getTime() - (70 + idx) * 60000)
    );
    item.errorMessage = 'HTTP 404 Not Found';
    item.statusCode = 404;
    items.push(item);
  });

  return items;
}

function createMockItem(
  url: string,
  source: UrlDiscoverySource,
  state: UrlInventoryState,
  depth: number,
  parentUrl: string | null,
  discoveredAt: Date
): UrlInventoryItem {
  const isCrawled = state === 'CRAWLED';
  const isFailed = state === 'FAILED';
  
  return {
    originalUrl: url,
    normalizedUrl: url,
    state,
    source,
    depth,
    parentUrl,
    canonicalUrl: isCrawled ? url : null,
    discoveredAt: discoveredAt.toISOString(),
    updatedAt: new Date(discoveredAt.getTime() + (isCrawled ? 30000 : 0)).toISOString(),
    crawlAttempts: isCrawled ? 1 : isFailed ? 2 : 0,
    lastCrawledAt: isCrawled ? new Date(discoveredAt.getTime() + 30000).toISOString() : null,
    errorMessage: null,
    renderMode: isCrawled ? (Math.random() > 0.7 ? 'js_rendered' : 'html_only') : null,
    statusCode: isCrawled ? 200 : isFailed ? 404 : null,
    blockReason: null,
  };
}

function calculateStats(items: UrlInventoryItem[]): UrlInventoryStats {
  const byState: Record<UrlInventoryState, number> = {
    DISCOVERED: 0,
    QUEUED_FOR_CRAWL: 0,
    CRAWLED: 0,
    FAILED: 0,
    BLOCKED_BY_POLICY: 0,
  };

  const bySource: Record<UrlDiscoverySource, number> = {
    SEED: 0,
    HOMEPAGE: 0,
    INTERNAL_LINK: 0,
    SITEMAP: 0,
    RENDERED_DOM: 0,
  };

  let maxDepth = 0;

  items.forEach(item => {
    byState[item.state]++;
    bySource[item.source]++;
    if (item.depth > maxDepth) maxDepth = item.depth;
  });

  const totalCrawlable = items.length - byState.BLOCKED_BY_POLICY;
  const crawlCoverage = totalCrawlable > 0 
    ? (byState.CRAWLED / totalCrawlable) * 100 
    : 0;

  const discoveryComplete = byState.DISCOVERED === 0 && byState.QUEUED_FOR_CRAWL === 0;

  return {
    totalDiscovered: items.length,
    byState,
    bySource,
    crawlCoverage,
    maxDepthReached: maxDepth,
    startedAt: items.length > 0 
      ? items.reduce((min, item) => item.discoveredAt < min ? item.discoveredAt : min, items[0].discoveredAt)
      : null,
    completedAt: discoveryComplete ? new Date().toISOString() : null,
    phase: discoveryComplete ? 'COMPLETED' : 'LINK_DISCOVERY',
  };
}

function generateMockCoverage(projectId: string): CrawlCoverageSummary {
  // Get or generate mock data
  if (!mockInventoryCache.has(projectId)) {
    mockInventoryCache.set(projectId, generateMockUrls(projectId));
  }

  const items = mockInventoryCache.get(projectId)!;
  const stats = calculateStats(items);

  const crawledUrls = stats.byState.CRAWLED;
  const pendingUrls = stats.byState.DISCOVERED + stats.byState.QUEUED_FOR_CRAWL;
  const failedUrls = stats.byState.FAILED;
  const blockedUrls = stats.byState.BLOCKED_BY_POLICY;
  const totalUrls = stats.totalDiscovered;

  return {
    totalUrls,
    crawledUrls,
    coveragePercent: stats.crawlCoverage,
    pendingUrls,
    failedUrls,
    blockedUrls,
    discoveryComplete: stats.phase === 'COMPLETED',
    crawlComplete: pendingUrls === 0 && stats.phase === 'COMPLETED',
  };
}

/**
 * Clear mock cache (for testing)
 */
export function clearMockInventoryCache(): void {
  mockInventoryCache.clear();
}
