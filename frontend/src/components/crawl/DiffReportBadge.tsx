'use client';

/**
 * Diff Report Components
 * 
 * UI components for displaying Raw HTML vs Rendered DOM diff reports
 * Per Section 9 of AI_SEO_TOOL_PROMPT_BOOK.md v2.2
 */

import { useState } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  FileCode,
  Globe,
  ArrowRight
} from 'lucide-react';

// ==========================================
// Types
// ==========================================

export type DiffCategory = 
  | 'ADDED_BY_JS'
  | 'MISSING_IN_RENDER'
  | 'CHANGED_BY_JS'
  | 'IDENTICAL';

export type JsDependencyRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DiffSummary {
  title: DiffCategory;
  metaDescription: DiffCategory;
  canonical: DiffCategory;
  robots: DiffCategory;
  h1: DiffCategory;
  h1Count: {
    raw: number;
    rendered: number;
  };
  internalLinks: {
    category: DiffCategory;
    raw: number;
    rendered: number;
    difference: number;
    percentChange: number;
  };
  externalLinks: {
    category: DiffCategory;
    raw: number;
    rendered: number;
    difference: number;
    percentChange: number;
  };
  structuredData: DiffCategory;
  structuredDataTypes: {
    raw: string[];
    rendered: string[];
  };
  visibleTextLength: {
    raw: number;
    rendered: number;
    difference: number;
  };
}

export interface DiffReport {
  url: string;
  renderMode: 'html' | 'js_rendered';
  diffSummary: DiffSummary;
  jsDependencyRisk: JsDependencyRisk;
  riskFactors: string[];
  timestamp: string;
}

// ==========================================
// Risk Badge Component
// ==========================================

