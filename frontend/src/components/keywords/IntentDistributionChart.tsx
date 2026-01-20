'use client';

/**
 * Intent Distribution Chart Component
 * 
 * Displays search intent distribution with:
 * - Pie/donut chart visualization
 * - Interactive legend with click-to-filter
 * - Detailed metrics per intent
 * - Trend indicators (optional)
 */

import React, { useState, useMemo } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend,
} from 'recharts';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent, IntentDistribution } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG } from '@/types/keyword.types';
import { IntentBadge } from './IntentBadge';
import { 
  ShoppingCart, 
  Search, 
  BookOpen, 
  Navigation,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  BarChart3,
  PieChartIcon,
} from 'lucide-react';

// Chart colors for each intent
const INTENT_CHART_COLORS: Record<SearchIntent, string> = {
  transactional: '#16a34a',  // green-600
  commercial: '#2563eb',      // blue-600
  informational: '#9333ea',   // purple-600
  navigational: '#6b7280',    // gray-500
};

// Intent icons mapping
const INTENT_ICONS: Record<SearchIntent, React.ElementType> = {
  transactional: ShoppingCart,
  commercial: Search,
  informational: BookOpen,
  navigational: Navigation,
};

interface IntentDistributionChartProps {
  data: IntentDistribution[];
  loading?: boolean;
  onIntentClick?: (intent: SearchIntent) => void;
  selectedIntent?: SearchIntent | null;
  showMetrics?: boolean;
  className?: string;
}

interface ChartDataItem {
  intent: SearchIntent;
  label: string;
  count: number;
  percentage: number;
  searchVolume: number;
  color: string;
  [key: string]: string | number; // Index signature for Recharts
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload as ChartDataItem;
  const config = SEARCH_INTENT_CONFIG[data.intent];
  const Icon = INTENT_ICONS[data.intent];

