/**
 * Crawl Results Page
 * 
 * Display SEO crawl results with detailed analysis
 * v1.0 - Added URL Inventory Tab (Section 11.8)
 * v0.9 - Added Core Web Vitals columns
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';
import { 
  Globe, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Link as LinkIcon,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  ExternalLink,
  Smartphone,
  Monitor,
  Gauge,
  Layers,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { RoleGuard } from '@/components/RoleGuard';
import { fetchCrawlResult, calculateSEOHealthScore, clearCrawlCache } from '@/services/crawl.service';
import { getBatchPageCWV, getCWVSortValue } from '@/services/cwv.service';
import type { CrawlResult, PageSEOData, SEOIssue } from '@/types/crawl';
import type { PageCWV, DeviceProfile } from '@/types/cwv.types';
import { UserRole } from '@/types/auth';
import { 
  CWVScoreCell, 
  LCPCell, 
  INPCell, 
  CLSCell,
  CWVTableHeader,
  CWVMetricHeader,
} from '@/components/cwv';
import { CWVDetailPanel } from '@/components/cwv';
import { 
  RenderModeBadge, 
  RenderModeFilter, 
  RenderModeCell,
  RenderModeHeader,
  RenderModeStats,
  type RenderMode 
} from '@/components/crawl/RenderModeBadge';
import {
  JsRiskBadge,
  JsRiskCell,
  JsRiskHeader,
  JsRiskFilter,
  JsRiskStats,
  DiffReportPanel,
  type DiffReport,
  type JsDependencyRisk,
  type DiffCategory,
} from '@/components/crawl/DiffReportBadge';
import { UrlInventoryTable, CrawlCoverageBar } from '@/components/crawl/UrlInventoryTable';
import { AddUrlsModal } from '@/components/crawl/AddUrlsModal';
import { useUrlInventory, useCrawlCoverage } from '@/hooks/useUrlInventory';

// Tab types
type TabType = 'inventory' | 'results';

// Filter type for Quick Actions from dashboard
type PageFilterType = 'all' | 'issues' | 'critical' | '4xx' | 'noindex' | 'slow';

// Tab component
interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  inventoryCount?: number;
  resultsCount?: number;
}

function Tabs({ activeTab, onTabChange, inventoryCount, resultsCount }: TabsProps) {
  return (
    <div className="flex border-b mb-6">
      <button
        onClick={() => onTabChange('inventory')}
        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === 'inventory'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <Layers className="w-4 h-4" />
        All URLs (Inventory)
        {inventoryCount !== undefined && (
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'inventory' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {inventoryCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onTabChange('results')}
        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === 'results'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        <List className="w-4 h-4" />
        Crawled Pages (SEO Results)
        {resultsCount !== undefined && (
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'results' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {resultsCount}
          </span>
        )}
      </button>
    </div>
  );
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

// Severity badge component
function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}

// Score circle component
function ScoreCircle({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
  const bgColor = score >= 80 ? 'bg-green-50' : score >= 60 ? 'bg-yellow-50' : 'bg-red-50';
  const sizes = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-3xl',
  };
  
  return (
    <div className="flex flex-col items-center">
      <div className={`${sizes[size]} ${bgColor} rounded-full flex items-center justify-center`}>
        <span className={`font-bold ${color}`}>{score}</span>
      </div>
      <span className="mt-2 text-sm text-gray-600">{label}</span>
    </div>
  );
}

// Page row component
function PageRow({ 
  page, 
  isExpanded, 
  onToggle,
  cwvData,
  cwvDevice,
  onCWVClick,
  renderMode,
  renderTime,
  diffReport,
  onDiffClick,
}: { 
  page: PageSEOData; 
  isExpanded: boolean; 
  onToggle: () => void;
  cwvData?: PageCWV[];
  cwvDevice: DeviceProfile;
  onCWVClick?: () => void;
  renderMode?: RenderMode;
  renderTime?: number;
  diffReport?: DiffReport;
  onDiffClick?: () => void;
}) {
  const statusColor = page.statusCode >= 200 && page.statusCode < 300 ? 'text-green-600' : 
                      page.statusCode >= 300 && page.statusCode < 400 ? 'text-yellow-600' : 'text-red-600';
  
  const criticalCount = page.issues.filter(i => i.severity === 'critical').length;
  const warningCount = page.issues.filter(i => i.severity === 'warning').length;
  
  // Shorten URL for display
  const shortUrl = page.url.replace(/^https?:\/\/[^/]+/, '');
  
  return (
    <>
      <tr 
        className="hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center">
            {isExpanded ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
            <span className="text-sm font-medium text-gray-900 max-w-xs truncate" title={page.url}>
              {shortUrl || '/'}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`font-medium ${statusColor}`}>{page.statusCode}</span>
        </td>
        <td className="px-4 py-3">
          {renderMode && <RenderModeCell mode={renderMode} renderTime={renderTime} />}
        </td>
        <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onDiffClick?.(); }}>
          {diffReport && (
            <JsRiskCell 
              risk={diffReport.jsDependencyRisk} 
              riskFactorsCount={diffReport.riskFactors.length}
              onClick={onDiffClick}
            />
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{page.responseTime}ms</td>
        <td className="px-4 py-3 text-sm">
          {page.loadTime > 0 ? (
            <span className={page.loadTime <= 2000 ? 'text-green-600' : page.loadTime <= 3000 ? 'text-amber-600' : 'text-red-600'}>
              {page.loadTime >= 1000 ? `${(page.loadTime / 1000).toFixed(2)}s` : `${page.loadTime}ms`}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        {/* CWV Columns */}
        <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onCWVClick?.(); }}>
          <CWVScoreCell data={cwvData} device={cwvDevice} onClick={onCWVClick} />
        </td>
        <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onCWVClick?.(); }}>
          <LCPCell data={cwvData} device={cwvDevice} onClick={onCWVClick} />
        </td>
        <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); onCWVClick?.(); }}>
          <CLSCell data={cwvData} device={cwvDevice} onClick={onCWVClick} />
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs">
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                {warningCount} warning
              </span>
            )}
            {criticalCount === 0 && warningCount === 0 && (
              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                OK
              </span>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="px-4 py-4 bg-gray-50">
            <PageDetails page={page} diffReport={diffReport} />
          </td>
        </tr>
      )}
    </>
  );
}

