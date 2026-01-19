/**
 * KPI Overview Component
 * 
 * v0.7 - Top section displaying key metrics for managers
 */

'use client';

import { TrendingUp, TrendingDown, Minus, Users, Target, FileText, Activity } from 'lucide-react';
import type { KPIOverviewData } from '@/types/dashboard';
import { formatNumber, formatPercent, getScoreColor } from '@/lib/utils';

interface KPIOverviewProps {
  data: KPIOverviewData;
}

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
}

function KPICard({ title, value, change, changeLabel, icon, trend, subtitle }: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {getTrendIcon()}
              <span className={`text-sm font-medium ${getTrendColor()}`}>
                {formatPercent(change)}
              </span>
              {changeLabel && (
                <span className="text-sm text-gray-400 ml-1">{changeLabel}</span>
              )}
            </div>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-2">{subtitle}</p>
          )}
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

interface StatPillProps {
  label: string;
  value: number;
  change?: number;
  positive?: boolean;
}

function StatPill({ label, value, change, positive = true }: StatPillProps) {
  const changeColor = change !== undefined
    ? (change > 0 ? (positive ? 'text-green-600' : 'text-red-600') : (positive ? 'text-red-600' : 'text-green-600'))
    : '';

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-600">{label}:</span>
      <span className="font-semibold text-gray-900">{value}</span>
      {change !== undefined && (
        <span className={`text-sm ${changeColor}`}>
          ({change > 0 ? '+' : ''}{change})
        </span>
      )}
    </div>
  );
}

export function KPIOverview({ data }: KPIOverviewProps) {
  return (
    <div className="space-y-4">
      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Organic Traffic */}
        <KPICard
          title="Organic Traffic"
          value={formatNumber(data.organicTraffic.current)}
          change={data.organicTraffic.changePercent}
          changeLabel={data.organicTraffic.period}
          icon={<Users className="w-6 h-6 text-blue-600" />}
          trend={data.organicTraffic.trend}
        />

        {/* Keyword Coverage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Keyword Coverage</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatNumber(data.keywordCoverage.totalTracked)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <StatPill
              label="Top 3"
              value={data.keywordCoverage.top3}
              change={data.keywordCoverage.top3Change}
            />
            <StatPill
              label="Top 10"
              value={data.keywordCoverage.top10}
              change={data.keywordCoverage.top10Change}
            />
          </div>
        </div>

        {/* Content Performance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Content Performance</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.contentPerformance.totalPages}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-600">High performing:</span>
              <span className="font-semibold text-gray-900">{data.contentPerformance.highPerforming}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-gray-600">Needs work:</span>
              <span className="font-semibold text-gray-900">{data.contentPerformance.needsOptimization}</span>
            </div>
          </div>
        </div>

        {/* SEO Health Score */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">SEO Health Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(data.healthScore)}`}>
                {data.healthScore}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Activity className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          {/* Health Score Bar */}
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  data.healthScore >= 80 ? 'bg-green-500' :
                  data.healthScore >= 60 ? 'bg-yellow-500' :
                  data.healthScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${data.healthScore}%` }}
              />
            </div>
            <div className="flex items-center gap-1 mt-2">
              {data.healthScoreChange < 0 ? (
                <TrendingDown className="w-4 h-4 text-red-500" />
              ) : data.healthScoreChange > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <Minus className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${data.healthScoreChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.healthScoreChange > 0 ? '+' : ''}{data.healthScoreChange} pts
              </span>
              <span className="text-sm text-gray-400">vs last period</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
