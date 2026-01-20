'use client';

/**
 * CWVTooltip Component
 * 
 * Tooltip explaining CWV metric thresholds
 */

import React, { useState, useRef, useEffect } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { CWV_THRESHOLDS, CWV_STATUS_COLORS, CWVStatus } from '@/types/cwv.types';

interface CWVTooltipProps {
  metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb';
  currentValue?: number;
  currentStatus?: CWVStatus;
  children?: React.ReactNode;
}

export function CWVTooltip({ metric, currentValue, currentStatus, children }: CWVTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const threshold = CWV_THRESHOLDS[metric];

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatThreshold = (value: number) => {
    if (metric === 'cls') return value.toString();
    if (value >= 1000) return `${value / 1000}s`;
    return `${value}ms`;
  };

  const StatusIcon = ({ status }: { status: CWVStatus }) => {
    const icons = {
      good: <CheckCircle size={14} className="text-green-500" />,
      needs_improvement: <AlertTriangle size={14} className="text-amber-500" />,
      poor: <XCircle size={14} className="text-red-500" />,
    };
    return icons[status];
  };

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex items-center text-gray-400 hover:text-gray-600 transition-colors"
      >
        {children || <Info size={14} />}
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72">
          <div className="bg-gray-900 text-white rounded-lg shadow-xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{threshold.label}</h4>
              {currentStatus && (
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-medium
                  ${CWV_STATUS_COLORS[currentStatus].bg} ${CWV_STATUS_COLORS[currentStatus].text}
                `}>
                  {currentStatus.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-300 mb-4">
              {threshold.description}
            </p>

            {/* Current value */}
            {currentValue !== undefined && (
              <div className="mb-4 p-2 bg-gray-800 rounded">
                <span className="text-xs text-gray-400">Current value:</span>
                <span className="ml-2 font-mono font-bold">
                  {metric === 'cls' ? currentValue.toFixed(3) : `${currentValue}${threshold.unit}`}
                </span>
              </div>
            )}

            {/* Thresholds */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <StatusIcon status="good" />
                <span className="text-green-400">Good:</span>
                <span className="text-gray-300">
                  ≤ {formatThreshold(threshold.good)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <StatusIcon status="needs_improvement" />
                <span className="text-amber-400">Needs Improvement:</span>
                <span className="text-gray-300">
                  {formatThreshold(threshold.good)} - {formatThreshold(threshold.poor)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <StatusIcon status="poor" />
                <span className="text-red-400">Poor:</span>
                <span className="text-gray-300">
                  {'>'} {formatThreshold(threshold.poor)}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-3 h-3 bg-gray-900 rotate-45" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CWVMetricHeader - Column header with tooltip
 */
interface CWVMetricHeaderProps {
  metric: 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb';
  label?: string;
}

export function CWVMetricHeader({ metric, label }: CWVMetricHeaderProps) {
  const displayLabel = label || metric.toUpperCase();

  return (
    <div className="flex items-center gap-1">
      <span>{displayLabel}</span>
      <CWVTooltip metric={metric} />
    </div>
  );
}

export default CWVTooltip;