  return (
    <div className="bg-white border border-gray-200 shadow-xl rounded-xl p-4 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
        <span className="font-semibold text-gray-900">{config.label}</span>
      </div>
      
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Keywords:</span>
          <span className="font-medium text-gray-900">{formatNumber(data.count)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Percentage:</span>
          <span className="font-medium text-gray-900">{data.percentage.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Search Volume:</span>
          <span className="font-medium text-gray-900">{formatCompact(data.searchVolume)}</span>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-center h-64">
        <div className="w-48 h-48 bg-gray-200 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded-full" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Metric card for each intent
function IntentMetricCard({ 
  data, 
  isSelected,
  onClick,
}: { 
  data: ChartDataItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = SEARCH_INTENT_CONFIG[data.intent];
  const Icon = INTENT_ICONS[data.intent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
        isSelected 
          ? 'border-2 shadow-md' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
        isSelected && data.intent === 'transactional' && 'border-green-500 bg-green-50',
        isSelected && data.intent === 'commercial' && 'border-blue-500 bg-blue-50',
        isSelected && data.intent === 'informational' && 'border-purple-500 bg-purple-50',
        isSelected && data.intent === 'navigational' && 'border-gray-500 bg-gray-50',
      )}
    >
      <div 
        className={cn('p-2 rounded-lg', config.bgColor)}
        style={{ backgroundColor: isSelected ? data.color + '20' : undefined }}
      >
        <Icon 
          className="w-5 h-5" 
          style={{ color: data.color }}
        />
      </div>
      
      <div className="flex-1 text-left">
        <div className="font-medium text-gray-900">{config.label}</div>
        <div className="text-xs text-gray-500">{formatNumber(data.count)} keywords</div>
      </div>
      
      <div className="text-right">
        <div className="text-lg font-bold" style={{ color: data.color }}>
          {data.percentage.toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500">
          {formatCompact(data.searchVolume)} vol
        </div>
      </div>
    </button>
  );
}

export function IntentDistributionChart({
  data,
  loading = false,
  onIntentClick,
  selectedIntent,
  showMetrics = true,
  className,
}: IntentDistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'pie' | 'donut'>('donut');

  // Prepare chart data with colors
  const chartData: ChartDataItem[] = useMemo(() => {
    return data.map(item => ({
      ...item,
      label: SEARCH_INTENT_CONFIG[item.intent].label,
      color: INTENT_CHART_COLORS[item.intent],
    }));
  }, [data]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      keywords: data.reduce((sum, d) => sum + d.count, 0),
      volume: data.reduce((sum, d) => sum + d.searchVolume, 0),
    };
  }, [data]);

  // Sort by priority for consistent display
  const sortedData = useMemo(() => {
    return [...chartData].sort((a, b) => 
      SEARCH_INTENT_CONFIG[a.intent].priority - SEARCH_INTENT_CONFIG[b.intent].priority
    );
  }, [chartData]);

  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-6', className)}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-6', className)}>
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No intent data available</p>
        </div>
      </div>
    );
  }

  const handlePieClick = (entry: ChartDataItem, index: number) => {
    if (onIntentClick) {
      onIntentClick(entry.intent);
    }
  };

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">Intent Distribution</h3>
          <p className="text-sm text-gray-500">
            {formatNumber(totals.keywords)} keywords • {formatCompact(totals.volume)} total volume
          </p>
        </div>
        
        {/* Chart type toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setChartType('donut')}
            className={cn(
              'p-1.5 rounded transition-colors',
              chartType === 'donut' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            )}
            title="Donut chart"
          >
            <PieChartIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setChartType('pie')}
            className={cn(
              'p-1.5 rounded transition-colors',
              chartType === 'pie' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            )}
            title="Pie chart"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className={cn(
          'grid gap-6',
          showMetrics ? 'lg:grid-cols-2' : ''
        )}>
          {/* Chart */}
          <div className="h-72 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={chartType === 'donut' ? 60 : 0}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(entry, index) => handlePieClick(entry, index)}
                  style={{ cursor: onIntentClick ? 'pointer' : 'default' }}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      opacity={
                        selectedIntent 
                          ? entry.intent === selectedIntent ? 1 : 0.3
                          : activeIndex !== null 
                            ? activeIndex === index ? 1 : 0.6
                            : 1
                      }
                      stroke={entry.intent === selectedIntent ? entry.color : 'white'}
                      strokeWidth={entry.intent === selectedIntent ? 3 : 2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label for donut */}
            {chartType === 'donut' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCompact(totals.keywords)}
                  </div>
                  <div className="text-xs text-gray-500">keywords</div>
                </div>
              </div>
            )}
          </div>

          {/* Metrics cards */}
          {showMetrics && (
            <div className="space-y-2">
              {sortedData.map((item) => (
                <IntentMetricCard
                  key={item.intent}
                  data={item}
                  isSelected={selectedIntent === item.intent}
                  onClick={() => onIntentClick?.(item.intent)}
                />
              ))}
              
              {selectedIntent && (
                <button
                  type="button"
                  onClick={() => onIntentClick?.(selectedIntent)}
                  className="w-full flex items-center justify-center gap-2 p-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Intent Distribution Bar
 * Horizontal stacked bar showing intent breakdown
 */
export function IntentDistributionBar({ 
  data,
  height = 8,
  showLabels = false,
  className,
}: { 
  data: IntentDistribution[];
  height?: number;
  showLabels?: boolean;
  className?: string;
}) {
  const sortedData = [...data].sort((a, b) => 
    SEARCH_INTENT_CONFIG[a.intent].priority - SEARCH_INTENT_CONFIG[b.intent].priority
  );

  return (
    <div className={className}>
      {/* Bar */}
      <div 
        className="w-full rounded-full overflow-hidden flex"
        style={{ height }}
      >
        {sortedData.map((item, i) => (
          <div
            key={item.intent}
            className="transition-all"
            style={{ 
              width: `${item.percentage}%`,
              backgroundColor: INTENT_CHART_COLORS[item.intent],
            }}
            title={`${SEARCH_INTENT_CONFIG[item.intent].label}: ${item.percentage.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex items-center justify-center gap-4 mt-2">
          {sortedData.map((item) => (
            <div key={item.intent} className="flex items-center gap-1.5">
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: INTENT_CHART_COLORS[item.intent] }}
              />
              <span className="text-xs text-gray-600">
                {SEARCH_INTENT_CONFIG[item.intent].label}
              </span>
              <span className="text-xs text-gray-400">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IntentDistributionChart;
