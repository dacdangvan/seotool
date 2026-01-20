'use client';

/**
 * Search Intent Analysis Page
 * 
 * Displays search intent distribution with:
 * - Intent distribution chart (pie/donut)
 * - Keyword list filtered by intent
 * - Intent explanation tooltips
 * 
 * Tag: v2.11-intent-analysis-mvp
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useKeywordOverview, useKeywords } from '@/hooks/useKeyword';
import { 
  IntentDistributionChart, 
  IntentDistributionBar,
} from '@/components/keywords/IntentDistributionChart';
import { IntentBadge, IntentLegend } from '@/components/keywords/IntentBadge';
import { KeywordTable } from '@/components/keywords';
import { formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG } from '@/types/keyword.types';
import { 
  Search,
  HelpCircle,
  Filter,
  X,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ShoppingCart,
  BookOpen,
  Navigation,
  Lightbulb,
} from 'lucide-react';
import Link from 'next/link';

const PROJECT_ID = 'demo-project';

// Intent icons
const INTENT_ICONS: Record<SearchIntent, React.ElementType> = {
  transactional: ShoppingCart,
  commercial: Search,
  informational: BookOpen,
  navigational: Navigation,
};

// Summary card component
function SummaryCard({ 
  intent,
  count,
  volume,
  percentage,
  isSelected,
  onClick,
}: { 
  intent: SearchIntent;
  count: number;
  volume: number;
  percentage: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = SEARCH_INTENT_CONFIG[intent];
  const Icon = INTENT_ICONS[intent];
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full bg-white rounded-xl border-2 p-4 transition-all text-left ${
        isSelected 
          ? `border-current shadow-lg ${config.color}` 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className={`text-2xl font-bold ${isSelected ? config.color : 'text-gray-900'}`}>
          {percentage.toFixed(0)}%
        </div>
      </div>
      
      <div className={`font-semibold mb-1 ${isSelected ? config.color : 'text-gray-900'}`}>
        {config.label}
      </div>
      
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Keywords:</span>
          <span className="font-medium text-gray-700">{formatNumber(count)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Volume:</span>
          <span className="font-medium text-gray-700">{formatCompact(volume)}</span>
        </div>
      </div>
    </button>
  );
}

export default function IntentAnalysisPage() {
  // State
  const [selectedIntent, setSelectedIntent] = useState<SearchIntent | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Fetch overview data for intent distribution
  const { data: overviewData, loading: overviewLoading, error: overviewError } = useKeywordOverview(PROJECT_ID);

  // Use keywords hook with built-in state management
  const keywordHook = useKeywords(PROJECT_ID);

  // Sync selected intent with hook filters
  const handleIntentClick = useCallback((intent: SearchIntent) => {
    const newIntent = selectedIntent === intent ? null : intent;
    setSelectedIntent(newIntent);
    keywordHook.updateFilter('intent', newIntent || 'all');
  }, [selectedIntent, keywordHook]);

  // Clear intent filter
  const clearIntentFilter = useCallback(() => {
    setSelectedIntent(null);
    keywordHook.updateFilter('intent', 'all');
  }, [keywordHook]);

  // Calculate intent stats from overview data
  const intentStats = useMemo(() => {
    if (!overviewData?.charts?.intentDistribution) return null;
    
    const stats: Record<SearchIntent, { count: number; volume: number; percentage: number }> = {} as any;
    
    for (const item of overviewData.charts.intentDistribution) {
      stats[item.intent] = {
        count: item.count,
        volume: item.searchVolume,
        percentage: item.percentage,
      };
    }
    
    return stats;
  }, [overviewData]);

  // Loading state
  if (overviewLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading intent analysis...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (overviewError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border border-red-200 p-6 max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-3">
            <AlertCircle className="w-6 h-6" />
            <span className="font-medium">Error loading data</span>
          </div>
          <p className="text-gray-600 text-sm">{overviewError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/keywords"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Search Intent Analysis</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Understand user intent behind your target keywords
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Intent Guide</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Intent Guide (collapsible) */}
        {showLegend && (
          <div className="mb-6">
            <IntentLegend />
          </div>
        )}

        {/* Summary Cards */}
        {intentStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {(['transactional', 'commercial', 'informational', 'navigational'] as SearchIntent[]).map(intent => (
              <SummaryCard
                key={intent}
                intent={intent}
                count={intentStats[intent]?.count || 0}
                volume={intentStats[intent]?.volume || 0}
                percentage={intentStats[intent]?.percentage || 0}
                isSelected={selectedIntent === intent}
                onClick={() => handleIntentClick(intent)}
              />
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Intent Distribution Chart */}
          <div className="lg:col-span-2">
            {overviewData?.charts?.intentDistribution && (
              <IntentDistributionChart
                data={overviewData.charts.intentDistribution}
                onIntentClick={handleIntentClick}
                selectedIntent={selectedIntent}
                showMetrics={true}
              />
            )}
          </div>

          {/* Quick Insights Panel */}
          <div className="space-y-4">
            {/* Top Intent */}
            {intentStats && overviewData?.charts?.intentDistribution && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Quick Insights
                </h3>
                
                <div className="space-y-4">
                  {/* Dominant intent */}
                  {(() => {
                    const sorted = [...overviewData.charts.intentDistribution].sort((a, b) => b.count - a.count);
                    const top = sorted[0];
                    if (!top) return null;
                    const config = SEARCH_INTENT_CONFIG[top.intent];
                    
                    return (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Dominant Intent</div>
                        <div className="flex items-center gap-2">
                          <IntentBadge intent={top.intent} size="sm" showTooltip={false} />
                          <span className="text-sm text-gray-600">
                            ({top.percentage.toFixed(1)}% of keywords)
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Transactional focus */}
                  {intentStats.transactional && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Conversion Potential</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {formatNumber(intentStats.transactional.count)} transactional keywords
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          {formatCompact(intentStats.transactional.volume)} vol
                        </span>
                      </div>
                      <IntentDistributionBar 
                        data={overviewData.charts.intentDistribution}
                        height={6}
                        className="mt-2"
                      />
                    </div>
                  )}

                  {/* Recommendation */}
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="text-xs font-medium text-blue-800 mb-1">💡 Recommendation</div>
                    <p className="text-xs text-blue-700">
                      {intentStats.informational?.percentage > 50 
                        ? 'Focus on educational content to capture informational searches, then guide users toward transactional pages.'
                        : intentStats.transactional?.percentage > 30
                          ? 'Strong transactional intent detected. Optimize landing pages for conversions and ensure clear CTAs.'
                          : 'Balanced intent mix. Create content funnels from informational → commercial → transactional.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Intent Info */}
            {selectedIntent && (
              <div className={`rounded-xl border-2 p-4 ${SEARCH_INTENT_CONFIG[selectedIntent].bgColor}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <IntentBadge intent={selectedIntent} showTooltip={false} />
                    <span className="text-sm font-medium">Selected</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearIntentFilter}
                    className="p-1 hover:bg-white/50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">
                  {SEARCH_INTENT_CONFIG[selectedIntent].description}
                </p>
                
                <div className="text-sm">
                  <span className="text-gray-500">Filtering: </span>
                  <span className="font-medium text-gray-900">
                    {formatNumber(keywordHook.total)} keywords
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filtered Keyword Table */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">
                  {selectedIntent ? (
                    <>
                      <span className={SEARCH_INTENT_CONFIG[selectedIntent].color}>
                        {SEARCH_INTENT_CONFIG[selectedIntent].label}
                      </span>
                      {' '}Keywords
                    </>
                  ) : (
                    'All Keywords'
                  )}
                </h3>
                <span className="px-2 py-0.5 bg-gray-100 rounded text-sm text-gray-600">
                  {formatNumber(keywordHook.total)} results
                </span>
              </div>
              
              {selectedIntent && (
                <button
                  type="button"
                  onClick={clearIntentFilter}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Clear filter
                </button>
              )}
            </div>
          </div>

          <KeywordTable
            keywords={keywordHook.keywords}
            loading={keywordHook.loading}
            sortField={keywordHook.sortField}
            sortDirection={keywordHook.sortDirection}
            onSort={keywordHook.updateSort}
            page={keywordHook.page}
            pageSize={keywordHook.pageSize}
            total={keywordHook.total}
            totalPages={keywordHook.totalPages}
            onPageChange={keywordHook.goToPage}
            onPageSizeChange={keywordHook.updatePageSize}
          />
        </div>
      </div>
    </div>
  );
}
