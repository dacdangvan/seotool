'use client';

/**
 * CWVDetailPanel Component
 * 
 * Slide-out panel showing full CWV details for a page
 */

import React from 'react';
import { 
  X, 
  Smartphone, 
  Monitor, 
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Gauge,
  LayoutGrid,
  Zap,
  Server
} from 'lucide-react';
import { PageCWV, CWV_THRESHOLDS, CWV_STATUS_COLORS, CWVStatus } from '@/types/cwv.types';
import { CWVBadge, CWVScoreBadge } from './CWVBadge';
import { CWVTooltip } from './CWVTooltip';

interface CWVDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  mobileData?: PageCWV | null;
  desktopData?: PageCWV | null;
}

// Metric row component
interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb';
  mobileValue?: { value: number; status: CWVStatus; displayValue: string } | null;
  desktopValue?: { value: number; status: CWVStatus; displayValue: string } | null;
}

function MetricRow({ icon, label, metric, mobileValue, desktopValue }: MetricRowProps) {
  const threshold = CWV_THRESHOLDS[metric];

  const renderValue = (data: { value: number; status: CWVStatus; displayValue: string } | null | undefined) => {
    if (!data) {
      return <span className="text-gray-400">N/A</span>;
    }
    return (
      <CWVBadge 
        value={data.displayValue} 
        status={data.status} 
        size="md"
        showDot={false}
      />
    );
  };

  return (
    <div className="flex items-center py-4 border-b border-gray-100">
      <div className="flex items-center gap-3 w-48">
        <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-900">{label}</span>
            <CWVTooltip 
              metric={metric} 
              currentValue={mobileValue?.value ?? desktopValue?.value}
              currentStatus={mobileValue?.status ?? desktopValue?.status}
            />
          </div>
          <span className="text-xs text-gray-500">
            Good: ≤{threshold.good}{threshold.unit === 'ms' && threshold.good >= 1000 ? 's' : threshold.unit}
          </span>
        </div>
      </div>
      
      {/* Mobile */}
      <div className="flex-1 text-center">
        {renderValue(mobileValue)}
      </div>
      
      {/* Desktop */}
      <div className="flex-1 text-center">
        {renderValue(desktopValue)}
      </div>
    </div>
  );
}

// Status summary component
function StatusSummary({ status, label }: { status: CWVStatus; label: string }) {
  const colors = CWV_STATUS_COLORS[status];
  const statusLabels = {
    good: 'Passing',
    needs_improvement: 'Needs Work',
    poor: 'Failing',
  };

  return (
    <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
        <span className={`text-sm font-medium ${colors.text}`}>
          {statusLabels[status]}
        </span>
      </div>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

export function CWVDetailPanel({ 
  isOpen, 
  onClose, 
  url,
  mobileData,
  desktopData 
}: CWVDetailPanelProps) {
  if (!isOpen) return null;

  const hasData = mobileData || desktopData;
  const primaryData = mobileData || desktopData;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Core Web Vitals</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1 max-w-full truncate"
            >
              {url}
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {!hasData ? (
          /* No data state */
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gauge size={32} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">No CWV Data</h3>
            <p className="text-sm text-gray-500">
              Core Web Vitals have not been measured for this page yet.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Overall Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Smartphone size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Mobile</span>
                </div>
                {mobileData ? (
                  <div className="flex flex-col items-center">
                    <CWVScoreBadge 
                      score={mobileData.performanceScore} 
                      status={mobileData.overallStatus}
                    />
                    <span className="mt-2 text-xs text-gray-500">Performance Score</span>
                  </div>
                ) : (
                  <span className="text-gray-400">No data</span>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Monitor size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Desktop</span>
                </div>
                {desktopData ? (
                  <div className="flex flex-col items-center">
                    <CWVScoreBadge 
                      score={desktopData.performanceScore} 
                      status={desktopData.overallStatus}
                    />
                    <span className="mt-2 text-xs text-gray-500">Performance Score</span>
                  </div>
                ) : (
                  <span className="text-gray-400">No data</span>
                )}
              </div>
            </div>

            {/* Status Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessment</h3>
              <div className="grid grid-cols-3 gap-3">
                <StatusSummary 
                  status={primaryData?.lcp.status || 'poor'} 
                  label="LCP"
                />
                <StatusSummary 
                  status={primaryData?.inp?.status || 'good'} 
                  label="INP"
                />
                <StatusSummary 
                  status={primaryData?.cls.status || 'poor'} 
                  label="CLS"
                />
              </div>
            </div>

            {/* Detailed Metrics */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Detailed Metrics</h3>
              
              {/* Column headers */}
              <div className="flex items-center py-2 border-b-2 border-gray-200">
                <div className="w-48 text-sm font-medium text-gray-500">Metric</div>
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-500">
                    <Smartphone size={14} />
                    Mobile
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-500">
                    <Monitor size={14} />
                    Desktop
                  </div>
                </div>
              </div>

              {/* Primary CWV */}
              <MetricRow
                icon={<Clock size={18} />}
                label="LCP"
                metric="lcp"
                mobileValue={mobileData?.lcp}
                desktopValue={desktopData?.lcp}
              />
              <MetricRow
                icon={<Zap size={18} />}
                label="INP"
                metric="inp"
                mobileValue={mobileData?.inp}
                desktopValue={desktopData?.inp}
              />
              <MetricRow
                icon={<LayoutGrid size={18} />}
                label="CLS"
                metric="cls"
                mobileValue={mobileData?.cls}
                desktopValue={desktopData?.cls}
              />

              {/* Additional metrics */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-400 uppercase">Additional</span>
              </div>
              <MetricRow
                icon={<Gauge size={18} />}
                label="FCP"
                metric="fcp"
                mobileValue={mobileData?.fcp}
                desktopValue={desktopData?.fcp}
              />
              <MetricRow
                icon={<Server size={18} />}
                label="TTFB"
                metric="ttfb"
                mobileValue={mobileData?.ttfb}
                desktopValue={desktopData?.ttfb}
              />
            </div>

            {/* Last measured */}
            {primaryData?.measuredAt && (
              <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-100">
                Last measured: {new Date(primaryData.measuredAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default CWVDetailPanel;