interface JsRiskBadgeProps {
  risk: JsDependencyRisk;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RISK_CONFIG = {
  LOW: {
    label: 'Low JS Risk',
    shortLabel: 'Low',
    icon: CheckCircle,
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    description: 'SEO elements are present in raw HTML. Google can index without JS.',
  },
  MEDIUM: {
    label: 'Medium JS Risk',
    shortLabel: 'Medium',
    icon: AlertCircle,
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    description: 'Some SEO elements depend on JavaScript. May affect indexing.',
  },
  HIGH: {
    label: 'High JS Risk',
    shortLabel: 'High',
    icon: AlertTriangle,
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    description: 'Critical SEO elements require JavaScript. High indexing risk.',
  },
};

export function JsRiskBadge({ risk, showLabel = true, size = 'sm' }: JsRiskBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = RISK_CONFIG[risk];
  const Icon = config.icon;

  const sizeClasses = {
    sm: { badge: 'px-2 py-0.5 text-xs', icon: 12 },
    md: { badge: 'px-2.5 py-1 text-sm', icon: 14 },
    lg: { badge: 'px-3 py-1.5 text-sm', icon: 16 },
  };

  const sizes = sizeClasses[size];

  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          inline-flex items-center gap-1 rounded-full border font-medium
          ${sizes.badge}
          ${config.bgColor} ${config.textColor} ${config.borderColor}
          hover:opacity-80 transition-opacity cursor-help
        `}
      >
        <Icon size={sizes.icon} />
        {showLabel && <span>{config.shortLabel}</span>}
      </button>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white rounded-lg shadow-xl text-left">
          <div className="flex items-center gap-2 mb-1">
            <Icon size={14} />
            <span className="font-semibold">{config.label}</span>
          </div>
          <p className="text-xs text-gray-300">{config.description}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Diff Category Badge
// ==========================================

interface DiffCategoryBadgeProps {
  category: DiffCategory;
  showLabel?: boolean;
}

const DIFF_CATEGORY_CONFIG = {
  ADDED_BY_JS: {
    label: 'Added by JS',
    shortLabel: '+JS',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  MISSING_IN_RENDER: {
    label: 'Missing in Render',
    shortLabel: '-Render',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  CHANGED_BY_JS: {
    label: 'Changed by JS',
    shortLabel: '~JS',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  IDENTICAL: {
    label: 'Identical',
    shortLabel: '=',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

export function DiffCategoryBadge({ category, showLabel = false }: DiffCategoryBadgeProps) {
  const config = DIFF_CATEGORY_CONFIG[category];

  if (category === 'IDENTICAL') {
    return (
      <span className={`text-xs ${config.color}`}>—</span>
    );
  }

  return (
    <span className={`
      inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
      ${config.bgColor} ${config.color}
    `}>
      {showLabel ? config.label : config.shortLabel}
    </span>
  );
}

// ==========================================
// Risk Filter Component
// ==========================================

interface JsRiskFilterProps {
  value: JsDependencyRisk | 'all';
  onChange: (value: JsDependencyRisk | 'all') => void;
}

export function JsRiskFilter({ value, onChange }: JsRiskFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">JS Risk:</span>
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onChange('all')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            value === 'all' ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onChange('HIGH')}
          className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
            value === 'HIGH' ? 'bg-white shadow text-red-600 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle size={14} />
          High
        </button>
        <button
          onClick={() => onChange('MEDIUM')}
          className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
            value === 'MEDIUM' ? 'bg-white shadow text-yellow-600 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertCircle size={14} />
          Med
        </button>
        <button
          onClick={() => onChange('LOW')}
          className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
            value === 'LOW' ? 'bg-white shadow text-green-600 font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle size={14} />
          Low
        </button>
      </div>
    </div>
  );
}

// ==========================================
// Risk Stats Component
// ==========================================

interface JsRiskStatsProps {
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export function JsRiskStats({ highCount, mediumCount, lowCount }: JsRiskStatsProps) {
  const total = highCount + mediumCount + lowCount;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={14} className="text-red-600" />
        <span className="font-medium text-red-600">{highCount}</span>
        <span className="text-gray-400">High</span>
      </div>
      <div className="flex items-center gap-1.5">
        <AlertCircle size={14} className="text-yellow-600" />
        <span className="font-medium text-yellow-600">{mediumCount}</span>
        <span className="text-gray-400">Med</span>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle size={14} className="text-green-600" />
        <span className="font-medium text-green-600">{lowCount}</span>
        <span className="text-gray-400">Low</span>
      </div>
      {total > 0 && (
        <span className="text-gray-400 text-xs">
          ({Math.round((highCount / total) * 100)}% high risk)
        </span>
      )}
    </div>
  );
}

// ==========================================
// Diff Report Panel (Expandable)
// ==========================================

interface DiffReportPanelProps {
  report: DiffReport;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function DiffReportPanel({ report, isExpanded = false, onToggle }: DiffReportPanelProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  const expanded = onToggle ? isExpanded : localExpanded;
  const toggle = onToggle || (() => setLocalExpanded(!localExpanded));

  const { diffSummary, jsDependencyRisk, riskFactors } = report;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <JsRiskBadge risk={jsDependencyRisk} size="md" />
          <span className="text-sm font-medium text-gray-700">
            HTML vs Rendered DOM Diff
          </span>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Risk Factors */}
          {riskFactors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Risk Factors</span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                {riskFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Diff Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Element</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">
                    <div className="flex items-center justify-center gap-1">
                      <FileCode size={12} />
                      Raw HTML
                    </div>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">→</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">
                    <div className="flex items-center justify-center gap-1">
                      <Globe size={12} />
                      Rendered
                    </div>
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <DiffRow label="Title" category={diffSummary.title} />
                <DiffRow label="Meta Description" category={diffSummary.metaDescription} />
                <DiffRow label="Canonical" category={diffSummary.canonical} />
                <DiffRow label="Robots" category={diffSummary.robots} />
                <DiffRow 
                  label="H1" 
                  category={diffSummary.h1}
                  rawValue={diffSummary.h1Count.raw.toString()}
                  renderedValue={diffSummary.h1Count.rendered.toString()}
                />
                <DiffRow 
                  label="Internal Links" 
                  category={diffSummary.internalLinks.category}
                  rawValue={diffSummary.internalLinks.raw.toString()}
                  renderedValue={`${diffSummary.internalLinks.rendered} (${diffSummary.internalLinks.percentChange > 0 ? '+' : ''}${diffSummary.internalLinks.percentChange}%)`}
                />
                <DiffRow label="Structured Data" category={diffSummary.structuredData} />
              </tbody>
            </table>
          </div>

          {/* Text Length Comparison */}
          <div className="flex items-center gap-4 text-sm text-gray-600 pt-2 border-t">
            <span className="font-medium">Visible Text:</span>
            <span>{diffSummary.visibleTextLength.raw.toLocaleString()} chars (raw)</span>
            <ArrowRight size={14} />
            <span>{diffSummary.visibleTextLength.rendered.toLocaleString()} chars (rendered)</span>
            {diffSummary.visibleTextLength.difference !== 0 && (
              <span className={diffSummary.visibleTextLength.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                ({diffSummary.visibleTextLength.difference > 0 ? '+' : ''}{diffSummary.visibleTextLength.difference.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for diff rows
function DiffRow({ 
  label, 
  category, 
  rawValue, 
  renderedValue 
}: { 
  label: string; 
  category: DiffCategory;
  rawValue?: string;
  renderedValue?: string;
}) {
  const isJsDependant = category === 'ADDED_BY_JS' || category === 'CHANGED_BY_JS';

  return (
    <tr className={isJsDependant ? 'bg-purple-50/50' : ''}>
      <td className="py-2 px-3 font-medium text-gray-700">{label}</td>
      <td className="py-2 px-3 text-center text-gray-500">
        {rawValue || (category === 'ADDED_BY_JS' ? '—' : '✓')}
      </td>
      <td className="py-2 px-3 text-center text-gray-400">→</td>
      <td className="py-2 px-3 text-center text-gray-500">
        {renderedValue || (category === 'MISSING_IN_RENDER' ? '—' : '✓')}
      </td>
      <td className="py-2 px-3 text-center">
        <DiffCategoryBadge category={category} />
      </td>
    </tr>
  );
}

// ==========================================
// Table Cell Component
// ==========================================

interface JsRiskCellProps {
  risk: JsDependencyRisk;
  riskFactorsCount?: number;
  onClick?: () => void;
}

export function JsRiskCell({ risk, riskFactorsCount, onClick }: JsRiskCellProps) {
  return (
    <div 
      className="flex items-center gap-2 cursor-pointer hover:opacity-80"
      onClick={onClick}
    >
      <JsRiskBadge risk={risk} size="sm" />
      {riskFactorsCount !== undefined && riskFactorsCount > 0 && (
        <span className="text-xs text-gray-400">
          ({riskFactorsCount} factors)
        </span>
      )}
    </div>
  );
}

// ==========================================
// Table Header Component
// ==========================================

export function JsRiskHeader() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1">
      <span>JS Risk</span>
      <button
        onMouseEnter={() => setShowInfo(true)}
        onMouseLeave={() => setShowInfo(false)}
        className="text-gray-400 hover:text-gray-600"
      >
        <Info size={14} />
      </button>

      {showInfo && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 p-3 bg-gray-900 text-white rounded-lg shadow-xl text-left text-xs">
          <p className="font-medium mb-2">JS Dependency Risk</p>
          <p className="text-gray-400 mb-2">
            Indicates how much the page depends on JavaScript for SEO-critical elements.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle size={12} className="text-green-400" />
              <span className="text-green-400 font-medium">Low</span>
              <span className="text-gray-400">- SEO works without JS</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle size={12} className="text-yellow-400" />
              <span className="text-yellow-400 font-medium">Medium</span>
              <span className="text-gray-400">- Some JS dependency</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-red-400 font-medium">High</span>
              <span className="text-gray-400">- Critical elements need JS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JsRiskBadge;
