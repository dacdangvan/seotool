'use client';

/**
 * CWVTableColumns Component
 * 
 * CWV columns for the crawl results table
 */

import React from 'react';
import { Smartphone, Monitor, Gauge } from 'lucide-react';
import { PageCWV, DeviceProfile, CWV_STATUS_COLORS } from '@/types/cwv.types';
import { CWVBadge } from './CWVBadge';
import { CWVMetricHeader } from './CWVTooltip';

interface CWVCellProps {
  data: PageCWV[] | undefined;
  device: DeviceProfile;
  onClick?: () => void;
}

/**
 * Score cell - shows performance score
 */
export function CWVScoreCell({ data, device, onClick }: CWVCellProps) {
  const cwv = data?.find(d => d.device === device);
  
  if (!cwv) {
    return <span className="text-gray-300">—</span>;
  }

  const colors = CWV_STATUS_COLORS[cwv.overallStatus];

  return (
    <button
      onClick={onClick}
      className={`
        px-2.5 py-1 rounded-lg font-medium text-sm
        ${colors.bg} ${colors.text}
        hover:opacity-80 transition-opacity
      `}
      title="Click for details"
    >
      {cwv.performanceScore}
    </button>
  );
}

/**
 * LCP cell
 */
export function LCPCell({ data, device, onClick }: CWVCellProps) {
  const cwv = data?.find(d => d.device === device);
  
  if (!cwv) {
    return <span className="text-gray-300">—</span>;
  }

  return (
    <button onClick={onClick} className="hover:opacity-80 transition-opacity">
      <CWVBadge 
        value={cwv.lcp.displayValue} 
        status={cwv.lcp.status}
        showDot={false}
      />
    </button>
  );
}

/**
 * INP cell
 */
export function INPCell({ data, device, onClick }: CWVCellProps) {
  const cwv = data?.find(d => d.device === device);
  
  if (!cwv || !cwv.inp) {
    return <span className="text-gray-300 text-xs">N/A</span>;
  }

  return (
    <button onClick={onClick} className="hover:opacity-80 transition-opacity">
      <CWVBadge 
        value={cwv.inp.displayValue} 
        status={cwv.inp.status}
        showDot={false}
      />
    </button>
  );
}

/**
 * CLS cell
 */
export function CLSCell({ data, device, onClick }: CWVCellProps) {
  const cwv = data?.find(d => d.device === device);
  
  if (!cwv) {
    return <span className="text-gray-300">—</span>;
  }

  return (
    <button onClick={onClick} className="hover:opacity-80 transition-opacity">
      <CWVBadge 
        value={cwv.cls.displayValue} 
        status={cwv.cls.status}
        showDot={false}
      />
    </button>
  );
}

/**
 * Combined CWV cell - shows all 3 primary metrics
 */
export function CWVCombinedCell({ data, device, onClick }: CWVCellProps) {
  const cwv = data?.find(d => d.device === device);
  
  if (!cwv) {
    return <span className="text-gray-300 text-xs">No CWV data</span>;
  }

  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
      title="Click for details"
    >
      <CWVBadge value={cwv.lcp.displayValue} status={cwv.lcp.status} showDot={false} />
      {cwv.inp && (
        <CWVBadge value={cwv.inp.displayValue} status={cwv.inp.status} showDot={false} />
      )}
      <CWVBadge value={cwv.cls.displayValue} status={cwv.cls.status} showDot={false} />
    </button>
  );
}

/**
 * Table header with device toggle
 */
interface CWVTableHeaderProps {
  device: DeviceProfile;
  onDeviceChange: (device: DeviceProfile) => void;
}

export function CWVTableHeader({ device, onDeviceChange }: CWVTableHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700">Core Web Vitals</span>
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onDeviceChange('mobile')}
          className={`
            flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
            ${device === 'mobile' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}
          `}
        >
          <Smartphone size={12} />
          Mobile
        </button>
        <button
          onClick={() => onDeviceChange('desktop')}
          className={`
            flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
            ${device === 'desktop' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}
          `}
        >
          <Monitor size={12} />
          Desktop
        </button>
      </div>
    </div>
  );
}

/**
 * Column definitions for CWV
 */
export const CWV_COLUMN_HEADERS = {
  score: {
    key: 'cwv_score',
    label: 'Score',
    sortable: true,
    width: 'w-16',
  },
  lcp: {
    key: 'cwv_lcp',
    label: 'LCP',
    sortable: true,
    width: 'w-20',
    tooltip: true,
  },
  inp: {
    key: 'cwv_inp',
    label: 'INP',
    sortable: true,
    width: 'w-20',
    tooltip: true,
  },
  cls: {
    key: 'cwv_cls',
    label: 'CLS',
    sortable: true,
    width: 'w-20',
    tooltip: true,
  },
};

export default {
  CWVScoreCell,
  LCPCell,
  INPCell,
  CLSCell,
  CWVCombinedCell,
  CWVTableHeader,
};
