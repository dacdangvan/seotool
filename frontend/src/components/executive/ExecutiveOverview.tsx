/**
 * Executive Overview Component v1.8
 * 
 * Top-level KPIs for board presentation.
 * Shows investment, ROI, trends, and confidence indicators.
 */

'use client';

import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Shield } from 'lucide-react';
import type { ExecutiveOverviewData } from '@/types/executive';

interface ExecutiveOverviewProps {
  data: ExecutiveOverviewData;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
}

function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatROI(value: number): string {
  return `${value.toFixed(1)}x`;
}

function getTrendIcon(value: number) {
  if (value > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function getTrendColor(value: number): string {
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-500';
}

function getConfidenceColor(level: string): string {
  switch (level) {
    case 'high': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'moderate': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getConfidenceLabel(level: string): string {
  switch (level) {
    case 'high': return 'High Confidence';
    case 'moderate': return 'Moderate Confidence';
    case 'low': return 'Low Confidence';
    default: return 'Unknown';
  }
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  subtitle?: string;
  benchmark?: { value: string; label: string };
}

function MetricCard({ title, value, change, changeLabel, icon, subtitle, benchmark }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-slate-50 rounded-xl">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${
            change > 0 ? 'bg-emerald-50 text-emerald-700' : 
            change < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
          }`}>
            {getTrendIcon(change)}
            <span>{formatPercent(change)}</span>
          </div>
        )}
      </div>
      
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      
      {subtitle && (
        <p className="text-sm text-gray-500">{subtitle}</p>
      )}
      
      {changeLabel && (
        <p className="text-xs text-gray-400 mt-2">{changeLabel}</p>
      )}
      
      {benchmark && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{benchmark.label}</span>
            <span className="font-medium text-gray-700">{benchmark.value}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface TrendSectionProps {
  title: string;
  trends: { label: string; value: number }[];
}

function TrendSection({ title, trends }: TrendSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {trends.map((trend, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{trend.label}</span>
            <div className={`flex items-center gap-1.5 font-semibold ${getTrendColor(trend.value)}`}>
              {trend.value > 0 ? <ArrowUpRight className="w-4 h-4" /> : 
               trend.value < 0 ? <ArrowDownRight className="w-4 h-4" /> : null}
              {formatPercent(trend.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function ExecutiveOverview({ data }: ExecutiveOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Executive Overview</h2>
          <p className="text-sm text-gray-500">Portfolio-level performance summary</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getConfidenceColor(data.confidenceLevel)}`}>
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">{getConfidenceLabel(data.confidenceLevel)}</span>
          <span className="text-sm font-bold">{data.confidenceScore}%</span>
        </div>
      </div>
      
      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total SEO Investment"
          value={formatCurrency(data.totalInvestment.current)}
          change={data.totalInvestment.changePercent}
          icon={<DollarSign className="w-6 h-6 text-slate-600" />}
          subtitle={data.totalInvestment.unit}
          changeLabel="vs. previous period"
        />
        
        <MetricCard
          title="Portfolio ROI"
          value={formatROI(data.portfolioROI.current)}
          change={data.portfolioROI.changePercent}
          icon={<BarChart3 className="w-6 h-6 text-slate-600" />}
          benchmark={data.portfolioROI.industryBenchmark ? {
            value: formatROI(data.portfolioROI.industryBenchmark),
            label: 'Industry Benchmark'
          } : undefined}
        />
        
        {/* YoY Trends */}
        <TrendSection
          title="Year-over-Year"
          trends={[
            { label: 'Traffic Growth', value: data.yoyTrend.trafficGrowth },
            { label: 'Revenue Contribution', value: data.yoyTrend.revenueContribution },
            { label: 'Cost Efficiency', value: data.yoyTrend.costEfficiency },
          ]}
        />
        
        {/* QoQ Trends */}
        <TrendSection
          title="Quarter-over-Quarter"
          trends={[
            { label: 'Traffic Growth', value: data.qoqTrend.trafficGrowth },
            { label: 'Revenue Contribution', value: data.qoqTrend.revenueContribution },
            { label: 'Cost Efficiency', value: data.qoqTrend.costEfficiency },
          ]}
        />
      </div>
      
      {/* Confidence Factors */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Confidence Factors</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.confidenceFactors.map((factor, idx) => (
            <span key={idx} className="px-3 py-1 bg-white rounded-full text-sm text-slate-600 border border-slate-200">
              {factor}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ExecutiveOverview;
