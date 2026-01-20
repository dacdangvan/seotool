'use client';

/**
 * CWVDistributionChart Component
 * 
 * Shows distribution of URLs across Good/Needs Improvement/Poor
 * for each CWV metric (LCP, INP, CLS)
 */

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Clock, LayoutGrid, Zap, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { CWVStatus, CWV_STATUS_COLORS, CWV_THRESHOLDS } from '@/types/cwv.types';

export interface MetricDistribution {
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface CWVDistributionData {
  lcp: MetricDistribution;
  inp: MetricDistribution;
  cls: MetricDistribution;
}

export interface UrlSample {
  url: string;
  value: number;
  status: CWVStatus;
}

export interface CWVUrlSamples {
  lcp: {
    worst: UrlSample[];
  };
  inp: {
    worst: UrlSample[];
  };
  cls: {
    worst: UrlSample[];
  };
}

interface CWVDistributionChartProps {
  data: CWVDistributionData;
  urlSamples?: CWVUrlSamples;
  onMetricClick?: (metric: 'lcp' | 'inp' | 'cls', status: CWVStatus) => void;
}

const METRIC_INFO = {
  lcp: {
    name: 'Largest Contentful Paint (LCP)',
    description: 'Measures loading performance. LCP should occur within 2.5 seconds.',
    icon: Clock,
    unit: 's',
    thresholds: {
      good: '≤ 2.5s',
      needsImprovement: '2.5s - 4s',
      poor: '> 4s'
    }
  },
  inp: {
    name: 'Interaction to Next Paint (INP)',
    description: 'Measures interactivity. INP should be 200 milliseconds or less.',
    icon: Zap,
    unit: 'ms',
    thresholds: {
      good: '≤ 200ms',
      needsImprovement: '200ms - 500ms',
      poor: '> 500ms'
    }
  },
  cls: {
    name: 'Cumulative Layout Shift (CLS)',
    description: 'Measures visual stability. CLS should be 0.1 or less.',
    icon: LayoutGrid,
    unit: '',
    thresholds: {
      good: '≤ 0.1',
      needsImprovement: '0.1 - 0.25',
      poor: '> 0.25'
    }
  }
};

// Stacked bar chart for all metrics
function OverviewChart({ 
  data, 
  onMetricClick 
}: { 
  data: CWVDistributionData; 
  onMetricClick?: (metric: 'lcp' | 'inp' | 'cls', status: CWVStatus) => void;
}) {
  const chartData = [
    {
      name: 'LCP',
      metric: 'lcp' as const,
      good: data.lcp.good,
      needsImprovement: data.lcp.needsImprovement,
      poor: data.lcp.poor,
    },
    {
      name: 'INP',
      metric: 'inp' as const,
      good: data.inp.good,
      needsImprovement: data.inp.needsImprovement,
      poor: data.inp.poor,
    },
    {
      name: 'CLS',
      metric: 'cls' as const,
      good: data.cls.good,
      needsImprovement: data.cls.needsImprovement,
      poor: data.cls.poor,
    },
  ];

  const handleBarClick = (entry: { name?: string }, status: CWVStatus) => {
    if (!entry.name) return;
    const metricMap: Record<string, 'lcp' | 'inp' | 'cls'> = {
      'LCP': 'lcp',
      'INP': 'inp',
      'CLS': 'cls'
    };
    const metric = metricMap[entry.name];
    if (metric) {
      onMetricClick?.(metric, status);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        URL Distribution by Metric
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={40} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload) return null;
              const total = payload.reduce((sum, entry) => sum + (entry.value as number), 0);
              return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                  <p className="font-semibold text-gray-800 mb-2">{label}</p>
                  {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                      <span style={{ color: entry.color }}>{entry.name}:</span>
                      <span className="font-medium">
                        {entry.value} ({((entry.value as number) / total * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
          />
          <Bar
            dataKey="good"
            name="Good"
            stackId="a"
            fill="#22c55e"
            cursor="pointer"
            onClick={(data) => handleBarClick(data, 'good')}
          />
          <Bar
            dataKey="needsImprovement"
            name="Needs Improvement"
            stackId="a"
            fill="#f59e0b"
            cursor="pointer"
            onClick={(data) => handleBarClick(data, 'needs_improvement')}
          />
          <Bar
            dataKey="poor"
            name="Poor"
            stackId="a"
            fill="#ef4444"
            cursor="pointer"
            onClick={(data) => handleBarClick(data, 'poor')}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Individual metric donut chart
function MetricDonut({ 
  metric, 
  data,
  onStatusClick
}: { 
  metric: 'lcp' | 'inp' | 'cls';
  data: MetricDistribution;
  onStatusClick?: (status: CWVStatus) => void;
}) {
  const info = METRIC_INFO[metric];
  const Icon = info.icon;
  const total = data.good + data.needsImprovement + data.poor;
  
  const chartData = [
    { name: 'Good', value: data.good, status: 'good' as CWVStatus, fill: '#22c55e' },
    { name: 'Needs Improvement', value: data.needsImprovement, status: 'needs_improvement' as CWVStatus, fill: '#f59e0b' },
    { name: 'Poor', value: data.poor, status: 'poor' as CWVStatus, fill: '#ef4444' },
  ].filter(d => d.value > 0);

  const passRate = total > 0 ? (data.good / total * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={20} className="text-gray-500" />
        <h4 className="font-semibold text-gray-800">{metric.toUpperCase()}</h4>
        <div className="group relative">
          <Info size={14} className="text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <p className="font-medium mb-1">{info.name}</p>
            <p className="text-gray-300">{info.description}</p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Good: {info.thresholds.good}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Needs Improvement: {info.thresholds.needsImprovement}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Poor: {info.thresholds.poor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              cursor="pointer"
              onClick={(entry) => onStatusClick?.(entry.status)}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const entry = payload[0].payload;
                return (
                  <div className="bg-white p-2 rounded-lg shadow-lg border border-gray-200 text-sm">
                    <span className="font-medium">{entry.name}:</span>{' '}
                    <span>{entry.value} URLs ({(entry.value / total * 100).toFixed(0)}%)</span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className={`text-2xl font-bold ${
            passRate >= 75 ? 'text-green-600' : 
            passRate >= 50 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {passRate.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500">Good</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <button 
          onClick={() => onStatusClick?.('good')}
          className="flex items-center gap-1 hover:underline"
        >
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>{data.good}</span>
        </button>
        <button 
          onClick={() => onStatusClick?.('needs_improvement')}
          className="flex items-center gap-1 hover:underline"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>{data.needsImprovement}</span>
        </button>
        <button 
          onClick={() => onStatusClick?.('poor')}
          className="flex items-center gap-1 hover:underline"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>{data.poor}</span>
        </button>
      </div>
    </div>
  );
}

// Worst URLs list
function WorstUrlsList({ 
  metric, 
  samples,
  onUrlClick
}: { 
  metric: 'lcp' | 'inp' | 'cls';
  samples: UrlSample[];
  onUrlClick?: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const info = METRIC_INFO[metric];
  
  if (samples.length === 0) return null;

  const displaySamples = expanded ? samples : samples.slice(0, 3);

  const formatValue = (value: number): string => {
    if (metric === 'lcp') {
      return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
    } else if (metric === 'cls') {
      return value.toFixed(3);
    }
    return `${value}ms`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h4 className="font-semibold text-gray-800 mb-3">
        Worst {metric.toUpperCase()} URLs
      </h4>
      <div className="space-y-2">
        {displaySamples.map((sample, index) => (
          <button
            key={sample.url}
            onClick={() => onUrlClick?.(sample.url)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-gray-400 text-sm w-6">{index + 1}.</span>
            <span className={`
              px-2 py-0.5 rounded text-xs font-medium
              ${sample.status === 'poor' ? 'bg-red-100 text-red-700' : 
                sample.status === 'needs_improvement' ? 'bg-amber-100 text-amber-700' : 
                'bg-green-100 text-green-700'}
            `}>
              {formatValue(sample.value)}
            </span>
            <span className="text-sm text-gray-600 truncate flex-1">
              {sample.url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
            </span>
          </button>
        ))}
      </div>
      
      {samples.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          {expanded ? (
            <>
              <ChevronUp size={16} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              Show {samples.length - 3} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function CWVDistributionChart({ 
  data, 
  urlSamples,
  onMetricClick 
}: CWVDistributionChartProps) {
  return (
    <div className="space-y-6">
      {/* Overview bar chart */}
      <OverviewChart data={data} onMetricClick={onMetricClick} />

      {/* Individual metric donuts */}
      <div className="grid grid-cols-3 gap-4">
        <MetricDonut 
          metric="lcp" 
          data={data.lcp} 
          onStatusClick={(status) => onMetricClick?.('lcp', status)}
        />
        <MetricDonut 
          metric="inp" 
          data={data.inp} 
          onStatusClick={(status) => onMetricClick?.('inp', status)}
        />
        <MetricDonut 
          metric="cls" 
          data={data.cls} 
          onStatusClick={(status) => onMetricClick?.('cls', status)}
        />
      </div>

      {/* Worst URLs lists */}
      {urlSamples && (
        <div className="grid grid-cols-3 gap-4">
          <WorstUrlsList 
            metric="lcp" 
            samples={urlSamples.lcp.worst}
            onUrlClick={(url) => console.log('Navigate to:', url)}
          />
          <WorstUrlsList 
            metric="inp" 
            samples={urlSamples.inp.worst}
            onUrlClick={(url) => console.log('Navigate to:', url)}
          />
          <WorstUrlsList 
            metric="cls" 
            samples={urlSamples.cls.worst}
            onUrlClick={(url) => console.log('Navigate to:', url)}
          />
        </div>
      )}
    </div>
  );
}

export default CWVDistributionChart;
