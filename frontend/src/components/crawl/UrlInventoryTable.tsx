/**
 * URL Inventory Table Component
 * 
 * Displays all discovered URLs regardless of crawl status
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6 Section 11.8
 * 
 * Features:
 * - Display URL, discovery source, crawl state
 * - Pagination required
 * - Must NOT depend on SEO crawl completion
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Link as LinkIcon,
  Home,
  Map,
  Globe,
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Ban,
  XCircle,
  FileCode,
  ExternalLink,
  Info,
  Layers,
} from 'lucide-react';
import type {
  UrlInventoryItem,
  UrlInventoryState,
  UrlDiscoverySource,
  UrlInventoryStats,
  UrlInventoryFilters,
  CrawlCoverageSummary,
} from '@/types/url-inventory.types';
import { URL_STATE_CONFIG, URL_SOURCE_CONFIG } from '@/types/url-inventory.types';

// ============ State Badge Component ============

interface StateBadgeProps {
  state: UrlInventoryState;
  size?: 'sm' | 'md';
}

export function StateBadge({ state, size = 'sm' }: StateBadgeProps) {
  const config = URL_STATE_CONFIG[state];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses}`}
      title={config.description}
    >
      <StateIcon state={state} size={size === 'sm' ? 12 : 14} />
      {config.label}
    </span>
  );
}

function StateIcon({ state, size = 14 }: { state: UrlInventoryState; size?: number }) {
  const iconProps = { size, className: 'flex-shrink-0' };

  switch (state) {
    case 'DISCOVERED':
      return <Clock {...iconProps} />;
    case 'QUEUED_FOR_CRAWL':
      return <RefreshCw {...iconProps} className="animate-spin" />;
    case 'CRAWLED':
      return <CheckCircle {...iconProps} />;
    case 'FAILED':
      return <XCircle {...iconProps} />;
    case 'BLOCKED_BY_POLICY':
      return <Ban {...iconProps} />;
    default:
      return <AlertCircle {...iconProps} />;
  }
}

// ============ Source Badge Component ============

interface SourceBadgeProps {
  source: UrlDiscoverySource;
  size?: 'sm' | 'md';
}

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const config = URL_SOURCE_CONFIG[source];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium bg-gray-100 text-gray-700 ${sizeClasses}`}
      title={config.description}
    >
      <SourceIcon source={source} size={size === 'sm' ? 12 : 14} />
      {config.label}
    </span>
  );
}

function SourceIcon({ source, size = 14 }: { source: UrlDiscoverySource; size?: number }) {
  const iconProps = { size, className: 'flex-shrink-0' };

  switch (source) {
    case 'SEED':
      return <Target {...iconProps} />;
    case 'HOMEPAGE':
      return <Home {...iconProps} />;
    case 'INTERNAL_LINK':
      return <LinkIcon {...iconProps} />;
    case 'SITEMAP':
      return <Map {...iconProps} />;
    case 'RENDERED_DOM':
      return <Globe {...iconProps} />;
    default:
      return <LinkIcon {...iconProps} />;
  }
}

// ============ State Filter Component ============

interface StateFilterProps {
  value: UrlInventoryState | 'all';
  onChange: (value: UrlInventoryState | 'all') => void;
  stats?: UrlInventoryStats;
}

export function StateFilter({ value, onChange, stats }: StateFilterProps) {
  const states: Array<UrlInventoryState | 'all'> = [
    'all',
    'DISCOVERED',
    'QUEUED_FOR_CRAWL',
    'CRAWLED',
    'FAILED',
    'BLOCKED_BY_POLICY',
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {states.map((state) => {
        const isActive = value === state;
        const count = state === 'all' 
          ? stats?.totalDiscovered 
          : stats?.byState[state];

        return (
          <button
            key={state}
            onClick={() => onChange(state)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {state === 'all' ? (
              'All'
            ) : (
              <>
                <StateIcon state={state} size={14} />
                {URL_STATE_CONFIG[state].label}
              </>
            )}
            {count !== undefined && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                isActive ? 'bg-blue-500' : 'bg-gray-200'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============ Source Filter Component ============

interface SourceFilterProps {
  value: UrlDiscoverySource | 'all';
  onChange: (value: UrlDiscoverySource | 'all') => void;
  stats?: UrlInventoryStats;
}

export function SourceFilter({ value, onChange, stats }: SourceFilterProps) {
  const sources: Array<UrlDiscoverySource | 'all'> = [
    'all',
    'SEED',
    'HOMEPAGE',
    'INTERNAL_LINK',
    'SITEMAP',
    'RENDERED_DOM',
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as UrlDiscoverySource | 'all')}
      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    >
      {sources.map((source) => {
        const count = source === 'all' 
          ? stats?.totalDiscovered 
          : stats?.bySource[source];
        const label = source === 'all' ? 'All Sources' : URL_SOURCE_CONFIG[source].label;
        
        return (
          <option key={source} value={source}>
            {label} {count !== undefined ? `(${count})` : ''}
          </option>
        );
      })}
    </select>
  );
}

// ============ Crawl Coverage Bar ============

interface CrawlCoverageBarProps {
  coverage: CrawlCoverageSummary;
}

export function CrawlCoverageBar({ coverage }: CrawlCoverageBarProps) {
  const {
    totalUrls,
    crawledUrls,
    coveragePercent,
    pendingUrls,
    failedUrls,
    blockedUrls,
  } = coverage;

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">Crawl Coverage</span>
        </div>
        <span className="text-2xl font-bold text-blue-600">
          {coveragePercent.toFixed(1)}%
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div className="h-full flex">
          {/* Crawled */}
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${(crawledUrls / totalUrls) * 100}%` }}
          />
          {/* Failed */}
          <div
            className="bg-red-400 transition-all duration-300"
            style={{ width: `${(failedUrls / totalUrls) * 100}%` }}
          />
          {/* Blocked */}
          <div
            className="bg-orange-400 transition-all duration-300"
            style={{ width: `${(blockedUrls / totalUrls) * 100}%` }}
          />
          {/* Pending */}
          <div
            className="bg-blue-300 transition-all duration-300"
            style={{ width: `${(pendingUrls / totalUrls) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">Crawled: <strong>{crawledUrls}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-300" />
          <span className="text-gray-600">Pending: <strong>{pendingUrls}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-gray-600">Failed: <strong>{failedUrls}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-400" />
          <span className="text-gray-600">Blocked: <strong>{blockedUrls}</strong></span>
        </div>
        <div className="ml-auto text-gray-700">
          <strong>{totalUrls}</strong> total URLs
        </div>
      </div>
    </div>
  );
}