// Page details component
function PageDetails({ page, diffReport }: { page: PageSEOData; diffReport?: DiffReport }) {
  return (
    <div className="space-y-4">
      {/* URL */}
      <div className="flex items-center gap-2">
        <a 
          href={page.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline flex items-center gap-1"
        >
          {page.url}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      
      {/* Meta Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded border">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Title</h4>
          <p className="text-sm text-gray-900">{page.title || <span className="text-red-500">Missing</span>}</p>
          <span className="text-xs text-gray-500">{page.titleLength} characters</span>
        </div>
        <div className="bg-white p-3 rounded border">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Meta Description</h4>
          <p className="text-sm text-gray-900 line-clamp-2">{page.metaDescription || <span className="text-red-500">Missing</span>}</p>
          <span className="text-xs text-gray-500">{page.metaDescriptionLength} characters</span>
        </div>
      </div>
      
      {/* Headings */}
      <div className="bg-white p-3 rounded border">
        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Headings Structure</h4>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-medium">H1:</span> {page.h1Count}
            {page.h1Tags.length > 0 && (
              <span className="text-gray-500 ml-1">({page.h1Tags[0]?.substring(0, 40)}...)</span>
            )}
          </div>
          <div><span className="font-medium">H2:</span> {page.h2Count}</div>
          <div><span className="font-medium">H3:</span> {page.h3Count}</div>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded border text-center">
          <div className="text-xl font-bold text-gray-900">{page.wordCount}</div>
          <div className="text-xs text-gray-500">Words</div>
        </div>
        <div className="bg-white p-3 rounded border text-center">
          <div className="text-xl font-bold text-gray-900">{page.internalLinksCount}</div>
          <div className="text-xs text-gray-500">Internal Links</div>
        </div>
        <div className="bg-white p-3 rounded border text-center">
          <div className="text-xl font-bold text-gray-900">{page.externalLinksCount}</div>
          <div className="text-xs text-gray-500">External Links</div>
        </div>
        <div className="bg-white p-3 rounded border text-center">
          <div className="text-xl font-bold text-gray-900">{page.imagesCount}</div>
          <div className="text-xs text-gray-500">Images</div>
        </div>
      </div>
      
      {/* Issues */}
      {page.issues.length > 0 && (
        <div className="bg-white p-3 rounded border">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Issues ({page.issues.length})</h4>
          <ul className="space-y-2">
            {page.issues.map((issue, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <SeverityBadge severity={issue.severity} />
                <span className="text-gray-700">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Diff Report Panel */}
      {diffReport && diffReport.renderMode === 'js_rendered' && (
        <DiffReportPanel report={diffReport} />
      )}
    </div>
  );
}

function CrawlResultsContent() {
  // Active tab state - default to 'inventory' per § 11.8
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  
  const [data, setData] = useState<CrawlResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<PageFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Read filter from URL params and switch to results tab if filter is set
  const searchParams = useSearchParams();
  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter && ['all', 'issues', 'critical', '4xx', 'noindex', 'slow'].includes(urlFilter)) {
      setFilter(urlFilter as PageFilterType);
      // Switch to results tab when filter is set from Quick Actions
      if (urlFilter !== 'all') {
        setActiveTab('results');
      }
    }
  }, [searchParams]);
  
  // CWV state
  const [cwvData, setCwvData] = useState<Map<string, PageCWV[]>>(new Map());
  const [cwvDevice, setCwvDevice] = useState<DeviceProfile>('mobile');
  const [cwvPanelUrl, setCwvPanelUrl] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'default' | 'cwv'>('default');
  
  // Render mode state
  const [renderModeFilter, setRenderModeFilter] = useState<RenderMode | 'all'>('all');
  const [renderModeData, setRenderModeData] = useState<Map<string, { mode: RenderMode; renderTime?: number }>>(new Map());
  
  // Diff Report state
  const [jsRiskFilter, setJsRiskFilter] = useState<JsDependencyRisk | 'all'>('all');
  const [diffReports, setDiffReports] = useState<Map<string, DiffReport>>(new Map());
  const [diffPanelUrl, setDiffPanelUrl] = useState<string | null>(null);
  
  // Add URLs Modal state
  const [showAddUrlsModal, setShowAddUrlsModal] = useState(false);
  
  // URL Inventory hooks (Section 11)
  const { currentProject } = useProject();
  const projectId = currentProject?.id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Use real project ID
  const {
    items: inventoryItems,
    isLoading: inventoryLoading,
    error: inventoryError,
    page: inventoryPage,
    totalPages: inventoryTotalPages,
    totalItems: inventoryTotalItems,
    stats: inventoryStats,
    filters: inventoryFilters,
    goToPage: inventoryGoToPage,
    setFilters: setInventoryFilters,
    refresh: refreshInventory,
  } = useUrlInventory({ projectId, pageSize: 50 });
  
  const { coverage, refresh: refreshCoverage } = useCrawlCoverage(projectId, 5000);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchCrawlResult();
      setData(result);
      
      // Load CWV data for all pages (both mobile and desktop)
      if (result.pages.length > 0) {
        const urls = result.pages.map(p => p.url);
        
        // Fetch both mobile and desktop CWV data
        const [mobileCwv, desktopCwv] = await Promise.all([
          getBatchPageCWV(projectId, urls, 'mobile'),
          getBatchPageCWV(projectId, urls, 'desktop'),
        ]);
        
        // Merge mobile and desktop data into single Map
        const mergedCwv = new Map<string, PageCWV[]>();
        for (const url of urls) {
          const mobileData = mobileCwv.get(url) || [];
          const desktopData = desktopCwv.get(url) || [];
          mergedCwv.set(url, [...mobileData, ...desktopData]);
        }
        setCwvData(mergedCwv);
        
        // Generate mock render mode data (in production, this would come from crawl result)
        const renderModes = new Map<string, { mode: RenderMode; renderTime?: number }>();
        result.pages.forEach(page => {
          // Simulate: 70% HTML-only, 30% JS-rendered
          // Pages with specific patterns are more likely to need JS rendering
          const needsJs = page.url.includes('#') || 
                         page.url.includes('?') ||
                         Math.random() < 0.3;
          
          if (needsJs) {
            renderModes.set(page.url, {
              mode: 'js_rendered',
              renderTime: Math.floor(1500 + Math.random() * 3500) // 1.5s - 5s
            });
          } else {
            renderModes.set(page.url, { mode: 'html' });
          }
        });
        setRenderModeData(renderModes);
        
        // Generate mock diff reports (in production, this would come from crawler)
        const reports = new Map<string, DiffReport>();
        result.pages.forEach(page => {
          const isJsRendered = renderModes.get(page.url)?.mode === 'js_rendered';
          
          // Generate realistic diff report based on page characteristics
          const riskLevel = isJsRendered 
            ? (Math.random() < 0.3 ? 'HIGH' : Math.random() < 0.6 ? 'MEDIUM' : 'LOW')
            : 'LOW';
          
          const generateCategory = (baseRisk: number): DiffCategory => {
            if (!isJsRendered) return 'IDENTICAL';
            const rand = Math.random();
            if (rand < baseRisk * 0.3) return 'ADDED_BY_JS';
            if (rand < baseRisk * 0.5) return 'CHANGED_BY_JS';
            if (rand < baseRisk * 0.1) return 'MISSING_IN_RENDER';
            return 'IDENTICAL';
          };
          
          const riskMultiplier = riskLevel === 'HIGH' ? 1 : riskLevel === 'MEDIUM' ? 0.5 : 0.2;
          
          const internalLinksRaw = Math.floor(5 + Math.random() * 20);
          const internalLinksDiff = isJsRendered ? Math.floor(Math.random() * 15 * riskMultiplier) : 0;
          
          const report: DiffReport = {
            url: page.url,
            renderMode: isJsRendered ? 'js_rendered' : 'html',
            jsDependencyRisk: riskLevel as JsDependencyRisk,
            timestamp: new Date().toISOString(),
            riskFactors: riskLevel === 'HIGH' 
              ? ['Title tag injected by JavaScript', 'Internal links loaded dynamically']
              : riskLevel === 'MEDIUM'
              ? ['Some content loaded via JavaScript']
              : [],
            diffSummary: {
              title: generateCategory(riskMultiplier),
              metaDescription: generateCategory(riskMultiplier * 0.7),
              canonical: generateCategory(riskMultiplier * 0.3),
              robots: 'IDENTICAL',
              h1: generateCategory(riskMultiplier * 0.8),
              h1Count: {
                raw: isJsRendered && riskLevel !== 'LOW' ? 0 : 1,
                rendered: 1,
              },
              internalLinks: {
                category: internalLinksDiff > 0 ? 'ADDED_BY_JS' : 'IDENTICAL',
                raw: internalLinksRaw,
                rendered: internalLinksRaw + internalLinksDiff,
                difference: internalLinksDiff,
                percentChange: Math.round((internalLinksDiff / internalLinksRaw) * 100),
              },
              externalLinks: {
                category: 'IDENTICAL',
                raw: Math.floor(2 + Math.random() * 5),
                rendered: Math.floor(2 + Math.random() * 5),
                difference: 0,
                percentChange: 0,
              },
              structuredData: generateCategory(riskMultiplier * 0.5),
              structuredDataTypes: {
                raw: isJsRendered && riskLevel === 'HIGH' ? [] : ['Organization', 'WebPage'],
                rendered: ['Organization', 'WebPage', 'BreadcrumbList'],
              },
              visibleTextLength: {
                raw: Math.floor(2000 + Math.random() * 3000),
                rendered: Math.floor(2500 + Math.random() * 4000),
                difference: Math.floor(500 + Math.random() * 1000),
              },
            },
          };
          
          reports.set(page.url, report);
        });
        setDiffReports(reports);
      }
    } catch (err) {
      setError('Failed to load crawl data. Make sure crawl has been run.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, [projectId]);
  
  const handleRefresh = () => {
    clearCrawlCache();
    loadData();
    refreshInventory();
    refreshCoverage();
  };
  
  // Navigate to SEO results when clicking a URL in inventory
  const handleViewUrlDetails = (url: string) => {
    // Switch to results tab and potentially filter/highlight this URL
    setActiveTab('results');
    // TODO: Could scroll to or highlight the specific URL
  };
  
  const togglePage = (url: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedPages(newExpanded);
  };
  
  // Calculate render mode stats - MUST be before any conditional returns
  const renderStats = useMemo(() => {
    let htmlCount = 0;
    let jsRenderedCount = 0;
    renderModeData.forEach(({ mode }) => {
      if (mode === 'html') htmlCount++;
      else jsRenderedCount++;
    });
    return { htmlCount, jsRenderedCount, total: renderModeData.size };
  }, [renderModeData]);
  
  // Calculate JS Risk stats - MUST be before any conditional returns
  const jsRiskStats = useMemo(() => {
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    diffReports.forEach(report => {
      if (report.jsDependencyRisk === 'HIGH') highCount++;
      else if (report.jsDependencyRisk === 'MEDIUM') mediumCount++;
      else lowCount++;
    });
    return { highCount, mediumCount, lowCount };
  }, [diffReports]);
  
  // Prepare crawl data if available
  const job = data?.job;
  const summary = data?.summary;
  const pages = data?.pages || [];
  const scores = summary ? calculateSEOHealthScore(summary, pages) : null;
  
  // Filter pages
  let filteredPages = pages.filter(page => {
    if (filter === 'all') return true;
    if (filter === 'issues') return page.issues.length > 0;
    if (filter === 'critical') return page.issues.some(i => i.severity === 'critical');
    // Quick Action filters
    if (filter === '4xx') return page.statusCode >= 400 && page.statusCode < 500;
    if (filter === 'noindex') return page.hasNoindex === true;
    if (filter === 'slow') {
      // Filter pages with slow load time (> 3 seconds) or poor CWV
      const pageCwv = cwvData.get(page.url);
      const hasSlowLoadTime = page.loadTime && page.loadTime > 3000;
      const hasPoorLCP = pageCwv?.some(c => c.lcp && c.lcp.value > 2500);
      return hasSlowLoadTime || hasPoorLCP;
    }
    return true;
  });
  
  // Filter by render mode
  if (renderModeFilter !== 'all') {
    filteredPages = filteredPages.filter(page => 
      renderModeData.get(page.url)?.mode === renderModeFilter
    );
  }
  
  // Filter by JS Risk
  if (jsRiskFilter !== 'all') {
    filteredPages = filteredPages.filter(page => 
      diffReports.get(page.url)?.jsDependencyRisk === jsRiskFilter
    );
  }
  
  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filteredPages = filteredPages.filter(page => 
      page.url.toLowerCase().includes(query) ||
      page.title?.toLowerCase().includes(query) ||
      page.metaDescription?.toLowerCase().includes(query)
    );
  }
  
  // Sort by CWV if selected
  if (sortBy === 'cwv') {
    filteredPages = [...filteredPages].sort((a, b) => {
      const aScore = getCWVSortValue(cwvData.get(a.url), cwvDevice);
      const bScore = getCWVSortValue(cwvData.get(b.url), cwvDevice);
      return bScore - aScore; // Worst first
    });
  }
  
  // Get selected page CWV for detail panel
  const selectedPageCWV = cwvPanelUrl ? cwvData.get(cwvPanelUrl) : undefined;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              URL Discovery & Crawl Results
            </h1>
            <p className="text-gray-600">
              {job?.config?.baseUrl || 'SEO analysis'} – {coverage?.totalUrls || 0} URLs discovered
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddUrlsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Add URLs
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || inventoryLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {data && (
              <a
                href="/crawl-data.json"
                download="crawl-result.json"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </a>
            )}
          </div>
        </div>
        
        {/* Tabs - § 11.8 requires URL Inventory view */}
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          inventoryCount={inventoryTotalItems || coverage?.totalUrls}
          resultsCount={summary?.totalPages}
        />
        
        {/* URL Inventory Tab Content - Default tab per § 11.8 */}
        {activeTab === 'inventory' && (
          <UrlInventoryTable
            items={inventoryItems}
            isLoading={inventoryLoading}
            error={inventoryError}
            page={inventoryPage}
            totalPages={inventoryTotalPages}
            totalItems={inventoryTotalItems}
            pageSize={50}
            stats={inventoryStats}
            coverage={coverage}
            filters={inventoryFilters}
            onPageChange={inventoryGoToPage}
            onFilterChange={setInventoryFilters}
            onRefresh={refreshInventory}
            onViewDetails={handleViewUrlDetails}
          />
        )}
        
        {/* SEO Results Tab Content */}
        {activeTab === 'results' && (
          <>
            {isLoading ? (
              <div className="animate-pulse">
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-32 bg-gray-200 rounded" />
                  ))}
                </div>
                <div className="h-96 bg-gray-200 rounded" />
              </div>
            ) : error || !data ? (
              <div className="bg-white rounded-lg border p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {error || 'No SEO crawl results available'}
                </h2>
                <p className="text-gray-600 mb-4">
                  Run the SEO crawler to analyze discovered URLs.
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <SeoResultsContent
                job={job!}
                summary={summary!}
                scores={scores!}
                filteredPages={filteredPages}
                filter={filter}
                setFilter={setFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                renderModeFilter={renderModeFilter}
                setRenderModeFilter={setRenderModeFilter}
                jsRiskFilter={jsRiskFilter}
                setJsRiskFilter={setJsRiskFilter}
                cwvDevice={cwvDevice}
                setCwvDevice={setCwvDevice}
                sortBy={sortBy}
                setSortBy={setSortBy}
                expandedPages={expandedPages}
                togglePage={togglePage}
                cwvData={cwvData}
                setCwvPanelUrl={setCwvPanelUrl}
                renderModeData={renderModeData}
                diffReports={diffReports}
                setDiffPanelUrl={setDiffPanelUrl}
                renderStats={renderStats}
                jsRiskStats={jsRiskStats}
              />
            )}
          </>
        )}
        
        {/* CWV Detail Panel */}
        <CWVDetailPanel
          isOpen={!!cwvPanelUrl}
          onClose={() => setCwvPanelUrl(null)}
          url={cwvPanelUrl || ''}
          mobileData={selectedPageCWV?.find(d => d.device === 'mobile')}
          desktopData={selectedPageCWV?.find(d => d.device === 'desktop')}
        />
        
        {/* Add URLs Modal */}
        <AddUrlsModal
          isOpen={showAddUrlsModal}
          onClose={() => setShowAddUrlsModal(false)}
          projectId={projectId}
          projectDomain={job?.config?.baseUrl || currentProject?.domain || ''}
          onSuccess={() => {
            refreshInventory();
            refreshCoverage();
          }}
        />
      </main>
    </div>
  );
}

