'use client';

/**
 * Google Search Console Analytics Page
 * 
 * Displays GSC data: queries, pages, clicks, impressions, CTR, positions
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import { formatNumber, formatCompact } from '@/lib/utils';
import { 
  Search, 
  MousePointer2,
  Eye,
  Percent,
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Globe,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
interface GSCQueryItem {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCPageItem {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCDateItem {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCAnalyticsResponse {
  success: boolean;
  data: {
    dimension: string;
    items: GSCQueryItem[] | GSCPageItem[] | GSCDateItem[];
    pagination: {
      total: number;
      limit: string;
      offset: number;
    };
  };
}

interface GSCSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  totalQueries: number;
  totalPages: number;
}

type ViewTab = 'queries' | 'pages' | 'dates';
type SortField = 'clicks' | 'impressions' | 'ctr' | 'position';
type SortOrder = 'asc' | 'desc';

// KPI Card Component
function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  subtitle,
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && (
        <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType; 
  label: string; 
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// Sort Header Component
function SortHeader({ 
  label, 
  field, 
  currentSort, 
  currentOrder, 
  onSort 
}: { 
  label: string; 
  field: SortField; 
  currentSort: SortField; 
  currentOrder: SortOrder; 
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;
  return (
    <th 
      className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? 'text-blue-600' : ''}`} />
        {isActive && (
          <span className="text-xs text-blue-600">
            {currentOrder === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </div>
    </th>
  );
}

// CTR Badge Component
function CTRBadge({ ctr }: { ctr: number }) {
  const percentage = ctr * 100;
  let color = 'bg-gray-100 text-gray-700';
  if (percentage >= 5) color = 'bg-green-100 text-green-700';
  else if (percentage >= 2) color = 'bg-yellow-100 text-yellow-700';
  else if (percentage < 1) color = 'bg-red-100 text-red-700';
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {percentage.toFixed(2)}%
    </span>
  );
}

// Position Badge Component
function PositionBadge({ position }: { position: number }) {
  let color = 'bg-gray-100 text-gray-700';
  if (position <= 3) color = 'bg-green-100 text-green-700';
  else if (position <= 10) color = 'bg-blue-100 text-blue-700';
  else if (position <= 20) color = 'bg-yellow-100 text-yellow-700';
  else color = 'bg-red-100 text-red-700';
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {position.toFixed(1)}
    </span>
  );
}

// Main Content Component
function GSCAnalyticsContent() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<ViewTab>('queries');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [queries, setQueries] = useState<GSCQueryItem[]>([]);
  const [pages, setPages] = useState<GSCPageItem[]>([]);
  const [dates, setDates] = useState<GSCDateItem[]>([]);
  const [summary, setSummary] = useState<GSCSummary | null>(null);
  
  // Pagination
  const [queryPage, setQueryPage] = useState(0);
  const [pagePage, setPagePage] = useState(0);
  const [totalQueries, setTotalQueries] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 20;
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('clicks');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch GSC data
  const fetchGSCData = useCallback(async (dimension: string, offset: number = 0) => {
    if (!currentProject?.id) return null;
    
    try {
      const params = new URLSearchParams({
        dimension,
        limit: pageSize.toString(),
        offset: offset.toString(),
        sortBy: sortField,
        sortOrder,
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await fetch(
        `${API_BASE}/projects/${currentProject.id}/gsc/analytics?${params}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch GSC data');
      
      const data: GSCAnalyticsResponse = await response.json();
      return data;
    } catch (err) {
      console.error(`Failed to fetch ${dimension}:`, err);
      return null;
    }
  }, [currentProject?.id, sortField, sortOrder, searchQuery]);

  // Load data based on active tab
  useEffect(() => {
    const loadData = async () => {
      if (!currentProject?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Always load queries for summary
        const queriesData = await fetchGSCData('query', queryPage * pageSize);
        if (queriesData?.success) {
          setQueries(queriesData.data.items as GSCQueryItem[]);
          setTotalQueries(queriesData.data.pagination.total);
        }
        
        // Load pages data
        const pagesData = await fetchGSCData('page', pagePage * pageSize);
        if (pagesData?.success) {
          setPages(pagesData.data.items as GSCPageItem[]);
          setTotalPages(pagesData.data.pagination.total);
        }
        
        // Load dates data (for trend chart)
        const datesData = await fetchGSCData('date', 0);
        if (datesData?.success) {
          setDates(datesData.data.items as GSCDateItem[]);
        }
        
        // Calculate summary from queries (first page gives good approximation)
        if (queriesData?.success) {
          const items = queriesData.data.items as GSCQueryItem[];
          const totalClicks = items.reduce((sum, i) => sum + i.clicks, 0);
          const totalImpressions = items.reduce((sum, i) => sum + i.impressions, 0);
          const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
          const avgPosition = items.length > 0 
            ? items.reduce((sum, i) => sum + i.position, 0) / items.length 
            : 0;
          
          setSummary({
            totalClicks,
            totalImpressions,
            avgCtr,
            avgPosition,
            totalQueries: queriesData.data.pagination.total,
            totalPages: pagesData?.data.pagination.total || 0,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentProject?.id, fetchGSCData, queryPage, pagePage]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setQueryPage(0);
    setPagePage(0);
  };

  // Filter data based on search
  const filteredQueries = useMemo(() => {
    if (!searchQuery) return queries;
    return queries.filter(q => 
      q.query.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [queries, searchQuery]);

  const filteredPages = useMemo(() => {
    if (!searchQuery) return pages;
    return pages.filter(p => 
      p.page.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pages, searchQuery]);

  if (!currentProject) {
    return (
      <main className="ml-64 p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Vui lòng chọn dự án</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ml-64 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Globe className="w-7 h-7 text-blue-600" />
              Google Search Console
            </h1>
            <p className="text-gray-500 mt-1">
              Phân tích hiệu suất tìm kiếm từ GSC
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Tổng Clicks"
              value={formatCompact(summary.totalClicks)}
              icon={MousePointer2}
              color="bg-blue-100 text-blue-600"
              subtitle={`Từ ${formatCompact(summary.totalQueries)} queries`}
            />
            <KPICard
              title="Tổng Impressions"
              value={formatCompact(summary.totalImpressions)}
              icon={Eye}
              color="bg-green-100 text-green-600"
              subtitle={`Từ ${formatCompact(summary.totalPages)} pages`}
            />
            <KPICard
              title="CTR Trung bình"
              value={`${(summary.avgCtr * 100).toFixed(2)}%`}
              icon={Percent}
              color="bg-yellow-100 text-yellow-600"
              subtitle={summary.avgCtr >= 0.03 ? 'Tốt' : summary.avgCtr >= 0.01 ? 'Trung bình' : 'Cần cải thiện'}
            />
            <KPICard
              title="Vị trí Trung bình"
              value={summary.avgPosition.toFixed(1)}
              icon={BarChart3}
              color="bg-purple-100 text-purple-600"
              subtitle={summary.avgPosition <= 10 ? 'Top 10' : summary.avgPosition <= 20 ? 'Trang 2' : 'Ngoài top 20'}
            />
          </div>
        )}

        {/* Tabs & Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TabButton 
                active={activeTab === 'queries'} 
                onClick={() => setActiveTab('queries')}
                icon={Search}
                label={`Queries (${formatCompact(totalQueries)})`}
              />
              <TabButton 
                active={activeTab === 'pages'} 
                onClick={() => setActiveTab('pages')}
                icon={FileText}
                label={`Pages (${formatCompact(totalPages)})`}
              />
              <TabButton 
                active={activeTab === 'dates'} 
                onClick={() => setActiveTab('dates')}
                icon={Calendar}
                label="Xu hướng"
              />
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Đang tải dữ liệu GSC...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Queries Table */}
        {!loading && activeTab === 'queries' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Query</th>
                    <SortHeader label="Clicks" field="clicks" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Impressions" field="impressions" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="CTR" field="ctr" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Position" field="position" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredQueries.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-900 font-medium truncate max-w-md" title={item.query}>
                            {item.query}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600">
                        {formatNumber(item.clicks)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {formatNumber(item.impressions)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <CTRBadge ctr={item.ctr} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <PositionBadge position={item.position} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                Hiển thị {queryPage * pageSize + 1} - {Math.min((queryPage + 1) * pageSize, totalQueries)} / {formatNumber(totalQueries)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQueryPage(Math.max(0, queryPage - 1))}
                  disabled={queryPage === 0}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Trang {queryPage + 1} / {Math.ceil(totalQueries / pageSize)}
                </span>
                <button
                  onClick={() => setQueryPage(queryPage + 1)}
                  disabled={(queryPage + 1) * pageSize >= totalQueries}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pages Table */}
        {!loading && activeTab === 'pages' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Page URL</th>
                    <SortHeader label="Clicks" field="clicks" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Impressions" field="impressions" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="CTR" field="ctr" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                    <SortHeader label="Position" field="position" currentSort={sortField} currentOrder={sortOrder} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <a 
                            href={item.page} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-lg"
                            title={item.page}
                          >
                            {item.page.replace(/^https?:\/\/[^\/]+/, '')}
                          </a>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600">
                        {formatNumber(item.clicks)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {formatNumber(item.impressions)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <CTRBadge ctr={item.ctr} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <PositionBadge position={item.position} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                Hiển thị {pagePage * pageSize + 1} - {Math.min((pagePage + 1) * pageSize, totalPages)} / {formatNumber(totalPages)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagePage(Math.max(0, pagePage - 1))}
                  disabled={pagePage === 0}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Trang {pagePage + 1} / {Math.ceil(totalPages / pageSize)}
                </span>
                <button
                  onClick={() => setPagePage(pagePage + 1)}
                  disabled={(pagePage + 1) * pageSize >= totalPages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dates/Trend Table */}
        {!loading && activeTab === 'dates' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Xu hướng theo ngày (30 ngày gần nhất)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ngày</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Clicks</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Impressions</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">CTR</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">
                            {new Date(item.date).toLocaleDateString('vi-VN', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600">
                        {formatNumber(item.clicks)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {formatNumber(item.impressions)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <CTRBadge ctr={item.ctr} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <PositionBadge position={item.position} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Main Page Component
export default function SearchConsolePage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <GSCAnalyticsContent />
      </div>
    </RoleGuard>
  );
}