// ============ Pagination Component ============

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5;
    
    if (totalPages <= showPages + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      pages.push(1);
      
      if (page > 3) {
        pages.push('ellipsis');
      }
      
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (page < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t">
      <div className="text-sm text-gray-700">
        Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of{' '}
        <strong>{totalItems}</strong> URLs
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        {getPageNumbers().map((p, idx) => (
          p === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {p}
            </button>
          )
        ))}
        
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ============ URL Row Component ============

interface UrlRowProps {
  item: UrlInventoryItem;
  onViewDetails?: (url: string) => void;
}

function UrlRow({ item, onViewDetails }: UrlRowProps) {
  const shortUrl = item.normalizedUrl.replace(/^https?:\/\/[^/]+/, '');
  
  return (
    <tr className="hover:bg-gray-50">
      {/* URL */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {item.renderMode && (
            <span
              className={`p-1 rounded ${
                item.renderMode === 'js_rendered' 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'bg-gray-100 text-gray-600'
              }`}
              title={item.renderMode === 'js_rendered' ? 'JS Rendered' : 'HTML Only'}
            >
              {item.renderMode === 'js_rendered' ? (
                <Globe className="w-3.5 h-3.5" />
              ) : (
                <FileCode className="w-3.5 h-3.5" />
              )}
            </span>
          )}
          <span 
            className="text-sm font-medium text-gray-900 max-w-md truncate cursor-pointer hover:text-blue-600"
            title={item.normalizedUrl}
            onClick={() => onViewDetails?.(item.normalizedUrl)}
          >
            {shortUrl || '/'}
          </span>
          <a
            href={item.normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-600"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </td>
      
      {/* State */}
      <td className="px-4 py-3">
        <StateBadge state={item.state} />
      </td>
      
      {/* Source */}
      <td className="px-4 py-3">
        <SourceBadge source={item.source} />
      </td>
      
      {/* Depth */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-gray-600">{item.depth}</span>
      </td>
      
      {/* Status Code */}
      <td className="px-4 py-3 text-center">
        {item.statusCode ? (
          <span className={`text-sm font-medium ${
            item.statusCode >= 200 && item.statusCode < 300 ? 'text-green-600' :
            item.statusCode >= 300 && item.statusCode < 400 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {item.statusCode}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      
      {/* Discovered At */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">
          {new Date(item.discoveredAt).toLocaleString('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
      </td>
      
      {/* Error/Block Reason */}
      <td className="px-4 py-3">
        {item.errorMessage && (
          <span 
            className="text-xs text-red-600 max-w-xs truncate block"
            title={item.errorMessage}
          >
            {item.errorMessage}
          </span>
        )}
        {item.blockReason && (
          <span 
            className="text-xs text-orange-600 max-w-xs truncate block"
            title={item.blockReason}
          >
            {item.blockReason}
          </span>
        )}
      </td>
    </tr>
  );
}

// ============ Main URL Inventory Table ============

interface UrlInventoryTableProps {
  items: UrlInventoryItem[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  stats: UrlInventoryStats | null;
  coverage?: CrawlCoverageSummary | null;
  filters: UrlInventoryFilters;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: UrlInventoryFilters) => void;
  onRefresh: () => void;
  onViewDetails?: (url: string) => void;
}

export function UrlInventoryTable({
  items,
  isLoading,
  error,
  page,
  totalPages,
  totalItems,
  pageSize,
  stats,
  coverage,
  filters,
  onPageChange,
  onFilterChange,
  onRefresh,
  onViewDetails,
}: UrlInventoryTableProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearch = () => {
    onFilterChange({ ...filters, search: searchInput || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Crawl Coverage Bar - § 11.8 */}
      {coverage && <CrawlCoverageBar coverage={coverage} />}

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search URLs..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
            <SourceFilter
              value={(filters.source as UrlDiscoverySource) || 'all'}
              onChange={(source) => onFilterChange({ 
                ...filters, 
                source: source === 'all' ? undefined : source 
              })}
              stats={stats || undefined}
            />
            <button
              onClick={onRefresh}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* State Filter */}
          <StateFilter
            value={(filters.state as UrlInventoryState) || 'all'}
            onChange={(state) => onFilterChange({ 
              ...filters, 
              state: state === 'all' ? undefined : state 
            })}
            stats={stats || undefined}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">{error}</p>
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : isLoading && items.length === 0 ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading URL inventory...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <LinkIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No URLs found matching your filters.</p>
            <button
              onClick={() => onFilterChange({})}
              className="mt-4 px-4 py-2 text-blue-600 hover:underline"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      State
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Depth
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Discovered
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <UrlRow 
                      key={item.normalizedUrl} 
                      item={item} 
                      onViewDetails={onViewDetails}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={onPageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default UrlInventoryTable;