// SEO Results Content Component - extracted for cleaner code
interface SeoResultsContentProps {
  job: CrawlResult['job'];
  summary: CrawlResult['summary'];
  scores: ReturnType<typeof calculateSEOHealthScore>;
  filteredPages: PageSEOData[];
  filter: PageFilterType;
  setFilter: (f: PageFilterType) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  renderModeFilter: RenderMode | 'all';
  setRenderModeFilter: (f: RenderMode | 'all') => void;
  jsRiskFilter: JsDependencyRisk | 'all';
  setJsRiskFilter: (f: JsDependencyRisk | 'all') => void;
  cwvDevice: DeviceProfile;
  setCwvDevice: (d: DeviceProfile) => void;
  sortBy: 'default' | 'cwv';
  setSortBy: (s: 'default' | 'cwv') => void;
  expandedPages: Set<string>;
  togglePage: (url: string) => void;
  cwvData: Map<string, PageCWV[]>;
  setCwvPanelUrl: (url: string | null) => void;
  renderModeData: Map<string, { mode: RenderMode; renderTime?: number }>;
  diffReports: Map<string, DiffReport>;
  setDiffPanelUrl: (url: string | null) => void;
  renderStats: { htmlCount: number; jsRenderedCount: number; total: number };
  jsRiskStats: { highCount: number; mediumCount: number; lowCount: number };
}

