'use client';

/**
 * CWVBadge Component
 * 
 * Compact badge showing CWV metric value with color-coded status
 */

import React from 'react';
import { CWVStatus, CWV_STATUS_COLORS } from '@/types/cwv.types';

interface CWVBadgeProps {
  value: string;
  status: CWVStatus;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function CWVBadge({ 
  value, 
  status, 
  label, 
  size = 'sm',
  showDot = true 
}: CWVBadgeProps) {
  const colors = CWV_STATUS_COLORS[status];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full font-medium
      ${colors.bg} ${colors.text} ${sizeClasses[size]}
    `}>
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      )}
      {label && <span className="text-gray-500 font-normal">{label}:</span>}
      <span>{value}</span>
    </div>
  );
}

/**
 * CWVBadgeGroup - Show multiple CWV metrics in a row
 */
interface CWVBadgeGroupProps {
  lcp?: { value: string; status: CWVStatus };
  inp?: { value: string; status: CWVStatus } | null;
  cls?: { value: string; status: CWVStatus };
}

export function CWVBadgeGroup({ lcp, inp, cls }: CWVBadgeGroupProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {lcp && (
        <CWVBadge value={lcp.value} status={lcp.status} label="LCP" />
      )}
      {inp && (
        <CWVBadge value={inp.value} status={inp.status} label="INP" />
      )}
      {cls && (
        <CWVBadge value={cls.value} status={cls.status} label="CLS" />
      )}
    </div>
  );
}

/**
 * CWVScoreBadge - Large score badge with overall status
 */
interface CWVScoreBadgeProps {
  score: number;
  status: CWVStatus;
}

export function CWVScoreBadge({ score, status }: CWVScoreBadgeProps) {
  const colors = CWV_STATUS_COLORS[status];
  
  return (
    <div className={`
      w-14 h-14 rounded-full flex items-center justify-center
      ${colors.bg} border-2 ${colors.border}
    `}>
      <span className={`text-lg font-bold ${colors.text}`}>{score}</span>
    </div>
  );
}

export default CWVBadge;
