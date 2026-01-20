'use client';

/**
 * RenderModeBadge Component
 * 
 * Shows render mode (HTML vs JS-rendered) with icon and tooltip
 */

import { useState } from 'react';
import { FileCode, Globe, Info } from 'lucide-react';

export type RenderMode = 'html' | 'js_rendered';

interface RenderModeBadgeProps {
  mode: RenderMode;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const RENDER_MODE_CONFIG = {
  html: {
    label: 'HTML',
    shortLabel: 'HTML',
    icon: FileCode,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Static HTML',
    tooltip: {
      title: 'HTML-only Crawl',
      description: 'Page was analyzed from raw HTML response without JavaScript execution.',
      details: [
        'Fast and lightweight',
        'Suitable for server-rendered pages',
        'May miss JS-generated content'
      ]
    }
  },
  js_rendered: {
    label: 'JS Rendered',
    shortLabel: 'JS',
    icon: Globe,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Browser rendered',
    tooltip: {
      title: 'JavaScript-rendered Crawl',
      description: 'Page was loaded in a real browser with full JavaScript execution.',
      details: [
        'Captures dynamic content',
        'Shows what users & Googlebot see',
        'Slower but more accurate for SPAs'
      ]
    }
  }
};

export function RenderModeBadge({ mode, showLabel = true, size = 'sm' }: RenderModeBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = RENDER_MODE_CONFIG[mode];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      badge: 'px-2 py-0.5 text-xs',
      icon: 14,
      tooltip: 'w-64'
    },
    md: {
      badge: 'px-3 py-1 text-sm',
      icon: 16,
      tooltip: 'w-72'
    }
  };

  const sizes = sizeClasses[size];

  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={`
          inline-flex items-center gap-1.5 rounded-full border font-medium
          ${sizes.badge}
          ${config.bgColor} ${config.borderColor} ${config.color}
          hover:opacity-80 transition-opacity cursor-help
        `}
      >
        <Icon size={sizes.icon} />
        {showLabel && <span>{config.shortLabel}</span>}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className={`
          absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
          ${sizes.tooltip} p-3 bg-gray-900 text-white rounded-lg shadow-xl
          text-left
        `}>
          <div className="flex items-center gap-2 mb-2">
            <Icon size={16} className={mode === 'html' ? 'text-blue-400' : 'text-purple-400'} />
            <span className="font-semibold">{config.tooltip.title}</span>
          </div>
          <p className="text-sm text-gray-300 mb-2">
            {config.tooltip.description}
          </p>
          <ul className="text-xs text-gray-400 space-y-1">
            {config.tooltip.details.map((detail, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-500" />
                {detail}
              </li>
            ))}
          </ul>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * RenderModeFilter Component
 * 
 * Filter dropdown for render mode
 */
interface RenderModeFilterProps {
  value: RenderMode | 'all';
  onChange: (value: RenderMode | 'all') => void;
}

export function RenderModeFilter({ value, onChange }: RenderModeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Render:</span>
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onChange('all')}
          className={`
            px-3 py-1 text-sm rounded-md transition-colors
            ${value === 'all' 
              ? 'bg-white shadow text-gray-900 font-medium' 
              : 'text-gray-500 hover:text-gray-700'}
          `}
        >
          All
        </button>
        <button
          onClick={() => onChange('html')}
          className={`
            px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1
            ${value === 'html' 
              ? 'bg-white shadow text-blue-600 font-medium' 
              : 'text-gray-500 hover:text-gray-700'}
          `}
        >
          <FileCode size={14} />
          HTML
        </button>
        <button
          onClick={() => onChange('js_rendered')}
          className={`
            px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1
            ${value === 'js_rendered' 
              ? 'bg-white shadow text-purple-600 font-medium' 
              : 'text-gray-500 hover:text-gray-700'}
          `}
        >
          <Globe size={14} />
          JS
        </button>
      </div>
    </div>
  );
}

/**
 * RenderModeCell Component
 * 
 * Table cell for render mode column
 */
interface RenderModeCellProps {
  mode: RenderMode;
  renderTime?: number;
}

export function RenderModeCell({ mode, renderTime }: RenderModeCellProps) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <RenderModeBadge mode={mode} size="sm" />
      {renderTime !== undefined && renderTime > 0 && (
        <span className="text-xs text-gray-400">
          {renderTime < 1000 ? `${renderTime}ms` : `${(renderTime / 1000).toFixed(1)}s`}
        </span>
      )}
    </div>
  );
}

/**
 * RenderModeStats Component
 * 
 * Summary stats for render modes
 */
interface RenderModeStatsProps {
  htmlCount: number;
  jsRenderedCount: number;
  total: number;
}

export function RenderModeStats({ htmlCount, jsRenderedCount, total }: RenderModeStatsProps) {
  const htmlPercent = total > 0 ? (htmlCount / total) * 100 : 0;
  const jsPercent = total > 0 ? (jsRenderedCount / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-blue-600">
          <FileCode size={14} />
          <span className="font-medium">{htmlCount}</span>
        </div>
        <span className="text-gray-400">HTML ({htmlPercent.toFixed(0)}%)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-purple-600">
          <Globe size={14} />
          <span className="font-medium">{jsRenderedCount}</span>
        </div>
        <span className="text-gray-400">JS ({jsPercent.toFixed(0)}%)</span>
      </div>
    </div>
  );
}

/**
 * Column header with info tooltip
 */
export function RenderModeHeader() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1">
      <span>Render</span>
      <button
        onMouseEnter={() => setShowInfo(true)}
        onMouseLeave={() => setShowInfo(false)}
        className="text-gray-400 hover:text-gray-600"
      >
        <Info size={14} />
      </button>

      {showInfo && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 p-3 bg-gray-900 text-white rounded-lg shadow-xl text-left text-xs">
          <p className="font-medium mb-2">Render Mode</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <FileCode size={14} className="text-blue-400 mt-0.5" />
              <div>
                <span className="font-medium text-blue-400">HTML</span>
                <p className="text-gray-400">Static HTML without JS execution</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Globe size={14} className="text-purple-400 mt-0.5" />
              <div>
                <span className="font-medium text-purple-400">JS Rendered</span>
                <p className="text-gray-400">Browser-rendered with JavaScript</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RenderModeBadge;
