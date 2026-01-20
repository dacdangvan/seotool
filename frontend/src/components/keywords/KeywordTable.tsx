'use client';

/**
 * Keyword Table Component
 * 
 * Display keyword list with:
 * - Keyword name
 * - Search volume
 * - Keyword difficulty (with color coding)
 * - Search intent badge
 * - Opportunity score (with color coding)
 * - Mapping status
 * - Sortable columns
 * - Pagination
 */

import React from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { 
  Keyword, 
  KeywordSortField, 
  SortDirection,
  SearchIntent,
  KeywordDifficulty,
} from '@/types/keyword.types';
import {
  SEARCH_INTENT_CONFIG,
  KEYWORD_DIFFICULTY_CONFIG,
} from '@/types/keyword.types';
import { OpportunityBadge } from './OpportunityBadge';
import { 
  ArrowUp, 
  ArrowDown, 
  Minus,
  ExternalLink,
  Link2Off,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
} from 'lucide-react';

interface KeywordTableProps {
  keywords: Keyword[];
  loading?: boolean;
  sortField: KeywordSortField;
  sortDirection: SortDirection;
  onSort: (field: KeywordSortField) => void;
  
  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function IntentBadge({ intent }: { intent: SearchIntent }) {
  const config = SEARCH_INTENT_CONFIG[intent];
  return (
    <span className={cn(
      'inline-flex px-2 py-1 rounded-full text-xs font-medium',
      config.bgColor,
      config.color
    )}>
      {config.label}
    </span>
  );
}

function DifficultyCell({ difficulty, score }: { difficulty: KeywordDifficulty; score: number }) {
  const config = KEYWORD_DIFFICULTY_CONFIG[difficulty];
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full rounded-full transition-all',
            score <= 30 && 'bg-green-500',
            score > 30 && score <= 60 && 'bg-yellow-500',
            score > 60 && score <= 80 && 'bg-orange-500',
            score > 80 && 'bg-red-500',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-sm font-medium', config.color)}>
        {score}
      </span>
    </div>
  );
}

function RankCell({ rank, change }: { rank: number | null; change: number | null }) {
  if (rank === null) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-medium">{rank}</span>
      {change !== null && change !== 0 && (
        <span className={cn(
          'inline-flex items-center text-xs',
          change > 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {change > 0 ? (
            <><ArrowUp className="w-3 h-3" />{change}</>
          ) : (
            <><ArrowDown className="w-3 h-3" />{Math.abs(change)}</>
          )}
        </span>
      )}
      {change === 0 && (
        <span className="text-gray-400">
          <Minus className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

function MappingCell({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 text-sm">
        <Link2Off className="w-4 h-4" />
        Unmapped
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm max-w-[200px] truncate"
      title={url}
    >
      <span className="truncate">{url}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  );
}

function SortHeader({ 
  label, 
  field, 
  currentField, 
  direction, 
  onSort,
  className,
}: { 
  label: string; 
  field: KeywordSortField; 
  currentField: KeywordSortField; 
  direction: SortDirection;
  onSort: (field: KeywordSortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors',
        isActive && 'text-gray-900',
        className
      )}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="w-4 h-4" />
        ) : (
          <ArrowDown className="w-4 h-4" />
        )
      ) : (
        <ArrowUpDown className="w-4 h-4 text-gray-300" />
      )}
    </button>
  );
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100">
          <div className="flex-1 h-4 bg-gray-200 rounded" />
          <div className="w-20 h-4 bg-gray-200 rounded" />
          <div className="w-24 h-4 bg-gray-200 rounded" />
          <div className="w-20 h-4 bg-gray-200 rounded" />
          <div className="w-24 h-4 bg-gray-200 rounded" />
          <div className="w-32 h-4 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// PAGINATION
// =============================================================================

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      {/* Page Size Selector */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Show</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>per page</span>
      </div>

      {/* Results Info */}
      <div className="text-sm text-gray-600">
        Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{total}</strong>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-1 mx-2">
          {/* Page numbers */}
          {generatePageNumbers(page, totalPages).map((pageNum, idx) => (
            pageNum === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum as number)}
                className={cn(
                  'w-8 h-8 text-sm rounded transition-colors',
                  page === pageNum 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                {pageNum}
              </button>
            )
          ))}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }

  return pages;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KeywordTable({
  keywords,
  loading,
  sortField,
  sortDirection,
  onSort,
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
}: KeywordTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4">
          <TableSkeleton />
        </div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-gray-400 mb-2">No keywords found</div>
        <p className="text-sm text-gray-500">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4">
                <SortHeader 
                  label="Keyword" 
                  field="keyword" 
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className="text-right py-3 px-4">
                <SortHeader 
                  label="Volume" 
                  field="searchVolume" 
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={onSort}
                  className="justify-end"
                />
              </th>
              <th className="text-center py-3 px-4">
                <SortHeader 
                  label="Difficulty" 
                  field="difficulty" 
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={onSort}
                  className="justify-center"
                />
              </th>
              <th className="text-center py-3 px-4">
                <span className="text-sm font-medium text-gray-500">Intent</span>
              </th>
              <th className="text-center py-3 px-4">
                <SortHeader 
                  label="Opportunity" 
                  field="opportunity" 
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={onSort}
                  className="justify-center"
                />
              </th>
              <th className="text-center py-3 px-4">
                <SortHeader 
                  label="Rank" 
                  field="currentRank" 
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={onSort}
                  className="justify-center"
                />
              </th>
              <th className="text-left py-3 px-4">
                <span className="text-sm font-medium text-gray-500">Mapped URL</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw) => (
              <tr 
                key={kw.id} 
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-3 px-4">
                  <div>
                    <span className="font-medium text-gray-900">{kw.keyword}</span>
                    {kw.clusterName && (
                      <span className="ml-2 text-xs text-gray-400">
                        [{kw.clusterName}]
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="font-medium text-gray-700">
                    {formatCompact(kw.searchVolume)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <DifficultyCell difficulty={kw.difficultyLevel} score={kw.difficulty} />
                </td>
                <td className="py-3 px-4 text-center">
                  <IntentBadge intent={kw.intent} />
                </td>
                <td className="py-3 px-4 text-center">
                  <OpportunityBadge 
                    opportunity={kw.opportunity} 
                    size="sm"
                    showTooltip={true}
                    variant="pill"
                  />
                </td>
                <td className="py-3 px-4 text-center">
                  <RankCell rank={kw.currentRank} change={kw.rankChange} />
                </td>
                <td className="py-3 px-4">
                  <MappingCell url={kw.mappedUrl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}

export default KeywordTable;
