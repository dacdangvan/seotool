'use client';

/**
 * Keyword Mapping Table Component
 * 
 * Display keyword-to-page mappings with:
 * - Keyword → URL relationships
 * - Mapping status indicators
 * - Cannibalization warnings
 * - Conflict highlighting
 * - Manual remap capability (Editor/Admin)
 * - Sortable/filterable columns
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

import React, { useState, useMemo, useCallback } from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent, KeywordDifficulty } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG } from '@/types/keyword.types';
import {
  MappingStatusBadge,
  CannibalizationWarning,
  ConflictWarning,
  MappingStatsSummary,
  MappingStatusLegend,
  getMappingStatus,
  calculateCannibalizationRisk,
  type MappingStatus,
} from './MappingStatusBadge';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ExternalLink,
  Link2,
  Link2Off,
  Edit3,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  X,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface KeywordMappingRow {
  id: string;
  keyword: string;
  searchVolume: number;
  difficulty: number;
  intent: SearchIntent;
  mappedUrls: string[];
  competingKeywords: string[];  // Other keywords targeting same page
  lastUpdated: string;
  mappedBy?: string;           // Who assigned the mapping
  autoMapped?: boolean;        // Was it auto-mapped or manual
}

export type MappingSortField = 
  | 'keyword' 
  | 'searchVolume' 
  | 'difficulty' 
  | 'status'
  | 'competingCount';

export type SortDirection = 'asc' | 'desc';

export type MappingFilterStatus = 'all' | MappingStatus;

export interface KeywordMappingTableProps {
  mappings: KeywordMappingRow[];
  loading?: boolean;
  
  // Permissions
  canEdit?: boolean;  // Allow manual remap (Editor/Admin)
  
  // Callbacks
  onRemap?: (keywordId: string, newUrl: string) => void;
  onRemoveMapping?: (keywordId: string) => void;
  onViewPage?: (url: string) => void;
  
  // Pagination
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function IntentBadge({ intent }: { intent: SearchIntent }) {
  const config = SEARCH_INTENT_CONFIG[intent];
  return (
    <span className={cn(
      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
      config.bgColor,
      config.color
    )}>
      {config.label}
    </span>
  );
}

function UrlCell({ 
  urls, 
  onView, 
  showConflict 
}: { 
  urls: string[]; 
  onView?: (url: string) => void;
  showConflict?: boolean;
}) {
  if (urls.length === 0) {
    return (
      <span className="text-gray-400 italic flex items-center gap-1">
        <Link2Off className="h-3.5 w-3.5" />
        No mapping
      </span>
    );
  }

  if (urls.length === 1) {
    const url = urls[0];
    const displayUrl = url.replace(/^https?:\/\//, '').split('?')[0];
    
    return (
      <div className="flex items-center gap-2 min-w-0">
        <Link2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
        <a 
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-xs"
          title={url}
          onClick={(e) => {
            if (onView) {
              e.preventDefault();
              onView(url);
            }
          }}
        >
          {displayUrl}
        </a>
        <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
      </div>
    );
  }

  // Multiple URLs (conflict)
  return (
    <div className="space-y-1">
      {urls.map((url, i) => {
        const displayUrl = url.replace(/^https?:\/\//, '').split('?')[0];
        return (
          <div 
            key={i}
            className={cn(
              'flex items-center gap-2 min-w-0',
              showConflict && 'text-red-600'
            )}
          >
            <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
            <a 
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'hover:underline truncate max-w-xs text-sm',
                showConflict ? 'text-red-600 hover:text-red-800' : 'text-blue-600 hover:text-blue-800'
              )}
              title={url}
            >
              {displayUrl}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function CompetingKeywordsCell({ 
  keywords, 
  risk 
}: { 
  keywords: string[]; 
  risk: 'low' | 'medium' | 'high';
}) {
  const [expanded, setExpanded] = useState(false);
  
  if (keywords.length === 0) {
    return <span className="text-gray-400">—</span>;
  }

  const displayCount = expanded ? keywords.length : Math.min(3, keywords.length);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn(
          'h-3.5 w-3.5',
          risk === 'high' && 'text-red-500',
          risk === 'medium' && 'text-amber-500',
          risk === 'low' && 'text-yellow-500',
        )} />
        <span className={cn(
          'text-xs font-medium',
          risk === 'high' && 'text-red-600',
          risk === 'medium' && 'text-amber-600',
          risk === 'low' && 'text-yellow-600',
        )}>
          {keywords.length} competing
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {keywords.slice(0, displayCount).map((kw, i) => (
          <span 
            key={i}
            className="inline-flex px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600 max-w-[100px] truncate"
            title={kw}
          >
            {kw}
          </span>
        ))}
        {keywords.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Show less' : `+${keywords.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function RemapModal({
  keyword,
  currentUrl,
  onSubmit,
  onClose,
}: {
  keyword: string;
  currentUrl: string | null;
  onSubmit: (newUrl: string) => void;
  onClose: () => void;
}) {
  const [newUrl, setNewUrl] = useState(currentUrl || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) {
      setError('URL is required');
      return;
    }
    try {
      new URL(newUrl);
      onSubmit(newUrl.trim());
    } catch {
      setError('Please enter a valid URL');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Remap Keyword
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Assign a target page for keyword:
          </p>
          <p className="mt-1 font-medium text-gray-900">"{keyword}"</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target URL
            </label>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                setError('');
              }}
              placeholder="https://example.com/page"
              className={cn(
                'w-full px-3 py-2 border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                error ? 'border-red-300' : 'border-gray-300'
              )}
            />
            {error && (
              <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Save Mapping
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// SORTABLE HEADER
// =============================================================================

interface SortableHeaderProps {
  label: string;
  field: MappingSortField;
  currentField: MappingSortField;
  direction: SortDirection;
  onSort: (field: MappingSortField) => void;
  className?: string;
}

function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentField === field;
  
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 hover:text-gray-900 transition-colors',
        isActive ? 'text-gray-900' : 'text-gray-500',
        className
      )}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KeywordMappingTable({
  mappings,
  loading = false,
  canEdit = false,
  onRemap,
  onRemoveMapping,
  onViewPage,
  page = 1,
  pageSize = 20,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: KeywordMappingTableProps) {
  // State
  const [sortField, setSortField] = useState<MappingSortField>('keyword');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterStatus, setFilterStatus] = useState<MappingFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [remapModal, setRemapModal] = useState<{
    keywordId: string;
    keyword: string;
    currentUrl: string | null;
  } | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Calculate stats
  const stats = useMemo(() => {
    const result = {
      total: mappings.length,
      mapped: 0,
      unmapped: 0,
      cannibalization: 0,
      conflict: 0,
    };
    
    mappings.forEach(m => {
      const status = getMappingStatus(m.mappedUrls, m.competingKeywords);
      result[status]++;
    });
    
    return result;
  }, [mappings]);

  // Process mappings with status
  const processedMappings = useMemo(() => {
    return mappings.map(m => ({
      ...m,
      status: getMappingStatus(m.mappedUrls, m.competingKeywords),
      cannibalizationRisk: calculateCannibalizationRisk(m.competingKeywords.length),
    }));
  }, [mappings]);

  // Filter and sort
  const filteredMappings = useMemo(() => {
    let result = [...processedMappings];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(m => m.status === filterStatus);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.keyword.toLowerCase().includes(query) ||
        m.mappedUrls.some(url => url.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'keyword':
          comparison = a.keyword.localeCompare(b.keyword);
          break;
        case 'searchVolume':
          comparison = a.searchVolume - b.searchVolume;
          break;
        case 'difficulty':
          comparison = a.difficulty - b.difficulty;
          break;
        case 'status':
          const statusOrder: Record<MappingStatus, number> = {
            conflict: 0,
            cannibalization: 1,
            unmapped: 2,
            mapped: 3,
          };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'competingCount':
          comparison = a.competingKeywords.length - b.competingKeywords.length;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [processedMappings, filterStatus, searchQuery, sortField, sortDirection]);

  // Handlers
  const handleSort = useCallback((field: MappingSortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const toggleRowExpanded = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleRemap = useCallback((keywordId: string, keyword: string, currentUrl: string | null) => {
    setRemapModal({ keywordId, keyword, currentUrl });
  }, []);

  const handleRemapSubmit = useCallback((newUrl: string) => {
    if (remapModal && onRemap) {
      onRemap(remapModal.keywordId, newUrl);
    }
    setRemapModal(null);
  }, [remapModal, onRemap]);

  // Pagination
  const actualTotal = total ?? filteredMappings.length;
  const actualTotalPages = totalPages ?? Math.ceil(filteredMappings.length / pageSize);
  const paginatedMappings = totalPages 
    ? filteredMappings 
    : filteredMappings.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Mapping Overview</h3>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            {showLegend ? 'Hide' : 'Show'} Legend
          </button>
        </div>
        <MappingStatsSummary stats={stats} />
        {showLegend && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <MappingStatusLegend />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-lg border border-gray-200 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search keywords or URLs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MappingFilterStatus)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="mapped">Mapped Only</option>
            <option value="unmapped">Unmapped Only</option>
            <option value="cannibalization">Cannibalization</option>
            <option value="conflict">Conflicts</option>
          </select>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500">
          {filteredMappings.length} of {mappings.length} keywords
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                  {/* Expand column */}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  <SortableHeader
                    label="Keyword"
                    field="keyword"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  <SortableHeader
                    label="Volume"
                    field="searchVolume"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Intent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  <SortableHeader
                    label="Status"
                    field="status"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider min-w-[200px]">
                  Mapped URL
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  <SortableHeader
                    label="Competing"
                    field="competingCount"
                    currentField={sortField}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4" colSpan={canEdit ? 8 : 7}>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedMappings.length === 0 ? (
                <tr>
                  <td 
                    colSpan={canEdit ? 8 : 7} 
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No mappings found matching your criteria
                  </td>
                </tr>
              ) : (
                paginatedMappings.map((mapping) => {
                  const isExpanded = expandedRows.has(mapping.id);
                  const hasWarning = mapping.status === 'cannibalization' || mapping.status === 'conflict';
                  
                  return (
                    <React.Fragment key={mapping.id}>
                      <tr 
                        className={cn(
                          'hover:bg-gray-50 transition-colors',
                          hasWarning && 'bg-amber-50/50',
                          mapping.status === 'conflict' && 'bg-red-50/50',
                        )}
                      >
                        {/* Expand button */}
                        <td className="px-4 py-3">
                          {hasWarning && (
                            <button
                              onClick={() => toggleRowExpanded(mapping.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          )}
                        </td>

                        {/* Keyword */}
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">
                            {mapping.keyword}
                          </span>
                        </td>

                        {/* Search Volume */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatCompact(mapping.searchVolume)}
                        </td>

                        {/* Intent */}
                        <td className="px-4 py-3">
                          <IntentBadge intent={mapping.intent} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <MappingStatusBadge 
                            status={mapping.status}
                            urlCount={mapping.mappedUrls.length}
                            competingCount={mapping.competingKeywords.length}
                          />
                        </td>

                        {/* Mapped URL */}
                        <td className="px-4 py-3">
                          <UrlCell 
                            urls={mapping.mappedUrls}
                            onView={onViewPage}
                            showConflict={mapping.status === 'conflict'}
                          />
                        </td>

                        {/* Competing Keywords */}
                        <td className="px-4 py-3">
                          <CompetingKeywordsCell 
                            keywords={mapping.competingKeywords}
                            risk={mapping.cannibalizationRisk}
                          />
                        </td>

                        {/* Actions */}
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleRemap(
                                  mapping.id, 
                                  mapping.keyword,
                                  mapping.mappedUrls[0] || null
                                )}
                                className="p-1.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                                title="Edit mapping"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              {mapping.mappedUrls.length > 0 && onRemoveMapping && (
                                <button
                                  onClick={() => onRemoveMapping(mapping.id)}
                                  className="p-1.5 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                                  title="Remove mapping"
                                >
                                  <Link2Off className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Expanded warning details */}
                      {isExpanded && hasWarning && (
                        <tr className="bg-gray-50">
                          <td colSpan={canEdit ? 8 : 7} className="px-4 py-4">
                            {mapping.status === 'cannibalization' && (
                              <CannibalizationWarning
                                risk={mapping.cannibalizationRisk}
                                competingKeywords={mapping.competingKeywords}
                                targetUrl={mapping.mappedUrls[0]}
                                showDetails
                              />
                            )}
                            {mapping.status === 'conflict' && (
                              <ConflictWarning
                                keyword={mapping.keyword}
                                conflictingUrls={mapping.mappedUrls}
                                showDetails
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {actualTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Page {page} of {actualTotalPages}
              </span>
              {onPageSizeChange && (
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange?.(1)}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page === actualTotalPages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPageChange?.(actualTotalPages)}
                disabled={page === actualTotalPages}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Remap Modal */}
      {remapModal && (
        <RemapModal
          keyword={remapModal.keyword}
          currentUrl={remapModal.currentUrl}
          onSubmit={handleRemapSubmit}
          onClose={() => setRemapModal(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { MappingStatus } from './MappingStatusBadge';
export { getMappingStatus, calculateCannibalizationRisk } from './MappingStatusBadge';