function SeoResultsContent({
  job,
  summary,
  scores,
  filteredPages,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  renderModeFilter,
  setRenderModeFilter,
  jsRiskFilter,
  setJsRiskFilter,
  cwvDevice,
  setCwvDevice,
  sortBy,
  setSortBy,
  expandedPages,
  togglePage,
  cwvData,
  setCwvPanelUrl,
  renderModeData,
  diffReports,
  setDiffPanelUrl,
  renderStats,
  jsRiskStats,
}: SeoResultsContentProps) {
  return (
    <>
      {/* Job Info */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-gray-500 uppercase">Status</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium text-green-600 capitalize">{job.status}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Pages Crawled</span>
              <div className="font-medium">{summary.totalPages}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Duration</span>
              <div className="font-medium">{formatDuration(summary.totalCrawlTime)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Avg Response</span>
              <div className="font-medium">{summary.avgResponseTime}ms</div>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">URLs Discovered</span>
              <div className="font-medium">{job.totalUrlsDiscovered}</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            {new Date(job.completedAt || job.createdAt).toLocaleString('vi-VN')}
          </div>
        </div>
      </div>
      
      {/* Scores */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">SEO Health Score</h2>
        <div className="flex justify-around">
          <ScoreCircle score={scores.overall} label="Overall" size="lg" />
          <ScoreCircle score={scores.technical} label="Technical" />
          <ScoreCircle score={scores.content} label="Content" />
          <ScoreCircle score={scores.meta} label="Meta Tags" />
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.totalPages}</div>
              <div className="text-sm text-gray-500">Pages Analyzed</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.totalIssues}</div>
              <div className="text-sm text-gray-500">
                Total Issues ({summary.criticalIssues} critical)
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <LinkIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.uniqueInternalLinks}</div>
              <div className="text-sm text-gray-500">Unique Internal Links</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ImageIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.altTextCoverage}%</div>
              <div className="text-sm text-gray-500">Image Alt Coverage</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Issue Summary */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <h3 className="font-semibold mb-3">Issue Summary</h3>
        <div className="grid grid-cols-6 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-red-600">{summary.pagesWithoutTitle}</div>
            <div className="text-xs text-gray-500">Missing Title</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600">{summary.pagesWithoutMetaDescription}</div>
            <div className="text-xs text-gray-500">Missing Description</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600">{summary.pagesWithoutH1}</div>
            <div className="text-xs text-gray-500">Missing H1</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-600">{summary.pagesWithMultipleH1}</div>
            <div className="text-xs text-gray-500">Multiple H1</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600">{summary.pagesWithThinContent}</div>
            <div className="text-xs text-gray-500">Thin Content</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-600">{summary.imagesWithoutAlt}</div>
            <div className="text-xs text-gray-500">Images No Alt</div>
          </div>
        </div>
      </div>
      
      {/* Pages Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header Row 1: Title + Search */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Crawled Pages ({filteredPages.length})</h3>
              <RenderModeStats 
                htmlCount={renderStats.htmlCount} 
                jsRenderedCount={renderStats.jsRenderedCount} 
                total={renderStats.total} 
              />
              <JsRiskStats 
                highCount={jsRiskStats.highCount}
                mediumCount={jsRiskStats.mediumCount}
                lowCount={jsRiskStats.lowCount}
              />
            </div>
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by URL, title, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          
          {/* Header Row 2: Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Render Mode Filter */}
            <RenderModeFilter value={renderModeFilter} onChange={setRenderModeFilter} />
            
            {/* JS Risk Filter */}
            <JsRiskFilter value={jsRiskFilter} onChange={setJsRiskFilter} />
            
            {/* CWV Device Toggle */}
            <CWVTableHeader device={cwvDevice} onDeviceChange={setCwvDevice} />
            
            {/* Sort by */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sort:</span>
              <button
                onClick={() => setSortBy('default')}
                className={`px-3 py-1 rounded text-sm ${sortBy === 'default' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
              >
                Default
              </button>
              <button
                onClick={() => setSortBy('cwv')}
                className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${sortBy === 'cwv' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
              >
                <Gauge size={14} />
                Worst CWV
              </button>
            </div>
            
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('issues')}
                className={`px-3 py-1 rounded text-sm ${filter === 'issues' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}
              >
                With Issues
              </button>
              <button
                onClick={() => setFilter('critical')}
                className={`px-3 py-1 rounded text-sm ${filter === 'critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}
              >
                Critical Only
              </button>
              <button
                onClick={() => setFilter('4xx')}
                className={`px-3 py-1 rounded text-sm ${filter === '4xx' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100'}`}
              >
                4xx Errors
              </button>
              <button
                onClick={() => setFilter('noindex')}
                className={`px-3 py-1 rounded text-sm ${filter === 'noindex' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}
              >
                Noindex
              </button>
              <button
                onClick={() => setFilter('slow')}
                className={`px-3 py-1 rounded text-sm ${filter === 'slow' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100'}`}
              >
                Slow Pages
              </button>
            </div>
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <RenderModeHeader />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <JsRiskHeader />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Load Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <div className="flex items-center gap-1">
                  Score
                  {cwvDevice === 'mobile' ? <Smartphone size={12} /> : <Monitor size={12} />}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <CWVMetricHeader metric="lcp" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <CWVMetricHeader metric="cls" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredPages.map(page => {
              const pageRenderMode = renderModeData.get(page.url);
              const pageDiffReport = diffReports.get(page.url);
              return (
                <PageRow
                  key={page.url}
                  page={page}
                  isExpanded={expandedPages.has(page.url)}
                  onToggle={() => togglePage(page.url)}
                  cwvData={cwvData.get(page.url)}
                  cwvDevice={cwvDevice}
                  onCWVClick={() => setCwvPanelUrl(page.url)}
                  renderMode={pageRenderMode?.mode}
                  renderTime={pageRenderMode?.renderTime}
                  diffReport={pageDiffReport}
                  onDiffClick={() => setDiffPanelUrl(page.url)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function CrawlResultsPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.EDITOR]}>
      <CrawlResultsContent />
    </RoleGuard>
  );
}
