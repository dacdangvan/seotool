'use client';

/**
 * CWVKpiCards Component
 * 
 * KPI cards showing CWV health overview
 * Good / Needs Improvement / Poor URL counts
 */

import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  Smartphone,
  Monitor,
  Gauge,
  Clock,
  LayoutGrid,
  Zap
} from 'lucide-react';
import { CWVStatus, CWV_STATUS_COLORS } from '@/types/cwv.types';

export interface CWVKpiData {
  totalUrls: number;
  goodUrls: number;
  needsImprovementUrls: number;
  poorUrls: number;
  avgPerformanceScore: number;
  avgLcp: number;
  avgCls: number;
  avgInp: number | null;
  passRate: number; // % of URLs passing CWV assessment
}

interface CWVKpiCardsProps {
  data: CWVKpiData;
  device: 'mobile' | 'desktop';
  onDeviceChange: (device: 'mobile' | 'desktop') => void;
  onStatusClick?: (status: CWVStatus) => void;
}

// Main status card
interface StatusCardProps {
  status: CWVStatus;
  count: number;
  percentage: number;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function StatusCard({ status, count, percentage, label, icon, onClick }: StatusCardProps) {
  const colors = CWV_STATUS_COLORS[status];
  
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 p-5 rounded-xl border-2 transition-all duration-200
        ${colors.bg} ${colors.border}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-white/50 ${colors.text}`}>
          {icon}
        </div>
        <span className={`text-sm font-medium ${colors.text}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className={`text-3xl font-bold ${colors.text} mb-1`}>
        {count}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
      {onClick && (
        <div className="text-xs text-gray-400 mt-2">Click to view →</div>
      )}
    </button>
  );
}

// Metric summary card
interface MetricCardProps {
  label: string;
  value: string;
  status: CWVStatus;
  icon: React.ReactNode;
  threshold: string;
}

function MetricCard({ label, value, status, icon, threshold }: MetricCardProps) {
  const colors = CWV_STATUS_COLORS[status];
  
  return (
    <div className={`p-4 rounded-xl bg-white border border-gray-200`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-gray-400">{icon}</div>
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${colors.text}`}>{value}</span>
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
      </div>
      <div className="text-xs text-gray-400 mt-1">Good: {threshold}</div>
    </div>
  );
}

export function CWVKpiCards({ data, device, onDeviceChange, onStatusClick }: CWVKpiCardsProps) {
  const goodPercentage = data.totalUrls > 0 ? (data.goodUrls / data.totalUrls) * 100 : 0;
  const needsImprovementPercentage = data.totalUrls > 0 ? (data.needsImprovementUrls / data.totalUrls) * 100 : 0;
  const poorPercentage = data.totalUrls > 0 ? (data.poorUrls / data.totalUrls) * 100 : 0;

  // Determine overall status based on averages
  const getLcpStatus = (lcp: number): CWVStatus => {
    if (lcp <= 2500) return 'good';
    if (lcp <= 4000) return 'needs_improvement';
    return 'poor';
  };

  const getClsStatus = (cls: number): CWVStatus => {
    if (cls <= 0.1) return 'good';
    if (cls <= 0.25) return 'needs_improvement';
    return 'poor';
  };

  const getInpStatus = (inp: number | null): CWVStatus => {
    if (inp === null) return 'good';
    if (inp <= 200) return 'good';
    if (inp <= 500) return 'needs_improvement';
    return 'poor';
  };

  const getScoreStatus = (score: number): CWVStatus => {
    if (score >= 90) return 'good';
    if (score >= 50) return 'needs_improvement';
    return 'poor';
  };

  return (
    <div className="space-y-6">
      {/* Header with device toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Core Web Vitals Overview</h2>
          <p className="text-sm text-gray-500">
            Performance metrics for {data.totalUrls} measured URLs
          </p>
        </div>
        
        {/* Device toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onDeviceChange('mobile')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${device === 'mobile' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Smartphone size={16} />
            Mobile
          </button>
          <button
            onClick={() => onDeviceChange('desktop')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${device === 'desktop' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}
            `}
          >
            <Monitor size={16} />
            Desktop
          </button>
        </div>
      </div>

      {/* Pass rate banner */}
      <div className={`
        p-4 rounded-xl flex items-center justify-between
        ${data.passRate >= 75 ? 'bg-green-50 border border-green-200' : 
          data.passRate >= 50 ? 'bg-amber-50 border border-amber-200' : 
          'bg-red-50 border border-red-200'}
      `}>
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className={
            data.passRate >= 75 ? 'text-green-600' : 
            data.passRate >= 50 ? 'text-amber-600' : 'text-red-600'
          } />
          <div>
            <span className="font-semibold text-gray-800">
              {data.passRate.toFixed(0)}% of URLs pass Core Web Vitals
            </span>
            <p className="text-sm text-gray-500">
              {data.passRate >= 75 ? 'Great performance!' : 
               data.passRate >= 50 ? 'Room for improvement' : 
               'Needs attention'}
            </p>
          </div>
        </div>
        <div className={`
          text-3xl font-bold
          ${data.passRate >= 75 ? 'text-green-600' : 
            data.passRate >= 50 ? 'text-amber-600' : 'text-red-600'}
        `}>
          {data.avgPerformanceScore}
          <span className="text-sm font-normal text-gray-500">/100</span>
        </div>
      </div>

      {/* Status cards row */}
      <div className="flex gap-4">
        <StatusCard
          status="good"
          count={data.goodUrls}
          percentage={goodPercentage}
          label="Good URLs"
          icon={<CheckCircle2 size={24} />}
          onClick={() => onStatusClick?.('good')}
        />
        <StatusCard
          status="needs_improvement"
          count={data.needsImprovementUrls}
          percentage={needsImprovementPercentage}
          label="Needs Improvement"
          icon={<AlertTriangle size={24} />}
          onClick={() => onStatusClick?.('needs_improvement')}
        />
        <StatusCard
          status="poor"
          count={data.poorUrls}
          percentage={poorPercentage}
          label="Poor URLs"
          icon={<XCircle size={24} />}
          onClick={() => onStatusClick?.('poor')}
        />
      </div>

      {/* Average metrics row */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Avg. Performance"
          value={`${data.avgPerformanceScore}`}
          status={getScoreStatus(data.avgPerformanceScore)}
          icon={<Gauge size={18} />}
          threshold="≥90"
        />
        <MetricCard
          label="Avg. LCP"
          value={data.avgLcp >= 1000 ? `${(data.avgLcp / 1000).toFixed(1)}s` : `${data.avgLcp}ms`}
          status={getLcpStatus(data.avgLcp)}
          icon={<Clock size={18} />}
          threshold="≤2.5s"
        />
        <MetricCard
          label="Avg. CLS"
          value={data.avgCls.toFixed(3)}
          status={getClsStatus(data.avgCls)}
          icon={<LayoutGrid size={18} />}
          threshold="≤0.1"
        />
        <MetricCard
          label="Avg. INP"
          value={data.avgInp !== null ? `${data.avgInp}ms` : 'N/A'}
          status={getInpStatus(data.avgInp)}
          icon={<Zap size={18} />}
          threshold="≤200ms"
        />
      </div>
    </div>
  );
}

export default CWVKpiCards;
